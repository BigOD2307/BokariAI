import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  COUNTRY_COOKIE_NAME,
  COUNTRY_COOKIE_MAX_AGE,
  parseCfIpCountry,
} from '@/lib/auth/country';
import { verifyAccessToken, readBearer } from '@/lib/auth/jwt';

const COUNTRY_HEADER = 'cf-ipcountry';

/** Headers the middleware injects for downstream handlers. A client could send
 *  these itself, so they are ALWAYS deleted before being (re)set. */
export const USER_ID_HEADER = 'x-bokari-user-id';
export const USER_ROLE_HEADER = 'x-bokari-user-role';
export const USER_EMAIL_HEADER = 'x-bokari-user-email';

/** Routes reachable without a session. Anything not listed requires a valid JWT.
 *  Adding a route here is a security decision — it belongs in code review.
 *
 *  `/api/chat` is here deliberately: it accepts anonymous callers, but every
 *  request still gets metered by `chargeOrReject` (src/lib/quota/guard.ts) at
 *  the handler level, against a guest fingerprint quota instead of a user id. */
const PUBLIC_API = [
  /^\/api\/auth\//,                // register/login/me/logout must be reachable without a token; each gates itself (me/logout tolerate anonymous callers, register/login validate their own body)
  /^\/api\/p\/[^/]+$/,            // public share payload
  /^\/api\/shares\/[^/]+\/view$/, // view counter
  /^\/api\/discover$/,            // read-only feed, cached
  /^\/api\/weather$/,
  /^\/api\/turnstile\/verify$/,
  /^\/api\/health$/,
  /^\/api\/chat$/,                // guest quota enforced in the handler, not here
  /^\/api\/guest\/track$/,        // legacy guest cookie tracker (superseded by quota, C2)
];

/** Routes authenticated by a shared secret instead of a user session.
 *  The route handler checks CRON_SECRET itself; the middleware just steps aside. */
const SECRET_API = [/^\/api\/internal\//, /^\/api\/discover\/refresh$/];

/** Routes requiring app_metadata.role === 'admin'. */
const ADMIN_API = [/^\/api\/(config|providers|setup|admin)(\/|$)/];

export const config = {
  // Unchanged from the original except that API paths are matched explicitly:
  // the `.*\..*` exclusion below skips any path containing a dot, and we do not
  // want a route like /api/p/foo.bar to slip past the auth check.
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

function securityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set(
    'Permissions-Policy',
    'camera=(), geolocation=(), payment=(), usb=()',
  );
  return res;
}

function applyCountryCookie(req: NextRequest, res: NextResponse): NextResponse {
  if (req.cookies.get(COUNTRY_COOKIE_NAME)?.value) return res;
  const headerValue = req.headers.get(COUNTRY_HEADER);
  if (!headerValue) return res;

  res.cookies.set({
    name: COUNTRY_COOKIE_NAME,
    value: parseCfIpCountry(headerValue),
    path: '/',
    maxAge: COUNTRY_COOKIE_MAX_AGE,
    sameSite: 'lax',
  });
  return res;
}

function deny(status: 401 | 404, code: string) {
  return NextResponse.json({ error: code }, { status });
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  if (!path.startsWith('/api/')) {
    return securityHeaders(applyCountryCookie(request, NextResponse.next()));
  }

  if (SECRET_API.some((r) => r.test(path))) {
    return securityHeaders(NextResponse.next());
  }

  // Strip client-supplied identity headers unconditionally, then re-add ours.
  const headers = new Headers(request.headers);
  headers.delete(USER_ID_HEADER);
  headers.delete(USER_ROLE_HEADER);
  headers.delete(USER_EMAIL_HEADER);

  const claims = await verifyAccessToken(readBearer(request));

  if (claims) {
    headers.set(USER_ID_HEADER, claims.userId);
    headers.set(USER_ROLE_HEADER, claims.role);
    if (claims.email) headers.set(USER_EMAIL_HEADER, claims.email);
  }

  const isPublic = PUBLIC_API.some((r) => r.test(path));
  const isAdminRoute = ADMIN_API.some((r) => r.test(path));

  if (!claims && !isPublic) {
    return securityHeaders(deny(401, 'UNAUTHENTICATED'));
  }

  if (isAdminRoute && claims?.role !== 'admin') {
    // 404 rather than 403: an anonymous prober learns nothing about which
    // admin surfaces exist.
    return securityHeaders(deny(404, 'NOT_FOUND'));
  }

  return securityHeaders(
    applyCountryCookie(request, NextResponse.next({ request: { headers } })),
  );
}

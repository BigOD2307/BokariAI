/**
 * Mints access tokens shaped exactly like the ones Supabase Auth used to
 * issue, so `src/lib/auth/jwt.ts` (`verifyAccessToken`) needs zero changes —
 * it already supports local HS256 verification against `SUPABASE_JWT_SECRET`
 * with no network call. Same for the `sb-access-token` cookie name
 * (`jwt.ts` `readBearer`, formerly `supabase/server.ts`).
 *
 * No refresh-token rotation (Supabase had one; we don't) — a single 30-day
 * token is the whole session. Simpler, and matches this app's actual usage
 * (no multi-device session revocation UI exists to make rotation pay for
 * itself). Revisit if that changes.
 */
import { SignJWT } from 'jose';
import { ACCESS_TOKEN_COOKIE } from './constants';

export { ACCESS_TOKEN_COOKIE };

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? '';
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

if (process.env.NEXT_PHASE !== 'phase-production-build' && !JWT_SECRET) {
  throw new Error('[Bokari Auth] Missing SUPABASE_JWT_SECRET.');
}

const secretKey = new TextEncoder().encode(JWT_SECRET);

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
};

export async function signAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    app_metadata: { role: user.role },
    email_verified: user.emailVerified,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey);
}

export function accessTokenCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${ACCESS_TOKEN_TTL_SECONDS}; SameSite=Lax${secure}`;
}

export function clearAccessTokenCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

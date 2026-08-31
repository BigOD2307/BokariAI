/**
 * Local verification of Supabase access tokens.
 *
 * Supabase issues either HS256 tokens signed with the project's JWT secret
 * (legacy projects) or asymmetric tokens verifiable through the project's
 * JWKS endpoint (projects migrated to signing keys). We support both and pick
 * whichever the deployment is configured for, so rotating to asymmetric keys
 * later is a config change, not a code change.
 *
 * Verifying locally instead of calling GoTrue removes a 50-200ms network hop
 * from EVERY authenticated request, including the SSE hot path.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type BokariClaims = {
  userId: string;
  email: string | null;
  role: string;
  emailVerified: boolean;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? '';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
      // jose caches the key set and refetches on unknown `kid`, so a key
      // rotation heals itself without a redeploy.
      { cooldownDuration: 30_000 },
    );
  }
  return jwks;
}

const hsKey = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

/**
 * Verify a raw bearer token. Returns null on ANY failure (expired, malformed,
 * wrong signature, wrong audience) — callers translate that into 401.
 */
export async function verifyAccessToken(
  token: string | null | undefined,
): Promise<BokariClaims | null> {
  if (!token) return null;

  try {
    let payload: JWTPayload;

    if (hsKey) {
      ({ payload } = await jwtVerify(token, hsKey, { algorithms: ['HS256'] }));
    } else {
      ({ payload } = await jwtVerify(token, getJwks()));
    }

    if (payload.aud !== 'authenticated') return null;
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    if (!sub) return null;

    const appMeta = (payload.app_metadata ?? {}) as Record<string, unknown>;

    return {
      userId: sub,
      email: typeof payload.email === 'string' ? payload.email : null,
      // app_metadata is set server-side only; user_metadata is user-writable
      // via supabase.auth.updateUser() and MUST NOT drive authorisation.
      role: typeof appMeta.role === 'string' ? appMeta.role : 'user',
      emailVerified: Boolean(payload.email_verified ?? payload.email_confirmed_at),
    };
  } catch {
    return null;
  }
}

/** Extract the bearer from an incoming request (header first, cookie second). */
export function readBearer(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;

  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

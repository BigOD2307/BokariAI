import { headers } from 'next/headers';
import { USER_ID_HEADER, USER_ROLE_HEADER, USER_EMAIL_HEADER } from '@/proxy';
import { verifyAccessToken, readBearer } from './jwt';

export type Caller = { userId: string; email: string | null; role: string };

/**
 * Resolve the caller inside a route handler.
 *
 * Fast path: the middleware already verified the token and stamped the request
 * headers. Slow path (middleware bypassed — direct origin hit, a matcher edge
 * case, a unit test): verify the bearer here. Defence in depth: a handler is
 * never allowed to trust the fast path alone.
 */
export async function getCaller(req: Request): Promise<Caller | null> {
  const h = await headers();
  const stamped = h.get(USER_ID_HEADER);
  if (stamped) {
    return {
      userId: stamped,
      email: h.get(USER_EMAIL_HEADER),
      role: h.get(USER_ROLE_HEADER) ?? 'user',
    };
  }

  const claims = await verifyAccessToken(readBearer(req));
  return claims
    ? { userId: claims.userId, email: claims.email, role: claims.role }
    : null;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
  toResponse() {
    return Response.json({ error: this.code }, { status: this.status });
  }
}

export async function requireUser(req: Request): Promise<Caller> {
  const caller = await getCaller(req);
  if (!caller) throw new HttpError(401, 'UNAUTHENTICATED');
  return caller;
}

export async function requireAdmin(req: Request): Promise<Caller> {
  const caller = await getCaller(req);
  if (!caller || caller.role !== 'admin') throw new HttpError(404, 'NOT_FOUND');
  return caller;
}

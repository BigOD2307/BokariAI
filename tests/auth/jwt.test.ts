import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { verifyAccessToken } from '@/lib/auth/jwt';

const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);

const sign = (payload: Record<string, unknown>, expiresIn = '1h') =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);

describe('verifyAccessToken', () => {
  it('accepts a well-formed authenticated token', async () => {
    const token = await sign({ sub: 'u1', aud: 'authenticated', email: 'a@b.c' });
    expect(await verifyAccessToken(token)).toMatchObject({ userId: 'u1', role: 'user' });
  });

  it('reads the role from app_metadata only', async () => {
    const token = await sign({
      sub: 'u1',
      aud: 'authenticated',
      app_metadata: { role: 'admin' },
      user_metadata: { role: 'superadmin' },
    });
    expect((await verifyAccessToken(token))?.role).toBe('admin');
  });

  it.each([
    ['expired', () => sign({ sub: 'u1', aud: 'authenticated' }, '-1h')],
    ['wrong audience', () => sign({ sub: 'u1', aud: 'anon' })],
    ['no subject', () => sign({ aud: 'authenticated' })],
  ])('rejects %s tokens', async (_label, make) => {
    expect(await verifyAccessToken(await make())).toBeNull();
  });

  it('rejects a token signed with another key', async () => {
    const other = new TextEncoder().encode('a'.repeat(48));
    const token = await new SignJWT({ sub: 'u1', aud: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(other);
    expect(await verifyAccessToken(token)).toBeNull();
  });
});

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { pgDb, schema } from '@/lib/db/postgres/client';
import { verifyPassword } from '@/lib/auth/password';
import { signAccessToken, accessTokenCookie } from '@/lib/auth/tokens';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const [user] = await pgDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return Response.json(
        { message: 'Email ou mot de passe incorrect' },
        { status: 401 },
      );
    }

    const token = await signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    });

    return Response.json(
      {
        user: {
          id: user.id,
          name: user.name || '',
          email: user.email,
          plan: user.plan,
        },
        access_token: token,
      },
      { headers: { 'Set-Cookie': accessTokenCookie(token) } },
    );
  } catch (err) {
    console.error('[Bokari Auth] Login error:', err);
    return Response.json(
      { message: 'Erreur lors de la connexion' },
      { status: 500 },
    );
  }
};

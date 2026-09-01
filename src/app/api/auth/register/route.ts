import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { pgDb, schema } from '@/lib/db/postgres/client';
import { hashPassword } from '@/lib/auth/password';
import { signAccessToken, accessTokenCookie } from '@/lib/auth/tokens';

const registerSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caracteres'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caracteres'),
});

export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const [existing] = await pgDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return Response.json(
        { message: 'Un compte avec cet email existe deja' },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const [user] = await pgDb
      .insert(schema.users)
      .values({ email: normalizedEmail, passwordHash, name })
      .returning();

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
      { status: 201, headers: { 'Set-Cookie': accessTokenCookie(token) } },
    );
  } catch (err) {
    console.error('[Bokari Auth] Register error:', err);
    return Response.json(
      { message: 'Erreur lors de la creation du compte' },
      { status: 500 },
    );
  }
};

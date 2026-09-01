import { eq } from 'drizzle-orm';
import { getCaller } from '@/lib/auth/require';
import { pgDb, schema } from '@/lib/db/postgres/client';

export const GET = async (req: Request) => {
  try {
    const caller = await getCaller(req);
    if (!caller) return Response.json({ user: null }, { status: 200 });

    const [user] = await pgDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, caller.userId))
      .limit(1);

    if (!user) return Response.json({ user: null }, { status: 200 });

    return Response.json({
      user: {
        id: user.id,
        name: user.name || '',
        email: user.email,
        plan: user.plan,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('[Bokari Auth] Me error:', err);
    return Response.json({ user: null }, { status: 200 });
  }
};

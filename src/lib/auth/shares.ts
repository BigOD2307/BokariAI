import { customAlphabet } from 'nanoid';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { pgDb, schema } from '@/lib/db/postgres/client';
import type { CreateShareInput, Share } from '@/lib/types/shares';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

export const generateShareId = (): string => `shr_${nanoid()}`;

export const generateShareSlug = (): string => nanoid();

type ShareRow = typeof schema.shares.$inferSelect;

const rowToShare = (row: ShareRow): Share => ({
  id: row.id,
  chatId: row.chatId,
  userId: row.userId,
  slug: row.slug,
  isIndexed: row.isIndexed,
  anonymousAuthor: row.anonymousAuthor,
  viewCount: row.viewCount,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
});

export const createShare = async (
  userId: string,
  input: CreateShareInput,
): Promise<Share> => {
  const id = generateShareId();
  const slug = generateShareSlug();
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  const [row] = await pgDb
    .insert(schema.shares)
    .values({
      id,
      chatId: input.chatId,
      userId,
      slug,
      isIndexed: input.isIndexed ?? true,
      anonymousAuthor: input.anonymousAuthor ?? false,
      expiresAt,
    })
    .returning();
  return rowToShare(row);
};

/** Replicates the old "Public shares are publicly readable" RLS policy:
 *  `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`. */
export const getShareBySlug = async (slug: string): Promise<Share | null> => {
  try {
    const [row] = await pgDb
      .select()
      .from(schema.shares)
      .where(and(eq(schema.shares.slug, slug), isNull(schema.shares.revokedAt)))
      .limit(1);
    if (!row) return null;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
    return rowToShare(row);
  } catch (error) {
    console.error('[shares] getShareBySlug error:', error);
    return null;
  }
};

export const getShareById = async (id: string): Promise<Share | null> => {
  try {
    const [row] = await pgDb.select().from(schema.shares).where(eq(schema.shares.id, id)).limit(1);
    return row ? rowToShare(row) : null;
  } catch (error) {
    console.error('[shares] getShareById error:', error);
    return null;
  }
};

export const getShareByChat = async (chatId: string): Promise<Share | null> => {
  try {
    const [row] = await pgDb
      .select()
      .from(schema.shares)
      .where(and(eq(schema.shares.chatId, chatId), isNull(schema.shares.revokedAt)))
      .orderBy(desc(schema.shares.createdAt))
      .limit(1);
    return row ? rowToShare(row) : null;
  } catch (error) {
    console.error('[shares] getShareByChat error:', error);
    return null;
  }
};

/** Was an RPC (`increment_share_view_count`) with a select+update fallback
 *  when the RPC errored — there's no separate RPC layer against Neon, so
 *  this now IS the direct path: a single atomic UPDATE ... RETURNING. */
export const incrementViewCount = async (id: string): Promise<number> => {
  try {
    const [row] = await pgDb
      .update(schema.shares)
      .set({ viewCount: sql`${schema.shares.viewCount} + 1` })
      .where(eq(schema.shares.id, id))
      .returning({ viewCount: schema.shares.viewCount });
    return row?.viewCount ?? 0;
  } catch {
    return 0;
  }
};

export const logShareView = async (
  shareId: string,
  meta: { referrer?: string; country?: string; userAgent?: string },
): Promise<void> => {
  await pgDb.insert(schema.shareViews).values({
    shareId,
    referrer: meta.referrer ?? null,
    country: meta.country ?? null,
    userAgent: meta.userAgent ?? null,
  });
};

export const revokeShare = async (id: string, userId: string): Promise<boolean> => {
  try {
    const rows = await pgDb
      .update(schema.shares)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.shares.id, id),
          eq(schema.shares.userId, userId),
          isNull(schema.shares.revokedAt),
        ),
      )
      .returning({ id: schema.shares.id });
    return rows.length > 0;
  } catch (error) {
    console.error('[shares] revokeShare error:', error);
    return false;
  }
};

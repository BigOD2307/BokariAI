import { customAlphabet } from 'nanoid';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CreateShareInput, Share } from '@/lib/types/shares';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('[shares] Missing SUPABASE env vars.');
  }
  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

export const generateShareId = (): string => `shr_${nanoid()}`;

export const generateShareSlug = (): string => nanoid();

const rowToShare = (row: any): Share => ({
  id: row.id,
  chatId: row.chat_id,
  userId: row.user_id,
  slug: row.slug,
  isIndexed: row.is_indexed,
  anonymousAuthor: row.anonymous_author,
  viewCount: row.view_count,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
});

export const createShare = async (
  userId: string,
  input: CreateShareInput,
): Promise<Share> => {
  const id = generateShareId();
  const slug = generateShareSlug();
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const { data, error } = await getAdmin()
    .from('shares')
    .insert({
      id,
      chat_id: input.chatId,
      user_id: userId,
      slug,
      is_indexed: input.isIndexed ?? true,
      anonymous_author: input.anonymousAuthor ?? false,
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToShare(data);
};

export const getShareBySlug = async (slug: string): Promise<Share | null> => {
  const { data, error } = await getAdmin()
    .from('shares')
    .select('*')
    .eq('slug', slug)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) {
    console.error('[shares] getShareBySlug error:', error);
    return null;
  }
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }
  return rowToShare(data);
};

export const getShareById = async (id: string): Promise<Share | null> => {
  const { data, error } = await getAdmin()
    .from('shares')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[shares] getShareById error:', error);
    return null;
  }
  return data ? rowToShare(data) : null;
};

export const getShareByChat = async (chatId: string): Promise<Share | null> => {
  const { data, error } = await getAdmin()
    .from('shares')
    .select('*')
    .eq('chat_id', chatId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[shares] getShareByChat error:', error);
    return null;
  }
  return data ? rowToShare(data) : null;
};

export const incrementViewCount = async (id: string): Promise<number> => {
  const { data, error } = await getAdmin().rpc('increment_share_view_count', {
    p_share_id: id,
  });
  if (error) {
    try {
      const { data: current } = await getAdmin()
        .from('shares')
        .select('view_count')
        .eq('id', id)
        .single();
      const next = (current?.view_count ?? 0) + 1;
      await getAdmin()
        .from('shares')
        .update({ view_count: next })
        .eq('id', id);
      return next;
    } catch {
      return 0;
    }
  }
  return data ?? 0;
};

export const logShareView = async (
  shareId: string,
  meta: { referrer?: string; country?: string; userAgent?: string },
): Promise<void> => {
  await getAdmin().from('share_views').insert({
    share_id: shareId,
    referrer: meta.referrer ?? null,
    country: meta.country ?? null,
    user_agent: meta.userAgent ?? null,
  });
};

export const revokeShare = async (id: string, userId: string): Promise<boolean> => {
  const { error, count } = await getAdmin()
    .from('shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (error) {
    console.error('[shares] revokeShare error:', error);
    return false;
  }
  return (count ?? 0) > 0;
};

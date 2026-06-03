import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { all, get, run } from '@/lib/db/sqlite';

export const GUEST_COOKIE = '_bk_anon';
export const GUEST_DAILY_LIMIT = 3;
const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface GuestSession {
  id: string;
  queriesCount: number;
  queriesRemaining: number;
  lastResetAt: number;
  isLimitReached: boolean;
}

interface GuestRow {
  id: string;
  queriesCount: number;
  lastResetAt: string;
  createdAt: string;
}

const ensureCookie = async (): Promise<string> => {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE);
  if (existing?.value) return existing.value;
  const id = randomUUID();
  store.set({
    name: GUEST_COOKIE,
    value: id,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_TTL_SECONDS,
  });
  return id;
};

const buildSession = (
  id: string,
  count: number,
  lastResetAt: number,
): GuestSession => ({
  id,
  queriesCount: count,
  queriesRemaining: Math.max(0, GUEST_DAILY_LIMIT - count),
  lastResetAt,
  isLimitReached: count >= GUEST_DAILY_LIMIT,
});

export const getGuestSession = async (): Promise<GuestSession> => {
  const id = await ensureCookie();
  let row = await get<GuestRow>('SELECT * FROM guest_sessions WHERE id = ?', [id]);
  if (!row) {
    const now = new Date().toISOString();
    await run(
      'INSERT INTO guest_sessions (id, queriesCount, lastResetAt, createdAt) VALUES (?, 0, ?, ?)',
      [id, now, now],
    );
    return buildSession(id, 0, Date.now());
  }
  const now = Date.now();
  const lastResetMs = new Date(row.lastResetAt).getTime();
  if (now - lastResetMs > RESET_WINDOW_MS) {
    const resetAt = new Date(now).toISOString();
    await run(
      'UPDATE guest_sessions SET queriesCount = 0, lastResetAt = ? WHERE id = ?',
      [resetAt, id],
    );
    return buildSession(id, 0, now);
  }
  return buildSession(id, row.queriesCount, lastResetMs);
};

export const incrementGuestQueries = async (): Promise<GuestSession> => {
  const id = await ensureCookie();
  const current = await getGuestSession();
  if (current.queriesRemaining <= 0) return current;
  const newCount = current.queriesCount + 1;
  await run(
    'UPDATE guest_sessions SET queriesCount = ? WHERE id = ?',
    [newCount, id],
  );
  return buildSession(id, newCount, current.lastResetAt);
};

export const purgeExpiredGuests = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const allRows = await all<{ id: string }>(
    'SELECT id FROM guest_sessions WHERE lastResetAt < ?',
    [cutoff],
  );
  for (const row of allRows) {
    await run('DELETE FROM guest_sessions WHERE id = ?', [row.id]);
  }
  return allRows.length;
};

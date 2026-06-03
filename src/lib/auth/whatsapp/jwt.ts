import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { get, run } from '@/lib/db/sqlite';

export const WHATSAPP_SESSION_COOKIE = 'sb-bokari-auth-token';
export const PHONE_USER_EMAIL_DOMAIN = 'whatsapp.bokari.app';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface WhatsAppSession {
  userId: string;
  phone: string;
  email: string;
  accessToken: string;
  createdAt: number;
  expiresAt: number;
}

export const createOrGetPhoneUser = async (
  phone: string,
): Promise<{ id: string; email: string; isNew: boolean }> => {
  const email = `${phone}@${PHONE_USER_EMAIL_DOMAIN}`;
  const existing = await get<{ id: string }>('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return { id: existing.id, email, isNew: false };
  const id = randomUUID();
  const now = new Date().toISOString();
  await run(
    `INSERT INTO users (id, name, email, passwordHash, createdAt, plan, questionsToday, lastQuestionDate, phoneWhatsapp, phoneVerifiedAt, authProvider)
     VALUES (?, ?, ?, '', ?, 'free', 0, NULL, ?, ?, 'whatsapp')`,
    [id, phone, email, now, phone, now],
  );
  return { id, email, isNew: true };
};

export const mintSession = (userId: string, phone: string): WhatsAppSession => {
  const now = Date.now();
  const accessToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  return {
    userId,
    phone,
    email: `${phone}@${PHONE_USER_EMAIL_DOMAIN}`,
    accessToken,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };
};

export const setSessionCookie = async (session: WhatsAppSession): Promise<void> => {
  const store = await cookies();
  store.set({
    name: WHATSAPP_SESSION_COOKIE,
    value: session.accessToken,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
};

export const clearSessionCookie = async (): Promise<void> => {
  const store = await cookies();
  store.set({
    name: WHATSAPP_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
};

export const readSessionFromCookie = async (): Promise<WhatsAppSession | null> => {
  const store = await cookies();
  const cookie = store.get(WHATSAPP_SESSION_COOKIE);
  if (!cookie?.value) return null;
  return {
    userId: '',
    phone: '',
    email: '',
    accessToken: cookie.value,
    createdAt: 0,
    expiresAt: 0,
  };
};

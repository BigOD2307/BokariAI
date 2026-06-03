import { hash, compare } from 'bcryptjs';
import { all, get, run } from '@/lib/db/sqlite';

const BCRYPT_ROUNDS = 10;
const OTP_LENGTH = 6;
const DEFAULT_TTL_SECONDS = 300;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_MAX_PER_HOUR = 5;

export class OtpError extends Error {
  constructor(
    message: string,
    public code:
      | 'EXPIRED'
      | 'INVALID'
      | 'TOO_MANY_ATTEMPTS'
      | 'RATE_LIMITED'
      | 'NOT_FOUND',
  ) {
    super(message);
    this.name = 'OtpError';
  }
}

export const generateOtpCode = (): string => {
  const max = 10 ** OTP_LENGTH;
  const min = 10 ** (OTP_LENGTH - 1);
  return String(Math.floor(Math.random() * (max - min)) + min);
};

export const hashOtp = (code: string): Promise<string> => hash(code, BCRYPT_ROUNDS);

export interface CreateOtpInput {
  phone: string;
  code: string;
  ttlSeconds?: number;
}

export interface CreateOtpResult {
  phone: string;
  expiresAt: number;
  lastSentAt: number;
}

interface PhoneOtpRow {
  phone: string;
  codeHash: string;
  attempts: number;
  expiresAt: string;
  lastSentAt: string;
  verifiedAt: string | null;
  createdAt: string;
}

export const createOtp = async ({
  phone,
  code,
  ttlSeconds = DEFAULT_TTL_SECONDS,
}: CreateOtpInput): Promise<CreateOtpResult> => {
  const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await all<PhoneOtpRow>(
    'SELECT * FROM phone_otps WHERE phone = ? AND lastSentAt > ?',
    [phone, oneHourAgoIso],
  );
  if (recent.length >= RATE_LIMIT_MAX_PER_HOUR) {
    throw new OtpError(
      `Trop d'OTP envoyés pour ce numéro. Réessaie dans 1 heure.`,
      'RATE_LIMITED',
    );
  }
  const codeHash = await hashOtp(code);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const now = new Date().toISOString();
  await run(
    `INSERT INTO phone_otps (phone, codeHash, attempts, expiresAt, lastSentAt, verifiedAt, createdAt)
     VALUES (?, ?, 0, ?, ?, NULL, ?)
     ON CONFLICT(phone) DO UPDATE SET
       codeHash = excluded.codeHash,
       expiresAt = excluded.expiresAt,
       lastSentAt = excluded.lastSentAt,
       attempts = 0,
       verifiedAt = NULL`,
    [phone, codeHash, expiresAt, now, now],
  );
  return {
    phone,
    expiresAt: new Date(expiresAt).getTime(),
    lastSentAt: new Date(now).getTime(),
  };
};

export interface OtpStatus {
  phone: string;
  attempts: number;
  expiresAt: number;
  lastSentAt: number;
  cooldownRemainingSeconds: number;
}

const RESEND_COOLDOWN_SECONDS = 30;

export const getOtpStatus = async (phone: string): Promise<OtpStatus | null> => {
  const row = await get<PhoneOtpRow>('SELECT * FROM phone_otps WHERE phone = ?', [phone]);
  if (!row) return null;
  const now = Date.now();
  const cooldownElapsed = (now - new Date(row.lastSentAt).getTime()) / 1000;
  const cooldown = Math.max(0, RESEND_COOLDOWN_SECONDS - cooldownElapsed);
  return {
    phone: row.phone,
    attempts: row.attempts,
    expiresAt: new Date(row.expiresAt).getTime(),
    lastSentAt: new Date(row.lastSentAt).getTime(),
    cooldownRemainingSeconds: Math.ceil(cooldown),
  };
};

export interface VerifyOtpResult {
  phone: string;
  userId: string | null;
  newUser: boolean;
}

export const verifyOtp = async (
  phone: string,
  code: string,
): Promise<VerifyOtpResult> => {
  const row = await get<PhoneOtpRow>('SELECT * FROM phone_otps WHERE phone = ?', [phone]);
  if (!row) {
    throw new OtpError('Aucun OTP en cours pour ce numéro', 'NOT_FOUND');
  }
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    throw new OtpError('OTP expiré, demande un nouveau code', 'EXPIRED');
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new OtpError(
      `Trop d'essais. Réessaie dans 5 minutes.`,
      'TOO_MANY_ATTEMPTS',
    );
  }
  const match = await compare(code, row.codeHash);
  if (!match) {
    await run(
      'UPDATE phone_otps SET attempts = attempts + 1 WHERE phone = ?',
      [phone],
    );
    throw new OtpError('Code incorrect', 'INVALID');
  }
  await run(
    'UPDATE phone_otps SET verifiedAt = ? WHERE phone = ?',
    [new Date().toISOString(), phone],
  );
  const existing = await get<{ id: string }>(
    'SELECT id FROM users WHERE email = ?',
    [`${phone}@whatsapp.bokari.app`],
  );
  return {
    phone,
    userId: existing?.id ?? null,
    newUser: !existing,
  };
};

export const purgeExpiredOtps = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const result = await run(
    'DELETE FROM phone_otps WHERE expiresAt < ?',
    [cutoff],
  );
  return result.changes;
};

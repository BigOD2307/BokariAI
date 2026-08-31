import { createHmac } from 'crypto';
import supabase from '@/lib/db';

/** Cost in quota units. Deep research is ~35 researcher iterations against 2-3
 *  LLM-driven searches each: an order of magnitude more expensive than speed. */
export const MODE_COST: Record<string, number> = {
  speed: 1,
  learn: 1,
  balanced: 3,
  quality: 10,
};

export const DAILY_LIMITS = {
  guest: 3,
  free: 15,
  pass: 200,
} as const;

export type QuotaTier = keyof typeof DAILY_LIMITS;

export type QuotaDecision =
  | { allowed: true; remaining: number; tier: QuotaTier }
  | { allowed: false; tier: QuotaTier; limit: number };

const FINGERPRINT_SECRET = process.env.BOKARI_FINGERPRINT_SECRET ?? '';

/**
 * Stable per-day identifier for an anonymous caller. Rotating the day into the
 * HMAC means the stored value is useless for cross-day tracking, and the raw IP
 * is never written anywhere.
 */
export function guestFingerprint(req: Request): string | null {
  if (!FINGERPRINT_SECRET) return null;
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!ip) return null;

  return createHmac('sha256', FINGERPRINT_SECRET)
    .update(`${ip}|${new Date().toISOString().slice(0, 10)}`)
    .digest('hex')
    .slice(0, 32);
}

export async function consume(
  args: { userId: string; tier: Exclude<QuotaTier, 'guest'> } | { fingerprint: string },
  cost: number,
): Promise<QuotaDecision> {
  if ('userId' in args) {
    const limit = DAILY_LIMITS[args.tier];
    const { data, error } = await supabase.rpc('consume_quota', {
      p_user: args.userId,
      p_cost: cost,
      p_limit: limit,
    });
    // Fail closed on a DB error: an unmetered LLM call is worse than a 503.
    if (error) throw new Error(`quota rpc failed: ${error.message}`);
    return data >= 0
      ? { allowed: true, remaining: data, tier: args.tier }
      : { allowed: false, tier: args.tier, limit };
  }

  const limit = DAILY_LIMITS.guest;
  const { data, error } = await supabase.rpc('consume_guest_quota', {
    p_fingerprint: args.fingerprint,
    p_cost: cost,
    p_limit: limit,
  });
  if (error) throw new Error(`guest quota rpc failed: ${error.message}`);
  return data >= 0
    ? { allowed: true, remaining: data, tier: 'guest' }
    : { allowed: false, tier: 'guest', limit };
}

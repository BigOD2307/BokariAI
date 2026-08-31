import { getCaller } from '@/lib/auth/require';
import { consume, guestFingerprint, MODE_COST, type QuotaDecision } from '.';

export type Charged = {
  userId: string | null;
  decision: Extract<QuotaDecision, { allowed: true }>;
};

/**
 * Resolve the caller and charge them for the work about to be done.
 * Returns a Response to send back when the caller may not proceed.
 *
 * Charging happens BEFORE the work, deliberately: a refunded quota after a
 * failed search is a nicety, an uncharged successful search is a bill.
 */
export async function chargeOrReject(
  req: Request,
  opts: { mode?: string; cost?: number; requireAccount?: boolean },
): Promise<Charged | Response> {
  const cost = opts.cost ?? MODE_COST[opts.mode ?? 'speed'] ?? 1;
  const caller = await getCaller(req);

  if (caller) {
    // TODO(C13): read the tier from an active pass instead of hard-coding 'free'.
    const decision = await consume({ userId: caller.userId, tier: 'free' }, cost);
    if (!decision.allowed) {
      return Response.json(
        { error: 'QUOTA_EXCEEDED', limit: decision.limit, tier: decision.tier },
        { status: 429 },
      );
    }
    return { userId: caller.userId, decision };
  }

  if (opts.requireAccount) {
    return Response.json({ error: 'ACCOUNT_REQUIRED' }, { status: 401 });
  }

  const fingerprint = guestFingerprint(req);
  if (!fingerprint) {
    return Response.json({ error: 'ACCOUNT_REQUIRED' }, { status: 401 });
  }

  const decision = await consume({ fingerprint }, cost);
  if (!decision.allowed) {
    return Response.json(
      { error: 'GUEST_LIMIT_REACHED', limit: decision.limit },
      { status: 429 },
    );
  }
  return { userId: null, decision };
}

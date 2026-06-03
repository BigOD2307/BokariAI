interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

const sweep = (now: number): void => {
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export const checkRate = (
  key: string,
  max: number,
  windowSeconds: number,
): RateLimitResult => {
  const now = Date.now();
  sweep(now);
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }
  if (existing.count >= max) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: max - existing.count,
    resetAt: existing.resetAt,
  };
};

export const resetRate = (key: string): void => {
  store.delete(key);
};

export const _resetAllForTests = (): void => {
  store.clear();
};

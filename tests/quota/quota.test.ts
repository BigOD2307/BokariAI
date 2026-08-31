import { describe, expect, it, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/db', () => ({ default: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { consume, MODE_COST } = await import('@/lib/quota');

describe('quota', () => {
  beforeEach(() => rpc.mockReset());

  it('charges deep research ten times a fast query', () => {
    expect(MODE_COST.quality).toBe(10 * MODE_COST.speed);
  });

  it('allows and reports the remainder', async () => {
    rpc.mockResolvedValue({ data: 12, error: null });
    await expect(consume({ userId: 'u1', tier: 'free' }, 3)).resolves.toEqual({
      allowed: true,
      remaining: 12,
      tier: 'free',
    });
  });

  it('refuses when the RPC reports -1', async () => {
    rpc.mockResolvedValue({ data: -1, error: null });
    await expect(consume({ userId: 'u1', tier: 'free' }, 10)).resolves.toMatchObject({
      allowed: false,
    });
  });

  it('fails closed when the database errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    await expect(consume({ userId: 'u1', tier: 'free' }, 1)).rejects.toThrow();
  });

  it('charges a guest fingerprint against the guest RPC and limit', async () => {
    rpc.mockResolvedValue({ data: 2, error: null });
    await expect(consume({ fingerprint: 'fp1' }, 1)).resolves.toEqual({
      allowed: true,
      remaining: 2,
      tier: 'guest',
    });
    expect(rpc).toHaveBeenCalledWith('consume_guest_quota', {
      p_fingerprint: 'fp1',
      p_cost: 1,
      p_limit: 3,
    });
  });
});

import { resolveUserIdForSubscriptionEvent } from './http';

type ResolveParams = Parameters<typeof resolveUserIdForSubscriptionEvent>;

describe('resolveUserIdForSubscriptionEvent', () => {
  it('uses subscription metadata.userId first', async () => {
    const runQuery = vi.fn();
    const userId = await resolveUserIdForSubscriptionEvent(
      { runQuery } as unknown as ResolveParams[0],
      { customer: 'cus_1', id: 'sub_1', metadata: { userId: 'user_meta' } } as unknown as ResolveParams[1]
    );

    expect(userId).toBe('user_meta');
    expect(runQuery).not.toHaveBeenCalled();
  });

  it('falls back to existing row lookup by stripeSubscriptionId', async () => {
    const runQuery = vi.fn().mockResolvedValueOnce('user_from_sub');
    const userId = await resolveUserIdForSubscriptionEvent(
      { runQuery } as unknown as ResolveParams[0],
      { customer: 'cus_1', id: 'sub_1', metadata: {} } as unknown as ResolveParams[1]
    );

    expect(userId).toBe('user_from_sub');
    expect(runQuery).toHaveBeenCalledOnce();
    expect(runQuery).toHaveBeenCalledWith(expect.anything(), { stripeSubscriptionId: 'sub_1' });
  });

  it('falls back to stripeCustomerId when no row exists by subscription id', async () => {
    const runQuery = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('user_from_customer');
    const userId = await resolveUserIdForSubscriptionEvent(
      { runQuery } as unknown as ResolveParams[0],
      { customer: 'cus_1', id: 'sub_1', metadata: {} } as unknown as ResolveParams[1]
    );

    expect(userId).toBe('user_from_customer');
    expect(runQuery).toHaveBeenNthCalledWith(1, expect.anything(), { stripeSubscriptionId: 'sub_1' });
    expect(runQuery).toHaveBeenNthCalledWith(2, expect.anything(), { stripeCustomerId: 'cus_1' });
  });

  it('returns null when user cannot be resolved', async () => {
    const runQuery = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const userId = await resolveUserIdForSubscriptionEvent(
      { runQuery } as unknown as ResolveParams[0],
      { customer: 'cus_1', id: 'sub_1', metadata: {} } as unknown as ResolveParams[1]
    );

    expect(userId).toBeNull();
    expect(runQuery).toHaveBeenCalledTimes(2);
  });
});

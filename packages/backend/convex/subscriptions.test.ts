import { pickPrimarySubscription } from './subscriptions';

// eslint-disable-next-line jest/valid-title
describe(pickPrimarySubscription, () => {
  it('returns null for an empty list', () => {
    expect(pickPrimarySubscription([])).toBeNull();
  });

  it('prefers premium subscriptions and picks the latest period end', () => {
    const chosen = pickPrimarySubscription([
      { currentPeriodEnd: 100, priceId: 'price_a', status: 'canceled' },
      { currentPeriodEnd: 200, priceId: 'price_b', status: 'active' },
      { currentPeriodEnd: 300, priceId: 'price_b', status: 'active' },
    ]);
    expect(chosen).toStrictEqual({ currentPeriodEnd: 300, priceId: 'price_b', status: 'active' });
  });

  it('when none are premium, picks the latest period end among all', () => {
    const chosen = pickPrimarySubscription([
      { currentPeriodEnd: 50, priceId: 'price_a', status: 'canceled' },
      { currentPeriodEnd: 150, priceId: 'price_b', status: 'past_due' },
    ]);
    expect(chosen).toStrictEqual({ currentPeriodEnd: 150, priceId: 'price_b', status: 'past_due' });
  });
});

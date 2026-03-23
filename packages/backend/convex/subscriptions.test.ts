import { pickPrimarySubscription } from './subscriptions';

// eslint-disable-next-line jest/valid-title
describe(pickPrimarySubscription, () => {
  it('returns null for an empty list', () => {
    expect(pickPrimarySubscription([])).toBeNull();
  });

  it('prefers premium subscriptions and picks the latest period end', () => {
    const chosen = pickPrimarySubscription([
      { cancelAtPeriodEnd: false, currentPeriodEnd: 100, priceId: 'price_a', status: 'canceled' },
      { cancelAtPeriodEnd: false, currentPeriodEnd: 200, priceId: 'price_b', status: 'active' },
      { cancelAtPeriodEnd: false, currentPeriodEnd: 300, priceId: 'price_b', status: 'active' },
    ]);
    expect(chosen).toStrictEqual({
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 300,
      priceId: 'price_b',
      status: 'active',
    });
  });

  it('when none are premium, picks the latest period end among all', () => {
    const chosen = pickPrimarySubscription([
      { cancelAtPeriodEnd: false, currentPeriodEnd: 50, priceId: 'price_a', status: 'canceled' },
      { cancelAtPeriodEnd: false, currentPeriodEnd: 150, priceId: 'price_b', status: 'past_due' },
    ]);
    expect(chosen).toStrictEqual({
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 150,
      priceId: 'price_b',
      status: 'past_due',
    });
  });
});

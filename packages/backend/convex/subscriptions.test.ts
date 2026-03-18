import { buildCheckoutSessionCreateParams } from './subscriptions';

// eslint-disable-next-line jest/valid-title
describe(buildCheckoutSessionCreateParams, () => {
  it('writes userId to both session and subscription metadata', () => {
    const params = buildCheckoutSessionCreateParams('user_123', 'https://app.example.com', 'price_abc');

    expect(params.client_reference_id).toBe('user_123');
    expect(params.metadata?.userId).toBe('user_123');
    expect(params.subscription_data?.metadata?.userId).toBe('user_123');
    expect(params.mode).toBe('subscription');
  });
});

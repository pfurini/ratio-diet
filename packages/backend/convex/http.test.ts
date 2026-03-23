import { registerRoutes } from '@convex-dev/stripe';

describe('stripe HTTP webhook registration', () => {
  it('exposes registerRoutes for the Convex HTTP router', () => {
    expectTypeOf(registerRoutes).toBeFunction();
  });
});

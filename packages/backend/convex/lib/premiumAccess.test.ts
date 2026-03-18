import { hasPremiumAccess } from './premiumAccess';

// eslint-disable-next-line jest/valid-title
describe(hasPremiumAccess, () => {
  it('allows active and trialing statuses', () => {
    expect(hasPremiumAccess('active')).toBeTruthy();
    expect(hasPremiumAccess('trialing')).toBeTruthy();
  });

  it('denies missing and non-premium statuses', () => {
    expect(hasPremiumAccess()).toBeFalsy();
    expect(hasPremiumAccess('past_due')).toBeFalsy();
  });
});

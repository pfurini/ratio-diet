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

  it('denies canceled status', () => {
    expect(hasPremiumAccess('canceled')).toBeFalsy();
  });

  it('denies unpaid status', () => {
    expect(hasPremiumAccess('unpaid')).toBeFalsy();
  });

  it('denies paused status', () => {
    expect(hasPremiumAccess('paused')).toBeFalsy();
  });

  it('denies incomplete status', () => {
    expect(hasPremiumAccess('incomplete')).toBeFalsy();
  });

  it('denies incomplete_expired status', () => {
    expect(hasPremiumAccess('incomplete_expired')).toBeFalsy();
  });
});

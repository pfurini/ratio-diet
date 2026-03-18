const PREMIUM_ACCESS_STATUSES = new Set(['active', 'trialing']);

export const hasPremiumAccess = (status: string | undefined): boolean => PREMIUM_ACCESS_STATUSES.has(status ?? '');

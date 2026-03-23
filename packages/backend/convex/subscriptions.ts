import { StripeSubscriptions } from '@convex-dev/stripe';
import { ConvexError, v } from 'convex/values';

import { components } from './_generated/api';
import { action, query } from './_generated/server';
import { authComponent } from './auth';
import { hasPremiumAccess } from './lib/premiumAccess';

const stripeClient = new StripeSubscriptions(components.stripe, {});

const subscriptionStatusValidator = v.union(
  v.literal('incomplete'),
  v.literal('incomplete_expired'),
  v.literal('trialing'),
  v.literal('active'),
  v.literal('past_due'),
  v.literal('canceled'),
  v.literal('unpaid'),
  v.literal('paused')
);

type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'paused'
  | 'trialing'
  | 'unpaid';

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: 'active',
  canceled: 'canceled',
  cancelled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  past_due: 'past_due',
  paused: 'paused',
  trialing: 'trialing',
  unpaid: 'unpaid',
};

const mapSubscriptionStatus = (raw: string): SubscriptionStatus => STATUS_MAP[raw] ?? 'past_due';

/** Single row from Stripe component `listSubscriptionsByUserId` (matches generated `components.stripe` API). */
export type StripeUserSubscription = (typeof components.stripe.public.listSubscriptionsByUserId)['_returnType'][number];

export const pickPrimarySubscription = (subs: StripeUserSubscription[]): StripeUserSubscription | null => {
  if (subs.length === 0) {
    return null;
  }
  const premium = subs.filter((s) => hasPremiumAccess(s.status));
  const pool = premium.length > 0 ? premium : subs;
  const [first] = pool;
  let best = first;
  for (const s of pool) {
    if (s.currentPeriodEnd > best.currentPeriodEnd) {
      best = s;
    }
  }
  return best;
};

const toNextRenewalDate = (currentPeriodEnd: number): string => {
  const [dateString] = new Date(currentPeriodEnd * 1000).toISOString().split('T');
  if (!dateString) {
    throw new Error('Unable to convert period end to date string');
  }
  return dateString;
};

const getSiteUrl = () => {
  const url = process.env.SITE_URL;
  if (!url) {
    throw new Error('SITE_URL is not set');
  }
  return url;
};

const getPriceId = () => {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error('STRIPE_PRICE_ID is not set');
  }
  return priceId;
};

const DEFAULT_CHECKOUT_RETURN_PATH = '/dashboard';

/** Internal path only — rejects open-redirect patterns. */
const checkoutReturnPath = (path: string | undefined): string => {
  if (!path) {
    return DEFAULT_CHECKOUT_RETURN_PATH;
  }
  if (!path.startsWith('/') || path.startsWith('//')) {
    return DEFAULT_CHECKOUT_RETURN_PATH;
  }
  if (path.includes('://') || path.includes('\\')) {
    return DEFAULT_CHECKOUT_RETURN_PATH;
  }
  if (!/^\/[\w/-]*$/.test(path)) {
    return DEFAULT_CHECKOUT_RETURN_PATH;
  }
  return path;
};

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const subs = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, {
      userId: user._id,
    });
    const sub = pickPrimarySubscription(subs);
    if (!sub) {
      return null;
    }

    const status = mapSubscriptionStatus(sub.status);
    const isCanceledForUi = status === 'canceled' || sub.cancelAtPeriodEnd;

    return {
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      nextRenewalDate: isCanceledForUi ? null : toNextRenewalDate(sub.currentPeriodEnd),
      status,
    };
  },
  returns: v.union(
    v.null(),
    v.object({
      cancelAtPeriodEnd: v.boolean(),
      nextRenewalDate: v.union(v.string(), v.null()),
      status: subscriptionStatusValidator,
    })
  ),
});

const userHasActivePrice = (subs: StripeUserSubscription[], priceId: string): boolean =>
  subs.some((s) => hasPremiumAccess(s.status) && s.priceId === priceId);

export const createCheckoutSession = action({
  args: { returnPath: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    const siteUrl = getSiteUrl();
    const returnPath = checkoutReturnPath(args.returnPath);
    const priceId = getPriceId();
    const subs: StripeUserSubscription[] = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, {
      userId: user._id,
    });
    if (userHasActivePrice(subs, priceId)) {
      return { url: null };
    }

    const { customerId } = await stripeClient.getOrCreateCustomer(ctx, {
      email: user.email,
      name: user.name,
      userId: user._id,
    });

    const { url } = await stripeClient.createCheckoutSession(ctx, {
      cancelUrl: `${siteUrl}${returnPath}?subscription=cancelled`,
      customerId,
      metadata: { userId: user._id },
      mode: 'subscription',
      priceId,
      subscriptionMetadata: { userId: user._id },
      successUrl: `${siteUrl}${returnPath}?subscription=success`,
    });

    return { url };
  },
  returns: v.object({ url: v.union(v.string(), v.null()) }),
});

export const createPortalSession = action({
  args: {},
  handler: async (ctx): Promise<{ url: string | null }> => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    const subs: StripeUserSubscription[] = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, {
      userId: user._id,
    });
    if (subs.length === 0) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Nessun abbonamento trovato' });
    }

    const { url } = await stripeClient.createCustomerPortalSession(ctx, {
      customerId: subs[0].stripeCustomerId,
      returnUrl: `${getSiteUrl()}/settings`,
    });

    return { url };
  },
  returns: v.object({ url: v.union(v.string(), v.null()) }),
});

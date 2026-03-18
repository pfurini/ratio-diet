import { ConvexError, v } from 'convex/values';
import type { Stripe } from 'stripe';

import { api } from './_generated/api';
import { action, internalMutation, internalQuery, query } from './_generated/server';
import { authComponent } from './auth';

const importStripe = async () => {
  const stripeModule = await import('stripe');
  return stripeModule.default;
};

const getStripeKey = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return key;
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

type CheckoutSessionCreateParams = Stripe.Checkout.SessionCreateParams;

export const buildCheckoutSessionCreateParams = (
  userId: string,
  siteUrl: string,
  priceId: string
): CheckoutSessionCreateParams => ({
  cancel_url: `${siteUrl}/dashboard?subscription=cancelled`,
  client_reference_id: userId,
  line_items: [{ price: priceId, quantity: 1 }],
  metadata: { userId },
  mode: 'subscription',
  subscription_data: { metadata: { userId } },
  success_url: `${siteUrl}/dashboard?subscription=success`,
});

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();

    return sub ? { nextRenewalDate: sub.nextRenewalDate, status: sub.status } : null;
  },
});

const ACTIVE_TRIALING_STATUSES = new Set(['active', 'trialing']);

const hasActiveSubscriptionForPrice = async (
  stripe: Stripe,
  stripeCustomerId: string,
  priceId: string
): Promise<boolean> => {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
  });
  for (const sub of subscriptions.data) {
    if (!ACTIVE_TRIALING_STATUSES.has(sub.status)) {
      continue;
    }
    const hasMatchingPrice = sub.items.data.some((item) => {
      const p = item.price;
      return (typeof p === 'string' ? p : p?.id) === priceId;
    });
    if (hasMatchingPrice) {
      return true;
    }
  }
  return false;
};

export const createCheckoutSession = action({
  args: {},
  handler: async (ctx): Promise<{ url: string | null }> => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    const Stripe = await importStripe();
    const stripe = new Stripe(getStripeKey());
    const siteUrl = getSiteUrl();
    const priceId = getPriceId();

    const existingSub = await ctx.runQuery(api.subscriptions.getSubscriptionForPortal, {});
    if (existingSub?.stripeCustomerId) {
      const alreadyActive = await hasActiveSubscriptionForPrice(stripe, existingSub.stripeCustomerId, priceId);
      if (alreadyActive) {
        return { url: null };
      }
    }

    const session = await stripe.checkout.sessions.create(buildCheckoutSessionCreateParams(user._id, siteUrl, priceId));

    return { url: session.url };
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

    const sub = await ctx.runQuery(api.subscriptions.getSubscriptionForPortal, {});
    if (!sub) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Nessun abbonamento trovato' });
    }

    const Stripe = await importStripe();
    const stripe = new Stripe(getStripeKey());

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${getSiteUrl()}/settings`,
    });

    return { url: session.url };
  },
  returns: v.object({ url: v.union(v.string(), v.null()) }),
});

export const getSubscriptionForPortal = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    return await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();
  },
});

export const upsertFromWebhook = internalMutation({
  args: {
    nextRenewalDate: v.string(),
    startDate: v.string(),
    status: v.union(
      v.literal('incomplete'),
      v.literal('incomplete_expired'),
      v.literal('trialing'),
      v.literal('active'),
      v.literal('past_due'),
      v.literal('canceled'),
      v.literal('unpaid'),
      v.literal('paused')
    ),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripeSubscriptionId', (q) => q.eq('stripeSubscriptionId', args.stripeSubscriptionId))
      .unique();

    await (existing
      ? ctx.db.patch(existing._id, {
          nextRenewalDate: args.nextRenewalDate,
          startDate: args.startDate,
          status: args.status,
          stripeCustomerId: args.stripeCustomerId,
          userId: args.userId,
        })
      : ctx.db.insert('subscriptions', args));
  },
});

export const getUserIdByStripeSubscriptionId = internalQuery({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripeSubscriptionId', (q) => q.eq('stripeSubscriptionId', args.stripeSubscriptionId))
      .unique();
    return subscription?.userId ?? null;
  },
});

export const claimWebhookEvent = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('stripeWebhookEvents')
      .withIndex('by_eventId', (q) => q.eq('eventId', args.eventId))
      .unique();
    if (existing) {
      return { alreadyProcessed: true };
    }
    await ctx.db.insert('stripeWebhookEvents', {
      eventId: args.eventId,
      processedAt: Date.now(),
    });
    return { alreadyProcessed: false };
  },
});

export const getUserIdByStripeCustomerId = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripeCustomerId', (q) => q.eq('stripeCustomerId', args.stripeCustomerId))
      .first();
    return subscription?.userId ?? null;
  },
});

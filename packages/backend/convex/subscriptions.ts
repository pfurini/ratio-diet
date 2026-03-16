import { v } from 'convex/values';
import type Stripe from 'stripe';

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

export const createCheckoutSession = action({
  args: {},
  handler: async (ctx): Promise<{ url: string | null }> => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error('Non autenticato');
    }

    const Stripe = await importStripe();
    const stripe = new Stripe(getStripeKey());
    const siteUrl = getSiteUrl();
    const priceId = getPriceId();

    const session = await stripe.checkout.sessions.create(buildCheckoutSessionCreateParams(user._id, siteUrl, priceId));

    return { url: session.url };
  },
});

export const createPortalSession = action({
  args: {},
  handler: async (ctx): Promise<{ url: string | null }> => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error('Non autenticato');
    }

    const sub = await ctx.runQuery(api.subscriptions.getSubscriptionForPortal, {});
    if (!sub) {
      throw new Error('Nessun abbonamento trovato');
    }

    const Stripe = await importStripe();
    const stripe = new Stripe(getStripeKey());

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${getSiteUrl()}/settings`,
    });

    return { url: session.url };
  },
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
    status: v.union(v.literal('active'), v.literal('cancelled'), v.literal('past_due')),
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

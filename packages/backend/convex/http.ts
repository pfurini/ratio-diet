import { httpRouter } from 'convex/server';
import type Stripe from 'stripe';

import { internal } from './_generated/api';
import type { ActionCtx } from './_generated/server';
import { httpAction } from './_generated/server';
import { authComponent, createAuth } from './auth';

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

type StripeStatus = 'active' | 'cancelled' | 'past_due';

const STATUS_MAP: Record<string, StripeStatus> = {
  active: 'active',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  past_due: 'past_due',
  unpaid: 'past_due',
};

const toDateString = (unixTimestamp: number): string => {
  const [dateString] = new Date(unixTimestamp * 1000).toISOString().split('T');
  if (!dateString) {
    throw new Error('Unable to convert timestamp to date string');
  }
  return dateString;
};

const getCurrentPeriodEnd = (subscription: StripeSubscription): number => {
  const value = (subscription as unknown as { current_period_end?: unknown }).current_period_end;
  if (typeof value !== 'number') {
    throw new TypeError('Stripe subscription is missing current_period_end');
  }
  return value;
};

const importStripe = async () => {
  const stripeModule = await import('stripe');
  return stripeModule.default;
};

type StripeInstance = Awaited<ReturnType<typeof importStripe>>;
type StripeSubscription = Stripe.Response<Stripe.Subscription>;
type StripeCheckoutSession = Stripe.Checkout.Session;
type StripeEvent = Stripe.Event;

const upsertSubscription = async (ctx: ActionCtx, userId: string, subscription: StripeSubscription) => {
  const status = STATUS_MAP[subscription.status] ?? 'past_due';
  const startDate = toDateString(subscription.start_date);
  const nextRenewalDate = toDateString(getCurrentPeriodEnd(subscription));
  const stripeCustomerId = subscription.customer as string;

  await ctx.runMutation(internal.subscriptions.upsertFromWebhook, {
    nextRenewalDate,
    startDate,
    status,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    userId,
  });
};

const getStripeCustomerId = (subscription: StripeSubscription): string | null => {
  const { customer } = subscription;
  if (typeof customer === 'string') {
    return customer;
  }
  return customer?.id ?? null;
};

export const resolveUserIdForSubscriptionEvent = async (
  ctx: ActionCtx,
  subscription: StripeSubscription
): Promise<string | null> => {
  const fromMetadata = subscription.metadata?.userId;
  if (fromMetadata) {
    return fromMetadata;
  }

  const fromSubscriptionId = await ctx.runQuery(internal.subscriptions.getUserIdByStripeSubscriptionId, {
    stripeSubscriptionId: subscription.id,
  });
  if (fromSubscriptionId) {
    return fromSubscriptionId;
  }

  const stripeCustomerId = getStripeCustomerId(subscription);
  if (!stripeCustomerId) {
    return null;
  }

  return await ctx.runQuery(internal.subscriptions.getUserIdByStripeCustomerId, { stripeCustomerId });
};

const handleCheckoutCompleted = async (
  ctx: ActionCtx,
  stripe: InstanceType<StripeInstance>,
  session: StripeCheckoutSession
) => {
  const subscriptionId = session.subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = session.client_reference_id ?? subscription.metadata?.userId;
  if (!userId) {
    return;
  }
  await upsertSubscription(ctx, userId, subscription);
};

const handleSubscriptionEvent = async (ctx: ActionCtx, subscription: StripeSubscription) => {
  const userId = await resolveUserIdForSubscriptionEvent(ctx, subscription);
  if (!userId) {
    return;
  }

  await upsertSubscription(ctx, userId, subscription);
};

const SUBSCRIPTION_EVENTS = new Set(['customer.subscription.updated', 'customer.subscription.deleted']);

const handleStripeEvent = async (ctx: ActionCtx, stripe: InstanceType<StripeInstance>, event: StripeEvent) => {
  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(ctx, stripe, event.data.object as StripeCheckoutSession);
    return;
  }

  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    await handleSubscriptionEvent(ctx, event.data.object as StripeSubscription);
  }
};

const parseStripeEvent = (
  stripe: InstanceType<StripeInstance>,
  body: string,
  signature: string
): StripeEvent | null => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return null;
  }
};

const buildStripeClient = async () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  const StripeLib = await importStripe();
  return new StripeLib(key);
};

const validateWebhookRequest = async (
  stripe: InstanceType<StripeInstance>,
  request: Request
): Promise<StripeEvent | Response> => {
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();

  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const event = parseStripeEvent(stripe, body, signature);
  return event ?? new Response('Invalid signature', { status: 400 });
};

const isStripeEvent = (value: StripeEvent | Response): value is StripeEvent => !(value instanceof Response);

http.route({
  handler: httpAction(async (ctx, request) => {
    const stripe = await buildStripeClient();
    const result = await validateWebhookRequest(stripe, request);

    if (!isStripeEvent(result)) {
      return result;
    }

    await handleStripeEvent(ctx, stripe, result);
    return new Response('OK', { status: 200 });
  }),
  method: 'POST',
  path: '/stripe-webhook',
});

export default http;

import { internalMutation } from './_generated/server';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const deleteOldWebhookEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ONE_YEAR_MS;
    const old = await ctx.db
      .query('stripeWebhookEvents')
      .filter((q) => q.lt(q.field('_creationTime'), cutoff))
      .collect();
    await Promise.all(old.map((e) => ctx.db.delete(e._id)));
  },
});

import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { authComponent } from './auth';

const mealItemValidator = v.object({
  constraintMax: v.optional(v.number()),
  constraintMin: v.optional(v.number()),
  foodId: v.id('foods'),
  quantityGrams: v.number(),
});

const mealValidator = v.object({
  items: v.array(mealItemValidator),
  type: v.union(
    v.literal('colazione'),
    v.literal('pranzo'),
    v.literal('cena'),
    v.literal('spuntino_mattina'),
    v.literal('spuntino_pomeriggio')
  ),
});

export const save = mutation({
  args: {
    meals: v.array(mealValidator),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error('Non autenticato');
    }

    return await ctx.db.insert('templates', {
      meals: args.meals,
      name: args.name,
      userId: user._id,
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query('templates')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect();
  },
});

export const get = query({
  args: { templateId: v.id('templates') },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== user._id) {
      return null;
    }

    return template;
  },
});

export const remove = mutation({
  args: { templateId: v.id('templates') },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error('Non autenticato');
    }

    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== user._id) {
      throw new Error('Template non trovato');
    }

    await ctx.db.delete(args.templateId);
  },
});

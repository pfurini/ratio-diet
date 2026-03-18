import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { authComponent } from './auth';
import { mealTypeValidator } from './schema';

const mealItemValidator = v.object({
  constraintMax: v.optional(v.number()),
  constraintMin: v.optional(v.number()),
  foodId: v.id('foods'),
  quantityGrams: v.optional(v.number()),
});

const mealValidator = v.object({
  items: v.array(mealItemValidator),
  type: mealTypeValidator,
});

export const buildTemplateInsertDoc = <TMeals>(userId: string, args: { meals: TMeals; name: string }) => ({
  meals: args.meals,
  name: args.name,
  userId,
});

export const save = mutation({
  args: {
    meals: v.array(mealValidator),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    return await ctx.db.insert('templates', buildTemplateInsertDoc(user._id, args));
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
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== user._id) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Template non trovato' });
    }

    await ctx.db.delete(args.templateId);
  },
});

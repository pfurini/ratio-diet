import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { authComponent } from './auth';
import { mealTypeValidator } from './schema';

const TEMPLATE_LIMIT = 50;
const MAX_MEALS_PER_PLAN = 6;
const MAX_ITEMS_PER_MEAL = 30;
const MAX_TEMPLATE_NAME_LENGTH = 100;

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

const assertTemplateLimitNotReached = async (ctx: MutationCtx, userId: string): Promise<void> => {
  const existing = await ctx.db
    .query('templates')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .take(TEMPLATE_LIMIT);
  if (existing.length >= TEMPLATE_LIMIT) {
    throw new ConvexError({ code: 'LIMIT_REACHED', message: `Template limit of ${TEMPLATE_LIMIT} reached` });
  }
};

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

    if (args.name.length < 1 || args.name.length > MAX_TEMPLATE_NAME_LENGTH) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: `Template name must be 1-${MAX_TEMPLATE_NAME_LENGTH} characters`,
      });
    }

    await assertTemplateLimitNotReached(ctx, user._id);

    if (args.meals.length > MAX_MEALS_PER_PLAN) {
      throw new ConvexError({ code: 'INVALID_INPUT', message: `Max ${MAX_MEALS_PER_PLAN} meals per template` });
    }
    for (const meal of args.meals) {
      if (meal.items.length > MAX_ITEMS_PER_MEAL) {
        throw new ConvexError({ code: 'INVALID_INPUT', message: `Max ${MAX_ITEMS_PER_MEAL} items per meal` });
      }
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

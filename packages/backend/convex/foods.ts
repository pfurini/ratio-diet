import { v } from 'convex/values';

import { authComponent } from './auth';
import { internalMutation, mutation, query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import creaDatabaseFoods from '../data/crea-foods.json';

const CUSTOM_FOOD_LIMIT = 100;

const HIDDEN_CATEGORIES: Record<string, string[]> = {
  onnivoro: [],
  vegetariano: ['carni', 'pesce', 'salumi'],
  vegano: ['carni', 'pesce', 'salumi', 'latticini', 'uova'],
  pescetariano: ['carni', 'salumi'],
};

const filterByDietaryPreference = (
  food: { category: string },
  preference: string,
): boolean => {
  const hidden = HIDDEN_CATEGORIES[preference] ?? [];
  return !hidden.includes(food.category);
};

const filterByAllergens = (
  food: { allergenTags: string[] },
  excludeAllergens: string[],
): boolean => {
  if (excludeAllergens.length === 0) return true;
  return !food.allergenTags.some((tag) => excludeAllergens.includes(tag));
};

type FoodDoc = {
  _id: string;
  name: string;
  category: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  allergenTags: string[];
  foodType: 'animale' | 'vegetale';
  source: 'crea' | 'custom';
  userId?: string;
};

type SearchFilters = {
  dietaryPreference?: string;
  excludeAllergens?: string[];
};

const applyDietAndAllergenFilters = (
  foods: FoodDoc[],
  filters: SearchFilters,
): FoodDoc[] => {
  const { dietaryPreference, excludeAllergens = [] } = filters;
  return foods.filter((food) => {
    const dietOk = dietaryPreference
      ? filterByDietaryPreference(food, dietaryPreference)
      : true;
    const allergenOk = filterByAllergens(food, excludeAllergens);
    return dietOk && allergenOk;
  });
};

const filterFoodsByCategory = (
  foods: FoodDoc[],
  category?: string,
): FoodDoc[] => {
  if (!category) return foods;
  return foods.filter((food) => food.category === category);
};

export const seedCREA = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('foods')
      .withIndex('by_source', (q) => q.eq('source', 'crea'))
      .first();

    if (existing !== null) return { seeded: 0, skipped: true };

    for (const food of creaDatabaseFoods) {
      await ctx.db.insert('foods', {
        name: food.name,
        category: food.category,
        kcalPer100g: food.kcalPer100g,
        proteinPer100g: food.proteinPer100g,
        carbPer100g: food.carbPer100g,
        fatPer100g: food.fatPer100g,
        allergenTags: food.allergenTags,
        foodType: food.foodType as 'animale' | 'vegetale',
        source: 'crea',
      });
    }

    return { seeded: creaDatabaseFoods.length, skipped: false };
  },
});

const fetchCustomFoods = async (
  ctx: QueryCtx,
  userId: string,
  term?: string,
) => {
  if (term) {
    return ctx.db
      .query('foods')
      .withSearchIndex('search_name', (q) =>
        q.search('name', term).eq('source', 'custom').eq('userId', userId),
      )
      .collect();
  }
  return ctx.db
    .query('foods')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect();
};

export const search = query({
  args: {
    term: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    const profile = user
      ? await ctx.db.query('userProfiles').withIndex('by_userId', (q) => q.eq('userId', user._id)).unique()
      : null;

    const { term, category } = args;
    const dietaryPreference = profile?.dietaryPreference ?? 'onnivoro';
    const excludeAllergens = profile?.allergies ?? [];

    const creaResults = term
      ? await ctx.db
          .query('foods')
          .withSearchIndex('search_name', (q) =>
            q.search('name', term).eq('source', 'crea'),
          )
          .collect()
      : await ctx.db
          .query('foods')
          .withIndex('by_source', (q) => q.eq('source', 'crea'))
          .collect();

    const customResults = user
      ? await fetchCustomFoods(ctx, user._id, term)
      : [];

    const combined = [...creaResults, ...customResults] as FoodDoc[];
    const byCat = filterFoodsByCategory(combined, category);
    return applyDietAndAllergenFilters(byCat, {
      dietaryPreference,
      excludeAllergens,
    });
  },
});

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const foods = await ctx.db
      .query('foods')
      .withIndex('by_source', (q) => q.eq('source', 'crea'))
      .collect();

    const categories = new Set(foods.map((f) => f.category));
    return [...categories].sort();
  },
});

export const addCustomFood = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    kcalPer100g: v.number(),
    proteinPer100g: v.number(),
    carbPer100g: v.number(),
    fatPer100g: v.number(),
    allergenTags: v.array(v.string()),
    foodType: v.union(v.literal('animale'), v.literal('vegetale')),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) throw new Error('Non autenticato');

    const userId = authUser._id;
    const existingCount = await ctx.db
      .query('foods')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();

    if (existingCount.length >= CUSTOM_FOOD_LIMIT) {
      throw new Error(
        `Custom food limit of ${CUSTOM_FOOD_LIMIT} reached`,
      );
    }

    return ctx.db.insert('foods', {
      ...args,
      source: 'custom',
      userId,
    });
  },
});

export const getCustomFoodCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { count: 0, limit: CUSTOM_FOOD_LIMIT };

    const foods = await ctx.db
      .query('foods')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect();

    return { count: foods.length, limit: CUSTOM_FOOD_LIMIT };
  },
});

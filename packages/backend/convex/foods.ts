import { ConvexError, v } from 'convex/values';

// eslint-disable-next-line import/no-relative-parent-imports
import creaDatabaseFoods from '../data/crea-foods.json';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { authComponent } from './auth';

const CUSTOM_FOOD_LIMIT = 100;

const HIDDEN_CATEGORIES: Record<string, string[]> = {
  onnivoro: [],
  pescetariano: ['carni', 'salumi'],
  vegano: ['carni', 'pesce', 'salumi', 'latticini', 'uova'],
  vegetariano: ['carni', 'pesce', 'salumi'],
};

const filterByDietaryPreference = (food: { category: string }, preference: string): boolean => {
  const hidden = HIDDEN_CATEGORIES[preference] ?? [];
  return !hidden.includes(food.category);
};

const filterByAllergens = (food: { allergenTags: string[] }, excludeAllergens: string[]): boolean => {
  if (excludeAllergens.length === 0) {
    return true;
  }
  return !food.allergenTags.some((tag) => excludeAllergens.includes(tag));
};

interface FoodDoc {
  _id: Id<'foods'>;
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
}

interface SearchFilters {
  dietaryPreference?: string;
  excludeAllergens?: string[];
}

const applyDietAndAllergenFilters = (foods: FoodDoc[], filters: SearchFilters): FoodDoc[] => {
  const { dietaryPreference, excludeAllergens = [] } = filters;
  return foods.filter((food) => {
    const dietOk = dietaryPreference ? filterByDietaryPreference(food, dietaryPreference) : true;
    const allergenOk = filterByAllergens(food, excludeAllergens);
    return dietOk && allergenOk;
  });
};

const filterFoodsByCategory = (foods: FoodDoc[], category?: string): FoodDoc[] => {
  if (!category) {
    return foods;
  }
  return foods.filter((food) => food.category === category);
};

export const seedCREA = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('foods')
      .withIndex('by_source', (q) => q.eq('source', 'crea'))
      .first();

    if (existing !== null) {
      return { seeded: 0, skipped: true };
    }

    for (const food of creaDatabaseFoods) {
      await ctx.db.insert('foods', {
        allergenTags: food.allergenTags,
        carbPer100g: food.carbPer100g,
        category: food.category,
        fatPer100g: food.fatPer100g,
        foodType: food.foodType as 'animale' | 'vegetale',
        kcalPer100g: food.kcalPer100g,
        name: food.name,
        proteinPer100g: food.proteinPer100g,
        source: 'crea',
      });
    }

    return { seeded: creaDatabaseFoods.length, skipped: false };
  },
});

const fetchCustomFoods = (ctx: QueryCtx, userId: string, term?: string) => {
  if (term) {
    return ctx.db
      .query('foods')
      .withSearchIndex('search_name', (q) => q.search('name', term).eq('source', 'custom').eq('userId', userId))
      .collect();
  }
  return ctx.db
    .query('foods')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect();
};

export const search = query({
  args: {
    category: v.optional(v.string()),
    term: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    const profile = user
      ? await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', user._id))
          .unique()
      : null;

    const { term, category } = args;
    const dietaryPreference = profile?.dietaryPreference ?? 'onnivoro';
    const excludeAllergens = profile?.allergies ?? [];

    const creaResults = term
      ? await ctx.db
          .query('foods')
          .withSearchIndex('search_name', (q) => q.search('name', term).eq('source', 'crea'))
          .collect()
      : await ctx.db
          .query('foods')
          .withIndex('by_source', (q) => q.eq('source', 'crea'))
          .collect();

    const customResults = user ? await fetchCustomFoods(ctx, user._id, term) : [];

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
    return [...categories].toSorted((a, b) => a.localeCompare(b));
  },
});

export const addCustomFood = mutation({
  args: {
    allergenTags: v.array(v.string()),
    carbPer100g: v.number(),
    category: v.string(),
    fatPer100g: v.number(),
    foodType: v.union(v.literal('animale'), v.literal('vegetale')),
    kcalPer100g: v.number(),
    name: v.string(),
    proteinPer100g: v.number(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    const userId = authUser._id;
    const existingCount = await ctx.db
      .query('foods')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();

    if (existingCount.length >= CUSTOM_FOOD_LIMIT) {
      throw new ConvexError({ code: 'LIMIT_REACHED', message: `Custom food limit of ${CUSTOM_FOOD_LIMIT} reached` });
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
    if (!user) {
      return { count: 0, limit: CUSTOM_FOOD_LIMIT };
    }

    const foods = await ctx.db
      .query('foods')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect();

    return { count: foods.length, limit: CUSTOM_FOOD_LIMIT };
  },
});

export const getById = query({
  args: { foodId: v.id('foods') },
  handler: (ctx, args) => ctx.db.get(args.foodId),
});

export const deleteCustomFood = mutation({
  args: { foodId: v.id('foods') },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    const food = await ctx.db.get(args.foodId);
    if (!food || food.source !== 'custom' || food.userId !== user._id) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Alimento non trovato' });
    }

    await ctx.db.delete(args.foodId);
  },
});

const fetchAllCreaFoods = (ctx: QueryCtx) =>
  ctx.db
    .query('foods')
    .withIndex('by_source', (q) => q.eq('source', 'crea'))
    .collect();

const isNotAllergen = (food: FoodDoc, userAllergens: string[]): boolean =>
  userAllergens.length === 0 || !food.allergenTags.some((tag) => userAllergens.includes(tag));

const filterFoodsForSuggest = (allFoods: FoodDoc[], userAllergens: string[], dietPref: string): FoodDoc[] =>
  allFoods.filter((f) => isNotAllergen(f, userAllergens) && filterByDietaryPreference(f, dietPref));

const sortFieldForMacro = (macro: 'protein' | 'carb' | 'fat'): keyof FoodDoc => {
  if (macro === 'protein') {
    return 'proteinPer100g';
  }
  if (macro === 'carb') {
    return 'carbPer100g';
  }
  return 'fatPer100g';
};

export const suggestForMacro = query({
  args: {
    limit: v.optional(v.number()),
    macro: v.union(v.literal('protein'), v.literal('carb'), v.literal('fat')),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    const profile = user
      ? await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', user._id))
          .unique()
      : null;

    const allFoods = await fetchAllCreaFoods(ctx);
    const userAllergens = profile?.allergies ?? [];
    const dietPref = profile?.dietaryPreference ?? 'onnivoro';
    const filtered = filterFoodsForSuggest(allFoods as FoodDoc[], userAllergens, dietPref);
    const sortField = sortFieldForMacro(args.macro);

    const sorted = [...filtered].toSorted(
      (a: FoodDoc, b: FoodDoc) => (b[sortField] as number) - (a[sortField] as number)
    );
    return sorted.slice(0, args.limit ?? 5);
  },
});

import { ConvexError, v } from 'convex/values';

// eslint-disable-next-line import/no-relative-parent-imports
import creaDatabaseFoods from '../data/crea-foods.json';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { allergenValidator, foodCategoryValidator, foodTypeValidator } from './lib/validators';
import type { AllergenTag, FoodCategory, FoodType } from './lib/validators';

const CUSTOM_FOOD_LIMIT = 100;
const CREA_SEED_BATCH_SIZE = 25;
const UNFILTERED_CREA_SEARCH_LIMIT = 120;

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
  category: FoodCategory;
  kcalPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  allergenTags: string[];
  foodType: FoodType;
  source: 'crea' | 'custom';
  userId?: string;
}

interface SearchFilters {
  dietaryPreference?: string;
  excludeAllergens?: string[];
}

interface AddCustomFoodArgs {
  allergenTags: string[];
  carbPer100g: number;
  category: FoodCategory;
  fatPer100g: number;
  foodType: FoodType;
  kcalPer100g: number;
  name: string;
  proteinPer100g: number;
}

const NUTRITION_FIELDS = ['kcalPer100g', 'proteinPer100g', 'carbPer100g', 'fatPer100g'] as const;

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

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
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

    const batches = chunkArray(creaDatabaseFoods, CREA_SEED_BATCH_SIZE);
    for (const batch of batches) {
      const insertPromises = batch.map((food) =>
        ctx.db.insert('foods', {
          allergenTags: food.allergenTags as AllergenTag[],
          carbPer100g: food.carbPer100g,
          category: food.category as FoodCategory,
          fatPer100g: food.fatPer100g,
          foodType: food.foodType as FoodType,
          kcalPer100g: food.kcalPer100g,
          name: food.name,
          proteinPer100g: food.proteinPer100g,
          source: 'crea',
        })
      );
      await Promise.all(insertPromises);
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

const requireAuthenticatedUserId = async (ctx: MutationCtx): Promise<string> => {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) {
    throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
  }
  return authUser._id;
};

const assertNonNegativeNutritionValues = (args: AddCustomFoodArgs): void => {
  const invalidFields = NUTRITION_FIELDS.filter((field) => args[field] < 0);
  if (invalidFields.length > 0) {
    throw new ConvexError({
      code: 'INVALID_ARGUMENT',
      message: `Nutrition values must be non-negative; invalid: ${invalidFields.join(', ')}`,
    });
  }
};

const MAX_FOOD_NAME_LENGTH = 200;
const MAX_ALLERGEN_TAGS = 20;
const MAX_ALLERGEN_TAG_LENGTH = 50;

const assertFoodStringLengths = (args: AddCustomFoodArgs): void => {
  if (args.name.length < 1 || args.name.length > MAX_FOOD_NAME_LENGTH) {
    throw new ConvexError({ code: 'INVALID_INPUT', message: `Name must be 1-${MAX_FOOD_NAME_LENGTH} characters` });
  }
  if (args.allergenTags.length > MAX_ALLERGEN_TAGS) {
    throw new ConvexError({ code: 'INVALID_INPUT', message: `Max ${MAX_ALLERGEN_TAGS} allergen tags allowed` });
  }
  for (const tag of args.allergenTags) {
    if (tag.length > MAX_ALLERGEN_TAG_LENGTH) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: `Each allergen tag must be max ${MAX_ALLERGEN_TAG_LENGTH} characters`,
      });
    }
  }
};

const assertCustomFoodLimitNotReached = async (ctx: MutationCtx, userId: string): Promise<void> => {
  const existing = await ctx.db
    .query('foods')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .take(CUSTOM_FOOD_LIMIT);
  if (existing.length >= CUSTOM_FOOD_LIMIT) {
    throw new ConvexError({ code: 'LIMIT_REACHED', message: `Custom food limit of ${CUSTOM_FOOD_LIMIT} reached` });
  }
};

export const search = query({
  args: {
    category: v.optional(v.string()),
    term: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError('Unauthenticated');
    }
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();

    const { term, category } = args;
    const shouldLimitCreaResults = !term && !category;
    const dietaryPreference = profile?.dietaryPreference ?? 'onnivoro';
    const excludeAllergens = profile?.allergies ?? [];

    let creaResults;
    if (term) {
      creaResults = await ctx.db
        .query('foods')
        .withSearchIndex('search_name', (q) => q.search('name', term).eq('source', 'crea'))
        .collect();
    } else if (shouldLimitCreaResults) {
      creaResults = await ctx.db
        .query('foods')
        .withIndex('by_source', (q) => q.eq('source', 'crea'))
        .take(UNFILTERED_CREA_SEARCH_LIMIT);
    } else {
      creaResults = await ctx.db
        .query('foods')
        .withIndex('by_source', (q) => q.eq('source', 'crea'))
        .collect();
    }

    const customResults = await fetchCustomFoods(ctx, user._id, term);

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
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError('Unauthenticated');
    }

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
    allergenTags: v.array(allergenValidator),
    carbPer100g: v.number(),
    category: foodCategoryValidator,
    fatPer100g: v.number(),
    foodType: foodTypeValidator,
    kcalPer100g: v.number(),
    name: v.string(),
    proteinPer100g: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    assertFoodStringLengths(args);
    assertNonNegativeNutritionValues(args);
    await assertCustomFoodLimitNotReached(ctx, userId);
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
      .take(CUSTOM_FOOD_LIMIT + 1);

    return { count: foods.length, limit: CUSTOM_FOOD_LIMIT };
  },
});

export const getById = query({
  args: { foodId: v.id('foods') },
  handler: async (ctx, args) => {
    const food = await ctx.db.get(args.foodId);
    if (!food) {
      return null;
    }

    if (food.source === 'crea') {
      return food;
    }

    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || food.userId !== authUser._id) {
      return null;
    }

    return food;
  },
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

const isNotAllergen = (food: FoodDoc, userAllergens: string[]): boolean => filterByAllergens(food, userAllergens);

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
    if (!user) {
      throw new ConvexError('Unauthenticated');
    }
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();

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

export const listCustom = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError('Unauthenticated');
    }

    return ctx.db
      .query('foods')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('source'), 'custom'))
      .collect();
  },
});

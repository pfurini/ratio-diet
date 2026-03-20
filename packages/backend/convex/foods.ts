import { KCAL_CONSISTENCY_TOLERANCE, MAX_MACRO_PER_100G } from '@ratio-diet/common';
import { ConvexError, v } from 'convex/values';

// eslint-disable-next-line import/no-relative-parent-imports
import creaDatabaseFoods from '../data/crea-foods.json';
import type { Id } from './_generated/dataModel';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { FOOD_CATEGORY_VALUES, allergenValidator, foodCategoryValidator, foodTypeValidator } from './lib/validators';
import type { AllergenTag, FoodCategory, FoodType } from './lib/validators';

const CUSTOM_FOOD_LIMIT = 100;
const CREA_SEED_BATCH_SIZE = 50;
const UNFILTERED_CREA_SEARCH_LIMIT = 120;
// max CREA foods in AI prompt — not the DB total
const AI_PLAN_FOOD_BUDGET = 120;

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

const insertCreaFoodsBatch = async (ctx: MutationCtx, foods: typeof creaDatabaseFoods): Promise<number> => {
  const batches = chunkArray(foods, CREA_SEED_BATCH_SIZE);
  for (const batch of batches) {
    for (const food of batch) {
      await ctx.db.insert('foods', {
        allergenTags: food.allergenTags as AllergenTag[],
        carbPer100g: food.carbPer100g,
        category: food.category as FoodCategory,
        fatPer100g: food.fatPer100g,
        foodType: food.foodType as FoodType,
        kcalPer100g: food.kcalPer100g,
        name: food.name,
        proteinPer100g: food.proteinPer100g,
        source: 'crea',
      });
    }
  }
  return foods.length;
};

export const seedCREA = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existingFoods = await ctx.db
      .query('foods')
      .withIndex('by_source', (q) => q.eq('source', 'crea'))
      .collect();

    const existingNames = new Set(existingFoods.map((f) => f.name.toLowerCase()));

    const newFoods = creaDatabaseFoods.filter((food) => !existingNames.has(food.name.toLowerCase()));

    if (newFoods.length === 0) {
      return { seeded: 0, skipped: existingFoods.length };
    }

    const seeded = await insertCreaFoodsBatch(ctx, newFoods);
    return { seeded, skipped: existingFoods.length };
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

const assertMacrosWithinPhysicalLimits = (args: AddCustomFoodArgs): void => {
  const macros = [
    { field: 'proteinPer100g', value: args.proteinPer100g },
    { field: 'carbPer100g', value: args.carbPer100g },
    { field: 'fatPer100g', value: args.fatPer100g },
  ];
  for (const macro of macros) {
    if (macro.value > MAX_MACRO_PER_100G) {
      throw new ConvexError({
        code: 'INVALID_ARGUMENT',
        message: `${macro.field} cannot exceed ${MAX_MACRO_PER_100G}g per 100g`,
      });
    }
  }
  const sum = args.proteinPer100g + args.carbPer100g + args.fatPer100g;
  if (sum > MAX_MACRO_PER_100G) {
    throw new ConvexError({
      code: 'INVALID_ARGUMENT',
      message: `Total macros (protein + carbs + fat) cannot exceed ${MAX_MACRO_PER_100G}g per 100g`,
    });
  }
};

const assertCalorieConsistency = (args: AddCustomFoodArgs): void => {
  const expectedKcal = args.proteinPer100g * 4 + args.carbPer100g * 4 + args.fatPer100g * 9;
  if (Math.abs(args.kcalPer100g - expectedKcal) > KCAL_CONSISTENCY_TOLERANCE) {
    throw new ConvexError({
      code: 'INVALID_ARGUMENT',
      message: `Calorie value (${args.kcalPer100g} kcal) is inconsistent with macros (expected ~${Math.round(expectedKcal)} kcal)`,
    });
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
        .withIndex('by_source_category', (q) => q.eq('source', 'crea').eq('category', category as FoodCategory))
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
    return [...FOOD_CATEGORY_VALUES].toSorted((a, b) => a.localeCompare(b));
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
    assertMacrosWithinPhysicalLimits(args);
    assertCalorieConsistency(args);
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

const MACRO_INDEX_MAP = {
  carb: 'by_source_carb',
  fat: 'by_source_fat',
  protein: 'by_source_protein',
} as const;

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

    const limit = args.limit ?? 5;
    const userAllergens = profile?.allergies ?? [];
    const dietPref = profile?.dietaryPreference ?? 'onnivoro';
    const indexName = MACRO_INDEX_MAP[args.macro];

    const candidates = await ctx.db
      .query('foods')
      .withIndex(indexName, (q) => q.eq('source', 'crea'))
      .order('desc')
      .take(Math.max(limit * 10, 50));

    return (candidates as FoodDoc[])
      .filter((f) => filterByDietaryPreference(f, dietPref) && filterByAllergens(f, userAllergens))
      .slice(0, limit);
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

export const fetchFoodsForAIPlan = internalQuery({
  args: {
    dietaryPreference: v.string(),
    excludeAllergens: v.array(allergenValidator),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const hiddenCats = HIDDEN_CATEGORIES[args.dietaryPreference] ?? [];
    const allowedCats = FOOD_CATEGORY_VALUES.filter((c) => !hiddenCats.includes(c));
    const perCategory = Math.ceil(AI_PLAN_FOOD_BUDGET / allowedCats.length);

    const catResults = await Promise.all(
      allowedCats.map((cat) =>
        ctx.db
          .query('foods')
          .withIndex('by_source_category', (q) => q.eq('source', 'crea').eq('category', cat))
          .take(perCategory + 10)
      )
    );

    const creaFoods = catResults.flatMap((catFoods) =>
      catFoods.filter((f) => filterByAllergens(f, args.excludeAllergens)).slice(0, perCategory)
    );

    const customFoods = await ctx.db
      .query('foods')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .collect();

    const customFoodsFiltered = customFoods.filter((f) => filterByAllergens(f, args.excludeAllergens));

    return [...creaFoods, ...customFoodsFiltered];
  },
});

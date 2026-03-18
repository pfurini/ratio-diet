import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { assertDateOnly } from './lib/dateOnly';
import { distributeMacrosToMeals, optimizeMealQuantities } from './lib/optimizer';
import { mealTypeValidator } from './schema';

// --- Constants ---

const MAX_MEALS_PER_PLAN = 6;
const MAX_ITEMS_PER_MEAL = 30;

// --- Validators ---

const mealItemInput = v.object({
  constraintMax: v.optional(v.number()),
  constraintMin: v.optional(v.number()),
  foodId: v.id('foods'),
});

const mealInput = v.object({
  items: v.array(mealItemInput),
  type: mealTypeValidator,
});

// --- Types ---

interface MealItem {
  foodId: string;
  constraintMin?: number;
  constraintMax?: number;
}

interface Meal {
  type: string;
  items: MealItem[];
}

interface MacroTarget {
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

interface FoodDoc {
  _id: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
}

interface OptimizerFood {
  id: string;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  kcalPer100g: number;
}

interface MealResult {
  type: string;
  optimizedItems: { foodId: string; quantityGrams: number; constraintMin?: number; constraintMax?: number }[];
  macrosAchieved: MacroTarget & { kcal: number };
}

// --- Helper: fetch food documents for a meal's items ---

const fetchFoodsForMeal = async (ctx: QueryCtx | MutationCtx, items: MealItem[]): Promise<FoodDoc[]> => {
  const docs = await Promise.all(items.map((item) => ctx.db.get(item.foodId as Parameters<typeof ctx.db.get>[0])));
  const missingFoodIds = items.flatMap((item, index) => (docs[index] === null ? [item.foodId] : []));
  if (missingFoodIds.length > 0) {
    throw new ConvexError({
      code: 'NOT_FOUND',
      message: `Impossibile ottimizzare il pasto: alimenti mancanti (${missingFoodIds.join(', ')})`,
    });
  }
  return docs as FoodDoc[];
};

// --- Helper: map food docs to optimizer input format ---

const buildOptimizerFoods = (foodDocs: FoodDoc[]): OptimizerFood[] =>
  foodDocs.map((doc) => ({
    carbPer100g: doc.carbPer100g,
    fatPer100g: doc.fatPer100g,
    id: doc._id as string,
    kcalPer100g: doc.kcalPer100g,
    proteinPer100g: doc.proteinPer100g,
  }));

// --- Helper: build constraints record from meal items ---

const buildConstraints = (items: MealItem[]): Record<string, { min?: number; max?: number }> => {
  const constraints: Record<string, { min?: number; max?: number }> = {};
  for (const item of items) {
    const constraint: { min?: number; max?: number } = {};
    if (item.constraintMin !== undefined) {
      constraint.min = item.constraintMin;
    }
    if (item.constraintMax !== undefined) {
      constraint.max = item.constraintMax;
    }
    constraints[item.foodId] = constraint;
  }
  return constraints;
};

// --- Helper: build meal items with quantities from optimizer result ---

const buildMealItems = (
  items: MealItem[],
  quantities: Record<string, number>
): { foodId: string; quantityGrams: number; constraintMin?: number; constraintMax?: number }[] =>
  items.map((item) => ({
    constraintMax: item.constraintMax,
    constraintMin: item.constraintMin,
    foodId: item.foodId,
    quantityGrams: quantities[item.foodId] ?? 0,
  }));

// --- Helper: orchestrate one meal optimization ---

const optimizeSingleMeal = async (
  ctx: QueryCtx | MutationCtx,
  meal: Meal,
  mealTarget: MacroTarget
): Promise<MealResult> => {
  const foodDocs = await fetchFoodsForMeal(ctx, meal.items);
  const foods = buildOptimizerFoods(foodDocs);
  const constraints = buildConstraints(meal.items);
  const result = optimizeMealQuantities({ constraints, foods, macroTarget: mealTarget });
  const optimizedItems = buildMealItems(meal.items, result.quantities);
  return { macrosAchieved: result.macrosAchieved, optimizedItems, type: meal.type };
};

// --- Helper: sum macros across all meal results ---

const sumMacros = (mealResults: MealResult[]): MacroTarget & { kcal: number } => {
  let proteinGrams = 0;
  let carbGrams = 0;
  let fatGrams = 0;
  let kcal = 0;
  for (const meal of mealResults) {
    proteinGrams += meal.macrosAchieved.proteinGrams;
    carbGrams += meal.macrosAchieved.carbGrams;
    fatGrams += meal.macrosAchieved.fatGrams;
    kcal += meal.macrosAchieved.kcal;
  }
  return { carbGrams, fatGrams, kcal, proteinGrams };
};

type MealType = 'colazione' | 'pranzo' | 'cena' | 'spuntino_mattina' | 'spuntino_pomeriggio';

// --- Helper: build the meals array for DB storage ---

const buildMealsForDb = (mealResults: MealResult[]) =>
  mealResults.map((r) => ({
    items: r.optimizedItems.map((item) => ({
      constraintMax: item.constraintMax,
      constraintMin: item.constraintMin,
      foodId: item.foodId as Id<'foods'>,
      quantityGrams: item.quantityGrams,
    })),
    type: r.type as MealType,
  }));

// --- Helper: upsert daily plan ---

const upsertDailyPlan = async (
  ctx: MutationCtx,
  userId: string,
  date: string,
  planData: {
    meals: ReturnType<typeof buildMealsForDb>;
    macrosAchieved: { proteinGrams: number; carbGrams: number; fatGrams: number; kcal: number };
    macrosTarget: { proteinGrams: number; carbGrams: number; fatGrams: number; calorieTarget: number; tdee: number };
  }
) => {
  const existing = await ctx.db
    .query('dailyPlans')
    .withIndex('by_userId_date', (q) => q.eq('userId', userId).eq('date', date))
    .unique();

  const macrosAchieved = {
    achievedCalories: planData.macrosAchieved.kcal,
    carbGrams: planData.macrosAchieved.carbGrams,
    fatGrams: planData.macrosAchieved.fatGrams,
    proteinGrams: planData.macrosAchieved.proteinGrams,
  };

  if (existing) {
    await ctx.db.patch(existing._id, {
      macrosAchieved,
      macrosTarget: planData.macrosTarget,
      meals: planData.meals,
      status: 'draft',
    });
    return existing._id;
  }

  return ctx.db.insert('dailyPlans', {
    date,
    macrosAchieved,
    macrosTarget: planData.macrosTarget,
    meals: planData.meals,
    status: 'draft',
    userId,
  });
};

// --- Helper: fetch profile and return macro target ---

const fetchProfileMacros = async (ctx: MutationCtx, userId: string) => {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique();

  if (!profile) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Profilo non trovato' });
  }

  return profile.macros;
};

// --- Mutations and Queries ---

export const optimize = mutation({
  args: {
    date: v.string(),
    meals: v.array(mealInput),
  },
  handler: async (ctx, args) => {
    assertDateOnly(args.date);
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    if (args.meals.length > MAX_MEALS_PER_PLAN) {
      throw new ConvexError({ code: 'INVALID_INPUT', message: `Max ${MAX_MEALS_PER_PLAN} meals per plan` });
    }
    for (const meal of args.meals) {
      if (meal.items.length > MAX_ITEMS_PER_MEAL) {
        throw new ConvexError({ code: 'INVALID_INPUT', message: `Max ${MAX_ITEMS_PER_MEAL} items per meal` });
      }
    }

    const profileMacros = await fetchProfileMacros(ctx, user._id);
    const dailyTarget: MacroTarget = {
      carbGrams: profileMacros.carbGrams,
      fatGrams: profileMacros.fatGrams,
      proteinGrams: profileMacros.proteinGrams,
    };

    const mealTargets = distributeMacrosToMeals(
      dailyTarget,
      args.meals.map((m) => m.type)
    );
    const mealResults = await Promise.all(
      args.meals.map((meal) => optimizeSingleMeal(ctx, meal as Meal, mealTargets[meal.type] ?? dailyTarget))
    );

    return upsertDailyPlan(ctx, user._id, args.date, {
      macrosAchieved: sumMacros(mealResults),
      macrosTarget: profileMacros,
      meals: buildMealsForDb(mealResults),
    });
  },
});

export const get = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    assertDateOnly(args.date);
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    return ctx.db
      .query('dailyPlans')
      .withIndex('by_userId_date', (q) => q.eq('userId', user._id).eq('date', args.date))
      .unique();
  },
});

export const complete = mutation({
  args: {
    planId: v.id('dailyPlans'),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    const plan = await ctx.db.get(args.planId);
    if (!plan) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Piano non trovato' });
    }

    if (plan.userId !== user._id) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Non autorizzato' });
    }

    await ctx.db.patch(args.planId, { status: 'complete' });
  },
});

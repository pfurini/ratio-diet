import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { distributeMacrosToMeals, optimizeMealQuantities } from './lib/optimizer';
import type { Id } from './_generated/dataModel';

// --- Validators ---

const mealItemInput = v.object({
  foodId: v.id('foods'),
  constraintMin: v.optional(v.number()),
  constraintMax: v.optional(v.number()),
});

const mealInput = v.object({
  type: v.union(
    v.literal('colazione'),
    v.literal('pranzo'),
    v.literal('cena'),
    v.literal('spuntino_mattina'),
    v.literal('spuntino_pomeriggio'),
  ),
  items: v.array(mealItemInput),
});

// --- Types ---

type MealItem = {
  foodId: string;
  constraintMin?: number;
  constraintMax?: number;
};

type Meal = {
  type: string;
  items: MealItem[];
};

type MacroTarget = {
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
};

type FoodDoc = {
  _id: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
};

type OptimizerFood = {
  id: string;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  kcalPer100g: number;
};

type MealResult = {
  type: string;
  optimizedItems: { foodId: string; quantityGrams: number; constraintMin?: number; constraintMax?: number }[];
  macrosAchieved: MacroTarget & { kcal: number };
};

// --- Helper: fetch food documents for a meal's items ---

const fetchFoodsForMeal = async (ctx: QueryCtx | MutationCtx, items: MealItem[]): Promise<FoodDoc[]> => {
  const docs = await Promise.all(items.map((item) => ctx.db.get(item.foodId as Parameters<typeof ctx.db.get>[0])));
  return docs.filter((doc): doc is NonNullable<typeof doc> => doc !== null) as FoodDoc[];
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
  quantities: Record<string, number>,
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
  mealTarget: MacroTarget,
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
  },
) => {
  const existing = await ctx.db
    .query('dailyPlans')
    .withIndex('by_userId_date', (q) => q.eq('userId', userId).eq('date', date))
    .unique();

  const macrosAchieved = {
    calorieTarget: planData.macrosAchieved.kcal,
    carbGrams: planData.macrosAchieved.carbGrams,
    fatGrams: planData.macrosAchieved.fatGrams,
    proteinGrams: planData.macrosAchieved.proteinGrams,
    tdee: planData.macrosAchieved.kcal,
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
    throw new Error('Profilo non trovato');
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
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error('Non autenticato');
    }

    const profileMacros = await fetchProfileMacros(ctx, user._id);
    const mealTypes = args.meals.map((m) => m.type);
    const dailyTarget: MacroTarget = {
      carbGrams: profileMacros.carbGrams,
      fatGrams: profileMacros.fatGrams,
      proteinGrams: profileMacros.proteinGrams,
    };

    const mealTargets = distributeMacrosToMeals(dailyTarget, mealTypes);
    const mealResults = await Promise.all(
      args.meals.map((meal) => optimizeSingleMeal(ctx, meal as Meal, mealTargets[meal.type] ?? dailyTarget)),
    );

    const totalMacros = sumMacros(mealResults);
    const mealsForDb = buildMealsForDb(mealResults);

    return upsertDailyPlan(ctx, user._id, args.date, {
      macrosAchieved: totalMacros,
      macrosTarget: profileMacros,
      meals: mealsForDb,
    });
  },
});

export const get = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
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
      throw new Error('Non autenticato');
    }

    const plan = await ctx.db.get(args.planId);
    if (!plan) {
      throw new Error('Piano non trovato');
    }

    if (plan.userId !== user._id) {
      throw new Error('Non autorizzato');
    }

    await ctx.db.patch(args.planId, { status: 'complete' });
  },
});

import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalMutation, mutation, query } from './_generated/server';
import type { ActionCtx, MutationCtx } from './_generated/server';
import { authComponent } from './auth';
import { addFoodToShoppingMap, buildShoppingList, buildShoppingListFromMap } from './lib/shoppingList';
import { calcItemsMacros, findFood, generateWithRetry } from './lib/weeklyPlanGenerator';
import type { DayPlan, FoodDoc, MacroTarget, MealItem, WeeklyPlanResult } from './lib/weeklyPlanGenerator';
import { buildWeeklyPlanPrompt } from './lib/weeklyPlanPrompt';

// --- Interfaces ---

interface ShoppingEntry {
  foodId: Id<'foods'>;
  name: string;
  totalGrams: number;
  category: string;
}

// --- Date helpers ---

const getNextMonday = (): string => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  return monday.toISOString().split('T')[0] as string;
};

const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0] as string;
};

// --- Shopping list helpers ---

const addMealItemsToMap = (items: MealItem[], foods: FoodDoc[], map: Map<string, ShoppingEntry>): void => {
  for (const item of items) {
    const food = findFood(foods, item.foodName);
    if (food) {
      addFoodToShoppingMap(food, item.grams, map);
    }
  }
};

const buildMealItems = (items: MealItem[], foods: FoodDoc[]): { foodId: Id<'foods'>; quantityGrams: number }[] => {
  const result: { foodId: Id<'foods'>; quantityGrams: number }[] = [];
  for (const item of items) {
    const food = findFood(foods, item.foodName);
    if (food) {
      result.push({ foodId: food._id, quantityGrams: item.grams });
    }
  }
  return result;
};

const buildDayMeals = (day: DayPlan, foods: FoodDoc[]) => [
  { items: buildMealItems(day.colazione, foods), type: 'colazione' as const },
  { items: buildMealItems(day.pranzo, foods), type: 'pranzo' as const },
  { items: buildMealItems(day.cena, foods), type: 'cena' as const },
];

// --- Internal mutations ---

export const createDailyPlan = internalMutation({
  args: {
    date: v.string(),
    macrosAchieved: v.object({
      calorieTarget: v.number(),
      carbGrams: v.number(),
      fatGrams: v.number(),
      proteinGrams: v.number(),
      tdee: v.number(),
    }),
    macrosTarget: v.object({
      calorieTarget: v.number(),
      carbGrams: v.number(),
      fatGrams: v.number(),
      proteinGrams: v.number(),
      tdee: v.number(),
    }),
    meals: v.array(
      v.object({
        items: v.array(v.object({ foodId: v.id('foods'), quantityGrams: v.number() })),
        type: v.union(
          v.literal('colazione'),
          v.literal('pranzo'),
          v.literal('cena'),
          v.literal('spuntino_mattina'),
          v.literal('spuntino_pomeriggio')
        ),
      })
    ),
    userId: v.string(),
  },
  handler: (ctx, args) =>
    ctx.db.insert('dailyPlans', {
      date: args.date,
      macrosAchieved: args.macrosAchieved,
      macrosTarget: args.macrosTarget,
      meals: args.meals,
      status: 'draft',
      userId: args.userId,
    }),
});

export const create = internalMutation({
  args: {
    dailyPlanIds: v.array(v.id('dailyPlans')),
    shoppingList: v.array(
      v.object({
        category: v.string(),
        foodId: v.id('foods'),
        name: v.string(),
        totalGrams: v.number(),
      })
    ),
    userId: v.string(),
    weekStartDate: v.string(),
  },
  handler: (ctx, args) =>
    ctx.db.insert('weeklyPlans', {
      dailyPlanIds: args.dailyPlanIds,
      shoppingList: args.shoppingList,
      status: 'generato',
      userId: args.userId,
      weekStartDate: args.weekStartDate,
    }),
});

// --- Action helpers ---

const validateSubscription = async (ctx: ActionCtx): Promise<string> => {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) {
    throw new Error('Non autenticato');
  }

  const sub = await ctx.runQuery(api.subscriptions.getStatus, {});
  if (!sub || sub.status !== 'active') {
    throw new Error('Abbonamento non attivo');
  }

  return user._id;
};

const fetchProfileForPlan = async (ctx: ActionCtx) => {
  const profile = await ctx.runQuery(api.userProfiles.get, {});
  if (!profile) {
    throw new Error('Profilo non trovato');
  }
  return profile;
};

const fetchFoodsForPlan = async (ctx: ActionCtx): Promise<FoodDoc[]> => {
  const foods = await ctx.runQuery(api.foods.search, {});
  return foods as FoodDoc[];
};

const processDayForPlan = async (
  ctx: ActionCtx,
  userId: string,
  weekStart: string,
  day: DayPlan,
  index: number,
  foods: FoodDoc[],
  macros: MacroTarget,
  shoppingMap: Map<string, ShoppingEntry>
): Promise<Id<'dailyPlans'>> => {
  const date = index === 0 ? weekStart : addDays(weekStart, index);
  const allItems = [...day.colazione, ...day.pranzo, ...day.cena];
  const macrosAchieved = calcItemsMacros(allItems, foods);
  const meals = buildDayMeals(day, foods);

  const planId = await ctx.runMutation(internal.weeklyPlans.createDailyPlan, {
    date,
    macrosAchieved,
    macrosTarget: macros,
    meals,
    userId,
  });

  addMealItemsToMap(allItems, foods, shoppingMap);
  return planId;
};

const createDailyPlansFromAI = async (
  ctx: ActionCtx,
  userId: string,
  weekStart: string,
  result: WeeklyPlanResult,
  foods: FoodDoc[],
  macros: MacroTarget
): Promise<{ dailyPlanIds: Id<'dailyPlans'>[]; shoppingMap: Map<string, ShoppingEntry> }> => {
  const dailyPlanIds: Id<'dailyPlans'>[] = [];
  const shoppingMap = new Map<string, ShoppingEntry>();

  for (let i = 0; i < result.days.length; i += 1) {
    const day = result.days[i] as DayPlan;
    const planId = await processDayForPlan(ctx, userId, weekStart, day, i, foods, macros, shoppingMap);
    dailyPlanIds.push(planId);
  }

  return { dailyPlanIds, shoppingMap };
};

// --- Generate action helpers ---

interface PlanProfile {
  macros: MacroTarget;
  allergies: string[];
  allergiesOther?: string;
  dietaryPreference: string;
}

const buildPromptForProfile = (profile: PlanProfile, foods: FoodDoc[]): string =>
  buildWeeklyPlanPrompt({
    allergies: profile.allergies,
    allergiesOther: profile.allergiesOther,
    dietaryPreference: profile.dietaryPreference,
    foods,
    macroTarget: profile.macros,
  });

const saveWeeklyPlan = async (
  ctx: ActionCtx,
  userId: string,
  weekStart: string,
  result: WeeklyPlanResult,
  foods: FoodDoc[],
  macros: MacroTarget
) => {
  const { dailyPlanIds, shoppingMap } = await createDailyPlansFromAI(ctx, userId, weekStart, result, foods, macros);
  const shoppingList = buildShoppingListFromMap(shoppingMap);
  return ctx.runMutation(internal.weeklyPlans.create, { dailyPlanIds, shoppingList, userId, weekStartDate: weekStart });
};

// --- Public action ---

export const generate = action({
  args: {},
  handler: async (ctx) => {
    const userId = await validateSubscription(ctx);
    const profile = await fetchProfileForPlan(ctx);
    const foods = await fetchFoodsForPlan(ctx);

    if (foods.length === 0) {
      throw new Error('Nessun alimento disponibile');
    }

    const macros: MacroTarget = { ...profile.macros };
    const prompt = buildPromptForProfile(profile, foods);
    const result = await generateWithRetry(prompt, foods, macros);
    const weekStart = getNextMonday();

    return saveWeeklyPlan(ctx, userId, weekStart, result, foods, macros);
  },
});

// --- Queries ---

export const get = query({
  args: { weeklyPlanId: v.id('weeklyPlans') },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const plan = await ctx.db.get(args.weeklyPlanId);
    if (!plan || plan.userId !== user._id) {
      return null;
    }

    const dailyPlans = await Promise.all(plan.dailyPlanIds.map((id) => ctx.db.get(id)));
    return { ...plan, dailyPlans: dailyPlans.filter(Boolean) };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    return ctx.db
      .query('weeklyPlans')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect();
  },
});

// --- Edit mutations ---

const verifyEditAccess = async (ctx: MutationCtx, weeklyPlanId: Id<'weeklyPlans'>) => {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) {
    throw new Error('Non autenticato');
  }

  const sub = await ctx.db
    .query('subscriptions')
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .unique();
  if (!sub || sub.status !== 'active') {
    throw new Error('Abbonamento attivo richiesto per modificare il piano');
  }

  const plan = await ctx.db.get(weeklyPlanId);
  if (!plan || plan.userId !== user._id) {
    throw new Error('Piano non trovato');
  }

  return { plan, user };
};

export const updateMealItem = mutation({
  args: {
    dailyPlanId: v.id('dailyPlans'),
    foodId: v.id('foods'),
    mealType: v.string(),
    quantityGrams: v.number(),
    weeklyPlanId: v.id('weeklyPlans'),
  },
  handler: async (ctx, args) => {
    await verifyEditAccess(ctx, args.weeklyPlanId);

    const daily = await ctx.db.get(args.dailyPlanId);
    if (!daily) {
      throw new Error('Piano giornaliero non trovato');
    }

    const meals = daily.meals.map((meal) => {
      if (meal.type !== args.mealType) {
        return meal;
      }
      const items = meal.items.map((item) =>
        item.foodId === args.foodId ? { ...item, quantityGrams: args.quantityGrams } : item
      );
      return { ...meal, items };
    });

    await ctx.db.patch(args.dailyPlanId, { meals });
    await ctx.db.patch(args.weeklyPlanId, { status: 'modificato' });
  },
});

const fetchFoodLookup = async (
  ctx: MutationCtx,
  foodIds: string[]
): Promise<Map<string, { _id: string; name: string; category: string }>> => {
  const unique = [...new Set(foodIds)];
  const foods = await Promise.all(unique.map((id) => ctx.db.get(id as Id<'foods'>)));
  const map = new Map<string, { _id: string; name: string; category: string }>();
  for (const food of foods) {
    if (food) {
      map.set(String(food._id), food);
    }
  }
  return map;
};

export const recalculateShoppingList = mutation({
  args: { weeklyPlanId: v.id('weeklyPlans') },
  handler: async (ctx, args) => {
    const { plan } = await verifyEditAccess(ctx, args.weeklyPlanId);

    const dailyPlans = await Promise.all(plan.dailyPlanIds.map((id) => ctx.db.get(id)));
    const allFoodIds = dailyPlans.flatMap((dp) =>
      dp ? dp.meals.flatMap((m) => m.items.map((i) => String(i.foodId))) : []
    );

    const foodLookup = await fetchFoodLookup(ctx, allFoodIds);
    const rawList = buildShoppingList(dailyPlans, foodLookup);
    const shoppingList = rawList.map((i) => ({
      category: i.category,
      foodId: i.foodId as Id<'foods'>,
      name: i.name,
      totalGrams: i.totalGrams,
    }));

    await ctx.db.patch(args.weeklyPlanId, { shoppingList });
  },
});

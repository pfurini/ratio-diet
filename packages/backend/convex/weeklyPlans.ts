import { ConvexError, v } from 'convex/values';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { ActionCtx, MutationCtx } from './_generated/server';
import { authComponent } from './auth';
import { assertDateOnly } from './lib/dateOnly';
import { hasPremiumAccess } from './lib/premiumAccess';
import { addFoodToShoppingMap, buildShoppingList, buildShoppingListFromMap } from './lib/shoppingList';
import type { AllergenTag } from './lib/validators';
import { buildFoodLookupMap, calcItemsMacros, findFood, generateWithRetry } from './lib/weeklyPlanGenerator';
import type { DayPlan, FoodDoc, MacroTarget, MealItem, WeeklyPlanResult } from './lib/weeklyPlanGenerator';
import { buildWeeklyPlanPrompt } from './lib/weeklyPlanPrompt';
import { mealTypeValidator } from './schema';

// --- Interfaces ---

interface ShoppingEntry {
  foodId: Id<'foods'>;
  name: string;
  totalGrams: number;
  category: string;
}

// --- Date helpers ---

const getWeekStartDate = (weekStartDate: string): string => {
  assertDateOnly(weekStartDate);
  return weekStartDate;
};

const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0] as string;
};

// --- Shopping list helpers ---

const addMealItemsToMap = (items: MealItem[], foodMap: Map<string, FoodDoc>, map: Map<string, ShoppingEntry>): void => {
  for (const item of items) {
    const food = findFood(foodMap, item.foodName);
    if (food) {
      addFoodToShoppingMap(food, item.grams, map);
    }
  }
};

const buildMealItems = (
  items: MealItem[],
  foodMap: Map<string, FoodDoc>
): { foodId: Id<'foods'>; quantityGrams: number }[] => {
  const result: { foodId: Id<'foods'>; quantityGrams: number }[] = [];
  for (const item of items) {
    const food = findFood(foodMap, item.foodName);
    if (food) {
      result.push({ foodId: food._id, quantityGrams: item.grams });
    }
  }
  return result;
};

const buildDayMeals = (day: DayPlan, foodMap: Map<string, FoodDoc>) => [
  { items: buildMealItems(day.colazione, foodMap), type: 'colazione' as const },
  { items: buildMealItems(day.pranzo, foodMap), type: 'pranzo' as const },
  { items: buildMealItems(day.cena, foodMap), type: 'cena' as const },
];

// --- Internal queries ---

export const countRecentPlans = internalQuery({
  args: { since: v.number(), userId: v.string() },
  handler: async (ctx, args) => {
    const plans = await ctx.db
      .query('weeklyPlans')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .collect();
    return plans.filter((p) => p._creationTime >= args.since).length;
  },
});

// --- Internal mutations ---

export const createDailyPlan = internalMutation({
  args: {
    date: v.string(),
    macrosAchieved: v.object({
      achievedCalories: v.number(),
      carbGrams: v.number(),
      fatGrams: v.number(),
      proteinGrams: v.number(),
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
        type: mealTypeValidator,
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

// --- Rate limit constants ---

const DAILY_GENERATION_LIMIT = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// --- Action helpers ---

const validateSubscription = async (ctx: ActionCtx): Promise<string> => {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) {
    throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
  }

  const sub = await ctx.runQuery(api.subscriptions.getStatus, {});
  if (!sub || !hasPremiumAccess(sub.status)) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Abbonamento non attivo' });
  }

  return user._id;
};

const assertRateLimitNotExceeded = async (ctx: ActionCtx, userId: string): Promise<void> => {
  const since = Date.now() - ONE_DAY_MS;
  const count = await ctx.runQuery(internal.weeklyPlans.countRecentPlans, { since, userId });
  if (count >= DAILY_GENERATION_LIMIT) {
    throw new ConvexError({
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Hai raggiunto il limite di ${DAILY_GENERATION_LIMIT} generazioni al giorno`,
    });
  }
};

const fetchProfileForPlan = async (ctx: ActionCtx) => {
  const profile = await ctx.runQuery(api.userProfiles.get, {});
  if (!profile) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Profilo non trovato' });
  }
  return profile;
};

const fetchFoodsForPlan = async (
  ctx: ActionCtx,
  userId: string,
  profile: { dietaryPreference: string; allergies: AllergenTag[] }
): Promise<FoodDoc[]> => {
  const foods = await ctx.runQuery(internal.foods.fetchFoodsForAIPlan, {
    dietaryPreference: profile.dietaryPreference,
    excludeAllergens: profile.allergies,
    userId,
  });
  return foods as FoodDoc[];
};

const processDayForPlan = async (
  ctx: ActionCtx,
  userId: string,
  weekStart: string,
  day: DayPlan,
  index: number,
  foodMap: Map<string, FoodDoc>,
  macros: MacroTarget,
  shoppingMap: Map<string, ShoppingEntry>
): Promise<Id<'dailyPlans'>> => {
  const date = index === 0 ? weekStart : addDays(weekStart, index);
  const allItems = [...day.colazione, ...day.pranzo, ...day.cena];
  const macrosAchieved = calcItemsMacros(allItems, foodMap);
  const meals = buildDayMeals(day, foodMap);

  const planId = await ctx.runMutation(internal.weeklyPlans.createDailyPlan, {
    date,
    macrosAchieved: {
      achievedCalories: macrosAchieved.calorieTarget,
      carbGrams: macrosAchieved.carbGrams,
      fatGrams: macrosAchieved.fatGrams,
      proteinGrams: macrosAchieved.proteinGrams,
    },
    macrosTarget: macros,
    meals,
    userId,
  });

  addMealItemsToMap(allItems, foodMap, shoppingMap);
  return planId;
};

const createDailyPlansFromAI = async (
  ctx: ActionCtx,
  userId: string,
  weekStart: string,
  result: WeeklyPlanResult,
  foodMap: Map<string, FoodDoc>,
  macros: MacroTarget
): Promise<{ dailyPlanIds: Id<'dailyPlans'>[]; shoppingMap: Map<string, ShoppingEntry> }> => {
  const dailyPlanIds: Id<'dailyPlans'>[] = [];
  const shoppingMap = new Map<string, ShoppingEntry>();

  for (let i = 0; i < result.days.length; i += 1) {
    const day = result.days[i] as DayPlan;
    const planId = await processDayForPlan(ctx, userId, weekStart, day, i, foodMap, macros, shoppingMap);
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
  foodMap: Map<string, FoodDoc>,
  macros: MacroTarget
): Promise<Id<'weeklyPlans'>> => {
  const { dailyPlanIds, shoppingMap } = await createDailyPlansFromAI(ctx, userId, weekStart, result, foodMap, macros);
  const shoppingList = buildShoppingListFromMap(shoppingMap);
  return ctx.runMutation(internal.weeklyPlans.create, { dailyPlanIds, shoppingList, userId, weekStartDate: weekStart });
};

// --- Public action ---

export const generate = action({
  args: { weekStartDate: v.string() },
  handler: async (ctx, args): Promise<Id<'weeklyPlans'>> => {
    const userId = await validateSubscription(ctx);
    await assertRateLimitNotExceeded(ctx, userId);
    const profile = await fetchProfileForPlan(ctx);
    const foods = await fetchFoodsForPlan(ctx, userId, profile);

    if (foods.length === 0) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Nessun alimento disponibile' });
    }

    const macros: MacroTarget = { ...profile.macros };
    const foodMap = buildFoodLookupMap(foods);
    const prompt = buildPromptForProfile(profile, foods);
    const result = await generateWithRetry(prompt, foodMap, macros);
    const weekStart = getWeekStartDate(args.weekStartDate);

    return saveWeeklyPlan(ctx, userId, weekStart, result, foodMap, macros);
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
    throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
  }

  const sub = await ctx.db
    .query('subscriptions')
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .unique();
  if (!sub || !hasPremiumAccess(sub.status)) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Abbonamento attivo richiesto per modificare il piano' });
  }

  const plan = await ctx.db.get(weeklyPlanId);
  if (!plan || plan.userId !== user._id) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Piano non trovato' });
  }

  return { plan, user };
};

const assertValidQuantityGrams = (quantityGrams: number): void => {
  if (quantityGrams < 1 || quantityGrams > 2000) {
    throw new ConvexError({ code: 'BAD_REQUEST', message: 'La quantita deve essere tra 1g e 2000g' });
  }
};

const getDailyPlanOrThrow = async (ctx: MutationCtx, dailyPlanId: Id<'dailyPlans'>) => {
  const daily = await ctx.db.get(dailyPlanId);
  if (!daily) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Piano giornaliero non trovato' });
  }
  return daily;
};

const updateMealQuantity = (
  daily: Awaited<ReturnType<typeof getDailyPlanOrThrow>>,
  mealType: 'colazione' | 'pranzo' | 'cena' | 'spuntino_mattina' | 'spuntino_pomeriggio',
  foodId: Id<'foods'>,
  quantityGrams: number
) => {
  let foodIdFound = false;
  let quantityUpdated = false;
  const meals = daily.meals.map((meal) => {
    if (meal.type !== mealType) {
      return meal;
    }
    const items = meal.items.map((item) => {
      if (item.foodId !== foodId) {
        return item;
      }
      foodIdFound = true;
      if (item.quantityGrams !== quantityGrams) {
        quantityUpdated = true;
        return { ...item, quantityGrams };
      }
      return item;
    });
    return { ...meal, items };
  });
  return { foodIdFound, meals, quantityUpdated };
};

const assertDailyPlanBelongsToWeeklyPlan = (
  plan: Awaited<ReturnType<typeof verifyEditAccess>>['plan'],
  dailyPlanId: Id<'dailyPlans'>
): void => {
  if (!plan.dailyPlanIds.includes(dailyPlanId)) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Piano giornaliero non trovato' });
  }
};

const markPlanAsEdited = async (
  ctx: MutationCtx,
  dailyPlanId: Id<'dailyPlans'>,
  weeklyPlanId: Id<'weeklyPlans'>,
  meals: Awaited<ReturnType<typeof getDailyPlanOrThrow>>['meals']
): Promise<void> => {
  await ctx.db.patch(dailyPlanId, { meals });
  await ctx.db.patch(weeklyPlanId, { status: 'modificato' });
};

export const updateMealItem = mutation({
  args: {
    dailyPlanId: v.id('dailyPlans'),
    foodId: v.id('foods'),
    mealType: mealTypeValidator,
    quantityGrams: v.number(),
    weeklyPlanId: v.id('weeklyPlans'),
  },
  handler: async (ctx, args) => {
    const { plan } = await verifyEditAccess(ctx, args.weeklyPlanId);
    assertValidQuantityGrams(args.quantityGrams);
    assertDailyPlanBelongsToWeeklyPlan(plan, args.dailyPlanId);
    const daily = await getDailyPlanOrThrow(ctx, args.dailyPlanId);
    const { foodIdFound, meals, quantityUpdated } = updateMealQuantity(
      daily,
      args.mealType,
      args.foodId,
      args.quantityGrams
    );

    if (!foodIdFound) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Alimento non trovato nel pasto selezionato' });
    }
    if (!quantityUpdated) {
      return;
    }
    await markPlanAsEdited(ctx, args.dailyPlanId, args.weeklyPlanId, meals);
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

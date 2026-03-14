import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { v } from 'convex/values';
import { z } from 'zod';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalMutation, query } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { authComponent } from './auth';
import { buildWeeklyPlanPrompt } from './lib/weeklyPlanPrompt';

// --- Zod schemas ---

const mealItemSchema = z.object({
  foodName: z.string(),
  grams: z.number(),
});

const dayPlanSchema = z.object({
  cena: z.array(mealItemSchema),
  colazione: z.array(mealItemSchema),
  day: z.string(),
  pranzo: z.array(mealItemSchema),
});

const weeklyPlanSchema = z.object({
  days: z.array(dayPlanSchema).length(7),
});

// --- Interfaces ---

interface FoodDoc {
  _id: Id<'foods'>;
  name: string;
  category: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  allergenTags: string[];
}

interface MacroTarget {
  calorieTarget: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  tdee: number;
}

interface ShoppingEntry {
  foodId: Id<'foods'>;
  name: string;
  totalGrams: number;
  category: string;
}

interface MacroSnapshot {
  calorieTarget: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  tdee: number;
}

type MealItem = z.infer<typeof mealItemSchema>;
type DayPlan = z.infer<typeof dayPlanSchema>;
type WeeklyPlanResult = z.infer<typeof weeklyPlanSchema>;

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

// --- AI helpers ---

const getOpenRouterModel = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }
  const modelId = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-001';
  const openrouter = createOpenRouter({ apiKey });
  return openrouter(modelId);
};

const runAiGeneration = (prompt: string): Promise<WeeklyPlanResult> => {
  const model = getOpenRouterModel();
  return generateObject({ model, prompt, schema: weeklyPlanSchema }).then(({ object }) => object);
};

// --- Food lookup ---

const findFood = (foods: FoodDoc[], foodName: string): FoodDoc | undefined =>
  foods.find((f) => f.name.toLowerCase() === foodName.toLowerCase());

// --- Validation helpers ---

interface MacroAccumulator {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

const addItemToAccumulator = (acc: MacroAccumulator, item: MealItem, food: FoodDoc): void => {
  const ratio = item.grams / 100;
  acc.kcal += food.kcalPer100g * ratio;
  acc.protein += food.proteinPer100g * ratio;
  acc.carb += food.carbPer100g * ratio;
  acc.fat += food.fatPer100g * ratio;
};

const calcDayMacros = (
  day: DayPlan,
  foods: FoodDoc[],
): MacroAccumulator => {
  const allItems = [...day.colazione, ...day.pranzo, ...day.cena];
  const acc: MacroAccumulator = { carb: 0, fat: 0, kcal: 0, protein: 0 };

  for (const item of allItems) {
    const food = findFood(foods, item.foodName);
    if (food) { addItemToAccumulator(acc, item, food); }
  }

  return acc;
};

const isDayMacroValid = (
  macros: { kcal: number; protein: number; carb: number; fat: number },
  target: MacroTarget,
): boolean => {
  const TOLERANCE = 0.05;
  const kcalOk = Math.abs(macros.kcal - target.calorieTarget) / target.calorieTarget <= TOLERANCE;
  const proteinOk = Math.abs(macros.protein - target.proteinGrams) / target.proteinGrams <= TOLERANCE;
  const carbOk = Math.abs(macros.carb - target.carbGrams) / target.carbGrams <= TOLERANCE;
  const fatOk = Math.abs(macros.fat - target.fatGrams) / target.fatGrams <= TOLERANCE;
  return kcalOk && proteinOk && carbOk && fatOk;
};

const validateWeeklyPlan = (plan: WeeklyPlanResult, foods: FoodDoc[], target: MacroTarget): boolean => {
  for (const day of plan.days) {
    const macros = calcDayMacros(day, foods);
    if (!isDayMacroValid(macros, target)) { return false; }
  }
  return true;
};

// --- AI with retry ---

const generateWithRetry = async (
  prompt: string,
  foods: FoodDoc[],
  macros: MacroTarget,
  maxRetries = 3,
): Promise<WeeklyPlanResult> => {
  let lastResult: WeeklyPlanResult | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const result = await runAiGeneration(prompt);
    if (validateWeeklyPlan(result, foods, macros)) { return result; }
    lastResult = result;
  }

  return lastResult as WeeklyPlanResult;
};

// --- Shopping list helpers ---

const addFoodToShoppingMap = (food: FoodDoc, grams: number, map: Map<string, ShoppingEntry>): void => {
  const key = food._id;
  const existing = map.get(key);
  if (existing) {
    existing.totalGrams += grams;
  } else {
    map.set(key, { category: food.category, foodId: food._id, name: food.name, totalGrams: grams });
  }
};

const addMealItemsToMap = (
  items: MealItem[],
  foods: FoodDoc[],
  map: Map<string, ShoppingEntry>,
): void => {
  for (const item of items) {
    const food = findFood(foods, item.foodName);
    if (food) { addFoodToShoppingMap(food, item.grams, map); }
  }
};

const buildShoppingListFromMap = (map: Map<string, ShoppingEntry>): ShoppingEntry[] =>
  [...map.values()];

const buildMealItems = (
  items: MealItem[],
  foods: FoodDoc[],
): { foodId: Id<'foods'>; quantityGrams: number }[] => {
  const result: { foodId: Id<'foods'>; quantityGrams: number }[] = [];
  for (const item of items) {
    const food = findFood(foods, item.foodName);
    if (food) { result.push({ foodId: food._id, quantityGrams: item.grams }); }
  }
  return result;
};

const accToMacroSnapshot = (acc: MacroAccumulator): MacroSnapshot => ({
  calorieTarget: acc.kcal,
  carbGrams: acc.carb,
  fatGrams: acc.fat,
  proteinGrams: acc.protein,
  tdee: acc.kcal,
});

const calcItemsMacros = (items: MealItem[], foods: FoodDoc[]): MacroSnapshot => {
  const acc: MacroAccumulator = { carb: 0, fat: 0, kcal: 0, protein: 0 };

  for (const item of items) {
    const food = findFood(foods, item.foodName);
    if (food) { addItemToAccumulator(acc, item, food); }
  }

  return accToMacroSnapshot(acc);
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
          v.literal('spuntino_pomeriggio'),
        ),
      }),
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
      }),
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
  if (!user) { throw new Error('Non autenticato'); }

  const sub = await ctx.runQuery(api.subscriptions.getStatus, {});
  if (!sub || sub.status !== 'active') { throw new Error('Abbonamento non attivo'); }

  return user._id;
};

const fetchProfileForPlan = async (ctx: ActionCtx) => {
  const profile = await ctx.runQuery(api.userProfiles.get, {});
  if (!profile) { throw new Error('Profilo non trovato'); }
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
  shoppingMap: Map<string, ShoppingEntry>,
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
  macros: MacroTarget,
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
  macros: MacroTarget,
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

    if (foods.length === 0) { throw new Error('Nessun alimento disponibile'); }

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
    if (!user) { return null; }

    const plan = await ctx.db.get(args.weeklyPlanId);
    if (!plan || plan.userId !== user._id) { return null; }

    const dailyPlans = await Promise.all(plan.dailyPlanIds.map((id) => ctx.db.get(id)));
    return { ...plan, dailyPlans: dailyPlans.filter(Boolean) };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) { return []; }

    return ctx.db
      .query('weeklyPlans')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect();
  },
});

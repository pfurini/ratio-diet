import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';

// eslint-disable-next-line import/no-relative-parent-imports
import type { Id } from '../_generated/dataModel';

// --- Zod schemas ---

export const mealItemSchema = z.object({
  foodName: z.string(),
  grams: z.number(),
});

export const dayPlanSchema = z.object({
  cena: z.array(mealItemSchema),
  colazione: z.array(mealItemSchema),
  day: z.string(),
  pranzo: z.array(mealItemSchema),
});

export const weeklyPlanSchema = z.object({
  days: z.array(dayPlanSchema).length(7),
});

// --- Types ---

export type MealItem = z.infer<typeof mealItemSchema>;
export type DayPlan = z.infer<typeof dayPlanSchema>;
export type WeeklyPlanResult = z.infer<typeof weeklyPlanSchema>;

export interface FoodDoc {
  _id: Id<'foods'>;
  name: string;
  category: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  allergenTags: string[];
}

export interface MacroTarget {
  calorieTarget: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  tdee: number;
}

export interface MacroSnapshot {
  calorieTarget: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

interface MacroAccumulator {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

// --- Food lookup ---

export const buildFoodLookupMap = (foods: FoodDoc[]): Map<string, FoodDoc> => {
  const map = new Map<string, FoodDoc>();
  for (const food of foods) {
    map.set(food.name.toLowerCase(), food);
  }
  return map;
};

export const findFood = (foodMap: Map<string, FoodDoc>, foodName: string): FoodDoc | undefined =>
  foodMap.get(foodName.toLowerCase());

// --- Macro calculation ---

const addItemToAccumulator = (acc: MacroAccumulator, item: MealItem, food: FoodDoc): void => {
  const ratio = item.grams / 100;
  acc.kcal += food.kcalPer100g * ratio;
  acc.protein += food.proteinPer100g * ratio;
  acc.carb += food.carbPer100g * ratio;
  acc.fat += food.fatPer100g * ratio;
};

export interface DayMacroResult {
  macros: MacroAccumulator;
  unknownFoods: string[];
}

const calcDayMacros = (day: DayPlan, foodMap: Map<string, FoodDoc>): DayMacroResult => {
  const allItems = [...day.colazione, ...day.pranzo, ...day.cena];
  const acc: MacroAccumulator = { carb: 0, fat: 0, kcal: 0, protein: 0 };
  const unknownFoods = new Set<string>();
  for (const item of allItems) {
    const food = findFood(foodMap, item.foodName);
    if (food) {
      addItemToAccumulator(acc, item, food);
    } else {
      unknownFoods.add(item.foodName);
    }
  }
  return { macros: acc, unknownFoods: [...unknownFoods] };
};

const TINY_ABSOLUTE = 0.01;

const isDayMacroValid = (macros: MacroAccumulator, target: MacroTarget): boolean => {
  const TOLERANCE = 0.05;

  const kcalOk =
    target.calorieTarget === 0
      ? Math.abs(macros.kcal) <= TINY_ABSOLUTE
      : Math.abs(macros.kcal - target.calorieTarget) / target.calorieTarget <= TOLERANCE;

  const proteinOk =
    target.proteinGrams === 0
      ? Math.abs(macros.protein) <= TINY_ABSOLUTE
      : Math.abs(macros.protein - target.proteinGrams) / target.proteinGrams <= TOLERANCE;

  const carbOk =
    target.carbGrams === 0
      ? Math.abs(macros.carb) <= TINY_ABSOLUTE
      : Math.abs(macros.carb - target.carbGrams) / target.carbGrams <= TOLERANCE;

  const fatOk =
    target.fatGrams === 0
      ? Math.abs(macros.fat) <= TINY_ABSOLUTE
      : Math.abs(macros.fat - target.fatGrams) / target.fatGrams <= TOLERANCE;

  return kcalOk && proteinOk && carbOk && fatOk;
};

const validateWeeklyPlan = (plan: WeeklyPlanResult, foodMap: Map<string, FoodDoc>, target: MacroTarget): boolean => {
  for (const day of plan.days) {
    const { macros, unknownFoods } = calcDayMacros(day, foodMap);
    if (unknownFoods.length > 0) {
      return false;
    }
    if (!isDayMacroValid(macros, target)) {
      return false;
    }
  }
  return true;
};

export const accToMacroSnapshot = (acc: MacroAccumulator): MacroSnapshot => ({
  calorieTarget: acc.kcal,
  carbGrams: acc.carb,
  fatGrams: acc.fat,
  proteinGrams: acc.protein,
});

export const calcItemsMacros = (items: MealItem[], foodMap: Map<string, FoodDoc>): MacroSnapshot => {
  const acc: MacroAccumulator = { carb: 0, fat: 0, kcal: 0, protein: 0 };
  for (const item of items) {
    const food = findFood(foodMap, item.foodName);
    if (food) {
      addItemToAccumulator(acc, item, food);
    }
  }
  return accToMacroSnapshot(acc);
};

// --- AI generation ---

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

const assertValidRetries = (maxRetries: number): void => {
  if (maxRetries <= 0) {
    throw new RangeError('maxRetries must be greater than 0');
  }
};

const runGenerationAttempt = async (
  prompt: string,
  foodMap: Map<string, FoodDoc>,
  macros: MacroTarget,
  attempt: number,
  maxRetries: number
): Promise<{ isValid: boolean; result: WeeklyPlanResult | null }> => {
  try {
    const result = await runAiGeneration(prompt);
    return { isValid: validateWeeklyPlan(result, foodMap, macros), result };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`generateWithRetry attempt ${attempt + 1}/${maxRetries} failed:`, msg);
    return { isValid: false, result: null };
  }
};

const runGenerationAttempts = async (
  prompt: string,
  foodMap: Map<string, FoodDoc>,
  macros: MacroTarget,
  maxRetries: number
): Promise<{ isValid: boolean; result: WeeklyPlanResult | null }> => {
  let lastResult: WeeklyPlanResult | null = null;
  let lastResultValid = false;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const attemptResult = await runGenerationAttempt(prompt, foodMap, macros, attempt, maxRetries);
    if (attemptResult.result) {
      lastResult = attemptResult.result;
      lastResultValid = attemptResult.isValid;
    }
    if (attemptResult.isValid && attemptResult.result) {
      return attemptResult;
    }
  }
  return { isValid: lastResultValid, result: lastResult };
};

export const generateWithRetry = async (
  prompt: string,
  foodMap: Map<string, FoodDoc>,
  macros: MacroTarget,
  maxRetries = 3
): Promise<WeeklyPlanResult> => {
  assertValidRetries(maxRetries);
  const { isValid, result } = await runGenerationAttempts(prompt, foodMap, macros, maxRetries);
  if (result === null || !isValid) {
    throw new Error(`Failed to generate weekly plan after ${maxRetries} attempts`);
  }
  return result;
};

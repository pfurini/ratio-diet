import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';

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
  tdee: number;
}

interface MacroAccumulator {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

// --- Food lookup ---

export const findFood = (foods: FoodDoc[], foodName: string): FoodDoc | undefined =>
  foods.find((f) => f.name.toLowerCase() === foodName.toLowerCase());

// --- Macro calculation ---

const addItemToAccumulator = (acc: MacroAccumulator, item: MealItem, food: FoodDoc): void => {
  const ratio = item.grams / 100;
  acc.kcal += food.kcalPer100g * ratio;
  acc.protein += food.proteinPer100g * ratio;
  acc.carb += food.carbPer100g * ratio;
  acc.fat += food.fatPer100g * ratio;
};

const calcDayMacros = (day: DayPlan, foods: FoodDoc[]): MacroAccumulator => {
  const allItems = [...day.colazione, ...day.pranzo, ...day.cena];
  const acc: MacroAccumulator = { carb: 0, fat: 0, kcal: 0, protein: 0 };
  for (const item of allItems) {
    const food = findFood(foods, item.foodName);
    if (food) { addItemToAccumulator(acc, item, food); }
  }
  return acc;
};

const isDayMacroValid = (
  macros: MacroAccumulator,
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

export const accToMacroSnapshot = (acc: MacroAccumulator): MacroSnapshot => ({
  calorieTarget: acc.kcal,
  carbGrams: acc.carb,
  fatGrams: acc.fat,
  proteinGrams: acc.protein,
  tdee: acc.kcal,
});

export const calcItemsMacros = (items: MealItem[], foods: FoodDoc[]): MacroSnapshot => {
  const acc: MacroAccumulator = { carb: 0, fat: 0, kcal: 0, protein: 0 };
  for (const item of items) {
    const food = findFood(foods, item.foodName);
    if (food) { addItemToAccumulator(acc, item, food); }
  }
  return accToMacroSnapshot(acc);
};

// --- AI generation ---

const getOpenRouterModel = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) { throw new Error('OPENROUTER_API_KEY is not set'); }
  const modelId = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-001';
  const openrouter = createOpenRouter({ apiKey });
  return openrouter(modelId);
};

const runAiGeneration = (prompt: string): Promise<WeeklyPlanResult> => {
  const model = getOpenRouterModel();
  return generateObject({ model, prompt, schema: weeklyPlanSchema }).then(({ object }) => object);
};

export const generateWithRetry = async (
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

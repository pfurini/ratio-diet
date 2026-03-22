import { v } from 'convex/values';

export const ALLERGEN_VALUES = [
  'glutine',
  'lattosio',
  'frutta_a_guscio',
  'uova',
  'crostacei',
  'pesce',
  'arachidi',
  'soia',
  'molluschi',
  'sedano',
  'senape',
  'sesamo',
  'solfiti',
  'lupini',
  'other',
] as const;

export type AllergenTag = (typeof ALLERGEN_VALUES)[number];

export const allergenValidator = v.union(...ALLERGEN_VALUES.map((a) => v.literal(a)));

export const FOOD_TYPE_VALUES = ['animale', 'vegetale', 'ittico'] as const;
export type FoodType = (typeof FOOD_TYPE_VALUES)[number];
export const foodTypeValidator = v.union(...FOOD_TYPE_VALUES.map((t) => v.literal(t)));

export const FOOD_CATEGORY_VALUES = [
  'carni',
  'cereali',
  'condimenti',
  'dolci',
  'frutta',
  'frutta_secca',
  'latticini',
  'legumi',
  'pesce',
  'salumi',
  'uova',
  'verdure',
] as const;

export type FoodCategory = (typeof FOOD_CATEGORY_VALUES)[number];

export const foodCategoryValidator = v.union(...FOOD_CATEGORY_VALUES.map((c) => v.literal(c)));

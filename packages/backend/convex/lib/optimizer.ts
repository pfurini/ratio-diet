type FoodId = string;

interface FoodNutrition {
  id: FoodId;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  kcalPer100g: number;
}

interface MacroTarget {
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

interface Constraint {
  min?: number;
  max?: number;
}

interface OptimizerInput {
  macroTarget: MacroTarget;
  foods: FoodNutrition[];
  constraints: Record<FoodId, Constraint>;
}

interface OptimizerResult {
  success: boolean;
  quantities: Record<FoodId, number>;
  macrosAchieved: MacroTarget & { kcal: number };
  gap?: { protein: number; carb: number; fat: number };
}

const DEFAULT_MAX_GRAMS = 500;
const MAX_ITERATIONS = 100;
const LEARNING_RATE = 0.5;
const GAP_THRESHOLD = 0.15;

const WEIGHTS = { protein: 1.0, carb: 0.8, fat: 0.8 };

export const optimizeMealQuantities = (input: OptimizerInput): OptimizerResult => {
  const { macroTarget, foods, constraints } = input;

  if (foods.length === 0) {
    return {
      success: false,
      quantities: {},
      macrosAchieved: { proteinGrams: 0, carbGrams: 0, fatGrams: 0, kcal: 0 },
      gap: { protein: 1, carb: 1, fat: 1 },
    };
  }

  const quantities = initializeQuantities(foods, constraints);
  runOptimizationLoop(foods, quantities, macroTarget, constraints);
  roundQuantities(quantities);

  const achieved = computeAchieved(foods, quantities);
  const gap = computeGap(macroTarget, achieved);
  const maxGap = Math.max(Math.abs(gap.protein), Math.abs(gap.carb), Math.abs(gap.fat));
  const isSuccess = isConvergedSuccess(maxGap, foods, macroTarget, constraints);

  return {
    success: isSuccess,
    quantities,
    macrosAchieved: achieved,
    gap: isSuccess ? undefined : gap,
  };
};

const isConvergedSuccess = (
  maxGap: number,
  foods: FoodNutrition[],
  macroTarget: MacroTarget,
  constraints: Record<FoodId, Constraint>,
): boolean => {
  if (maxGap <= GAP_THRESHOLD) return true;
  return isConstraintBound(foods, macroTarget, constraints);
};

const isConstraintBound = (
  foods: FoodNutrition[],
  macroTarget: MacroTarget,
  constraints: Record<FoodId, Constraint>,
): boolean => {
  const hasUserMax = foods.some((f) => constraints[f.id]?.max !== undefined);
  if (!hasUserMax) return false;
  const relaxedQuantities = initializeQuantities(foods, {});
  runOptimizationLoop(foods, relaxedQuantities, macroTarget, {});
  const relaxedAchieved = computeAchieved(foods, relaxedQuantities);
  const relaxedGap = computeGap(macroTarget, relaxedAchieved);
  const maxRelaxedGap = Math.max(
    Math.abs(relaxedGap.protein),
    Math.abs(relaxedGap.carb),
    Math.abs(relaxedGap.fat),
  );
  return maxRelaxedGap <= GAP_THRESHOLD;
};

const initializeQuantities = (
  foods: FoodNutrition[],
  constraints: Record<FoodId, Constraint>,
): Record<FoodId, number> => {
  const quantities: Record<FoodId, number> = {};
  for (const food of foods) {
    const min = constraints[food.id]?.min ?? 0;
    const max = constraints[food.id]?.max ?? DEFAULT_MAX_GRAMS;
    quantities[food.id] = Math.min(max, Math.max(min, 100));
  }
  return quantities;
};

const runOptimizationLoop = (
  foods: FoodNutrition[],
  quantities: Record<FoodId, number>,
  macroTarget: MacroTarget,
  constraints: Record<FoodId, Constraint>,
): void => {
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const achieved = computeAchieved(foods, quantities);
    const errors = computeErrors(macroTarget, achieved);
    const totalError = Math.abs(errors.protein) + Math.abs(errors.carb) + Math.abs(errors.fat);
    if (totalError < 1) break;
    adjustQuantities(foods, quantities, errors, constraints);
  }
};

const computeErrors = (
  target: MacroTarget,
  achieved: MacroTarget & { kcal: number },
): { protein: number; carb: number; fat: number } => ({
  protein: (target.proteinGrams - achieved.proteinGrams) * WEIGHTS.protein,
  carb: (target.carbGrams - achieved.carbGrams) * WEIGHTS.carb,
  fat: (target.fatGrams - achieved.fatGrams) * WEIGHTS.fat,
});

const adjustQuantities = (
  foods: FoodNutrition[],
  quantities: Record<FoodId, number>,
  errors: { protein: number; carb: number; fat: number },
  constraints: Record<FoodId, Constraint>,
): void => {
  for (const food of foods) {
    const min = constraints[food.id]?.min ?? 0;
    const max = constraints[food.id]?.max ?? DEFAULT_MAX_GRAMS;
    const gradient =
      errors.protein * (food.proteinPer100g / 100) +
      errors.carb * (food.carbPer100g / 100) +
      errors.fat * (food.fatPer100g / 100);
    const newQty = quantities[food.id] + gradient * LEARNING_RATE;
    quantities[food.id] = Math.min(max, Math.max(min, newQty));
  }
};

const roundQuantities = (quantities: Record<FoodId, number>): void => {
  for (const id of Object.keys(quantities)) {
    quantities[id] = Math.max(0, Math.round(quantities[id]));
  }
};

const computeAchieved = (
  foods: FoodNutrition[],
  quantities: Record<FoodId, number>,
): MacroTarget & { kcal: number } => {
  let proteinGrams = 0;
  let carbGrams = 0;
  let fatGrams = 0;
  let kcal = 0;

  for (const food of foods) {
    const qty = quantities[food.id] ?? 0;
    const factor = qty / 100;
    proteinGrams += food.proteinPer100g * factor;
    carbGrams += food.carbPer100g * factor;
    fatGrams += food.fatPer100g * factor;
    kcal += food.kcalPer100g * factor;
  }

  return { proteinGrams, carbGrams, fatGrams, kcal };
};

const computeGap = (
  target: MacroTarget,
  achieved: MacroTarget,
): { protein: number; carb: number; fat: number } => ({
  protein: target.proteinGrams > 0 ? (achieved.proteinGrams - target.proteinGrams) / target.proteinGrams : 0,
  carb: target.carbGrams > 0 ? (achieved.carbGrams - target.carbGrams) / target.carbGrams : 0,
  fat: target.fatGrams > 0 ? (achieved.fatGrams - target.fatGrams) / target.fatGrams : 0,
});

export const MEAL_DISTRIBUTION = {
  withoutSnacks: {
    colazione: 0.25,
    pranzo: 0.40,
    cena: 0.35,
  },
  withSnacks: {
    colazione: 0.20,
    spuntino_mattina: 0.10,
    pranzo: 0.35,
    spuntino_pomeriggio: 0.10,
    cena: 0.25,
  },
} as const;

export const distributeMacrosToMeals = (
  dailyMacros: MacroTarget,
  mealTypes: string[],
): Record<string, MacroTarget> => {
  const hasSnacks = mealTypes.some((t) => t.startsWith('spuntino'));
  const distribution = hasSnacks ? MEAL_DISTRIBUTION.withSnacks : MEAL_DISTRIBUTION.withoutSnacks;

  const result: Record<string, MacroTarget> = {};
  for (const mealType of mealTypes) {
    const factor = distribution[mealType as keyof typeof distribution] ?? 0;
    result[mealType] = {
      proteinGrams: dailyMacros.proteinGrams * factor,
      carbGrams: dailyMacros.carbGrams * factor,
      fatGrams: dailyMacros.fatGrams * factor,
    };
  }
  return result;
};

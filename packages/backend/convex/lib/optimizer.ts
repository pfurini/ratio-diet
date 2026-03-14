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

const WEIGHTS = { carb: 0.8, fat: 0.8, protein: 1 };

const EMPTY_RESULT: OptimizerResult = {
  gap: { carb: 1, fat: 1, protein: 1 },
  macrosAchieved: { carbGrams: 0, fatGrams: 0, kcal: 0, proteinGrams: 0 },
  quantities: {},
  success: false,
};

const buildResult = (
  quantities: Record<FoodId, number>,
  foods: FoodNutrition[],
  macroTarget: MacroTarget,
  constraints: Record<FoodId, Constraint>
): OptimizerResult => {
  const achieved = computeAchieved(foods, quantities);
  const gap = computeGap(macroTarget, achieved);
  const maxGap = Math.max(Math.abs(gap.protein), Math.abs(gap.carb), Math.abs(gap.fat));
  const success = isConvergedSuccess(maxGap, foods, macroTarget, constraints);
  return { gap: success ? undefined : gap, macrosAchieved: achieved, quantities, success };
};

export const optimizeMealQuantities = (input: OptimizerInput): OptimizerResult => {
  const { macroTarget, foods, constraints } = input;
  if (foods.length === 0) {
    return EMPTY_RESULT;
  }

  const quantities = initializeQuantities(foods, constraints);
  runOptimizationLoop(foods, quantities, macroTarget, constraints);
  roundQuantities(quantities);
  return buildResult(quantities, foods, macroTarget, constraints);
};

const isConvergedSuccess = (
  maxGap: number,
  foods: FoodNutrition[],
  macroTarget: MacroTarget,
  constraints: Record<FoodId, Constraint>
): boolean => {
  if (maxGap <= GAP_THRESHOLD) {
    return true;
  }
  return isConstraintBound(foods, macroTarget, constraints);
};

const isConstraintBound = (
  foods: FoodNutrition[],
  macroTarget: MacroTarget,
  constraints: Record<FoodId, Constraint>
): boolean => {
  const hasUserMax = foods.some((f) => constraints[f.id]?.max !== undefined);
  if (!hasUserMax) {
    return false;
  }
  const relaxedQuantities = initializeQuantities(foods, {});
  runOptimizationLoop(foods, relaxedQuantities, macroTarget, {});
  const relaxedAchieved = computeAchieved(foods, relaxedQuantities);
  const relaxedGap = computeGap(macroTarget, relaxedAchieved);
  const maxRelaxedGap = Math.max(Math.abs(relaxedGap.protein), Math.abs(relaxedGap.carb), Math.abs(relaxedGap.fat));
  return maxRelaxedGap <= GAP_THRESHOLD;
};

const initializeQuantities = (
  foods: FoodNutrition[],
  constraints: Record<FoodId, Constraint>
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
  constraints: Record<FoodId, Constraint>
): void => {
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const achieved = computeAchieved(foods, quantities);
    const errors = computeErrors(macroTarget, achieved);
    const totalError = Math.abs(errors.protein) + Math.abs(errors.carb) + Math.abs(errors.fat);
    if (totalError < 1) {
      break;
    }
    adjustQuantities(foods, quantities, errors, constraints);
  }
};

const computeErrors = (
  target: MacroTarget,
  achieved: MacroTarget & { kcal: number }
): { protein: number; carb: number; fat: number } => ({
  carb: (target.carbGrams - achieved.carbGrams) * WEIGHTS.carb,
  fat: (target.fatGrams - achieved.fatGrams) * WEIGHTS.fat,
  protein: (target.proteinGrams - achieved.proteinGrams) * WEIGHTS.protein,
});

const adjustQuantities = (
  foods: FoodNutrition[],
  quantities: Record<FoodId, number>,
  errors: { protein: number; carb: number; fat: number },
  constraints: Record<FoodId, Constraint>
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

const addFoodMacros = (
  acc: { proteinGrams: number; carbGrams: number; fatGrams: number; kcal: number },
  food: FoodNutrition,
  factor: number
) => {
  acc.proteinGrams += food.proteinPer100g * factor;
  acc.carbGrams += food.carbPer100g * factor;
  acc.fatGrams += food.fatPer100g * factor;
  acc.kcal += food.kcalPer100g * factor;
};

const computeAchieved = (
  foods: FoodNutrition[],
  quantities: Record<FoodId, number>
): MacroTarget & { kcal: number } => {
  const acc = { carbGrams: 0, fatGrams: 0, kcal: 0, proteinGrams: 0 };
  for (const food of foods) {
    addFoodMacros(acc, food, (quantities[food.id] ?? 0) / 100);
  }
  return acc;
};

const computeGap = (target: MacroTarget, achieved: MacroTarget): { protein: number; carb: number; fat: number } => ({
  carb: target.carbGrams > 0 ? (achieved.carbGrams - target.carbGrams) / target.carbGrams : 0,
  fat: target.fatGrams > 0 ? (achieved.fatGrams - target.fatGrams) / target.fatGrams : 0,
  protein: target.proteinGrams > 0 ? (achieved.proteinGrams - target.proteinGrams) / target.proteinGrams : 0,
});

export const MEAL_DISTRIBUTION = {
  withSnacks: {
    cena: 0.25,
    colazione: 0.2,
    pranzo: 0.35,
    spuntino_mattina: 0.1,
    spuntino_pomeriggio: 0.1,
  },
  withoutSnacks: {
    cena: 0.35,
    colazione: 0.25,
    pranzo: 0.4,
  },
} as const;

export const distributeMacrosToMeals = (dailyMacros: MacroTarget, mealTypes: string[]): Record<string, MacroTarget> => {
  const hasSnacks = mealTypes.some((t) => t.startsWith('spuntino'));
  const distribution = hasSnacks ? MEAL_DISTRIBUTION.withSnacks : MEAL_DISTRIBUTION.withoutSnacks;

  const result: Record<string, MacroTarget> = {};
  for (const mealType of mealTypes) {
    const factor = distribution[mealType as keyof typeof distribution] ?? 0;
    result[mealType] = {
      carbGrams: dailyMacros.carbGrams * factor,
      fatGrams: dailyMacros.fatGrams * factor,
      proteinGrams: dailyMacros.proteinGrams * factor,
    };
  }
  return result;
};

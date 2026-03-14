type Sex = 'M' | 'F';
type BodyBuild = 'snello' | 'medio' | 'robusto';
type Goal = 'dimagrimento' | 'mantenimento' | 'aumento_massa' | 'ricomposizione';
type ActivityLevel = 'sedentario' | 'leggermente_attivo' | 'moderatamente_attivo' | 'molto_attivo' | 'atleta';

interface CalculationInput {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  bodyBuild: BodyBuild;
  goal: Goal;
  activityLevel: ActivityLevel;
}

interface MacroResult {
  tdee: number;
  calorieTarget: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  leggermente_attivo: 1.375,
  moderatamente_attivo: 1.55,
  molto_attivo: 1.725,
  atleta: 1.9,
};

const BODY_BUILD_FACTORS: Record<BodyBuild, number> = {
  snello: 0.95,
  medio: 1.0,
  robusto: 1.05,
};

const CALORIE_ADJUSTMENTS: Record<Goal, number> = {
  dimagrimento: -500,
  mantenimento: 0,
  aumento_massa: 300,
  ricomposizione: -150,
};

const MACRO_RATIOS: Record<Goal, { proteinPerKg: number; fatPerKg: number }> = {
  dimagrimento: { proteinPerKg: 2.0, fatPerKg: 0.8 },
  mantenimento: { proteinPerKg: 1.6, fatPerKg: 1.0 },
  aumento_massa: { proteinPerKg: 2.0, fatPerKg: 0.8 },
  ricomposizione: { proteinPerKg: 2.4, fatPerKg: 0.9 },
};

const computeBaseBmr = (sex: Sex, weightKg: number, heightCm: number, ageYears: number): number => {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'M' ? base + 5 : base - 161;
};

const computeMacros = (
  goal: Goal,
  weightKg: number,
  calorieTarget: number,
): { proteinGrams: number; fatGrams: number; carbGrams: number } => {
  const { proteinPerKg, fatPerKg } = MACRO_RATIOS[goal];
  const proteinGrams = proteinPerKg * weightKg;
  const fatGrams = fatPerKg * weightKg;
  const proteinKcal = proteinGrams * 4;
  const fatKcal = fatGrams * 9;
  const remainingKcal = calorieTarget - proteinKcal - fatKcal;
  const carbGrams = Math.max(0, remainingKcal / 4);
  return { proteinGrams, fatGrams, carbGrams };
};

export const calculateMacros = (input: CalculationInput): MacroResult => {
  const { sex, ageYears, heightCm, weightKg, bodyBuild, goal, activityLevel } = input;
  const baseBmr = computeBaseBmr(sex, weightKg, heightCm, ageYears);
  const bmr = baseBmr * BODY_BUILD_FACTORS[bodyBuild];
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);
  const calorieTarget = tdee + CALORIE_ADJUSTMENTS[goal];
  const { proteinGrams, fatGrams, carbGrams } = computeMacros(goal, weightKg, calorieTarget);
  return { tdee, calorieTarget, proteinGrams, carbGrams, fatGrams };
};

export const getAgeFromDateOfBirth = (dateOfBirth: string): number => {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  const dayDiff = today.getDate() - birth.getDate();
  const birthdayNotYetReached = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0);
  if (birthdayNotYetReached) {
    age--;
  }
  return age;
};

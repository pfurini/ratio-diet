/** Target macros as stored on the user profile. */
export interface MacroTarget {
  tdee: number;
  calorieTarget: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

/** Achieved macros recorded against a daily plan. */
export interface MacroAchieved {
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  achievedCalories?: number;
  calorieTarget?: number;
  tdee?: number;
}

/** Flat macro snapshot used by PlanMacroSummary (calories field). */
export interface MacroSummary {
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  calories: number;
}

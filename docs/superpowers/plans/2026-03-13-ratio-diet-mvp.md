# Ratio Diet MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Ratio Diet MVP — an Italian nutrition PWA where users input their data, get personalized macro targets, select foods to get optimized quantities, and optionally subscribe to AI-generated weekly meal plans with shopping lists.

**Architecture:** Turborepo monorepo with Next.js 16 PWA (`apps/web`) for the frontend and Convex (`packages/backend`) for all backend logic. Better Auth handles authentication (already configured). Stripe manages subscriptions. Vercel AI SDK + OpenRouter powers weekly plan generation. CREA food database seeded as static Convex data.

**Tech Stack:** Next.js 16, Convex, Better Auth, Stripe, Vercel AI SDK, @openrouter/ai-sdk-provider, Tailwind v4, shadcn/ui, TanStack Form, Zod

**Spec:** `docs/superpowers/specs/2026-03-13-ratio-diet-design.md`

---

## Implementation Notes (from plan review)

The following items were flagged during plan review and must be addressed during implementation:

1. **Vitest setup required**: Before running any tests (Tasks 3-4), install vitest in `packages/backend`: `pnpm add -D vitest` and add a `vitest.config.ts`. This is not shown in the task steps but is a prerequisite.
2. **All `git add` commands must use specific file paths**, not `git add -A`. Always include `pnpm-lock.yaml` when dependencies change.
3. **Date format convention**: All date strings (`dateOfBirth`, `date`, `weekStartDate`) use ISO 8601 format `YYYY-MM-DD`. Weight log dates should be provided by the client (not server UTC) to avoid timezone issues for Italian users.
4. **Macro rounding**: The calculation engine returns unrounded floats. Round to nearest integer at the display layer in frontend components.
5. **Onboarding check in (user) layout**: The auth guard in `(user)/layout.tsx` should also check if the user profile exists and redirect to `/onboarding` if missing — not just the dashboard page.
6. **TDEE explanation**: The dashboard should include brief explanatory text about what TDEE and macros mean, as per spec section 2.1 step 4 ("con spiegazione").
7. **Stripe module-scope instantiation**: Instantiate Stripe client inside each handler, not at module scope, to avoid crashes when env vars are missing.
8. **Print CSS**: Add `@media print` styles for weekly plan and shopping list export.
9. **Service worker**: Use `@serwist/next` or equivalent to add basic offline caching to the PWA. This is covered in Task 14 but needs a concrete implementation step added during execution.
10. **Max 500 lines per file**: All source files must stay under 500 lines. Split into focused sub-modules when approaching this limit.
11. **Max 10 statements per function**: Every function block must have ≤10 statements (ESLint `max-statements`). Extract helpers and compose smaller functions. Backend handlers with many steps (e.g., `weeklyPlans.generate`, `dailyPlans.optimize`) must be decomposed into focused helper functions that the handler orchestrates.
12. **Backend handler decomposition**: Convex functions like `foods.search`, `dailyPlans.optimize`, `weeklyPlans.generate`, and `subscriptions.createCheckoutSession` contain >10 statements in the plan code. During implementation, extract the logic into helper functions (e.g., `filterFoodsByAccess`, `buildOptimizedMeals`, `buildShoppingList`) called by the handler.

---

## Chunk 1: Foundation — Schema, Calculation Engine, Food Database

### Task 1: Clean up existing placeholder code

**Files:**
- Delete: `packages/backend/convex/todos.ts`
- Delete: `packages/backend/convex/chat.ts`
- Delete: `packages/backend/convex/agent.ts`
- Delete: `packages/backend/convex/privateData.ts`
- Modify: `packages/backend/convex/schema.ts`
- Modify: `packages/backend/convex/convex.config.ts`
- Modify: `packages/backend/package.json`

- [ ] **Step 1: Delete placeholder Convex functions**

Remove files that are part of the starter template and not needed:
- `packages/backend/convex/todos.ts`
- `packages/backend/convex/chat.ts`
- `packages/backend/convex/agent.ts`
- `packages/backend/convex/privateData.ts`

- [ ] **Step 2: Remove agent component from convex.config.ts**

Update `packages/backend/convex/convex.config.ts` to remove the agent import and usage:

```ts
import betterAuth from '@convex-dev/better-auth/convex.config';
import { defineApp } from 'convex/server';

const app = defineApp();
app.use(betterAuth);

export default app;
```

- [ ] **Step 3: Remove @convex-dev/agent and @ai-sdk/google from package.json**

Remove `@convex-dev/agent` and `@ai-sdk/google` from `packages/backend/package.json` dependencies. Add `@openrouter/ai-sdk-provider`.

Run: `cd /workspace/packages/backend && pnpm remove @convex-dev/agent @ai-sdk/google && pnpm add @openrouter/ai-sdk-provider`

- [ ] **Step 4: Clear the schema**

Update `packages/backend/convex/schema.ts` to an empty schema (we'll build it in the next task):

```ts
import { defineSchema } from 'convex/server';

export default defineSchema({});
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/todos.ts packages/backend/convex/chat.ts packages/backend/convex/agent.ts packages/backend/convex/privateData.ts packages/backend/convex/convex.config.ts packages/backend/convex/schema.ts packages/backend/package.json pnpm-lock.yaml
git commit -m "chore: remove starter template placeholders and configure OpenRouter provider"
```

---

### Task 2: Define Convex schema

**Files:**
- Create: `packages/backend/convex/schema.ts`

- [ ] **Step 1: Write the full schema**

```ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const mealItemValidator = v.object({
  foodId: v.id('foods'),
  quantityGrams: v.number(),
  constraintMin: v.optional(v.number()),
  constraintMax: v.optional(v.number()),
});

const mealValidator = v.object({
  type: v.union(
    v.literal('colazione'),
    v.literal('pranzo'),
    v.literal('cena'),
    v.literal('spuntino_mattina'),
    v.literal('spuntino_pomeriggio'),
  ),
  items: v.array(mealItemValidator),
});

const macroSnapshotValidator = v.object({
  tdee: v.number(),
  calorieTarget: v.number(),
  proteinGrams: v.number(),
  carbGrams: v.number(),
  fatGrams: v.number(),
});

export default defineSchema({
  userProfiles: defineTable({
    userId: v.string(),
    sex: v.union(v.literal('M'), v.literal('F')),
    dateOfBirth: v.string(),
    heightCm: v.number(),
    weightKg: v.number(),
    bodyBuild: v.union(v.literal('snello'), v.literal('medio'), v.literal('robusto')),
    goal: v.union(
      v.literal('dimagrimento'),
      v.literal('mantenimento'),
      v.literal('aumento_massa'),
      v.literal('ricomposizione'),
    ),
    activityLevel: v.union(
      v.literal('sedentario'),
      v.literal('leggermente_attivo'),
      v.literal('moderatamente_attivo'),
      v.literal('molto_attivo'),
      v.literal('atleta'),
    ),
    allergies: v.array(v.string()),
    allergiesOther: v.optional(v.string()),
    dietaryPreference: v.union(
      v.literal('onnivoro'),
      v.literal('vegetariano'),
      v.literal('vegano'),
      v.literal('pescetariano'),
    ),
    followedByNutritionist: v.boolean(),
    legalGateAccepted: v.boolean(),
    macros: macroSnapshotValidator,
    lastRecalcWeightKg: v.number(),
  })
    .index('by_userId', ['userId']),

  foods: defineTable({
    name: v.string(),
    category: v.string(),
    kcalPer100g: v.number(),
    proteinPer100g: v.number(),
    carbPer100g: v.number(),
    fatPer100g: v.number(),
    allergenTags: v.array(v.string()),
    foodType: v.union(v.literal('animale'), v.literal('vegetale')),
    source: v.union(v.literal('crea'), v.literal('custom')),
    userId: v.optional(v.string()),
  })
    .index('by_source', ['source'])
    .index('by_userId', ['userId'])
    .index('by_category', ['category'])
    .searchIndex('search_name', { searchField: 'name', filterFields: ['source', 'userId', 'category'] }),

  dailyPlans: defineTable({
    userId: v.string(),
    date: v.string(),
    status: v.union(v.literal('draft'), v.literal('complete')),
    meals: v.array(mealValidator),
    macrosAchieved: macroSnapshotValidator,
    macrosTarget: macroSnapshotValidator,
    templateId: v.optional(v.id('templates')),
  })
    .index('by_userId_date', ['userId', 'date']),

  templates: defineTable({
    userId: v.string(),
    name: v.string(),
    meals: v.array(mealValidator),
  })
    .index('by_userId', ['userId']),

  weeklyPlans: defineTable({
    userId: v.string(),
    weekStartDate: v.string(),
    dailyPlanIds: v.array(v.id('dailyPlans')),
    shoppingList: v.array(
      v.object({
        foodId: v.id('foods'),
        name: v.string(),
        totalGrams: v.number(),
        category: v.string(),
      }),
    ),
    status: v.union(v.literal('generato'), v.literal('modificato'), v.literal('archiviato')),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_week', ['userId', 'weekStartDate']),

  weightLogs: defineTable({
    userId: v.string(),
    date: v.string(),
    weightKg: v.number(),
    macrosAtLog: macroSnapshotValidator,
  })
    .index('by_userId_date', ['userId', 'date']),

  subscriptions: defineTable({
    userId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    status: v.union(v.literal('active'), v.literal('cancelled'), v.literal('past_due')),
    startDate: v.string(),
    nextRenewalDate: v.string(),
  })
    .index('by_userId', ['userId'])
    .index('by_stripeSubscriptionId', ['stripeSubscriptionId']),
});
```

- [ ] **Step 2: Verify schema compiles**

Run: `cd /workspace/packages/backend && npx convex dev --once --typecheck=disable`
Expected: Schema should be accepted without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/convex/schema.ts
git commit -m "feat: define complete Convex schema for Ratio Diet"
```

---

### Task 3: Build the calculation engine

**Files:**
- Create: `packages/backend/convex/lib/calculations.ts`
- Create: `packages/backend/convex/lib/calculations.test.ts`

- [ ] **Step 1: Write tests for the TDEE and macro calculation**

Create `packages/backend/convex/lib/calculations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { calculateMacros } from './calculations';

describe('calculateMacros', () => {
  it('calculates correctly for a 30yo male, 80kg, 180cm, moderately active, maintenance', () => {
    const result = calculateMacros({
      sex: 'M',
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      bodyBuild: 'medio',
      goal: 'mantenimento',
      activityLevel: 'moderatamente_attivo',
    });

    // BMR = (10*80) + (6.25*180) - (5*30) + 5 = 800 + 1125 - 150 + 5 = 1780
    // Corporatura medio = 1.0, so BMR stays 1780
    // TDEE = 1780 * 1.55 = 2759
    // Mantenimento: calorie target = 2759
    // Proteine: 1.6 * 80 = 128g (512 kcal)
    // Grassi: 1.0 * 80 = 80g (720 kcal)
    // Carbo: (2759 - 512 - 720) / 4 = 381.75g
    expect(result.tdee).toBe(2759);
    expect(result.calorieTarget).toBe(2759);
    expect(result.proteinGrams).toBe(128);
    expect(result.fatGrams).toBe(80);
    expect(result.carbGrams).toBeCloseTo(381.75, 0);
  });

  it('calculates correctly for a 45yo female, 65kg, 165cm, sedentary, dimagrimento', () => {
    const result = calculateMacros({
      sex: 'F',
      ageYears: 45,
      heightCm: 165,
      weightKg: 65,
      bodyBuild: 'snello',
      goal: 'dimagrimento',
      activityLevel: 'sedentario',
    });

    // BMR = (10*65) + (6.25*165) - (5*45) - 161 = 650 + 1031.25 - 225 - 161 = 1295.25
    // Corporatura snello = 0.95: 1295.25 * 0.95 = 1230.4875
    // TDEE = 1230.4875 * 1.2 = 1476.585 → round to 1477
    // Dimagrimento: 1477 - 500 = 977
    // Proteine: 2.0 * 65 = 130g (520 kcal)
    // Grassi: 0.8 * 65 = 52g (468 kcal)
    // Carbo: (977 - 520 - 468) / 4 = -2.75 → floored to 0
    expect(result.tdee).toBe(1477);
    expect(result.calorieTarget).toBe(977);
    expect(result.proteinGrams).toBe(130);
    expect(result.fatGrams).toBe(52);
    expect(result.carbGrams).toBe(0);
  });

  it('applies ricomposizione adjustments', () => {
    const result = calculateMacros({
      sex: 'M',
      ageYears: 35,
      heightCm: 175,
      weightKg: 85,
      bodyBuild: 'robusto',
      goal: 'ricomposizione',
      activityLevel: 'molto_attivo',
    });

    // Proteine should be 2.4 g/kg for ricomposizione
    expect(result.proteinGrams).toBe(204);
    // Grassi should be 0.9 g/kg
    expect(result.fatGrams).toBe(76.5);
    // Calorie target = TDEE - 150
    expect(result.calorieTarget).toBe(result.tdee - 150);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `cd /workspace/packages/backend && npx vitest run convex/lib/calculations.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the calculation engine**

Create `packages/backend/convex/lib/calculations.ts`:

```ts
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

export const calculateMacros = (input: CalculationInput): MacroResult => {
  const { sex, ageYears, heightCm, weightKg, bodyBuild, goal, activityLevel } = input;

  // Step 1: BMR (Mifflin-St Jeor)
  const baseBmr =
    sex === 'M'
      ? 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;

  // Step 1b: Body build adjustment
  const bmr = baseBmr * BODY_BUILD_FACTORS[bodyBuild];

  // Step 2: TDEE
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);

  // Step 3: Calorie target
  const calorieTarget = tdee + CALORIE_ADJUSTMENTS[goal];

  // Step 4: Macro split
  const { proteinPerKg, fatPerKg } = MACRO_RATIOS[goal];
  const proteinGrams = proteinPerKg * weightKg;
  const fatGrams = fatPerKg * weightKg;

  const proteinKcal = proteinGrams * 4;
  const fatKcal = fatGrams * 9;
  const remainingKcal = calorieTarget - proteinKcal - fatKcal;
  const carbGrams = Math.max(0, remainingKcal / 4);

  return {
    tdee,
    calorieTarget,
    proteinGrams,
    carbGrams,
    fatGrams,
  };
};

export const getAgeFromDateOfBirth = (dateOfBirth: string): number => {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /workspace/packages/backend && npx vitest run convex/lib/calculations.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/lib/calculations.ts packages/backend/convex/lib/calculations.test.ts
git commit -m "feat: implement TDEE and macro calculation engine with tests"
```

---

### Task 4: Build the meal optimizer

**Files:**
- Create: `packages/backend/convex/lib/optimizer.ts`
- Create: `packages/backend/convex/lib/optimizer.test.ts`

- [ ] **Step 1: Write tests for the optimizer**

Create `packages/backend/convex/lib/optimizer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { optimizeMealQuantities } from './optimizer';

describe('optimizeMealQuantities', () => {
  const chickenBreast = {
    id: 'food_1' as any,
    proteinPer100g: 31,
    carbPer100g: 0,
    fatPer100g: 3.6,
    kcalPer100g: 165,
  };

  const rice = {
    id: 'food_2' as any,
    proteinPer100g: 2.7,
    carbPer100g: 28,
    fatPer100g: 0.3,
    kcalPer100g: 130,
  };

  const oliveOil = {
    id: 'food_3' as any,
    proteinPer100g: 0,
    carbPer100g: 0,
    fatPer100g: 100,
    kcalPer100g: 884,
  };

  it('calculates reasonable quantities for a balanced meal', () => {
    const result = optimizeMealQuantities({
      macroTarget: { proteinGrams: 50, carbGrams: 70, fatGrams: 20 },
      foods: [chickenBreast, rice, oliveOil],
      constraints: {},
    });

    expect(result.success).toBe(true);
    // Chicken should provide most protein
    expect(result.quantities[chickenBreast.id]).toBeGreaterThan(100);
    // Rice should provide most carbs
    expect(result.quantities[rice.id]).toBeGreaterThan(200);
    // Olive oil should be small amount for fat
    expect(result.quantities[oliveOil.id]).toBeLessThan(30);
    // All quantities should be non-negative
    for (const qty of Object.values(result.quantities)) {
      expect(qty).toBeGreaterThanOrEqual(0);
    }
  });

  it('respects max constraints', () => {
    const result = optimizeMealQuantities({
      macroTarget: { proteinGrams: 50, carbGrams: 70, fatGrams: 20 },
      foods: [chickenBreast, rice, oliveOil],
      constraints: { [chickenBreast.id]: { max: 100 } },
    });

    expect(result.success).toBe(true);
    expect(result.quantities[chickenBreast.id]).toBeLessThanOrEqual(100);
  });

  it('respects min constraints', () => {
    const result = optimizeMealQuantities({
      macroTarget: { proteinGrams: 50, carbGrams: 70, fatGrams: 20 },
      foods: [chickenBreast, rice, oliveOil],
      constraints: { [rice.id]: { min: 150 } },
    });

    expect(result.success).toBe(true);
    expect(result.quantities[rice.id]).toBeGreaterThanOrEqual(150);
  });

  it('caps individual foods at 500g by default', () => {
    const result = optimizeMealQuantities({
      macroTarget: { proteinGrams: 200, carbGrams: 10, fatGrams: 10 },
      foods: [chickenBreast],
      constraints: {},
    });

    expect(result.quantities[chickenBreast.id]).toBeLessThanOrEqual(500);
  });

  it('returns success false when macro gap exceeds 15%', () => {
    const result = optimizeMealQuantities({
      macroTarget: { proteinGrams: 100, carbGrams: 100, fatGrams: 100 },
      foods: [oliveOil], // only fat source, no protein or carbs
      constraints: {},
    });

    expect(result.success).toBe(false);
    expect(result.gap).toBeDefined();
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `cd /workspace/packages/backend && npx vitest run convex/lib/optimizer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the optimizer**

Create `packages/backend/convex/lib/optimizer.ts`:

```ts
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

// Weights: protein accuracy is prioritized
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

  // Initialize quantities — start with equal share, respecting constraints
  const quantities: Record<FoodId, number> = {};
  for (const food of foods) {
    const min = constraints[food.id]?.min ?? 0;
    const max = constraints[food.id]?.max ?? DEFAULT_MAX_GRAMS;
    quantities[food.id] = Math.min(max, Math.max(min, 100));
  }

  // Iterative weighted least-squares optimization
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const achieved = computeAchieved(foods, quantities);

    const errors = {
      protein: (macroTarget.proteinGrams - achieved.proteinGrams) * WEIGHTS.protein,
      carb: (macroTarget.carbGrams - achieved.carbGrams) * WEIGHTS.carb,
      fat: (macroTarget.fatGrams - achieved.fatGrams) * WEIGHTS.fat,
    };

    const totalError = Math.abs(errors.protein) + Math.abs(errors.carb) + Math.abs(errors.fat);
    if (totalError < 1) break; // converged

    // Adjust each food proportionally to how well it addresses the error
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
  }

  // Round to nearest gram
  for (const id of Object.keys(quantities)) {
    quantities[id] = Math.max(0, Math.round(quantities[id]));
  }

  const achieved = computeAchieved(foods, quantities);
  const gap = computeGap(macroTarget, achieved);
  const maxGap = Math.max(Math.abs(gap.protein), Math.abs(gap.carb), Math.abs(gap.fat));

  return {
    success: maxGap <= GAP_THRESHOLD,
    quantities,
    macrosAchieved: achieved,
    gap: maxGap > GAP_THRESHOLD ? gap : undefined,
  };
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /workspace/packages/backend && npx vitest run convex/lib/optimizer.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/lib/optimizer.ts packages/backend/convex/lib/optimizer.test.ts
git commit -m "feat: implement weighted least-squares meal optimizer with tests"
```

---

### Task 5: Prepare CREA food database seed

**Files:**
- Create: `packages/backend/data/crea-foods.json` (sample structure — full data to be sourced separately)
- Create: `packages/backend/convex/foods.ts`

- [ ] **Step 1: Create a sample CREA data file with representative entries**

Create `packages/backend/data/crea-foods.json` with a representative sample (~20 foods across categories). The full ~900 entry dataset will be sourced from the CREA public database and imported in the same format.

```json
[
  {
    "name": "Petto di pollo",
    "category": "carni",
    "kcalPer100g": 165,
    "proteinPer100g": 31,
    "carbPer100g": 0,
    "fatPer100g": 3.6,
    "allergenTags": [],
    "foodType": "animale"
  },
  {
    "name": "Riso bianco",
    "category": "cereali",
    "kcalPer100g": 130,
    "proteinPer100g": 2.7,
    "carbPer100g": 28,
    "fatPer100g": 0.3,
    "allergenTags": [],
    "foodType": "vegetale"
  },
  {
    "name": "Pasta di semola",
    "category": "cereali",
    "kcalPer100g": 353,
    "proteinPer100g": 12.5,
    "carbPer100g": 72,
    "fatPer100g": 1.5,
    "allergenTags": ["glutine"],
    "foodType": "vegetale"
  },
  {
    "name": "Uovo intero",
    "category": "uova",
    "kcalPer100g": 143,
    "proteinPer100g": 12.4,
    "carbPer100g": 0.7,
    "fatPer100g": 9.5,
    "allergenTags": ["uova"],
    "foodType": "animale"
  },
  {
    "name": "Mozzarella",
    "category": "latticini",
    "kcalPer100g": 280,
    "proteinPer100g": 22.2,
    "carbPer100g": 2.2,
    "fatPer100g": 20.3,
    "allergenTags": ["lattosio"],
    "foodType": "animale"
  },
  {
    "name": "Tonno sott'olio sgocciolato",
    "category": "pesce",
    "kcalPer100g": 198,
    "proteinPer100g": 29.1,
    "carbPer100g": 0,
    "fatPer100g": 8.1,
    "allergenTags": [],
    "foodType": "animale"
  },
  {
    "name": "Olio extravergine di oliva",
    "category": "condimenti",
    "kcalPer100g": 884,
    "proteinPer100g": 0,
    "carbPer100g": 0,
    "fatPer100g": 100,
    "allergenTags": [],
    "foodType": "vegetale"
  },
  {
    "name": "Pane integrale",
    "category": "cereali",
    "kcalPer100g": 243,
    "proteinPer100g": 7.5,
    "carbPer100g": 44,
    "fatPer100g": 3.5,
    "allergenTags": ["glutine"],
    "foodType": "vegetale"
  },
  {
    "name": "Banana",
    "category": "frutta",
    "kcalPer100g": 89,
    "proteinPer100g": 1.1,
    "carbPer100g": 23,
    "fatPer100g": 0.3,
    "allergenTags": [],
    "foodType": "vegetale"
  },
  {
    "name": "Prosciutto crudo",
    "category": "salumi",
    "kcalPer100g": 224,
    "proteinPer100g": 28,
    "carbPer100g": 0,
    "fatPer100g": 12,
    "allergenTags": [],
    "foodType": "animale"
  },
  {
    "name": "Lenticchie secche",
    "category": "legumi",
    "kcalPer100g": 325,
    "proteinPer100g": 25,
    "carbPer100g": 54,
    "fatPer100g": 1,
    "allergenTags": [],
    "foodType": "vegetale"
  },
  {
    "name": "Salmone fresco",
    "category": "pesce",
    "kcalPer100g": 208,
    "proteinPer100g": 20,
    "carbPer100g": 0,
    "fatPer100g": 13,
    "allergenTags": [],
    "foodType": "animale"
  },
  {
    "name": "Yogurt greco 0%",
    "category": "latticini",
    "kcalPer100g": 59,
    "proteinPer100g": 10,
    "carbPer100g": 3.6,
    "fatPer100g": 0.7,
    "allergenTags": ["lattosio"],
    "foodType": "animale"
  },
  {
    "name": "Patate",
    "category": "verdure",
    "kcalPer100g": 77,
    "proteinPer100g": 2,
    "carbPer100g": 17,
    "fatPer100g": 0.1,
    "allergenTags": [],
    "foodType": "vegetale"
  },
  {
    "name": "Pomodori",
    "category": "verdure",
    "kcalPer100g": 18,
    "proteinPer100g": 0.9,
    "carbPer100g": 3.9,
    "fatPer100g": 0.2,
    "allergenTags": [],
    "foodType": "vegetale"
  },
  {
    "name": "Mandorle",
    "category": "frutta_secca",
    "kcalPer100g": 575,
    "proteinPer100g": 21,
    "carbPer100g": 22,
    "fatPer100g": 49,
    "allergenTags": ["frutta_a_guscio"],
    "foodType": "vegetale"
  },
  {
    "name": "Marmellata di frutta",
    "category": "dolci",
    "kcalPer100g": 250,
    "proteinPer100g": 0.5,
    "carbPer100g": 60,
    "fatPer100g": 0.1,
    "allergenTags": [],
    "foodType": "vegetale"
  },
  {
    "name": "Crackers",
    "category": "cereali",
    "kcalPer100g": 428,
    "proteinPer100g": 9.5,
    "carbPer100g": 72,
    "fatPer100g": 11.5,
    "allergenTags": ["glutine"],
    "foodType": "vegetale"
  },
  {
    "name": "Bresaola",
    "category": "salumi",
    "kcalPer100g": 151,
    "proteinPer100g": 33,
    "carbPer100g": 0,
    "fatPer100g": 2.6,
    "allergenTags": [],
    "foodType": "animale"
  },
  {
    "name": "Ricotta vaccina",
    "category": "latticini",
    "kcalPer100g": 146,
    "proteinPer100g": 11.2,
    "carbPer100g": 3.5,
    "fatPer100g": 10.1,
    "allergenTags": ["lattosio"],
    "foodType": "animale"
  }
]
```

- [ ] **Step 2: Write the foods Convex module with seed and query functions**

Create `packages/backend/convex/foods.ts`:

```ts
import { v } from 'convex/values';

import { internalMutation, query } from './_generated/server';
import { authComponent } from './auth';

export const seedCREA = internalMutation({
  args: {
    foods: v.array(
      v.object({
        name: v.string(),
        category: v.string(),
        kcalPer100g: v.number(),
        proteinPer100g: v.number(),
        carbPer100g: v.number(),
        fatPer100g: v.number(),
        allergenTags: v.array(v.string()),
        foodType: v.union(v.literal('animale'), v.literal('vegetale')),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const food of args.foods) {
      await ctx.db.insert('foods', {
        ...food,
        source: 'crea',
        userId: undefined,
      });
    }
  },
});

export const search = query({
  args: {
    searchTerm: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);

    if (args.searchTerm) {
      let searchQuery = ctx.db
        .query('foods')
        .withSearchIndex('search_name', (q) => {
          let search = q.search('name', args.searchTerm!);
          if (args.category) {
            search = search.eq('category', args.category);
          }
          return search;
        });

      const results = await searchQuery.collect();

      // Filter: CREA foods + current user's custom foods, excluding allergens
      const userProfile = user
        ? await ctx.db.query('userProfiles').withIndex('by_userId', (q) => q.eq('userId', user.user.id)).unique()
        : null;
      const userAllergens = userProfile?.allergies ?? [];

      return results.filter((f) => {
        const isAccessible = f.source === 'crea' || (f.source === 'custom' && user && f.userId === user.user.id);
        if (!isAccessible) return false;
        // Hard filter: hide foods containing user's allergens
        if (userAllergens.length > 0 && f.allergenTags.some((tag) => userAllergens.includes(tag))) return false;
        // Hard filter: dietary preference (category-based)
        const dietPref = userProfile?.dietaryPreference ?? 'onnivoro';
        return filterByDietaryPreference(f, dietPref);
      });
    }

    // Browse by category
    if (args.category) {
      const results = await ctx.db
        .query('foods')
        .withIndex('by_category', (q) => q.eq('category', args.category!))
        .collect();

      return results.filter(
        (f) => f.source === 'crea' || (f.source === 'custom' && user && f.userId === user.user.id),
      );
    }

    // Default: return all CREA foods
    return await ctx.db
      .query('foods')
      .withIndex('by_source', (q) => q.eq('source', 'crea'))
      .collect();
  },
});

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const foods = await ctx.db
      .query('foods')
      .withIndex('by_source', (q) => q.eq('source', 'crea'))
      .collect();

    const categories = [...new Set(foods.map((f) => f.category))];
    return categories.sort();
  },
});

export const addCustomFood = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    kcalPer100g: v.number(),
    proteinPer100g: v.number(),
    carbPer100g: v.number(),
    fatPer100g: v.number(),
    allergenTags: v.array(v.string()),
    foodType: v.union(v.literal('animale'), v.literal('vegetale')),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    // Check custom food limit (100 per user)
    const existingCustom = await ctx.db
      .query('foods')
      .withIndex('by_userId', (q) => q.eq('userId', user.user.id))
      .collect();

    if (existingCustom.length >= 100) {
      throw new Error('Hai raggiunto il limite di 100 alimenti personalizzati.');
    }

    return await ctx.db.insert('foods', {
      ...args,
      source: 'custom',
      userId: user.user.id,
    });
  },
});

export const getCustomFoodCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { count: 0, limit: 100 };

    const customFoods = await ctx.db
      .query('foods')
      .withIndex('by_userId', (q) => q.eq('userId', user.user.id))
      .collect();

    return { count: customFoods.length, limit: 100 };
  },
});

// Dietary preference filter helper (category-based)
const HIDDEN_CATEGORIES: Record<string, string[]> = {
  onnivoro: [],
  vegetariano: ['carni', 'pesce', 'salumi'],
  vegano: ['carni', 'pesce', 'salumi', 'latticini', 'uova'],
  pescetariano: ['carni', 'salumi'],
};

const filterByDietaryPreference = (
  food: { category: string },
  preference: string,
): boolean => {
  const hidden = HIDDEN_CATEGORIES[preference] ?? [];
  return !hidden.includes(food.category);
};
```

- [ ] **Step 3: Verify the module compiles**

Run: `cd /workspace/packages/backend && npx convex dev --once --typecheck=disable`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/backend/data/crea-foods.json packages/backend/convex/foods.ts
git commit -m "feat: add CREA food database seed data and food query/mutation functions"
```

---

## Chunk 2: User Profile, Onboarding, and Auth Flow

### Task 6: Build user profile Convex functions

**Files:**
- Create: `packages/backend/convex/userProfiles.ts`

- [ ] **Step 1: Write the user profile module**

Create `packages/backend/convex/userProfiles.ts`:

```ts
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { authComponent } from './auth';
import { calculateMacros, getAgeFromDateOfBirth } from './lib/calculations';

const profileInputValidator = {
  sex: v.union(v.literal('M'), v.literal('F')),
  dateOfBirth: v.string(),
  heightCm: v.number(),
  weightKg: v.number(),
  bodyBuild: v.union(v.literal('snello'), v.literal('medio'), v.literal('robusto')),
  goal: v.union(
    v.literal('dimagrimento'),
    v.literal('mantenimento'),
    v.literal('aumento_massa'),
    v.literal('ricomposizione'),
  ),
  activityLevel: v.union(
    v.literal('sedentario'),
    v.literal('leggermente_attivo'),
    v.literal('moderatamente_attivo'),
    v.literal('molto_attivo'),
    v.literal('atleta'),
  ),
  allergies: v.array(v.string()),
  allergiesOther: v.optional(v.string()),
  dietaryPreference: v.union(
    v.literal('onnivoro'),
    v.literal('vegetariano'),
    v.literal('vegano'),
    v.literal('pescetariano'),
  ),
  followedByNutritionist: v.boolean(),
};

export const create = mutation({
  args: profileInputValidator,
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    // Check if profile already exists
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user.user.id))
      .unique();

    if (existing) throw new Error('Profilo già esistente');

    const age = getAgeFromDateOfBirth(args.dateOfBirth);
    const macros = calculateMacros({
      sex: args.sex,
      ageYears: age,
      heightCm: args.heightCm,
      weightKg: args.weightKg,
      bodyBuild: args.bodyBuild,
      goal: args.goal,
      activityLevel: args.activityLevel,
    });

    return await ctx.db.insert('userProfiles', {
      userId: user.user.id,
      ...args,
      legalGateAccepted: true,
      macros,
      lastRecalcWeightKg: args.weightKg,
    });
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user.user.id))
      .unique();
  },
});

export const update = mutation({
  args: {
    ...profileInputValidator,
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user.user.id))
      .unique();

    if (!profile) throw new Error('Profilo non trovato');

    const age = getAgeFromDateOfBirth(args.dateOfBirth);
    const macros = calculateMacros({
      sex: args.sex,
      ageYears: age,
      heightCm: args.heightCm,
      weightKg: args.weightKg,
      bodyBuild: args.bodyBuild,
      goal: args.goal,
      activityLevel: args.activityLevel,
    });

    await ctx.db.patch(profile._id, {
      ...args,
      macros,
      lastRecalcWeightKg: args.weightKg,
    });
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /workspace/packages/backend && npx convex dev --once --typecheck=disable`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/backend/convex/userProfiles.ts
git commit -m "feat: add user profile CRUD with macro calculation on create/update"
```

---

### Task 7: Build weight log Convex functions

**Files:**
- Create: `packages/backend/convex/weightLogs.ts`

- [ ] **Step 1: Write the weight log module**

Create `packages/backend/convex/weightLogs.ts`:

```ts
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { authComponent } from './auth';
import { calculateMacros, getAgeFromDateOfBirth } from './lib/calculations';

export const log = mutation({
  args: {
    weightKg: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user.user.id))
      .unique();

    if (!profile) throw new Error('Profilo non trovato');

    const today = new Date().toISOString().split('T')[0];

    // Upsert: max 1 entry per day
    const existingToday = await ctx.db
      .query('weightLogs')
      .withIndex('by_userId_date', (q) => q.eq('userId', user.user.id).eq('date', today))
      .unique();

    const macrosSnapshot = profile.macros;

    if (existingToday) {
      await ctx.db.patch(existingToday._id, {
        weightKg: args.weightKg,
        macrosAtLog: macrosSnapshot,
      });
    } else {
      await ctx.db.insert('weightLogs', {
        userId: user.user.id,
        date: today,
        weightKg: args.weightKg,
        macrosAtLog: macrosSnapshot,
      });
    }

    // Check if recalculation is needed (Δ ≥ 2kg from last recalc weight)
    const delta = Math.abs(args.weightKg - profile.lastRecalcWeightKg);
    if (delta >= 2) {
      const age = getAgeFromDateOfBirth(profile.dateOfBirth);
      const newMacros = calculateMacros({
        sex: profile.sex,
        ageYears: age,
        heightCm: profile.heightCm,
        weightKg: args.weightKg,
        bodyBuild: profile.bodyBuild,
        goal: profile.goal,
        activityLevel: profile.activityLevel,
      });

      await ctx.db.patch(profile._id, {
        weightKg: args.weightKg,
        macros: newMacros,
        lastRecalcWeightKg: args.weightKg,
      });

      return { recalculated: true, newMacros };
    }

    return { recalculated: false };
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];

    const query = ctx.db
      .query('weightLogs')
      .withIndex('by_userId_date', (q) => q.eq('userId', user.user.id))
      .order('desc');

    if (args.limit) {
      return await query.take(args.limit);
    }
    return await query.collect();
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /workspace/packages/backend && npx convex dev --once --typecheck=disable`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/backend/convex/weightLogs.ts
git commit -m "feat: add weight log with daily upsert and auto-recalculation trigger"
```

---

### Task 8: Set up Next.js route groups and onboarding page

**Files:**
- Create: `apps/web/src/app/(marketing)/layout.tsx`
- Move: `apps/web/src/app/page.tsx` → `apps/web/src/app/(marketing)/page.tsx`
- Create: `apps/web/src/app/(user)/layout.tsx`
- Create: `apps/web/src/app/(user)/onboarding/page.tsx`
- Create: `apps/web/src/app/(user)/dashboard/page.tsx`
- Create: `apps/web/src/components/custom/onboarding-form.tsx`

- [ ] **Step 1: Create (marketing) layout**

Create `apps/web/src/app/(marketing)/layout.tsx`:

```tsx
const MarketingLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-svh">{children}</div>
);

export default MarketingLayout;
```

- [ ] **Step 2: Move homepage to (marketing) route group**

Move `apps/web/src/app/page.tsx` to `apps/web/src/app/(marketing)/page.tsx`. Content stays the same for now (will be replaced with landing page later).

```bash
mv apps/web/src/app/page.tsx apps/web/src/app/\(marketing\)/page.tsx
```

- [ ] **Step 3: Create (user) layout with auth guard**

Create `apps/web/src/app/(user)/layout.tsx`:

```tsx
'use client';

import { useConvexAuth } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const UserLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <div className="min-h-svh">{children}</div>;
};

export default UserLayout;
```

- [ ] **Step 4: Create onboarding page**

Create `apps/web/src/app/(user)/onboarding/page.tsx`:

```tsx
'use client';

import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { api } from '@ratio-diet/backend/convex/_generated/api';

import OnboardingForm from '@/components/custom/onboarding-form';

const OnboardingPage = () => {
  const profile = useQuery(api.userProfiles.get);
  const router = useRouter();

  useEffect(() => {
    if (profile) {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  if (profile) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Configura il tuo profilo</h1>
      <p className="text-muted-foreground mb-8">
        Inserisci i tuoi dati per calcolare il tuo fabbisogno nutrizionale personalizzato.
      </p>
      <OnboardingForm />
    </div>
  );
};

export default OnboardingPage;
```

- [ ] **Step 5: Create dashboard page with today's plan progress**

Create `apps/web/src/app/(user)/dashboard/page.tsx`:

The dashboard is the live hub showing today's nutritional progress. Split into:
- `apps/web/src/app/(user)/dashboard/page.tsx` — orchestrator (~60 lines)
- `apps/web/src/components/custom/dashboard-hero.tsx` — big kcal number + macro targets (~40 lines)
- `apps/web/src/components/custom/dashboard-progress.tsx` — MacroProgressBars for today (~50 lines)
- `apps/web/src/components/custom/dashboard-actions.tsx` — quick-action buttons (~30 lines)

```tsx
'use client';

import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { api } from '@ratio-diet/backend/convex/_generated/api';

import DashboardActions from '@/components/custom/dashboard-actions';
import DashboardHero from '@/components/custom/dashboard-hero';
import DashboardProgress from '@/components/custom/dashboard-progress';

const today = new Date().toISOString().split('T')[0];

const DashboardPage = () => {
  const profile = useQuery(api.userProfiles.get);
  const todayPlan = useQuery(api.dailyPlans.get, { date: today });
  const router = useRouter();

  useEffect(() => {
    if (profile === null) router.replace('/onboarding');
  }, [profile, router]);

  if (!profile) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <DashboardHero macros={profile.macros} />
      <DashboardProgress macros={profile.macros} plan={todayPlan} />
      <DashboardActions hasTodayPlan={!!todayPlan} />
    </div>
  );
};

export default DashboardPage;
```

**`DashboardHero`**: Big kcal target number centered + 3-column macro targets (P/C/F in grams). Brief explanation text: "Il tuo fabbisogno giornaliero calcolato con la formula Mifflin-St Jeor in base ai tuoi dati e obiettivo."

**`DashboardProgress`**: If `plan` exists, shows `MacroProgressBar` for each macro (achieved vs target). If no plan, shows message "Nessun piano per oggi" with a CTA.

**`DashboardActions`**: Quick-access buttons:
- "Pianifica la giornata" → `/daily-plan` (or "Modifica piano" if plan exists)
- "Piano settimanale" → `/weekly-plan`
- "Registra peso" → `/progress`

- [ ] **Step 6: Create onboarding form component**

The onboarding form is split into focused files to respect the 500-line and 10-statement limits:

- `apps/web/src/components/custom/onboarding-form.tsx` — orchestrator (~80 lines): step state, form instance, navigation, submit handler
- `apps/web/src/components/custom/onboarding/step-legal.tsx` — legal gate step (~50 lines)
- `apps/web/src/components/custom/onboarding/step-personal.tsx` — personal data step (~80 lines)
- `apps/web/src/components/custom/onboarding/step-goal.tsx` — goal + activity step (~70 lines)
- `apps/web/src/components/custom/onboarding/step-dietary.tsx` — allergies + dietary prefs step (~80 lines)
- `apps/web/src/components/custom/onboarding/types.ts` — shared form types and constants (~30 lines)

Create `apps/web/src/components/custom/onboarding/types.ts`:

```tsx
type FormValues = {
  isOver18: boolean;
  noPathologies: boolean;
  disclaimerRead: boolean;
  sex: 'M' | 'F';
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  bodyBuild: 'snello' | 'medio' | 'robusto';
  goal: 'dimagrimento' | 'mantenimento' | 'aumento_massa' | 'ricomposizione';
  activityLevel: 'sedentario' | 'leggermente_attivo' | 'moderatamente_attivo' | 'molto_attivo' | 'atleta';
  allergies: string[];
  allergiesOther: string;
  dietaryPreference: 'onnivoro' | 'vegetariano' | 'vegano' | 'pescetariano';
  followedByNutritionist: boolean;
};

const STEPS = ['Consenso', 'Dati personali', 'Obiettivo', 'Alimentazione'];

const ALLERGEN_OPTIONS = [
  { value: 'glutine', label: 'Glutine' },
  { value: 'lattosio', label: 'Lattosio' },
  { value: 'frutta_a_guscio', label: 'Frutta a guscio' },
  { value: 'uova', label: 'Uova' },
  { value: 'crostacei', label: 'Crostacei' },
];

export { type FormValues, STEPS, ALLERGEN_OPTIONS };
```

Create `apps/web/src/components/custom/onboarding-form.tsx` — the orchestrator:

```tsx
'use client';

import { useForm } from '@tanstack/react-form';
import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { Button } from '@ratio-diet/ui/components/button';

import { STEPS } from './onboarding/types';
import type { FormValues } from './onboarding/types';
import StepLegal from './onboarding/step-legal';
import StepPersonal from './onboarding/step-personal';
import StepGoal from './onboarding/step-goal';
import StepDietary from './onboarding/step-dietary';

const DEFAULT_VALUES: FormValues = {
  isOver18: false, noPathologies: false, disclaimerRead: false,
  sex: 'M', dateOfBirth: '', heightCm: 170, weightKg: 70,
  bodyBuild: 'medio', goal: 'mantenimento',
  activityLevel: 'moderatamente_attivo', allergies: [],
  allergiesOther: '', dietaryPreference: 'onnivoro',
  followedByNutritionist: false,
};

const canProceedStep0 = (v: FormValues) => v.isOver18 && v.noPathologies && v.disclaimerRead;
const canProceedStep1 = (v: FormValues) => v.dateOfBirth !== '' && v.heightCm > 0 && v.weightKg > 0;

const OnboardingForm = () => {
  const [step, setStep] = useState(0);
  const createProfile = useMutation(api.userProfiles.create);
  const router = useRouter();

  const form = useForm<FormValues>({
    defaultValues: DEFAULT_VALUES,
    onSubmit: async ({ value }) => {
      await createProfile({
        sex: value.sex, dateOfBirth: value.dateOfBirth,
        heightCm: value.heightCm, weightKg: value.weightKg,
        bodyBuild: value.bodyBuild, goal: value.goal,
        activityLevel: value.activityLevel, allergies: value.allergies,
        allergiesOther: value.allergiesOther || undefined,
        dietaryPreference: value.dietaryPreference,
        followedByNutritionist: value.followedByNutritionist,
      });
      router.push('/dashboard');
    },
  });

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < STEPS.length - 1) setStep(step + 1);
    else form.handleSubmit();
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8 flex gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className={`flex-1 rounded-full py-1 text-center text-xs ${i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {label}
          </div>
        ))}
      </div>
      <form onSubmit={handleNext}>
        {step === 0 && <StepLegal form={form} />}
        {step === 1 && <StepPersonal form={form} />}
        {step === 2 && <StepGoal form={form} />}
        {step === 3 && <StepDietary form={form} />}
        <div className="mt-8 flex justify-between">
          {step > 0 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Indietro</Button>}
          <Button type="submit" className="ml-auto" disabled={(step === 0 && !canProceedStep0(form.state.values)) || (step === 1 && !canProceedStep1(form.state.values))}>
            {step < STEPS.length - 1 ? 'Continua' : 'Calcola i miei macro'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default OnboardingForm;

```

Each step file (`step-legal.tsx`, `step-personal.tsx`, `step-goal.tsx`, `step-dietary.tsx`) receives the TanStack `form` instance as prop and renders its own fields using `form.Field`. Each is under 100 lines. See the orchestrator above for how they compose.

**`step-dietary.tsx` note:** The `allergiesOther` field must include helper text: "Queste allergie verranno considerate nella generazione dei piani settimanali (AI), ma non nel filtro automatico degli alimenti." This sets user expectations that free-text allergens are AI-only, not used for database filtering.

**Key constraint:** Every function in these files must have ≤10 statements. The render functions use JSX composition (not imperative logic), which naturally stays within the limit.

- [ ] **Step 7: Verify app compiles**

Run: `cd /workspace && pnpm run build`
Expected: Build succeeds (or at least no TypeScript errors in the new files)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/\(marketing\) apps/web/src/app/\(user\) apps/web/src/components/custom/onboarding-form.tsx
git commit -m "feat: add route groups, auth guard, onboarding flow, and dashboard skeleton"
```

---

## Chunk 3: Daily Planner, Templates, and Stripe Integration

### Task 9: Build daily plan Convex functions

**Files:**
- Create: `packages/backend/convex/dailyPlans.ts`

- [ ] **Step 1: Write the daily plans module**

Create `packages/backend/convex/dailyPlans.ts`:

```ts
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { authComponent } from './auth';
import { distributeMacrosToMeals, optimizeMealQuantities } from './lib/optimizer';

const mealItemInput = v.object({
  foodId: v.id('foods'),
  constraintMin: v.optional(v.number()),
  constraintMax: v.optional(v.number()),
});

const mealInput = v.object({
  type: v.union(
    v.literal('colazione'),
    v.literal('pranzo'),
    v.literal('cena'),
    v.literal('spuntino_mattina'),
    v.literal('spuntino_pomeriggio'),
  ),
  items: v.array(mealItemInput),
});

export const optimize = mutation({
  args: {
    meals: v.array(mealInput),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user.user.id))
      .unique();

    if (!profile) throw new Error('Profilo non trovato');

    const dailyMacros = {
      proteinGrams: profile.macros.proteinGrams,
      carbGrams: profile.macros.carbGrams,
      fatGrams: profile.macros.fatGrams,
    };

    const mealTypes = args.meals.map((m) => m.type);
    const mealTargets = distributeMacrosToMeals(dailyMacros, mealTypes);

    // Optimize each meal
    const optimizedMeals = [];
    let totalProtein = 0;
    let totalCarb = 0;
    let totalFat = 0;
    let totalKcal = 0;

    for (const meal of args.meals) {
      // Fetch food data for this meal
      const foodDocs = await Promise.all(
        meal.items.map(async (item) => {
          const food = await ctx.db.get(item.foodId);
          if (!food) throw new Error(`Alimento non trovato: ${item.foodId}`);
          return food;
        }),
      );

      const foods = foodDocs.map((doc) => ({
        id: doc._id as unknown as string,
        proteinPer100g: doc.proteinPer100g,
        carbPer100g: doc.carbPer100g,
        fatPer100g: doc.fatPer100g,
        kcalPer100g: doc.kcalPer100g,
      }));

      const constraints: Record<string, { min?: number; max?: number }> = {};
      for (const item of meal.items) {
        const c: { min?: number; max?: number } = {};
        if (item.constraintMin !== undefined) c.min = item.constraintMin;
        if (item.constraintMax !== undefined) c.max = item.constraintMax;
        if (Object.keys(c).length > 0) {
          constraints[item.foodId as unknown as string] = c;
        }
      }

      const target = mealTargets[meal.type];
      const result = optimizeMealQuantities({
        macroTarget: target,
        foods,
        constraints,
      });

      const optimizedItems = meal.items.map((item) => ({
        foodId: item.foodId,
        quantityGrams: result.quantities[item.foodId as unknown as string] ?? 0,
        constraintMin: item.constraintMin,
        constraintMax: item.constraintMax,
      }));

      optimizedMeals.push({
        type: meal.type,
        items: optimizedItems,
      });

      totalProtein += result.macrosAchieved.proteinGrams;
      totalCarb += result.macrosAchieved.carbGrams;
      totalFat += result.macrosAchieved.fatGrams;
      totalKcal += result.macrosAchieved.kcal;
    }

    // Upsert daily plan
    const existing = await ctx.db
      .query('dailyPlans')
      .withIndex('by_userId_date', (q) => q.eq('userId', user.user.id).eq('date', args.date))
      .unique();

    const planData = {
      userId: user.user.id,
      date: args.date,
      status: 'draft' as const,
      meals: optimizedMeals,
      macrosAchieved: {
        tdee: profile.macros.tdee,
        calorieTarget: Math.round(totalKcal),
        proteinGrams: Math.round(totalProtein),
        carbGrams: Math.round(totalCarb),
        fatGrams: Math.round(totalFat),
      },
      macrosTarget: profile.macros,
    };

    if (existing) {
      await ctx.db.patch(existing._id, planData);
      return existing._id;
    }

    return await ctx.db.insert('dailyPlans', planData);
  },
});

export const get = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query('dailyPlans')
      .withIndex('by_userId_date', (q) => q.eq('userId', user.user.id).eq('date', args.date))
      .unique();
  },
});

export const complete = mutation({
  args: { planId: v.id('dailyPlans') },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== user.user.id) throw new Error('Piano non trovato');

    await ctx.db.patch(args.planId, { status: 'complete' });
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /workspace/packages/backend && npx convex dev --once --typecheck=disable`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/backend/convex/dailyPlans.ts
git commit -m "feat: add daily plan optimizer with per-meal macro distribution"
```

---

### Task 10: Build templates Convex functions

**Files:**
- Create: `packages/backend/convex/templates.ts`

- [ ] **Step 1: Write the templates module**

Create `packages/backend/convex/templates.ts`:

```ts
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { authComponent } from './auth';

const mealItemValidator = v.object({
  foodId: v.id('foods'),
  constraintMin: v.optional(v.number()),
  constraintMax: v.optional(v.number()),
});

const mealValidator = v.object({
  type: v.union(
    v.literal('colazione'),
    v.literal('pranzo'),
    v.literal('cena'),
    v.literal('spuntino_mattina'),
    v.literal('spuntino_pomeriggio'),
  ),
  items: v.array(mealItemValidator),
});

export const save = mutation({
  args: {
    name: v.string(),
    meals: v.array(mealValidator),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    return await ctx.db.insert('templates', {
      userId: user.user.id,
      name: args.name,
      meals: args.meals,
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query('templates')
      .withIndex('by_userId', (q) => q.eq('userId', user.user.id))
      .collect();
  },
});

export const get = query({
  args: { templateId: v.id('templates') },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== user.user.id) return null;

    return template;
  },
});

export const remove = mutation({
  args: { templateId: v.id('templates') },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== user.user.id) throw new Error('Template non trovato');

    await ctx.db.delete(args.templateId);
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /workspace/packages/backend && npx convex dev --once --typecheck=disable`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/backend/convex/templates.ts
git commit -m "feat: add template CRUD functions"
```

---

### Task 11: Set up Stripe subscription backend

**Files:**
- Create: `packages/backend/convex/subscriptions.ts`
- Modify: `packages/backend/convex/http.ts`
- Modify: `packages/backend/package.json` (add stripe dependency)

- [ ] **Step 1: Install Stripe**

Run: `cd /workspace/packages/backend && pnpm add stripe`

- [ ] **Step 2: Write subscriptions module**

Create `packages/backend/convex/subscriptions.ts`:

```ts
import { v } from 'convex/values';

import { api } from './_generated/api';
import { action, internalMutation, query } from './_generated/server';
import { authComponent } from './auth';

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', user.user.id))
      .unique();

    return sub ? { status: sub.status, nextRenewalDate: sub.nextRenewalDate } : null;
  },
});

export const createCheckoutSession = action({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const siteUrl = process.env.SITE_URL!;
    const priceId = process.env.STRIPE_PRICE_ID!;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard?subscription=success`,
      cancel_url: `${siteUrl}/dashboard?subscription=cancelled`,
      client_reference_id: user.user.id,
      metadata: { userId: user.user.id },
      // Do NOT pass payment_method_types — use dynamic payment methods
      // configured in Stripe Dashboard for optimal conversion
    });

    return { url: session.url };
  },
});

export const createPortalSession = action({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    const sub = await ctx.runQuery(api.subscriptions.getSubscriptionForPortal, {});
    if (!sub) throw new Error('Nessun abbonamento trovato');

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.SITE_URL!}/settings`,
    });

    return { url: session.url };
  },
});

export const getSubscriptionForPortal = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', user.user.id))
      .unique();
  },
});

// Internal mutations called by webhook handler
export const upsertFromWebhook = internalMutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    status: v.union(v.literal('active'), v.literal('cancelled'), v.literal('past_due')),
    startDate: v.string(),
    nextRenewalDate: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripeSubscriptionId', (q) =>
        q.eq('stripeSubscriptionId', args.stripeSubscriptionId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        nextRenewalDate: args.nextRenewalDate,
      });
    } else {
      await ctx.db.insert('subscriptions', args);
    }
  },
});

```

- [ ] **Step 3: Add Stripe webhook handler to http.ts**

Update `packages/backend/convex/http.ts`:

```ts
import { httpRouter } from 'convex/server';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';
import { authComponent, createAuth } from './auth';

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: '/stripe-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const signature = request.headers.get('stripe-signature');
    const body = await request.text();

    if (!signature) {
      return new Response('Missing signature', { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch {
      return new Response('Invalid signature', { status: 400 });
    }

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription =
        event.type === 'checkout.session.completed'
          ? await stripe.subscriptions.retrieve(
              (event.data.object as Stripe.Checkout.Session).subscription as string,
            )
          : (event.data.object as Stripe.Subscription);

      const userId =
        event.type === 'checkout.session.completed'
          ? (event.data.object as Stripe.Checkout.Session).client_reference_id!
          : subscription.metadata?.userId;

      if (!userId) {
        return new Response('Missing userId', { status: 400 });
      }

      const statusMap: Record<string, 'active' | 'cancelled' | 'past_due'> = {
        active: 'active',
        past_due: 'past_due',
        canceled: 'cancelled',
        cancelled: 'cancelled',
        unpaid: 'past_due',
      };

      await ctx.runMutation(internal.subscriptions.upsertFromWebhook, {
        userId,
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        status: statusMap[subscription.status] ?? 'cancelled',
        startDate: new Date(subscription.start_date * 1000).toISOString().split('T')[0],
        nextRenewalDate: new Date(subscription.current_period_end * 1000)
          .toISOString()
          .split('T')[0],
      });
    }

    return new Response('OK', { status: 200 });
  }),
});

export default http;
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /workspace/packages/backend && npx convex dev --once --typecheck=disable`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/subscriptions.ts packages/backend/convex/http.ts packages/backend/package.json
git commit -m "feat: add Stripe subscription checkout, portal, and webhook handler"
```

---

## Chunk 4: Weekly Plan AI Generation, Shopping List, and PWA

### Task 12: Build weekly plan AI generation

**Files:**
- Create: `packages/backend/convex/weeklyPlans.ts`
- Create: `packages/backend/convex/lib/weeklyPlanPrompt.ts`

- [ ] **Step 1: Write the AI prompt builder**

Create `packages/backend/convex/lib/weeklyPlanPrompt.ts`:

```ts
interface FoodForPrompt {
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
}

interface PromptInput {
  foods: FoodForPrompt[];
  macroTarget: {
    calorieTarget: number;
    proteinGrams: number;
    carbGrams: number;
    fatGrams: number;
  };
  allergies: string[];
  allergiesOther?: string;
  dietaryPreference: string;
}

export const buildWeeklyPlanPrompt = (input: PromptInput): string => {
  const foodList = input.foods
    .map(
      (f) =>
        `- ${f.name}: ${f.kcalPer100g} kcal, ${f.proteinPer100g}g proteine, ${f.carbPer100g}g carbo, ${f.fatPer100g}g grassi (per 100g)`,
    )
    .join('\n');

  const allergyNote =
    input.allergies.length > 0
      ? `Allergie/intolleranze: ${input.allergies.join(', ')}${input.allergiesOther ? `. Altro: ${input.allergiesOther}` : ''}\n`
      : '';

  return `Sei un nutrizionista italiano. Crea un piano alimentare settimanale (7 giorni, lunedì-domenica) usando ESCLUSIVAMENTE i cibi elencati sotto.

OBIETTIVI GIORNALIERI:
- Calorie: ${input.macroTarget.calorieTarget} kcal
- Proteine: ${input.macroTarget.proteinGrams}g
- Carboidrati: ${input.macroTarget.carbGrams}g
- Grassi: ${input.macroTarget.fatGrams}g

${allergyNote}Preferenza alimentare: ${input.dietaryPreference}

CIBI DISPONIBILI (valori per 100g):
${foodList}

REGOLE:
1. Usa SOLO i cibi elencati sopra. Non inventare cibi.
2. Per ogni pasto specifica il nome del cibo e i grammi esatti.
3. Varia i cibi tra i giorni per non ripetere lo stesso pasto.
4. Distribuisci i macro: colazione ~25%, pranzo ~40%, cena ~35%.
5. Le quantità devono essere realistiche (non superare 500g per singolo cibo).
6. I macro giornalieri totali devono avvicinarsi il più possibile agli obiettivi (tolleranza ±5%).

Genera il piano come oggetto JSON strutturato.`;
};
```

- [ ] **Step 2: Write the weekly plans module**

Create `packages/backend/convex/weeklyPlans.ts`:

```ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { v } from 'convex/values';
import { z } from 'zod';

import { api, internal } from './_generated/api';
import { action, internalMutation, mutation, query } from './_generated/server';
import { authComponent } from './auth';
import { buildWeeklyPlanPrompt } from './lib/weeklyPlanPrompt';

const mealItemSchema = z.object({
  foodName: z.string(),
  grams: z.number(),
});

const dayPlanSchema = z.object({
  day: z.string(),
  colazione: z.array(mealItemSchema),
  pranzo: z.array(mealItemSchema),
  cena: z.array(mealItemSchema),
});

const weeklyPlanSchema = z.object({
  days: z.array(dayPlanSchema).length(7),
});

export const generate = action({
  args: {
    foodIds: v.array(v.id('foods')),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    // Check subscription
    const sub = await ctx.runQuery(api.subscriptions.getStatus, {});
    if (!sub || sub.status !== 'active') {
      throw new Error('Abbonamento premium richiesto');
    }

    // Get user profile
    const profile = await ctx.runQuery(api.userProfiles.get, {});
    if (!profile) throw new Error('Profilo non trovato');

    // Fetch food data
    const foods = [];
    for (const foodId of args.foodIds) {
      const food = await ctx.runQuery(api.foods.getById, { foodId });
      if (food) foods.push(food);
    }

    if (foods.length === 0) throw new Error('Seleziona almeno un alimento');

    const prompt = buildWeeklyPlanPrompt({
      foods: foods.map((f) => ({
        name: f.name,
        kcalPer100g: f.kcalPer100g,
        proteinPer100g: f.proteinPer100g,
        carbPer100g: f.carbPer100g,
        fatPer100g: f.fatPer100g,
      })),
      macroTarget: profile.macros,
      allergies: profile.allergies,
      allergiesOther: profile.allergiesOther,
      dietaryPreference: profile.dietaryPreference,
    });

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!,
    });

    const modelId = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-001';

    // Generate with up to 3 retries
    let lastResult;
    let validationWarning: string | undefined;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { object } = await generateObject({
        model: openrouter.chat(modelId),
        schema: weeklyPlanSchema,
        prompt,
      });

      lastResult = object;

      // Validate macros
      const validation = validateWeeklyPlan(object, foods, profile.macros);
      if (validation.maxGapPercent <= 5) {
        break; // Valid plan
      }

      if (attempt === 2) {
        validationWarning = `Il piano generato ha uno scarto di ${Math.round(validation.maxGapPercent)}% sui macro. Puoi modificarlo manualmente o rigenerarlo.`;
      }
    }

    if (!lastResult) throw new Error('Generazione piano fallita');

    // Create daily plans and weekly plan
    const weekStart = getNextMonday();
    const dailyPlanIds = [];
    const shoppingMap = new Map<string, { name: string; grams: number; category: string; foodId: string }>();

    const foodByName = new Map(foods.map((f) => [f.name.toLowerCase(), f]));

    for (let i = 0; i < lastResult.days.length; i++) {
      const day = lastResult.days[i];
      const date = addDays(weekStart, i);

      const meals = [];
      for (const mealType of ['colazione', 'pranzo', 'cena'] as const) {
        const items = day[mealType] ?? [];
        const mealItems = [];

        for (const item of items) {
          const food = foodByName.get(item.foodName.toLowerCase());
          if (!food) continue;

          mealItems.push({
            foodId: food._id,
            quantityGrams: Math.round(item.grams),
          });

          // Accumulate shopping list
          const key = food._id as unknown as string;
          const existing = shoppingMap.get(key);
          if (existing) {
            existing.grams += item.grams;
          } else {
            shoppingMap.set(key, {
              name: food.name,
              grams: item.grams,
              category: food.category,
              foodId: key,
            });
          }
        }

        meals.push({ type: mealType, items: mealItems });
      }

      const planId = await ctx.runMutation(internal.weeklyPlans.createDailyPlan, {
        userId: user.user.id,
        date,
        meals,
        macrosTarget: profile.macros,
      });

      dailyPlanIds.push(planId);
    }

    const shoppingList = [...shoppingMap.values()].map((item) => ({
      foodId: item.foodId,
      name: item.name,
      totalGrams: Math.round(item.grams),
      category: item.category,
    }));

    const weeklyPlanId = await ctx.runMutation(internal.weeklyPlans.create, {
      userId: user.user.id,
      weekStartDate: weekStart,
      dailyPlanIds,
      shoppingList,
    });

    return { weeklyPlanId, validationWarning };
  },
});

export const get = query({
  args: { weeklyPlanId: v.id('weeklyPlans') },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const plan = await ctx.db.get(args.weeklyPlanId);
    if (!plan || plan.userId !== user.user.id) return null;

    // Fetch associated daily plans
    const dailyPlans = await Promise.all(plan.dailyPlanIds.map((id) => ctx.db.get(id)));

    return { ...plan, dailyPlans: dailyPlans.filter(Boolean) };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query('weeklyPlans')
      .withIndex('by_userId', (q) => q.eq('userId', user.user.id))
      .order('desc')
      .collect();
  },
});

// Internal mutations used by the generate action
export const createDailyPlan = internalMutation({
  args: {
    userId: v.string(),
    date: v.string(),
    meals: v.any(),
    macrosTarget: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('dailyPlans', {
      userId: args.userId,
      date: args.date,
      status: 'complete',
      meals: args.meals,
      macrosAchieved: args.macrosTarget, // Will be recalculated
      macrosTarget: args.macrosTarget,
    });
  },
});

export const create = internalMutation({
  args: {
    userId: v.string(),
    weekStartDate: v.string(),
    dailyPlanIds: v.array(v.id('dailyPlans')),
    shoppingList: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('weeklyPlans', {
      userId: args.userId,
      weekStartDate: args.weekStartDate,
      dailyPlanIds: args.dailyPlanIds,
      shoppingList: args.shoppingList,
      status: 'generato',
    });
  },
});

// Helper: add getById to foods (needed by generate action)
// This should be added to foods.ts as a separate query

// Validation helper
const validateWeeklyPlan = (
  plan: z.infer<typeof weeklyPlanSchema>,
  foods: Array<{ name: string; kcalPer100g: number; proteinPer100g: number; carbPer100g: number; fatPer100g: number }>,
  target: { calorieTarget: number; proteinGrams: number; carbGrams: number; fatGrams: number },
): { maxGapPercent: number } => {
  const foodByName = new Map(foods.map((f) => [f.name.toLowerCase(), f]));
  let maxGap = 0;

  for (const day of plan.days) {
    let protein = 0;
    let carb = 0;
    let fat = 0;

    for (const mealType of ['colazione', 'pranzo', 'cena'] as const) {
      for (const item of day[mealType]) {
        const food = foodByName.get(item.foodName.toLowerCase());
        if (!food) continue;
        const factor = item.grams / 100;
        protein += food.proteinPer100g * factor;
        carb += food.carbPer100g * factor;
        fat += food.fatPer100g * factor;
      }
    }

    const proteinGap = target.proteinGrams > 0 ? Math.abs(protein - target.proteinGrams) / target.proteinGrams * 100 : 0;
    const carbGap = target.carbGrams > 0 ? Math.abs(carb - target.carbGrams) / target.carbGrams * 100 : 0;
    const fatGap = target.fatGrams > 0 ? Math.abs(fat - target.fatGrams) / target.fatGrams * 100 : 0;

    maxGap = Math.max(maxGap, proteinGap, carbGap, fatGap);
  }

  return { maxGapPercent: maxGap };
};

// Date helpers
const getNextMonday = (): string => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  return monday.toISOString().split('T')[0];
};

const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};
```

- [ ] **Step 3: Add getById, deleteCustomFood, and suggestForMacro to foods.ts**

Add to `packages/backend/convex/foods.ts`:

```ts
export const getById = query({
  args: { foodId: v.id('foods') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.foodId);
  },
});

export const deleteCustomFood = mutation({
  args: { foodId: v.id('foods') },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    const food = await ctx.db.get(args.foodId);
    if (!food || food.source !== 'custom' || food.userId !== user.user.id) {
      throw new Error('Alimento non trovato');
    }

    await ctx.db.delete(args.foodId);
  },
});

// Used by the optimizer fallback when macro gap > 15%
export const suggestForMacro = query({
  args: {
    macro: v.union(v.literal('protein'), v.literal('carb'), v.literal('fat')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    const profile = user
      ? await ctx.db.query('userProfiles').withIndex('by_userId', (q) => q.eq('userId', user.user.id)).unique()
      : null;

    const allFoods = await ctx.db.query('foods').withIndex('by_source', (q) => q.eq('source', 'crea')).collect();
    const userAllergens = profile?.allergies ?? [];
    const dietPref = profile?.dietaryPreference ?? 'onnivoro';

    const filtered = allFoods.filter((f) => {
      if (userAllergens.length > 0 && f.allergenTags.some((tag) => userAllergens.includes(tag))) return false;
      return filterByDietaryPreference(f, dietPref);
    });

    const sortField = args.macro === 'protein' ? 'proteinPer100g'
      : args.macro === 'carb' ? 'carbPer100g' : 'fatPer100g';

    return filtered
      .sort((a, b) => b[sortField] - a[sortField])
      .slice(0, args.limit ?? 5);
  },
});
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /workspace/packages/backend && npx convex dev --once --typecheck=disable`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/weeklyPlans.ts packages/backend/convex/lib/weeklyPlanPrompt.ts packages/backend/convex/foods.ts
git commit -m "feat: add AI weekly plan generation with OpenRouter, validation, and shopping list"
```

---

### Task 12a: Build weekly plan edit mutations

**Files:**
- Modify: `packages/backend/convex/weeklyPlans.ts`
- Create: `packages/backend/convex/lib/shoppingList.ts`

- [ ] **Step 1: Write the shopping list recalculation helper**

Create `packages/backend/convex/lib/shoppingList.ts`:

```ts
import type { Doc } from '../_generated/dataModel';

interface ShoppingItem {
  foodId: string;
  name: string;
  totalGrams: number;
  category: string;
}

export const buildShoppingList = (
  dailyPlans: Array<Doc<'dailyPlans'> | null>,
  foodLookup: Map<string, Doc<'foods'>>,
): ShoppingItem[] => {
  const map = new Map<string, ShoppingItem>();

  for (const plan of dailyPlans) {
    if (!plan) continue;
    for (const meal of plan.meals) {
      for (const item of meal.items) {
        const foodId = item.foodId as unknown as string;
        const food = foodLookup.get(foodId);
        if (!food) continue;

        const existing = map.get(foodId);
        if (existing) {
          existing.totalGrams += item.quantityGrams;
        } else {
          map.set(foodId, {
            foodId,
            name: food.name,
            totalGrams: item.quantityGrams,
            category: food.category,
          });
        }
      }
    }
  }

  return [...map.values()].map((i) => ({
    ...i,
    totalGrams: Math.round(i.totalGrams),
  }));
};
```

- [ ] **Step 2: Add edit mutations to weeklyPlans.ts**

Add the following mutations to `packages/backend/convex/weeklyPlans.ts`:

```ts
// Helper to verify subscription and plan ownership
const verifyEditAccess = async (
  ctx: any,
  weeklyPlanId: Id<'weeklyPlans'>,
) => {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error('Non autenticato');

  const sub = await ctx.db
    .query('subscriptions')
    .withIndex('by_userId', (q: any) => q.eq('userId', user.user.id))
    .unique();
  if (!sub || sub.status !== 'active') {
    throw new Error('Abbonamento attivo richiesto per modificare il piano');
  }

  const plan = await ctx.db.get(weeklyPlanId);
  if (!plan || plan.userId !== user.user.id) throw new Error('Piano non trovato');

  return { user, plan };
};

export const updateMealItem = mutation({
  args: {
    weeklyPlanId: v.id('weeklyPlans'),
    dailyPlanId: v.id('dailyPlans'),
    mealType: v.string(),
    itemIndex: v.number(),
    foodId: v.optional(v.id('foods')),
    quantityGrams: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyEditAccess(ctx, args.weeklyPlanId);

    const dailyPlan = await ctx.db.get(args.dailyPlanId);
    if (!dailyPlan) throw new Error('Piano giornaliero non trovato');

    const meals = dailyPlan.meals.map((meal) => {
      if (meal.type !== args.mealType) return meal;
      const items = [...meal.items];
      if (args.foodId !== undefined) items[args.itemIndex].foodId = args.foodId;
      if (args.quantityGrams !== undefined) items[args.itemIndex].quantityGrams = args.quantityGrams;
      return { ...meal, items };
    });

    await ctx.db.patch(args.dailyPlanId, { meals });
    await ctx.db.patch(args.weeklyPlanId, { status: 'modificato' });
  },
});

export const recalculateShoppingList = mutation({
  args: { weeklyPlanId: v.id('weeklyPlans') },
  handler: async (ctx, args) => {
    const { plan } = await verifyEditAccess(ctx, args.weeklyPlanId);

    const dailyPlans = await Promise.all(plan.dailyPlanIds.map((id) => ctx.db.get(id)));
    const allFoodIds = new Set<string>();

    for (const dp of dailyPlans) {
      if (!dp) continue;
      for (const meal of dp.meals) {
        for (const item of meal.items) {
          allFoodIds.add(item.foodId as unknown as string);
        }
      }
    }

    const foodLookup = new Map();
    for (const id of allFoodIds) {
      const food = await ctx.db.get(id as any);
      if (food) foodLookup.set(id, food);
    }

    const { buildShoppingList } = await import('./lib/shoppingList');
    const shoppingList = buildShoppingList(dailyPlans, foodLookup);

    await ctx.db.patch(args.weeklyPlanId, { shoppingList: shoppingList as any });
  },
});
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /workspace/packages/backend && npx convex dev --once --typecheck=disable`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/backend/convex/weeklyPlans.ts packages/backend/convex/lib/shoppingList.ts
git commit -m "feat: add weekly plan edit mutations with subscription checks and shopping list recalculation"
```

---

### Task 12b: Set up Stripe products and prices via MCP

A Stripe MCP server is connected to the project's test account. Use it to create the subscription product.

- [ ] **Step 1: Create the product**

Use the Stripe MCP tool `create_product` to create:
- Name: "Ratio Diet Premium"
- Description: "Piano settimanale AI, lista della spesa, storico piani"

- [ ] **Step 2: Create the price**

Use the Stripe MCP tool `create_price` to create:
- Product: (ID from step 1)
- Unit amount: 499 (€4.99)
- Currency: eur
- Recurring interval: month

- [ ] **Step 3: Save the price ID**

Set the price ID as `STRIPE_PRICE_ID` in the Convex dashboard environment variables. Also set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.

- [ ] **Step 4: Configure dynamic payment methods**

In the Stripe Dashboard (test mode), enable dynamic payment methods under Settings → Payment methods. This allows Stripe to automatically show the optimal payment methods per user without hardcoding `payment_method_types`.

---

### Task 13: Verify env var strategy

No file changes needed. Backend secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, OPENROUTER_API_KEY, OPENROUTER_MODEL) are configured via the Convex dashboard environment variables, not in the Next.js env. The existing `packages/env/src/web.ts` already validates the required client-side env vars (NEXT_PUBLIC_CONVEX_URL, NEXT_PUBLIC_CONVEX_SITE_URL). No new client-side env vars are needed for Stripe — checkout and portal sessions are created server-side via Convex Actions which redirect the browser to Stripe-hosted pages.

**No commit for this task.**

---

### Task 14: Configure PWA manifest and service worker

**Files:**
- Modify: `apps/web/src/app/manifest.ts`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Update the manifest**

Update `apps/web/src/app/manifest.ts`:

```ts
import type { MetadataRoute } from 'next';

const manifest = (): MetadataRoute.Manifest => ({
  name: 'Ratio Diet',
  short_name: 'RatioDiet',
  description: 'La tua alimentazione basata su numeri, proporzioni e metodo.',
  start_url: '/dashboard',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#4a1d6a', // Placeholder — will be updated with client's palette
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
});

export default manifest;
```

- [ ] **Step 2: Update root layout lang and metadata**

Update `apps/web/src/app/layout.tsx` — change `lang="en"` to `lang="it"` and update metadata:

```tsx
export const metadata: Metadata = {
  description: 'Ratio Diet — La tua alimentazione basata su numeri, proporzioni e metodo.',
  title: 'Ratio Diet',
};
```

And in the `<html>` tag: `lang="it"`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/manifest.ts apps/web/src/app/layout.tsx
git commit -m "feat: configure PWA manifest and set Italian locale"
```

---

## Chunk 5: Frontend Pages (Daily Planner, Weekly Plan, Progress, Settings, Marketing)

### Task 15: Build the daily planner page

**Files:**
- Create: `apps/web/src/app/(user)/daily-plan/page.tsx`
- Create: `apps/web/src/components/custom/food-selector.tsx`
- Create: `apps/web/src/components/custom/meal-builder.tsx`
- Create: `apps/web/src/components/custom/macro-progress-bar.tsx`

This is the largest frontend task. Each component is focused:

- `food-selector.tsx` — search/browse foods, add custom foods
- `meal-builder.tsx` — builds a single meal (colazione/pranzo/cena) with food items and constraints
- `macro-progress-bar.tsx` — reusable macro visualization (used on dashboard and daily planner)
- `daily-plan/page.tsx` — orchestrates the full daily planner experience

- [ ] **Step 1: Create macro progress bar component**

Create `apps/web/src/components/custom/macro-progress-bar.tsx`:

```tsx
interface MacroProgressBarProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
}

const MacroProgressBar = ({ label, current, target, unit = 'g' }: MacroProgressBarProps) => {
  const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const isOver = current > target;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={isOver ? 'text-destructive' : 'text-muted-foreground'}>
          {Math.round(current)}{unit} / {Math.round(target)}{unit}
        </span>
      </div>
      <div className="bg-muted h-2 rounded-full">
        <div
          className={`h-full rounded-full transition-all ${isOver ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
};

export default MacroProgressBar;
```

- [ ] **Step 2: Create food selector component**

Create `apps/web/src/components/custom/food-selector.tsx`:

```tsx
interface FoodSelectorProps {
  onSelect: (foodId: Id<'foods'>) => void;
  /** If true, shows the selector as a dialog/modal */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Behavior:**
- Uses `useQuery(api.foods.search, { searchTerm, category })` for live search
- Uses `useQuery(api.foods.getCategories)` to populate category filter tabs
- Allergen-incompatible foods are already filtered server-side (no client filtering needed)
- Each food row shows: name, category badge, kcal/100g, P/C/F per 100g, "verificato" badge if source=crea
- "Aggiungi alimento personalizzato" button opens an inline form with fields: name, category, kcal, protein, carbs, fat (all per 100g), foodType toggle
- Custom food form calls `useMutation(api.foods.addCustomFood)` on submit
- Shows custom food counter from `useQuery(api.foods.getCustomFoodCount)` → "73/100 alimenti personalizzati"
- Uses shadcn `Input`, `Button`, `Dialog`, `Tabs` components

- [ ] **Step 3: Create meal builder component**

Create `apps/web/src/components/custom/meal-builder.tsx`:

```tsx
interface MealBuilderProps {
  mealType: 'colazione' | 'pranzo' | 'cena' | 'spuntino_mattina' | 'spuntino_pomeriggio';
  items: Array<{ foodId: Id<'foods'>; constraintMin?: number; constraintMax?: number }>;
  onItemsChange: (items: MealBuilderProps['items']) => void;
}
```

**Behavior:**
- Displays meal type as header (e.g., "Colazione")
- Lists selected foods — each row: food name (fetched via `useQuery(api.foods.getById)`), min/max constraint inputs (optional `Input` fields), remove button
- "Aggiungi alimento" button opens `FoodSelector` dialog — on select, appends food to items via `onItemsChange`
- Shows per-meal macro subtotals calculated client-side from food data × optimized quantities
- State is lifted — parent (daily planner page) owns the items array

- [ ] **Step 4: Create daily planner page**

Create `apps/web/src/app/(user)/daily-plan/page.tsx`:

**State management:**
- `date`: string (ISO, defaults to today from client timezone)
- `meals`: array of `{ type, items }` — one per meal type, managed via `useState`
- Existing plan loaded via `useQuery(api.dailyPlans.get, { date })`
- Templates loaded via `useQuery(api.templates.list)`

**UI structure:**
- Date picker (`<Input type="date">`) at top
- "Carica template" dropdown (populated from templates query) — selecting one pre-populates `meals` state
- `MealBuilder` component for each active meal (colazione, pranzo, cena by default)
- Toggle to add spuntini (adds spuntino_mattina, spuntino_pomeriggio meal builders)
- "Calcola quantità" button → calls `useMutation(api.dailyPlans.optimize)` with current meals + date
- `MacroProgressBar` components for proteine, carboidrati, grassi (from plan's `macrosAchieved` vs `macrosTarget`)
- "Salva come template" button → prompt for name → calls `useMutation(api.templates.save)` with current meal config
- "Completa giornata" button → calls `useMutation(api.dailyPlans.complete)`

**Optimizer failure handling:** When the optimizer returns `success: false` (macro gap > 15%):
- Show a warning banner with the gap details (e.g., "Ti mancano ~30g di proteine")
- Query `useQuery(api.foods.suggestForMacro, { macro: 'protein' })` to show 5 suggested foods
- Each suggestion has an "Aggiungi" button that adds it to the current meal via the food selector flow
- Use `FoodName` component for suggestions

- [ ] **Step 5: Verify app compiles**

Run: `cd /workspace && pnpm run build`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(user\)/daily-plan apps/web/src/components/custom/food-selector.tsx apps/web/src/components/custom/meal-builder.tsx apps/web/src/components/custom/macro-progress-bar.tsx
git commit -m "feat: add daily planner page with food selector, meal builder, and macro progress"
```

---

### Task 15b: Create reusable FoodName component

**Files:**
- Create: `apps/web/src/components/custom/food-name.tsx`

- [ ] **Step 1: Create FoodName component**

Create `apps/web/src/components/custom/food-name.tsx` — used everywhere a food name is displayed to ensure consistent "verificato" badge rendering:

```tsx
import { BadgeCheck } from 'lucide-react';

interface FoodNameProps {
  name: string;
  source: 'crea' | 'custom';
  className?: string;
}

const FoodName = ({ name, source, className }: FoodNameProps) => (
  <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
    {name}
    {source === 'crea' && (
      <BadgeCheck className="text-primary h-4 w-4 shrink-0" aria-label="Verificato CREA" />
    )}
  </span>
);

export default FoodName;
```

Use this component in: food-selector, meal-builder, daily plan results, weekly plan view, shopping list, settings custom food list. Every food name display should go through `FoodName`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/custom/food-name.tsx
git commit -m "feat: add reusable FoodName component with verificato badge"
```

---

### Task 16: Build weekly plan page

**Files:**
- Create: `apps/web/src/app/(user)/weekly-plan/page.tsx`
- Create: `apps/web/src/components/custom/shopping-list.tsx`
- Create: `apps/web/src/components/custom/weekly-plan-generator.tsx`
- Create: `apps/web/src/components/custom/weekly-plan-view.tsx`
- Create: `apps/web/src/components/custom/weekly-plan-history.tsx`

- [ ] **Step 1: Create shopping list component**

Create `apps/web/src/components/custom/shopping-list.tsx` — renders the shopping list grouped by category with `@media print` optimized styles. Uses `FoodName` component for each item.

- [ ] **Step 2: Create weekly plan sub-components**

**`weekly-plan-generator.tsx`**: Food multi-selection interface (reuses `FoodSelector` in multi-select mode). "Genera piano" button → calls `useAction(api.weeklyPlans.generate)` with selected foodIds. Shows loading spinner during AI generation. Displays validation warning if returned.

**`weekly-plan-view.tsx`**: Displays generated plan with edit capability:
- 7 tabs (Lun-Dom), each tab shows colazione/pranzo/cena with `FoodName` + grams
- Uses `useQuery(api.weeklyPlans.get, { weeklyPlanId })`
- **Edit mode** (subscription active only): inline edit buttons per food item — change food (opens FoodSelector), change quantity (number input). Calls `useMutation(api.weeklyPlans.updateMealItem)` on change, then `useMutation(api.weeklyPlans.recalculateShoppingList)` to refresh shopping list.
- **Read-only mode** (subscription cancelled): no edit controls, shows banner "Piano in sola lettura — riattiva l'abbonamento per modificare"
- Subscription status determined by `useQuery(api.subscriptions.getStatus)`
- Print button triggers `window.print()` with `@media print` optimized styles
- `<ShoppingList />` shown as a tab

**`weekly-plan-history.tsx`**: List of past plans via `useQuery(api.weeklyPlans.list)`. Click to view. Shows plan date and status badge (generato/modificato/archiviato).

- [ ] **Step 3: Create weekly plan page**

Create `apps/web/src/app/(user)/weekly-plan/page.tsx` — orchestrator:
- Subscription gate: `useQuery(api.subscriptions.getStatus)` — if never subscribed, show upgrade prompt with "Abbonati" button → `useAction(api.subscriptions.createCheckoutSession)` → redirect to Stripe
- If active or has past plans: show `<WeeklyPlanGenerator />` (active only) and/or `<WeeklyPlanView />` based on state
- `<WeeklyPlanHistory />` always visible below

- [ ] **Step 4: Verify app compiles**

Run: `cd /workspace && pnpm run build`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(user\)/weekly-plan apps/web/src/components/custom/shopping-list.tsx apps/web/src/components/custom/weekly-plan-generator.tsx apps/web/src/components/custom/weekly-plan-view.tsx apps/web/src/components/custom/weekly-plan-history.tsx
git commit -m "feat: add weekly plan page with AI generation, edit support, shopping list, and read-only mode"
```

---

### Task 17: Build progress tracking page

**Files:**
- Create: `apps/web/src/app/(user)/progress/page.tsx`
- Create: `apps/web/src/components/custom/weight-chart.tsx`

- [ ] **Step 1: Create weight chart component**

Create `apps/web/src/components/custom/weight-chart.tsx`:

```tsx
interface WeightChartProps {
  data: Array<{ date: string; weightKg: number }>;
}
```

**Implementation:** Pure SVG component, no external charting library.
- Fixed height (200px), responsive width (100% container)
- X-axis: dates (show every Nth label to avoid overlap)
- Y-axis: weight range (min-2kg to max+2kg of data, 5 gridlines)
- SVG `<polyline>` connecting data points
- Circles on each data point, showing tooltip with exact weight on hover
- Handle empty state: "Nessun dato disponibile" message

- [ ] **Step 2: Create progress page**

Create `apps/web/src/app/(user)/progress/page.tsx`:
- Weight log form (single input + "Registra" button)
- Weight chart showing trend via `<WeightChart data={weightLogs} />`
- Current macro targets display
- **Toast on recalculation:** When `weightLogs.log` mutation returns `{ recalculated: true, newMacros }`, show a `sonner` toast: "I tuoi target sono stati aggiornati in base al nuovo peso" with the new macro summary. Example:

```tsx
import { toast } from 'sonner';

const handleLogWeight = async (weight: number) => {
  const result = await logWeight({ weightKg: weight });
  if (result.recalculated) {
    toast.success('I tuoi target sono stati aggiornati in base al nuovo peso', {
      description: `Proteine: ${result.newMacros.proteinGrams}g · Carbo: ${Math.round(result.newMacros.carbGrams)}g · Grassi: ${result.newMacros.fatGrams}g`,
    });
  } else {
    toast.success('Peso registrato');
  }
};
```

- [ ] **Step 3: Verify app compiles**

Run: `cd /workspace && pnpm run build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(user\)/progress apps/web/src/components/custom/weight-chart.tsx
git commit -m "feat: add progress tracking page with weight chart and auto-recalculation"
```

---

### Task 18: Build settings page

**Files:**
- Create: `apps/web/src/app/(user)/settings/page.tsx`
- Create: `apps/web/src/components/custom/profile-edit-form.tsx`
- Create: `apps/web/src/components/custom/custom-food-list.tsx`
- Create: `apps/web/src/components/custom/template-list.tsx`

- [ ] **Step 1: Create sub-components**

**`profile-edit-form.tsx`**: Extract the onboarding form fields (steps 1-3: personal data, goal, dietary preferences) into a reusable form component. Accepts `defaultValues` prop pre-populated from the user profile. On submit calls `useMutation(api.userProfiles.update)`. Does NOT include the legal gate step (already accepted).

**`custom-food-list.tsx`**: Lists user's custom foods via `useQuery(api.foods.search, { category: undefined, searchTerm: undefined })` filtered to custom only. Shows food counter "73/100 alimenti personalizzati" via `useQuery(api.foods.getCustomFoodCount)`. Delete button per food (needs a `deleteCustomFood` mutation added to `foods.ts`).

**`template-list.tsx`**: Lists templates via `useQuery(api.templates.list)`. Delete button per template calls `useMutation(api.templates.remove)`.

- [ ] **Step 2: Create settings page**

Create `apps/web/src/app/(user)/settings/page.tsx` — composes the sub-components in sections:
- `<ProfileEditForm />` section
- `<CustomFoodList />` section
- `<TemplateList />` section
- Subscription section: shows status via `useQuery(api.subscriptions.getStatus)`, "Gestisci abbonamento" button calls `useMutation(api.subscriptions.createPortalSession)` and redirects to returned URL
- Logout button calls `authClient.signOut()`

- [ ] **Step 2: Verify app compiles**

Run: `cd /workspace && pnpm run build`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(user\)/settings
git commit -m "feat: add settings page with profile edit, food/template management, and subscription"
```

---

### Task 19: Build marketing pages

**Files:**
- Modify: `apps/web/src/app/(marketing)/page.tsx`
- Create: `apps/web/src/app/(marketing)/pricing/page.tsx`

- [ ] **Step 1: Build landing page**

Update `apps/web/src/app/(marketing)/page.tsx`:
- Hero section: tagline "La tua alimentazione basata su numeri, proporzioni e metodo."
- How it works: 3-step visual (Inserisci dati → Scegli cibi → Ottieni quantità)
- Free vs Premium comparison
- CTA buttons: "Inizia gratis" → signup, "Scopri Premium" → pricing
- Footer with legal disclaimer

- [ ] **Step 2: Build pricing page**

Create `apps/web/src/app/(marketing)/pricing/page.tsx`:
- Two cards: Free vs Premium (€4.99/mese)
- Feature comparison list
- CTA: "Inizia gratis" / "Abbonati"

- [ ] **Step 3: Verify app compiles**

Run: `cd /workspace && pnpm run build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(marketing\)
git commit -m "feat: add landing page and pricing page"
```

---

### Task 19b: Build auth pages and rewrite auth components

**Files:**
- Rewrite: `apps/web/src/components/custom/sign-in-form.tsx`
- Rewrite: `apps/web/src/components/custom/sign-up-form.tsx`
- Create: `apps/web/src/app/(marketing)/login/page.tsx`
- Create: `apps/web/src/app/(marketing)/signup/page.tsx`
- Modify: `apps/web/src/app/(user)/layout.tsx`

- [ ] **Step 1: Rewrite sign-in and sign-up form components**

Rewrite `apps/web/src/components/custom/sign-in-form.tsx` and `sign-up-form.tsx` to align with the app's UI (shadcn components, Tailwind styling, Italian labels). Each form:
- Uses shadcn `Input`, `Button`, `Label` components
- Italian labels: "Email", "Password", "Accedi" / "Crea account"
- Error handling with `sonner` toasts
- Sign-up form: on success redirects to `/onboarding`
- Sign-in form: on success redirects to `/dashboard`
- Link to the other form ("Hai già un account? Accedi" / "Non hai un account? Registrati")

- [ ] **Step 2: Create login page**

Create `apps/web/src/app/(marketing)/login/page.tsx`:

```tsx
import SignInForm from '@/components/custom/sign-in-form';

const LoginPage = () => (
  <div className="flex min-h-svh items-center justify-center px-4">
    <div className="w-full max-w-sm">
      <h1 className="mb-6 text-center text-2xl font-bold">Accedi a Ratio Diet</h1>
      <SignInForm />
    </div>
  </div>
);

export default LoginPage;
```

- [ ] **Step 3: Create signup page**

Create `apps/web/src/app/(marketing)/signup/page.tsx` — same structure, renders `SignUpForm`.

- [ ] **Step 4: Update auth guard redirect**

In `apps/web/src/app/(user)/layout.tsx`, change the unauthenticated redirect from `router.replace('/')` to `router.replace('/login')`.

- [ ] **Step 5: Update marketing CTAs**

In Task 19's landing page, link "Inizia gratis" to `/signup` and add "Accedi" link in the header/nav to `/login`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/custom/sign-in-form.tsx apps/web/src/components/custom/sign-up-form.tsx apps/web/src/app/\(marketing\)/login apps/web/src/app/\(marketing\)/signup apps/web/src/app/\(user\)/layout.tsx
git commit -m "feat: add auth pages with rewritten sign-in/sign-up components"
```

---

### Task 20: Add app shell navigation

**Files:**
- Create: `apps/web/src/components/custom/app-nav.tsx`
- Modify: `apps/web/src/app/(user)/layout.tsx`

- [ ] **Step 1: Create mobile-first bottom navigation**

Create `apps/web/src/components/custom/app-nav.tsx` — a fixed bottom navigation bar with icons for:
- Dashboard (home icon)
- Piano giornaliero (calendar icon)
- Piano settimanale (calendar-week icon — premium badge)
- Progressi (trending-up icon)
- Impostazioni (settings icon)

Uses lucide-react icons. Highlights active route.

- [ ] **Step 2: Add nav to user layout**

Update `apps/web/src/app/(user)/layout.tsx` to include the AppNav component at the bottom, with padding on the main content to account for the fixed nav.

- [ ] **Step 3: Verify app compiles**

Run: `cd /workspace && pnpm run build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/custom/app-nav.tsx apps/web/src/app/\(user\)/layout.tsx
git commit -m "feat: add mobile-first bottom navigation for user area"
```

---

### Task 21: Final lint, format, and cleanup

- [ ] **Step 1: Run Ultracite fix**

Run: `cd /workspace && pnpm dlx ultracite fix`

- [ ] **Step 2: Run type check**

Run: `cd /workspace && pnpm run check-types`

Fix any type errors found.

- [ ] **Step 3: Run build**

Run: `cd /workspace && pnpm run build`

Fix any build errors found.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore: lint, format, and fix type errors"
```

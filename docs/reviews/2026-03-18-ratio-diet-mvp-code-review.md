# Code Review Report — `feature/ratio-diet-mvp`

**Date:** 2026-03-18 **Branch:** `feature/ratio-diet-mvp` **Scope:** 188 files changed, ~19,190 additions across 30+ commits **Reviewers:** 4 parallel AI review agents (backend security, frontend pages, UI components, tests/config)

---

## Executive Summary

The backend is generally well-structured with consistent auth patterns, proper Stripe webhook signature verification, and good use of Convex's typed validators. The frontend follows React 19 conventions, files are well within size limits, and component decomposition is strong. However, 40 issues were identified across security, correctness, maintainability, and test coverage categories.

---

## 🚨 Critical Issues (5)

### C1 — Email Verification Disabled

**File:** `packages/backend/convex/auth.ts:32`

```typescript
requireEmailVerification: false,
```

Without email verification, an attacker can register with any email address (including someone else's), undermining account integrity and enabling account impersonation.

**Fix:** Enable `requireEmailVerification: true` before production launch. Add a CI gate to prevent deploying with this set to `false` on the production branch.

---

### C2 — Backend Tests Fail at Import Time

**File:** `packages/backend/vitest.config.ts`

Three of six backend test files fail at import time because `auth.ts` has a top-level `throw` when `SITE_URL` is not set:

```
Error: SITE_URL environment variable is required
  at convex/auth.ts:14:9
```

The tests only test pure exported helper functions, but because they import the entire module, the env guard fires before any test runs.

**Fix:** Add environment variables to the vitest config:

```ts
export default defineConfig({
  test: {
    globals: true,
    env: {
      BETTER_AUTH_SECRET: 'test-secret-for-vitest',
      SITE_URL: 'http://localhost:3001',
    },
  },
});
```

---

### C3 — Backend `package.json` Has No `test` Script

**File:** `packages/backend/package.json`

`vitest` is in `devDependencies` but there are no test scripts. `pnpm --filter @ratio-diet/backend test` fails, and CI pipelines using workspace-level `pnpm -r run test` silently skip backend tests.

**Fix:**

```json
"test": "vitest run",
"test:watch": "vitest"
```

---

### C4 — Sign-up Success Handler Called Even on Error

**File:** `apps/web/src/components/custom/sign-up-form.tsx:78-89`

```typescript
onSubmit: async ({ value }) => {
  try {
    await authClient.signUp.email(
      { ... },
      {
        onError: handleSignUpError,
        onSuccess: () => {},  // intentionally empty
      }
    );
    handleSignUpSuccess(router);  // called regardless of onError
  } catch (error) { ... }
},
```

If `authClient.signUp.email` does not throw on application-level errors (e.g. "email already registered") but calls `onError` instead, `handleSignUpSuccess` still executes — showing a success toast and navigating to `/onboarding` after a failed sign-up.

**Fix:** Move the success handler into the `onSuccess` callback, matching the sign-in pattern:

```typescript
{
  onError: handleSignUpError,
  onSuccess: () => handleSignUpSuccess(router),
}
```

---

### C5 — Duplicate `MealType` Definition

**Files:** `apps/web/src/components/custom/meal-builder.tsx:13-18` vs `packages/backend/convex/schema.ts:12`

`meal-builder.tsx` re-declares its own `MealType` union type that already exists in the backend schema. Two files (`day-view.tsx`, `plan-template-bar.tsx`) import from `meal-builder`, while `meal-item-row.tsx` correctly imports from the backend. If the backend type ever adds a new meal type, the frontend duplicate will silently diverge.

**Fix:** Delete the `MealType` export from `meal-builder.tsx` and import from the backend schema.

---

## ⚠️ High Priority Issues (11)

### H1 — No Rate Limiting on AI Generation

**File:** `packages/backend/convex/weeklyPlans.ts:267`

The `generate` action calls OpenRouter AI with up to 3 retries, with no per-user rate limiting. A malicious premium user could trigger unlimited AI API calls, incurring significant costs.

**Fix:** Track generation count per user over a 24-hour window. Throw `ConvexError({ code: 'RATE_LIMIT_EXCEEDED' })` if count >= 5.

---

### H2 — No Upper Bound on Weight Value in Logs

**File:** `packages/backend/convex/weightLogs.ts:107`

```typescript
if (args.weightKg <= 0) {
  throw new ConvexError({ code: 'INVALID_INPUT', ... });
}
```

`userProfiles.ts` correctly validates with `MAX_WEIGHT_KG = 500`, but the weight log mutation only checks for positive values. A user could submit `weightKg: 999999999`, producing NaN/Infinity values that propagate through macro calculations and the optimizer.

**Fix:**

```typescript
if (args.weightKg <= 0 || args.weightKg > MAX_WEIGHT_KG) {
  throw new ConvexError({ code: 'INVALID_INPUT', message: 'Peso non valido' });
}
```

---

### H3 — No Template Count Limit Per User

**File:** `packages/backend/convex/templates.ts`

The `save` mutation allows unlimited template creation. `foods.ts` wisely enforces `CUSTOM_FOOD_LIMIT = 100`, but templates have no equivalent limit. A malicious user could create thousands of templates, each with large meal arrays, consuming storage and degrading query performance.

**Fix:** Add `TEMPLATE_LIMIT = 50` with an assertion check before insertion, following the same pattern as `assertCustomFoodLimitNotReached` in `foods.ts`.

---

### H4 — No Meal/Item Array Size Limits

**Files:** `packages/backend/convex/dailyPlans.ts`, `packages/backend/convex/templates.ts`

The `optimize` mutation accepts `meals: v.array(mealInput)` where each meal contains `items: v.array(mealItemInput)` with no size bounds. An attacker could submit hundreds of meals with hundreds of items each, causing expensive database lookups and CPU-intensive optimizer iterations.

**Fix:**

```typescript
const MAX_MEALS_PER_PLAN = 6;
const MAX_ITEMS_PER_MEAL = 30;

if (args.meals.length > MAX_MEALS_PER_PLAN) throw new ConvexError(...);
for (const meal of args.meals) {
  if (meal.items.length > MAX_ITEMS_PER_MEAL) throw new ConvexError(...);
}
```

---

### H5 — No String Length Validation on Text Fields

**Files:** `packages/backend/convex/foods.ts`, `packages/backend/convex/templates.ts`

Food names, template names, categories, and allergen tags accept any string without length limits. A user could submit megabyte-long strings, wasting storage and potentially causing UI issues.

**Fix:**

- Food `name`: 1–200 chars
- Food `category`: 1–100 chars
- `allergenTags`: max 20 entries, each max 50 chars
- Template `name`: 1–100 chars

---

### H6 — Duplicate Onboarding Redirect

**Files:** `apps/web/src/app/(user)/layout.tsx`, `apps/web/src/app/(user)/dashboard/page.tsx`

The user layout has a `useProfileGuard` hook that redirects users without a profile to `/onboarding`. The dashboard page duplicates this redirect with its own `useEffect`, causing a double `useQuery(api.userProfiles.get)` call and competing redirect effects.

**Fix:** Remove the duplicate redirect from `dashboard/page.tsx`. The layout guard already handles this.

---

### H7 — `MacroSnapshot` Type Defined 4+ Times

**Files:** `daily-plan/page.tsx`, `dashboard-hero.tsx`, `dashboard-progress.tsx`, `plan-macro-summary.tsx`, `progress/page.tsx`

Each file defines its own version of `MacroSnapshot` with slightly different shapes. This is a DRY violation and a type safety hazard — the types can silently diverge, and `as` casts paper over mismatches.

**Fix:** Define canonical types in `apps/web/src/types/macros.ts` (`MacroTarget`, `MacroAchieved`, `MacroSummary`) and import everywhere.

---

### H8 — `getLocalDate`/`getTodayDate` Duplicated 3 Times

**Files:** `daily-plan/page.tsx:15-21`, `dashboard/page.tsx:12-18`, `progress/page.tsx:13-16`

All three pages define essentially the same date utility function with slightly different names.

**Fix:** Extract to `apps/web/src/lib/date-utils.ts` exporting `getLocalDateString()`.

---

### H9 — `AnyReactFormApi` Type + `eslint-disable` Duplicated 6 Times

**Files:** `sign-in-form.tsx`, `sign-up-form.tsx`, `step-personal.tsx`, `step-goal.tsx`, `step-dietary.tsx`, `step-legal.tsx`

Each file has:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyReactFormApi = ReactFormExtendedApi<any, any, any, any, any, any, any, any, any, any, any, any>;
```

**Fix:** Extract to `apps/web/src/lib/form-types.ts` with a single `eslint-disable` comment.

---

### H10 — Unsafe Type Assertions

**Files:** `profile-edit-form.tsx:264`, `weekly-plan-generator.tsx:24`, `daily-plan/page.tsx:106-108`

```typescript
// profile-edit-form.tsx
buildDefaultState(profile as unknown as ProfileFormState);

// weekly-plan-generator.tsx
onGenerated(planId as Id<'weeklyPlans'>);

// daily-plan/page.tsx
const macrosTarget = profile?.macros as MacroSnapshot | undefined;
```

These double casts bypass all type checking. If Convex-generated types change, these will silently produce incorrect data at runtime.

**Fix:** Use proper type narrowing or create explicit adapter functions.

---

### H11 — Profile Option Constants Duplicated

**Files:** `onboarding/types.ts`, `step-goal.tsx`, `step-dietary.tsx`, `profile-edit-form.tsx`

`ALLERGEN_OPTIONS`, `GOAL_OPTIONS`, `ACTIVITY_OPTIONS`, `DIETARY_OPTIONS`, and `toggleAllergen` are all defined multiple times across the onboarding flow and profile-edit form.

**Fix:** Centralize in `apps/web/src/lib/profile-options.ts` and import everywhere.

---

## 💡 Medium Priority Issues (14)

### M1 — Unknown Stripe Status Silently Defaults Without Logging

**File:** `packages/backend/convex/http.ts:76`

```typescript
const status = STATUS_MAP[subscription.status] ?? 'past_due';
```

If Stripe introduces a new subscription status not in `STATUS_MAP`, it silently defaults to `past_due`, potentially causing legitimate subscribers to lose access with no alert to the team.

**Fix:** Add `console.warn` when falling back to the default.

---

### M2 — `getWeekStartDate` Uses Server Timezone

**File:** `packages/backend/convex/weeklyPlans.ts:26-33`

Week start date is calculated using `new Date()` (server UTC time). A user in Italian timezone (UTC+1/+2) generating a plan late Sunday evening could get the wrong week.

**Fix:** Accept a `weekStartDate` string argument from the client, validated with `assertDateOnly`.

---

### M3 — Internal State Leaked in Optimizer Error Messages

**File:** `packages/backend/convex/lib/optimizer.ts:224-232`

The `ConvexError` thrown for unrecognized meal types includes `dailyMacros`, distribution keys, and partial results — all internal implementation details visible to the client.

**Fix:** Log details server-side with `console.error`, return a user-friendly message in the `ConvexError`.

---

### M4 — `stripeWebhookEvents` Table Grows Indefinitely

**File:** `packages/backend/convex/schema.ts:81-84`

The table is insert-only with no cleanup mechanism. Every processed webhook event is stored permanently.

**Fix:** Add a scheduled function that deletes events older than 365 days.

---

### M6 — Unauthenticated Food Search Access

**File:** `packages/backend/convex/foods.ts:164`

The `search`, `getCategories`, and `suggestForMacro` queries allow unauthenticated access. While CREA foods are public data, this is an undocumented decision and could be used for enumeration/scraping.

**Fix:** Implement auth check.

---

### M7 — Missing Callback Memoization on List Handlers

**File:** `apps/web/src/components/custom/meal-builder.tsx:112-130`

`handleAdd`, `handleRemove`, and `handleConstraintChange` are recreated on every render. Since each `FoodItemRow` receives these as props, every keystroke causes all rows to receive new function references.

**Fix:** Wrap handlers with `useCallback`.

---

### M8 — `useEffect` for State Sync in `meal-item-row.tsx`

**File:** `apps/web/src/components/custom/meal-item-row.tsx:23-32`

The `useEditState` hook uses `useEffect` to sync `qty` from props when `editing` is false. If `quantityGrams` changes while editing, the change is silently discarded. Also causes a brief flash of old value on render.

**Fix:** Derive the displayed value directly: `const displayQty = editing ? qty : initial.toString();`

---

### M9 — Fetching All Foods to Filter Custom Ones

**File:** `apps/web/src/components/custom/custom-food-list.tsx:72`

```typescript
const allFoods = useQuery(api.foods.search, {});
const customFoods = allFoods?.filter(isCustomFood) ?? [];
```

This fetches the entire food database (hundreds of CREA entries) to display only the user's custom foods.

**Fix:** Create a dedicated `api.foods.listCustom` backend query.

---

### M10 — `computeMacroGaps` Called Redundantly

**File:** `apps/web/src/components/custom/plan-macro-summary.tsx:43-57`

Both `hasBigGap` and `findGapMacro` call `computeMacroGaps` independently. Both are called on every render, computing the same array twice.

**Fix:** Compute gaps once and pass the result to both checks.

---

### M11 — `as TemplateDoc[]` Type Assertions on Convex Query Results

**File:** `apps/web/src/components/custom/plan-template-bar.tsx:172,178`

Casting Convex query results with `as TemplateDoc[]` masks potential type mismatches with the generated types.

**Fix:** Use Convex-generated return types directly.

---

### M13 — Missing `aria-busy`/Live Regions on Loading States

**Files:** Multiple

Loading placeholders (`<p className="text-muted-foreground">Caricamento...</p>`) are not announced to screen readers.

**Fix:** Add `aria-busy="true"` to loading containers and `role="status"` or `aria-live="polite"` to loading text.

---

### M14 — Radio Groups Lack Accessibility Grouping

**Files:** `onboarding/step-personal.tsx`, `step-goal.tsx`, `step-dietary.tsx`

Radio button groups have no `role="radiogroup"` or `aria-labelledby`, preventing screen readers from understanding the grouping.

**Fix:** Wrap radio groups in `<fieldset>`/`<legend>` or add `role="radiogroup"` with `aria-labelledby`.

---

## ✅ Low Priority / Nice to Have (10)

### L1 — Timezone Mismatch in Age Calculation

**File:** `packages/backend/convex/lib/calculations.ts:84`

`new Date(dateOfBirth)` parses date-only strings as UTC midnight, but `new Date()` uses local time. This can cause off-by-one age errors near midnight.

**Fix:** Use the `parseDateOnly` utility from `dateOnly.ts` consistently.

---

### L2 — Allergen Tags Are Free-form Strings

**File:** `packages/backend/convex/schema.ts:65`

Both `allergenTags` (foods) and `allergies` (user profiles) are `v.array(v.string())`. Allergen filtering relies on exact string matching — a typo silently causes missed allergen filtering, which is a food safety concern.

**Fix:** Define a union type for known allergens (like `mealTypeValidator`) with an "other" escape hatch.

---

### L3 — Duplicate Food IDs in Meal Items Not Validated

**File:** `packages/backend/convex/dailyPlans.ts`

If the same `foodId` appears twice in one meal, `buildConstraints` overwrites the first entry's constraints, causing confusing optimizer results.

**Fix:** merge duplicates.

---

### L4 — 15% Macro Gap Threshold May Be Too Generous

**File:** `packages/backend/convex/lib/optimizer.ts:40`

`GAP_THRESHOLD = 0.15` (15% tolerance) is quite generous for a diet/nutrition app. Users may expect tighter macro accuracy.

**Fix:** Set to 8%.

---

### L7 — `parseNum` Silently Coerces Invalid Input to 0

**File:** `apps/web/src/components/custom/custom-food-form.tsx:32`

```typescript
const parseNum = (val: string): number => parseFloat(val) || 0;
```

A user typing "abc" for calories submits 0 kcal silently.

**Fix:** Show a validation error for non-numeric input.

---

### L8 — Food Search Input Not Debounced

**File:** `apps/web/src/components/custom/food-selector.tsx:100`

Every keystroke fires a new Convex query.

**Fix:** Debounce the `term` value by 200–300ms. Use the existing use-debounce hook.

---

### L9 — Duplicate `handlePrint` Function

**Files:** `apps/web/src/components/custom/shopping-list.tsx`, `weekly-plan-view.tsx`

Both files define an identical `handlePrint` function.

**Fix:** Extract to a shared utility.

---

### L10 — `premiumAccess.test.ts` Tests Only 3 of 7+ Subscription Statuses

**File:** `packages/backend/convex/lib/premiumAccess.test.ts`

Only `active`, `trialing`, `past_due`, and `undefined` are tested. Other Stripe statuses (`canceled`, `unpaid`, `paused`, `incomplete`, `incomplete_expired`) are not explicitly covered.

**Fix:** Add `it.each` test cases for all defined statuses.

---

## 📊 Summary

| Severity  | Count  |
| --------- | ------ |
| Critical  | 5      |
| High      | 11     |
| Medium    | 14     |
| Low       | 10     |
| **Total** | **40** |

---

## 🎯 Top 5 Quick Wins

1. **Fix sign-up success handler** (C4) — move `handleSignUpSuccess` into `onSuccess` callback (1-line fix)
2. **Fix backend vitest config** (C2) — add `env: { SITE_URL, BETTER_AUTH_SECRET }` to vitest config
3. **Add `test` script to backend package.json** (C3) — add `"test": "vitest run"`
4. **Delete duplicate `MealType`** (C5) — import from backend schema instead
5. **Add rate limit check before AI generation** (H1) — timestamp check, ~10 lines

---

## 🏆 Strengths

- **Stripe webhook security is solid** — proper signature verification via `constructEvent`, idempotency via `claimWebhookEvent`, and internal mutations for state changes
- **Consistent auth pattern** — every public function uses `safeGetAuthUser(ctx)` with user data isolation via indexes
- **Clean monorepo separation** — business logic in `packages/backend`, UI in `apps/web`
- **File sizes well within limits** — largest backend file is 474 lines, largest frontend is 319
- **Good input validation** — dates validated with `assertDateOnly`, anthropometric values bounded, nutrition values non-negative
- **Prompt injection mitigation** — AI prompt sanitizes user text (strips control chars, truncates, JSON-escapes)
- **No XSS surface** — no `dangerouslySetInnerHTML` anywhere
- **Proper React 19 patterns** — no `forwardRef`, function components throughout
- **Accessibility in navigation** — `aria-current="page"`, `aria-label` on nav, `aria-hidden` on decorative icons
- **Form validation** uses Zod schemas throughout

---

## 📈 Missing Test Coverage (Priority Order)

| Priority | Module | Reason |
| --- | --- | --- |
| 1 | `dateOnly.ts` / `dateOfBirth.ts` | Input validators with legal implications (age verification). Pure functions, easy to test. |
| 2 | `shoppingList.ts` | Pure data transforms, user-facing output, aggregation bugs are silent. |
| 3 | `optimizer.ts` — `distributeMacrosToMeals` | Has branching logic and error throws, currently untested. |
| 4 | `calculations.ts` — `getAgeFromDateOfBirth` | Timezone-sensitive, has branching logic around birthday. |
| 5 | `weeklyPlanGenerator.ts` | Zod schemas and `validateWeeklyPlan` testable without mocking AI calls. |
| 6 | `onboarding-form.tsx` and step components | Multi-step form with complex validation, zero test coverage. |
| 7 | Auth flows | Sign-in, sign-up, session management completely untested. |
| 8 | Stripe webhook event handling | Critical path for subscription state, no integration tests. |

---

## 🔄 Top Refactoring Opportunities

1. **`weeklyPlans.ts`** (474 lines, near 500-line limit) → Split into `weeklyPlans/queries.ts`, `weeklyPlans/mutations.ts`, `weeklyPlans/actions.ts`
2. **`profile-edit-form.tsx`** (319 lines) → Extract form sections into sub-components
3. **`meal-item-row.tsx`** (201 lines) → Extract macro calculations to utility
4. **Standardize error handling** — use `ConvexError` consistently across all Convex functions
5. **Allergen type safety** — convert free-form allergen strings to a typed union

---

_Review performed by 4 parallel agents on 2026-03-18._ _Items C2, C3, C5, H1–H9, H11 were subsequently implemented and verified._

import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

import { allergenValidator } from './lib/validators';

export const mealTypeValidator = v.union(
  v.literal('colazione'),
  v.literal('pranzo'),
  v.literal('cena'),
  v.literal('spuntino_mattina'),
  v.literal('spuntino_pomeriggio')
);

export type MealType = 'colazione' | 'pranzo' | 'cena' | 'spuntino_mattina' | 'spuntino_pomeriggio';

const mealItemValidator = v.object({
  constraintMax: v.optional(v.number()),
  constraintMin: v.optional(v.number()),
  foodId: v.id('foods'),
  quantityGrams: v.number(),
});

const templateMealItemValidator = v.object({
  constraintMax: v.optional(v.number()),
  constraintMin: v.optional(v.number()),
  foodId: v.id('foods'),
  quantityGrams: v.optional(v.number()),
});

const mealValidator = v.object({
  items: v.array(mealItemValidator),
  type: mealTypeValidator,
});

const templateMealValidator = v.object({
  items: v.array(templateMealItemValidator),
  type: mealTypeValidator,
});

const macroAchievedSnapshotValidator = v.object({
  achievedCalories: v.number(),
  carbGrams: v.number(),
  fatGrams: v.number(),
  proteinGrams: v.number(),
});

const macroTargetSnapshotValidator = v.object({
  calorieTarget: v.number(),
  carbGrams: v.number(),
  fatGrams: v.number(),
  proteinGrams: v.number(),
  tdee: v.number(),
});

export default defineSchema({
  dailyPlans: defineTable({
    date: v.string(),
    macrosAchieved: macroAchievedSnapshotValidator,
    macrosTarget: macroTargetSnapshotValidator,
    meals: v.array(mealValidator),
    status: v.union(v.literal('draft'), v.literal('complete')),
    templateId: v.optional(v.id('templates')),
    userId: v.string(),
  }).index('by_userId_date', ['userId', 'date']),

  foods: defineTable({
    allergenTags: v.array(allergenValidator),
    carbPer100g: v.number(),
    category: v.string(),
    fatPer100g: v.number(),
    foodType: v.union(v.literal('animale'), v.literal('vegetale')),
    kcalPer100g: v.number(),
    name: v.string(),
    proteinPer100g: v.number(),
    source: v.union(v.literal('crea'), v.literal('custom')),
    userId: v.optional(v.string()),
  })
    .index('by_source', ['source'])
    .index('by_userId', ['userId'])
    .index('by_category', ['category'])
    .searchIndex('search_name', { filterFields: ['source', 'userId', 'category'], searchField: 'name' }),

  stripeWebhookEvents: defineTable({
    eventId: v.string(),
    processedAt: v.number(),
  }).index('by_eventId', ['eventId']),

  subscriptions: defineTable({
    nextRenewalDate: v.string(),
    startDate: v.string(),
    status: v.union(
      v.literal('incomplete'),
      v.literal('incomplete_expired'),
      v.literal('trialing'),
      v.literal('active'),
      v.literal('past_due'),
      v.literal('canceled'),
      v.literal('unpaid'),
      v.literal('paused')
    ),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    userId: v.string(),
  })
    .index('by_userId', ['userId'])
    .index('by_stripeSubscriptionId', ['stripeSubscriptionId'])
    .index('by_stripeCustomerId', ['stripeCustomerId']),

  templates: defineTable({
    meals: v.array(templateMealValidator),
    name: v.string(),
    userId: v.string(),
  }).index('by_userId', ['userId']),

  userProfiles: defineTable({
    activityLevel: v.union(
      v.literal('sedentario'),
      v.literal('leggermente_attivo'),
      v.literal('moderatamente_attivo'),
      v.literal('molto_attivo'),
      v.literal('atleta')
    ),
    allergies: v.array(allergenValidator),
    allergiesOther: v.optional(v.string()),
    bodyBuild: v.union(v.literal('snello'), v.literal('medio'), v.literal('robusto')),
    dateOfBirth: v.string(),
    dietaryPreference: v.union(
      v.literal('onnivoro'),
      v.literal('vegetariano'),
      v.literal('vegano'),
      v.literal('pescetariano')
    ),
    followedByNutritionist: v.boolean(),
    goal: v.union(
      v.literal('dimagrimento'),
      v.literal('mantenimento'),
      v.literal('aumento_massa'),
      v.literal('ricomposizione')
    ),
    heightCm: v.number(),
    lastRecalcWeightKg: v.number(),
    legalGateAccepted: v.boolean(),
    macros: macroTargetSnapshotValidator,
    sex: v.union(v.literal('M'), v.literal('F')),
    userId: v.string(),
    weightKg: v.number(),
  }).index('by_userId', ['userId']),

  weeklyPlans: defineTable({
    dailyPlanIds: v.array(v.id('dailyPlans')),
    shoppingList: v.array(
      v.object({
        category: v.string(),
        foodId: v.id('foods'),
        name: v.string(),
        totalGrams: v.number(),
      })
    ),
    status: v.union(v.literal('generato'), v.literal('modificato'), v.literal('archiviato')),
    userId: v.string(),
    weekStartDate: v.string(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_week', ['userId', 'weekStartDate']),

  weightLogs: defineTable({
    date: v.string(),
    macrosAtLog: macroTargetSnapshotValidator,
    userId: v.string(),
    weightKg: v.number(),
  }).index('by_userId_date', ['userId', 'date']),
});

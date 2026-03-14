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

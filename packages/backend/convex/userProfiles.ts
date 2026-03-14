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

type ProfileInput = {
  sex: 'M' | 'F';
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  bodyBuild: 'snello' | 'medio' | 'robusto';
  goal: 'dimagrimento' | 'mantenimento' | 'aumento_massa' | 'ricomposizione';
  activityLevel: 'sedentario' | 'leggermente_attivo' | 'moderatamente_attivo' | 'molto_attivo' | 'atleta';
  allergies: string[];
  allergiesOther?: string;
  dietaryPreference: 'onnivoro' | 'vegetariano' | 'vegano' | 'pescetariano';
  followedByNutritionist: boolean;
};

const computeProfileMacros = (args: ProfileInput) => {
  const age = getAgeFromDateOfBirth(args.dateOfBirth);
  return calculateMacros({
    sex: args.sex,
    ageYears: age,
    heightCm: args.heightCm,
    weightKg: args.weightKg,
    bodyBuild: args.bodyBuild,
    goal: args.goal,
    activityLevel: args.activityLevel,
  });
};

export const create = mutation({
  args: profileInputValidator,
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error('Non autenticato');

    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();

    if (existing) throw new Error('Profilo già esistente');

    const macros = computeProfileMacros(args);

    return await ctx.db.insert('userProfiles', {
      userId: user._id,
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
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
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
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();

    if (!profile) throw new Error('Profilo non trovato');

    const macros = computeProfileMacros(args);

    await ctx.db.patch(profile._id, {
      ...args,
      macros,
      lastRecalcWeightKg: args.weightKg,
    });
  },
});

import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { authComponent } from './auth';
import { calculateMacros, getAgeFromDateOfBirth } from './lib/calculations';
import { assertAdultDateOfBirth } from './lib/dateOfBirth';

const profileInputValidator = {
  activityLevel: v.union(
    v.literal('sedentario'),
    v.literal('leggermente_attivo'),
    v.literal('moderatamente_attivo'),
    v.literal('molto_attivo'),
    v.literal('atleta')
  ),
  allergies: v.array(v.string()),
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
  legalGateAccepted: v.literal(true),
  sex: v.union(v.literal('M'), v.literal('F')),
  weightKg: v.number(),
};

interface ProfileInput {
  sex: 'M' | 'F';
  dateOfBirth: string;
  heightCm: number;
  legalGateAccepted: true;
  weightKg: number;
  bodyBuild: 'snello' | 'medio' | 'robusto';
  goal: 'dimagrimento' | 'mantenimento' | 'aumento_massa' | 'ricomposizione';
  activityLevel: 'sedentario' | 'leggermente_attivo' | 'moderatamente_attivo' | 'molto_attivo' | 'atleta';
  allergies: string[];
  allergiesOther?: string;
  dietaryPreference: 'onnivoro' | 'vegetariano' | 'vegano' | 'pescetariano';
  followedByNutritionist: boolean;
}

const MAX_WEIGHT_KG = 500;
const MAX_HEIGHT_CM = 300;

const assertValidAnthropometrics = ({ heightCm, weightKg }: Pick<ProfileInput, 'heightCm' | 'weightKg'>): void => {
  if (weightKg <= 0 || weightKg > MAX_WEIGHT_KG) {
    throw new ConvexError({ code: 'INVALID_INPUT', message: 'Peso non valido' });
  }

  if (heightCm <= 0 || heightCm > MAX_HEIGHT_CM) {
    throw new ConvexError({ code: 'INVALID_INPUT', message: 'Altezza non valida' });
  }
};

const computeProfileMacros = (args: ProfileInput) => {
  const age = getAgeFromDateOfBirth(args.dateOfBirth);
  return calculateMacros({
    activityLevel: args.activityLevel,
    ageYears: age,
    bodyBuild: args.bodyBuild,
    goal: args.goal,
    heightCm: args.heightCm,
    sex: args.sex,
    weightKg: args.weightKg,
  });
};

export const create = mutation({
  args: profileInputValidator,
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();

    if (existing) {
      throw new ConvexError({ code: 'CONFLICT', message: 'Profilo già esistente' });
    }

    assertAdultDateOfBirth(args.dateOfBirth);
    assertValidAnthropometrics(args);
    const macros = computeProfileMacros(args);

    return await ctx.db.insert('userProfiles', {
      ...args,
      lastRecalcWeightKg: args.weightKg,
      macros,
      userId: user._id,
    });
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

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
    if (!user) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();

    if (!profile) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Profilo non trovato' });
    }

    assertAdultDateOfBirth(args.dateOfBirth);
    assertValidAnthropometrics(args);
    const macros = computeProfileMacros(args);

    await ctx.db.patch(profile._id, {
      ...args,
      lastRecalcWeightKg: args.weightKg,
      macros,
    });
  },
});

import { ConvexError, v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { authComponent } from './auth';
import { calculateMacros, getAgeFromDateOfBirth } from './lib/calculations';
import { assertDateOnly } from './lib/dateOnly';

const RECALC_THRESHOLD_KG = 2;
const DEFAULT_MAX_WEIGHT_LOGS = 1000;
const MAX_WEIGHT_KG = 500;

const shouldRecalculate = (currentWeight: number, lastRecalcWeight: number): boolean =>
  Math.abs(currentWeight - lastRecalcWeight) >= RECALC_THRESHOLD_KG;

const getSafeLimit = (limit: number | undefined): number => {
  if (limit === undefined) {
    return DEFAULT_MAX_WEIGHT_LOGS;
  }
  if (limit <= 0) {
    return 0;
  }
  return Math.min(limit, DEFAULT_MAX_WEIGHT_LOGS);
};

const buildNewMacros = (profile: Doc<'userProfiles'>, newWeight: number) => {
  const age = getAgeFromDateOfBirth(profile.dateOfBirth);
  return calculateMacros({
    activityLevel: profile.activityLevel,
    ageYears: age,
    bodyBuild: profile.bodyBuild,
    goal: profile.goal,
    heightCm: profile.heightCm,
    sex: profile.sex,
    weightKg: newWeight,
  });
};

const recalculateAndUpdateProfile = async (ctx: MutationCtx, profile: Doc<'userProfiles'>, newWeight: number) => {
  const newMacros = buildNewMacros(profile, newWeight);
  await ctx.db.patch(profile._id, {
    lastRecalcWeightKg: newWeight,
    macros: newMacros,
    weightKg: newWeight,
  });
  return newMacros;
};

const upsertWeightEntry = async (
  ctx: MutationCtx,
  userId: string,
  date: string,
  weightKg: number,
  macrosSnapshot: Doc<'userProfiles'>['macros']
) => {
  const existing = await ctx.db
    .query('weightLogs')
    .withIndex('by_userId_date', (qb) => qb.eq('userId', userId).eq('date', date))
    .unique();

  await (existing
    ? ctx.db.patch(existing._id, { macrosAtLog: macrosSnapshot, weightKg })
    : ctx.db.insert('weightLogs', {
        date,
        macrosAtLog: macrosSnapshot,
        userId,
        weightKg,
      }));
};

const getAuthenticatedProfile = async (ctx: MutationCtx, userId: string) => {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique();

  if (!profile) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Profilo non trovato' });
  }

  return profile;
};

const processWeightLog = async (ctx: MutationCtx, profile: Doc<'userProfiles'>, weightKg: number, date: string) => {
  if (!shouldRecalculate(weightKg, profile.lastRecalcWeightKg)) {
    await upsertWeightEntry(ctx, profile.userId, date, weightKg, profile.macros);
    return { recalculated: false };
  }

  const newMacros = await recalculateAndUpdateProfile(ctx, profile, weightKg);
  await upsertWeightEntry(ctx, profile.userId, date, weightKg, newMacros);
  return { newMacros, recalculated: true };
};

export const log = mutation({
  args: {
    date: v.string(),
    weightKg: v.number(),
  },
  handler: async (ctx, args) => {
    assertDateOnly(args.date);
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Non autenticato' });
    }

    if (args.weightKg <= 0 || args.weightKg > MAX_WEIGHT_KG) {
      throw new ConvexError({ code: 'INVALID_INPUT', message: `Il peso deve essere tra 0 e ${MAX_WEIGHT_KG} kg` });
    }

    const profile = await getAuthenticatedProfile(ctx, user._id);
    return await processWeightLog(ctx, profile, args.weightKg, args.date);
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    const weightQuery = ctx.db
      .query('weightLogs')
      .withIndex('by_userId_date', (q) => q.eq('userId', user._id))
      .order('desc');

    const safeLimit = getSafeLimit(args.limit);

    if (safeLimit <= 0) {
      return [];
    }

    return await weightQuery.take(safeLimit);
  },
});

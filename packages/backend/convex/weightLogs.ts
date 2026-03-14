import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { authComponent } from './auth';
import { calculateMacros, getAgeFromDateOfBirth } from './lib/calculations';

const RECALC_THRESHOLD_KG = 2;

const shouldRecalculate = (currentWeight: number, lastRecalcWeight: number): boolean =>
  Math.abs(currentWeight - lastRecalcWeight) >= RECALC_THRESHOLD_KG;

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
    throw new Error('Profilo non trovato');
  }

  return profile;
};

const processWeightLog = async (ctx: MutationCtx, profile: Doc<'userProfiles'>, weightKg: number) => {
  const [today] = new Date().toISOString().split('T');
  await upsertWeightEntry(ctx, profile.userId, today, weightKg, profile.macros);

  if (!shouldRecalculate(weightKg, profile.lastRecalcWeightKg)) {
    return { recalculated: false };
  }

  const newMacros = await recalculateAndUpdateProfile(ctx, profile, weightKg);
  return { newMacros, recalculated: true };
};

export const log = mutation({
  args: {
    weightKg: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error('Non autenticato');
    }

    const profile = await getAuthenticatedProfile(ctx, user._id);
    return await processWeightLog(ctx, profile, args.weightKg);
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

    if (args.limit) {
      return await weightQuery.take(args.limit);
    }
    return await weightQuery.collect();
  },
});

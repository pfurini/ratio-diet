import { v } from 'convex/values';

export const ALLERGEN_VALUES = ['glutine', 'lattosio', 'frutta_a_guscio', 'uova', 'crostacei', 'other'] as const;

export type AllergenTag = (typeof ALLERGEN_VALUES)[number];

export const allergenValidator = v.union(...ALLERGEN_VALUES.map((a) => v.literal(a)));

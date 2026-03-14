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
    expect(result.quantities[chickenBreast.id]).toBeGreaterThan(100);
    expect(result.quantities[rice.id]).toBeGreaterThan(200);
    expect(result.quantities[oliveOil.id]).toBeLessThan(30);
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
      foods: [oliveOil],
      constraints: {},
    });

    expect(result.success).toBe(false);
    expect(result.gap).toBeDefined();
  });
});

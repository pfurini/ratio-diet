import { optimizeMealQuantities } from './optimizer';

describe('optimizeMealQuantities', () => {
  const chickenBreast = {
    carbPer100g: 0,
    fatPer100g: 3.6,
    id: 'food_1',
    kcalPer100g: 165,
    proteinPer100g: 31,
  };

  const rice = {
    carbPer100g: 28,
    fatPer100g: 0.3,
    id: 'food_2',
    kcalPer100g: 130,
    proteinPer100g: 2.7,
  };

  const oliveOil = {
    carbPer100g: 0,
    fatPer100g: 100,
    id: 'food_3',
    kcalPer100g: 884,
    proteinPer100g: 0,
  };

  it('calculates reasonable quantities for a balanced meal', () => {
    const result = optimizeMealQuantities({
      constraints: {},
      foods: [chickenBreast, rice, oliveOil],
      macroTarget: { carbGrams: 70, fatGrams: 20, proteinGrams: 50 },
    });

    expect(result.success).toBeTruthy();
    expect(result.quantities[chickenBreast.id]).toBeGreaterThan(100);
    expect(result.quantities[rice.id]).toBeGreaterThan(200);
    expect(result.quantities[oliveOil.id]).toBeLessThan(30);
    for (const qty of Object.values(result.quantities)) {
      expect(qty).toBeGreaterThanOrEqual(0);
    }
  });

  it('respects max constraints', () => {
    const result = optimizeMealQuantities({
      constraints: { [chickenBreast.id]: { max: 100 } },
      foods: [chickenBreast, rice, oliveOil],
      macroTarget: { carbGrams: 70, fatGrams: 20, proteinGrams: 50 },
    });

    expect(result.success).toBeTruthy();
    expect(result.quantities[chickenBreast.id]).toBeLessThanOrEqual(100);
  });

  it('respects min constraints', () => {
    const result = optimizeMealQuantities({
      constraints: { [rice.id]: { min: 150 } },
      foods: [chickenBreast, rice, oliveOil],
      macroTarget: { carbGrams: 70, fatGrams: 20, proteinGrams: 50 },
    });

    expect(result.success).toBeTruthy();
    expect(result.quantities[rice.id]).toBeGreaterThanOrEqual(150);
  });

  it('caps individual foods at 500g by default', () => {
    const result = optimizeMealQuantities({
      constraints: {},
      foods: [chickenBreast],
      macroTarget: { carbGrams: 10, fatGrams: 10, proteinGrams: 200 },
    });

    expect(result.success).toBeFalsy();
    expect(result.quantities[chickenBreast.id]).toBeLessThanOrEqual(500);
  });

  it('returns success false when macro gap exceeds 15%', () => {
    const result = optimizeMealQuantities({
      constraints: {},
      foods: [oliveOil],
      macroTarget: { carbGrams: 100, fatGrams: 100, proteinGrams: 100 },
    });

    expect(result.success).toBeFalsy();
    expect(result.gap).toBeDefined();
  });
});

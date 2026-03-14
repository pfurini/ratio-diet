import { calculateMacros } from './calculations';

describe(calculateMacros, () => {
  it('calculates correctly for a 30yo male, 80kg, 180cm, moderately active, maintenance', () => {
    const result = calculateMacros({
      activityLevel: 'moderatamente_attivo',
      ageYears: 30,
      bodyBuild: 'medio',
      goal: 'mantenimento',
      heightCm: 180,
      sex: 'M',
      weightKg: 80,
    });

    // BMR = (10*80) + (6.25*180) - (5*30) + 5 = 800 + 1125 - 150 + 5 = 1780
    // Corporatura medio = 1.0, so BMR stays 1780
    // TDEE = 1780 * 1.55 = 2759
    // Mantenimento: calorie target = 2759
    // Proteine: 1.6 * 80 = 128g (512 kcal)
    // Grassi: 1.0 * 80 = 80g (720 kcal)
    // Carbo: (2759 - 512 - 720) / 4 = 381.75g
    expect(result.tdee).toBe(2759);
    expect(result.calorieTarget).toBe(2759);
    expect(result.proteinGrams).toBe(128);
    expect(result.fatGrams).toBe(80);
    expect(result.carbGrams).toBeCloseTo(381.75, 0);
  });

  it('calculates correctly for a 45yo female, 65kg, 165cm, sedentary, dimagrimento', () => {
    const result = calculateMacros({
      activityLevel: 'sedentario',
      ageYears: 45,
      bodyBuild: 'snello',
      goal: 'dimagrimento',
      heightCm: 165,
      sex: 'F',
      weightKg: 65,
    });

    // BMR = (10*65) + (6.25*165) - (5*45) - 161 = 650 + 1031.25 - 225 - 161 = 1295.25
    // Corporatura snello = 0.95: 1295.25 * 0.95 = 1230.4875
    // TDEE = 1230.4875 * 1.2 = 1476.585 → round to 1477
    // Dimagrimento: 1477 - 500 = 977
    // Proteine: 2.0 * 65 = 130g (520 kcal)
    // Grassi: 0.8 * 65 = 52g (468 kcal)
    // Carbo: (977 - 520 - 468) / 4 = -2.75 → floored to 0
    expect(result.tdee).toBe(1477);
    expect(result.calorieTarget).toBe(977);
    expect(result.proteinGrams).toBe(130);
    expect(result.fatGrams).toBe(52);
    expect(result.carbGrams).toBe(0);
  });

  it('applies ricomposizione adjustments', () => {
    const result = calculateMacros({
      activityLevel: 'molto_attivo',
      ageYears: 35,
      bodyBuild: 'robusto',
      goal: 'ricomposizione',
      heightCm: 175,
      sex: 'M',
      weightKg: 85,
    });

    // Proteine should be 2.4 g/kg for ricomposizione
    expect(result.proteinGrams).toBe(204);
    // Grassi should be 0.9 g/kg
    expect(result.fatGrams).toBe(76.5);
    // Calorie target = TDEE - 150
    expect(result.calorieTarget).toBe(result.tdee - 150);
  });
});

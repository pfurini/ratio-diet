import { buildTemplateInsertDoc } from './templates';

describe('buildTemplateInsertDoc', () => {
  it('allows template meal items without quantityGrams', () => {
    const doc = buildTemplateInsertDoc('user_1', {
      meals: [{ items: [{ foodId: 'food_1' }], type: 'pranzo' }],
      name: 'Template A',
    });

    expect(doc.meals[0]?.items[0]).toStrictEqual({ foodId: 'food_1' });
  });

  it('keeps quantityGrams when provided', () => {
    const doc = buildTemplateInsertDoc('user_1', {
      meals: [{ items: [{ foodId: 'food_1', quantityGrams: 120 }], type: 'pranzo' }],
      name: 'Template B',
    });

    expect(doc.meals[0]?.items[0]?.quantityGrams).toBe(120);
  });
});

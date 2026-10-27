import { describe, expect, it } from 'vitest';
import { EMPTY_PER100, type Per100 } from './nutrients';
import { computeRecipe, type RecipeIngredient } from './recipe';

const zeros: Per100 = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, sodium_mg: 0, sat_fat_g: 0 };

const dal: RecipeIngredient[] = [
  {
    name: 'toor dal, raw',
    rawGrams: 500,
    per100: { kcal: 343, protein_g: 22.3, carbs_g: 57.6, fat_g: 1.7, fibre_g: 16.5, sodium_mg: 17, sat_fat_g: 0.4 },
  },
  { name: 'ghee', rawGrams: 20, per100: { ...zeros, kcal: 900, fat_g: 100, sat_fat_g: 62 } },
  {
    name: 'onion',
    rawGrams: 200,
    per100: { kcal: 40, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1, fibre_g: 1.7, sodium_mg: 4, sat_fat_g: 0 },
  },
  { name: 'water', rawGrams: 1000, per100: zeros },
];

describe('computeRecipe', () => {
  const r = computeRecipe({ ingredients: dal, cookedYieldG: 1500, servings: 5 });

  it('totals from raw weights', () => {
    expect(r.totalRawG).toBe(1720);
    expect(r.total.kcal).toBeCloseTo(1975, 6);
    expect(r.total.protein_g).toBeCloseTo(111.5 + 2.2, 6);
  });

  it('per serving is total over servings', () => {
    expect(r.perServing.kcal).toBeCloseTo(395, 6);
    expect(r.perServingGrams).toBe(300);
  });

  it('per 100 g cooked is total over cooked yield', () => {
    expect(r.per100Cooked.kcal).toBeCloseTo(131.67, 2);
    expect(r.per100Cooked.fibre_g).toBeCloseTo(((82.5 + 3.4) / 1500) * 100, 6);
  });

  it('one unknown ingredient value makes that nutrient unknown', () => {
    const withUnknown = [...dal, { name: 'salt', rawGrams: 8, per100: { ...EMPTY_PER100, kcal: 0 } }];
    const u = computeRecipe({ ingredients: withUnknown, cookedYieldG: 1500, servings: 5 });
    expect(u.total.kcal).toBeCloseTo(1975, 6);
    expect(u.total.sodium_mg).toBeNull();
    expect(u.perServing.sodium_mg).toBeNull();
  });

  it('rejects zero yield or servings', () => {
    expect(() => computeRecipe({ ingredients: dal, cookedYieldG: 0, servings: 5 })).toThrow(RangeError);
    expect(() => computeRecipe({ ingredients: dal, cookedYieldG: 1500, servings: 0 })).toThrow(RangeError);
  });
});

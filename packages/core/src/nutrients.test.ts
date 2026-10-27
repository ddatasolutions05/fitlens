import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_LABELS,
  EMPTY_PER100,
  NUTRIENT_KEYS,
  formatNutrient,
  kcalRange,
  remaining,
  roundGrams,
  roundKcal,
  scaleNutrients,
  sumNutrients,
  type Per100,
} from './nutrients';

const rice: Per100 = { kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, fibre_g: 0.4, sodium_mg: null, sat_fat_g: null };

describe('scaleNutrients', () => {
  it('scales by grams and fraction eaten', () => {
    const r = scaleNutrients(rice, 200, 0.5);
    expect(r.kcal).toBeCloseTo(130, 6);
    expect(r.protein_g).toBeCloseTo(2.7, 6);
  });

  it('keeps nulls null', () => {
    const r = scaleNutrients(rice, 150);
    expect(r.sodium_mg).toBeNull();
    expect(r.sat_fat_g).toBeNull();
    expect(scaleNutrients(EMPTY_PER100, 100)).toEqual(EMPTY_PER100);
  });

  it('keeps known zeros as zero', () => {
    expect(scaleNutrients({ ...EMPTY_PER100, kcal: 0 }, 300).kcal).toBe(0);
  });
});

describe('sumNutrients', () => {
  it('sums known values and counts unknowns', () => {
    const r = sumNutrients([rice, { ...rice, sodium_mg: 400 }, { ...EMPTY_PER100, kcal: 50 }]);
    expect(r.itemCount).toBe(3);
    expect(r.totals.kcal).toBe(310);
    expect(r.totals.sodium_mg).toBe(400);
    expect(r.unknown.sodium_mg).toBe(2);
    expect(r.unknown.kcal).toBe(0);
    expect(r.unknown.protein_g).toBe(1);
  });

  it('is null when every value is unknown', () => {
    const r = sumNutrients([rice, rice]);
    expect(r.totals.sat_fat_g).toBeNull();
    expect(r.unknown.sat_fat_g).toBe(2);
  });

  it('empty list totals null', () => {
    const r = sumNutrients([]);
    for (const k of NUTRIENT_KEYS) expect(r.totals[k]).toBeNull();
    expect(r.itemCount).toBe(0);
  });
});

describe('rounding and formatting', () => {
  it('rounds', () => {
    expect(roundKcal(1974)).toBe(1970);
    expect(roundKcal(1975)).toBe(1980);
    expect(roundKcal(null)).toBeNull();
    expect(roundGrams(27.6)).toBe(28);
    expect(roundGrams(null)).toBeNull();
  });

  it('formats', () => {
    expect(formatNutrient(1954, 'kcal')).toBe('1,950 kcal');
    expect(formatNutrient(28.4, 'g')).toBe('28 g');
    expect(formatNutrient(2.75, 'g')).toBe('3 g');
    expect(formatNutrient(643, 'mg')).toBe('643 mg');
    expect(formatNutrient(null, 'g')).toBe('unknown');
  });
});

describe('kcalRange', () => {
  it('applies grams, fraction and extras', () => {
    expect(kcalRange({ per100Kcal: 130, gramsRange: [150, 250], fractionEaten: 1 })).toEqual([195, 325]);
    expect(
      kcalRange({ per100Kcal: 130, gramsRange: [150, 250], fractionEaten: 0.5, extraKcalRange: [40, 120] }),
    ).toEqual([138, 283]);
  });

  it('is null when kcal is unknown', () => {
    expect(kcalRange({ per100Kcal: null, gramsRange: [100, 200], fractionEaten: 1 })).toBeNull();
  });
});

describe('remaining', () => {
  it('handles unknowns and overshoot', () => {
    expect(remaining(1800, 1200)).toBe(600);
    expect(remaining(1800, 1950)).toBe(-150);
    expect(remaining(null, 1200)).toBeNull();
    expect(remaining(1800, null)).toBeNull();
  });

  it('labels every confidence level', () => {
    expect(Object.keys(CONFIDENCE_LABELS)).toEqual(['low', 'medium', 'high']);
  });
});

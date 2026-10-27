import { describe, expect, it } from 'vitest';
import { FAT_OPTIONS, FAT_PER100, HOUSEHOLD_UNITS, unitToGrams } from './household';

describe('household units', () => {
  it('converts known units', () => {
    expect(unitToGrams('oil', '1 tbsp')).toBe(13.5);
    expect(unitToGrams('roti', 'medium', 2)).toBe(80);
    expect(unitToGrams('katori', 'Large')).toBe(200);
    expect(unitToGrams('dal_cooked', '1 katori thick')).toBe(180);
    expect(unitToGrams('cup', '1 cup', 0.5)).toBe(120);
  });

  it('returns null for unknown units or labels', () => {
    expect(unitToGrams('spoon', '1 tsp')).toBeNull();
    expect(unitToGrams('roti', 'huge')).toBeNull();
    expect(unitToGrams('roti', 'small', -1)).toBeNull();
  });

  it('has every expected key', () => {
    expect(Object.keys(HOUSEHOLD_UNITS).sort()).toEqual(
      ['bowl', 'butter', 'cup', 'dal_cooked', 'egg', 'ghee', 'katori', 'oil', 'paratha', 'rice_cooked', 'roti', 'slice_bread'].sort(),
    );
  });

  it('fat options match the household grams', () => {
    for (const o of FAT_OPTIONS) {
      if (o.fat === 'none') {
        expect(o.grams).toBe(0);
        continue;
      }
      const label = o.label.replace(` ${o.fat}`, '');
      expect(unitToGrams(o.fat, label)).toBe(o.grams);
      expect(FAT_PER100[o.fat].kcal).not.toBeNull();
    }
    expect(FAT_OPTIONS).toHaveLength(8);
  });
});

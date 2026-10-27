import { describe, expect, it } from 'vitest';
import { readIndianSeed, validateIndianSeed } from './sources/indian';

const dishes = readIndianSeed();

describe('indian_dishes.json', () => {
  it('has the expected rows with unique slugs', () => {
    expect(dishes.length).toBeGreaterThanOrEqual(60);
    expect(dishes).toHaveLength(86);
    expect(new Set(dishes.map((d) => d.slug)).size).toBe(dishes.length);
  });

  it('resolves every variant_of to a base row', () => {
    const slugs = new Map(dishes.map((d) => [d.slug, d]));
    const variants = dishes.filter((d) => d.variant_of !== null);
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      const base = slugs.get(v.variant_of ?? '');
      expect(base, v.slug).toBeDefined();
      expect(base?.variant_of, v.slug).toBeNull();
      expect(v.variant_label, v.slug).toBeTruthy();
    }
  });

  it('has servings with grams > 0', () => {
    for (const d of dishes) {
      expect(d.servings.length, d.slug).toBeGreaterThan(0);
      for (const s of d.servings) expect(s.grams, `${d.slug} ${s.label}`).toBeGreaterThan(0);
      expect(d.default_serving_g, d.slug).toBeGreaterThan(0);
    }
  });

  it('has kcal within 20% of 4/4/9 from macros', () => {
    for (const d of dishes) {
      const fromMacros = 4 * d.protein_g + 4 * d.carbs_g + 9 * d.fat_g;
      expect(Math.abs(d.kcal - fromMacros) / fromMacros, d.slug).toBeLessThanOrEqual(0.2);
    }
  });

  it('rejects a variant whose base is missing', () => {
    const bad = { foods: [{ ...dishes[0], slug: 'x', variant_of: 'nope', variant_label: 'y' }] };
    expect(() => validateIndianSeed(bad)).toThrow(/variant_of nope not found/);
  });
});

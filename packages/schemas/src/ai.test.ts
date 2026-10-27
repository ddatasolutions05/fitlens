import { describe, expect, it } from 'vitest';

import { analyzeMealResponseSchema, extractJson, labelReadSchema } from './ai';

const valid = {
  items: [
    {
      name: 'Scrambled eggs',
      dish_type: 'eggs',
      cuisine: 'western',
      prep_method_assumed: 'scrambled in butter',
      portion_g_estimate: 120,
      portion_g_range: [90, 150],
      household_unit_estimate: '2 eggs',
      hidden_ingredients_assumed: ['butter'],
      db_query_terms: ['egg scrambled', 'eggs'],
      confidence: 'medium',
      uncertainty_drivers: ['count of eggs'],
    },
  ],
  packaged_items: [{ name: 'Pork sausage', reason: 'Nutrition varies by brand; scan the label or barcode.' }],
  questions: [
    { item_ref: 'Scrambled eggs', question: 'How many eggs?', quick_options: ['1', '2', '3'], affects: 'servings' },
    { item_ref: 'Scrambled eggs', question: 'What fat was used?', quick_options: ['none', '1 tsp butter', '1 tbsp butter', '1 tsp oil'], affects: 'fat' },
  ],
};

describe('analyzeMealResponseSchema', () => {
  it('accepts a well-formed response', () => {
    expect(analyzeMealResponseSchema.parse(valid)).toMatchObject(valid);
  });

  it('rejects more than four questions', () => {
    const q = valid.questions[0]!;
    const r = analyzeMealResponseSchema.safeParse({ ...valid, questions: [q, q, q, q, q] });
    expect(r.success).toBe(false);
  });

  it('rejects an invalid confidence and extra free text fields are stripped', () => {
    const bad = analyzeMealResponseSchema.safeParse({ ...valid, items: [{ ...valid.items[0], confidence: '80%' }] });
    expect(bad.success).toBe(false);
    const stripped = analyzeMealResponseSchema.parse({ ...valid, commentary: 'Looks tasty' });
    expect('commentary' in stripped).toBe(false);
  });

  it('rejects a question with a single option', () => {
    const r = analyzeMealResponseSchema.safeParse({ ...valid, questions: [{ ...valid.questions[0], quick_options: ['1'] }] });
    expect(r.success).toBe(false);
  });
});

describe('labelReadSchema', () => {
  it('keeps unknown values as null', () => {
    const r = labelReadSchema.parse({
      product_name: null,
      brand: null,
      serving_size_text: '1 bar (40 g)',
      serving_size_g: 40,
      servings_per_container: null,
      per_serving: { kcal: 180, protein_g: 10, carbs_g: 20, fat_g: 6, fibre_g: null, sodium_mg: 120, sat_fat_g: null },
      confidence: 'high',
      notes: [],
    });
    expect(r.per_serving.fibre_g).toBeNull();
  });
});

describe('extractJson', () => {
  it('reads fenced and unfenced objects', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure: {"a": {"b": 2}} done')).toEqual({ a: { b: 2 } });
  });
  it('throws when nothing looks like JSON', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});

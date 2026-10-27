import { EMPTY_PER100, NUTRIENT_KEYS, scaleNutrients, type Per100 } from './nutrients';

export interface RecipeIngredient {
  name: string;
  rawGrams: number;
  per100: Per100;
}

export interface RecipeResult {
  totalRawG: number;
  cookedYieldG: number;
  servings: number;
  total: Per100;
  perServing: Per100;
  per100Cooked: Per100;
  perServingGrams: number;
}

function divide(p: Per100, by: number): Per100 {
  const out = { ...EMPTY_PER100 };
  for (const key of NUTRIENT_KEYS) {
    const v = p[key];
    out[key] = v == null ? null : v / by;
  }
  return out;
}

/**
 * Totals from raw ingredient weights, then split by servings or by cooked
 * weight. A nutrient is null in the result if any ingredient has it unknown,
 * since a partial total would read as complete.
 */
export function computeRecipe(i: { ingredients: RecipeIngredient[]; cookedYieldG: number; servings: number }): RecipeResult {
  if (!(i.cookedYieldG > 0)) throw new RangeError('cookedYieldG must be greater than 0');
  if (!(i.servings > 0)) throw new RangeError('servings must be greater than 0');

  const total = { ...EMPTY_PER100 };
  if (i.ingredients.length > 0) {
    const scaled = i.ingredients.map((ing) => scaleNutrients(ing.per100, ing.rawGrams));
    for (const key of NUTRIENT_KEYS) {
      let sum: number | null = 0;
      for (const s of scaled) {
        const v = s[key];
        sum = v == null || sum == null ? null : sum + v;
      }
      total[key] = sum;
    }
  }

  return {
    totalRawG: i.ingredients.reduce((sum, ing) => sum + ing.rawGrams, 0),
    cookedYieldG: i.cookedYieldG,
    servings: i.servings,
    total,
    perServing: divide(total, i.servings),
    per100Cooked: divide(total, i.cookedYieldG / 100),
    perServingGrams: i.cookedYieldG / i.servings,
  };
}

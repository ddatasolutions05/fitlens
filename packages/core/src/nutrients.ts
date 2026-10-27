import { formatInt, formatNumber } from './format';

/** Nutrients per 100 g. Null means unknown, never zero. */
export interface Per100 {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  sodium_mg: number | null;
  sat_fat_g: number | null;
}

export const NUTRIENT_KEYS: (keyof Per100)[] = [
  'kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fibre_g',
  'sodium_mg',
  'sat_fat_g',
];

export const EMPTY_PER100: Per100 = {
  kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  fibre_g: null,
  sodium_mg: null,
  sat_fat_g: null,
};

function mapNutrients(fn: (key: keyof Per100) => number | null): Per100 {
  const out = { ...EMPTY_PER100 };
  for (const key of NUTRIENT_KEYS) out[key] = fn(key);
  return out;
}

/** Amounts for `grams` of a food, times the fraction eaten. Nulls stay null. */
export function scaleNutrients(per100: Per100, grams: number, fractionEaten = 1): Per100 {
  const factor = (grams / 100) * fractionEaten;
  return mapNutrients((key) => {
    const v = per100[key];
    return v == null ? null : v * factor;
  });
}

export interface NutrientTotals {
  totals: Per100;
  unknown: Record<keyof Per100, number>;
  itemCount: number;
}

/**
 * Sums known values per nutrient and counts unknowns. A nutrient with no known
 * value (including an empty list) totals null.
 */
export function sumNutrients(items: Per100[]): NutrientTotals {
  const unknown = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Record<keyof Per100, number>;
  const totals = mapNutrients((key) => {
    let sum: number | null = null;
    for (const item of items) {
      const v = item[key];
      if (v == null) unknown[key] += 1;
      else sum = (sum ?? 0) + v;
    }
    return sum;
  });
  return { totals, unknown, itemCount: items.length };
}

export function roundKcal(n: number | null): number | null {
  return n == null ? null : Math.round(n / 10) * 10;
}

export function roundGrams(n: number | null): number | null {
  return n == null ? null : Math.round(n);
}

/** Display string. Null shows as 'unknown'. Grams under 10 keep one decimal. */
export function formatNutrient(value: number | null, unit: 'kcal' | 'g' | 'mg' | 'ml'): string {
  if (value == null) return 'unknown';
  if (unit === 'g' && Math.abs(value) < 10) return `${formatNumber(value, 1)} g`;
  return `${formatInt(value)} ${unit}`;
}

/** Low and high kcal for a portion range, whole kcal. Null when kcal per 100 g is unknown. */
export function kcalRange(i: {
  per100Kcal: number | null;
  gramsRange: [number, number];
  fractionEaten: number;
  extraKcalRange?: [number, number];
}): [number, number] | null {
  if (i.per100Kcal == null) return null;
  const [g0, g1] = i.gramsRange;
  const [e0, e1] = i.extraKcalRange ?? [0, 0];
  const lo = (i.per100Kcal * Math.min(g0, g1) * i.fractionEaten) / 100 + Math.min(e0, e1);
  const hi = (i.per100Kcal * Math.max(g0, g1) * i.fractionEaten) / 100 + Math.max(e0, e1);
  return [Math.round(lo), Math.round(hi)];
}

/** Target minus eaten. Null when either side is unknown. Can be negative. */
export function remaining(target: number | null, eaten: number | null): number | null {
  if (target == null || eaten == null) return null;
  return target - eaten;
}

export type Confidence = 'low' | 'medium' | 'high';

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  low: 'Rough estimate',
  medium: 'Fair estimate',
  high: 'Close estimate',
};

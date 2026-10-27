import { resolve } from 'node:path';

export const repoRoot = resolve(import.meta.dirname, '..', '..');
export const rawDir = resolve(repoRoot, 'supabase', 'seed', 'data', 'raw');

export type SharedSource = 'usda' | 'cnf' | 'ifct';

export interface Serving {
  label: string;
  grams: number;
}

// One shared food row, nutrients per 100 g. Null means unknown.
export interface FoodRow {
  source: SharedSource;
  sourceRef: string;
  name: string;
  verified: boolean;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fibreG: number | null;
  sodiumMg: number | null;
  satFatG: number | null;
  defaultServingG: number | null;
  // source_ref of the base food in the same source
  variantOfRef: string | null;
  variantLabel: string | null;
  attribution: string;
  servings: Serving[];
}

export function toNumber(s: string | undefined): number | null {
  if (s === undefined) return null;
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

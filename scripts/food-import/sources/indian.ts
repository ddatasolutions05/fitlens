// Curated Indian dishes and staples from supabase/seed/indian_dishes.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, type FoodRow, type Serving } from '../types';

export const INDIAN_SEED_PATH = join(repoRoot, 'supabase', 'seed', 'indian_dishes.json');
const ATTRIBUTION = 'Compiled from IFCT 2017 published values and typical recipes; approximate';

export interface IndianDish {
  slug: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number | null;
  sodium_mg: number | null;
  sat_fat_g: number;
  default_serving_g: number;
  variant_of: string | null;
  variant_label: string | null;
  servings: Serving[];
}

const REQUIRED_NUMBERS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'sat_fat_g', 'default_serving_g'] as const;
const NULLABLE_NUMBERS = ['fibre_g', 'sodium_mg'] as const;

// Structural check of the seed file. Throws with every problem found.
export function validateIndianSeed(data: unknown): IndianDish[] {
  const errors: string[] = [];
  const foods = (data as { foods?: unknown })?.foods;
  if (!Array.isArray(foods)) throw new Error('indian seed: "foods" must be an array');
  const slugs = new Set<string>();
  foods.forEach((f: Record<string, unknown>, i) => {
    const at = `foods[${i}]${typeof f?.slug === 'string' ? ` (${f.slug})` : ''}`;
    if (typeof f !== 'object' || f === null) {
      errors.push(`${at}: not an object`);
      return;
    }
    if (typeof f.slug !== 'string' || !/^[a-z0-9_]+$/.test(f.slug)) errors.push(`${at}: bad slug`);
    else if (slugs.has(f.slug)) errors.push(`${at}: duplicate slug`);
    else slugs.add(f.slug);
    if (typeof f.name !== 'string' || !f.name.trim()) errors.push(`${at}: missing name`);
    for (const k of REQUIRED_NUMBERS) {
      if (typeof f[k] !== 'number' || !Number.isFinite(f[k]) || (f[k] as number) < 0) errors.push(`${at}: ${k} must be a number >= 0`);
    }
    for (const k of NULLABLE_NUMBERS) {
      if (!(k in f)) errors.push(`${at}: ${k} missing (use null when unknown)`);
      else if (f[k] !== null && (typeof f[k] !== 'number' || (f[k] as number) < 0)) errors.push(`${at}: ${k} must be a number or null`);
    }
    const isVariant = f.variant_of !== null;
    if (isVariant && typeof f.variant_of !== 'string') errors.push(`${at}: variant_of must be a slug or null`);
    if (isVariant !== (typeof f.variant_label === 'string' && f.variant_label.trim() !== '')) {
      errors.push(`${at}: variant_of and variant_label must be set together`);
    }
    if (!Array.isArray(f.servings) || f.servings.length === 0) errors.push(`${at}: needs at least one serving`);
    else {
      for (const s of f.servings as Record<string, unknown>[]) {
        if (typeof s?.label !== 'string' || !s.label.trim()) errors.push(`${at}: serving without label`);
        if (typeof s?.grams !== 'number' || !(s.grams > 0)) errors.push(`${at}: serving grams must be > 0`);
      }
    }
  });
  const bySlug = new Map((foods as IndianDish[]).map((f) => [f.slug, f]));
  for (const f of foods as IndianDish[]) {
    if (f.variant_of === null) continue;
    const base = bySlug.get(f.variant_of);
    if (!base) errors.push(`${f.slug}: variant_of ${f.variant_of} not found`);
    else if (base.variant_of !== null) errors.push(`${f.slug}: base ${f.variant_of} is itself a variant`);
  }
  if (errors.length) throw new Error(`indian seed invalid:\n${errors.join('\n')}`);
  return foods as IndianDish[];
}

export function readIndianSeed(path = INDIAN_SEED_PATH): IndianDish[] {
  return validateIndianSeed(JSON.parse(readFileSync(path, 'utf8')));
}

export async function loadIndian(): Promise<FoodRow[]> {
  const rows = readIndianSeed().map(
    (d): FoodRow => ({
      source: 'ifct',
      sourceRef: `curated:${d.slug}`,
      name: d.name,
      verified: true,
      kcal: d.kcal,
      proteinG: d.protein_g,
      carbsG: d.carbs_g,
      fatG: d.fat_g,
      fibreG: d.fibre_g,
      sodiumMg: d.sodium_mg,
      satFatG: d.sat_fat_g,
      defaultServingG: d.default_serving_g,
      variantOfRef: d.variant_of === null ? null : `curated:${d.variant_of}`,
      variantLabel: d.variant_label,
      attribution: ATTRIBUTION,
      servings: d.servings.map((s) => ({ label: s.label, grams: s.grams })),
    }),
  );
  console.log(`indian: ${rows.length} foods`);
  return rows;
}

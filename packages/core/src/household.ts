import type { Per100 } from './nutrients';

export interface HouseholdUnit {
  label: string;
  grams: number;
}

export const HOUSEHOLD_UNITS: Record<string, HouseholdUnit[]> = {
  oil: [
    { label: '1 tsp', grams: 4.5 },
    { label: '1 tbsp', grams: 13.5 },
    { label: '2 tbsp', grams: 27 },
  ],
  butter: [
    { label: '1 tsp', grams: 4.7 },
    { label: '1 tbsp', grams: 14 },
  ],
  ghee: [
    { label: '1 tsp', grams: 4.3 },
    { label: '1 tbsp', grams: 13 },
  ],
  roti: [
    { label: 'small', grams: 25 },
    { label: 'medium', grams: 40 },
    { label: 'large', grams: 60 },
  ],
  paratha: [
    { label: 'small', grams: 50 },
    { label: 'medium', grams: 80 },
    { label: 'large', grams: 110 },
  ],
  katori: [
    { label: 'small', grams: 100 },
    { label: 'medium', grams: 150 },
    { label: 'large', grams: 200 },
  ],
  bowl: [
    { label: 'small', grams: 150 },
    { label: 'medium', grams: 250 },
    { label: 'large', grams: 350 },
  ],
  // 240 ml, taken as 240 g (water density).
  cup: [{ label: '1 cup', grams: 240 }],
  egg: [{ label: '1 large', grams: 50 }],
  slice_bread: [{ label: '1 slice', grams: 30 }],
  rice_cooked: [{ label: '1 katori', grams: 150 }],
  dal_cooked: [
    { label: '1 katori thin', grams: 150 },
    { label: '1 katori thick', grams: 180 },
  ],
};

/** Grams for `count` of a household unit. Null when the unit or label is not known. */
export function unitToGrams(unitKey: string, label: string, count = 1): number | null {
  const units = HOUSEHOLD_UNITS[unitKey];
  if (!units || !Number.isFinite(count) || count < 0) return null;
  const want = label.trim().toLowerCase();
  const unit = units.find((u) => u.label.toLowerCase() === want);
  return unit ? unit.grams * count : null;
}

export const FAT_OPTIONS: { label: string; fat: 'oil' | 'butter' | 'ghee' | 'none'; grams: number }[] = [
  { label: 'None', fat: 'none', grams: 0 },
  { label: '1 tsp oil', fat: 'oil', grams: 4.5 },
  { label: '1 tbsp oil', fat: 'oil', grams: 13.5 },
  { label: '2 tbsp oil', fat: 'oil', grams: 27 },
  { label: '1 tsp butter', fat: 'butter', grams: 4.7 },
  { label: '1 tbsp butter', fat: 'butter', grams: 14 },
  { label: '1 tsp ghee', fat: 'ghee', grams: 4.3 },
  { label: '1 tbsp ghee', fat: 'ghee', grams: 13 },
];

export const FAT_PER100: Record<'oil' | 'butter' | 'ghee', Per100> = {
  oil: { kcal: 884, protein_g: 0, carbs_g: 0, fat_g: 100, fibre_g: 0, sodium_mg: 0, sat_fat_g: 14 },
  butter: { kcal: 717, protein_g: 0.9, carbs_g: 0.1, fat_g: 81, fibre_g: 0, sodium_mg: 643, sat_fat_g: 51 },
  ghee: { kcal: 900, protein_g: 0, carbs_g: 0, fat_g: 100, fibre_g: 0, sodium_mg: 0, sat_fat_g: 62 },
};

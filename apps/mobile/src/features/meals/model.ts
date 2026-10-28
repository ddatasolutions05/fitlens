// Client-side meal draft. Everything is editable until confirmed; totals are
// recomputed from per-100 g snapshots with the core helpers.
import {
  EMPTY_PER100,
  kcalRange,
  roundGrams,
  roundKcal,
  scaleNutrients,
  sumNutrients,
  type Confidence,
  type NutrientTotals,
  type Per100,
} from '@fitlens/core';

import type { Database } from '@/lib/database.types';

export type Provenance = 'database' | 'label' | 'community' | 'user' | 'ai_estimate';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealSource = Database['public']['Tables']['meals']['Row']['source'];

export interface DraftItem {
  localId: string;
  foodId: string | null;
  name: string;
  grams: number;
  gramsRange: [number, number] | null;
  servingLabel: string | null;
  fractionEaten: number;
  per100: Per100;
  provenance: Provenance;
  sourceName: string | null;
  confidence: Confidence | null;
  assumptions: string[];
  extraKcalRange: [number, number] | null;
}

export interface DraftPhoto {
  storagePath: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  localUri: string | null;
}

export interface MealDraft {
  mealId: string | null;
  idempotencyKey: string;
  localDate: string;
  eatenAt: string;
  tz: string;
  mealType: MealType;
  source: MealSource;
  title: string | null;
  items: DraftItem[];
  photos: DraftPhoto[];
  /** True when this meal was already confirmed before the current edit. */
  previouslyConfirmed: boolean;
  /** Where the date and time came from: the clock when the draft opened, the photo, or the person. */
  eatenAtSource: 'clock' | 'photo' | 'manual';
}

export function newLocalId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.random() * 4) | 8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

export function emptyDraft(i: { localDate: string; eatenAt: string; tz: string; mealType: MealType; source: MealSource }): MealDraft {
  return {
    mealId: null,
    idempotencyKey: newIdempotencyKey(),
    localDate: i.localDate,
    eatenAt: i.eatenAt,
    tz: i.tz,
    mealType: i.mealType,
    source: i.source,
    title: null,
    items: [],
    photos: [],
    previouslyConfirmed: false,
    eatenAtSource: 'clock',
  };
}

export function newItem(partial: Partial<DraftItem> & { name: string }): DraftItem {
  return {
    localId: newLocalId(),
    foodId: null,
    grams: 100,
    gramsRange: null,
    servingLabel: null,
    fractionEaten: 1,
    per100: EMPTY_PER100,
    provenance: 'user',
    sourceName: null,
    confidence: null,
    assumptions: [],
    extraKcalRange: null,
    ...partial,
  };
}

export interface ItemNutrients {
  item: DraftItem;
  nutrients: Per100;
  kcalRange: [number, number] | null;
}

export function itemNutrients(item: DraftItem): ItemNutrients {
  const nutrients = scaleNutrients(item.per100, item.grams, item.fractionEaten);
  const range =
    item.gramsRange || item.extraKcalRange
      ? kcalRange({
          per100Kcal: item.per100.kcal,
          gramsRange: item.gramsRange ?? [item.grams, item.grams],
          fractionEaten: item.fractionEaten,
          ...(item.extraKcalRange ? { extraKcalRange: item.extraKcalRange } : {}),
        })
      : null;
  return { item, nutrients, kcalRange: range };
}

export interface DraftTotals extends NutrientTotals {
  kcalRange: [number, number] | null;
}

export function draftTotals(items: DraftItem[]): DraftTotals {
  const per = items.map(itemNutrients);
  const totals = sumNutrients(per.map((p) => p.nutrients));
  const ranges = per.map((p) => p.kcalRange).filter((r): r is [number, number] => r != null);
  const pointSum = per.filter((p) => !p.kcalRange && p.nutrients.kcal != null).reduce((a, p) => a + (p.nutrients.kcal as number), 0);
  const kcalRangeTotal: [number, number] | null =
    ranges.length > 0 ? [ranges.reduce((a, r) => a + r[0], 0) + pointSum, ranges.reduce((a, r) => a + r[1], 0) + pointSum] : null;
  return { ...totals, kcalRange: kcalRangeTotal };
}

export function displayKcal(v: number | null): string {
  const r = roundKcal(v);
  return r == null ? 'unknown' : r.toLocaleString();
}

export function displayGrams(v: number | null): string {
  const r = roundGrams(v);
  return r == null ? 'unknown' : `${r} g`;
}

export function provenanceLabel(p: Provenance, sourceName: string | null): string {
  switch (p) {
    case 'database':
      return sourceName ? `Database · ${sourceName}` : 'Database';
    case 'label':
      return 'Label';
    case 'community':
      return 'Community';
    case 'user':
      return 'You entered';
    case 'ai_estimate':
      return 'AI estimate';
  }
}

export function sourceNameFor(source: string): string {
  switch (source) {
    case 'usda':
      return 'USDA FoodData Central';
    case 'cnf':
      return 'Canadian Nutrient File';
    case 'ifct':
      return 'IFCT 2017';
    case 'indb':
      return 'INDB';
    case 'off':
      return 'Open Food Facts';
    case 'recipe':
      return 'Your recipe';
    default:
      return source;
  }
}

export function provenanceForSource(source: string): Provenance {
  switch (source) {
    case 'usda':
    case 'cnf':
    case 'ifct':
    case 'indb':
      return 'database';
    case 'off':
      return 'community';
    case 'label':
      return 'label';
    case 'ai_estimate':
      return 'ai_estimate';
    default:
      return 'user';
  }
}

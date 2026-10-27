// Meal writes. Every function is idempotent so the offline queue can replay it.
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import { itemNutrients, type DraftItem, type MealDraft } from './model';

type MealRow = Database['public']['Tables']['meals']['Row'];
type MealItemInsert = Database['public']['Tables']['meal_items']['Insert'];

export interface SaveMealPayload {
  userId: string;
  draft: MealDraft;
  status: 'draft' | 'confirmed';
}

function itemRows(userId: string, mealId: string, items: DraftItem[]): MealItemInsert[] {
  return items.map((item, index) => {
    const { nutrients, kcalRange } = itemNutrients(item);
    return {
      user_id: userId,
      meal_id: mealId,
      food_id: item.foodId,
      sort_order: index,
      name_snapshot: item.name,
      grams: item.grams,
      serving_label: item.servingLabel,
      fraction_eaten: item.fractionEaten,
      per100_kcal: item.per100.kcal,
      per100_protein_g: item.per100.protein_g,
      per100_carbs_g: item.per100.carbs_g,
      per100_fat_g: item.per100.fat_g,
      per100_fibre_g: item.per100.fibre_g,
      per100_sodium_mg: item.per100.sodium_mg,
      per100_sat_fat_g: item.per100.sat_fat_g,
      kcal: nutrients.kcal,
      protein_g: nutrients.protein_g,
      carbs_g: nutrients.carbs_g,
      fat_g: nutrients.fat_g,
      fibre_g: nutrients.fibre_g,
      sodium_mg: nutrients.sodium_mg,
      sat_fat_g: nutrients.sat_fat_g,
      kcal_low: kcalRange?.[0] ?? null,
      kcal_high: kcalRange?.[1] ?? null,
      provenance: item.provenance,
      source_name: item.sourceName,
      confidence: item.confidence,
      assumptions: item.assumptions,
    };
  });
}

/**
 * Upserts the meal by idempotency key, then replaces its items. A replay after
 * a partial failure converges on the same state.
 */
export async function saveMeal(p: SaveMealPayload): Promise<MealRow> {
  const { draft } = p;
  const { data: meal, error } = await supabase
    .from('meals')
    .upsert(
      {
        user_id: p.userId,
        idempotency_key: draft.idempotencyKey,
        local_date: draft.localDate,
        eaten_at: draft.eatenAt,
        tz: draft.tz,
        meal_type: draft.mealType,
        source: draft.source,
        title: draft.title,
        status: p.status,
        confirmed_at: p.status === 'confirmed' ? new Date().toISOString() : null,
      },
      { onConflict: 'user_id,idempotency_key' },
    )
    .select('*')
    .single();
  if (error) throw error;

  const { error: delError } = await supabase.from('meal_items').delete().eq('meal_id', meal.id);
  if (delError) throw delError;
  if (draft.items.length) {
    const { error: insError } = await supabase.from('meal_items').insert(itemRows(p.userId, meal.id, draft.items));
    if (insError) throw insError;
  }

  if (draft.photos.length) {
    const { error: photoError } = await supabase.from('meal_photos').upsert(
      draft.photos.map((ph, i) => ({
        user_id: p.userId,
        meal_id: meal.id,
        storage_path: ph.storagePath,
        width: ph.width,
        height: ph.height,
        bytes: ph.bytes,
        sort_order: i,
      })),
      { onConflict: 'storage_path' },
    );
    if (photoError) throw photoError;
  }

  if (p.status === 'confirmed') {
    for (const item of draft.items) {
      if (item.foodId) {
        const { error: usageError } = await supabase.rpc('touch_food_usage', { p_food_id: item.foodId, p_grams: item.grams });
        if (usageError) throw usageError;
      }
    }
  }
  return meal;
}

export async function deleteMeal(p: { mealId: string }): Promise<void> {
  const { data: photos } = await supabase.from('meal_photos').select('storage_path').eq('meal_id', p.mealId);
  if (photos && photos.length) {
    await supabase.storage.from('meal-photos').remove(photos.map((ph) => ph.storage_path));
  }
  const { error } = await supabase.from('meals').delete().eq('id', p.mealId);
  if (error) throw error;
}

export async function deletePhoto(p: { photoId: string; storagePath: string }): Promise<void> {
  await supabase.storage.from('meal-photos').remove([p.storagePath]);
  const { error } = await supabase.from('meal_photos').delete().eq('id', p.photoId);
  if (error) throw error;
}

export async function setMealStatus(p: { mealId: string; status: 'draft' | 'confirmed' }): Promise<void> {
  const { error } = await supabase
    .from('meals')
    .update({ status: p.status, confirmed_at: p.status === 'confirmed' ? new Date().toISOString() : null })
    .eq('id', p.mealId);
  if (error) throw error;
}

export interface MealWithItems extends MealRow {
  meal_items: Database['public']['Tables']['meal_items']['Row'][];
  meal_photos: Database['public']['Tables']['meal_photos']['Row'][];
}

export async function fetchMeal(mealId: string): Promise<MealWithItems | null> {
  const { data, error } = await supabase
    .from('meals')
    .select('*, meal_items(*), meal_photos(*)')
    .eq('id', mealId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  data.meal_items.sort((a, b) => a.sort_order - b.sort_order);
  data.meal_photos.sort((a, b) => a.sort_order - b.sort_order);
  return data as MealWithItems;
}

export async function fetchMealsForDate(userId: string, localDate: string): Promise<MealWithItems[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*, meal_items(*), meal_photos(*)')
    .eq('user_id', userId)
    .eq('local_date', localDate)
    .order('eaten_at', { ascending: true });
  if (error) throw error;
  for (const m of data) {
    m.meal_items.sort((a, b) => a.sort_order - b.sort_order);
    m.meal_photos.sort((a, b) => a.sort_order - b.sort_order);
  }
  return data as MealWithItems[];
}

export function draftFromMeal(meal: MealWithItems): MealDraft {
  return {
    mealId: meal.id,
    idempotencyKey: meal.idempotency_key,
    localDate: meal.local_date,
    eatenAt: meal.eaten_at,
    tz: meal.tz,
    mealType: meal.meal_type as MealDraft['mealType'],
    source: meal.source,
    title: meal.title,
    items: meal.meal_items.map((mi) => ({
      localId: mi.id,
      foodId: mi.food_id,
      name: mi.name_snapshot,
      grams: Number(mi.grams),
      gramsRange: null,
      servingLabel: mi.serving_label,
      fractionEaten: Number(mi.fraction_eaten),
      per100: {
        kcal: num(mi.per100_kcal),
        protein_g: num(mi.per100_protein_g),
        carbs_g: num(mi.per100_carbs_g),
        fat_g: num(mi.per100_fat_g),
        fibre_g: num(mi.per100_fibre_g),
        sodium_mg: num(mi.per100_sodium_mg),
        sat_fat_g: num(mi.per100_sat_fat_g),
      },
      provenance: mi.provenance as DraftItem['provenance'],
      sourceName: mi.source_name,
      confidence: (mi.confidence as DraftItem['confidence']) ?? null,
      assumptions: Array.isArray(mi.assumptions) ? (mi.assumptions as string[]) : [],
      extraKcalRange:
        mi.kcal_low != null && mi.kcal_high != null && mi.kcal != null
          ? [Number(mi.kcal_low) - Number(mi.kcal), Number(mi.kcal_high) - Number(mi.kcal)]
          : null,
    })),
    photos: meal.meal_photos.map((ph) => ({
      storagePath: ph.storage_path,
      width: ph.width,
      height: ph.height,
      bytes: ph.bytes,
      localUri: null,
    })),
  };
}

export function num(v: number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

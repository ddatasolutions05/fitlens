import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import { num } from '@/features/meals/api';
import { newItem, type DraftItem } from '@/features/meals/model';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type SavedMealRow = Database['public']['Tables']['saved_meals']['Row'];
type SavedMealItemRow = Database['public']['Tables']['saved_meal_items']['Row'];

export interface SavedMeal extends SavedMealRow {
  saved_meal_items: SavedMealItemRow[];
}

export function useSavedMeals() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['saved-meals', userId],
    queryFn: async (): Promise<SavedMeal[]> => {
      const { data, error } = await supabase
        .from('saved_meals')
        .select('*, saved_meal_items(*)')
        .eq('user_id', userId)
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as SavedMeal[]).map((m) => ({ ...m, saved_meal_items: [...m.saved_meal_items].sort((a, b) => a.sort_order - b.sort_order) }));
    },
  });
}

export function draftItemsFromSaved(meal: SavedMeal): DraftItem[] {
  return meal.saved_meal_items.map((it) =>
    newItem({
      foodId: it.food_id,
      name: it.name_snapshot,
      grams: Number(it.grams),
      servingLabel: it.serving_label,
      fractionEaten: Number(it.fraction_eaten),
      per100: {
        kcal: num(it.per100_kcal),
        protein_g: num(it.per100_protein_g),
        carbs_g: num(it.per100_carbs_g),
        fat_g: num(it.per100_fat_g),
        fibre_g: num(it.per100_fibre_g),
        sodium_mg: num(it.per100_sodium_mg),
        sat_fat_g: num(it.per100_sat_fat_g),
      },
      provenance: it.provenance as DraftItem['provenance'],
      sourceName: it.source_name,
      assumptions: Array.isArray(it.assumptions) ? (it.assumptions as string[]) : [],
    }),
  );
}

export async function touchSavedMeal(id: string, useCount: number): Promise<void> {
  await supabase.from('saved_meals').update({ use_count: useCount + 1, last_used_at: new Date().toISOString() }).eq('id', id);
}

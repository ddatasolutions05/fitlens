// Whole meals from the last two weeks, for a one-tap repeat.
import { useQuery } from '@tanstack/react-query';
import { addDays, todayLocal } from '@fitlens/core';

import { useUserId } from '@/features/auth/session';
import { draftFromMeal, type MealWithItems } from '@/features/meals/api';
import { newLocalId, type DraftItem } from '@/features/meals/model';
import { supabase } from '@/lib/supabase';

export function useRecentMeals(limit = 8) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['recent-meals', userId, limit],
    queryFn: async (): Promise<MealWithItems[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select('*, meal_items(*), meal_photos(*)')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .gte('local_date', addDays(todayLocal(), -14))
        .order('eaten_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      const seen = new Set<string>();
      const out: MealWithItems[] = [];
      for (const m of data as MealWithItems[]) {
        if (m.meal_items.length === 0) continue;
        const key = m.meal_items
          .map((i) => i.name_snapshot.toLowerCase())
          .sort()
          .join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(m);
        if (out.length >= limit) break;
      }
      return out;
    },
  });
}

/** Fresh draft items copied from a logged meal; new ids so edits never touch the original. */
export function itemsFromMeal(meal: MealWithItems): DraftItem[] {
  return draftFromMeal(meal).items.map((i) => ({ ...i, localId: newLocalId() }));
}

export function mealLabel(meal: MealWithItems): string {
  return meal.title?.trim() || meal.meal_items.map((i) => i.name_snapshot).join(', ');
}

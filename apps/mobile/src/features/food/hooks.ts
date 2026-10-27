import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type FoodRow = Database['public']['Tables']['foods']['Row'];
export type FoodInsert = Database['public']['Tables']['foods']['Insert'];
export type FoodServingRow = Database['public']['Tables']['food_servings']['Row'];
export type SearchFoodRow = Database['public']['Functions']['search_foods']['Returns'][number];

export function useSearchFoods(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['food-search', q],
    queryFn: async (): Promise<SearchFoodRow[]> => {
      const { data, error } = await supabase.rpc('search_foods', { p_query: q, p_limit: 30 });
      if (error) throw error;
      return data;
    },
    enabled: q.length >= 2,
    staleTime: 5 * 60_000,
  });
}

export interface RecentFood {
  food: FoodRow;
  use_count: number;
  last_used_at: string | null;
  favourite: boolean;
  usual_grams: number | null;
}

export function useRecentFoods() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['recents', userId],
    queryFn: async (): Promise<RecentFood[]> => {
      const { data, error } = await supabase
        .from('user_food_usage')
        .select('use_count, last_used_at, favourite, usual_grams, foods(*)')
        .eq('user_id', userId)
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .limit(40);
      if (error) throw error;
      return data
        .filter((r) => r.foods)
        .map((r) => ({
          food: r.foods as FoodRow,
          use_count: r.use_count,
          last_used_at: r.last_used_at,
          favourite: r.favourite,
          usual_grams: r.usual_grams == null ? null : Number(r.usual_grams),
        }));
    },
  });
}

export function useFoodServings(foodId: string | null) {
  return useQuery({
    queryKey: ['food-servings', foodId],
    queryFn: async (): Promise<FoodServingRow[]> => {
      const { data, error } = await supabase.from('food_servings').select('*').eq('food_id', foodId as string).order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: Boolean(foodId),
    staleTime: 10 * 60_000,
  });
}

export function useToggleFavourite() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { foodId: string; favourite: boolean }) => {
      const { error } = await supabase
        .from('user_food_usage')
        .upsert({ user_id: userId, food_id: i.foodId, favourite: i.favourite }, { onConflict: 'user_id,food_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recents', userId] });
      void qc.invalidateQueries({ queryKey: ['food-search'] });
    },
  });
}

/** Creates a user-owned food (manual entry, label or AI estimate). */
export function useCreateUserFood() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Omit<FoodInsert, 'owner_user_id'>): Promise<FoodRow> => {
      const { data, error } = await supabase
        .from('foods')
        .insert({ ...row, owner_user_id: userId })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['food-search'] });
      void qc.invalidateQueries({ queryKey: ['recents', userId] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type PreferencesRow = Database['public']['Tables']['preferences']['Row'];
export type PreferencesInsert = Database['public']['Tables']['preferences']['Insert'];
export type GoalVersionRow = Database['public']['Tables']['goal_versions']['Row'];
export type GoalVersionInsert = Database['public']['Tables']['goal_versions']['Insert'];

export const profileKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  preferences: (userId: string) => ['preferences', userId] as const,
  goal: (userId: string, date: string) => ['goal', userId, date] as const,
  goals: (userId: string) => ['goals', userId] as const,
};

export function useProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: profileKeys.profile(userId),
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePreferences() {
  const userId = useUserId();
  return useQuery({
    queryKey: profileKeys.preferences(userId),
    queryFn: async (): Promise<PreferencesRow | null> => {
      const { data, error } = await supabase.from('preferences').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertProfile() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Omit<ProfileInsert, 'user_id'>) => {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ ...patch, user_id: userId }, { onConflict: 'user_id' })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(profileKeys.profile(userId), data);
    },
  });
}

export function useUpsertPreferences() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Omit<PreferencesInsert, 'user_id'>) => {
      const { data, error } = await supabase
        .from('preferences')
        .upsert({ ...patch, user_id: userId }, { onConflict: 'user_id' })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(profileKeys.preferences(userId), data);
    },
  });
}

/** The goal version in force on a local date, or null when none exists yet. */
export function useGoalForDate(localDate: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: profileKeys.goal(userId, localDate),
    queryFn: async (): Promise<GoalVersionRow | null> => {
      const { data, error } = await supabase.rpc('goal_for_date', { p_date: localDate });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export function useGoalHistory() {
  const userId = useUserId();
  return useQuery({
    queryKey: profileKeys.goals(userId),
    queryFn: async (): Promise<GoalVersionRow[]> => {
      const { data, error } = await supabase
        .from('goal_versions')
        .select('*')
        .eq('user_id', userId)
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddGoalVersion() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Omit<GoalVersionInsert, 'user_id'>) => {
      const { data, error } = await supabase
        .from('goal_versions')
        .insert({ ...row, user_id: userId })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['goal', userId] });
      void qc.invalidateQueries({ queryKey: profileKeys.goals(userId) });
      void qc.invalidateQueries({ queryKey: ['day', userId] });
    },
  });
}

export function useLatestWeight() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['weight', userId, 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('kg, local_date, measured_at')
        .eq('user_id', userId)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

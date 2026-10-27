import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type WeightRow = Database['public']['Tables']['weight_logs']['Row'];
export type WaterRow = Database['public']['Tables']['water_logs']['Row'];
export type ActivityRow = Database['public']['Tables']['activity_records']['Row'];

export interface DayLogs {
  weights: WeightRow[];
  water: WaterRow[];
  activity: ActivityRow[];
}

export function useLogsForDate(localDate: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['logs', userId, localDate],
    queryFn: async (): Promise<DayLogs> => {
      const [w, h, a] = await Promise.all([
        supabase.from('weight_logs').select('*').eq('user_id', userId).eq('local_date', localDate).order('measured_at'),
        supabase.from('water_logs').select('*').eq('user_id', userId).eq('local_date', localDate).order('logged_at'),
        supabase.from('activity_records').select('*').eq('user_id', userId).eq('local_date', localDate).order('start_at'),
      ]);
      if (w.error) throw w.error;
      if (h.error) throw h.error;
      if (a.error) throw a.error;
      return { weights: w.data, water: h.data, activity: a.data };
    },
  });
}

export function useWeightHistory(days: number) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['weight', userId, 'history', days],
    queryFn: async (): Promise<WeightRow[]> => {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('measured_at', { ascending: false })
        .limit(Math.max(days * 2, 60));
      if (error) throw error;
      return data;
    },
  });
}

// Dates in the last 60 days with any log at all, for the streak.
import { useQuery } from '@tanstack/react-query';
import { addDays, currentStreak, todayLocal } from '@fitlens/core';

import { useUserId } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

export function useLogDays() {
  const userId = useUserId();
  const today = todayLocal();
  const from = addDays(today, -60);
  return useQuery({
    queryKey: ['log-days', userId, today],
    queryFn: async () => {
      const [meals, water, activity, weights] = await Promise.all([
        supabase.from('meals').select('local_date').eq('user_id', userId).eq('status', 'confirmed').gte('local_date', from),
        supabase.from('water_logs').select('local_date').eq('user_id', userId).gte('local_date', from),
        supabase.from('activity_records').select('local_date').eq('user_id', userId).gte('local_date', from),
        supabase.from('weight_logs').select('local_date').eq('user_id', userId).gte('local_date', from),
      ]);
      for (const r of [meals, water, activity, weights]) if (r.error) throw r.error;
      const dates = new Set<string>();
      for (const r of [meals, water, activity, weights]) for (const row of r.data ?? []) dates.add(row.local_date);
      return { dates: Array.from(dates), streak: currentStreak(dates, today) };
    },
  });
}

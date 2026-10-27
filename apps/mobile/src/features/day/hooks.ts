import { useQuery } from '@tanstack/react-query';
import { addDays, trendDirection, trendWeights, type DayStatus, type Per100, type TrendPoint } from '@fitlens/core';

import { useUserId } from '@/features/auth/session';
import { fetchMealsForDate, num, type MealWithItems } from '@/features/meals/api';
import type { GoalVersionRow } from '@/features/profile/hooks';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type TotalsRow = Database['public']['Views']['daily_totals']['Row'];
type ActivityRow = Database['public']['Views']['daily_activity']['Row'];

export interface DayTotals {
  totals: Per100;
  unknown: Record<keyof Per100, number>;
  kcalRange: [number, number] | null;
  rangedCount: number;
  mealCount: number;
  itemCount: number;
}

export interface DaySummary {
  localDate: string;
  logged: boolean;
  totals: DayTotals | null;
  goal: GoalVersionRow | null;
  waterMl: number | null;
  steps: number | null;
  stepsSource: string | null;
  workoutCount: number;
  workoutMinutes: number | null;
  workoutKcal: number | null;
  workouts: { met: number; minutes: number }[];
  weight: { kg: number; localDate: string } | null;
  trend: TrendPoint[];
  trendDirection: 'down' | 'up' | 'flat' | 'unknown';
  dayStatus: DayStatus;
  meals: MealWithItems[];
  drafts: MealWithItems[];
}

export const dayKeys = {
  day: (userId: string, localDate: string) => ['day', userId, localDate] as const,
};

function totalsFromRow(row: TotalsRow | null): DayTotals | null {
  if (!row) return null;
  return {
    totals: {
      kcal: num(row.kcal),
      protein_g: num(row.protein_g),
      carbs_g: num(row.carbs_g),
      fat_g: num(row.fat_g),
      fibre_g: num(row.fibre_g),
      sodium_mg: num(row.sodium_mg),
      sat_fat_g: num(row.sat_fat_g),
    },
    unknown: {
      kcal: Number(row.kcal_unknown ?? 0),
      protein_g: Number(row.protein_unknown ?? 0),
      carbs_g: Number(row.carbs_unknown ?? 0),
      fat_g: Number(row.fat_unknown ?? 0),
      fibre_g: Number(row.fibre_unknown ?? 0),
      sodium_mg: Number(row.sodium_unknown ?? 0),
      sat_fat_g: Number(row.sat_fat_unknown ?? 0),
    },
    kcalRange: Number(row.ranged_count ?? 0) > 0 && row.kcal_low != null && row.kcal_high != null ? [Number(row.kcal_low), Number(row.kcal_high)] : null,
    rangedCount: Number(row.ranged_count ?? 0),
    mealCount: Number(row.meal_count ?? 0),
    itemCount: Number(row.item_count ?? 0),
  };
}

export async function fetchDay(userId: string, localDate: string): Promise<DaySummary> {
  const trendFrom = addDays(localDate, -35);
  const [totalsRes, waterRes, activityRes, statusRes, goalRes, weightsRes, meals, workoutsRes] = await Promise.all([
    supabase.from('daily_totals').select('*').eq('user_id', userId).eq('local_date', localDate).maybeSingle(),
    supabase.from('daily_water').select('ml').eq('user_id', userId).eq('local_date', localDate).maybeSingle(),
    supabase.from('daily_activity').select('*').eq('user_id', userId).eq('local_date', localDate).maybeSingle(),
    supabase.from('day_status').select('status').eq('user_id', userId).eq('local_date', localDate).maybeSingle(),
    supabase.rpc('goal_for_date', { p_date: localDate }),
    supabase
      .from('weight_logs')
      .select('kg, local_date, measured_at')
      .eq('user_id', userId)
      .gte('local_date', trendFrom)
      .lte('local_date', localDate)
      .order('measured_at', { ascending: true }),
    fetchMealsForDate(userId, localDate),
    supabase.from('activity_records').select('met, duration_min').eq('user_id', userId).eq('local_date', localDate).eq('kind', 'workout'),
  ]);
  for (const r of [totalsRes, waterRes, activityRes, statusRes, goalRes, weightsRes, workoutsRes]) {
    if (r.error) throw r.error;
  }

  const totals = totalsFromRow(totalsRes.data);
  const activity = activityRes.data as ActivityRow | null;
  const weights = (weightsRes.data ?? []).map((w) => ({ localDate: w.local_date, kg: Number(w.kg) }));
  const trend = trendWeights(weights);
  const lastWeight = weights.length ? weights[weights.length - 1] : null;
  const confirmed = meals.filter((m) => m.status === 'confirmed');
  const drafts = meals.filter((m) => m.status === 'draft');
  const hasAnyLog =
    confirmed.length > 0 || waterRes.data != null || activity != null || weights.some((w) => w.localDate === localDate);
  const statusRow = statusRes.data ? { status: statusRes.data.status as 'partial' | 'complete' } : null;

  return {
    localDate,
    logged: hasAnyLog,
    totals,
    goal: goalRes.data?.[0] ?? null,
    waterMl: waterRes.data?.ml ?? null,
    steps: activity?.steps != null ? Number(activity.steps) : null,
    stepsSource: activity?.steps_source ?? null,
    workoutCount: Number(activity?.workout_count ?? 0),
    workoutMinutes: activity?.workout_minutes != null ? Number(activity.workout_minutes) : null,
    workoutKcal: activity?.workout_kcal != null ? Number(activity.workout_kcal) : null,
    workouts: (workoutsRes.data ?? []).filter((w) => w.met != null && w.duration_min != null).map((w) => ({ met: Number(w.met), minutes: Number(w.duration_min) })),
    weight: lastWeight ? { kg: lastWeight.kg, localDate: lastWeight.localDate } : null,
    trend,
    trendDirection: trendDirection(trend),
    dayStatus: statusRow ? (statusRow.status as DayStatus) : hasAnyLog ? 'partial' : 'not_logged',
    meals: confirmed,
    drafts,
  };
}

export function useDay(localDate: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: dayKeys.day(userId, localDate),
    queryFn: () => fetchDay(userId, localDate),
  });
}

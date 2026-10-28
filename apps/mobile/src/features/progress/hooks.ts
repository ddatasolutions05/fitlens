import { useQuery } from '@tanstack/react-query';
import { addDays, dateRange, rangeStats, todayLocal, trendWeights, type DayStatus, type RangeStats, type StatsDay, type TrendPoint } from '@fitlens/core';

import { useUserId } from '@/features/auth/session';
import { num } from '@/features/meals/api';
import type { GoalVersionRow } from '@/features/profile/hooks';
import { supabase } from '@/lib/supabase';

export type Range = 7 | 30 | 90;

export interface ProgressPoint extends StatsDay {
  status: DayStatus;
}

export interface ProgressData {
  from: string;
  to: string;
  days: ProgressPoint[];
  weights: TrendPoint[];
  tdeeSeries: { localDate: string; tdee: number }[];
  consistency: { complete: number; partial: number; notLogged: number; total: number };
  stats: RangeStats;
}

function goalOn(goals: GoalVersionRow[], date: string): GoalVersionRow | null {
  // goals sorted by effective_from desc
  for (const g of goals) if (g.effective_from <= date) return g;
  return null;
}

export async function fetchProgress(userId: string, range: Range): Promise<ProgressData> {
  const to = todayLocal();
  const from = addDays(to, -(range - 1));
  const [totals, activity, water, statuses, goals, weights] = await Promise.all([
    supabase.from('daily_totals').select('local_date, kcal, protein_g, fibre_g').eq('user_id', userId).gte('local_date', from).lte('local_date', to),
    supabase.from('daily_activity').select('local_date, steps, workout_minutes').eq('user_id', userId).gte('local_date', from).lte('local_date', to),
    supabase.from('daily_water').select('local_date, ml').eq('user_id', userId).gte('local_date', from).lte('local_date', to),
    supabase.from('day_status').select('local_date, status').eq('user_id', userId).gte('local_date', from).lte('local_date', to),
    supabase.from('goal_versions').select('*').eq('user_id', userId).order('effective_from', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('weight_logs').select('local_date, kg').eq('user_id', userId).gte('local_date', addDays(from, -30)).lte('local_date', to).order('measured_at'),
  ]);
  for (const r of [totals, activity, water, statuses, goals, weights]) if (r.error) throw r.error;

  const totalsBy = new Map((totals.data ?? []).map((t) => [t.local_date as string, t]));
  const activityBy = new Map((activity.data ?? []).map((a) => [a.local_date as string, a]));
  const waterBy = new Map((water.data ?? []).map((w) => [w.local_date as string, w]));
  const statusBy = new Map((statuses.data ?? []).map((s) => [s.local_date, s.status]));

  const days: ProgressPoint[] = dateRange(from, to).map((d) => {
    const t = totalsBy.get(d);
    const a = activityBy.get(d);
    const w = waterBy.get(d);
    const g = goalOn(goals.data ?? [], d);
    const status = statusBy.get(d) as 'partial' | 'complete' | undefined;
    const hasAny = Boolean(t) || Boolean(a) || Boolean(w);
    return {
      localDate: d,
      kcal: t ? num(t.kcal) : null,
      kcalTarget: g?.calorie_target ?? null,
      protein: t ? num(t.protein_g) : null,
      proteinTarget: g?.protein_g ?? null,
      fibre: t ? num(t.fibre_g) : null,
      fibreTarget: g?.fibre_g ?? null,
      steps: a?.steps != null ? Number(a.steps) : null,
      stepTarget: g?.step_goal ?? null,
      waterMl: w?.ml != null ? Number(w.ml) : null,
      waterTarget: g?.water_ml ?? null,
      workoutMinutes: a?.workout_minutes != null ? Number(a.workout_minutes) : null,
      status: status ?? (hasAny ? 'partial' : 'not_logged'),
    };
  });

  const trend = trendWeights((weights.data ?? []).map((w) => ({ localDate: w.local_date, kg: Number(w.kg) }))).filter((p) => p.localDate >= from);
  const tdeeSeries = (goals.data ?? [])
    .filter((g) => g.effective_from <= to)
    .map((g) => ({ localDate: g.effective_from < from ? from : g.effective_from, tdee: Number((g.inputs as { tdee?: number } | null)?.tdee ?? 0) }))
    .filter((p) => p.tdee > 0)
    .reverse();

  const consistency = days.reduce(
    (acc, d) => {
      if (d.status === 'complete') acc.complete += 1;
      else if (d.status === 'partial') acc.partial += 1;
      else acc.notLogged += 1;
      return acc;
    },
    { complete: 0, partial: 0, notLogged: 0, total: days.length },
  );

  return { from, to, days, weights: trend, tdeeSeries, consistency, stats: rangeStats(days, trend) };
}

export function useProgress(range: Range) {
  const userId = useUserId();
  return useQuery({ queryKey: ['progress', userId, range], queryFn: () => fetchProgress(userId, range) });
}

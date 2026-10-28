// Plan settings come from preferences with sensible defaults from the profile
// and goal. Completed sessions are ordinary workout records whose note names
// the workout, so they count toward activity like any other log.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { addDays, buildWeeklyPlan, deviceTimeZone, todayLocal, weekdayOf, workoutById, type Equipment, type Focus, type Level, type PlanSettings, type Workout } from '@fitlens/core';

import { useUserId } from '@/features/auth/session';
import { useLogWorkout } from '@/features/logs/hooks';
import { newIdempotencyKey } from '@/features/meals/model';
import { useGoalForDate, useLatestWeight, usePreferences, useProfile, useUpsertPreferences } from '@/features/profile/hooks';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/telemetry';

export const PLAN_NOTE_PREFIX = 'plan:';

const EQUIPMENT_KEYS: Equipment[] = ['bodyweight', 'dumbbells', 'barbell', 'machines', 'bands', 'kettlebell'];

function asEquipment(values: string[] | null | undefined): Equipment[] {
  return (values ?? []).filter((v): v is Equipment => (EQUIPMENT_KEYS as string[]).includes(v));
}

export function usePlanSettings(): { settings: PlanSettings; configured: boolean; isLoading: boolean } {
  const prefs = usePreferences();
  const profile = useProfile();
  const goal = useGoalForDate(todayLocal());
  const settings = useMemo<PlanSettings>(() => {
    const p = prefs.data;
    const goalType = goal.data?.goal_type;
    const focusDefault: Focus = goalType === 'fat_loss' ? 'fat_loss' : goalType === 'muscle_gain' ? 'strength' : 'general';
    return {
      daysPerWeek: p?.workout_days_per_week ?? profile.data?.training_days_per_week ?? 3,
      minutes: p?.workout_minutes ?? profile.data?.training_minutes ?? 40,
      level: (p?.workout_level as Level | null) ?? 'beginner',
      focus: (p?.workout_focus as Focus | null) ?? focusDefault,
      equipment: asEquipment(p?.workout_equipment),
      seed: p?.workout_plan_seed ?? 1,
    };
  }, [prefs.data, profile.data, goal.data]);
  return { settings, configured: Boolean(prefs.data?.workout_level), isLoading: prefs.isLoading || profile.isLoading };
}

export function useWeeklyPlan() {
  const { settings, configured, isLoading } = usePlanSettings();
  const plan = useMemo(() => buildWeeklyPlan(settings), [settings]);
  return { plan, settings, configured, isLoading };
}

export function useSavePlanSettings() {
  const upsert = useUpsertPreferences();
  return {
    ...upsert,
    save: (s: Omit<PlanSettings, 'seed'> & { seed?: number }) => {
      track('plan_built', { days: s.daysPerWeek, focus: s.focus, level: s.level });
      return upsert.mutateAsync({
        workout_days_per_week: s.daysPerWeek,
        workout_minutes: s.minutes,
        workout_level: s.level,
        workout_focus: s.focus,
        workout_equipment: s.equipment,
        ...(s.seed != null ? { workout_plan_seed: s.seed } : {}),
      });
    },
  };
}

export interface CompletedSession {
  id: string;
  localDate: string;
  workoutId: string;
  minutes: number | null;
}

/** Monday to Sunday of the week that holds localDate. */
export function weekRange(localDate: string): { from: string; to: string } {
  const from = addDays(localDate, -weekdayOf(localDate));
  return { from, to: addDays(from, 6) };
}

export function useWeekSessions(localDate: string) {
  const userId = useUserId();
  const { from, to } = weekRange(localDate);
  return useQuery({
    queryKey: ['plan-sessions', userId, from],
    queryFn: async (): Promise<CompletedSession[]> => {
      const { data, error } = await supabase
        .from('activity_records')
        .select('id, local_date, note, duration_min')
        .eq('user_id', userId)
        .eq('kind', 'workout')
        .gte('local_date', from)
        .lte('local_date', to)
        .like('note', `${PLAN_NOTE_PREFIX}%`);
      if (error) throw error;
      return data.map((r) => ({ id: r.id, localDate: r.local_date, workoutId: (r.note ?? '').slice(PLAN_NOTE_PREFIX.length), minutes: r.duration_min }));
    },
  });
}

export function useCompleteWorkout() {
  const log = useLogWorkout();
  const weight = useLatestWeight();
  const qc = useQueryClient();
  return {
    ...log,
    complete: async (i: { workout: Workout; minutes: number; localDate: string }) => {
      await log.mutateAsync({
        id: newIdempotencyKey(),
        type: i.workout.type,
        intensity: i.workout.intensity,
        minutes: i.minutes,
        localDate: i.localDate,
        tz: deviceTimeZone(),
        startAt: new Date().toISOString(),
        kg: weight.data?.kg ?? null,
        note: `${PLAN_NOTE_PREFIX}${i.workout.id}`,
      });
      await qc.invalidateQueries({ queryKey: ['plan-sessions'] });
      track('workout_logged', { workout: i.workout.id, minutes: i.minutes });
    },
  };
}

export function sessionWorkoutName(session: CompletedSession): string {
  return workoutById(session.workoutId)?.name ?? 'Workout';
}

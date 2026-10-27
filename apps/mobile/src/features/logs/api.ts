// Weight, water, activity and day status writes. Rows carry client ids so a
// replay from the offline queue upserts instead of duplicating.
import { metFor, stepKcal, workoutNetKcal, type Intensity, type WorkoutType } from '@fitlens/core';

import { supabase } from '@/lib/supabase';

export interface WeightPayload {
  id: string;
  userId: string;
  kg: number;
  measuredAt: string;
  localDate: string;
  tz: string;
  note: string | null;
}

export async function upsertWeight(p: WeightPayload): Promise<void> {
  const { error } = await supabase.from('weight_logs').upsert(
    { id: p.id, user_id: p.userId, kg: p.kg, measured_at: p.measuredAt, local_date: p.localDate, tz: p.tz, note: p.note, source: 'manual' },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function deleteWeight(p: { id: string }): Promise<void> {
  const { error } = await supabase.from('weight_logs').delete().eq('id', p.id);
  if (error) throw error;
}

export interface WaterPayload {
  id: string;
  userId: string;
  ml: number;
  loggedAt: string;
  localDate: string;
  tz: string;
}

export async function upsertWater(p: WaterPayload): Promise<void> {
  const { error } = await supabase
    .from('water_logs')
    .upsert({ id: p.id, user_id: p.userId, ml: p.ml, logged_at: p.loggedAt, local_date: p.localDate, tz: p.tz }, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteWater(p: { id: string }): Promise<void> {
  const { error } = await supabase.from('water_logs').delete().eq('id', p.id);
  if (error) throw error;
}

export interface StepsPayload {
  id: string;
  userId: string;
  steps: number;
  localDate: string;
  tz: string;
  startAt: string;
  kg: number | null;
}

export async function upsertSteps(p: StepsPayload): Promise<void> {
  const { error } = await supabase.from('activity_records').upsert(
    {
      id: p.id,
      user_id: p.userId,
      kind: 'steps',
      steps: p.steps,
      local_date: p.localDate,
      tz: p.tz,
      start_at: p.startAt,
      source: 'manual',
      external_id: p.id,
      kcal_estimate: p.kg != null ? Math.round(stepKcal(p.steps, p.kg)) : null,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export interface WorkoutPayload {
  id: string;
  userId: string;
  type: WorkoutType;
  intensity: Intensity;
  minutes: number;
  localDate: string;
  tz: string;
  startAt: string;
  kg: number | null;
  note: string | null;
}

export async function upsertWorkout(p: WorkoutPayload): Promise<void> {
  const met = metFor(p.type, p.intensity);
  const { error } = await supabase.from('activity_records').upsert(
    {
      id: p.id,
      user_id: p.userId,
      kind: 'workout',
      workout_type: p.type,
      intensity: p.intensity,
      duration_min: p.minutes,
      met,
      kcal_estimate: p.kg != null ? Math.round(workoutNetKcal(met, p.kg, p.minutes)) : null,
      local_date: p.localDate,
      tz: p.tz,
      start_at: p.startAt,
      end_at: new Date(new Date(p.startAt).getTime() + p.minutes * 60_000).toISOString(),
      source: 'manual',
      external_id: p.id,
      note: p.note,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function deleteActivity(p: { id: string }): Promise<void> {
  const { error } = await supabase.from('activity_records').delete().eq('id', p.id);
  if (error) throw error;
}

export interface DayStatusPayload {
  userId: string;
  localDate: string;
  status: 'partial' | 'complete' | null;
}

export async function setDayStatus(p: DayStatusPayload): Promise<void> {
  if (p.status == null) {
    const { error } = await supabase.from('day_status').delete().eq('user_id', p.userId).eq('local_date', p.localDate);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('day_status')
    .upsert({ user_id: p.userId, local_date: p.localDate, status: p.status }, { onConflict: 'user_id,local_date' });
  if (error) throw error;
}

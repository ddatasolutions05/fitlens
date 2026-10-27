import { workoutNetKcal } from './energy';

export type WorkoutType = 'walking' | 'running' | 'cycling' | 'strength' | 'yoga' | 'sports' | 'other';
export type Intensity = 'light' | 'moderate' | 'vigorous';

export const WORKOUT_TYPES: { key: WorkoutType; label: string }[] = [
  { key: 'walking', label: 'Walking' },
  { key: 'running', label: 'Running' },
  { key: 'cycling', label: 'Cycling' },
  { key: 'strength', label: 'Strength training' },
  { key: 'yoga', label: 'Yoga' },
  { key: 'sports', label: 'Sports' },
  { key: 'other', label: 'Other' },
];

/** MET values in the style of the Compendium of Physical Activities. */
export const MET_TABLE: Record<WorkoutType, Record<Intensity, number>> = {
  walking: { light: 2.8, moderate: 3.5, vigorous: 4.5 },
  running: { light: 7, moderate: 9.8, vigorous: 11.5 },
  cycling: { light: 4, moderate: 6.8, vigorous: 10 },
  strength: { light: 3, moderate: 5, vigorous: 6 },
  yoga: { light: 2.5, moderate: 3, vigorous: 4 },
  sports: { light: 4, moderate: 6, vigorous: 8 },
  other: { light: 3, moderate: 5, vigorous: 7 },
};

export function metFor(type: WorkoutType, intensity: Intensity): number {
  return MET_TABLE[type][intensity];
}

/** MET and net kcal above resting, whole kcal. */
export function workoutEstimate(i: { type: WorkoutType; intensity: Intensity; minutes: number; kg: number }): {
  met: number;
  kcal: number;
} {
  const met = metFor(i.type, i.intensity);
  return { met, kcal: Math.round(workoutNetKcal(met, i.kg, i.minutes)) };
}

import { formatInt, formatNumber } from './format';

export type SexForEquation = 'male' | 'female' | 'unspecified';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (desk job, little movement)',
  light: 'Light (on your feet some of the day, or exercise 1 to 3 days a week)',
  moderate: 'Moderate (exercise 3 to 5 days a week)',
  active: 'Active (hard exercise 6 to 7 days a week)',
  very_active: 'Very active (physical job plus training)',
};

function parseIsoDate(s: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new RangeError(`Expected YYYY-MM-DD, got "${s}"`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Age in whole years on `onDate`. Both dates are YYYY-MM-DD. */
export function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = parseIsoDate(birthDate);
  const [y, m, d] = parseIsoDate(onDate);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

export interface ReeResult {
  ree: number;
  formula: string;
  note: string | null;
}

const SEX_CONSTANT: Record<SexForEquation, number> = { male: 5, female: -161, unspecified: (5 - 161) / 2 };

/** Resting energy expenditure by Mifflin-St Jeor. */
export function mifflinStJeor(i: { kg: number; cm: number; ageYears: number; sex: SexForEquation }): ReeResult {
  const c = SEX_CONSTANT[i.sex];
  const ree = 10 * i.kg + 6.25 * i.cm - 5 * i.ageYears + c;
  const sign = c < 0 ? '−' : '+';
  const formula =
    `10 × ${formatNumber(i.kg, 1)} + 6.25 × ${formatNumber(i.cm, 1)} − 5 × ${i.ageYears} ${sign} ` +
    `${formatNumber(Math.abs(c), 1)} = ${formatInt(ree)} kcal`;
  const note =
    i.sex === 'unspecified'
      ? 'Uses the average of the male and female equations, so this estimate can be off by about 80 kcal more than usual.'
      : null;
  return { ree, formula, note };
}

export function tdeeFromActivityLevel(ree: number, level: ActivityLevel): number {
  return Math.round(ree * ACTIVITY_MULTIPLIERS[level]);
}

/** Rough energy from walking: steps × kg × 0.0005. */
export function stepKcal(steps: number, kg: number): number {
  return steps * kg * 0.0005;
}

/** Energy above resting for a workout: (MET − 1) × kg × hours. */
export function workoutNetKcal(met: number, kg: number, minutes: number): number {
  return Math.max(0, met - 1) * kg * (minutes / 60);
}

export interface LoggedActivityTdee {
  tdee: number;
  base: number;
  stepKcal: number;
  workoutKcal: number;
}

/** REE × 1.2 plus logged steps and workouts. Results are whole kcal. */
export function tdeeFromLoggedActivity(i: {
  ree: number;
  kg: number;
  steps: number | null;
  workouts: { met: number; minutes: number }[];
}): LoggedActivityTdee {
  const base = Math.round(i.ree * ACTIVITY_MULTIPLIERS.sedentary);
  const steps = i.steps == null ? 0 : Math.round(stepKcal(i.steps, i.kg));
  const workouts = Math.round(i.workouts.reduce((sum, w) => sum + workoutNetKcal(w.met, i.kg, w.minutes), 0));
  return { tdee: base + steps + workouts, base, stepKcal: steps, workoutKcal: workouts };
}

export type ActivityMode = 'activity_level' | 'logged_activity';

export interface TdeeEstimate {
  tdee: number;
  mode: ActivityMode;
  explanation: string;
  parts: { ree: number; multiplier?: number; stepKcal?: number; workoutKcal?: number };
}

export function estimateTdee(i: {
  ree: number;
  kg: number;
  mode: ActivityMode;
  level: ActivityLevel;
  steps: number | null;
  workouts: { met: number; minutes: number }[];
}): TdeeEstimate {
  if (i.mode === 'activity_level') {
    // The multiplier already covers day to day movement, so logged activity is not added.
    const multiplier = ACTIVITY_MULTIPLIERS[i.level];
    const tdee = tdeeFromActivityLevel(i.ree, i.level);
    return {
      tdee,
      mode: i.mode,
      explanation:
        `Resting energy ${formatInt(i.ree)} kcal × ${multiplier} for a ${i.level.replace('_', ' ')} activity level ` +
        `= ${formatInt(tdee)} kcal. Steps and workouts are already covered by the multiplier.`,
      parts: { ree: i.ree, multiplier },
    };
  }
  const r = tdeeFromLoggedActivity(i);
  const stepsPart = i.steps == null ? 'no steps logged' : `${formatInt(r.stepKcal)} kcal from steps`;
  return {
    tdee: r.tdee,
    mode: i.mode,
    explanation:
      `Resting energy ${formatInt(i.ree)} kcal × 1.2 = ${formatInt(r.base)} kcal, plus ${stepsPart} ` +
      `and ${formatInt(r.workoutKcal)} kcal from logged workouts = ${formatInt(r.tdee)} kcal.`,
    parts: { ree: i.ree, multiplier: ACTIVITY_MULTIPLIERS.sedentary, stepKcal: r.stepKcal, workoutKcal: r.workoutKcal },
  };
}

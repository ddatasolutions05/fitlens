import { daysBetween } from './dates';
import type { DayStatus } from './day';
import type { TrendPoint } from './weight';

export interface StatsDay {
  localDate: string;
  kcal: number | null;
  kcalTarget: number | null;
  protein: number | null;
  proteinTarget: number | null;
  fibre: number | null;
  fibreTarget: number | null;
  steps: number | null;
  stepTarget: number | null;
  waterMl: number | null;
  waterTarget: number | null;
  workoutMinutes: number | null;
  status: DayStatus;
}

export interface RangeStats {
  totalDays: number;
  loggedDays: number;
  completeDays: number;
  /** Consecutive logged days ending on the last day of the range. */
  streak: number;
  bestStreak: number;
  avgKcal: number | null;
  avgKcalTarget: number | null;
  /** Average eaten minus average target, on days that had both. */
  kcalDelta: number | null;
  onTargetDays: number;
  onTargetEligible: number;
  avgProtein: number | null;
  proteinHitDays: number;
  proteinEligible: number;
  avgFibre: number | null;
  avgSteps: number | null;
  stepHitDays: number;
  stepEligible: number;
  avgWater: number | null;
  waterHitDays: number;
  waterEligible: number;
  workoutMinutes: number;
  workoutDays: number;
  weightChangeKg: number | null;
  weeklyRateKg: number | null;
}

/** Within this fraction of the calorie target counts as on target. */
export const ON_TARGET_TOLERANCE = 0.1;

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * KPIs for a date range. Averages use logged days only; null never counts as
 * zero. Adherence counts compare a day against the target in force that day.
 */
export function rangeStats(days: StatsDay[], weights: TrendPoint[] = []): RangeStats {
  const logged = days.filter((d) => d.status !== 'not_logged');
  const withKcal = days.filter((d) => d.kcal != null);
  const withBoth = days.filter((d) => d.kcal != null && d.kcalTarget != null && d.kcalTarget > 0);
  const avgKcal = mean(withKcal.map((d) => d.kcal as number));
  const avgKcalTarget = mean(withBoth.map((d) => d.kcalTarget as number));
  const kcalDelta = withBoth.length ? (mean(withBoth.map((d) => d.kcal as number)) as number) - (avgKcalTarget as number) : null;
  const onTargetDays = withBoth.filter((d) => Math.abs((d.kcal as number) - (d.kcalTarget as number)) <= ON_TARGET_TOLERANCE * (d.kcalTarget as number)).length;

  const withProtein = days.filter((d) => d.protein != null);
  const proteinEligible = withProtein.filter((d) => d.proteinTarget != null && d.proteinTarget > 0);
  const proteinHitDays = proteinEligible.filter((d) => (d.protein as number) >= (d.proteinTarget as number)).length;

  const withSteps = days.filter((d) => d.steps != null);
  const stepEligible = withSteps.filter((d) => d.stepTarget != null && d.stepTarget > 0);
  const stepHitDays = stepEligible.filter((d) => (d.steps as number) >= (d.stepTarget as number)).length;

  const withWater = days.filter((d) => d.waterMl != null);
  const waterEligible = withWater.filter((d) => d.waterTarget != null && d.waterTarget > 0);
  const waterHitDays = waterEligible.filter((d) => (d.waterMl as number) >= (d.waterTarget as number)).length;

  const workoutDaysList = days.filter((d) => d.workoutMinutes != null && d.workoutMinutes > 0);

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (days[i]!.status === 'not_logged') break;
    streak += 1;
  }
  let bestStreak = 0;
  let run = 0;
  for (const d of days) {
    run = d.status === 'not_logged' ? 0 : run + 1;
    if (run > bestStreak) bestStreak = run;
  }

  let weightChangeKg: number | null = null;
  let weeklyRateKg: number | null = null;
  if (weights.length >= 2) {
    const first = weights[0]!;
    const last = weights[weights.length - 1]!;
    const span = daysBetween(first.localDate, last.localDate);
    if (span >= 1) {
      weightChangeKg = last.trendKg - first.trendKg;
      weeklyRateKg = (weightChangeKg / span) * 7;
    }
  }

  return {
    totalDays: days.length,
    loggedDays: logged.length,
    completeDays: days.filter((d) => d.status === 'complete').length,
    streak,
    bestStreak,
    avgKcal,
    avgKcalTarget,
    kcalDelta,
    onTargetDays,
    onTargetEligible: withBoth.length,
    avgProtein: mean(withProtein.map((d) => d.protein as number)),
    proteinHitDays,
    proteinEligible: proteinEligible.length,
    avgFibre: mean(days.filter((d) => d.fibre != null).map((d) => d.fibre as number)),
    avgSteps: mean(withSteps.map((d) => d.steps as number)),
    stepHitDays,
    stepEligible: stepEligible.length,
    avgWater: mean(withWater.map((d) => d.waterMl as number)),
    waterHitDays,
    waterEligible: waterEligible.length,
    workoutMinutes: workoutDaysList.reduce((a, d) => a + (d.workoutMinutes as number), 0),
    workoutDays: workoutDaysList.length,
    weightChangeKg,
    weeklyRateKg,
  };
}

/** "5 of 7" style adherence text, or a reason when nothing qualifies. */
export function adherenceLabel(hit: number, eligible: number, noun: string): string {
  if (eligible === 0) return `No ${noun} target days`;
  return `${hit} of ${eligible} days`;
}

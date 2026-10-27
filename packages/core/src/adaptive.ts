import { formatInt } from './format';
import { KCAL_PER_KG, type ProfileMode } from './targets';

export const ADAPTIVE_MIN_DAYS = 21;
export const ADAPTIVE_MIN_COMPLETE_RATIO = 0.8;
export const ADAPTIVE_MIN_WEIGH_INS = 8;
export const ADAPTIVE_MAX_STEP = 150;
const MIN_CHANGE = 25;

export interface AdaptiveWindow {
  days: number;
  completeDays: number;
  weighIns: number;
}

export function adaptiveUnlocked(w: AdaptiveWindow, mode: ProfileMode): { unlocked: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (mode === 'tracking_only') reasons.push('Target suggestions are off in tracking-only mode.');
  if (w.days < ADAPTIVE_MIN_DAYS) reasons.push(`Needs ${ADAPTIVE_MIN_DAYS} days of data, has ${w.days}.`);
  const ratio = w.days > 0 ? w.completeDays / w.days : 0;
  if (ratio < ADAPTIVE_MIN_COMPLETE_RATIO) {
    reasons.push(
      `Needs ${ADAPTIVE_MIN_COMPLETE_RATIO * 100}% of days marked complete, has ${w.completeDays} of ${w.days}.`,
    );
  }
  if (w.weighIns < ADAPTIVE_MIN_WEIGH_INS) {
    reasons.push(`Needs ${ADAPTIVE_MIN_WEIGH_INS} weigh-ins, has ${w.weighIns}.`);
  }
  return { unlocked: reasons.length === 0, reasons };
}

/** Mean intake minus the energy implied by the trend change: intake − (Δkg × 7,700 ÷ days). */
export function observedTdee(i: { meanIntakeCompleteDays: number; trendStartKg: number; trendEndKg: number; days: number }): number {
  if (!(i.days > 0)) throw new RangeError('days must be greater than 0');
  return i.meanIntakeCompleteDays - ((i.trendEndKg - i.trendStartKg) * KCAL_PER_KG) / i.days;
}

export interface TargetSuggestion {
  proposedCalorieTarget: number;
  change: number;
  observedTdee: number;
  evidence: Record<string, unknown>;
  uncertainty: string;
}

/**
 * Proposes observed TDEE minus the desired deficit, moving at most 150 kcal
 * from the current target. Null when the move would be under 25 kcal.
 */
export function suggestTarget(i: {
  currentTarget: number;
  currentTdeeEstimate: number;
  observedTdee: number;
  desiredDeficit: number;
  window: AdaptiveWindow & { trendStartKg: number; trendEndKg: number; meanIntake: number };
}): TargetSuggestion | null {
  const wanted = i.observedTdee - i.desiredDeficit - i.currentTarget;
  const capped = Math.max(-ADAPTIVE_MAX_STEP, Math.min(ADAPTIVE_MAX_STEP, wanted));
  let proposed = Math.round((i.currentTarget + capped) / 10) * 10;
  // Rounding to 10 can push past the cap, pull it back inside.
  while (proposed - i.currentTarget > ADAPTIVE_MAX_STEP) proposed -= 10;
  while (i.currentTarget - proposed > ADAPTIVE_MAX_STEP) proposed += 10;
  const change = proposed - i.currentTarget;
  if (Math.abs(change) < MIN_CHANGE) return null;

  const w = i.window;
  return {
    proposedCalorieTarget: proposed,
    change,
    observedTdee: Math.round(i.observedTdee),
    evidence: {
      days: w.days,
      completeDays: w.completeDays,
      weighIns: w.weighIns,
      trendStartKg: w.trendStartKg,
      trendEndKg: w.trendEndKg,
      meanIntake: Math.round(w.meanIntake),
      currentTdeeEstimate: Math.round(i.currentTdeeEstimate),
      desiredDeficit: i.desiredDeficit,
      uncappedChange: Math.round(wanted),
    },
    uncertainty:
      `Based on ${w.days} days (${w.completeDays} complete) and ${w.weighIns} weigh-ins. ` +
      `Logging gaps and water shifts can move the observed ${formatInt(i.observedTdee)} kcal by 100 to 200 kcal either way.`,
  };
}

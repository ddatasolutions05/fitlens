import type { RangeStats } from './stats';

export interface SummaryInput {
  stats: RangeStats;
  rangeDays: number;
  hideNumbers: boolean;
  trackingOnly: boolean;
  unitSystem: 'metric' | 'imperial';
}

function kgText(kg: number, unitSystem: 'metric' | 'imperial'): string {
  const v = unitSystem === 'imperial' ? kg * 2.20462 : kg;
  const unit = unitSystem === 'imperial' ? 'lb' : 'kg';
  const abs = Math.abs(v).toFixed(1);
  return `${abs} ${unit}`;
}

/**
 * Two or three plain sentences a coach would say about the range. Neutral by
 * construction: it reports counts and directions, never judgement words.
 */
export function rangeSummary(i: SummaryInput): string[] {
  const s = i.stats;
  const out: string[] = [];

  if (s.loggedDays === 0) {
    return [`Nothing logged in the last ${i.rangeDays} days. The summary starts with the first logged day.`];
  }

  const consistency = `You logged ${s.loggedDays} of ${s.totalDays} days${s.completeDays > 0 ? `, ${s.completeDays} marked complete` : ''}${s.streak >= 2 ? `, and the current run is ${s.streak} days` : ''}.`;
  out.push(consistency);

  if (!i.hideNumbers && !i.trackingOnly && s.onTargetEligible > 0 && s.kcalDelta != null) {
    const dir = Math.abs(s.kcalDelta) < 50 ? 'close to' : s.kcalDelta > 0 ? 'above' : 'below';
    const delta = Math.abs(Math.round(s.kcalDelta));
    out.push(
      `Calories landed within 10% of target on ${s.onTargetDays} of ${s.onTargetEligible} days, averaging ${dir} target${dir === 'close to' ? '' : ` by about ${delta} kcal`}.`,
    );
  } else if (s.proteinEligible > 0) {
    out.push(`Protein reached its target on ${s.proteinHitDays} of ${s.proteinEligible} days.`);
  }

  if (s.weightChangeKg != null && s.weeklyRateKg != null) {
    const dir = Math.abs(s.weeklyRateKg) < 0.1 ? 'held steady' : s.weightChangeKg < 0 ? 'moved down' : 'moved up';
    out.push(
      dir === 'held steady'
        ? 'The weight trend held steady across the range.'
        : `The weight trend ${dir} ${kgText(s.weightChangeKg, i.unitSystem)}, about ${kgText(s.weeklyRateKg, i.unitSystem)} a week.`,
    );
  } else if (s.loggedDays >= 3) {
    out.push('Two weigh-ins on different days would add a weight trend here.');
  }

  return out.slice(0, 3);
}

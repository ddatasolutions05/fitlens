import type { Per100 } from '../nutrients';
import { formatInt } from '../format';

export interface DayInsightInput {
  logged: boolean;
  totals: Per100 | null;
  targets: { calorieTarget: number | null; proteinG: number | null; fibreG: number | null; waterMl: number | null } | null;
  waterMl: number | null;
  hasWeightToday: boolean;
  daysSinceWeighIn: number | null;
  hideNumbers: boolean;
  isToday: boolean;
  hourOfDay: number;
}

export interface DayInsight {
  text: string;
  kind: 'protein' | 'fibre' | 'water' | 'weigh_in' | 'not_logged' | 'calm' | 'targets';
}

/** One short, neutral observation for the Today screen, computed from logged data only. */
export function dayInsight(i: DayInsightInput): DayInsight {
  if (!i.targets) {
    return { kind: 'targets', text: 'Set your targets in Profile to see how today compares.' };
  }
  if (!i.logged) {
    return {
      kind: 'not_logged',
      text: i.isToday ? 'Nothing logged yet today. Scan a meal or add food when you are ready.' : 'Nothing was logged on this day.',
    };
  }
  const t = i.totals;
  const protein = t?.protein_g ?? null;
  if (i.targets.proteinG != null && protein != null) {
    const left = Math.round(i.targets.proteinG - protein);
    if (left > 25 && (!i.isToday || i.hourOfDay >= 12)) {
      return {
        kind: 'protein',
        text: i.hideNumbers
          ? 'Protein is still below your target for the day. A protein-rich side at the next meal would close the gap.'
          : `${formatInt(left)} g of protein left for today. A protein-rich side at your next meal would cover most of it.`,
      };
    }
    if (left <= 0) {
      return { kind: 'calm', text: 'Protein target reached for the day.' };
    }
  }
  const fibre = t?.fibre_g ?? null;
  if (i.targets.fibreG != null && fibre != null && i.hourOfDay >= 15 && fibre < i.targets.fibreG * 0.4) {
    return {
      kind: 'fibre',
      text: 'Fibre is on the low side so far. Vegetables, dal, fruit or whole grains at the next meal would help.',
    };
  }
  if (i.targets.waterMl != null && i.waterMl != null && i.hourOfDay >= 14 && i.waterMl < i.targets.waterMl * 0.4) {
    return { kind: 'water', text: 'Water is behind pace for the day. A glass now is an easy catch-up.' };
  }
  if (!i.hasWeightToday && i.daysSinceWeighIn != null && i.daysSinceWeighIn >= 4 && i.isToday) {
    return { kind: 'weigh_in', text: 'No weigh-in for a few days. A morning weight keeps the trend line useful.' };
  }
  return { kind: 'calm', text: 'Logging is on track. Nothing to adjust right now.' };
}

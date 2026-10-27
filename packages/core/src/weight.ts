import { daysBetween } from './dates';

export interface WeightPoint {
  localDate: string;
  kg: number;
}

export interface TrendPoint extends WeightPoint {
  trendKg: number;
}

/**
 * Exponentially weighted trend. Weigh-ins on the same day are averaged first,
 * and the trend starts at the first day's value.
 */
export function trendWeights(points: WeightPoint[], alpha = 0.1): TrendPoint[] {
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const p of points) {
    const e = byDay.get(p.localDate) ?? { sum: 0, n: 0 };
    e.sum += p.kg;
    e.n += 1;
    byDay.set(p.localDate, e);
  }
  const days = [...byDay.entries()]
    .map(([localDate, e]) => ({ localDate, kg: e.sum / e.n }))
    .sort((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0));

  const out: TrendPoint[] = [];
  let trend: number | null = null;
  for (const d of days) {
    trend = trend == null ? d.kg : trend + alpha * (d.kg - trend);
    out.push({ ...d, trendKg: trend });
  }
  return out;
}

/**
 * Direction of the trend over the last `days` days, compared with the earliest
 * point inside that window. Flat when the change is under 0.2 kg.
 */
export function trendDirection(points: TrendPoint[], days = 7): 'down' | 'up' | 'flat' | 'unknown' {
  const last = latestTrend(points);
  if (!last || points.length < 2) return 'unknown';
  const inWindow = points.filter((p) => {
    const age = daysBetween(p.localDate, last.localDate);
    return age >= 0 && age <= days;
  });
  const first = inWindow.reduce<TrendPoint | null>((a, p) => (a == null || p.localDate < a.localDate ? p : a), null);
  if (!first || first.localDate === last.localDate) return 'unknown';
  const delta = last.trendKg - first.trendKg;
  if (Math.abs(delta) < 0.2) return 'flat';
  return delta < 0 ? 'down' : 'up';
}

export function latestTrend(points: TrendPoint[]): TrendPoint | null {
  return points.reduce<TrendPoint | null>((a, p) => (a == null || p.localDate > a.localDate ? p : a), null);
}

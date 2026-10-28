// Days in a row with at least one log. Today does not break the streak until it is over.
import { addDays } from './dates';

export function currentStreak(datesWithLogs: Iterable<string>, today: string): number {
  const set = new Set(datesWithLogs);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

export function streakLabel(n: number): string | null {
  if (n < 2) return null;
  return `${n} days in a row`;
}

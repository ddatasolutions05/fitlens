// A week in review: what went well, one thing to change, in the app's neutral
// voice. Rules over the same stats the Stats screen shows; no AI, no shaming.
import type { RangeStats } from './stats';

export interface WeeklyReview {
  headline: string;
  wins: string[];
  change: string | null;
  comparison: string | null;
}

interface Dimension {
  key: string;
  hit: number;
  eligible: number;
  win: (hit: number) => string;
  change: string;
}

export function weeklyReview(i: { thisWeek: RangeStats; lastWeek: RangeStats | null; hideNumbers: boolean; trackingOnly: boolean }): WeeklyReview {
  const t = i.thisWeek;
  const wins: string[] = [];

  if (t.loggedDays === 0) {
    return { headline: 'No logs this week.', wins: [], change: 'Log one meal tomorrow. One is enough to start the next week from.', comparison: null };
  }

  const headline = t.loggedDays >= 6 ? `You logged ${t.loggedDays} of 7 days. That is the habit.` : t.loggedDays >= 4 ? `You logged ${t.loggedDays} of 7 days.` : `You logged ${t.loggedDays} of 7 days. Any logged day beats a guessed one.`;

  const dims: Dimension[] = [
    { key: 'logging', hit: t.loggedDays, eligible: 7, win: (h) => `Logged ${h} days.`, change: 'Log on two more days. A photo at lunch is the quickest way.' },
    { key: 'protein', hit: t.proteinHitDays, eligible: t.proteinEligible, win: (h) => `Protein target reached on ${h} of ${t.proteinEligible} days.`, change: 'Add one protein-rich item to your biggest meal. Eggs, dal, chicken, paneer or yoghurt all work.' },
    { key: 'water', hit: t.waterHitDays, eligible: t.waterEligible, win: (h) => `Water target reached on ${h} of ${t.waterEligible} days.`, change: 'Keep a bottle where you sit. Logging 250 ml at a time is one tap on Today.' },
    { key: 'steps', hit: t.stepHitDays, eligible: t.stepEligible, win: (h) => `Step goal reached on ${h} of ${t.stepEligible} days.`, change: 'A ten-minute walk after one meal a day covers most of the gap.' },
  ];
  if (!i.trackingOnly && !i.hideNumbers) {
    dims.push({ key: 'calories', hit: t.onTargetDays, eligible: t.onTargetEligible, win: (h) => `Within 10% of the calorie target on ${h} of ${t.onTargetEligible} days.`, change: 'Plan the biggest meal of the day first; the rest fits around it more easily.' });
  }

  for (const d of dims) {
    if (d.eligible > 0 && d.hit / d.eligible >= 0.6 && d.hit >= 3) wins.push(d.win(d.hit));
  }
  if (t.workoutDays >= 3) wins.push(`Trained on ${t.workoutDays} days, ${t.workoutMinutes} minutes in all.`);
  else if (t.workoutDays > 0) wins.push(`Trained on ${t.workoutDays} day${t.workoutDays === 1 ? '' : 's'}.`);
  if (t.weightChangeKg != null && i.lastWeek && !i.hideNumbers) {
    const dir = t.weightChangeKg < -0.05 ? 'down' : t.weightChangeKg > 0.05 ? 'up' : 'steady';
    wins.push(dir === 'steady' ? 'Weight trend held steady.' : `Weight trend ${dir} ${Math.abs(t.weightChangeKg).toFixed(1)} kg.`);
  }

  // The weakest tracked dimension with room to move becomes the one change.
  const candidates = dims.filter((d) => d.eligible > 0).map((d) => ({ d, rate: d.hit / d.eligible }));
  const weakest = candidates.sort((a, b) => a.rate - b.rate)[0];
  const change = weakest && weakest.rate < 0.6 ? weakest.d.change : t.workoutDays === 0 ? 'Add one planned session from Train. Thirty minutes counts.' : null;

  let comparison: string | null = null;
  if (i.lastWeek && i.lastWeek.loggedDays > 0) {
    const diff = t.loggedDays - i.lastWeek.loggedDays;
    comparison = diff > 0 ? `${diff} more logged day${diff === 1 ? '' : 's'} than last week.` : diff < 0 ? `${-diff} fewer logged day${diff === -1 ? '' : 's'} than last week.` : 'Same number of logged days as last week.';
  }

  return { headline, wins, change, comparison };
}

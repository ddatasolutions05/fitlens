// One line a day for the Home screen. Plain encouragement in the app's own
// voice: no pressure, no shame, nothing about earning food or punishing a slip.
import { daysBetween } from './dates';

export const QUOTES: readonly string[] = [
  'Small, repeated choices are what the trend line is made of.',
  'One logged meal tells you more than a week of guessing.',
  'Consistency beats intensity. Show up, then adjust.',
  'The scale reports water, salt and timing as much as fat. Watch the trend, not the day.',
  'Protein first, then fill the plate with what you enjoy.',
  'A walk counts. Ten minutes counts. Logging it counts.',
  'Rest is part of training, not a break from it.',
  'You cannot manage what you do not measure. You also cannot measure everything. Log what matters.',
  'Progress is quieter than motivation. Keep the streak.',
  'Hunger is information, not an emergency.',
  'The best plan is the one you will still follow next month.',
  'Strength is built on the days you least feel like it.',
  'Aim for most days, not every day.',
  'A glass of water now is the easiest win on this screen.',
  'Fibre keeps you full. Vegetables are the cheapest way to get it.',
  'You are allowed to eat out, travel and celebrate. Log it and carry on.',
  'Two weigh-ins make a trend. Ten make a story.',
  'Slow progress is still progress. Fast progress is usually water.',
  'Sleep is the recovery tool nobody logs. Protect it.',
  'Lift something heavy, walk somewhere far, eat something green.',
  'Your future self is built from what today looks like on average.',
  'No day is wasted if you learned what moved the numbers.',
  'The gym is for training. The kitchen is for results. The log is for truth.',
  'Form before weight. Weight before ego.',
  'A missed day is a data point, not a verdict.',
  'Start with the next meal. That is the only one you can change.',
  'Steps add up quietly. So does everything else.',
  'Eat enough to train well. Train enough to eat well.',
  'Momentum comes from finishing, not from starting perfectly.',
  'Look at the week. Days lie, weeks tell the truth.',
];

/** The same quote for everyone on a given local date; rotates daily. */
export function quoteForDate(localDate: string): string {
  const n = Math.abs(daysBetween('2026-01-01', localDate));
  return QUOTES[n % QUOTES.length]!;
}

/** Greeting for the hour of day, 0 to 23. */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Good night';
}

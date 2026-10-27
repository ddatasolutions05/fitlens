import { describe, expect, it } from 'vitest';

import { dayInsight, type DayInsightInput } from './day';
import { violatesTone } from './tone';

const base: DayInsightInput = {
  logged: true,
  totals: { kcal: 1200, protein_g: 60, carbs_g: 150, fat_g: 40, fibre_g: 12, sodium_mg: null, sat_fat_g: null },
  targets: { calorieTarget: 2000, proteinG: 130, fibreG: 28, waterMl: 2800 },
  waterMl: 1500,
  hasWeightToday: false,
  daysSinceWeighIn: 1,
  hideNumbers: false,
  isToday: true,
  hourOfDay: 14,
};

describe('dayInsight', () => {
  it('asks for targets when something is logged but no goal exists', () => {
    expect(dayInsight({ ...base, targets: null }).kind).toBe('targets');
    expect(dayInsight({ ...base, targets: null, logged: false, totals: null }).kind).toBe('not_logged');
  });

  it('says not logged, never zero', () => {
    const r = dayInsight({ ...base, logged: false, totals: null });
    expect(r.kind).toBe('not_logged');
    expect(r.text).not.toMatch(/\b0\b/);
  });

  it('points at remaining protein after midday', () => {
    const r = dayInsight(base);
    expect(r.kind).toBe('protein');
    expect(r.text).toContain('70 g');
  });

  it('hides numbers when asked', () => {
    const r = dayInsight({ ...base, hideNumbers: true });
    expect(r.kind).toBe('protein');
    expect(r.text).not.toMatch(/\d/);
  });

  it('falls through to fibre, water, weigh-in and calm', () => {
    const withProtein = { ...base, totals: { ...base.totals!, protein_g: 120 } };
    expect(dayInsight({ ...withProtein, hourOfDay: 16, totals: { ...withProtein.totals, fibre_g: 5 } }).kind).toBe('fibre');
    expect(dayInsight({ ...withProtein, hourOfDay: 16, waterMl: 500 }).kind).toBe('water');
    expect(dayInsight({ ...withProtein, daysSinceWeighIn: 6 }).kind).toBe('weigh_in');
    expect(dayInsight({ ...withProtein, totals: { ...withProtein.totals, protein_g: 135 } }).kind).toBe('calm');
  });

  it('never violates the tone rules', () => {
    const variants: DayInsightInput[] = [
      base,
      { ...base, hideNumbers: true },
      { ...base, logged: false, totals: null },
      { ...base, targets: null },
      { ...base, hourOfDay: 16, totals: { ...base.totals!, protein_g: 130, fibre_g: 2 } },
      { ...base, hourOfDay: 16, totals: { ...base.totals!, protein_g: 130 }, waterMl: 100 },
      { ...base, totals: { ...base.totals!, protein_g: 130 }, daysSinceWeighIn: 10 },
    ];
    for (const v of variants) {
      const r = dayInsight(v);
      expect(violatesTone(r.text)).toEqual([]);
      expect(r.text).not.toMatch(/exercise|walk|workout/i);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { ADAPTIVE_MAX_STEP, adaptiveUnlocked, observedTdee, suggestTarget } from './adaptive';

describe('adaptiveUnlocked', () => {
  const ok = { days: 21, completeDays: 21, weighIns: 8 };

  it('unlocks at the thresholds', () => {
    expect(adaptiveUnlocked(ok, 'standard')).toEqual({ unlocked: true, reasons: [] });
  });

  it('20 days is not enough', () => {
    const r = adaptiveUnlocked({ ...ok, days: 20, completeDays: 20 }, 'standard');
    expect(r.unlocked).toBe(false);
    expect(r.reasons).toHaveLength(1);
  });

  it('79% complete is not enough, 80% is', () => {
    expect(adaptiveUnlocked({ days: 100, completeDays: 79, weighIns: 20 }, 'standard').unlocked).toBe(false);
    expect(adaptiveUnlocked({ days: 100, completeDays: 80, weighIns: 20 }, 'standard').unlocked).toBe(true);
  });

  it('7 weigh-ins is not enough', () => {
    expect(adaptiveUnlocked({ ...ok, weighIns: 7 }, 'standard').unlocked).toBe(false);
  });

  it('tracking only never unlocks', () => {
    const r = adaptiveUnlocked({ days: 90, completeDays: 90, weighIns: 90 }, 'tracking_only');
    expect(r.unlocked).toBe(false);
    expect(r.reasons[0]).toMatch(/tracking-only/);
  });
});

describe('observedTdee', () => {
  it('adds back the energy from weight lost', () => {
    // 1 kg lost over 28 days is 275 kcal a day.
    expect(observedTdee({ meanIntakeCompleteDays: 2000, trendStartKg: 80, trendEndKg: 79, days: 28 })).toBeCloseTo(2275, 6);
  });

  it('subtracts the energy from weight gained', () => {
    expect(observedTdee({ meanIntakeCompleteDays: 2500, trendStartKg: 70, trendEndKg: 70.5, days: 21 })).toBeCloseTo(
      2500 - (0.5 * 7700) / 21,
      6,
    );
  });
});

describe('suggestTarget', () => {
  const window = { days: 28, completeDays: 26, weighIns: 20, trendStartKg: 80, trendEndKg: 79.8, meanIntake: 2300 };
  const base = { currentTarget: 2300, currentTdeeEstimate: 2760, desiredDeficit: 440, window };

  it('caps upward moves at 150', () => {
    const s = suggestTarget({ ...base, observedTdee: 3200 });
    expect(s?.change).toBe(ADAPTIVE_MAX_STEP);
    expect(s?.proposedCalorieTarget).toBe(2450);
    expect(s?.evidence.uncappedChange).toBe(460);
  });

  it('caps downward moves at 150', () => {
    const s = suggestTarget({ ...base, observedTdee: 2300 });
    expect(s?.change).toBe(-ADAPTIVE_MAX_STEP);
    expect(s?.proposedCalorieTarget).toBe(2150);
  });

  it('stays inside the cap after rounding', () => {
    const s = suggestTarget({ ...base, currentTarget: 2305, observedTdee: 3200 });
    expect(s?.proposedCalorieTarget).toBe(2450);
    expect(s?.change).toBe(145);
  });

  it('passes smaller moves through, rounded to 10', () => {
    const s = suggestTarget({ ...base, observedTdee: 2824 });
    expect(s?.proposedCalorieTarget).toBe(2380);
    expect(s?.change).toBe(80);
    expect(s?.uncertainty).toMatch(/28 days/);
  });

  it('returns null for moves under 25 kcal', () => {
    expect(suggestTarget({ ...base, observedTdee: 2760 })).toBeNull();
    expect(suggestTarget({ ...base, observedTdee: 2758 })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_LEVEL_LABELS,
  ACTIVITY_MULTIPLIERS,
  ageOn,
  estimateTdee,
  mifflinStJeor,
  stepKcal,
  tdeeFromActivityLevel,
  tdeeFromLoggedActivity,
  workoutNetKcal,
} from './energy';

describe('ageOn', () => {
  it('counts whole years', () => {
    expect(ageOn('1996-05-10', '2026-05-09')).toBe(29);
    expect(ageOn('1996-05-10', '2026-05-10')).toBe(30);
    expect(ageOn('2000-02-29', '2026-02-28')).toBe(25);
  });

  it('rejects malformed dates', () => {
    expect(() => ageOn('10/05/1996', '2026-05-10')).toThrow(RangeError);
  });
});

describe('mifflinStJeor', () => {
  it('male', () => {
    const r = mifflinStJeor({ kg: 80, cm: 180, ageYears: 30, sex: 'male' });
    expect(r.ree).toBe(1780);
    expect(r.formula).toBe('10 × 80 + 6.25 × 180 − 5 × 30 + 5 = 1,780 kcal');
    expect(r.note).toBeNull();
  });

  it('female', () => {
    const r = mifflinStJeor({ kg: 65, cm: 165, ageYears: 30, sex: 'female' });
    expect(r.ree).toBeCloseTo(1370.25, 6);
    expect(r.formula).toContain('− 161 = 1,370 kcal');
  });

  it('unspecified averages the two constants and says so', () => {
    const r = mifflinStJeor({ kg: 80, cm: 180, ageYears: 30, sex: 'unspecified' });
    expect(r.ree).toBe((1780 + 1614) / 2);
    expect(r.ree).toBe(1697);
    expect(r.note).toMatch(/average/);
  });
});

describe('activity', () => {
  it('multipliers and labels', () => {
    expect(Object.values(ACTIVITY_MULTIPLIERS)).toEqual([1.2, 1.375, 1.55, 1.725, 1.9]);
    expect(Object.keys(ACTIVITY_LEVEL_LABELS)).toEqual(Object.keys(ACTIVITY_MULTIPLIERS));
  });

  it('activity level mode', () => {
    expect(tdeeFromActivityLevel(1780, 'moderate')).toBe(2759);
  });

  it('steps and workouts', () => {
    expect(stepKcal(8000, 80)).toBeCloseTo(320, 6);
    expect(workoutNetKcal(9.8, 80, 30)).toBeCloseTo(352, 6);
    expect(workoutNetKcal(0.5, 80, 30)).toBe(0);
  });

  it('logged activity mode', () => {
    const r = tdeeFromLoggedActivity({ ree: 1780, kg: 80, steps: 8000, workouts: [{ met: 9.8, minutes: 30 }] });
    expect(r).toEqual({ base: 2136, stepKcal: 320, workoutKcal: 352, tdee: 2808 });
  });

  it('null steps add nothing', () => {
    const r = tdeeFromLoggedActivity({ ree: 1780, kg: 80, steps: null, workouts: [] });
    expect(r.tdee).toBe(2136);
  });
});

describe('estimateTdee', () => {
  const common = { ree: 1780, kg: 80, level: 'moderate' as const, steps: 8000, workouts: [{ met: 9.8, minutes: 30 }] };

  it('activity level mode ignores logged steps and workouts', () => {
    const r = estimateTdee({ ...common, mode: 'activity_level' });
    expect(r.tdee).toBe(2759);
    expect(r.parts).toEqual({ ree: 1780, multiplier: 1.55 });
    expect(r.explanation).toContain('2,759');
  });

  it('logged activity mode adds steps and workouts', () => {
    const r = estimateTdee({ ...common, mode: 'logged_activity' });
    expect(r.tdee).toBe(2808);
    expect(r.parts.stepKcal).toBe(320);
    expect(r.parts.workoutKcal).toBe(352);
    expect(r.explanation).toContain('2,808');
  });
});

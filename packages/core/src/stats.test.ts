import { describe, expect, it } from 'vitest';

import { adherenceLabel, rangeStats, type StatsDay } from './stats';

function day(localDate: string, over: Partial<StatsDay> = {}): StatsDay {
  return {
    localDate,
    kcal: null,
    kcalTarget: 2000,
    protein: null,
    proteinTarget: 120,
    fibre: null,
    fibreTarget: 30,
    steps: null,
    stepTarget: 8000,
    waterMl: null,
    waterTarget: 2000,
    workoutMinutes: null,
    status: 'not_logged',
    ...over,
  };
}

describe('rangeStats', () => {
  it('averages logged days only and never treats null as zero', () => {
    const s = rangeStats([
      day('2026-10-20', { kcal: 1800, status: 'complete' }),
      day('2026-10-21'),
      day('2026-10-22', { kcal: 2200, status: 'partial' }),
    ]);
    expect(s.avgKcal).toBe(2000);
    expect(s.loggedDays).toBe(2);
    expect(s.completeDays).toBe(1);
    expect(s.kcalDelta).toBe(0);
  });

  it('counts on-target days within 10 percent of that day target', () => {
    const s = rangeStats([
      day('2026-10-20', { kcal: 2150, status: 'complete' }),
      day('2026-10-21', { kcal: 2300, status: 'complete' }),
      day('2026-10-22', { kcal: 1900, kcalTarget: 1800, status: 'complete' }),
      day('2026-10-23', { kcal: 1500, kcalTarget: null, status: 'complete' }),
    ]);
    expect(s.onTargetEligible).toBe(3);
    expect(s.onTargetDays).toBe(2);
  });

  it('computes the current and best logging streaks', () => {
    const s = rangeStats([
      day('2026-10-18', { status: 'complete' }),
      day('2026-10-19', { status: 'complete' }),
      day('2026-10-20', { status: 'complete' }),
      day('2026-10-21'),
      day('2026-10-22', { status: 'partial' }),
      day('2026-10-23', { status: 'complete' }),
    ]);
    expect(s.streak).toBe(2);
    expect(s.bestStreak).toBe(3);
  });

  it('reports protein, step and water adherence against per-day targets', () => {
    const s = rangeStats([
      day('2026-10-20', { protein: 130, steps: 9000, waterMl: 1500, status: 'complete' }),
      day('2026-10-21', { protein: 90, steps: 7000, waterMl: 2500, status: 'complete' }),
      day('2026-10-22', { protein: 125, proteinTarget: null, status: 'complete' }),
    ]);
    expect(s.proteinEligible).toBe(2);
    expect(s.proteinHitDays).toBe(1);
    expect(s.avgProtein).toBe(115);
    expect(s.stepHitDays).toBe(1);
    expect(s.waterHitDays).toBe(1);
  });

  it('sums workout minutes and derives the weekly weight rate from the trend', () => {
    const s = rangeStats(
      [day('2026-10-20', { workoutMinutes: 40, status: 'complete' }), day('2026-10-27', { workoutMinutes: 20, status: 'complete' })],
      [
        { localDate: '2026-10-20', kg: 80, trendKg: 80 },
        { localDate: '2026-10-27', kg: 79.2, trendKg: 79.3 },
      ],
    );
    expect(s.workoutMinutes).toBe(60);
    expect(s.workoutDays).toBe(2);
    expect(s.weightChangeKg).toBeCloseTo(-0.7, 5);
    expect(s.weeklyRateKg).toBeCloseTo(-0.7, 5);
  });

  it('leaves weight change unknown with fewer than two trend points', () => {
    const s = rangeStats([day('2026-10-20', { status: 'complete' })], [{ localDate: '2026-10-20', kg: 80, trendKg: 80 }]);
    expect(s.weightChangeKg).toBeNull();
    expect(s.weeklyRateKg).toBeNull();
  });
});

describe('adherenceLabel', () => {
  it('formats hits over eligible days and explains an empty window', () => {
    expect(adherenceLabel(5, 7, 'protein')).toBe('5 of 7 days');
    expect(adherenceLabel(0, 0, 'protein')).toBe('No protein target days');
  });
});

import { describe, expect, it } from 'vitest';

import type { RangeStats } from './stats';
import { rangeSummary } from './summary';

function stats(over: Partial<RangeStats> = {}): RangeStats {
  return {
    totalDays: 7,
    loggedDays: 5,
    completeDays: 3,
    streak: 2,
    bestStreak: 3,
    avgKcal: 2100,
    avgKcalTarget: 2000,
    kcalDelta: 100,
    onTargetDays: 3,
    onTargetEligible: 5,
    avgProtein: 120,
    proteinHitDays: 4,
    proteinEligible: 5,
    avgFibre: 25,
    avgSteps: 7000,
    stepHitDays: 2,
    stepEligible: 5,
    avgWater: 1800,
    waterHitDays: 1,
    waterEligible: 5,
    workoutMinutes: 90,
    workoutDays: 2,
    weightChangeKg: -0.6,
    weeklyRateKg: -0.6,
    ...over,
  };
}

const base = { rangeDays: 7, hideNumbers: false, trackingOnly: false, unitSystem: 'metric' as const };

describe('rangeSummary', () => {
  it('reports consistency, calorie adherence, protein and the weight trend in plain sentences', () => {
    const lines = rangeSummary({ stats: stats(), ...base });
    expect(lines[0]).toBe('You logged 5 of 7 days, 3 marked complete, and the current run is 2 days.');
    expect(lines[1]).toBe('Calories landed within 10% of target on 3 of 5 days, averaging above target by about 100 kcal.');
    expect(lines[2]).toBe('The weight trend moved down 0.6 kg, about 0.6 kg a week.');
    expect(lines).toHaveLength(3);
  });

  it('skips calorie figures when numbers are hidden or in tracking-only mode', () => {
    const hidden = rangeSummary({ stats: stats(), ...base, hideNumbers: true });
    expect(hidden.join(' ')).not.toMatch(/kcal/);
    expect(hidden[1]).toBe('Protein reached its target on 4 of 5 days.');
    const tracking = rangeSummary({ stats: stats(), ...base, trackingOnly: true });
    expect(tracking.join(' ')).not.toMatch(/Calories/);
  });

  it('explains an empty range instead of inventing zeros', () => {
    expect(rangeSummary({ stats: stats({ loggedDays: 0, completeDays: 0, streak: 0 }), ...base })).toEqual(['Nothing logged in the last 7 days. The summary starts with the first logged day.']);
  });

  it('asks for weigh-ins when the trend is unknown and uses imperial units when asked', () => {
    const noWeight = rangeSummary({ stats: stats({ weightChangeKg: null, weeklyRateKg: null }), ...base });
    expect(noWeight[2]).toBe('Two weigh-ins on different days would add a weight trend here.');
    const lb = rangeSummary({ stats: stats(), ...base, unitSystem: 'imperial' });
    expect(lb[2]).toMatch(/1\.3 lb, about 1\.3 lb a week/);
  });

  it('never uses judgement words', () => {
    const text = rangeSummary({ stats: stats({ kcalDelta: 400, onTargetDays: 0 }), ...base }).join(' ');
    expect(text).not.toMatch(/\b(good|bad|great|poor|cheat|junk|failed|guilty)\b/i);
  });
});

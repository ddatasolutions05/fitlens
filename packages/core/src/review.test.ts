import { describe, expect, it } from 'vitest';

import { weeklyReview } from './review';
import type { RangeStats } from './stats';

function stats(over: Partial<RangeStats> = {}): RangeStats {
  return {
    totalDays: 7,
    loggedDays: 6,
    completeDays: 4,
    streak: 3,
    bestStreak: 4,
    avgKcal: 2100,
    avgKcalTarget: 2200,
    kcalDelta: -100,
    onTargetDays: 5,
    onTargetEligible: 6,
    avgProtein: 120,
    proteinHitDays: 5,
    proteinEligible: 6,
    avgFibre: 25,
    avgSteps: 7000,
    stepHitDays: 2,
    stepEligible: 6,
    avgWater: 2000,
    waterHitDays: 1,
    waterEligible: 6,
    workoutMinutes: 120,
    workoutDays: 3,
    weightChangeKg: -0.4,
    weeklyRateKg: -0.4,
    ...over,
  };
}

describe('weeklyReview', () => {
  it('names the wins and picks the weakest dimension as the one change', () => {
    const r = weeklyReview({ thisWeek: stats(), lastWeek: stats({ loggedDays: 4 }), hideNumbers: false, trackingOnly: false });
    expect(r.headline).toContain('6 of 7');
    expect(r.wins.join(' ')).toContain('Protein target reached on 5 of 6');
    expect(r.wins.join(' ')).toContain('Trained on 3 days');
    expect(r.wins.join(' ')).toContain('down 0.4 kg');
    expect(r.change).toContain('bottle');
    expect(r.comparison).toBe('2 more logged days than last week.');
  });

  it('says nothing about calories or weight when numbers are hidden or tracking only', () => {
    const r = weeklyReview({ thisWeek: stats(), lastWeek: stats(), hideNumbers: true, trackingOnly: true });
    expect(r.wins.join(' ')).not.toMatch(/calorie|kg/);
  });

  it('handles an empty week without blame', () => {
    const r = weeklyReview({ thisWeek: stats({ loggedDays: 0, workoutDays: 0 }), lastWeek: null, hideNumbers: false, trackingOnly: false });
    expect(r.headline).toBe('No logs this week.');
    expect(r.change).toContain('One is enough');
    expect(r.wins).toHaveLength(0);
  });

  it('never uses shaming words', () => {
    for (const s of [stats(), stats({ loggedDays: 2, proteinHitDays: 0, workoutDays: 0 })]) {
      const r = weeklyReview({ thisWeek: s, lastWeek: null, hideNumbers: false, trackingOnly: false });
      const text = [r.headline, ...r.wins, r.change ?? '', r.comparison ?? ''].join(' ');
      expect(text).not.toMatch(/\b(cheat|junk|bad|guilt|lazy|fail|punish|burn off)\b/i);
    }
  });
});

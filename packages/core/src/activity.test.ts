import { describe, expect, it } from 'vitest';
import { MET_TABLE, WORKOUT_TYPES, metFor, workoutEstimate } from './activity';

describe('activity', () => {
  it('has a MET row for every workout type', () => {
    expect(WORKOUT_TYPES.map((w) => w.key).sort()).toEqual(Object.keys(MET_TABLE).sort());
  });

  it('looks up METs', () => {
    expect(metFor('running', 'moderate')).toBe(9.8);
    expect(metFor('walking', 'light')).toBe(2.8);
    expect(metFor('cycling', 'vigorous')).toBe(10);
  });

  it('intensities increase', () => {
    for (const row of Object.values(MET_TABLE)) {
      expect(row.light).toBeLessThan(row.moderate);
      expect(row.moderate).toBeLessThan(row.vigorous);
    }
  });

  it('estimates net kcal', () => {
    expect(workoutEstimate({ type: 'running', intensity: 'moderate', minutes: 30, kg: 80 })).toEqual({ met: 9.8, kcal: 352 });
    expect(workoutEstimate({ type: 'yoga', intensity: 'light', minutes: 60, kg: 60 })).toEqual({ met: 2.5, kcal: 90 });
  });
});

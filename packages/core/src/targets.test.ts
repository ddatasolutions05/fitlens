import { describe, expect, it } from 'vitest';
import { bmi, computeTargets, type TargetInputs } from './targets';

const base: TargetInputs = {
  goalType: 'fat_loss',
  pace: 0.005,
  kg: 80,
  goalKg: 72,
  cm: 180,
  tdee: 2759,
  ree: 1780,
  mode: 'standard',
  typicalSteps: 6000,
};

describe('bmi', () => {
  it('computes kg/m²', () => {
    expect(bmi(80, 180)).toBeCloseTo(24.69, 2);
  });
});

describe('computeTargets', () => {
  it('converts pace to a daily deficit', () => {
    // 0.5% of 80 kg is 400 g a week, 400 g × 7,700 / 7 = 440 kcal a day.
    const t = computeTargets(base);
    expect(t.deficitKcalPerDay).toBe(440);
    expect(t.calorieTarget).toBe(2320);
    expect(t.rationale).toBe(
      'Fat loss at 0.5% of body weight per week, about 440 kcal below an estimated 2,760 kcal TDEE (7,700 kcal per kg is an approximation).',
    );
    expect(t.notes.join(' ')).toMatch(/approximation/);
  });

  it('clamps pace and defaults it', () => {
    expect(computeTargets({ ...base, pace: 0.05 }).deficitKcalPerDay).toBe(880);
    expect(computeTargets({ ...base, pace: 0.0001 }).deficitKcalPerDay).toBe(220);
    expect(computeTargets({ ...base, pace: null }).deficitKcalPerDay).toBe(440);
  });

  it('never goes below REE', () => {
    const t = computeTargets({ ...base, tdee: 2000, ree: 1800, pace: 0.01 });
    expect(t.calorieTarget).toBe(1800);
    expect(t.deficitKcalPerDay).toBe(200);
    expect(t.notes.some((n) => n.includes('resting energy'))).toBe(true);
  });

  it('holds at maintenance when the goal weight is below BMI 18.5', () => {
    const t = computeTargets({ ...base, goalKg: 55 });
    expect(t.calorieTarget).toBe(2760);
    expect(t.deficitKcalPerDay).toBe(0);
    expect(t.notes.some((n) => n.includes('18.5'))).toBe(true);
  });

  it('maintenance and muscle gain', () => {
    expect(computeTargets({ ...base, goalType: 'maintenance' }).calorieTarget).toBe(2760);
    expect(computeTargets({ ...base, goalType: 'muscle_gain' }).calorieTarget).toBe(3010);
    expect(computeTargets({ ...base, goalType: 'muscle_gain', surplusKcal: 1000 }).calorieTarget).toBe(3110);
    expect(computeTargets({ ...base, goalType: 'muscle_gain', surplusKcal: 0 }).calorieTarget).toBe(2910);
  });

  it('tracking only has no calorie target and no deficit', () => {
    const t = computeTargets({ ...base, mode: 'tracking_only' });
    expect(t.calorieTarget).toBeNull();
    expect(t.deficitKcalPerDay).toBe(0);
    expect(t.carbsG).toBeNull();
    expect(t.fatG).toBeNull();
    expect(t.proteinG).toBe(128);
    expect(t.fibreG).toBe(39);
    expect(t.waterMl).toBe(2800);
    expect(t.notes.join(' ')).toMatch(/doctor or dietitian/);
  });

  it('protein per goal, capped at 2.2 g/kg', () => {
    expect(computeTargets({ ...base, goalType: 'fat_loss' }).proteinG).toBe(128);
    expect(computeTargets({ ...base, goalType: 'maintenance' }).proteinG).toBe(96);
    expect(computeTargets({ ...base, goalType: 'muscle_gain' }).proteinG).toBe(144);
    for (const goalType of ['fat_loss', 'maintenance', 'muscle_gain'] as const) {
      expect(computeTargets({ ...base, goalType }).proteinG).toBeLessThanOrEqual(2.2 * base.kg);
    }
  });

  it('uses goal weight for protein when BMI is over 30', () => {
    const t = computeTargets({ ...base, kg: 110, cm: 170, goalKg: 80, tdee: 3000, ree: 2000 });
    expect(t.proteinG).toBe(128);
    expect(computeTargets({ ...base, kg: 110, cm: 170, goalKg: null, tdee: 3000, ree: 2000 }).proteinG).toBe(176);
  });

  it('macros add up to the calorie target within rounding', () => {
    for (const goalType of ['fat_loss', 'maintenance', 'muscle_gain'] as const) {
      const t = computeTargets({ ...base, goalType });
      const kcal = t.proteinG * 4 + (t.carbsG ?? 0) * 4 + (t.fatG ?? 0) * 9;
      expect(Math.abs(kcal - (t.calorieTarget ?? 0))).toBeLessThanOrEqual(8);
      expect(t.fatG).toBe(Math.round((0.25 * (t.calorieTarget ?? 0)) / 9));
    }
  });

  it('fibre, water and steps', () => {
    const t = computeTargets(base);
    expect(t.fibreG).toBe(32);
    expect(t.waterMl).toBe(2800);
    expect(t.stepGoal).toBe(7000);
    expect(computeTargets({ ...base, typicalSteps: null }).stepGoal).toBe(8000);
    expect(computeTargets({ ...base, stepGoalOverride: 12000 }).stepGoal).toBe(12000);
  });
});

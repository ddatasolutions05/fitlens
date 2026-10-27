import { formatInt, formatNumber } from './format';

export type GoalType = 'fat_loss' | 'maintenance' | 'muscle_gain';
export type ProfileMode = 'standard' | 'tracking_only';

/** Energy in 1 kg of body weight change. An approximation. */
export const KCAL_PER_KG = 7700;

/** Weekly loss as a fraction of body weight. */
export const PACE_MIN = 0.0025;
export const PACE_MAX = 0.01;
export const PACE_DEFAULT = 0.005;

export const SURPLUS_MIN = 150;
export const SURPLUS_MAX = 350;
export const SURPLUS_DEFAULT = 250;

const PROTEIN_G_PER_KG: Record<GoalType, number> = { fat_loss: 1.6, maintenance: 1.2, muscle_gain: 1.8 };
const PROTEIN_CAP_G_PER_KG = 2.2;
const BMI_FLOOR = 18.5;

export function bmi(kg: number, cm: number): number {
  const m = cm / 100;
  return kg / (m * m);
}

export interface TargetInputs {
  goalType: GoalType;
  pace?: number | null;
  surplusKcal?: number | null;
  kg: number;
  goalKg: number | null;
  cm: number;
  tdee: number;
  ree: number;
  mode: ProfileMode;
  typicalSteps: number | null;
  stepGoalOverride?: number | null;
}

export interface Targets {
  calorieTarget: number | null;
  deficitKcalPerDay: number;
  proteinG: number;
  carbsG: number | null;
  fatG: number | null;
  fibreG: number | null;
  waterMl: number;
  stepGoal: number;
  notes: string[];
  rationale: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round10 = (n: number) => Math.round(n / 10) * 10;

function proteinFor(i: TargetInputs): number {
  const useGoal = i.goalKg != null && bmi(i.kg, i.cm) > 30;
  const kgUsed = useGoal && i.goalKg != null ? i.goalKg : i.kg;
  const perKg = Math.min(PROTEIN_G_PER_KG[i.goalType], PROTEIN_CAP_G_PER_KG);
  return Math.round(perKg * kgUsed);
}

function fibreFor(kcal: number): number {
  return Math.round((14 * kcal) / 1000);
}

/** Daily targets from goal, body size and energy estimates. */
export function computeTargets(i: TargetInputs): Targets {
  const proteinG = proteinFor(i);
  const waterMl = Math.round((35 * i.kg) / 50) * 50;
  const stepGoal = i.stepGoalOverride ?? (i.typicalSteps != null ? i.typicalSteps + 1000 : 8000);
  const tdeeText = `${formatInt(round10(i.tdee))} kcal`;

  if (i.mode === 'tracking_only') {
    return {
      calorieTarget: null,
      deficitKcalPerDay: 0,
      proteinG,
      carbsG: null,
      fatG: null,
      fibreG: fibreFor(i.tdee),
      waterMl,
      stepGoal,
      notes: ['Tracking only, no calorie target. If you want targets, set them with your doctor or dietitian.'],
      rationale: `Tracking only. Protein, fibre and water are based on your current weight and an estimated ${tdeeText} TDEE.`,
    };
  }

  const notes: string[] = [];
  let raw: number;
  let deficit = 0;
  let rationale: string;

  if (i.goalType === 'fat_loss') {
    const pace = clamp(i.pace ?? PACE_DEFAULT, PACE_MIN, PACE_MAX);
    const lowGoal = i.goalKg != null && bmi(i.goalKg, i.cm) < BMI_FLOOR;
    if (lowGoal) {
      raw = i.tdee;
      notes.push('The goal weight is below a BMI of 18.5, so the target is set at maintenance.');
      rationale = `Calorie target set at an estimated ${tdeeText} TDEE.`;
    } else {
      deficit = Math.round((pace * i.kg * KCAL_PER_KG) / 7);
      raw = i.tdee - deficit;
      notes.push('Uses 7,700 kcal per kg of body weight, which is an approximation.');
      rationale =
        `Fat loss at ${formatNumber(pace * 100, 2)}% of body weight per week, about ${formatInt(deficit)} kcal ` +
        `below an estimated ${tdeeText} TDEE (7,700 kcal per kg is an approximation).`;
    }
  } else if (i.goalType === 'muscle_gain') {
    const surplus = clamp(i.surplusKcal ?? SURPLUS_DEFAULT, SURPLUS_MIN, SURPLUS_MAX);
    raw = i.tdee + surplus;
    rationale = `Muscle gain with about ${formatInt(surplus)} kcal above an estimated ${tdeeText} TDEE.`;
  } else {
    raw = i.tdee;
    rationale = `Maintenance at an estimated ${tdeeText} TDEE.`;
  }

  if (raw < i.ree) {
    raw = i.ree;
    deficit = Math.max(0, Math.round(i.tdee - i.ree));
    notes.push(`The target is held at your estimated resting energy of ${formatInt(i.ree)} kcal.`);
    rationale = `Calorie target held at an estimated resting energy of ${formatInt(i.ree)} kcal, about ${formatInt(deficit)} kcal below an estimated ${tdeeText} TDEE.`;
  }

  const kcal = round10(raw);
  const fatG = Math.round((0.25 * kcal) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));

  return {
    calorieTarget: kcal,
    deficitKcalPerDay: deficit,
    proteinG,
    carbsG,
    fatG,
    fibreG: fibreFor(kcal),
    waterMl,
    stepGoal,
    notes,
    rationale,
  };
}

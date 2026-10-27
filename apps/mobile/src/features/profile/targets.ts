// Builds a goal_versions row from profile answers. Pure glue over packages/core.
import {
  ageOn,
  computeTargets,
  mifflinStJeor,
  tdeeFromActivityLevel,
  type ActivityLevel,
  type ActivityMode,
  type GoalType,
  type ProfileMode,
  type ReeResult,
  type SexForEquation,
  type Targets,
} from '@fitlens/core';

import type { GoalVersionInsert } from './hooks';

export interface GoalInputs {
  localDate: string;
  birthDate: string;
  sex: SexForEquation;
  heightCm: number;
  kg: number;
  goalKg: number | null;
  mode: ProfileMode;
  goalType: GoalType;
  pace: number | null;
  surplusKcal: number | null;
  activityMode: ActivityMode;
  activityLevel: ActivityLevel;
  typicalSteps: number | null;
  stepGoalOverride: number | null;
}

export interface GoalPlan {
  ree: ReeResult;
  tdee: number;
  targets: Targets;
  row: Omit<GoalVersionInsert, 'user_id'>;
}

export function planGoal(i: GoalInputs): GoalPlan {
  const ageYears = ageOn(i.birthDate, i.localDate);
  const ree = mifflinStJeor({ kg: i.kg, cm: i.heightCm, ageYears, sex: i.sex });
  // Baseline TDEE for targets always uses the activity multiplier: logged
  // activity varies day to day and is shown, not budgeted.
  const tdee = Math.round(tdeeFromActivityLevel(ree.ree, i.activityLevel));
  const goalType: GoalType = i.mode === 'tracking_only' ? 'maintenance' : i.goalType;
  const targets = computeTargets({
    goalType,
    pace: i.pace,
    surplusKcal: i.surplusKcal,
    kg: i.kg,
    goalKg: i.goalKg,
    cm: i.heightCm,
    tdee,
    ree: ree.ree,
    mode: i.mode,
    typicalSteps: i.typicalSteps,
    stepGoalOverride: i.stepGoalOverride,
  });
  return {
    ree,
    tdee,
    targets,
    row: {
      effective_from: i.localDate,
      goal_type: goalType,
      pace: i.mode === 'tracking_only' ? null : goalType === 'fat_loss' ? i.pace : null,
      activity_mode: i.activityMode,
      activity_level: i.activityLevel,
      calorie_target: targets.calorieTarget,
      protein_g: targets.proteinG,
      carbs_g: targets.carbsG,
      fat_g: targets.fatG,
      fibre_g: targets.fibreG,
      step_goal: targets.stepGoal,
      water_ml: targets.waterMl,
      source: 'calculated',
      rationale: targets.rationale,
      inputs: {
        kg: i.kg,
        goalKg: i.goalKg,
        heightCm: i.heightCm,
        ageYears,
        sex: i.sex,
        ree: ree.ree,
        tdee,
        activityLevel: i.activityLevel,
        surplusKcal: i.surplusKcal,
        notes: targets.notes,
      },
    },
  };
}

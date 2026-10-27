// Derives REE and TDEE for a profile on a given day from the goal version in
// force and the latest weight. Pure glue over packages/core.
import {
  ageOn,
  estimateTdee,
  mifflinStJeor,
  type ActivityLevel,
  type ActivityMode,
  type ReeResult,
  type SexForEquation,
  type TdeeEstimate,
} from '@fitlens/core';

import type { GoalVersionRow, ProfileRow } from './hooks';

export interface EnergyEstimate {
  ree: ReeResult;
  tdee: TdeeEstimate;
  kg: number;
  ageYears: number;
}

export function energyEstimateFor(i: {
  profile: ProfileRow;
  goal: GoalVersionRow | null;
  kg: number | null;
  localDate: string;
  steps: number | null;
  workouts: { met: number; minutes: number }[];
}): EnergyEstimate | null {
  const { profile, goal } = i;
  if (!profile.birth_date || profile.height_cm == null || i.kg == null) return null;
  const ageYears = ageOn(profile.birth_date, i.localDate);
  const ree = mifflinStJeor({
    kg: i.kg,
    cm: Number(profile.height_cm),
    ageYears,
    sex: profile.sex_for_equation as SexForEquation,
  });
  const mode = (goal?.activity_mode ?? 'activity_level') as ActivityMode;
  const level = (goal?.activity_level ?? 'sedentary') as ActivityLevel;
  const tdee = estimateTdee({ ree: ree.ree, kg: i.kg, mode, level, steps: i.steps, workouts: i.workouts });
  return { ree, tdee, kg: i.kg, ageYears };
}

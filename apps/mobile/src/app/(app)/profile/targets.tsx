import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  ACTIVITY_LEVEL_LABELS,
  PACE_DEFAULT,
  SURPLUS_DEFAULT,
  todayLocal,
  type ActivityLevel,
  type ActivityMode,
  type GoalType,
  type SexForEquation,
} from '@fitlens/core';

import { goBack } from '@/lib/nav';
import { useAddGoalVersion, useGoalForDate, useGoalHistory, useLatestWeight, useProfile, type GoalVersionRow, type ProfileRow } from '@/features/profile/hooks';
import { planGoal } from '@/features/profile/targets';
import { errorMessage } from '@/lib/net';
import { Button, Card, NumberField, Screen, Segmented, SkeletonCard, Text, space } from '@/ui';

export default function TargetsScreen() {
  const today = todayLocal();
  const profile = useProfile();
  const current = useGoalForDate(today);
  const history = useGoalHistory();
  const weight = useLatestWeight();
  const kg = weight.data ? Number(weight.data.kg) : null;
  const ready = !profile.isLoading && !current.isLoading && !weight.isLoading;
  const complete = profile.data?.birth_date && profile.data.height_cm != null && kg != null;

  return (
    <Screen testID="targets-screen">
      <Text variant="title" style={{ marginTop: space.lg }}>
        Targets
      </Text>
      {!ready ? (
        <SkeletonCard lines={5} />
      ) : !profile.data || !complete ? (
        <Card tone="alt">
          <Text color="textMuted">Complete your profile (birth date, height) and log a weight to calculate targets.</Text>
          <Button label="Edit profile" variant="secondary" onPress={() => router.push('/profile/edit')} />
        </Card>
      ) : (
        <TargetsForm key={current.data?.id ?? 'none'} p={profile.data} current={current.data ?? null} kg={kg as number} today={today} />
      )}
      {history.data && history.data.length > 0 ? (
        <Card style={{ gap: space.xs }}>
          <Text variant="heading">History</Text>
          {history.data.map((g) => (
            <Text key={g.id} variant="small" color="textMuted">
              {g.effective_from}: {g.calorie_target != null ? `${g.calorie_target} kcal` : 'no calorie target'}, {g.goal_type.replace('_', ' ')} ({g.source.replace('_', ' ')})
            </Text>
          ))}
        </Card>
      ) : null}
      <Button label="Back" variant="ghost" onPress={() => goBack('/profile')} />
    </Screen>
  );
}

function TargetsForm({ p, current, kg, today }: { p: ProfileRow; current: GoalVersionRow | null; kg: number; today: string }) {
  const addGoal = useAddGoalVersion();
  const surplusFromInputs = (current?.inputs as { surplusKcal?: number } | null)?.surplusKcal;
  const [goalType, setGoalType] = useState<GoalType>((current?.goal_type as GoalType) ?? 'maintenance');
  const [pace, setPace] = useState(current?.pace != null ? Number(current.pace) : PACE_DEFAULT);
  const [surplus, setSurplus] = useState(surplusFromInputs ?? SURPLUS_DEFAULT);
  const [activityMode, setActivityMode] = useState<ActivityMode>((current?.activity_mode as ActivityMode) ?? 'activity_level');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>((current?.activity_level as ActivityLevel) ?? 'sedentary');
  const [stepGoal, setStepGoal] = useState<number | null>(current?.step_goal ?? null);
  const [manual, setManual] = useState(false);
  const [manualKcal, setManualKcal] = useState<number | null>(null);
  const [manualProtein, setManualProtein] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(
    () =>
      planGoal({
        localDate: today,
        birthDate: p.birth_date as string,
        sex: p.sex_for_equation as SexForEquation,
        heightCm: Number(p.height_cm),
        kg,
        goalKg: p.goal_weight_kg == null ? null : Number(p.goal_weight_kg),
        mode: p.mode as 'standard' | 'tracking_only',
        goalType,
        pace,
        surplusKcal: surplus,
        activityMode,
        activityLevel,
        typicalSteps: p.typical_steps,
        stepGoalOverride: stepGoal,
      }),
    [p, kg, today, goalType, pace, surplus, activityMode, activityLevel, stepGoal],
  );
  const trackingOnly = p.mode === 'tracking_only';

  async function save() {
    setError(null);
    try {
      if (manual) {
        const kcal = manualKcal ?? plan.row.calorie_target ?? null;
        const protein = manualProtein ?? plan.row.protein_g ?? null;
        const belowRee = kcal != null && kcal < plan.ree.ree;
        await addGoal.mutateAsync({
          ...plan.row,
          calorie_target: kcal,
          protein_g: protein,
          source: 'manual',
          rationale: `Set manually.${belowRee ? ` This is below your estimated resting energy of ${Math.round(plan.ree.ree)} kcal.` : ''}`,
        });
      } else {
        await addGoal.mutateAsync(plan.row);
      }
      goBack('/profile');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      {trackingOnly ? (
        <Card tone="alt">
          <Text variant="bodyStrong">Tracking-only mode</Text>
          <Text variant="small" color="textMuted">
            No deficit, pace or adaptive changes. Intake, nutrients, activity and weight are still tracked. Targets are best set with your care provider; change the mode in Edit profile if your circumstances change.
          </Text>
        </Card>
      ) : (
        <Card style={{ gap: space.lg }}>
          <Segmented<GoalType>
            label="Goal"
            wrap
            value={goalType}
            onChange={setGoalType}
            options={[
              { value: 'fat_loss', label: 'Fat loss' },
              { value: 'maintenance', label: 'Maintain' },
              { value: 'muscle_gain', label: 'Muscle gain' },
            ]}
          />
          {goalType === 'fat_loss' ? (
            <Segmented<string>
              label="Pace (of body weight per week)"
              wrap
              value={String(pace)}
              onChange={(v) => setPace(Number(v))}
              options={[
                { value: '0.0025', label: '0.25%' },
                { value: '0.005', label: '0.5%' },
                { value: '0.0075', label: '0.75%' },
                { value: '0.01', label: '1%' },
              ]}
            />
          ) : null}
          {goalType === 'muscle_gain' ? (
            <Segmented<string>
              label="Daily surplus"
              value={String(surplus)}
              onChange={(v) => setSurplus(Number(v))}
              options={[
                { value: '150', label: '+150' },
                { value: '250', label: '+250' },
                { value: '350', label: '+350' },
              ]}
            />
          ) : null}
        </Card>
      )}

      <Card style={{ gap: space.lg }}>
        <Segmented<ActivityMode>
          label="How to estimate daily energy"
          value={activityMode}
          onChange={setActivityMode}
          options={[
            { value: 'activity_level', label: 'Activity level', hint: 'multiplier, default' },
            { value: 'logged_activity', label: 'Logged activity', hint: 'steps + workouts' },
          ]}
        />
        <Segmented<ActivityLevel>
          label="Activity level"
          wrap
          value={activityLevel}
          onChange={setActivityLevel}
          options={(Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]).map((k) => ({ value: k, label: ACTIVITY_LEVEL_LABELS[k] }))}
        />
        <NumberField label="Step goal" value={stepGoal} onChangeNumber={setStepGoal} decimals={0} placeholder={String(plan.targets.stepGoal)} />
      </Card>

      <Card tone="accent" style={{ gap: space.sm }}>
        <Text variant="small" color="accent">
          Calculated
        </Text>
        <Text variant="heading" tabular>
          {plan.targets.calorieTarget != null ? `${plan.targets.calorieTarget.toLocaleString()} kcal` : 'No calorie target'}
        </Text>
        <Text variant="small">{plan.targets.rationale}</Text>
        <Text variant="small" color="textMuted">
          REE {Math.round(plan.ree.ree).toLocaleString()} · TDEE {plan.tdee.toLocaleString()} · Protein {plan.targets.proteinG} g
          {plan.targets.carbsG != null ? ` · Carbs ${plan.targets.carbsG} g` : ''}
          {plan.targets.fatG != null ? ` · Fat ${plan.targets.fatG} g` : ''}
          {plan.targets.fibreG != null ? ` · Fibre ${plan.targets.fibreG} g` : ''} · Water {plan.targets.waterMl} ml
        </Text>
        {plan.targets.notes.map((n) => (
          <Text key={n} variant="caption" color="textMuted">
            {n}
          </Text>
        ))}
      </Card>

      {trackingOnly ? null : (
      <Card style={{ gap: space.md }}>
        <Segmented<'calc' | 'manual'>
          label="Override"
          value={manual ? 'manual' : 'calc'}
          onChange={(v) => setManual(v === 'manual')}
          options={[
            { value: 'calc', label: 'Use calculated' },
            { value: 'manual', label: 'Set my own' },
          ]}
        />
        {manual ? (
          <View style={{ gap: space.md }}>
            <NumberField label="Calorie target (kcal)" value={manualKcal} onChangeNumber={setManualKcal} decimals={0} placeholder={String(plan.targets.calorieTarget ?? '')} />
            <NumberField label="Protein (g)" value={manualProtein} onChangeNumber={setManualProtein} decimals={0} placeholder={String(plan.targets.proteinG)} />
            {manualKcal != null && manualKcal < plan.ree.ree ? (
              <Text variant="caption" color="textMuted">
                This is below your estimated resting energy of {Math.round(plan.ree.ree)} kcal.
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>
      )}

      {error ? (
        <Text color="danger" variant="small">
          {error}
        </Text>
      ) : null}
      <Button label="Save as new version from today" size="lg" onPress={() => void save()} loading={addGoal.isPending} testID="save-targets" />
      <Text variant="caption" color="textFaint">
        Past days keep the targets that were in force then. Saving creates a new version effective from today.
      </Text>
    </>
  );
}

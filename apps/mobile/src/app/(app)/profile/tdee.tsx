import { router } from 'expo-router';
import { ACTIVITY_LEVEL_LABELS, ACTIVITY_MULTIPLIERS, roundKcal, todayLocal, type ActivityLevel } from '@fitlens/core';

import { useDay } from '@/features/day/hooks';
import { useProfile } from '@/features/profile/hooks';
import { energyEstimateFor } from '@/features/profile/tdee';
import { Button, Card, PageHeader, Screen, SkeletonCard, space, Text } from '@/ui';

export default function TdeeExplainer() {
  const today = todayLocal();
  const profile = useProfile();
  const day = useDay(today);
  const estimate =
    profile.data && day.data
      ? energyEstimateFor({ profile: profile.data, goal: day.data.goal, kg: day.data.weight?.kg ?? null, localDate: today, steps: day.data.steps, workouts: day.data.workouts })
      : null;
  const goal = day.data?.goal ?? null;
  const level = (goal?.activity_level ?? 'sedentary') as ActivityLevel;

  return (
    <Screen testID="tdee-explainer">
      <PageHeader title="TDEE and your food target" backTo="/profile" />
      {profile.isLoading || day.isLoading ? (
        <SkeletonCard lines={4} />
      ) : (
        <>
          <Card style={{ gap: space.sm }}>
            <Text variant="heading">1. Resting energy (REE)</Text>
            <Text color="textMuted" variant="small">
              What your body uses at complete rest. Mifflin-St Jeor with your numbers:
            </Text>
            <Text tabular>{estimate ? estimate.ree.formula : 'Log a weight and complete your profile to see this.'}</Text>
            {estimate?.ree.note ? (
              <Text variant="caption" color="textFaint">
                {estimate.ree.note}
              </Text>
            ) : null}
            <Text variant="caption" color="textFaint">
              Individual REE commonly varies by about ±10% from the formula.
            </Text>
          </Card>
          <Card style={{ gap: space.sm }}>
            <Text variant="heading">2. Total daily energy (TDEE)</Text>
            <Text color="textMuted" variant="small">
              {goal?.activity_mode === 'logged_activity'
                ? 'Logged-activity mode: REE × 1.2, plus a step estimate (steps × kg × 0.0005) and net workout estimate ((MET − 1) × kg × hours) for the same day.'
                : `Activity-level mode: REE × ${ACTIVITY_MULTIPLIERS[level]} (${ACTIVITY_LEVEL_LABELS[level]}). Logged steps and workouts are shown but not added, because the multiplier already includes typical activity.`}
            </Text>
            <Text tabular variant="heading">
              {estimate ? `${(roundKcal(estimate.tdee.tdee) ?? 0).toLocaleString()} kcal` : 'unknown'}
            </Text>
            {estimate ? (
              <Text variant="caption" color="textFaint">
                {estimate.tdee.explanation}
              </Text>
            ) : null}
          </Card>
          <Card tone="accent" style={{ gap: space.sm }}>
            <Text variant="heading">3. Food target</Text>
            <Text variant="small">
              {goal?.calorie_target != null
                ? profile.data?.mode === 'tracking_only'
                  ? 'No calorie target in tracking-only mode.'
                  : `${goal.calorie_target.toLocaleString()} kcal. ${goal.rationale ?? ''}`
                : goal
                  ? 'No calorie target in tracking-only mode.'
                  : 'No target yet.'}
            </Text>
            <Text variant="caption" color="textMuted">
              TDEE is what you burn; the target is what you aim to eat. The gap between them is your deficit or surplus. Wearable &quot;active calories&quot; are never added to the target.
            </Text>
          </Card>
          <Button label="Change goal or activity mode" variant="secondary" onPress={() => router.push('/profile/targets')} />
        </>
      )}
    </Screen>
  );
}

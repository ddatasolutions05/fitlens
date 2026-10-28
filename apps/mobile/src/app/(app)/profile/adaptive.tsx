import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { adaptiveUnlocked, observedTdee, suggestTarget, todayLocal, type ProfileMode } from '@fitlens/core';

import { useUserId } from '@/features/auth/session';
import { useAddGoalVersion, useGoalForDate, useLatestWeight, useProfile } from '@/features/profile/hooks';
import { energyEstimateFor } from '@/features/profile/tdee';
import { useProgress } from '@/features/progress/hooks';
import { goBack } from '@/lib/nav';
import { errorMessage } from '@/lib/net';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/telemetry';
import { Button, Card, Note, PageHeader, Screen, SkeletonCard, Stat, Text, space, toast, useTheme } from '@/ui';

export default function AdaptiveScreen() {
  const { colors } = useTheme();
  const userId = useUserId();
  const today = todayLocal();
  const profile = useProfile();
  const goal = useGoalForDate(today);
  const weight = useLatestWeight();
  const progress = useProgress(30);
  const addGoal = useAddGoalVersion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<number | null>(null);

  const result = useMemo(() => {
    if (!progress.data || !profile.data || !goal.data) return null;
    const p = progress.data;
    const mode = (profile.data.mode ?? 'standard') as ProfileMode;
    const window = { days: p.days.length, completeDays: p.consistency.complete, weighIns: p.weights.length };
    const gate = adaptiveUnlocked(window, mode);
    const currentTarget = goal.data.calorie_target;
    if (!gate.unlocked || currentTarget == null) return { gate, suggestion: null, observed: null, currentTarget };
    const complete = p.days.filter((d) => d.status === 'complete' && d.kcal != null);
    const meanIntake = complete.reduce((s, d) => s + (d.kcal ?? 0), 0) / Math.max(1, complete.length);
    const first = p.weights[0]!;
    const last = p.weights[p.weights.length - 1]!;
    const observed = Math.round(observedTdee({ meanIntakeCompleteDays: meanIntake, trendStartKg: first.trendKg, trendEndKg: last.trendKg, days: p.days.length }));
    const estimate = energyEstimateFor({ profile: profile.data, goal: goal.data, kg: weight.data?.kg ?? null, localDate: today, steps: null, workouts: [] });
    const tdeeEstimate = estimate?.tdee.tdee ?? observed;
    const desiredDeficit = tdeeEstimate - currentTarget;
    const suggestion = suggestTarget({ currentTarget, currentTdeeEstimate: tdeeEstimate, observedTdee: observed, desiredDeficit, window: { ...window, trendStartKg: first.trendKg, trendEndKg: last.trendKg, meanIntake } });
    return { gate, suggestion, observed, currentTarget };
  }, [progress.data, profile.data, goal.data, weight.data, today]);

  async function apply() {
    if (!result?.suggestion || !goal.data) return;
    setBusy(true);
    setError(null);
    try {
      const g = goal.data;
      const row = await addGoal.mutateAsync({
        effective_from: today,
        goal_type: g.goal_type,
        pace: g.pace,
        activity_mode: g.activity_mode,
        activity_level: g.activity_level,
        calorie_target: result.suggestion.proposedCalorieTarget,
        protein_g: g.protein_g,
        carbs_g: g.carbs_g,
        fat_g: g.fat_g,
        fibre_g: g.fibre_g,
        water_ml: g.water_ml,
        step_goal: g.step_goal,
        source: 'adaptive_accepted',
        rationale: `Observed TDEE ${result.observed} kcal over the last 30 days; target moved ${result.suggestion.change > 0 ? '+' : ''}${result.suggestion.change} kcal.`,
        inputs: g.inputs,
      });
      const { error: sErr } = await supabase.from('target_suggestions').insert({
        user_id: userId,
        proposed_calorie_target: result.suggestion.proposedCalorieTarget,
        proposed_protein_g: g.protein_g,
        observed_tdee: result.observed,
        evidence: result.suggestion.evidence as never,
        status: 'accepted',
        goal_version_id: row.id,
        resolved_at: new Date().toISOString(),
      });
      if (sErr) throw sErr;
      track('target_adapted', { change: result.suggestion.change });
      setApplied(result.suggestion.proposedCalorieTarget);
      toast(`Target is now ${result.suggestion.proposedCalorieTarget.toLocaleString()} kcal`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen testID="adaptive-screen">
      <PageHeader title="Target check" subtitle="Thirty days of your own logs and weigh-ins, compared against the formula. Suggested moves are capped at 150 kcal and never applied without your tap." backTo="/profile/targets" />
      {progress.isLoading || profile.isLoading || goal.isLoading ? (
        <SkeletonCard lines={3} />
      ) : !result ? (
        <Note>No goal is set yet. Set targets first, then come back after a few weeks of logging.</Note>
      ) : !result.gate.unlocked ? (
        <Card style={{ gap: space.sm }} testID="adaptive-locked">
          <Text variant="heading">Not enough data yet</Text>
          {result.gate.reasons.map((r) => (
            <Text key={r} color="textMuted">
              {r}
            </Text>
          ))}
          <Note>Mark days complete on Today when you have logged everything. Complete days are what the check relies on.</Note>
        </Card>
      ) : applied != null ? (
        <Card tone="inverse" style={{ gap: space.sm }} testID="adaptive-applied">
          <Text variant="heading" style={{ color: colors.onInverse }}>
            Target updated
          </Text>
          <Text style={{ color: colors.onInverse }}>{applied.toLocaleString()} kcal a day from today. Past days keep the target that was in force then.</Text>
          <Button label="Back to targets" variant="secondary" onPress={() => goBack('/profile/targets')} />
        </Card>
      ) : !result.suggestion ? (
        <Card style={{ gap: space.sm }} testID="adaptive-steady">
          <Text variant="heading">Your target is holding up</Text>
          <Text color="textMuted">Observed daily burn is about {result.observed?.toLocaleString()} kcal, close enough to the formula that no change is worth making. Check again in a couple of weeks.</Text>
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Stat label="Current target" value={`${result.currentTarget?.toLocaleString()} kcal`} style={{ flex: 1, minWidth: 0 }} />
            <Stat label="Observed burn" value={`${result.observed?.toLocaleString()} kcal`} note="from your logs" style={{ flex: 1, minWidth: 0 }} />
          </View>
          <Card tone="inverse" style={{ gap: space.sm }} testID="adaptive-suggestion">
            <Text variant="label" style={{ color: colors.onInverse, opacity: 0.6 }}>
              Suggested target
            </Text>
            <Text variant="display" tabular style={{ color: colors.onInverse, fontSize: 44, lineHeight: 50 }}>
              {result.suggestion.proposedCalorieTarget.toLocaleString()} kcal
            </Text>
            <Text style={{ color: colors.onInverse }}>
              {result.suggestion.change > 0 ? '+' : ''}
              {result.suggestion.change} kcal a day. {result.suggestion.uncertainty}
            </Text>
          </Card>
          {error ? (
            <Text color="danger" variant="small">
              {error}
            </Text>
          ) : null}
          <Button label="Apply this target" size="lg" onPress={() => void apply()} loading={busy} testID="adaptive-apply" />
          <Button label="Keep the current target" variant="ghost" onPress={() => goBack('/profile/targets')} />
        </>
      )}
    </Screen>
  );
}

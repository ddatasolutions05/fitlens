import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { todayLocal, workoutById, workoutEstimate } from '@fitlens/core';

import { useLatestWeight } from '@/features/profile/hooks';
import { useCompleteWorkout } from '@/features/workouts/hooks';
import { goBack } from '@/lib/nav';
import { errorMessage } from '@/lib/net';
import { reportError } from '@/lib/telemetry';
import { Button, Card, EmptyState, Icon, Note, NumberField, PageHeader, Screen, Text, space, useTheme } from '@/ui';

export default function WorkoutScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = workoutById(id ?? '');
  const weight = useLatestWeight();
  const complete = useCompleteWorkout();
  const [minutes, setMinutes] = useState<number | null>(workout?.minutes ?? null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!workout) {
    return (
      <Screen testID="workout-screen">
        <PageHeader title="Workout" backTo="/train" />
        <EmptyState title="Not found" body="This workout is not in the library." />
      </Screen>
    );
  }

  const kg = weight.data?.kg ?? null;
  const estimate = kg && minutes ? workoutEstimate({ type: workout.type, intensity: workout.intensity, minutes, kg }) : null;

  async function logDone() {
    if (!workout || !minutes || minutes <= 0 || minutes > 600) {
      setError('Enter a duration between 1 and 600 minutes.');
      return;
    }
    setError(null);
    try {
      await complete.complete({ workout, minutes, localDate: todayLocal() });
      setSaved(true);
    } catch (err) {
      reportError('workout.complete', err);
      setError(errorMessage(err));
    }
  }

  return (
    <Screen testID="workout-screen">
      <PageHeader title={workout.name} subtitle={`${workout.minutes} min. ${workout.summary}`} backTo="/train" />

      <Text variant="small" color="textMuted" testID="workout-facts">
        {workout.type === 'strength' ? 'Strength' : workout.type === 'yoga' ? 'Mobility' : 'Cardio'}, {workout.intensity} effort, {workout.level} level, {workout.equipment.map((e) => (e === 'bodyweight' ? 'no kit' : e)).join(' or ')}.
      </Text>

      <Card style={{ gap: 0 }} testID="exercise-list">
        <Text variant="label" color="textMuted" style={{ marginBottom: space.sm }}>
          Exercises
        </Text>
        {workout.exercises.map((e, i) => (
          <View key={e.name} style={[styles.exercise, { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{e.name}</Text>
              <Text variant="small" color="textMuted">
                {e.sets > 1 ? `${e.sets} sets of ${e.dose}` : e.dose}
                {e.restSec > 0 ? `, rest ${e.restSec} s` : ''}
              </Text>
              {e.cue ? (
                <Text variant="caption" color="textFaint">
                  {e.cue}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </Card>

      <Note>Warm up for five minutes first. Stop a set two reps before form breaks down; the last rep should still look like the first.</Note>

      {saved ? (
        <Card tone="inverse" style={{ gap: space.sm }} testID="workout-saved">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name="check" color={colors.onInverse} />
            <Text variant="heading" style={{ color: colors.onInverse }}>
              Logged
            </Text>
          </View>
          <Text style={{ color: colors.onInverse }}>
            {minutes} minutes of {workout.name.toLowerCase()}
            {estimate ? `, about ${estimate.kcal} kcal above resting` : ''}. It counts toward today&apos;s activity.
          </Text>
          <Button label="Back to Train" variant="secondary" onPress={() => goBack('/train')} testID="workout-back" />
        </Card>
      ) : (
        <Card style={{ gap: space.md }}>
          <Text variant="heading">Done with it?</Text>
          <NumberField label="Minutes" value={minutes} onChangeNumber={setMinutes} decimals={0} testID="workout-minutes" hint={estimate ? `About ${estimate.kcal} kcal above resting at your last weight.` : 'Log a weight for a calorie estimate.'} />
          {error ? (
            <Text color="danger" variant="small">
              {error}
            </Text>
          ) : null}
          <Button label="Log as done" onPress={() => void logDone()} loading={complete.isPending} testID="workout-done" />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  exercise: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
});

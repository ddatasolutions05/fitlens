import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { WORKOUT_TYPES, deviceTimeZone, localDateTimeToIso, todayLocal, workoutEstimate, type Intensity, type WorkoutType } from '@fitlens/core';

import { useLogSteps, useLogWorkout } from '@/features/logs/hooks';
import { newIdempotencyKey } from '@/features/meals/model';
import { errorMessage } from '@/lib/net';
import { useLatestWeight } from '@/features/profile/hooks';
import { Button, Card, Input, NumberField, Screen, Segmented, Text, space } from '@/ui';

type Kind = 'steps' | 'workout';

export default function LogActivity() {
  const params = useLocalSearchParams<{ date?: string }>();
  const tz = deviceTimeZone();
  const localDate = params.date ?? todayLocal(tz);
  const isToday = localDate === todayLocal(tz);
  const latest = useLatestWeight();
  const logSteps = useLogSteps();
  const logWorkout = useLogWorkout();
  const kg = latest.data ? Number(latest.data.kg) : null;

  const [kind, setKind] = useState<Kind>('steps');
  const [steps, setSteps] = useState<number | null>(null);
  const [type, setType] = useState<WorkoutType>('walking');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [minutes, setMinutes] = useState<number | null>(30);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const estimate = kind === 'workout' && minutes && kg ? workoutEstimate({ type, intensity, minutes, kg }) : null;
  const startAt = isToday ? new Date().toISOString() : localDateTimeToIso(localDate, '12:00', tz);

  async function save() {
    setError(null);
    try {
    if (kind === 'steps') {
      if (steps == null || steps < 0 || steps > 100000) {
        setError('Enter steps between 0 and 100,000.');
        return;
      }
      await logSteps.mutateAsync({ id: newIdempotencyKey(), steps: Math.round(steps), localDate, tz, startAt, kg });
    } else {
      if (minutes == null || minutes <= 0 || minutes > 600) {
        setError('Enter a duration between 1 and 600 minutes.');
        return;
      }
      await logWorkout.mutateAsync({ id: newIdempotencyKey(), type, intensity, minutes, localDate, tz, startAt, kg, note: note.trim() || null });
    }
    router.back();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen testID="log-activity">
      <View style={{ marginTop: space.lg, gap: space.xs }}>
        <Text variant="title">Add activity</Text>
        <Text color="textMuted">{localDate}</Text>
      </View>
      <Card style={{ gap: space.lg }}>
        <Segmented<Kind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'steps', label: 'Steps' },
            { value: 'workout', label: 'Workout' },
          ]}
        />
        {kind === 'steps' ? (
          <NumberField label="Steps for the day" value={steps} onChangeNumber={setSteps} decimals={0} placeholder="8000" autoFocus testID="steps-input" hint="Replaces nothing: each entry adds to the day. Delete entries in the Diary." />
        ) : (
          <>
            <Segmented<WorkoutType> label="Type" wrap value={type} onChange={setType} options={WORKOUT_TYPES.map((t) => ({ value: t.key, label: t.label }))} />
            <Segmented<Intensity>
              label="Intensity"
              value={intensity}
              onChange={setIntensity}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'vigorous', label: 'Vigorous' },
              ]}
            />
            <NumberField label="Duration (minutes)" value={minutes} onChangeNumber={setMinutes} decimals={0} testID="minutes-input" />
            <Input label="Note (optional)" value={note} onChangeText={setNote} />
            <Text variant="small" color="textMuted">
              {estimate
                ? `About ${Math.round(estimate.kcal)} kcal (estimate, MET ${estimate.met}). Shown for information; it is not added to your food target in activity-level mode.`
                : kg == null
                  ? 'Log a weight to see a calorie estimate for workouts.'
                  : 'Enter a duration to see an estimate.'}
            </Text>
          </>
        )}
        {error ? (
          <Text color="danger" variant="small">
            {error}
          </Text>
        ) : null}
        <Button label="Save" size="lg" onPress={() => void save()} loading={logSteps.isPending || logWorkout.isPending} testID="save-activity" />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { WORKOUT_TYPES, deviceTimeZone, formatLocalDate, localDateTimeToIso, todayLocal, workoutEstimate, type Intensity, type WorkoutType } from '@fitlens/core';

import { useLogSteps, useLogWorkout } from '@/features/logs/hooks';
import { newIdempotencyKey } from '@/features/meals/model';
import { useLatestWeight } from '@/features/profile/hooks';
import { supabase } from '@/lib/supabase';
import { goBack } from '@/lib/nav';
import { errorMessage } from '@/lib/net';
import { Button, Input, Note, NumberField, PageHeader, Screen, Segmented, SkeletonCard, Text, space, toast } from '@/ui';

type Kind = 'steps' | 'workout';

type ActivityRow = { id: string; kind: string; steps: number | null; workout_type: string | null; intensity: string | null; duration_min: number | null; note: string | null };

function ActivityForm({ editId, initial }: { editId: string | null; initial: ActivityRow | null }) {
  const params = useLocalSearchParams<{ date?: string; edit?: string }>();
  const tz = deviceTimeZone();
  const localDate = params.date ?? todayLocal(tz);
  const isToday = localDate === todayLocal(tz);
  const latest = useLatestWeight();
  const logSteps = useLogSteps();
  const logWorkout = useLogWorkout();
  const kg = latest.data ? Number(latest.data.kg) : null;

  const [kind, setKind] = useState<Kind>((initial?.kind as Kind | undefined) ?? 'steps');
  const [steps, setSteps] = useState<number | null>(initial?.kind === 'steps' ? (initial.steps ?? null) : null);
  const [type, setType] = useState<WorkoutType>(((initial?.kind === 'workout' && initial.workout_type) || 'walking') as WorkoutType);
  const [intensity, setIntensity] = useState<Intensity>(((initial?.kind === 'workout' && initial.intensity) || 'moderate') as Intensity);
  const [minutes, setMinutes] = useState<number | null>(initial?.kind === 'workout' && initial.duration_min != null ? Number(initial.duration_min) : 30);
  const [note, setNote] = useState(initial?.note ?? '');
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
        await logSteps.mutateAsync({ id: editId ?? newIdempotencyKey(), steps: Math.round(steps), localDate, tz, startAt, kg });
      } else {
        if (minutes == null || minutes <= 0 || minutes > 600) {
          setError('Enter a duration between 1 and 600 minutes.');
          return;
        }
        await logWorkout.mutateAsync({ id: editId ?? newIdempotencyKey(), type, intensity, minutes, localDate, tz, startAt, kg, note: note.trim() || null });
      }
      toast(editId ? 'Entry updated' : kind === 'steps' ? 'Steps saved' : 'Workout saved');
      goBack('/today');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen testID="log-activity">
      <PageHeader title={editId ? 'Edit activity' : 'Add activity'} subtitle={formatLocalDate(localDate, 'relative')} backTo="/today" />
      <Segmented<Kind>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'steps', label: 'Steps' },
          { value: 'workout', label: 'Workout' },
        ]}
      />
      {kind === 'steps' ? (
        <View style={{ gap: space.lg }}>
          <NumberField label="Steps for the day" value={steps} onChangeNumber={setSteps} decimals={0} placeholder="8000" autoFocus testID="steps-input" style={{ fontSize: 28, fontFamily: 'Lato_900Black' }} />
          <Note>Each entry adds to the day. Remove entries from the Diary.</Note>
        </View>
      ) : (
        <View style={{ gap: space.lg }}>
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
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <NumberField label="Minutes" value={minutes} onChangeNumber={setMinutes} decimals={0} testID="minutes-input" />
            </View>
            <View style={{ flex: 2 }}>
              <Input label="Note (optional)" value={note} onChangeText={setNote} />
            </View>
          </View>
          <Note>
            {estimate
              ? `About ${Math.round(estimate.kcal)} kcal (estimate, MET ${estimate.met}). Shown for information; it is not added to your food target in activity-level mode.`
              : kg == null
                ? 'Log a weight to see a calorie estimate for workouts.'
                : 'Enter a duration to see an estimate.'}
          </Note>
        </View>
      )}
      {error ? (
        <Text color="danger" variant="small">
          {error}
        </Text>
      ) : null}
      <Button label="Save" size="lg" onPress={() => void save()} loading={logSteps.isPending || logWorkout.isPending} testID="save-activity" />
      <Button label="Cancel" variant="ghost" onPress={() => goBack('/today')} />
    </Screen>
  );
}

export default function LogActivity() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const editId = params.edit ?? null;
  const existing = useQuery({
    queryKey: ['activity-entry', editId],
    enabled: Boolean(editId),
    queryFn: async () => {
      const { data, error } = await supabase.from('activity_records').select('id, kind, steps, workout_type, intensity, duration_min, note').eq('id', editId as string).single();
      if (error) throw error;
      return data as ActivityRow;
    },
  });
  if (editId && !existing.data) {
    return (
      <Screen testID="log-activity">
        <SkeletonCard lines={3} />
      </Screen>
    );
  }
  return <ActivityForm key={editId ?? 'new'} editId={editId} initial={existing.data ?? null} />;
}

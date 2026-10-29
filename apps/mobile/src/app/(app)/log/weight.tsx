import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { deviceTimeZone, formatLocalDate, kgToLb, lbToKg, localDateTimeToIso, timeInZone, todayLocal, type UnitSystem } from '@fitlens/core';

import { useLogWeight } from '@/features/logs/hooks';
import { newIdempotencyKey } from '@/features/meals/model';
import { useLatestWeight, useProfile } from '@/features/profile/hooks';
import { supabase } from '@/lib/supabase';
import { goBack } from '@/lib/nav';
import { errorMessage } from '@/lib/net';
import { Button, Input, Note, NumberField, PageHeader, Screen, SkeletonCard, Stat, Text, TimeField, space, toast } from '@/ui';

type WeightRow = { id: string; kg: number; measured_at: string; tz: string; note: string | null };

function WeightForm({ editId, initial, unitSystem }: { editId: string | null; initial: WeightRow | null; unitSystem: UnitSystem }) {
  const params = useLocalSearchParams<{ date?: string; edit?: string }>();
  const tz = deviceTimeZone();
  const localDate = params.date ?? todayLocal(tz);
  const latest = useLatestWeight();
  const log = useLogWeight();
  const unit = unitSystem === 'imperial' ? 'lb' : 'kg';
  const isToday = localDate === todayLocal(tz);
  const [value, setValue] = useState<number | null>(initial ? (unitSystem === 'imperial' ? Math.round(kgToLb(Number(initial.kg)) * 10) / 10 : Number(initial.kg)) : null);
  const [time, setTime] = useState(initial ? timeInZone(initial.measured_at, initial.tz) : isToday ? timeInZone(new Date().toISOString(), tz) : '08:00');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const kg = value == null ? null : unitSystem === 'imperial' ? lbToKg(value) : value;
  const lastValue = latest.data ? (unitSystem === 'imperial' ? kgToLb(Number(latest.data.kg)).toFixed(1) : Number(latest.data.kg).toFixed(1)) : null;
  const delta = value != null && lastValue != null ? value - Number(lastValue) : null;

  async function save() {
    if (kg == null || kg <= 20 || kg >= 400) {
      setError('Enter a weight between 20 and 400 kg.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setError('Time must be HH:MM.');
      return;
    }
    setError(null);
    try {
      await log.mutateAsync({
        id: editId ?? newIdempotencyKey(),
        kg: Math.round(kg * 100) / 100,
        measuredAt: !editId && isToday && time === timeInZone(new Date().toISOString(), tz) ? new Date().toISOString() : localDateTimeToIso(localDate, time, tz),
        localDate,
        tz,
        note: note.trim() || null,
      });
      toast(editId ? 'Weigh-in updated' : 'Weight saved');
      goBack('/today');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen testID="log-weight">
      <PageHeader title={editId ? 'Edit weigh-in' : 'Log weight'} subtitle={formatLocalDate(localDate, 'relative')} backTo="/today" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat label="Last weigh-in" value={lastValue ? `${lastValue} ${unit}` : 'None yet'} note={latest.data ? formatLocalDate(latest.data.local_date, 'short') : 'This will be the first'} style={{ minWidth: 0 }} />
        <Stat label="Change" value={delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${unit}` : 'Pending'} note={delta != null ? 'Against the last weigh-in' : 'Enter a weight to compare'} style={{ minWidth: 0 }} />
      </View>
      <NumberField label={`Weight (${unit})`} value={value} onChangeNumber={setValue} placeholder={lastValue ?? '70.0'} autoFocus testID="weight-input" style={{ fontSize: 28, fontFamily: 'Lato_900Black' }} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <TimeField label="Time" value={time} onChange={setTime} testID="weight-time" />
        </View>
        <View style={{ flex: 2 }}>
          <Input label="Note (optional)" value={note} onChangeText={setNote} placeholder="after breakfast, travelling" />
        </View>
      </View>
      {error ? (
        <Text color="danger" variant="small">
          {error}
        </Text>
      ) : null}
      <Button label={editId ? 'Save changes' : 'Save weight'} size="lg" onPress={() => void save()} loading={log.isPending} disabled={value == null} testID="save-weight" />
      <Button label="Cancel" variant="ghost" onPress={() => goBack('/today')} />
      <Note>Daily swings are mostly water and food in transit, not fat. The trend line on Stats smooths them out, so weigh at the same time of day when you can.</Note>
    </Screen>
  );
}

export default function LogWeight() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const editId = params.edit ?? null;
  const profile = useProfile();
  const unitSystem = (profile.data?.unit_system ?? 'metric') as UnitSystem;
  const existing = useQuery({
    queryKey: ['weight-entry', editId],
    enabled: Boolean(editId),
    queryFn: async () => {
      const { data, error } = await supabase.from('weight_logs').select('id, kg, measured_at, tz, note').eq('id', editId as string).single();
      if (error) throw error;
      return data as WeightRow;
    },
  });
  if (profile.isLoading || (editId && !existing.data)) {
    return (
      <Screen testID="log-weight">
        <SkeletonCard lines={3} />
      </Screen>
    );
  }
  // Keyed so a different entry (or a new one) mounts a fresh form with its own initial values.
  return <WeightForm key={editId ?? 'new'} editId={editId} initial={existing.data ?? null} unitSystem={unitSystem} />;
}

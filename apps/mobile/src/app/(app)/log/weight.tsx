import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { deviceTimeZone, kgToLb, lbToKg, localDateTimeToIso, timeInZone, todayLocal, type UnitSystem } from '@fitlens/core';

import { useLogWeight } from '@/features/logs/hooks';
import { useLatestWeight, useProfile } from '@/features/profile/hooks';
import { newIdempotencyKey } from '@/features/meals/model';
import { errorMessage } from '@/lib/net';
import { Button, Card, Input, NumberField, Screen, Text, space } from '@/ui';

export default function LogWeight() {
  const params = useLocalSearchParams<{ date?: string }>();
  const tz = deviceTimeZone();
  const localDate = params.date ?? todayLocal(tz);
  const profile = useProfile();
  const latest = useLatestWeight();
  const log = useLogWeight();
  const unitSystem = (profile.data?.unit_system ?? 'metric') as UnitSystem;
  const isToday = localDate === todayLocal(tz);
  const [value, setValue] = useState<number | null>(null);
  const [time, setTime] = useState(isToday ? timeInZone(new Date().toISOString(), tz) : '08:00');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const kg = value == null ? null : unitSystem === 'imperial' ? lbToKg(value) : value;
  const lastText = latest.data ? (unitSystem === 'imperial' ? `${kgToLb(Number(latest.data.kg)).toFixed(1)} lb` : `${Number(latest.data.kg).toFixed(1)} kg`) : null;

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
      id: newIdempotencyKey(),
      kg: Math.round(kg * 100) / 100,
      measuredAt: isToday && time === timeInZone(new Date().toISOString(), tz) ? new Date().toISOString() : localDateTimeToIso(localDate, time, tz),
      localDate,
      tz,
      note: note.trim() || null,
    });
    router.back();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen testID="log-weight">
      <View style={{ marginTop: space.lg, gap: space.xs }}>
        <Text variant="title">Log weight</Text>
        <Text color="textMuted">
          {localDate} · {lastText ? `last ${lastText}` : 'no previous weight'}
        </Text>
      </View>
      <Card style={{ gap: space.lg }}>
        <NumberField
          label={`Weight (${unitSystem === 'imperial' ? 'lb' : 'kg'})`}
          value={value}
          onChangeNumber={setValue}
          placeholder={latest.data ? String(unitSystem === 'imperial' ? kgToLb(Number(latest.data.kg)).toFixed(1) : Number(latest.data.kg).toFixed(1)) : '70.0'}
          autoFocus
          testID="weight-input"
        />
        <Input label="Time" value={time} onChangeText={setTime} placeholder="07:30" hint="24-hour clock, in your current time zone" />
        <Input label="Note (optional)" value={note} onChangeText={setNote} placeholder="after breakfast, travelling…" />
        {error ? (
          <Text color="danger" variant="small">
            {error}
          </Text>
        ) : null}
        <Button label="Save weight" size="lg" onPress={() => void save()} loading={log.isPending} disabled={value == null} testID="save-weight" />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </Card>
      <Text variant="caption" color="textFaint">
        Daily swings are mostly water and food in transit, not fat. The trend line on Progress smooths them out.
      </Text>
    </Screen>
  );
}

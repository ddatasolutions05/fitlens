import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { deviceTimeZone, localDateTimeToIso, todayLocal } from '@fitlens/core';

import { useLogWater } from '@/features/logs/hooks';
import { newIdempotencyKey } from '@/features/meals/model';
import { errorMessage } from '@/lib/net';
import { Button, Card, NumberField, Screen, Text, space } from '@/ui';

export default function LogWater() {
  const params = useLocalSearchParams<{ date?: string }>();
  const tz = deviceTimeZone();
  const localDate = params.date ?? todayLocal(tz);
  const isToday = localDate === todayLocal(tz);
  const log = useLogWater();
  const [custom, setCustom] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(ml: number) {
    setError(null);
    try {
    await log.mutateAsync({
      id: newIdempotencyKey(),
      ml: Math.round(ml),
      loggedAt: isToday ? new Date().toISOString() : localDateTimeToIso(localDate, '12:00', tz),
      localDate,
      tz,
    });
    router.back();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen testID="log-water">
      <View style={{ marginTop: space.lg, gap: space.xs }}>
        <Text variant="title">Add water</Text>
        <Text color="textMuted">{localDate}</Text>
      </View>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="250 ml" style={{ flex: 1 }} onPress={() => void add(250)} loading={log.isPending} testID="water-250" />
          <Button label="500 ml" style={{ flex: 1 }} onPress={() => void add(500)} loading={log.isPending} testID="water-500" />
        </View>
        <NumberField label="Custom amount (ml)" value={custom} onChangeNumber={setCustom} decimals={0} placeholder="330" testID="water-custom" />
        {error ? (
          <Text color="danger" variant="small">
            {error}
          </Text>
        ) : null}
        <Button label="Add custom" variant="secondary" disabled={!custom || custom <= 0 || custom > 5000} onPress={() => custom && void add(custom)} loading={log.isPending} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

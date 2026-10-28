import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { deviceTimeZone, formatLocalDate, localDateTimeToIso, todayLocal } from '@fitlens/core';

import { useDay } from '@/features/day/hooks';
import { useLogWater } from '@/features/logs/hooks';
import { newIdempotencyKey } from '@/features/meals/model';
import { goBack } from '@/lib/nav';
import { errorMessage } from '@/lib/net';
import { Bar, Button, Icon, NumberField, PageHeader, Screen, Text, radius, space, toast, useTheme } from '@/ui';

const QUICK = [250, 500, 750];

export default function LogWater() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const tz = deviceTimeZone();
  const localDate = params.date ?? todayLocal(tz);
  const isToday = localDate === todayLocal(tz);
  const day = useDay(localDate);
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
      toast(`${Math.round(ml)} ml of water added`);
      goBack('/today');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen testID="log-water">
      <PageHeader title="Add water" subtitle={formatLocalDate(localDate, 'relative')} backTo="/today" />
      {day.data ? <Bar label="So far today" value={day.data.waterMl} target={day.data.goal?.water_ml ?? null} unit=" ml" color={colors.water} /> : null}
      <View style={styles.row}>
        {QUICK.map((ml) => (
          <Pressable
            key={ml}
            accessibilityRole="button"
            accessibilityLabel={`Add ${ml} millilitres`}
            onPress={() => void add(ml)}
            disabled={log.isPending}
            testID={`water-${ml}`}
            style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed || log.isPending ? 0.7 : 1 }]}
          >
            <Icon name="water" size={22} />
            <Text variant="heading" tabular>
              {ml}
            </Text>
            <Text variant="caption" color="textMuted">
              ml
            </Text>
          </Pressable>
        ))}
      </View>
      <NumberField label="Custom amount (ml)" value={custom} onChangeNumber={setCustom} decimals={0} placeholder="330" testID="water-custom" />
      {error ? (
        <Text color="danger" variant="small">
          {error}
        </Text>
      ) : null}
      <Button label="Add custom amount" size="lg" disabled={!custom || custom <= 0 || custom > 5000} onPress={() => custom && void add(custom)} loading={log.isPending} />
      <Button label="Cancel" variant="ghost" onPress={() => goBack('/today')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minHeight: 96, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
});

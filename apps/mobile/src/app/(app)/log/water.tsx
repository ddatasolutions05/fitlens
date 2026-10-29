import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WATER_QUICK_ML, deviceTimeZone, flOzToMl, formatLocalDate, formatWater, localDateTimeToIso, todayLocal, waterUnit, waterValue, type UnitSystem } from '@fitlens/core';

import { useDay } from '@/features/day/hooks';
import { useLogWater } from '@/features/logs/hooks';
import { useProfile } from '@/features/profile/hooks';
import { newIdempotencyKey } from '@/features/meals/model';
import { goBack } from '@/lib/nav';
import { errorMessage } from '@/lib/net';
import { Bar, Button, Icon, NumberField, PageHeader, Screen, Text, radius, space, toast, useTheme } from '@/ui';

export default function LogWater() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const tz = deviceTimeZone();
  const localDate = params.date ?? todayLocal(tz);
  const isToday = localDate === todayLocal(tz);
  const day = useDay(localDate);
  const profile = useProfile();
  const unitSystem = (profile.data?.unit_system ?? 'metric') as UnitSystem;
  const unit = waterUnit(unitSystem);
  const quick = WATER_QUICK_ML[unitSystem];
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
      toast(`${formatWater(ml, unitSystem)} of water added`);
      goBack('/today');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen testID="log-water">
      <PageHeader title="Add water" subtitle={formatLocalDate(localDate, 'relative')} backTo="/today" />
      {day.data ? <Bar label="So far today" value={waterValue(day.data.waterMl, unitSystem)} target={waterValue(day.data.goal?.water_ml ?? null, unitSystem)} unit={` ${unit}`} color={colors.water} /> : null}
      <View style={styles.row}>
        {quick.map((ml) => (
          <Pressable
            key={ml}
            accessibilityRole="button"
            accessibilityLabel={`Add ${formatWater(ml, unitSystem)}`}
            onPress={() => void add(ml)}
            disabled={log.isPending}
            testID={`water-${ml}`}
            style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed || log.isPending ? 0.7 : 1 }]}
          >
            <Icon name="water" size={22} />
            <Text variant="heading" tabular>
              {waterValue(ml, unitSystem)}
            </Text>
            <Text variant="caption" color="textMuted">
              {unit}
            </Text>
          </Pressable>
        ))}
      </View>
      <NumberField label={`Custom amount (${unit})`} value={custom} onChangeNumber={setCustom} decimals={0} placeholder={unitSystem === 'imperial' ? '12' : '330'} testID="water-custom" />
      {error ? (
        <Text color="danger" variant="small">
          {error}
        </Text>
      ) : null}
      <Button label="Add custom amount" size="lg" disabled={!custom || custom <= 0 || (unitSystem === 'imperial' ? flOzToMl(custom) : custom) > 5000} onPress={() => custom && void add(unitSystem === 'imperial' ? flOzToMl(custom) : custom)} loading={log.isPending} />
      <Button label="Cancel" variant="ghost" onPress={() => goBack('/today')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minHeight: 96, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
});

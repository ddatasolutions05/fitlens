import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { formatLocalDate, type UnitSystem } from '@fitlens/core';

import { ChartFrame, LineChart } from '@/features/progress/charts';
import { Button, Card, Text, radius, space, useTheme } from '@/ui';

import { useDeleteMeasurement, useMeasurements, usePhotoUrls } from './hooks';

const CM_PER_IN = 2.54;

/** Waist trend and the private photo strip on Stats. */
export function BodyCard({ unitSystem }: { unitSystem: UnitSystem }) {
  const { colors } = useTheme();
  const rows = useMeasurements(60);
  const del = useDeleteMeasurement();
  const paths = (rows.data ?? []).filter((r) => r.photo_path).map((r) => r.photo_path as string);
  const urls = usePhotoUrls(paths);
  const unit = unitSystem === 'imperial' ? 'in' : 'cm';
  const toUnit = (cm: number) => (unitSystem === 'imperial' ? Math.round((cm / CM_PER_IN) * 10) / 10 : cm);
  const waist = [...(rows.data ?? [])].reverse().filter((r) => r.waist_cm != null);
  const first = waist[0]?.waist_cm ?? null;
  const last = waist[waist.length - 1]?.waist_cm ?? null;
  const delta = first != null && last != null && waist.length > 1 ? toUnit(last) - toUnit(first) : null;

  return (
    <Card style={{ gap: space.md }} testID="body-card">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="bodyStrong">Body</Text>
        <Button label="Measure" variant="secondary" size="sm" onPress={() => router.push('/log/measure')} testID="body-measure" />
      </View>
      {waist.length >= 2 ? (
        <ChartFrame title="Waist" unit={unit} summary={delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${unit} since ${formatLocalDate(waist[0]!.local_date, 'short')}` : undefined}>
          <LineChart data={waist.map((r) => ({ label: formatLocalDate(r.local_date, 'short'), value: toUnit(r.waist_cm as number) }))} color={colors.text} />
        </ChartFrame>
      ) : (
        <Text variant="small" color="textMuted">
          {waist.length === 1 ? `Waist ${toUnit(waist[0]!.waist_cm as number)} ${unit} on ${formatLocalDate(waist[0]!.local_date, 'short')}. One more and the trend shows.` : 'A tape measurement once a month shows fat change the scale hides. Photos are private to you.'}
        </Text>
      )}
      {paths.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} testID="body-photos">
          {(rows.data ?? [])
            .filter((r) => r.photo_path)
            .map((r) => (
              <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Photo from ${formatLocalDate(r.local_date, 'long')}. Hold to delete.`} onLongPress={() => del.mutate({ id: r.id, photo_path: r.photo_path })} style={styles.thumbWrap}>
                {urls.data?.[r.photo_path as string] ? <Image source={{ uri: urls.data[r.photo_path as string] }} style={[styles.thumb, { backgroundColor: colors.surface }]} resizeMode="cover" /> : <View style={[styles.thumb, { backgroundColor: colors.surface }]} />}
                <Text variant="caption" color="textMuted">
                  {formatLocalDate(r.local_date, 'short')}
                </Text>
              </Pressable>
            ))}
        </ScrollView>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  thumbWrap: { gap: 4, alignItems: 'center' },
  thumb: { width: 96, height: 128, borderRadius: radius.md },
});

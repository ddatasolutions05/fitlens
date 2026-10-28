import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { addDays, formatLocalDate, rangeStats, todayLocal, weeklyReview, type UnitSystem } from '@fitlens/core';

import { useProfile } from '@/features/profile/hooks';
import { useProgress } from '@/features/progress/hooks';
import { Button, Card, ErrorState, Icon, Note, PageHeader, Screen, SkeletonCard, Stat, Text, space, useTheme } from '@/ui';

export default function ReviewScreen() {
  const { colors } = useTheme();
  const profile = useProfile();
  const progress = useProgress(30);
  const today = todayLocal();
  const hideNumbers = profile.data?.hide_numbers ?? false;
  const trackingOnly = profile.data?.mode === 'tracking_only';
  const unitSystem = (profile.data?.unit_system ?? 'metric') as UnitSystem;

  const review = useMemo(() => {
    if (!progress.data) return null;
    const weekStart = addDays(today, -6);
    const lastStart = addDays(today, -13);
    const thisDays = progress.data.days.filter((d) => d.localDate >= weekStart);
    const lastDays = progress.data.days.filter((d) => d.localDate >= lastStart && d.localDate < weekStart);
    const thisWeights = progress.data.weights.filter((w) => w.localDate >= weekStart);
    const lastWeights = progress.data.weights.filter((w) => w.localDate >= lastStart && w.localDate < weekStart);
    const thisWeek = rangeStats(thisDays, thisWeights);
    const lastWeek = lastDays.length ? rangeStats(lastDays, lastWeights) : null;
    return { thisWeek, lastWeek, text: weeklyReview({ thisWeek, lastWeek, hideNumbers, trackingOnly }) };
  }, [progress.data, today, hideNumbers, trackingOnly]);

  return (
    <Screen testID="review-screen">
      <PageHeader title="Your week" subtitle={`${formatLocalDate(addDays(today, -6))} to ${formatLocalDate(today)}. Days lie, weeks tell the truth.`} backTo="/home" />
      {progress.isLoading || !review ? (
        progress.isError ? <ErrorState message={(progress.error as Error).message} onRetry={() => progress.refetch()} /> : <SkeletonCard lines={4} />
      ) : (
        <>
          <Card tone="inverse" style={{ gap: space.md }} testID="review-plate">
            <Text variant="label" style={{ color: colors.onInverse, opacity: 0.6 }}>
              In short
            </Text>
            <Text variant="heading" style={{ color: colors.onInverse, fontSize: 24, lineHeight: 31 }}>
              {review.text.headline}
            </Text>
            {review.text.comparison ? (
              <Text variant="small" style={{ color: colors.onInverse }}>
                {review.text.comparison}
              </Text>
            ) : null}
          </Card>

          <View style={styles.grid}>
            <Stat label="Days logged" value={`${review.thisWeek.loggedDays} of 7`} style={styles.tile} />
            <Stat label="Trained" value={review.thisWeek.workoutDays ? `${review.thisWeek.workoutDays} day${review.thisWeek.workoutDays === 1 ? '' : 's'}` : 'Not yet'} note={review.thisWeek.workoutMinutes ? `${review.thisWeek.workoutMinutes} min` : undefined} style={styles.tile} />
            <Stat label="Protein days" value={review.thisWeek.proteinEligible ? `${review.thisWeek.proteinHitDays} of ${review.thisWeek.proteinEligible}` : 'No target'} style={styles.tile} />
            <Stat
              label="Weight"
              value={review.thisWeek.weightChangeKg != null && !hideNumbers ? `${review.thisWeek.weightChangeKg > 0 ? '+' : ''}${(unitSystem === 'imperial' ? review.thisWeek.weightChangeKg * 2.20462 : review.thisWeek.weightChangeKg).toFixed(1)} ${unitSystem === 'imperial' ? 'lb' : 'kg'}` : hideNumbers ? 'Hidden' : 'No weigh-ins'}
              note="trend over the week"
              style={styles.tile}
            />
          </View>

          <Card style={{ gap: space.sm }} testID="review-wins">
            <Text variant="label" color="textMuted">
              What went well
            </Text>
            {review.text.wins.length === 0 ? (
              <Text color="textMuted">Nothing to call out yet. The first logged week sets the baseline.</Text>
            ) : (
              review.text.wins.map((w) => (
                <View key={w} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
                  <Icon name="check" size={18} />
                  <Text style={{ flex: 1 }}>{w}</Text>
                </View>
              ))
            )}
          </Card>

          {review.text.change ? (
            <Note label="One thing for next week">{review.text.change}</Note>
          ) : (
            <Note label="Next week">Nothing to change. Keep the same shape and let the trend do the talking.</Note>
          )}

          <Button label="See the full stats" variant="secondary" onPress={() => router.push('/progress')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1, minWidth: 0 },
});

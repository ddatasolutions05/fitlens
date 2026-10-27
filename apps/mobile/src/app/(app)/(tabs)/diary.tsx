import { router } from 'expo-router';
import { View } from 'react-native';
import { formatWeight, timeInZone, type UnitSystem } from '@fitlens/core';

import { DateSwitcher, MealTimeline } from '@/features/day/components';
import { useDay } from '@/features/day/hooks';
import { useSelectedDate } from '@/features/day/selected-date';
import { useDeleteActivity, useDeleteWater, useDeleteWeight } from '@/features/logs/hooks';
import { useLogsForDate } from '@/features/logs/queries';
import { useProfile } from '@/features/profile/hooks';
import { Button, Card, ErrorState, Row, Screen, SkeletonCard, Text, space } from '@/ui';

export default function DiaryScreen() {
  const [localDate, setLocalDate] = useSelectedDate();
  const day = useDay(localDate);
  const logs = useLogsForDate(localDate);
  const profile = useProfile();
  const deleteWeight = useDeleteWeight();
  const deleteWater = useDeleteWater();
  const deleteActivity = useDeleteActivity();
  const unitSystem = (profile.data?.unit_system ?? 'metric') as UnitSystem;
  const hideNumbers = profile.data?.hide_numbers ?? false;

  return (
    <Screen testID="diary-screen">
      <DateSwitcher localDate={localDate} onChange={setLocalDate} />
      {day.isLoading || logs.isLoading ? (
        <SkeletonCard lines={4} />
      ) : day.isError ? (
        <ErrorState message={(day.error as Error).message} onRetry={() => day.refetch()} />
      ) : logs.isError ? (
        <ErrorState message={(logs.error as Error).message} onRetry={() => logs.refetch()} />
      ) : (
        <>
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="heading">Meals</Text>
              <Button label="Add food" size="sm" variant="secondary" onPress={() => router.push({ pathname: '/food/search', params: { date: localDate, fresh: '1' } })} />
            </View>
            <MealTimeline meals={day.data?.meals ?? []} drafts={day.data?.drafts ?? []} hideNumbers={hideNumbers} />
          </View>

          <Card style={{ gap: space.xs }}>
            <Text variant="heading">Weight</Text>
            {logs.data?.weights.length ? (
              logs.data.weights.map((w) => (
                <Row
                  key={w.id}
                  title={formatWeight(Number(w.kg), unitSystem)}
                  subtitle={`${timeInZone(w.measured_at, w.tz)}${w.note ? ` · ${w.note}` : ''}`}
                  right={<Button label="Delete" size="sm" variant="ghost" onPress={() => deleteWeight.mutate({ id: w.id })} />}
                />
              ))
            ) : (
              <Text color="textMuted">Not logged</Text>
            )}
            <Button label="Log weight" variant="secondary" size="sm" onPress={() => router.push({ pathname: '/log/weight', params: { date: localDate } })} />
          </Card>

          <Card style={{ gap: space.xs }}>
            <Text variant="heading">Activity</Text>
            {logs.data?.activity.length ? (
              logs.data.activity.map((a) => (
                <Row
                  key={a.id}
                  title={a.kind === 'steps' ? `${Number(a.steps).toLocaleString()} steps` : `${capitalize(a.workout_type ?? 'workout')}, ${Math.round(Number(a.duration_min))} min`}
                  subtitle={
                    a.kind === 'workout'
                      ? `${a.intensity ?? ''}${a.kcal_estimate != null ? ` · about ${Math.round(Number(a.kcal_estimate))} kcal (estimate)` : ''}`
                      : `${a.source === 'manual' ? 'Entered by you' : a.source}`
                  }
                  right={<Button label="Delete" size="sm" variant="ghost" onPress={() => deleteActivity.mutate({ id: a.id })} />}
                />
              ))
            ) : (
              <Text color="textMuted">Not logged</Text>
            )}
            <Button label="Add activity" variant="secondary" size="sm" onPress={() => router.push({ pathname: '/log/activity', params: { date: localDate } })} />
          </Card>

          <Card style={{ gap: space.xs }}>
            <Text variant="heading">Water</Text>
            {logs.data?.water.length ? (
              logs.data.water.map((w) => (
                <Row
                  key={w.id}
                  title={`${w.ml} ml`}
                  subtitle={timeInZone(w.logged_at, w.tz)}
                  right={<Button label="Delete" size="sm" variant="ghost" onPress={() => deleteWater.mutate({ id: w.id })} />}
                />
              ))
            ) : (
              <Text color="textMuted">Not logged</Text>
            )}
            <Button label="Add water" variant="secondary" size="sm" onPress={() => router.push({ pathname: '/log/water', params: { date: localDate } })} />
          </Card>
        </>
      )}
    </Screen>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

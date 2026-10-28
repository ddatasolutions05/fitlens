import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { View } from 'react-native';
import { daysBetween, dayInsight, todayLocal, type UnitSystem } from '@fitlens/core';

import { ActivityCard, CalorieCard, DateSwitcher, DayCompleteToggle, InsightCard, MacroCard, MealTimeline, QuickActions, SectionLabel } from '@/features/day/components';
import { useDay } from '@/features/day/hooks';
import { useSelectedDate } from '@/features/day/selected-date';
import { useSetDayStatus } from '@/features/logs/hooks';
import { useProfile } from '@/features/profile/hooks';
import { energyEstimateFor } from '@/features/profile/tdee';
import { useQueueStatus } from '@/features/sync/useQueueStatus';
import { retryParked } from '@/lib/offline-queue';
import { ErrorState, OfflineBanner, Screen, SkeletonCard, space } from '@/ui';

export default function TodayScreen() {
  const qc = useQueryClient();
  const [localDate, setLocalDate] = useSelectedDate();
  const day = useDay(localDate);
  const profile = useProfile();
  const setStatus = useSetDayStatus();
  const queue = useQueueStatus();

  const estimate = useMemo(() => {
    if (!day.data || !profile.data) return null;
    return energyEstimateFor({
      profile: profile.data,
      goal: day.data.goal,
      kg: day.data.weight?.kg ?? null,
      localDate,
      steps: day.data.steps,
      workouts: day.data.workouts,
    });
  }, [day.data, profile.data, localDate]);

  const insight = useMemo(() => {
    if (!day.data) return null;
    const d = day.data;
    return dayInsight({
      logged: d.logged,
      totals: d.totals?.totals ?? null,
      targets: d.goal
        ? { calorieTarget: profile.data?.mode === 'tracking_only' ? null : d.goal.calorie_target, proteinG: d.goal.protein_g, fibreG: d.goal.fibre_g, waterMl: d.goal.water_ml }
        : null,
      waterMl: d.waterMl,
      hasWeightToday: d.weight?.localDate === localDate,
      daysSinceWeighIn: d.weight ? daysBetween(d.weight.localDate, localDate) : null,
      hideNumbers: profile.data?.hide_numbers ?? false,
      isToday: localDate === todayLocal(),
      hourOfDay: new Date().getHours(),
    });
  }, [day.data, profile.data, localDate]);

  const hideNumbers = profile.data?.hide_numbers ?? false;
  const unitSystem = (profile.data?.unit_system ?? 'metric') as UnitSystem;

  return (
    <Screen testID="today-screen" onRefresh={() => qc.invalidateQueries()}>
      <DateSwitcher localDate={localDate} onChange={setLocalDate} />
      <OfflineBanner pending={queue.pending} parked={queue.parked} syncing={queue.syncing} onRetry={() => void retryParked()} />
      {day.isLoading || profile.isLoading ? (
        <View style={{ gap: space.lg }}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
        </View>
      ) : day.isError ? (
        <ErrorState message={(day.error as Error).message} onRetry={() => day.refetch()} />
      ) : day.data ? (
        <>
          <CalorieCard day={day.data} hideNumbers={hideNumbers} trackingOnly={profile.data?.mode === 'tracking_only'} tdeeEstimate={estimate?.tdee.tdee ?? null} />
          <QuickActions localDate={localDate} />
          {insight ? <InsightCard text={insight.text} /> : null}
          {hideNumbers ? null : <MacroCard day={day.data} />}
          <View style={{ gap: space.sm }}>
            <SectionLabel>Meals</SectionLabel>
            <MealTimeline meals={day.data.meals} drafts={day.data.drafts} hideNumbers={hideNumbers} />
          </View>
          <ActivityCard day={day.data} unitSystem={unitSystem} />
          <DayCompleteToggle
            status={day.data.dayStatus}
            busy={setStatus.isPending}
            onChange={(complete) => setStatus.mutate({ localDate, status: complete ? 'complete' : null })}
          />
        </>
      ) : null}
    </Screen>
  );
}

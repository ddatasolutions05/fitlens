import { useState } from 'react';
import { View } from 'react-native';
import { formatWeight, type UnitSystem } from '@fitlens/core';

import { BarChart, ChartFrame, ConsistencyGrid, LineChart } from '@/features/progress/charts';
import { useProgress, type Range } from '@/features/progress/hooks';
import { useProfile } from '@/features/profile/hooks';
import { Card, ErrorState, Screen, Segmented, SkeletonCard, Text, space, useTheme } from '@/ui';

function dayLabel(localDate: string): string {
  return localDate.slice(8);
}

export default function ProgressScreen() {
  const { colors } = useTheme();
  const [range, setRange] = useState<Range>(7);
  const progress = useProgress(range);
  const profile = useProfile();
  const hideNumbers = profile.data?.hide_numbers ?? false;
  const unitSystem = (profile.data?.unit_system ?? 'metric') as UnitSystem;

  return (
    <Screen testID="progress-screen">
      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <Text variant="title">Progress</Text>
        <Segmented<string>
          value={String(range)}
          onChange={(v) => setRange(Number(v) as Range)}
          options={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
          ]}
        />
      </View>
      {progress.isLoading ? (
        <>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </>
      ) : progress.isError ? (
        <ErrorState message={(progress.error as Error).message} onRetry={() => progress.refetch()} />
      ) : progress.data ? (
        <>
          <Card>
            <ChartFrame
              title="Logging consistency"
              unit="days"
              summary={`${progress.data.consistency.complete} of ${progress.data.consistency.total} days complete, ${progress.data.consistency.partial} partial, ${progress.data.consistency.notLogged} not logged.`}
            >
              <ConsistencyGrid days={progress.data.days.map((d) => ({ label: d.localDate, status: d.status }))} />
            </ChartFrame>
          </Card>

          {!hideNumbers ? (
            <Card>
              <ChartFrame title="Calories vs target" unit="kcal" summary="Bars are eaten calories; the dashed line is the target in force that day. Days without logs are gaps.">
                <BarChart data={progress.data.days.map((d) => ({ label: dayLabel(d.localDate), value: d.kcal, target: d.kcalTarget }))} color={colors.accent} />
              </ChartFrame>
            </Card>
          ) : null}

          <Card>
            <ChartFrame title="Protein" unit="g">
              <BarChart data={progress.data.days.map((d) => ({ label: dayLabel(d.localDate), value: d.protein, target: d.proteinTarget }))} color={colors.protein} />
            </ChartFrame>
          </Card>

          <Card>
            <ChartFrame title="Fibre" unit="g">
              <BarChart data={progress.data.days.map((d) => ({ label: dayLabel(d.localDate), value: d.fibre, target: d.fibreTarget }))} color={colors.fibre} />
            </ChartFrame>
          </Card>

          <Card>
            <ChartFrame title="Steps" unit="steps">
              <BarChart data={progress.data.days.map((d) => ({ label: dayLabel(d.localDate), value: d.steps, target: d.stepTarget }))} color={colors.steps} />
            </ChartFrame>
          </Card>

          <Card>
            <ChartFrame
              title="Weight"
              unit={unitSystem === 'imperial' ? 'lb' : 'kg'}
              summary={
                progress.data.weights.length
                  ? `Latest trend ${formatWeight(progress.data.weights[progress.data.weights.length - 1]!.trendKg, unitSystem)}. Daily swings are mostly water and gut content, not fat; the darker line is the smoothed trend.`
                  : 'No weigh-ins in this range.'
              }
            >
              <LineChart
                data={progress.data.days.map((d) => {
                  const w = progress.data!.weights.find((p) => p.localDate === d.localDate);
                  return { label: dayLabel(d.localDate), value: w ? toUnit(w.kg, unitSystem) : null };
                })}
                smooth={progress.data.days.map((d) => {
                  const w = progress.data!.weights.find((p) => p.localDate === d.localDate);
                  return w ? toUnit(w.trendKg, unitSystem) : null;
                })}
                color={colors.weight}
                smoothColor={colors.accent}
              />
            </ChartFrame>
          </Card>

          {!hideNumbers ? (
            <Card>
              <ChartFrame title="Estimated TDEE" unit="kcal" summary="Changes only when a new goal version is saved. Adaptive estimates arrive once enough complete days and weigh-ins exist.">
                <LineChart
                  data={progress.data.days.map((d) => {
                    const t = [...progress.data!.tdeeSeries].reverse().find((p) => p.localDate <= d.localDate);
                    return { label: dayLabel(d.localDate), value: t ? t.tdee : null };
                  })}
                  color={colors.weight}
                  minZero
                />
              </ChartFrame>
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function toUnit(kg: number, unitSystem: UnitSystem): number {
  return unitSystem === 'imperial' ? Math.round(kg * 2.20462 * 10) / 10 : Math.round(kg * 10) / 10;
}

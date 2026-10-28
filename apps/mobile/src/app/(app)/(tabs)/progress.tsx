import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { adherenceLabel, formatWeight, rangeSummary, type RangeStats, type UnitSystem } from '@fitlens/core';

import { SectionLabel } from '@/features/day/components';
import { BarChart, ChartFrame, ConsistencyGrid, LineChart } from '@/features/progress/charts';
import { useProgress, type Range } from '@/features/progress/hooks';
import { useProfile } from '@/features/profile/hooks';
import { Card, EmptyState, ErrorState, Screen, Segmented, SkeletonCard, Stat, Text, space, useTheme } from '@/ui';

function dayLabel(localDate: string): string {
  return localDate.slice(8);
}

function pct(hit: number, eligible: number): string {
  if (eligible === 0) return 'No data';
  return `${Math.round((hit / eligible) * 100)}%`;
}

function signed(n: number, digits = 0): string {
  const v = digits ? n.toFixed(digits) : Math.round(n).toLocaleString();
  return n > 0 ? `+${v}` : v;
}

export default function ProgressScreen() {
  const { colors } = useTheme();
  const [range, setRange] = useState<Range>(7);
  const progress = useProgress(range);
  const profile = useProfile();
  const hideNumbers = profile.data?.hide_numbers ?? false;
  const trackingOnly = profile.data?.mode === 'tracking_only';
  const unitSystem = (profile.data?.unit_system ?? 'metric') as UnitSystem;

  return (
    <Screen testID="progress-screen">
      <View style={{ marginTop: space.md, gap: space.md }}>
        <View>
          <Text variant="title">Stats</Text>
          <Text variant="small" color="textMuted">
            Averages use logged days only. Unknown values are never counted as zero.
          </Text>
        </View>
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
          {progress.data.stats.loggedDays === 0 ? (
            <EmptyState title="Nothing logged in this range" body="Stats fill in from the first logged day." action={{ label: 'Log today', onPress: () => router.navigate('/today') }} />
          ) : (
            <SummaryPlate stats={progress.data.stats} range={range} hideNumbers={hideNumbers} trackingOnly={trackingOnly} unitSystem={unitSystem} />
          )}

          <KpiGrid stats={progress.data.stats} hideNumbers={hideNumbers} trackingOnly={trackingOnly} unitSystem={unitSystem} range={range} />

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
              <ChartFrame title="Calories vs target" unit="kcal" summary="Bars are calories eaten; the dashed line is the target in force that day. Days without logs are gaps.">
                <BarChart data={progress.data.days.map((d) => ({ label: dayLabel(d.localDate), value: d.kcal, target: trackingOnly ? null : d.kcalTarget }))} color={colors.text} />
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
              <BarChart data={progress.data.days.map((d) => ({ label: dayLabel(d.localDate), value: d.fibre, target: d.fibreTarget }))} color={colors.carbs} />
            </ChartFrame>
          </Card>

          <Card>
            <ChartFrame title="Steps" unit="steps">
              <BarChart data={progress.data.days.map((d) => ({ label: dayLabel(d.localDate), value: d.steps, target: d.stepTarget }))} color={colors.carbs} />
            </ChartFrame>
          </Card>

          <Card>
            <ChartFrame title="Water" unit="ml">
              <BarChart data={progress.data.days.map((d) => ({ label: dayLabel(d.localDate), value: d.waterMl, target: d.waterTarget }))} color={colors.fat} />
            </ChartFrame>
          </Card>

          <Card>
            <ChartFrame
              title="Weight"
              unit={unitSystem === 'imperial' ? 'lb' : 'kg'}
              summary={
                progress.data.weights.length
                  ? `Latest trend ${formatWeight(progress.data.weights[progress.data.weights.length - 1]!.trendKg, unitSystem)}. Daily swings are mostly water and gut content, not fat; the solid line is the smoothed trend.`
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
                color={colors.textFaint}
                smoothColor={colors.text}
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
                  color={colors.text}
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

function SummaryPlate({ stats, range, hideNumbers, trackingOnly, unitSystem }: { stats: RangeStats; range: Range; hideNumbers: boolean; trackingOnly: boolean; unitSystem: UnitSystem }) {
  const { colors } = useTheme();
  const lines = rangeSummary({ stats, rangeDays: range, hideNumbers, trackingOnly, unitSystem });
  const fg = colors.onInverse;
  return (
    <Card tone="inverse" style={{ gap: space.sm }} testID="range-summary">
      <Text variant="label" style={{ color: fg, opacity: 0.6 }}>
        {`Last ${range} days, in short`}
      </Text>
      {lines.map((line) => (
        <Text key={line} variant="heading" style={{ color: fg, fontSize: 18, lineHeight: 25 }}>
          {line}
        </Text>
      ))}
    </Card>
  );
}

function KpiGrid({ stats, hideNumbers, trackingOnly, unitSystem, range }: { stats: RangeStats; hideNumbers: boolean; trackingOnly: boolean; unitSystem: UnitSystem; range: Range }) {
  const kg = (v: number) => (unitSystem === 'imperial' ? `${signed(v * 2.20462, 1)} lb` : `${signed(v, 1)} kg`);
  return (
    <View style={{ gap: space.sm }} testID="kpi-grid">
      <SectionLabel>{`Last ${range} days`}</SectionLabel>
      <View style={styles.grid}>
        <Stat label="Days logged" value={`${stats.loggedDays} / ${stats.totalDays}`} note={`${stats.completeDays} marked complete`} testID="kpi-logged" />
        <Stat label="Current streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} note={`Best ${stats.bestStreak} in range`} tone={stats.streak >= 3 ? 'on' : 'neutral'} testID="kpi-streak" />
      </View>
      {!hideNumbers ? (
        <View style={styles.grid}>
          <Stat
            label="Avg calories"
            value={stats.avgKcal != null ? Math.round(stats.avgKcal).toLocaleString() : 'No data'}
            note={trackingOnly ? 'Tracking only' : stats.kcalDelta != null ? `${signed(stats.kcalDelta)} vs target` : 'Logged days only'}
            testID="kpi-kcal"
          />
          <Stat
            label="Days on target"
            value={trackingOnly ? 'Off' : pct(stats.onTargetDays, stats.onTargetEligible)}
            note={trackingOnly ? 'Tracking only, no calorie target' : stats.onTargetEligible ? `${adherenceLabel(stats.onTargetDays, stats.onTargetEligible, 'calorie')} within 10%` : 'No logged days with a target yet'}
            tone={!trackingOnly && stats.onTargetEligible > 0 && stats.onTargetDays / stats.onTargetEligible >= 0.7 ? 'on' : 'neutral'}
            testID="kpi-on-target"
          />
        </View>
      ) : null}
      <View style={styles.grid}>
        <Stat
          label="Avg protein"
          value={stats.avgProtein != null ? `${Math.round(stats.avgProtein)} g` : 'No data'}
          note={stats.proteinEligible ? `${adherenceLabel(stats.proteinHitDays, stats.proteinEligible, 'protein')} at target` : 'No logged days yet'}
          tone={stats.proteinEligible > 0 && stats.proteinHitDays / stats.proteinEligible >= 0.7 ? 'on' : 'neutral'}
          testID="kpi-protein"
        />
        <Stat label="Avg fibre" value={stats.avgFibre != null ? `${Math.round(stats.avgFibre)} g` : 'No data'} note="Logged days only" />
      </View>
      <View style={styles.grid}>
        <Stat
          label="Weight change"
          value={stats.weightChangeKg != null ? kg(stats.weightChangeKg) : 'No data'}
          note={stats.weeklyRateKg != null ? `${kg(stats.weeklyRateKg)} per week, trend` : 'Needs two weigh-ins'}
          testID="kpi-weight"
        />
        <Stat
          label="Avg steps"
          value={stats.avgSteps != null ? Math.round(stats.avgSteps).toLocaleString() : 'No data'}
          note={stats.stepEligible ? `${adherenceLabel(stats.stepHitDays, stats.stepEligible, 'step')} at goal` : 'No step logs yet'}
          tone={stats.stepEligible > 0 && stats.stepHitDays / stats.stepEligible >= 0.7 ? 'on' : 'neutral'}
        />
      </View>
      <View style={styles.grid}>
        <Stat label="Workouts" value={`${stats.workoutDays} day${stats.workoutDays === 1 ? '' : 's'}`} note={stats.workoutMinutes > 0 ? `${Math.round(stats.workoutMinutes)} min in total` : 'None logged'} />
        <Stat
          label="Avg water"
          value={stats.avgWater != null ? `${Math.round(stats.avgWater).toLocaleString()} ml` : 'No data'}
          note={stats.waterEligible ? `${adherenceLabel(stats.waterHitDays, stats.waterEligible, 'water')} at goal` : 'No water logs yet'}
        />
      </View>
    </View>
  );
}

function toUnit(kg: number, unitSystem: UnitSystem): number {
  return unitSystem === 'imperial' ? Math.round(kg * 2.20462 * 10) / 10 : Math.round(kg * 10) / 10;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: space.sm },
});

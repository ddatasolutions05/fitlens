import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { addDays, formatLocalDate, formatWeight, roundKcal, todayLocal, type UnitSystem } from '@fitlens/core';

import type { MealWithItems } from '@/features/meals/api';
import { displayKcal } from '@/features/meals/model';
import { MealPhotoThumb } from '@/features/photo/MealPhotoThumb';
import { Bar, Button, Card, Ring, Text, radius, space, touch, useTheme } from '@/ui';

import type { DaySummary } from './hooks';

export function DateSwitcher({ localDate, onChange }: { localDate: string; onChange: (d: string) => void }) {
  const { colors } = useTheme();
  const today = todayLocal();
  const isToday = localDate === today;
  return (
    <View style={styles.dateRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => onChange(addDays(localDate, -1))} style={styles.dateBtn} testID="date-prev">
        <Text variant="heading" color="accent">
          ‹
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Jump to today" onPress={() => onChange(today)} style={styles.dateLabel} disabled={isToday}>
        <Text variant="heading" testID="date-label">
          {formatLocalDate(localDate, 'relative', today)}
        </Text>
        {!isToday ? (
          <Text variant="caption" color="accent">
            Back to today
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next day"
        onPress={() => onChange(addDays(localDate, 1))}
        style={[styles.dateBtn, { opacity: isToday ? 0.3 : 1 }]}
        disabled={isToday}
        testID="date-next"
      >
        <Text variant="heading" style={{ color: colors.accent }}>
          ›
        </Text>
      </Pressable>
    </View>
  );
}

export function CalorieCard({ day, hideNumbers, trackingOnly, tdeeEstimate }: { day: DaySummary; hideNumbers: boolean; trackingOnly: boolean; tdeeEstimate: number | null }) {
  const { colors } = useTheme();
  const eaten = day.totals?.totals.kcal ?? null;
  const target = trackingOnly ? null : (day.goal?.calorie_target ?? null);
  const unknown = day.totals?.unknown.kcal ?? 0;
  const remaining = eaten != null && target != null ? target - eaten : null;

  if (hideNumbers) {
    return (
      <Card style={{ gap: space.sm }}>
        <Text variant="heading">Today</Text>
        <Text color="textMuted">
          {day.logged ? `${day.totals?.mealCount ?? 0} meal${day.totals?.mealCount === 1 ? '' : 's'} logged.` : 'Not logged yet.'}
        </Text>
        <Text variant="caption" color="textFaint">
          Calorie figures are hidden. Change this in Profile.
        </Text>
      </Card>
    );
  }

  const value = eaten == null ? (day.logged ? '—' : 'Not logged') : displayKcal(eaten);
  const caption =
    target == null
      ? trackingOnly
        ? 'Tracking only, no calorie target'
        : 'No target set'
      : eaten == null
        ? `Target ${target.toLocaleString()} kcal`
        : remaining != null && remaining >= 0
          ? `${roundKcal(remaining)?.toLocaleString()} kcal left of ${target.toLocaleString()}`
          : `${displayKcal(eaten)} of ${target.toLocaleString()} kcal`;

  return (
    <Card style={styles.calorieCard}>
      <Ring
        progress={eaten != null && target ? eaten / target : null}
        label="Eaten"
        value={value}
        caption={caption}
        accessibilityLabel={`Calories: ${value}. ${caption}`}
      />
      <View style={{ flex: 1, gap: space.sm }}>
        <Text variant="small" color="textMuted">
          Food target
        </Text>
        <Text variant="title" tabular testID="calorie-target">
          {target != null ? `${target.toLocaleString()} kcal` : trackingOnly ? 'Not set (tracking only)' : 'Not set'}
        </Text>
        {day.totals?.kcalRange ? (
          <Text variant="caption" color="textFaint">
            Range {roundKcal(day.totals.kcalRange[0])?.toLocaleString()} to {roundKcal(day.totals.kcalRange[1])?.toLocaleString()} kcal
          </Text>
        ) : null}
        {unknown > 0 ? (
          <Text variant="caption" color="textFaint">
            {unknown} item{unknown === 1 ? '' : 's'} with unknown calories not counted
          </Text>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/tdee')} style={{ marginTop: space.xs }}>
          <Text variant="small" style={{ color: colors.textMuted }}>
            Estimated TDEE{' '}
            <Text variant="small" tabular style={{ color: colors.weight }}>
              {tdeeEstimate != null ? `${(roundKcal(tdeeEstimate) ?? 0).toLocaleString()} kcal` : 'unknown'}
            </Text>
          </Text>
          <Text variant="caption" style={{ color: colors.accent }}>
            What is the difference?
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

export function MacroCard({ day }: { day: DaySummary }) {
  const { colors } = useTheme();
  const t = day.totals?.totals;
  const u = day.totals?.unknown;
  const g = day.goal;
  return (
    <Card style={{ gap: space.md }}>
      <Bar label="Protein" value={t?.protein_g ?? null} target={g?.protein_g ?? null} unit=" g" color={colors.protein} unknownCount={u?.protein_g ?? 0} />
      <View style={{ gap: space.sm }}>
        <Bar label="Carbs" value={t?.carbs_g ?? null} target={g?.carbs_g ?? null} unit=" g" color={colors.carbs} unknownCount={u?.carbs_g ?? 0} compact />
        <Bar label="Fat" value={t?.fat_g ?? null} target={g?.fat_g ?? null} unit=" g" color={colors.fat} unknownCount={u?.fat_g ?? 0} compact />
        <Bar label="Fibre" value={t?.fibre_g ?? null} target={g?.fibre_g ?? null} unit=" g" color={colors.fibre} unknownCount={u?.fibre_g ?? 0} compact />
      </View>
    </Card>
  );
}

export function ActivityCard({ day, unitSystem }: { day: DaySummary; unitSystem: UnitSystem }) {
  const { colors } = useTheme();
  const stepGoal = day.goal?.step_goal ?? null;
  const waterGoal = day.goal?.water_ml ?? null;
  return (
    <Card style={{ gap: space.md }}>
      <Bar label="Steps" value={day.steps} target={stepGoal} unit="" color={colors.steps} />
      {day.workoutCount > 0 ? (
        <Text variant="caption" color="textMuted">
          {day.workoutCount} workout{day.workoutCount === 1 ? '' : 's'}, {Math.round(day.workoutMinutes ?? 0)} min
          {day.workoutKcal != null ? `, about ${Math.round(day.workoutKcal)} kcal (estimate)` : ''}
        </Text>
      ) : null}
      <Bar label="Water" value={day.waterMl} target={waterGoal} unit=" ml" color={colors.water} />
      <View style={styles.weightRow}>
        <View style={{ flex: 1 }}>
          <Text variant="small" color="textMuted">
            Weight
          </Text>
          <Text variant="bodyStrong" tabular>
            {day.weight ? formatWeight(day.weight.kg, unitSystem) : 'Not logged'}
          </Text>
          {day.weight && day.weight.localDate !== day.localDate ? (
            <Text variant="caption" color="textFaint">
              last logged {formatLocalDate(day.weight.localDate, 'short')}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="small" color="textMuted">
            7-day trend
          </Text>
          <Text variant="bodyStrong">
            {day.trendDirection === 'down' ? '↓ down' : day.trendDirection === 'up' ? '↑ up' : day.trendDirection === 'flat' ? '→ flat' : 'needs more data'}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export function QuickActions({ localDate }: { localDate: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <Button label="Scan meal" size="lg" onPress={() => router.push({ pathname: '/scan', params: { date: localDate, fresh: '1' } })} testID="quick-scan" />
      <View style={styles.actionRow}>
        <Button label="Add food" variant="secondary" style={styles.actionBtn} onPress={() => router.push({ pathname: '/food/search', params: { date: localDate, fresh: '1' } })} testID="quick-add-food" />
        <Button label="Weight" variant="secondary" style={styles.actionBtn} onPress={() => router.push({ pathname: '/log/weight', params: { date: localDate } })} testID="quick-weight" />
      </View>
      <View style={styles.actionRow}>
        <Button label="Activity" variant="secondary" style={styles.actionBtn} onPress={() => router.push({ pathname: '/log/activity', params: { date: localDate } })} testID="quick-activity" />
        <Button label="Water" variant="secondary" style={styles.actionBtn} onPress={() => router.push({ pathname: '/log/water', params: { date: localDate } })} testID="quick-water" />
      </View>
    </View>
  );
}

export function InsightCard({ text }: { text: string }) {
  return (
    <Card tone="accent">
      <Text variant="caption" color="accent">
        Insight
      </Text>
      <Text testID="insight">{text}</Text>
    </Card>
  );
}

export function MealTimeline({ meals, drafts, hideNumbers }: { meals: MealWithItems[]; drafts: MealWithItems[]; hideNumbers: boolean }) {
  const { colors } = useTheme();
  if (meals.length === 0 && drafts.length === 0) {
    return (
      <Card tone="alt">
        <Text color="textMuted">No meals logged on this day.</Text>
      </Card>
    );
  }
  return (
    <View style={{ gap: space.sm }}>
      {drafts.map((m) => (
        <MealRow key={m.id} meal={m} draft hideNumbers={hideNumbers} />
      ))}
      {meals.map((m) => (
        <MealRow key={m.id} meal={m} hideNumbers={hideNumbers} />
      ))}
      {drafts.length > 0 ? (
        <Text variant="caption" style={{ color: colors.textFaint }}>
          Drafts do not count toward totals until you confirm them.
        </Text>
      ) : null}
    </View>
  );
}

function MealRow({ meal, draft, hideNumbers }: { meal: MealWithItems; draft?: boolean; hideNumbers: boolean }) {
  const { colors } = useTheme();
  const kcal = meal.meal_items.reduce<{ sum: number; any: boolean; unknown: number }>(
    (acc, mi) => (mi.kcal == null ? { ...acc, unknown: acc.unknown + 1 } : { ...acc, sum: acc.sum + Number(mi.kcal), any: true }),
    { sum: 0, any: false, unknown: 0 },
  );
  const names = meal.meal_items.map((mi) => mi.name_snapshot).join(', ');
  const photo = meal.meal_photos[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meal.title ?? meal.meal_type}, ${draft ? 'draft' : 'confirmed'}`}
      onPress={() => router.push({ pathname: '/meal/[id]', params: { id: meal.id } })}
      style={({ pressed }) => [styles.mealRow, { backgroundColor: colors.surface, borderColor: draft ? colors.accent : colors.border, opacity: pressed ? 0.85 : 1 }]}
      testID={`meal-${meal.id}`}
    >
      {photo ? <MealPhotoThumb storagePath={photo.storage_path} size={56} /> : <View style={[styles.thumbPlaceholder, { backgroundColor: colors.surfaceAlt }]} />}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text variant="bodyStrong">{meal.title ?? capitalize(meal.meal_type)}</Text>
          {draft ? (
            <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
              <Text variant="caption" color="accent">
                Draft
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="small" color="textMuted" numberOfLines={2}>
          {names || 'No items yet'}
        </Text>
      </View>
      {!hideNumbers ? (
        <Text variant="bodyStrong" tabular>
          {kcal.any ? `${roundKcal(kcal.sum)?.toLocaleString()} kcal${kcal.unknown > 0 ? ' +?' : ''}` : 'unknown'}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function DayCompleteToggle({ status, onChange, busy }: { status: 'not_logged' | 'partial' | 'complete'; onChange: (complete: boolean) => void; busy: boolean }) {
  const { colors } = useTheme();
  const complete = status === 'complete';
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: complete, busy }}
      onPress={() => onChange(!complete)}
      disabled={busy}
      style={[styles.toggle, { borderColor: complete ? colors.accent : colors.border, backgroundColor: complete ? colors.accentSoft : colors.surface }]}
      testID="day-complete"
    >
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{complete ? 'Day marked complete' : 'Mark day complete'}</Text>
        <Text variant="caption" color="textMuted">
          {complete ? 'Counts toward your consistency and adaptive estimates.' : 'Tick this when everything you ate is logged.'}
        </Text>
      </View>
      <Text variant="heading" style={{ color: complete ? colors.accent : colors.textFaint }}>
        {complete ? '✓' : '○'}
      </Text>
    </Pressable>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateBtn: { width: touch.min + 8, height: touch.min + 8, alignItems: 'center', justifyContent: 'center' },
  dateLabel: { flex: 1, alignItems: 'center', minHeight: touch.min, justifyContent: 'center' },
  calorieCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  actionRow: { flexDirection: 'row', gap: space.sm },
  actionBtn: { flex: 1 },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: touch.min + 24,
  },
  thumbPlaceholder: { width: 56, height: 56, borderRadius: radius.md },
  badge: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: touch.min + 16,
  },
});

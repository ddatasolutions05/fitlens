import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { type UnitSystem, addDays, formatLocalDate, formatWeight, roundKcal, todayLocal, waterUnit, waterValue } from '@fitlens/core';

import type { MealWithItems } from '@/features/meals/api';
import { displayKcal } from '@/features/meals/model';
import { MealPhotoThumb } from '@/features/photo/MealPhotoThumb';
import { AnimatedFill, Bar, Button, Card, Icon, Text, radius, space, touch, type IconName, useCountUp, useTheme } from '@/ui';

import type { DaySummary } from './hooks';

export function DateSwitcher({ localDate, onChange }: { localDate: string; onChange: (d: string) => void }) {
  const { colors } = useTheme();
  const today = todayLocal();
  const isToday = localDate === today;
  return (
    <View style={styles.dateRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => onChange(addDays(localDate, -1))} style={styles.dateBtn} testID="date-prev">
        <Icon name="chevronLeft" size={22} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Jump to today" onPress={() => onChange(today)} style={styles.dateLabel} disabled={isToday}>
        <Text variant="title" testID="date-label" style={{ fontSize: 24, lineHeight: 28 }}>
          {formatLocalDate(localDate, 'relative', today)}
        </Text>
        <Text variant="caption" color="textMuted">
          {isToday ? formatLocalDate(localDate, 'long') : 'Tap to return to today'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next day"
        onPress={() => onChange(addDays(localDate, 1))}
        style={[styles.dateBtn, { opacity: isToday ? 0.25 : 1 }]}
        disabled={isToday}
        testID="date-next"
      >
        <Icon name="chevronRight" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

/** The white plate: the one loud element on the screen. */
export function CalorieCard({ day, hideNumbers, trackingOnly, tdeeEstimate }: { day: DaySummary; hideNumbers: boolean; trackingOnly: boolean; tdeeEstimate: number | null }) {
  const { colors } = useTheme();
  const eaten = day.totals?.totals.kcal ?? null;
  const shownKcal = useCountUp(eaten == null ? null : Math.round(eaten));
  const target = trackingOnly ? null : (day.goal?.calorie_target ?? null);
  const unknown = day.totals?.unknown.kcal ?? 0;
  const remaining = eaten != null && target != null ? target - eaten : null;
  const ratio = eaten != null && target ? Math.max(0, Math.min(1, eaten / target)) : 0;
  const fg = colors.onInverse;
  const mealCount = day.totals?.mealCount ?? 0;

  if (hideNumbers) {
    return (
      <Card tone="inverse" style={{ gap: space.sm }}>
        <Text variant="label" style={{ color: fg, opacity: 0.6 }}>
          Today
        </Text>
        <Text variant="title" style={{ color: fg }}>
          {day.logged ? `${mealCount} meal${mealCount === 1 ? '' : 's'} logged` : 'Nothing logged yet'}
        </Text>
        <Text variant="small" style={{ color: fg, opacity: 0.7 }}>
          Calorie figures are hidden. Change this in Profile.
        </Text>
      </Card>
    );
  }

  const value = shownKcal == null ? '0' : displayKcal(shownKcal);
  const headline =
    target == null
      ? trackingOnly
        ? 'Tracking only, no calorie target'
        : 'No calorie target set'
      : remaining == null
        ? `Nothing logged yet. ${target.toLocaleString()} kcal to work with today.`
        : remaining >= 0
          ? `${roundKcal(remaining)?.toLocaleString()} kcal left of ${target.toLocaleString()}`
          : `${roundKcal(-remaining)?.toLocaleString()} kcal over ${target.toLocaleString()}`;

  return (
    <Card tone="inverse" style={{ gap: space.md }} testID="calorie-card" accessible accessibilityLabel={`Calories: ${value} kcal. ${headline}`}>
      <View style={styles.plateHead}>
        <Text variant="label" style={{ color: fg, opacity: 0.6 }}>
          Calories eaten
        </Text>
        <Text variant="caption" style={{ color: fg, opacity: 0.6 }}>
          {mealCount} meal{mealCount === 1 ? '' : 's'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
        <Text variant="display" tabular style={{ color: fg }} testID="calorie-eaten">
          {value}
        </Text>
        <Text variant="heading" style={{ color: fg, opacity: 0.6, marginBottom: 8 }}>
          kcal
        </Text>
      </View>
      <AnimatedFill ratio={ratio} color={fg} track={colors.inverseLine} height={6} />
      <Text variant="small" style={{ color: fg }}>
        {headline}
      </Text>
      {day.totals?.kcalRange || unknown > 0 ? (
        <Text variant="caption" style={{ color: fg, opacity: 0.6 }}>
          {day.totals?.kcalRange ? `Range ${roundKcal(day.totals.kcalRange[0])?.toLocaleString()} to ${roundKcal(day.totals.kcalRange[1])?.toLocaleString()} kcal. ` : ''}
          {unknown > 0 ? `${unknown} item${unknown === 1 ? '' : 's'} with unknown calories not counted.` : ''}
        </Text>
      ) : null}
      <View style={[styles.plateStats, { borderTopColor: colors.inverseLine }]}>
        <PlateStat label="Target" value={target != null ? `${target.toLocaleString()} kcal` : 'Not set'} fg={fg} testID="calorie-target" />
        <View style={[styles.plateDivider, { backgroundColor: colors.inverseLine }]} />
        <PlateStat label="Est. burn" value={tdeeEstimate != null ? `${(roundKcal(tdeeEstimate) ?? 0).toLocaleString()} kcal` : 'Unknown'} fg={fg} onPress={() => router.push('/profile/tdee')} />
        <View style={[styles.plateDivider, { backgroundColor: colors.inverseLine }]} />
        <PlateStat label="Protein" value={day.totals?.totals.protein_g != null ? `${Math.round(day.totals.totals.protein_g)} g` : (day.totals?.unknown.protein_g ?? 0) > 0 ? 'Unknown' : '0 g'} fg={fg} />
      </View>
    </Card>
  );
}

function PlateStat({ label, value, fg, onPress, testID }: { label: string; value: string; fg: string; onPress?: () => void; testID?: string }) {
  const inner = (
    <>
      <Text variant="caption" style={{ color: fg, opacity: 0.6 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" tabular style={{ color: fg }} testID={testID}>
        {value}
      </Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${value}. What is the difference?`} onPress={onPress} style={styles.plateStat} testID="tdee-link">
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.plateStat}>{inner}</View>;
}

export function MacroCard({ day }: { day: DaySummary }) {
  const { colors } = useTheme();
  const t = day.totals?.totals;
  const u = day.totals?.unknown;
  const g = day.goal;
  return (
    <Card style={{ gap: space.md }}>
      <SectionLabel>Macros</SectionLabel>
      <Bar label="Protein" value={t?.protein_g ?? null} target={g?.protein_g ?? null} unit=" g" color={colors.protein} unknownCount={u?.protein_g ?? 0} />
      <Bar label="Carbs" value={t?.carbs_g ?? null} target={g?.carbs_g ?? null} unit=" g" color={colors.carbs} unknownCount={u?.carbs_g ?? 0} compact />
      <Bar label="Fat" value={t?.fat_g ?? null} target={g?.fat_g ?? null} unit=" g" color={colors.fat} unknownCount={u?.fat_g ?? 0} compact />
      <Bar label="Fibre" value={t?.fibre_g ?? null} target={g?.fibre_g ?? null} unit=" g" color={colors.fibre} unknownCount={u?.fibre_g ?? 0} compact />
    </Card>
  );
}

export function ActivityCard({ day, unitSystem }: { day: DaySummary; unitSystem: UnitSystem }) {
  const { colors } = useTheme();
  const stepGoal = day.goal?.step_goal ?? null;
  const waterGoal = day.goal?.water_ml ?? null;
  const trend =
    day.trendDirection === 'down' ? 'Trending down' : day.trendDirection === 'up' ? 'Trending up' : day.trendDirection === 'flat' ? 'Holding steady' : 'Needs more weigh-ins';
  return (
    <Card style={{ gap: space.md }}>
      <SectionLabel>Body and activity</SectionLabel>
      <View style={styles.logRow}>
        <Button label="Steps" variant="secondary" size="sm" style={{ flex: 1 }} icon={<Icon name="activity" size={16} />} onPress={() => router.push({ pathname: '/log/activity', params: { date: day.localDate } })} testID="quick-activity" />
        <Button label="Water" variant="secondary" size="sm" style={{ flex: 1 }} icon={<Icon name="water" size={16} />} onPress={() => router.push({ pathname: '/log/water', params: { date: day.localDate } })} testID="quick-water" />
        <Button label="Weight" variant="secondary" size="sm" style={{ flex: 1 }} icon={<Icon name="scale" size={16} />} onPress={() => router.push({ pathname: '/log/weight', params: { date: day.localDate } })} testID="quick-weight" />
      </View>
      <Bar label="Steps" value={day.steps} target={stepGoal} unit="" color={colors.steps} />
      {day.workoutCount > 0 ? (
        <Text variant="caption" color="textMuted">
          {day.workoutCount} workout{day.workoutCount === 1 ? '' : 's'}, {Math.round(day.workoutMinutes ?? 0)} min
          {day.workoutKcal != null ? `, about ${Math.round(day.workoutKcal)} kcal (estimate)` : ''}
        </Text>
      ) : null}
      <Bar label="Water" value={waterValue(day.waterMl, unitSystem)} target={waterValue(waterGoal, unitSystem)} unit={` ${waterUnit(unitSystem)}`} color={colors.water} />
      <View style={[styles.weightRow, { borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="textMuted">
            Weight
          </Text>
          <Text variant="heading" tabular>
            {day.weight ? formatWeight(day.weight.kg, unitSystem) : 'Not logged'}
          </Text>
          {day.weight && day.weight.localDate !== day.localDate ? (
            <Text variant="caption" color="textFaint">
              last logged {formatLocalDate(day.weight.localDate, 'short')}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="caption" color="textMuted">
            7-day trend
          </Text>
          <Text variant="bodyStrong">{trend}</Text>
        </View>
      </View>
    </Card>
  );
}

export function QuickActions({ localDate }: { localDate: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.actionRow}>
        <ActionTile icon="search" label="Search food" onPress={() => router.push({ pathname: '/food/search', params: { date: localDate, fresh: '1' } })} testID="quick-add-food" />
        <ActionTile icon="pencil" label="Enter manually" onPress={() => router.push({ pathname: '/food/manual', params: { date: localDate, fresh: '1' } })} testID="quick-manual" />
        <ActionTile icon="camera" label="Scan meal" onPress={() => router.push({ pathname: '/scan', params: { date: localDate, fresh: '1' } })} testID="quick-scan" />
      </View>
    </View>
  );
}

function ActionTile({ icon, label, onPress, quiet, testID }: { icon: IconName; label: string; onPress: () => void; quiet?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.actionTile,
        quiet ? { borderColor: colors.border, backgroundColor: 'transparent', minHeight: 56, flexDirection: 'row', gap: space.sm } : { borderColor: colors.border, backgroundColor: colors.surface },
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Icon name={icon} size={quiet ? 18 : 24} />
      <Text variant={quiet ? 'small' : 'bodyStrong'} align="center" numberOfLines={2} style={quiet ? null : { fontSize: 13, lineHeight: 17 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function InsightCard({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.insight, { borderLeftColor: colors.text }]}>
      <Text variant="label" color="textMuted">
        Insight
      </Text>
      <Text testID="insight">{text}</Text>
    </View>
  );
}

export function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      <Text variant="label" color="textMuted">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function MealTimeline({ meals, drafts, hideNumbers }: { meals: MealWithItems[]; drafts: MealWithItems[]; hideNumbers: boolean }) {
  const { colors } = useTheme();
  if (meals.length === 0 && drafts.length === 0) {
    return (
      <Card tone="alt" style={{ alignItems: 'center', gap: space.xs }}>
        <Text variant="bodyStrong">No meals on this day</Text>
        <Text variant="small" color="textMuted" align="center">
          Search the database, type it in, or scan the plate.
        </Text>
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
      style={({ pressed }) => [styles.mealRow, { backgroundColor: colors.surface, borderColor: draft ? colors.text : colors.border, borderStyle: draft ? 'dashed' : 'solid', opacity: pressed ? 0.85 : 1 }]}
      testID={`meal-${meal.id}`}
    >
      {photo ? (
        <MealPhotoThumb storagePath={photo.storage_path} size={52} />
      ) : (
        <View style={[styles.thumbPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
          <Icon name={meal.source === 'photo' ? 'camera' : 'diary'} size={20} color={colors.textFaint} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text variant="bodyStrong">{meal.title ?? capitalize(meal.meal_type)}</Text>
          {draft ? (
            <View style={[styles.badge, { borderColor: colors.text }]}>
              <Text variant="label" style={{ fontSize: 10, lineHeight: 12 }}>
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
        <Text variant="heading" tabular>
          {kcal.any ? `${roundKcal(kcal.sum)?.toLocaleString()} kcal${kcal.unknown > 0 ? ' +?' : ''}` : meal.meal_items.length === 0 ? 'No items' : 'unknown'}
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
      style={[styles.toggle, { borderColor: complete ? colors.text : colors.border, backgroundColor: colors.surface }]}
      testID="day-complete"
    >
      <View style={[styles.checkbox, { borderColor: colors.text, backgroundColor: complete ? colors.inverse : 'transparent' }]}>
        {complete ? <Icon name="check" size={16} color={colors.onInverse} strokeWidth={2.6} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{complete ? 'Day marked complete' : 'Mark day complete'}</Text>
        <Text variant="caption" color="textMuted">
          {complete ? 'Counts toward consistency and adaptive estimates.' : 'Tick this once everything you ate is logged.'}
        </Text>
      </View>
    </Pressable>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateBtn: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' },
  dateLabel: { flex: 1, alignItems: 'center', minHeight: touch.min, justifyContent: 'center' },
  plateHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plateStats: { flexDirection: 'row', borderTopWidth: 1, paddingTop: space.md, marginTop: space.xs },
  plateStat: { flex: 1, gap: 2 },
  plateDivider: { width: 1, marginHorizontal: space.md },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md },
  actionRow: { flexDirection: 'row', gap: space.sm },
  logRow: { flexDirection: 'row', gap: space.sm },
  actionTile: {
    flex: 1,
    minHeight: 84,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
  },
  insight: { borderLeftWidth: 3, paddingLeft: space.md, paddingVertical: space.xs, gap: space.xs },
  sectionLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: touch.min + 24,
  },
  thumbPlaceholder: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: touch.min + 16,
  },
  checkbox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { addDays, formatLocalDate, greetingFor, quoteForDate, streakLabel, suggestionsForDay, todayLocal } from '@fitlens/core';

import { useSession } from '@/features/auth/session';
import { useDay } from '@/features/day/hooks';
import { useLogDays } from '@/features/day/useLogDays';
import { FirstSteps, useFirstSteps } from '@/features/home/FirstSteps';
import { Avatar, initialsFor } from '@/features/profile/Avatar';
import { useProfile } from '@/features/profile/hooks';
import { useWeekSessions, useWeeklyPlan } from '@/features/workouts/hooks';
import { Button, Card, Icon, Screen, SkeletonCard, Text, radius, space, touch, useCountUp, useTheme, type IconName } from '@/ui';

const SECTIONS: { href: string; icon: IconName; title: string; testID: string }[] = [
  { href: '/today', icon: 'today', title: 'Today', testID: 'nav-today' },
  { href: '/diary', icon: 'diary', title: 'Diary', testID: 'nav-diary' },
  { href: '/train', icon: 'dumbbell', title: 'Workouts', testID: 'nav-train' },
  { href: '/progress', icon: 'progress', title: 'Stats', testID: 'nav-progress' },
  { href: '/coach', icon: 'coach', title: 'Coach', testID: 'nav-coach' },
  { href: '/profile', icon: 'profile', title: 'Profile', testID: 'nav-profile' },
];

export default function HomeScreen() {
  const qc = useQueryClient();
  const { colors } = useTheme();
  const { session } = useSession();
  const profile = useProfile();
  const today = todayLocal();
  const day = useDay(today);
  const yesterday = useDay(addDays(today, -1));
  const logDays = useLogDays();
  const streak = streakLabel(logDays.data?.streak ?? 0);
  const { plan, settings, configured } = useWeeklyPlan();
  const sessions = useWeekSessions(today);
  const suggestion = useMemo(() => (configured ? (suggestionsForDay({ plan, localDate: today, settings })[0] ?? null) : null), [configured, plan, settings, today]);
  const doneToday = (sessions.data ?? []).some((s) => s.localDate === today && s.workoutId === suggestion?.workout.id);

  const name = profile.data?.display_name?.trim() || null;
  const hideNumbers = profile.data?.hide_numbers ?? false;
  const totals = day.data?.totals?.totals ?? null;
  const target = profile.data?.mode === 'tracking_only' ? null : (day.data?.goal?.calorie_target ?? null);
  const kcalRaw = totals?.kcal != null ? Math.round(totals.kcal / 10) * 10 : null;
  const kcal = useCountUp(kcalRaw);
  const first = useFirstSteps();
  const mealCount = day.data?.meals.length ?? 0;
  const eaten = hideNumbers ? (mealCount ? `${mealCount} meal${mealCount === 1 ? '' : 's'}` : null) : kcal != null ? `${kcal.toLocaleString()} kcal` : null;
  const protein = totals?.protein_g != null ? `${Math.round(totals.protein_g)} g` : null;

  return (
    <Screen testID="home-screen" onRefresh={() => qc.invalidateQueries()}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text variant="label" color="textMuted">
            {formatLocalDate(today, 'long')}
          </Text>
          <Text variant="title" testID="greeting">
            {greetingFor(new Date().getHours())}
            {name ? `, ${name.split(' ')[0]}` : ''}
          </Text>
          {streak ? (
            <Text variant="small" color="textMuted" testID="streak">
              {streak}. Keep it going.
            </Text>
          ) : null}
        </View>
        <Avatar path={profile.data?.avatar_path ?? null} initials={initialsFor(name, session?.user.email)} size={56} onPress={() => router.push('/profile')} testID="home-avatar" />
      </View>

      {first.show ? <FirstSteps steps={first.steps} done={first.done} /> : null}

      <Card tone={first.show ? 'surface' : 'inverse'} style={{ gap: space.md, paddingVertical: space.xl }} testID="quote">
        <Text variant="label" style={{ color: first.show ? colors.textMuted : colors.onInverse, opacity: first.show ? 1 : 0.6 }}>
          Today&apos;s line
        </Text>
        <Text variant="heading" style={{ color: first.show ? colors.text : colors.onInverse, fontSize: 22, lineHeight: 30 }}>
          {quoteForDate(today)}
        </Text>
      </Card>

      {day.isLoading ? (
        <SkeletonCard lines={2} />
      ) : (
        <View style={{ gap: space.md }}>
          <View style={styles.row}>
            <BigTile label="Eaten" value={eaten} note={eaten && !hideNumbers && target ? `of ${target.toLocaleString()} kcal` : eaten ? undefined : (yesterday.data?.meals.length ?? 0) > 0 ? 'Same as yesterday? Tap' : 'Tap to log a meal'} onPress={() => (!eaten && (yesterday.data?.meals.length ?? 0) > 0 ? router.push('/today') : router.push({ pathname: '/food/search', params: { date: today, fresh: '1' } }))} testID="home-kcal" />
            <BigTile label="Protein" value={protein} note={protein && day.data?.goal?.protein_g ? `of ${day.data.goal.protein_g} g` : protein ? undefined : 'From your meals'} onPress={() => router.push('/today')} testID="home-protein" />
          </View>
          <View style={styles.row}>
            <SmallTile icon="water" label={day.data?.waterMl ? `${day.data.waterMl.toLocaleString()} ml water` : 'Add water'} onPress={() => router.push({ pathname: '/log/water', params: { date: today } })} testID="home-water" />
            <SmallTile icon="activity" label={day.data?.steps != null ? `${day.data.steps.toLocaleString()} steps` : 'Log steps'} onPress={() => router.push({ pathname: '/log/activity', params: { date: today } })} testID="home-steps" />
          </View>
        </View>
      )}

      <Card style={{ gap: space.md }} testID="home-workout">
        <Text variant="label" color="textMuted">
          {suggestion ? (suggestion.planned ? "Today's workout" : 'Rest day, optional') : 'Workouts'}
        </Text>
        {suggestion ? (
          <>
            <Text variant="heading">{suggestion.workout.name}</Text>
            <Text variant="small" color="textMuted">
              {suggestion.workout.minutes} min. {suggestion.workout.summary}
            </Text>
            <Button label={doneToday ? 'Done today. Open anyway' : 'Open workout'} variant={doneToday ? 'secondary' : 'primary'} onPress={() => router.push({ pathname: '/workouts/[id]', params: { id: suggestion.workout.id } })} testID="home-open-workout" />
          </>
        ) : (
          <>
            <Text color="textMuted">A weekly plan from your days, kit and goal. The day&apos;s session shows up here.</Text>
            <Button label="Build my plan" onPress={() => router.push('/workouts/plan')} testID="home-build-plan" />
          </>
        )}
      </Card>

      <Pressable accessibilityRole="button" accessibilityLabel="Your week in review" onPress={() => router.push('/review')} testID="home-review" style={({ pressed }) => [styles.reviewRow, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="trend" size={20} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Your week in review</Text>
          <Text variant="caption" color="textMuted">
            What went well and one thing to change
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={colors.textFaint} />
      </Pressable>

      <View style={styles.navGrid}>
        {SECTIONS.map((s) => (
          <Pressable key={s.href} accessibilityRole="button" accessibilityLabel={s.title} onPress={() => router.push(s.href as never)} testID={s.testID} style={({ pressed }) => [styles.nav, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
            <Icon name={s.icon} size={24} />
            <Text variant="small">{s.title}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function BigTile({ label, value, note, onPress, testID }: { label: string; value: string | null; note?: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? note ?? ''}`} onPress={onPress} testID={testID} style={({ pressed }) => [styles.big, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <Text variant="title" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 26, lineHeight: 32 }}>
        {value ?? 'Not yet'}
      </Text>
      {note ? (
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SmallTile({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} testID={testID} style={({ pressed }) => [styles.small, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  big: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.xs, minHeight: 104, justifyContent: 'center' },
  small: { flex: 1, minWidth: 0, minHeight: touch.min, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  nav: { flexBasis: '30%', flexGrow: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.lg, paddingVertical: space.lg, alignItems: 'center', gap: space.sm },
});

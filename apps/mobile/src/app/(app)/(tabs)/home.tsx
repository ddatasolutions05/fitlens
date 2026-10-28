import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatLocalDate, greetingFor, quoteForDate, suggestionsForDay, todayLocal } from '@fitlens/core';

import { useSession } from '@/features/auth/session';
import { useDay } from '@/features/day/hooks';
import { Avatar, initialsFor } from '@/features/profile/Avatar';
import { useProfile } from '@/features/profile/hooks';
import { useWeekSessions, useWeeklyPlan } from '@/features/workouts/hooks';
import { config } from '@/lib/config';
import { Button, Card, Icon, Screen, SkeletonCard, Stat, Text, radius, space, useTheme, type IconName } from '@/ui';

const SECTIONS: { href: string; icon: IconName; title: string; blurb: string; testID: string }[] = [
  { href: '/today', icon: 'today', title: 'Today', blurb: 'Calories, macros and what you logged', testID: 'nav-today' },
  { href: '/diary', icon: 'diary', title: 'Diary', blurb: 'Meals, weight and activity by day', testID: 'nav-diary' },
  { href: '/train', icon: 'dumbbell', title: 'Workouts', blurb: 'Your plan for the week', testID: 'nav-train' },
  { href: '/progress', icon: 'progress', title: 'Stats', blurb: 'Streaks, averages and the trend', testID: 'nav-progress' },
  { href: '/coach', icon: 'coach', title: 'Coach', blurb: 'Ask anything about your own logs', testID: 'nav-coach' },
  { href: '/profile', icon: 'profile', title: 'Profile', blurb: 'Targets, display and privacy', testID: 'nav-profile' },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const { session } = useSession();
  const profile = useProfile();
  const today = todayLocal();
  const day = useDay(today);
  const { plan, settings, configured } = useWeeklyPlan();
  const sessions = useWeekSessions(today);
  const suggestion = useMemo(() => (configured ? suggestionsForDay({ plan, localDate: today, settings })[0] ?? null : null), [configured, plan, settings, today]);
  const doneToday = (sessions.data ?? []).some((s) => s.localDate === today && s.workoutId === suggestion?.workout.id);

  const name = profile.data?.display_name?.trim() || null;
  const hideNumbers = profile.data?.hide_numbers ?? false;
  const totals = day.data?.totals?.totals ?? null;
  const target = profile.data?.mode === 'tracking_only' ? null : (day.data?.goal?.calorie_target ?? null);
  const kcal = totals?.kcal != null ? Math.round(totals.kcal / 10) * 10 : null;

  return (
    <Screen testID="home-screen">
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" color="textMuted">
            {formatLocalDate(today, 'long')}
          </Text>
          <Text variant="title" testID="greeting">
            {greetingFor(new Date().getHours())}
            {name ? `, ${name.split(' ')[0]}` : ''}
          </Text>
        </View>
        <Avatar path={profile.data?.avatar_path ?? null} initials={initialsFor(name, session?.user.email)} size={56} onPress={() => router.push('/profile')} testID="home-avatar" />
      </View>

      <Card tone="inverse" style={{ gap: space.sm }} testID="quote">
        <Text variant="label" style={{ color: colors.onInverse, opacity: 0.6 }}>
          Today&apos;s line
        </Text>
        <Text variant="heading" style={{ color: colors.onInverse, fontSize: 22, lineHeight: 29 }}>
          {quoteForDate(today)}
        </Text>
      </Card>

      {day.isLoading ? (
        <SkeletonCard lines={2} />
      ) : (
        <View style={styles.grid}>
          <Stat label="Eaten" value={hideNumbers ? (day.data?.meals.length ? `${day.data.meals.length} meals` : 'Nothing yet') : kcal != null ? `${kcal.toLocaleString()} kcal` : 'Nothing yet'} note={!hideNumbers && target ? `of ${target.toLocaleString()}` : undefined} style={styles.tile} testID="home-kcal" />
          <Stat label="Protein" value={totals?.protein_g != null ? `${Math.round(totals.protein_g)} g` : 'Not yet'} note={day.data?.goal?.protein_g ? `of ${day.data.goal.protein_g} g` : undefined} style={styles.tile} />
          <Stat label="Water" value={day.data?.waterMl ? `${day.data.waterMl.toLocaleString()} ml` : 'Not yet'} note={day.data?.goal?.water_ml ? `of ${day.data.goal.water_ml.toLocaleString()} ml` : undefined} style={styles.tile} />
          <Stat label="Steps" value={day.data?.steps != null ? day.data.steps.toLocaleString() : 'Not yet'} note={day.data?.goal?.step_goal ? `of ${day.data.goal.step_goal.toLocaleString()}` : undefined} style={styles.tile} />
        </View>
      )}

      <Card style={{ gap: space.md }} testID="home-workout">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon name="dumbbell" size={20} />
          <Text variant="label" color="textMuted">
            {suggestion ? (suggestion.planned ? "Today's workout" : 'Rest day, optional') : 'Workouts'}
          </Text>
        </View>
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
            <Text color="textMuted">A weekly plan built from your days, kit and goal. Suggested sessions show up here every day.</Text>
            <Button label="Build my plan" onPress={() => router.push('/workouts/plan')} testID="home-build-plan" />
          </>
        )}
      </Card>

      <View style={{ gap: space.sm }}>
        <Text variant="label" color="textMuted">
          Go to
        </Text>
        <View style={styles.grid}>
          {SECTIONS.map((s) => (
            <Pressable
              key={s.href}
              accessibilityRole="button"
              accessibilityLabel={s.title}
              onPress={() => router.push(s.href as never)}
              testID={s.testID}
              style={({ pressed }) => [styles.nav, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
            >
              <Icon name={s.icon} size={24} />
              <Text variant="bodyStrong">{s.title}</Text>
              <Text variant="caption" color="textMuted" numberOfLines={2}>
                {s.blurb}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text variant="caption" color="textFaint" align="center">
        {config.brandName}. {config.brandTagline}.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1, minWidth: 0 },
  nav: { flexBasis: '47%', flexGrow: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.xs, minHeight: 112 },
});

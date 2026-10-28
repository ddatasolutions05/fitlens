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
          <Tile
            label="Eaten"
            value={hideNumbers ? (day.data?.meals.length ? `${day.data.meals.length} meals` : null) : kcal != null ? `${kcal.toLocaleString()} kcal` : null}
            note={!hideNumbers && target ? `of ${target.toLocaleString()}` : undefined}
            empty="Tap to log a meal"
            onPress={() => router.push({ pathname: '/food/search', params: { date: today, fresh: '1' } })}
            testID="home-kcal"
          />
          <Tile label="Protein" value={totals?.protein_g != null ? `${Math.round(totals.protein_g)} g` : null} note={day.data?.goal?.protein_g ? `of ${day.data.goal.protein_g} g` : undefined} empty="Comes from your meals" onPress={() => router.push('/today')} testID="home-protein" />
          <Tile label="Water" value={day.data?.waterMl ? `${day.data.waterMl.toLocaleString()} ml` : null} note={day.data?.goal?.water_ml ? `of ${day.data.goal.water_ml.toLocaleString()} ml` : undefined} empty="Tap to add a glass" onPress={() => router.push({ pathname: '/log/water', params: { date: today } })} testID="home-water" />
          <Tile label="Steps" value={day.data?.steps != null ? day.data.steps.toLocaleString() : null} note={day.data?.goal?.step_goal ? `of ${day.data.goal.step_goal.toLocaleString()}` : undefined} empty="Tap to log today's steps" onPress={() => router.push({ pathname: '/log/activity', params: { date: today } })} testID="home-steps" />
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

function Tile({ label, value, note, empty, onPress, testID }: { label: string; value: string | null; note?: string; empty: string; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? empty}`} onPress={onPress} testID={testID} style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.85 : 1 }]}>
      <Stat label={label} value={value ?? 'Not yet'} note={value ? note : empty} style={{ minWidth: 0 }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1, minWidth: 0 },
  nav: { flexBasis: '47%', flexGrow: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.xs, minHeight: 112 },
});

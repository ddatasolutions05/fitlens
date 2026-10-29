import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { type UnitSystem, addDays, formatLocalDate, formatWater, greetingFor, quoteForDate, streakLabel, suggestionsForDay, todayLocal } from '@fitlens/core';

import { useSession } from '@/features/auth/session';
import { GREETING_KEYS, useT } from '@/lib/i18n';
import { useDay } from '@/features/day/hooks';
import { useLogDays } from '@/features/day/useLogDays';
import { FirstSteps, useFirstSteps } from '@/features/home/FirstSteps';
import { InstallCard } from '@/features/home/InstallCard';
import { ShareRow } from '@/features/home/ShareRow';
import { Avatar, initialsFor } from '@/features/profile/Avatar';
import { useProfile } from '@/features/profile/hooks';
import { useDismissTrainerNote, useLatestTrainerNote } from '@/features/trainer/notes';
import { useWeekSessions, useWeeklyPlan } from '@/features/workouts/hooks';
import { Button, Card, Icon, Screen, SkeletonCard, Text, radius, space, touch, useCountUp, useTheme, type IconName } from '@/ui';

const SECTIONS: { href: string; icon: IconName; title: string; testID: string }[] = [
  { href: '/today', icon: 'today', title: 'tab.today', testID: 'nav-today' },
  { href: '/diary', icon: 'diary', title: 'nav.diary', testID: 'nav-diary' },
  { href: '/train', icon: 'dumbbell', title: 'nav.workouts', testID: 'nav-train' },
  { href: '/progress', icon: 'progress', title: 'tab.stats', testID: 'nav-progress' },
  { href: '/coach', icon: 'coach', title: 'tab.coach', testID: 'nav-coach' },
  { href: '/profile', icon: 'profile', title: 'nav.profile', testID: 'nav-profile' },
];

export default function HomeScreen() {
  const t = useT();
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
  const unitSystem = (profile.data?.unit_system ?? 'metric') as UnitSystem;
  const totals = day.data?.totals?.totals ?? null;
  const target = profile.data?.mode === 'tracking_only' ? null : (day.data?.goal?.calorie_target ?? null);
  const kcalRaw = totals?.kcal != null ? Math.round(totals.kcal / 10) * 10 : null;
  const kcal = useCountUp(kcalRaw);
  const first = useFirstSteps();
  const trainerNote = useLatestTrainerNote();
  const dismissNote = useDismissTrainerNote();
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
            {t(GREETING_KEYS[greetingFor(new Date().getHours())] ?? 'greet.morning')}
            {name ? `, ${name.split(' ')[0]}` : ''}
          </Text>
          {streak ? (
            <Text variant="small" color="textMuted" testID="streak">
              {t('home.streak', { n: logDays.data?.streak ?? 0, label: streak })}. {t('home.keepGoing')}
            </Text>
          ) : null}
        </View>
        <Avatar path={profile.data?.avatar_path ?? null} initials={initialsFor(name, session?.user.email)} size={56} onPress={() => router.push('/profile')} testID="home-avatar" />
      </View>

      {first.show ? <FirstSteps steps={first.steps} done={first.done} /> : null}
      <InstallCard />

      {trainerNote.data ? (
        <Card style={{ gap: space.sm }} testID="trainer-note">
          <Text variant="label" color="textMuted">
            From your trainer
          </Text>
          <Text variant="heading" style={{ fontSize: 18, lineHeight: 25 }}>
            {trainerNote.data.note}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="caption" color="textFaint">
              {new Date(trainerNote.data.created_at).toLocaleDateString()}
            </Text>
            <Button label="Got it" variant="ghost" size="sm" onPress={() => dismissNote.mutate(trainerNote.data!.id)} />
          </View>
        </Card>
      ) : null}

      <Card tone={first.show ? 'surface' : 'inverse'} style={{ gap: space.md, paddingVertical: space.xl }} testID="quote">
        <Text variant="label" style={{ color: first.show ? colors.textMuted : colors.onInverse, opacity: first.show ? 1 : 0.6 }}>
          {t('home.line')}
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
            <BigTile label={t('home.eaten')} value={eaten} note={eaten && !hideNumbers && target ? `of ${target.toLocaleString()} kcal` : eaten ? undefined : (yesterday.data?.meals.length ?? 0) > 0 ? t('home.sameAsYesterday') : t('home.tapToLog')} onPress={() => (!eaten && (yesterday.data?.meals.length ?? 0) > 0 ? router.push('/today') : router.push({ pathname: '/food/search', params: { date: today, fresh: '1' } }))} testID="home-kcal" />
            <BigTile label={t('home.protein')} value={protein} note={protein && day.data?.goal?.protein_g ? `of ${day.data.goal.protein_g} g` : protein ? undefined : t('home.fromMeals')} onPress={() => router.push('/today')} testID="home-protein" />
          </View>
          <View style={styles.row}>
            <SmallTile icon="water" label={day.data?.waterMl ? `${formatWater(day.data.waterMl, unitSystem)} ${t('home.water')}` : t('home.addWater')} onPress={() => router.push({ pathname: '/log/water', params: { date: today } })} testID="home-water" />
            <SmallTile icon="activity" label={day.data?.steps != null ? `${day.data.steps.toLocaleString()} ${t('home.steps')}` : t('home.logSteps')} onPress={() => router.push({ pathname: '/log/activity', params: { date: today } })} testID="home-steps" />
          </View>
        </View>
      )}

      <Card style={{ gap: space.md }} testID="home-workout">
        <Text variant="label" color="textMuted">
          {suggestion ? (suggestion.planned ? t('home.todaysWorkout') : t('home.restDay')) : t('home.workouts')}
        </Text>
        {suggestion ? (
          <>
            <Text variant="heading">{suggestion.workout.name}</Text>
            <Text variant="small" color="textMuted">
              {suggestion.workout.minutes} min. {suggestion.workout.summary}
            </Text>
            <Button label={doneToday ? t('home.doneOpenAnyway') : t('home.openWorkout')} variant={doneToday ? 'secondary' : 'primary'} onPress={() => router.push({ pathname: '/workouts/[id]', params: { id: suggestion.workout.id } })} testID="home-open-workout" />
          </>
        ) : (
          <>
            <Text color="textMuted">{t('home.planBlurb')}</Text>
            <Button label={t('home.buildPlan')} onPress={() => router.push('/workouts/plan')} testID="home-build-plan" />
          </>
        )}
      </Card>

      <Pressable accessibilityRole="button" accessibilityLabel="Your week in review" onPress={() => router.push('/review')} testID="home-review" style={({ pressed }) => [styles.reviewRow, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="trend" size={20} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{t('home.review')}</Text>
          <Text variant="caption" color="textMuted">
            {t('home.reviewBody')}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={colors.textFaint} />
      </Pressable>

      <ShareRow name={name} userId={session?.user.id ?? ''} />

      <View style={styles.navGrid}>
        {SECTIONS.map((s) => (
          <Pressable key={s.href} accessibilityRole="button" accessibilityLabel={t(s.title)} onPress={() => router.push(s.href as never)} testID={s.testID} style={({ pressed }) => [styles.nav, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
            <Icon name={s.icon} size={24} />
            <Text variant="small">{t(s.title)}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function BigTile({ label, value, note, onPress, testID }: { label: string; value: string | null; note?: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? note ?? ''}`} onPress={onPress} testID={testID} style={({ pressed }) => [styles.big, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <Text variant="title" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 26, lineHeight: 32 }} maxFontSizeMultiplier={1.3}>
        {value ?? t('home.notYet')}
      </Text>
      {note ? (
        <Text variant="caption" color="textMuted" numberOfLines={1} maxFontSizeMultiplier={1.3}>
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
      <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }} maxFontSizeMultiplier={1.3}>
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

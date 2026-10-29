// The first minute after setup. Three things to do once, each ticked off from
// real data, shown until all are done or the account is two weeks old.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { daysBetween, todayLocal } from '@fitlens/core';

import { useUserId } from '@/features/auth/session';
import { useProfile } from '@/features/profile/hooks';
import { usePlanSettings } from '@/features/workouts/hooks';
import { supabase } from '@/lib/supabase';
import { useT } from '@/lib/i18n';
import { Card, Icon, Text, space, useTheme } from '@/ui';

export function useHasConfirmedMeal() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['first-steps', 'meal', userId],
    queryFn: async () => {
      const { count, error } = await supabase.from('meals').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'confirmed');
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

function useHasAskedCoach() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['first-steps', 'coach', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_usage').select('coach_calls').eq('user_id', userId).gt('coach_calls', 0).limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export interface FirstStep {
  key: 'meal' | 'plan' | 'coach';
  title: string;
  body: string;
  done: boolean;
  go: () => void;
  testID: string;
}

export function useFirstSteps(): { show: boolean; steps: FirstStep[]; done: number } {
  const t = useT();
  const profile = useProfile();
  const meal = useHasConfirmedMeal();
  const coach = useHasAskedCoach();
  const { configured } = usePlanSettings();
  const today = todayLocal();
  const completedAt = profile.data?.onboarding_completed_at ?? null;
  const ageDays = completedAt ? daysBetween(completedAt.slice(0, 10), today) : 0;
  const steps: FirstStep[] = [
    { key: 'meal', title: t('first.meal'), body: t('first.mealBody'), done: meal.data === true, go: () => router.push({ pathname: '/food/search', params: { date: today, fresh: '1' } }), testID: 'first-step-meal' },
    { key: 'plan', title: t('first.plan'), body: t('first.planBody'), done: configured, go: () => router.push('/workouts/plan'), testID: 'first-step-plan' },
    { key: 'coach', title: t('first.coach'), body: t('first.coachBody'), done: coach.data === true, go: () => router.push('/coach'), testID: 'first-step-coach' },
  ];
  const done = steps.filter((s) => s.done).length;
  const loaded = !meal.isLoading && !coach.isLoading && !profile.isLoading;
  return { show: loaded && done < steps.length && ageDays <= 14, steps, done };
}

export function FirstSteps({ steps, done }: { steps: FirstStep[]; done: number }) {
  const t = useT();
  const { colors } = useTheme();
  const fg = colors.onInverse;
  return (
    <Card tone="inverse" style={{ gap: space.md }} testID="first-steps">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="label" style={{ color: fg, opacity: 0.6 }}>
          {t('first.title')}
        </Text>
        <Text variant="caption" style={{ color: fg, opacity: 0.6 }}>
          {done} of {steps.length}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        {steps.map((s, i) => (
          <Pressable
            key={s.key}
            accessibilityRole="button"
            accessibilityLabel={`${s.title}${s.done ? ', done' : ''}`}
            onPress={s.go}
            testID={s.testID}
            style={({ pressed }) => [styles.step, { borderTopColor: colors.inverseLine, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={[styles.mark, { borderColor: fg, backgroundColor: s.done ? fg : 'transparent' }]}>{s.done ? <Icon name="check" size={14} color={colors.inverse} strokeWidth={2.6} /> : null}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" style={{ color: fg, textDecorationLine: s.done ? 'line-through' : 'none', opacity: s.done ? 0.6 : 1 }}>
                {s.title}
              </Text>
              {!s.done ? (
                <Text variant="small" style={{ color: fg, opacity: 0.75 }}>
                  {s.body}
                </Text>
              ) : null}
            </View>
            {!s.done ? <Icon name="chevronRight" size={18} color={fg} /> : null}
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 56 },
  mark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});

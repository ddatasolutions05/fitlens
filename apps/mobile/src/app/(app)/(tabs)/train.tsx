import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WEEKDAYS, availableWorkouts, planMinutesPerWeek, suggestionsForDay, todayLocal, weekdayOf, workoutById, type Workout } from '@fitlens/core';

import { useWeekSessions, useWeeklyPlan, weekRange } from '@/features/workouts/hooks';
import { Button, Card, Icon, Screen, SkeletonCard, Text, radius, space, useTheme } from '@/ui';

export default function TrainScreen() {
  const { colors } = useTheme();
  const today = todayLocal();
  const { plan, settings, configured, isLoading } = useWeeklyPlan();
  const sessions = useWeekSessions(today);
  const suggestions = useMemo(() => (configured ? suggestionsForDay({ plan, localDate: today, settings }) : []), [configured, plan, settings, today]);
  const library = useMemo(() => availableWorkouts({ equipment: settings.equipment, level: settings.level }), [settings.equipment, settings.level]);
  const { from } = weekRange(today);
  const todayWeekday = weekdayOf(today);
  const doneOn = (weekday: number) => (sessions.data ?? []).filter((s) => weekdayOf(s.localDate) === weekday);

  const open = (w: Workout) => router.push({ pathname: '/workouts/[id]', params: { id: w.id } });

  return (
    <Screen testID="train-screen">
      <View style={{ gap: 2, marginTop: space.sm }}>
        <Text variant="title">Train</Text>
        <Text color="textMuted">
          {configured ? `${settings.daysPerWeek} days a week, about ${planMinutesPerWeek(plan)} minutes in total. Sessions you log count toward your activity.` : 'A weekly plan from your days, kit and goal. Every session logs as activity with one tap.'}
        </Text>
      </View>

      {isLoading ? (
        <SkeletonCard lines={3} />
      ) : !configured ? (
        <Card tone="inverse" style={{ gap: space.md }}>
          <Text variant="heading" style={{ color: colors.onInverse }}>
            Build your plan
          </Text>
          <Text style={{ color: colors.onInverse }}>Pick how many days, how long, what you train with and what you are after. The week fills itself.</Text>
          <Button label="Build my plan" variant="secondary" onPress={() => router.push('/workouts/plan')} testID="build-plan" />
        </Card>
      ) : (
        <>
          <View style={{ gap: space.sm }}>
            <Text variant="label" color="textMuted">
              Today
            </Text>
            {suggestions.map((s) => {
              const done = doneOn(todayWeekday).some((x) => x.workoutId === s.workout.id);
              return (
                <Pressable key={s.workout.id} accessibilityRole="button" onPress={() => open(s.workout)} testID={`suggestion-${s.workout.id}`} style={({ pressed }) => [styles.row, { backgroundColor: s.planned ? colors.inverse : colors.surface, borderColor: s.planned ? colors.inverse : colors.border, opacity: pressed ? 0.85 : 1 }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" style={{ color: s.planned ? colors.onInverse : colors.textMuted, opacity: s.planned ? 0.6 : 1 }}>
                      {s.planned ? 'Planned' : 'Optional'}
                      {done ? ', done' : ''}
                    </Text>
                    <Text variant="heading" style={{ color: s.planned ? colors.onInverse : colors.text }}>
                      {s.workout.name}
                    </Text>
                    <Text variant="small" style={{ color: s.planned ? colors.onInverse : colors.textMuted }}>
                      {s.workout.minutes} min. {s.workout.summary}
                    </Text>
                  </View>
                  <Icon name={done ? 'check' : 'chevronRight'} color={s.planned ? colors.onInverse : colors.textMuted} />
                </Pressable>
              );
            })}
          </View>

          <Card style={{ gap: 0 }} testID="plan-week">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
              <Text variant="label" color="textMuted">
                This week
              </Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/workouts/plan')} testID="change-plan" style={{ minHeight: 32, justifyContent: 'center' }}>
                <Text variant="label">Change plan</Text>
              </Pressable>
            </View>
            {plan.map((d) => {
              const w = d.workoutId ? workoutById(d.workoutId) : null;
              const done = doneOn(d.weekday);
              const isToday = d.weekday === todayWeekday;
              return (
                <Pressable
                  key={d.weekday}
                  accessibilityRole={w ? 'button' : 'text'}
                  onPress={w ? () => open(w) : undefined}
                  testID={`week-${d.weekday}`}
                  style={[styles.weekRow, { borderTopColor: colors.border, borderTopWidth: d.weekday === 0 ? 0 : StyleSheet.hairlineWidth }]}
                >
                  <Text variant={isToday ? 'bodyStrong' : 'body'} style={{ width: 44 }} color={isToday ? 'text' : 'textMuted'}>
                    {WEEKDAYS[d.weekday]!.slice(0, 3)}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text variant={w ? 'bodyStrong' : 'body'} color={w ? 'text' : 'textFaint'}>
                      {w ? w.name : 'Rest'}
                    </Text>
                    {w ? (
                      <Text variant="caption" color="textMuted">
                        {w.minutes} min
                      </Text>
                    ) : null}
                  </View>
                  {done.length > 0 ? <Icon name="check" size={18} /> : w ? <Icon name="chevronRight" size={18} color={colors.textFaint} /> : null}
                </Pressable>
              );
            })}
            <Text variant="caption" color="textFaint" style={{ marginTop: space.sm }}>
              Week of {from}. Ticks are sessions you logged from a workout page.
            </Text>
          </Card>
        </>
      )}

      <View style={{ gap: space.sm }}>
        <Text variant="label" color="textMuted">
          {configured ? 'All workouts you can do' : 'Workout library'}
        </Text>
        {library.map((w) => (
          <Pressable key={w.id} accessibilityRole="button" onPress={() => open(w)} testID={`library-${w.id}`} style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{w.name}</Text>
              <Text variant="caption" color="textMuted">
                {w.minutes} min, {w.level}, {w.equipment.map((e) => e.replace('bodyweight', 'no kit')).join(' or ')}
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textFaint} />
          </Pressable>
        ))}
        {configured && library.length < 8 ? (
          <Text variant="caption" color="textFaint">
            More workouts unlock as you add equipment or raise your level in the plan settings.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: 48 },
});

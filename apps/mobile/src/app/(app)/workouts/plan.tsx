import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EQUIPMENT, FOCUS_OPTIONS, LEVELS, WEEKDAYS, buildWeeklyPlan, planMinutesPerWeek, workoutById, type Equipment, type Focus, type Level } from '@fitlens/core';

import { usePlanSettings, useSavePlanSettings } from '@/features/workouts/hooks';
import { goBack } from '@/lib/nav';
import { errorMessage } from '@/lib/net';
import { Button, Card, Chips, Note, NumberField, PageHeader, Screen, Segmented, Text, space, useTheme } from '@/ui';

const DAY_OPTIONS = ['1', '2', '3', '4', '5', '6', '7'].map((n) => ({ value: n, label: n }));

export default function PlanScreen() {
  const { colors } = useTheme();
  const { settings, configured, isLoading } = usePlanSettings();
  const save = useSavePlanSettings();
  const [days, setDays] = useState(settings.daysPerWeek);
  const [minutes, setMinutes] = useState<number | null>(settings.minutes);
  const [level, setLevel] = useState<Level>(settings.level);
  const [focus, setFocus] = useState<Focus>(settings.focus);
  const [equipment, setEquipment] = useState<Equipment[]>(settings.equipment);
  const [seed, setSeed] = useState(settings.seed);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => buildWeeklyPlan({ daysPerWeek: days, minutes: minutes ?? 40, level, focus, equipment, seed }), [days, minutes, level, focus, equipment, seed]);
  const labels = EQUIPMENT.filter((e) => e.key !== 'bodyweight').map((e) => e.label);
  const selectedLabels = EQUIPMENT.filter((e) => equipment.includes(e.key)).map((e) => e.label);

  async function onSave() {
    if (!minutes || minutes < 10 || minutes > 180) {
      setError('Session length must be between 10 and 180 minutes.');
      return;
    }
    setError(null);
    try {
      await save.save({ daysPerWeek: days, minutes, level, focus, equipment, seed });
      goBack('/train');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen testID="plan-screen">
      <PageHeader title={configured ? 'Change plan' : 'Build your plan'} subtitle="The week is built from these answers. Change them any time." backTo="/train" />
      {isLoading ? null : (
        <>
          <Segmented<string> label="Days a week" value={String(days)} onChange={(v) => setDays(Number(v))} options={DAY_OPTIONS} />
          <NumberField label="Minutes per session" value={minutes} onChangeNumber={setMinutes} decimals={0} testID="plan-minutes" />
          <Segmented<Level> label="Experience" wrap value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l.key, label: l.label }))} />
          <Text variant="caption" color="textFaint">
            {LEVELS.find((l) => l.key === level)?.hint}
          </Text>
          <Segmented<Focus> label="What you are after" wrap value={focus} onChange={setFocus} options={FOCUS_OPTIONS.map((f) => ({ value: f.key, label: f.label }))} />
          <Text variant="caption" color="textFaint">
            {FOCUS_OPTIONS.find((f) => f.key === focus)?.hint}
          </Text>
          <Chips label="Equipment you have (bodyweight is always included)" options={labels} value={selectedLabels} onChange={(v) => setEquipment(EQUIPMENT.filter((e) => v.includes(e.label)).map((e) => e.key))} />

          <Card style={{ gap: 0 }} testID="plan-preview">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
              <Text variant="label" color="textMuted">
                Your week, about {planMinutesPerWeek(preview)} min
              </Text>
              <Button label="Shuffle" variant="ghost" size="sm" onPress={() => setSeed((s) => s + 1)} testID="plan-shuffle" />
            </View>
            {preview.map((d) => {
              const w = d.workoutId ? workoutById(d.workoutId) : null;
              return (
                <View key={d.weekday} style={[styles.row, { borderTopColor: colors.border, borderTopWidth: d.weekday === 0 ? 0 : StyleSheet.hairlineWidth }]}>
                  <Text color="textMuted" style={{ width: 44 }}>
                    {WEEKDAYS[d.weekday]!.slice(0, 3)}
                  </Text>
                  <Text variant={w ? 'bodyStrong' : 'body'} color={w ? 'text' : 'textFaint'} style={{ flex: 1 }}>
                    {w ? `${w.name}, ${w.minutes} min` : 'Rest'}
                  </Text>
                </View>
              );
            })}
          </Card>

          <Note>Rest days matter as much as training days. If a week goes sideways, do the next session on the list rather than doubling up.</Note>
          {error ? (
            <Text color="danger" variant="small">
              {error}
            </Text>
          ) : null}
          <Button label={configured ? 'Save plan' : 'Start this plan'} size="lg" onPress={() => void onSave()} loading={save.isPending} testID="plan-save" />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: 40 },
});

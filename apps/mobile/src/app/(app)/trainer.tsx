import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatWeight, type UnitSystem } from '@fitlens/core';

import { useProfile } from '@/features/profile/hooks';
import { useMakeTrainerCode, useTrainerCode, useTrainerMembers } from '@/features/trainer/hooks';
import { useSendTrainerNote } from '@/features/trainer/notes';
import { errorMessage } from '@/lib/net';
import { Button, Card, EmptyState, ErrorState, Input, Note, PageHeader, Screen, Segmented, SkeletonCard, Text, radius, space, toast, useTheme } from '@/ui';

export default function TrainerScreen() {
  const { colors } = useTheme();
  const profile = useProfile();
  const code = useTrainerCode();
  const makeCode = useMakeTrainerCode();
  const [days, setDays] = useState<'7' | '14' | '30'>('7');
  const members = useTrainerMembers(Number(days));
  const unitSystem = (profile.data?.unit_system ?? 'metric') as UnitSystem;

  return (
    <Screen testID="trainer-screen">
      <PageHeader title="Trainer view" subtitle="Members who entered your code share a weekly summary: days logged, calories, protein, workouts and weight. Never their meals or photos." backTo="/profile" />

      <Card tone="inverse" style={{ gap: space.md }} testID="trainer-code-card">
        <Text variant="label" style={{ color: colors.onInverse, opacity: 0.6 }}>
          Your code
        </Text>
        {code.isLoading ? null : code.data ? (
          <>
            <Text variant="display" tabular style={{ color: colors.onInverse, fontSize: 44, lineHeight: 50, letterSpacing: 6 }} testID="trainer-code">
              {code.data.code}
            </Text>
            <Text variant="small" style={{ color: colors.onInverse }}>
              Members enter it under Profile, Your trainer. Valid until {new Date(code.data.expires_at).toLocaleDateString()}.
            </Text>
          </>
        ) : (
          <Text style={{ color: colors.onInverse }}>Make a code and give it to the people you coach.</Text>
        )}
        <Button label={code.data ? 'New code' : 'Make a code'} variant="secondary" onPress={() => makeCode.mutate()} loading={makeCode.isPending} testID="trainer-make-code" />
        {makeCode.isError ? (
          <Text variant="small" style={{ color: colors.onInverse }}>
            {errorMessage(makeCode.error)}
          </Text>
        ) : null}
      </Card>

      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="label" color="textMuted">
            Members
          </Text>
          <View style={{ width: 190 }}>
            <Segmented<'7' | '14' | '30'> value={days} onChange={setDays} options={[{ value: '7', label: '7 d' }, { value: '14', label: '14 d' }, { value: '30', label: '30 d' }]} />
          </View>
        </View>
        {members.isLoading ? (
          <SkeletonCard lines={3} />
        ) : members.isError ? (
          <ErrorState message={errorMessage(members.error)} onRetry={() => members.refetch()} />
        ) : !members.data?.length ? (
          <EmptyState title="No members yet" body="When someone enters your code, their summary appears here." />
        ) : (
          members.data.map((m) => {
            const change = m.weight_first != null && m.weight_last != null ? Number(m.weight_last) - Number(m.weight_first) : null;
            return (
              <Card key={m.member_user_id} style={{ gap: space.md }} testID={`member-${m.member_user_id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text variant="heading">{m.display_name}</Text>
                  <Text variant="caption" color="textFaint">
                    {m.last_log_date ? `Last log ${m.last_log_date}` : 'No logs yet'}
                  </Text>
                </View>
                <View style={styles.grid}>
                  <Fact label="Days logged" value={`${m.days_logged} of ${days}`} />
                  <Fact label="Meals" value={String(m.meals)} />
                  <Fact label="Avg calories" value={m.avg_kcal != null ? `${m.avg_kcal.toLocaleString()}${m.calorie_target ? ` of ${m.calorie_target.toLocaleString()}` : ''}` : 'No data'} />
                  <Fact label="Avg protein" value={m.avg_protein_g != null ? `${m.avg_protein_g} g${m.protein_target_g ? ` of ${m.protein_target_g}` : ''}` : 'No data'} />
                  <Fact label="Workouts" value={m.workouts ? `${m.workouts}, ${m.workout_minutes} min` : 'None'} />
                  <Fact label="Weight" value={m.weight_last != null ? `${formatWeight(Number(m.weight_last), unitSystem)}${change != null && Math.abs(change) >= 0.05 ? ` (${change > 0 ? '+' : ''}${change.toFixed(1)} kg)` : ''}` : 'No weigh-in'} />
                </View>
                <NoteBox memberUserId={m.member_user_id} name={m.display_name} />
              </Card>
            );
          })
        )}
      </View>
      <Note>Members can stop sharing at any time from their Profile. Summaries are calculated when you open this screen and are never stored.</Note>
    </Screen>
  );
}

function NoteBox({ memberUserId, name }: { memberUserId: string; name: string }) {
  const send = useSendTrainerNote();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setError(null);
    try {
      await send.mutateAsync({ memberUserId, note });
      setNote('');
      toast(`Note sent to ${name}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <View style={{ gap: space.sm }}>
      <Input label="One line for them, shown on their Home" value={note} onChangeText={setNote} placeholder="Great week. Keep the walks going." maxLength={300} testID={`note-${memberUserId}`} />
      {error ? (
        <Text color="danger" variant="small">
          {error}
        </Text>
      ) : null}
      <Button label="Send note" variant="secondary" size="sm" onPress={() => void submit()} loading={send.isPending} disabled={note.trim().length === 0} testID={`send-note-${memberUserId}`} />
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fact, { borderColor: colors.border }]}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fact: { flexBasis: '47%', flexGrow: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
});

import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { TrainerCodeError, useLinkTrainer, useMyTrainers, useRevokeTrainer } from '@/features/trainer/hooks';
import { errorMessage } from '@/lib/net';
import { Button, Card, Input, Note, PageHeader, Row, Screen, SkeletonCard, Text, space, toast } from '@/ui';

export default function YourTrainerScreen() {
  const trainers = useMyTrainers();
  const link = useLinkTrainer();
  const revoke = useRevokeTrainer();
  const [code, setCode] = useState('');
  const [linkedTo, setLinkedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = (trainers.data ?? []).filter((t) => t.status === 'active');

  async function submit() {
    setError(null);
    setLinkedTo(null);
    try {
      const name = await link.mutateAsync(code);
      setLinkedTo(name);
      setCode('');
      toast(`Sharing with ${name}`);
    } catch (err) {
      setError(err instanceof TrainerCodeError ? err.message : errorMessage(err));
    }
  }

  return (
    <Screen testID="your-trainer-screen">
      <PageHeader title="Your trainer" subtitle="Share a weekly summary with a coach: days logged, calories, protein, workouts and weight. Never your meals, photos or notes." backTo="/profile" />
      <Card style={{ gap: space.md }}>
        <Text variant="heading">Enter a trainer code</Text>
        <Input label="Six characters" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="A1B2C3" testID="trainer-code-input" />
        {error ? (
          <Text color="danger" variant="small" testID="trainer-link-error">
            {error}
          </Text>
        ) : null}
        {linkedTo ? <Text testID="trainer-linked">Linked. {linkedTo} can now see your weekly summary.</Text> : null}
        <Button label="Share with this trainer" onPress={() => void submit()} loading={link.isPending} disabled={code.trim().length < 6} testID="trainer-link" />
      </Card>

      <View style={{ gap: space.sm }}>
        <Text variant="label" color="textMuted">
          Sharing with
        </Text>
        {trainers.isLoading ? (
          <SkeletonCard lines={2} />
        ) : active.length === 0 ? (
          <Text color="textMuted">Nobody yet. Only people with a code you entered can see anything.</Text>
        ) : (
          <Card style={{ gap: 0 }}>
            {active.map((t, i) => (
              <Row key={t.id} title={t.trainer_name ?? 'Your trainer'} subtitle={`Since ${new Date(t.created_at).toLocaleDateString()}`} divider={i < active.length - 1} right={<Button label="Stop" variant="ghost" size="sm" onPress={() => revoke.mutate(t.id)} />} />
            ))}
          </Card>
        )}
      </View>
      <Note>Are you a coach? Make your own code under Profile, Trainer view, and hand it to the people you train.</Note>
      <Button label="Open trainer view" variant="secondary" onPress={() => router.push('/trainer')} testID="open-trainer-view" />
    </Screen>
  );
}

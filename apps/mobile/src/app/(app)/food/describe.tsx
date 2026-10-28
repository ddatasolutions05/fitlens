import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { todayLocal } from '@fitlens/core';

import { useUserId } from '@/features/auth/session';
import { addItem, ensureDraft } from '@/features/meals/draft-store';
import { AnalyzeError, mapAnalysisToItems } from '@/features/photo/analyze';
import { describeMeal, speechRecognizer } from '@/features/photo/describe';
import { usePreferences } from '@/features/profile/hooks';
import { useFeatures } from '@/features/sync/useFeatures';
import { errorMessage } from '@/lib/net';
import { reportError, track } from '@/lib/telemetry';
import { Button, Card, Input, Note, NotConfigured, PageHeader, Screen, Skeleton, Text, space } from '@/ui';

const EXAMPLES = ['Two eggs, two slices of toast with butter and a coffee with milk', 'A bowl of dal, two rotis and some salad', 'Chicken breast with rice and a cup of broccoli'];

export default function DescribeScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const localDate = params.date ?? todayLocal();
  const userId = useUserId();
  const prefs = usePreferences();
  const features = useFeatures();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leftOut, setLeftOut] = useState<string[]>([]);
  const recognizer = useRef<ReturnType<typeof speechRecognizer>>(null);
  const [canListen] = useState(() => speechRecognizer() != null);
  const consent = Boolean(prefs.data?.ai_photo_consent_at);
  const vision = features.data?.vision ?? null;

  useEffect(() => () => recognizer.current?.stop(), []);

  function listen() {
    const r = speechRecognizer();
    if (!r) return;
    recognizer.current = r;
    setError(null);
    setListening(true);
    r.onresult = (e) => {
      const heard = Array.from(e.results, (alt) => alt[0]?.transcript ?? '').join(' ').trim();
      if (heard) setText((t) => (t ? `${t}, ${heard}` : heard));
    };
    r.onerror = (e) => {
      setListening(false);
      setError(e.error === 'not-allowed' ? 'Microphone access was denied. Type it instead.' : 'Could not hear that. Try again or type it.');
    };
    r.onend = () => setListening(false);
    r.start();
  }

  async function workOut() {
    setBusy(true);
    setError(null);
    setLeftOut([]);
    try {
      const result = await describeMeal(text.trim());
      track('describe_meal', { chars: text.trim().length });
      const mapped = await mapAnalysisToItems(result, [], userId);
      ensureDraft({ localDate, source: 'manual' });
      mapped.items.forEach(addItem);
      const missing = [...mapped.unmatched, ...mapped.packaged.map((p) => p.name)];
      if (mapped.items.length === 0) {
        setLeftOut(missing);
        setError('Nothing in that matched the food database. Try naming the dishes more plainly, or search for them.');
        return;
      }
      setLeftOut(missing);
      router.replace('/meal/edit');
    } catch (err) {
      if (!(err instanceof AnalyzeError) || !['consent_required', 'rate_limited', 'not_configured'].includes(err.code)) reportError('describe.workout', err);
      setError(
        err instanceof AnalyzeError && err.code === 'consent_required'
          ? 'This needs AI consent. Turn it on under Profile, Diet and AI consent.'
          : err instanceof AnalyzeError && err.code === 'rate_limited'
            ? 'You have reached the daily limit for AI help. Search or type the foods instead.'
            : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen testID="describe-screen">
      <PageHeader title="Describe it" subtitle="In your own words, like you would tell a friend. The foods and amounts are matched to the database and stay editable." backTo="/food/search" />
      {vision && !vision.configured ? <NotConfigured feature="AI help" reason={vision.reason ?? 'The AI provider is not configured.'} /> : null}
      {!prefs.isLoading && !consent ? (
        <Card tone="alt" style={{ gap: space.sm }}>
          <Text variant="bodyStrong">AI features are off</Text>
          <Text variant="small" color="textMuted">
            Describing a meal sends your words to the AI provider. Allow it under Profile, Diet and AI consent.
          </Text>
          <Button label="Review consent" variant="secondary" size="sm" onPress={() => router.push('/profile/privacy')} />
        </Card>
      ) : null}
      <Input label="What did you eat?" value={text} onChangeText={setText} multiline numberOfLines={4} placeholder={EXAMPLES[0]} style={{ minHeight: 96, textAlignVertical: 'top' }} testID="describe-text" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {canListen ? <Button label={listening ? 'Listening' : 'Say it'} variant="secondary" style={{ flex: 1 }} onPress={listen} disabled={listening} testID="describe-listen" /> : null}
        <Button label="Work it out" style={{ flex: 2 }} onPress={() => void workOut()} loading={busy} disabled={text.trim().length < 3 || !consent} testID="describe-go" />
      </View>
      {busy ? (
        <Card style={{ gap: space.sm }}>
          <Text variant="bodyStrong">Matching to the food database</Text>
          <Skeleton />
        </Card>
      ) : null}
      {error ? (
        <Text color="danger" variant="small" testID="describe-error">
          {error}
        </Text>
      ) : null}
      {leftOut.length > 0 ? (
        <Note label="Not matched">{`${leftOut.join(', ')}. Add these with search or by hand.`}</Note>
      ) : (
        <Note label="Examples">{EXAMPLES.slice(1).join(' / ')}</Note>
      )}
    </Screen>
  );
}

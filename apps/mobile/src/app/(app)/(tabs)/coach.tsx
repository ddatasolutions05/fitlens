import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CoachAction } from '@fitlens/schemas';

import { askCoach, CoachError, coachErrorMessage } from '@/features/coach/api';
import { appendMessage, clearConversation, loadConversation, useConversation, type CoachMessage } from '@/features/coach/store';
import { useSelectedDate } from '@/features/day/selected-date';
import { usePreferences } from '@/features/profile/hooks';
import { useFeatures } from '@/features/sync/useFeatures';
import { reportError } from '@/lib/telemetry';
import { Button, Card, Icon, NotConfigured, Text, fonts, layout, radius, space, touch, useTheme } from '@/ui';

const SUGGESTIONS = ['What should I eat for dinner?', 'How do I reach my protein today?', 'How consistent was this week?', 'Is my weight trend on track?'];

export default function CoachScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const features = useFeatures();
  const prefs = usePreferences();
  const [localDate] = useSelectedDate();
  const messages = useConversation();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    void loadConversation();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length, busy]);

  const configured = features.data?.coach.configured ?? false;
  const consent = Boolean(prefs.data?.ai_photo_consent_at);
  const canAsk = configured && consent && !busy;

  async function ask(question: string) {
    const q = question.trim();
    if (!q || !canAsk) return;
    setError(null);
    setDraft('');
    const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }));
    appendMessage({ role: 'user', text: q });
    setBusy(true);
    try {
      const res = await askCoach({ question: q, history, local_date: localDate });
      appendMessage({ role: 'coach', text: res.reply.answer, actions: res.reply.actions, groundedOn: res.reply.grounded_on });
      setUsage({ used: res.usage.coach_calls_today, limit: res.usage.daily_limit });
    } catch (err) {
      if (!(err instanceof CoachError) || !['consent_required', 'rate_limited', 'not_configured'].includes(err.code)) reportError('coach.ask', err);
      setError(coachErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scroll}
        testID="coach-screen"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: space.lg, paddingHorizontal: layout.gutter }}
      >
        <View style={styles.column}>
          <View style={{ gap: space.xs }}>
            <Text variant="title">Coach</Text>
            <Text variant="small" color="textMuted">
              Answers come from your own logs, the last 14 days. Nothing leaves the app until you ask a question, and any action it suggests waits for your tap.
            </Text>
          </View>

          {features.isLoading ? null : !configured ? (
            <NotConfigured feature="Coach" reason={features.data?.coach.reason ?? 'Needs the same LLM credentials as photo analysis.'} />
          ) : !consent ? (
            <Card style={{ gap: space.md }}>
              <Text variant="heading">Consent needed</Text>
              <Text color="textMuted">
                The coach sends a summary of your logs (meals, totals, activity and weight trend, never photos) to the AI provider for each question. Turn on AI consent to use it.
              </Text>
              <Button label="Open AI consent" variant="secondary" onPress={() => router.push('/profile/privacy')} />
            </Card>
          ) : null}

          {messages.length === 0 ? (
            <View style={{ gap: space.sm }}>
              <Text variant="label" color="textMuted">
                Try asking
              </Text>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  onPress={() => void ask(s)}
                  disabled={!canAsk}
                  style={({ pressed }) => [styles.suggestion, { borderColor: colors.border, opacity: !canAsk ? 0.5 : pressed ? 0.8 : 1 }]}
                  testID="coach-suggestion"
                >
                  <Text>{s}</Text>
                  <Icon name="chevronRight" size={18} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{ gap: space.md }}>
              {messages.map((m) => (
                <Bubble key={m.id} message={m} localDate={localDate} />
              ))}
              {busy ? (
                <View style={[styles.coachBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text color="textMuted">Reading your logs</Text>
                </View>
              ) : null}
            </View>
          )}

          {error ? (
            <Card tone="alt">
              <Text color="danger" variant="small" testID="coach-error">
                {error}
              </Text>
            </Card>
          ) : null}

          {messages.length > 0 ? (
            <View style={styles.footerRow}>
              <Text variant="caption" color="textFaint">
                {usage ? `${usage.used} of ${usage.limit} questions used today` : ''}
              </Text>
              <Button label="Clear" variant="ghost" size="sm" onPress={clearConversation} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.bg, paddingBottom: space.sm }]}>
        <View style={[styles.column, styles.inputRow]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={configured ? 'Ask about today, this week, or what to eat next' : 'Coach not configured'}
            placeholderTextColor={colors.textFaint}
            editable={canAsk}
            multiline
            maxLength={500}
            onSubmitEditing={() => void ask(draft)}
            blurOnSubmit
            returnKeyType="send"
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            testID="coach-input"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={() => void ask(draft)}
            disabled={!canAsk || !draft.trim()}
            style={({ pressed }) => [styles.send, { backgroundColor: colors.inverse, opacity: !canAsk || !draft.trim() ? 0.4 : pressed ? 0.8 : 1 }]}
            testID="coach-send"
          >
            <Icon name="send" size={20} color={colors.onInverse} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, localDate }: { message: CoachMessage; localDate: string }) {
  const { colors } = useTheme();
  if (message.role === 'user') {
    return (
      <View style={[styles.userBubble, { backgroundColor: colors.inverse }]}>
        <Text style={{ color: colors.onInverse }}>{message.text}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.coachBubble, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="coach-reply">
      <Text>{message.text}</Text>
      {message.groundedOn && message.groundedOn.length > 0 ? (
        <Text variant="caption" color="textFaint">
          Based on: {message.groundedOn.join('; ')}
        </Text>
      ) : null}
      {message.actions && message.actions.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {message.actions.map((a, i) => (
            <Button key={`${a.kind}-${i}`} label={a.label} variant="secondary" size="sm" onPress={() => runAction(a, localDate)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function runAction(a: CoachAction, localDate: string) {
  switch (a.kind) {
    case 'search_food':
      router.push({ pathname: '/food/search', params: { date: localDate, fresh: '1', ...(a.query ? { q: a.query } : {}) } });
      return;
    case 'log_water':
      router.push({ pathname: '/log/water', params: { date: localDate } });
      return;
    case 'log_weight':
      router.push({ pathname: '/log/weight', params: { date: localDate } });
      return;
    case 'log_activity':
      router.push({ pathname: '/log/activity', params: { date: localDate } });
      return;
    case 'open_targets':
      router.push('/profile/targets');
  }
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', gap: space.lg },
  suggestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: touch.min + 4 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '85%', borderRadius: radius.lg, borderBottomRightRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm + 2 },
  coachBubble: { alignSelf: 'flex-start', maxWidth: '92%', borderRadius: radius.lg, borderBottomLeftRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: space.sm },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm, paddingHorizontal: layout.gutter },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: { flex: 1, minHeight: touch.min + 4, maxHeight: 120, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm + 2, fontSize: 16, fontFamily: fonts.regular, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  send: { width: touch.min + 4, height: touch.min + 4, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});

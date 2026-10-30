// Small cards that earn their place on Home for a day or two: yesterday with
// nothing logged, and the release note after an update.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formatLocalDate } from '@fitlens/core';

import { LATEST_CHANGELOG } from '@/lib/changelog';
import { track } from '@/lib/telemetry';
import { Button, Card, Text, space } from '@/ui';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // nothing to remember it in
  }
}

export function YesterdayNudge({ yesterday, mealCount, onboardedOn }: { yesterday: string; mealCount: number | null; onboardedOn: string | null }) {
  const key = `fitlens.ynudge.${yesterday}`;
  const [hidden, setHidden] = useState(() => read(key) != null);
  if (hidden || mealCount == null || mealCount > 0) return null;
  if (!onboardedOn || onboardedOn >= yesterday) return null;
  const dismiss = () => {
    write(key, '1');
    setHidden(true);
  };
  return (
    <Card style={{ gap: space.md }} testID="yesterday-nudge">
      <Text variant="bodyStrong">{formatLocalDate(yesterday, 'relative')} has nothing logged</Text>
      <Text variant="small" color="textMuted">
        A rough entry keeps the trend honest. Search, type it, or copy a similar day.
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          label="Log yesterday"
          style={{ flex: 1 }}
          onPress={() => {
            track('yesterday_nudge_log');
            dismiss();
            router.push({ pathname: '/food/search', params: { date: yesterday, fresh: '1' } });
          }}
          testID="yesterday-log"
        />
        <Button label="Nothing to add" variant="ghost" style={{ flex: 1 }} onPress={dismiss} testID="yesterday-skip" />
      </View>
    </Card>
  );
}

export function WhatsNewCard() {
  const entry = LATEST_CHANGELOG;
  const [hidden, setHidden] = useState(() => !entry || read('fitlens.whatsnew') === entry.key);
  if (hidden || !entry) return null;
  return (
    <Card style={{ gap: space.sm }} testID="whats-new">
      <Text variant="bodyStrong">{entry.title}</Text>
      <View style={{ gap: 4 }}>
        {entry.items.map((it) => (
          <Text key={it} variant="small" color="textMuted">
            {it}
          </Text>
        ))}
      </View>
      <Button
        label="Got it"
        variant="secondary"
        size="sm"
        onPress={() => {
          write('fitlens.whatsnew', entry.key);
          setHidden(true);
        }}
        testID="whats-new-dismiss"
      />
    </Card>
  );
}

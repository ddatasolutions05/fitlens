import { useState } from 'react';
import { View } from 'react-native';

import { useUserId } from '@/features/auth/session';
import { useReminder, useSaveReminder, useSendTestReminder } from '@/features/reminders/hooks';
import { pushSupport, subscribeToPush, unsubscribeFromPush } from '@/features/reminders/push';
import { errorMessage } from '@/lib/net';
import { reportError } from '@/lib/telemetry';
import { Button, Card, Note, PageHeader, Screen, SkeletonCard, Text, TimeField, format12, space, toast, useTheme } from '@/ui';

export default function RemindersScreen() {
  const { colors } = useTheme();
  const userId = useUserId();
  const reminder = useReminder();
  const save = useSaveReminder();
  const sendTest = useSendTestReminder();
  const support = pushSupport();
  const [error, setError] = useState<string | null>(null);

  if (reminder.isLoading) {
    return (
      <Screen testID="reminders-screen">
        <PageHeader title="Daily reminder" backTo="/profile" />
        <SkeletonCard />
      </Screen>
    );
  }

  const enabled = reminder.data?.enabled === true;
  const storedTime = (reminder.data?.local_time ?? '20:00:00').slice(0, 5);

  return (
    <Screen testID="reminders-screen">
      <PageHeader title="Daily reminder" subtitle="One notification a day at the time you choose. It stays quiet if you logged a meal in the last two hours." backTo="/profile" />

      <Card tone="inverse" style={{ gap: space.xs }} testID="reminder-status">
        <Text variant="label" style={{ color: colors.onInverse, opacity: 0.6 }}>
          Status
        </Text>
        <Text variant="title" style={{ color: colors.onInverse }}>
          {enabled ? `On, ${format12(storedTime)}` : 'Off'}
        </Text>
        {enabled && reminder.data?.last_sent_on ? (
          <Text variant="caption" style={{ color: colors.onInverse, opacity: 0.7 }}>
            Last sent {reminder.data.last_sent_on}
          </Text>
        ) : null}
      </Card>

      <ReminderForm key={storedTime} initialTime={storedTime} enabled={enabled} canSubscribe={support.ok} onSave={async (time, turnOn) => {
        setError(null);
        try {
          if (turnOn) {
            const result = await subscribeToPush(userId);
            if (result === 'denied') {
              setError('Notifications were not allowed. Allow them for this site and try again.');
              return;
            }
          }
          await save.mutateAsync({ enabled: turnOn, local_time: time });
          toast(turnOn ? `Reminder set for ${format12(time)}` : 'Reminder off');
        } catch (err) {
          reportError('reminders.save', err);
          setError(errorMessage(err));
        }
      }} onOff={async () => {
        setError(null);
        try {
          await unsubscribeFromPush().catch(() => {});
          await save.mutateAsync({ enabled: false, local_time: storedTime });
          toast('Reminder off');
        } catch (err) {
          reportError('reminders.off', err);
          setError(errorMessage(err));
        }
      }} busy={save.isPending} />

      {enabled ? (
        <Button
          label={sendTest.isPending ? 'Sending' : 'Send a test now'}
          variant="secondary"
          disabled={sendTest.isPending}
          onPress={() =>
            sendTest.mutate(undefined, {
              onSuccess: (r) => toast(r.sent > 0 ? 'Sent. Check your notifications.' : 'No browser is subscribed on this account.'),
              onError: (err) => setError(errorMessage(err)),
            })
          }
          testID="reminder-test"
        />
      ) : null}

      {!support.ok ? (
        <View testID="reminder-unsupported">
          <Note>{support.reason ?? ''}</Note>
        </View>
      ) : (
        <Note>Reminders come through this browser. On a phone, keep the app on your Home Screen so they can arrive when it is closed.</Note>
      )}
      {error ? (
        <Text color="danger" variant="small" testID="reminder-error">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

function ReminderForm({ initialTime, enabled, canSubscribe, onSave, onOff, busy }: { initialTime: string; enabled: boolean; canSubscribe: boolean; onSave: (time: string, turnOn: boolean) => Promise<void>; onOff: () => Promise<void>; busy: boolean }) {
  const [time, setTime] = useState(initialTime);
  return (
    <View style={{ gap: space.md }}>
      <TimeField label="Remind me at" value={time} onChange={setTime} testID="reminder-time" />
      {enabled ? (
        <View style={{ gap: space.sm }}>
          {time !== initialTime ? <Button label="Save time" size="lg" disabled={busy} onPress={() => void onSave(time, true)} testID="reminder-save" /> : null}
          <Button label="Turn off" variant="ghost" disabled={busy} onPress={() => void onOff()} testID="reminder-off" />
        </View>
      ) : (
        <Button label="Turn on reminders" size="lg" disabled={busy || !canSubscribe} onPress={() => void onSave(time, true)} testID="reminder-on" />
      )}
    </View>
  );
}

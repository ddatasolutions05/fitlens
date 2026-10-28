import { router } from 'expo-router';
import { useState } from 'react';
import { deleteAccountResultSchema, functionErrorSchema } from '@fitlens/schemas';

import { goBack } from '@/lib/nav';
import { useSession } from '@/features/auth/session';
import { errorMessage } from '@/lib/net';
import { supabase } from '@/lib/supabase';
import { Button, Card, Input, Screen, Text, space } from '@/ui';

export default function DeleteAccount() {
  const { signOut } = useSession();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke('delete-account', { method: 'POST', body: { confirm: 'DELETE' } });
      if (err) {
        let payload: unknown = data;
        if (payload == null && 'context' in err && err.context instanceof Response) payload = await err.context.json().catch(() => null);
        const body = functionErrorSchema.safeParse(payload);
        throw new Error(body.success ? body.data.error.message : err.message);
      }
      deleteAccountResultSchema.parse(data);
      await signOut().catch(() => {});
      router.replace('/sign-in');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen testID="delete-screen">
      <Text variant="title" style={{ marginTop: space.lg }}>
        Delete account
      </Text>
      <Card style={{ gap: space.md }}>
        <Text color="textMuted" variant="small">
          This removes every row you own (profile, preferences, goals, meals, photos, weight, activity, water, day status, usage counters), every photo in storage, and then your sign-in. It runs immediately and cannot be undone. Export first if you want a copy.
        </Text>
        <Input label="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" testID="delete-confirm" />
        <Button label="Delete everything" variant="danger" size="lg" disabled={confirm !== 'DELETE'} loading={busy} onPress={() => void run()} testID="delete-run" />
        {error ? (
          <Text color="danger" variant="small">
            {error}
          </Text>
        ) : null}
      </Card>
      <Button label="Back" variant="ghost" onPress={() => goBack('/profile')} />
    </Screen>
  );
}

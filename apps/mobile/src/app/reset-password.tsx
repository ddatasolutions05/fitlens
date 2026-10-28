import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { useSession } from '@/features/auth/session';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/net';
import { getSupabase } from '@/lib/supabase';
import { Button, Card, Input, PageHeader, Screen, space, Text } from '@/ui';

/** Landing page for the password recovery link. The link signs the user in; this screen sets the new password. */
export default function ResetPassword() {
  const { session, loading } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!config.supabaseConfigured) return <Redirect href="/setup" />;

  async function save() {
    setError(null);
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await getSupabase().auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen testID="reset-password">
      <PageHeader title="Choose a new password" backTo="/sign-in" />
      {loading ? (
        <Text color="textMuted">Checking your link…</Text>
      ) : !session ? (
        <Card style={{ gap: space.md }}>
          <Text color="textMuted">This link is missing or has expired. Request a new one from the sign-in screen with &quot;Forgot password?&quot;.</Text>
          <Button label="Go to sign in" onPress={() => router.replace('/sign-in')} />
        </Card>
      ) : done ? (
        <Card tone="accent" style={{ gap: space.md }}>
          <Text variant="bodyStrong">Password updated</Text>
          <Button label="Continue to the app" onPress={() => router.replace('/')} />
        </Card>
      ) : (
        <Card style={{ gap: space.lg }}>
          <Text variant="small" color="textMuted">
            Signed in as {session.user.email}
          </Text>
          <Input label="New password" secureTextEntry value={password} onChangeText={setPassword} autoComplete="new-password" textContentType="newPassword" />
          <Input label="Repeat it" secureTextEntry value={confirm} onChangeText={setConfirm} autoComplete="new-password" />
          {error ? (
            <Text color="danger" variant="small">
              {error}
            </Text>
          ) : null}
          <Button label="Save password" size="lg" onPress={() => void save()} loading={busy} />
        </Card>
      )}
    </Screen>
  );
}

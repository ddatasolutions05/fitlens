import { router } from 'expo-router';
import { useState } from 'react';

import { useSession } from '@/features/auth/session';
import { errorMessage } from '@/lib/net';
import { getSupabase } from '@/lib/supabase';
import { Button, Card, Input, Row, Screen, Text, space } from '@/ui';

export default function Security() {
  const { session } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const identities = session?.user.identities ?? [];
  const hasPassword = identities.some((i) => i.provider === 'email');

  async function changePassword() {
    setError(null);
    setMessage(null);
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy('password');
    try {
      const { error: err } = await getSupabase().auth.updateUser({ password });
      if (err) throw err;
      setPassword('');
      setConfirm('');
      setMessage(hasPassword ? 'Password updated.' : 'Password set. You can now sign in with email and password too.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function changeEmail() {
    setError(null);
    setMessage(null);
    setBusy('email');
    try {
      const { error: err } = await getSupabase().auth.updateUser({ email: newEmail.trim() });
      if (err) throw err;
      setMessage(`Confirmation links were sent to both addresses. The change completes after you open both.`);
      setNewEmail('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen testID="security-screen">
      <Text variant="title" style={{ marginTop: space.lg }}>
        Sign-in and security
      </Text>
      <Card style={{ gap: space.xs }}>
        <Row title="Email" right={<Text variant="small">{session?.user.email}</Text>} />
        <Row title="Sign-in methods" right={<Text variant="small">{identities.map((i) => i.provider).join(', ') || 'email link'}</Text>} />
        <Row title="Last signed in" right={<Text variant="small">{session?.user.last_sign_in_at ? new Date(session.user.last_sign_in_at).toLocaleString() : 'unknown'}</Text>} />
      </Card>
      <Card style={{ gap: space.md }}>
        <Text variant="heading">{hasPassword ? 'Change password' : 'Set a password'}</Text>
        {!hasPassword ? (
          <Text variant="small" color="textMuted">
            You currently sign in with email links. Setting a password adds a second way in.
          </Text>
        ) : null}
        <Input label="New password" secureTextEntry value={password} onChangeText={setPassword} autoComplete="new-password" textContentType="newPassword" />
        <Input label="Repeat it" secureTextEntry value={confirm} onChangeText={setConfirm} autoComplete="new-password" />
        <Button label="Save password" onPress={() => void changePassword()} loading={busy === 'password'} disabled={password.length < 8} />
      </Card>
      <Card style={{ gap: space.md }}>
        <Text variant="heading">Change email</Text>
        <Input label="New email" value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" inputMode="email" placeholder="new@example.com" />
        <Button label="Send confirmation" variant="secondary" onPress={() => void changeEmail()} loading={busy === 'email'} disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())} />
      </Card>
      {message ? (
        <Text color="accent" variant="small">
          {message}
        </Text>
      ) : null}
      {error ? (
        <Text color="danger" variant="small">
          {error}
        </Text>
      ) : null}
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

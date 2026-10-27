import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { useSession } from '@/features/auth/session';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/net';
import { getSupabase } from '@/lib/supabase';
import { Button, Card, Input, Screen, Segmented, Text, space } from '@/ui';

type Mode = 'magic' | 'password';

export default function SignIn() {
  const { session } = useSession();
  const [mode, setMode] = useState<Mode>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!config.supabaseConfigured) return <Redirect href="/setup" />;
  if (session) return <Redirect href="/" />;

  const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/` : 'fitlens://';

  async function sendMagicLink() {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPassword() {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw err;
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function signUpWithPassword() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (err) throw err;
      if (!data.session) setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.xxl }}>
        <Text variant="title">FitLens</Text>
        <Text color="textMuted">Understand what you eat, track how you move, and know what to adjust.</Text>
      </View>

      <Card style={{ gap: space.lg }}>
        <Segmented<Mode>
          label="Sign in with"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setSent(false);
            setError(null);
          }}
          options={[
            { value: 'magic', label: 'Email link' },
            { value: 'password', label: 'Password' },
          ]}
        />
        <Input
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          testID="email"
        />
        {mode === 'password' ? (
          <Input
            label="Password"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            testID="password"
          />
        ) : null}
        {error ? (
          <Text color="danger" variant="small">
            {error}
          </Text>
        ) : null}
        {sent ? (
          <Card tone="accent">
            <Text variant="bodyStrong">Check your email</Text>
            <Text variant="small" color="textMuted">
              We sent a link to {email.trim()}. Open it on this device to finish signing in.
            </Text>
          </Card>
        ) : mode === 'magic' ? (
          <Button label="Send sign-in link" onPress={sendMagicLink} loading={busy} disabled={!emailValid} size="lg" testID="send-link" />
        ) : (
          <View style={{ gap: space.sm }}>
            <Button
              label="Sign in"
              onPress={signInWithPassword}
              loading={busy}
              disabled={!emailValid || password.length < 8}
              size="lg"
              testID="sign-in"
            />
            <Button
              label="Create account"
              variant="ghost"
              onPress={signUpWithPassword}
              disabled={busy || !emailValid || password.length < 8}
              testID="sign-up"
            />
          </View>
        )}
      </Card>

      <Text variant="caption" color="textFaint">
        Your data stays in your own account. Photos are only sent to an AI provider after you explicitly opt in.
      </Text>
    </Screen>
  );
}

import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { useAuthProviders } from '@/features/auth/providers';
import { useSession } from '@/features/auth/session';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/net';
import { getSupabase } from '@/lib/supabase';
import { Button, Card, Input, NotConfigured, Screen, Segmented, Text, radius, space, touch, useTheme } from '@/ui';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'signin' | 'signup';
type Sent = { kind: 'magic' | 'confirm' | 'reset'; email: string } | null;

function redirectTo(path = ''): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/${path}`;
  return `fitlens://${path}`;
}

export default function SignIn() {
  const { colors } = useTheme();
  const { session } = useSession();
  const providers = useAuthProviders();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent>(null);
  const [error, setError] = useState<string | null>(null);

  if (!config.supabaseConfigured) return <Redirect href="/setup" />;
  if (session) return <Redirect href="/" />;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 8;

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(friendly(errorMessage(err)));
    } finally {
      setBusy(null);
    }
  }

  const signInWithPassword = () =>
    run('password', async () => {
      const { error: err } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw err;
    });

  const createAccount = () =>
    run('signup', async () => {
      const { data, error: err } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectTo(), data: displayName.trim() ? { display_name: displayName.trim() } : undefined },
      });
      if (err) throw err;
      if (!data.session) setSent({ kind: 'confirm', email: email.trim() });
    });

  const sendMagicLink = () =>
    run('magic', async () => {
      const { error: err } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo(), shouldCreateUser: mode === 'signup' },
      });
      if (err) throw err;
      setSent({ kind: 'magic', email: email.trim() });
    });

  const sendReset = () =>
    run('reset', async () => {
      const { error: err } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo('reset-password') });
      if (err) throw err;
      setSent({ kind: 'reset', email: email.trim() });
    });

  const oauth = (provider: 'google' | 'apple') =>
    run(provider, async () => {
      const supabase = getSupabase();
      if (Platform.OS === 'web') {
        const { error: err } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
        if (err) throw err;
        return;
      }
      const { data, error: err } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo(), skipBrowserRedirect: true } });
      if (err) throw err;
      if (!data.url) throw new Error('No sign-in URL returned');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo());
      if (result.type !== 'success') return;
      const params = new URL(result.url).searchParams;
      const code = params.get('code');
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) throw exchangeErr;
      }
    });

  return (
    <Screen testID="sign-in-screen">
      <View style={{ gap: space.sm, marginTop: space.xxl }}>
        <Text variant="title">FitLens</Text>
        <Text color="textMuted">Understand what you eat, track how you move, and know what to adjust.</Text>
      </View>

      <Card style={{ gap: space.lg }}>
        <Segmented<Mode>
          value={mode}
          onChange={(m) => {
            setMode(m);
            setSent(null);
            setError(null);
          }}
          options={[
            { value: 'signin', label: 'Sign in' },
            { value: 'signup', label: 'Create account' },
          ]}
        />

        {sent ? (
          <Card tone="accent" style={{ gap: space.xs }}>
            <Text variant="bodyStrong">{sent.kind === 'reset' ? 'Password reset email sent' : 'Check your email'}</Text>
            <Text variant="small" color="textMuted">
              {sent.kind === 'confirm'
                ? `We sent a confirmation link to ${sent.email}. Open it to activate your account, then come back and sign in.`
                : sent.kind === 'magic'
                  ? `We sent a sign-in link to ${sent.email}. Open it on this device.`
                  : `Open the link in the email sent to ${sent.email} to choose a new password.`}
            </Text>
            <Text variant="caption" color="textFaint">
              Nothing arrived? Check spam, wait a minute, and try again. Links expire after an hour.
            </Text>
            <Button label="Back" variant="ghost" size="sm" onPress={() => setSent(null)} />
          </Card>
        ) : (
          <>
            {mode === 'signup' ? <Input label="Name (optional)" value={displayName} onChangeText={setDisplayName} placeholder="What should we call you?" autoComplete="name" /> : null}
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
            <Input
              label="Password"
              secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              hint={mode === 'signup' ? 'Use a password you do not use elsewhere.' : undefined}
              testID="password"
            />
            {error ? (
              <Text color="danger" variant="small" testID="auth-error">
                {error}
              </Text>
            ) : null}
            {mode === 'signin' ? (
              <Button label="Sign in" size="lg" onPress={signInWithPassword} loading={busy === 'password'} disabled={!emailValid || !passwordValid || busy != null} testID="sign-in" />
            ) : (
              <Button label="Create account" size="lg" onPress={createAccount} loading={busy === 'signup'} disabled={!emailValid || !passwordValid || busy != null || providers.data?.signupDisabled} testID="sign-up" />
            )}
            <View style={styles.links}>
              <Pressable accessibilityRole="button" onPress={sendMagicLink} disabled={!emailValid || busy != null} style={styles.link} testID="send-link">
                <Text variant="small" style={{ color: emailValid ? colors.accent : colors.textFaint }}>
                  {busy === 'magic' ? 'Sending…' : 'Email me a sign-in link instead'}
                </Text>
              </Pressable>
              {mode === 'signin' ? (
                <Pressable accessibilityRole="button" onPress={sendReset} disabled={!emailValid || busy != null} style={styles.link} testID="forgot-password">
                  <Text variant="small" style={{ color: emailValid ? colors.accent : colors.textFaint }}>
                    {busy === 'reset' ? 'Sending…' : 'Forgot password?'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </Card>

      <Card style={{ gap: space.md }}>
        <Text variant="small" color="textMuted">
          Or continue with
        </Text>
        <View style={{ gap: space.sm }}>
          <ProviderButton label="Google" enabled={providers.data?.google ?? false} loading={busy === 'google'} onPress={() => oauth('google')} reason="Google sign-in is not enabled on this project yet. Enable it under Authentication, Providers in the Supabase dashboard with a Google OAuth client." />
          <ProviderButton label="Apple" enabled={providers.data?.apple ?? false} loading={busy === 'apple'} onPress={() => oauth('apple')} reason="Apple sign-in needs an Apple Developer account and a Services ID; enable it under Authentication, Providers." />
        </View>
      </Card>

      <Text variant="caption" color="textFaint">
        Your data stays in your own account. Photos are only sent to an AI provider after you explicitly opt in. By creating an account you accept that nutrition estimates are approximate and not medical advice.
      </Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/setup')} style={{ minHeight: touch.min, justifyContent: 'center' }}>
        <Text variant="caption" color="textFaint">
          Connected to {config.supabaseUrl.replace('https://', '')}
        </Text>
      </Pressable>
    </Screen>
  );
}

function ProviderButton({ label, enabled, loading, onPress, reason }: { label: string; enabled: boolean; loading: boolean; onPress: () => void; reason: string }) {
  if (!enabled) return <NotConfigured feature={`${label} sign-in`} reason={reason} />;
  return <Button label={`Continue with ${label}`} variant="ghost" onPress={onPress} loading={loading} testID={`oauth-${label.toLowerCase()}`} />;
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email or password is wrong. If you signed up with a link, use "Email me a sign-in link".';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first: open the link we sent when you signed up.';
  if (/rate limit|too many/i.test(message)) return 'Too many emails sent recently. Wait a few minutes and try again.';
  if (/already registered|already exists/i.test(message)) return 'An account with this email already exists. Sign in instead.';
  if (/password should be at least/i.test(message)) return 'Password must be at least 8 characters.';
  return message;
}

const styles = StyleSheet.create({
  links: { gap: space.xs, alignItems: 'flex-start' },
  link: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space.xs, borderRadius: radius.sm },
});

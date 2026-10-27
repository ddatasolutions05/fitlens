import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { useAuthProviders } from '@/features/auth/providers';
import { useSession } from '@/features/auth/session';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/net';
import { getSupabase } from '@/lib/supabase';
import Svg, { Path } from 'react-native-svg';

import { Button, Card, Input, Screen, Segmented, Text, radius, space, touch, useTheme } from '@/ui';

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

      {providers.data?.google || providers.data?.apple ? (
        <View style={{ gap: space.md }}>
          <View style={styles.divider}>
            <View style={[styles.rule, { backgroundColor: colors.border }]} />
            <Text variant="caption" color="textFaint">
              or
            </Text>
            <View style={[styles.rule, { backgroundColor: colors.border }]} />
          </View>
          {providers.data?.google ? <ProviderButton provider="google" loading={busy === 'google'} onPress={() => oauth('google')} /> : null}
          {providers.data?.apple ? <ProviderButton provider="apple" loading={busy === 'apple'} onPress={() => oauth('apple')} /> : null}
        </View>
      ) : null}

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

function ProviderButton({ provider, loading, onPress }: { provider: 'google' | 'apple'; loading: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const label = provider === 'google' ? 'Continue with Google' : 'Continue with Apple';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={loading}
      testID={`oauth-${provider}`}
      style={({ pressed }) => [
        styles.provider,
        provider === 'apple' ? { backgroundColor: colors.text, borderColor: colors.text } : { backgroundColor: colors.surface, borderColor: colors.border },
        { opacity: pressed || loading ? 0.8 : 1 },
      ]}
    >
      {provider === 'google' ? (
        <Svg width={20} height={20} viewBox="0 0 48 48">
          <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
          <Path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7-10.3 7-17.7z" />
          <Path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.1.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2z" />
          <Path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.7-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
        </Svg>
      ) : (
        <Text style={{ color: colors.bg, fontSize: 20, lineHeight: 22 }}></Text>
      )}
      <Text variant="bodyStrong" style={{ color: provider === 'apple' ? colors.bg : colors.text }}>
        {loading ? 'Opening…' : label}
      </Text>
    </Pressable>
  );
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  provider: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  links: { gap: space.xs, alignItems: 'flex-start' },
  link: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space.xs, borderRadius: radius.sm },
});

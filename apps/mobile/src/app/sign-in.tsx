import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';

import { useAuthProviders } from '@/features/auth/providers';
import { useSession } from '@/features/auth/session';
import { config } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { errorMessage } from '@/lib/net';
import { reportError } from '@/lib/telemetry';
import { getSupabase } from '@/lib/supabase';
import { BrandMark, Button, Input, Screen, Text, radius, space, touch, useTheme } from '@/ui';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'signin' | 'signup';
type Sent = { kind: 'magic' | 'confirm' | 'reset'; email: string } | null;
type Method = 'email' | 'phone';

/** E.164: a plus sign and 8 to 15 digits. Spaces, dashes and brackets are dropped. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, '');
  return /^\+\d{8,15}$/.test(digits) ? digits : null;
}

function redirectTo(path = ''): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${config.basePath}/${path}`;
  return `fitlens://${path}`;
}

export default function SignIn() {
  const t = useT();
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
  const [method, setMethod] = useState<Method>('email');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);

  if (!config.supabaseConfigured) return <Redirect href="/setup" />;
  if (session) return <Redirect href="/" />;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 8;
  const anyOAuth = Boolean(providers.data?.google || providers.data?.apple);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (!/invalid login|already registered|rate limit|not confirmed/i.test(errorMessage(err))) reportError('auth', err);
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

  const phoneValid = normalizePhone(phone) != null;

  const sendCode = () =>
    run('code', async () => {
      const normalized = normalizePhone(phone);
      if (!normalized) throw new Error('Enter the number with the country code, like +1 416 555 0199.');
      const { error: err } = await getSupabase().auth.signInWithOtp({
        phone: normalized,
        options: { shouldCreateUser: mode === 'signup', data: displayName.trim() ? { display_name: displayName.trim() } : undefined },
      });
      if (err) throw err;
      setCodeSentTo(normalized);
      setOtp('');
    });

  const verifyCode = () =>
    run('verify', async () => {
      if (!codeSentTo) return;
      const { error: err } = await getSupabase().auth.verifyOtp({ phone: codeSentTo, token: otp.trim(), type: 'sms' });
      if (err) throw err;
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
      const code = new URL(result.url).searchParams.get('code');
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) throw exchangeErr;
      }
    });

  return (
    <Screen testID="sign-in-screen" contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}>
      <View style={styles.hero}>
        <BrandMark size={48} />
        <Text variant="label" color="textMuted">
          {config.brandName}
        </Text>
        <Text variant="title" align="center" style={{ fontSize: 34, lineHeight: 38 }}>
          {config.brandTagline}
        </Text>
        <Text color="textMuted" align="center" style={{ maxWidth: 320 }}>
          Log what you eat by photo, search or hand. See calories, protein and the weight trend without the noise.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.tabs, { backgroundColor: colors.surfaceAlt }]} accessibilityRole="radiogroup">
          {(
            [
              ['signin', t('auth.signIn')],
              ['signup', t('auth.createAccount')],
            ] as const
          ).map(([value, label]) => {
            const active = mode === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, checked: active }}
                onPress={() => {
                  setMode(value);
                  setSent(null);
                  setError(null);
                }}
                style={[styles.tab, active ? { backgroundColor: colors.inverse } : null]}
              >
                <Text variant="label" style={{ color: active ? colors.onInverse : colors.textMuted }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {sent ? (
          <View style={[styles.notice, { backgroundColor: colors.surfaceAlt }]}>
            <Text variant="heading">{sent.kind === 'reset' ? 'Reset email sent' : 'Check your inbox'}</Text>
            <Text variant="small" color="textMuted">
              {sent.kind === 'confirm'
                ? `We sent a confirmation link to ${sent.email}. Open it to activate your account, then sign in.`
                : sent.kind === 'magic'
                  ? `We sent a sign-in link to ${sent.email}. Open it on this device.`
                  : `Open the link we sent to ${sent.email} to choose a new password.`}
            </Text>
            <Text variant="caption" color="textFaint">
              Nothing there? Check spam and wait a minute. Links expire after an hour.
            </Text>
            <Button label="Back" variant="ghost" size="sm" onPress={() => setSent(null)} />
          </View>
        ) : method === 'phone' ? (
          <View style={{ gap: space.md }} testID="phone-form">
            {mode === 'signup' ? <Input label="Name (optional)" value={displayName} onChangeText={setDisplayName} placeholder="What should we call you?" autoComplete="name" /> : null}
            <Input
              label="Mobile number"
              keyboardType="phone-pad"
              inputMode="tel"
              autoComplete="tel"
              textContentType="telephoneNumber"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 416 555 0199"
              hint="Include the country code. A 6-digit code arrives by text; message rates may apply."
              testID="phone"
              editable={!codeSentTo}
            />
            {codeSentTo ? (
              <Input label="Code from the text" keyboardType="number-pad" inputMode="numeric" autoComplete="one-time-code" textContentType="oneTimeCode" value={otp} onChangeText={setOtp} placeholder="123456" testID="otp" />
            ) : null}
            {error ? (
              <View style={[styles.notice, { backgroundColor: colors.surfaceAlt }]}>
                <Text color="danger" variant="small" testID="auth-error">
                  {error}
                </Text>
              </View>
            ) : null}
            {codeSentTo ? (
              <>
                <Button label={mode === 'signup' ? 'Verify and create account' : 'Verify and sign in'} size="lg" onPress={verifyCode} loading={busy === 'verify'} disabled={otp.trim().length < 6 || busy != null} testID="verify-code" />
                <Pressable accessibilityRole="button" onPress={sendCode} disabled={busy != null} style={[styles.link, { alignSelf: 'center' }]} testID="resend-code">
                  <Text variant="small" style={{ color: colors.text, textDecorationLine: 'underline' }}>
                    {busy === 'code' ? 'Sending' : 'Send a new code'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Button label="Send code" size="lg" onPress={sendCode} loading={busy === 'code'} disabled={!phoneValid || busy != null || (mode === 'signup' && providers.data?.signupDisabled)} testID="send-code" />
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMethod('email');
                setCodeSentTo(null);
                setError(null);
              }}
              style={[styles.link, { alignSelf: 'center' }]}
              testID="use-email"
            >
              <Text variant="small" style={{ color: colors.text, textDecorationLine: 'underline' }}>
                Use email instead
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            {anyOAuth ? (
              <View style={{ gap: space.sm }}>
                {providers.data?.google ? <ProviderButton provider="google" loading={busy === 'google'} onPress={() => oauth('google')} /> : null}
                {providers.data?.apple ? <ProviderButton provider="apple" loading={busy === 'apple'} onPress={() => oauth('apple')} /> : null}
                <View style={styles.divider}>
                  <View style={[styles.rule, { backgroundColor: colors.border }]} />
                  <Text variant="caption" color="textFaint">
                    {t('auth.orEmail')}
                  </Text>
                  <View style={[styles.rule, { backgroundColor: colors.border }]} />
                </View>
              </View>
            ) : null}

            {mode === 'signup' ? <Input label="Name (optional)" value={displayName} onChangeText={setDisplayName} placeholder="What should we call you?" autoComplete="name" /> : null}
            <Input
              label={t('auth.email')}
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
              label={t('auth.password')}
              secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              testID="password"
            />
            {error ? (
              <View style={[styles.notice, { backgroundColor: colors.surfaceAlt }]}>
                <Text color="danger" variant="small" testID="auth-error">
                  {error}
                </Text>
              </View>
            ) : null}
            {mode === 'signin' ? (
              <Button label={t('auth.signIn')} size="lg" onPress={signInWithPassword} loading={busy === 'password'} disabled={!emailValid || !passwordValid || busy != null} testID="sign-in" />
            ) : (
              <Button label={t('auth.createAccount')} size="lg" onPress={createAccount} loading={busy === 'signup'} disabled={!emailValid || !passwordValid || busy != null || providers.data?.signupDisabled} testID="sign-up" />
            )}
            <View style={styles.links}>
              <Pressable accessibilityRole="button" onPress={sendMagicLink} disabled={!emailValid || busy != null} style={styles.link} testID="send-link">
                <Text variant="small" style={{ color: emailValid ? colors.text : colors.textFaint, textDecorationLine: 'underline' }}>
                  {busy === 'magic' ? 'Sending' : t('auth.magic')}
                </Text>
              </Pressable>
              {providers.data?.phone ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setMethod('phone');
                    setError(null);
                  }}
                  style={styles.link}
                  testID="use-phone"
                >
                  <Text variant="small" style={{ color: colors.text, textDecorationLine: 'underline' }}>
                    Use a phone number
                  </Text>
                </Pressable>
              ) : null}
              {mode === 'signin' ? (
                <Pressable accessibilityRole="button" onPress={sendReset} disabled={!emailValid || busy != null} style={styles.link} testID="forgot-password">
                  <Text variant="small" style={{ color: emailValid ? colors.text : colors.textFaint, textDecorationLine: 'underline' }}>
                    {busy === 'reset' ? 'Sending' : t('auth.forgot')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </View>

      <View style={styles.features}>
        <Feature icon="camera" title="Log any way you like" body="Photo, database search or manual entry. Every estimate stays editable." />
        <Feature icon="ring" title="Numbers that mean something" body="Calories, protein, steps, water and the weight trend in one place." />
        <Feature icon="leaf" title="A coach grounded in your logs" body="Ask what to eat next. Answers come from your own data, never a lecture." />
      </View>

      <Text variant="caption" color="textFaint" align="center" style={{ marginBottom: space.lg }}>
        Your data lives in your own account. Photos go to an AI provider only after you opt in. Estimates are approximate, not medical advice.
      </Text>
    </Screen>
  );
}

function Feature({ icon, title, body }: { icon: 'camera' | 'ring' | 'leaf'; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.feature}>
      <View style={[styles.featureIcon, { backgroundColor: colors.inverse }]}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.onInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {icon === 'camera' ? (
            <>
              <Path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <Circle cx={12} cy={13} r={3.5} />
            </>
          ) : icon === 'ring' ? (
            <>
              <Circle cx={12} cy={12} r={9} opacity={0.3} />
              <Path d="M12 3a9 9 0 0 1 9 9" />
              <Path d="M12 8v4l3 2" />
            </>
          ) : (
            <>
              <Path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
              <Path d="M5 19l8-8" />
            </>
          )}
        </Svg>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" color="textMuted">
          {body}
        </Text>
      </View>
    </View>
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
        provider === 'apple' ? { backgroundColor: colors.inverse, borderColor: colors.inverse } : { backgroundColor: colors.surface, borderColor: colors.text },
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
        <Text style={{ color: colors.onInverse, fontSize: 20, lineHeight: 22 }}></Text>
      )}
      <Text variant="bodyStrong" style={{ color: provider === 'apple' ? colors.onInverse : colors.text }}>
        {loading ? 'Opening' : label}
      </Text>
    </Pressable>
  );
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email or password is wrong. If you signed up with a link, use "Email me a link instead".';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first: open the link we sent when you signed up.';
  if (/rate limit|too many/i.test(message)) return 'Too many emails sent recently. Wait a few minutes and try again.';
  if (/already registered|already exists/i.test(message)) return 'An account with this email already exists. Sign in instead.';
  if (/password should be at least/i.test(message)) return 'Password must be at least 8 characters.';
  if (/token has expired|invalid.*otp|otp.*invalid/i.test(message)) return 'That code is wrong or has expired. Send a new one.';
  if (/sms|phone provider|unsupported phone/i.test(message)) return 'Text messages are not set up on this app yet. Use email for now.';
  return message;
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, marginTop: space.xl, marginBottom: space.md },
  card: { borderRadius: radius.xl, borderWidth: 1, padding: space.lg, gap: space.lg },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: radius.md, gap: 4 },
  tab: { flex: 1, minHeight: touch.min - 4, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  notice: { borderRadius: radius.md, padding: space.md, gap: space.xs },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xs },
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
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  link: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space.xs, borderRadius: radius.sm },
  features: { gap: space.md, marginTop: space.sm },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  featureIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});

import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatHeight, formatWeight, type UnitSystem } from '@fitlens/core';

import { useIsAdmin } from '@/features/admin/hooks';
import { useSession } from '@/features/auth/session';
import { SectionLabel } from '@/features/day/components';
import { Avatar, AvatarCancelled, initialsFor, useUploadAvatar } from '@/features/profile/Avatar';
import { useLatestWeight, usePreferences, useProfile, useUpsertProfile } from '@/features/profile/hooks';
import { errorMessage } from '@/lib/net';
import { LANGS, useI18n } from '@/lib/i18n';
import { Button, Card, ErrorState, Row, Screen, Segmented, SkeletonCard, Stat, Text, space, useTheme, type ThemePreference } from '@/ui';

export default function ProfileScreen() {
  const { lang, setLang, t } = useI18n();
  const isAdmin = useIsAdmin();
  const { session, signOut } = useSession();
  const { preference, setPreference } = useTheme();
  const profile = useProfile();
  const prefs = usePreferences();
  const weight = useLatestWeight();
  const upsert = useUpsertProfile();
  const upload = useUploadAvatar();
  const [avatarError, setAvatarError] = useState<string | null>(null);

  if (profile.isLoading) {
    return (
      <Screen>
        <SkeletonCard lines={5} />
      </Screen>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <ErrorState message={profile.error ? (profile.error as Error).message : 'No profile yet'} onRetry={() => profile.refetch()} />
      </Screen>
    );
  }
  const p = profile.data;
  const unitSystem = p.unit_system as UnitSystem;

  return (
    <Screen testID="profile-screen">
      <View style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar
          path={p.avatar_path ?? null}
          initials={initialsFor(p.display_name, session?.user.email)}
          size={64}
          editable
          onPress={() => void upload.mutateAsync().catch((err: unknown) => (err instanceof AvatarCancelled ? null : setAvatarError(errorMessage(err))))}
          testID="profile-avatar"
        />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text variant="title">{p.display_name ?? 'Profile'}</Text>
          <Text color="textMuted" variant="small">
            {session?.user.email ?? session?.user.phone}
          </Text>
          {avatarError ? (
            <Text color="danger" variant="caption">
              {avatarError}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat label="Height" value={p.height_cm != null ? formatHeight(Number(p.height_cm), unitSystem) : 'Not set'} style={styles.stat} />
        <Stat label="Weight" value={weight.data ? formatWeight(Number(weight.data.kg), unitSystem) : 'None'} style={styles.stat} />
        <Stat label="Goal" value={p.goal_weight_kg != null ? formatWeight(Number(p.goal_weight_kg), unitSystem) : 'Not set'} style={styles.stat} />
      </View>

      <Card style={{ gap: space.xs }}>
        <SectionLabel>Plan</SectionLabel>
        <Row title="Mode" right={<Text>{p.mode === 'tracking_only' ? 'Tracking only' : 'Standard'}</Text>} divider />
        <Row title="Targets and TDEE" subtitle="See the formula with your numbers, change goal, pace or activity mode" onPress={() => router.push('/profile/targets')} divider />
        <Row title="Target check" subtitle="Compare the formula with thirty days of your own logs" onPress={() => router.push('/profile/adaptive')} divider />
        <Row title="How TDEE differs from the food target" onPress={() => router.push('/profile/tdee')} divider />
        <Row title="Edit profile" subtitle="Height, birth date, goal weight, training" onPress={() => router.push('/profile/edit')} accessibilityLabel="Edit profile" />
      </Card>

      <Card style={{ gap: space.xs }}>
        <SectionLabel>Coaching</SectionLabel>
        <Row title="Your trainer" subtitle="Share a weekly summary with a coach, or stop sharing" onPress={() => router.push('/profile/trainer')} divider />
        <Row title="Trainer view" subtitle="Your code and the people who share with you" onPress={() => router.push('/trainer')} divider />
        <Row title="How it works" subtitle="Drafts, unknown values, targets, the trend and the Coach" onPress={() => router.push('/profile/help')} divider={isAdmin.data === true} />
        {isAdmin.data === true ? <Row title="Admin" subtitle="Accounts, activity, errors and feature use" onPress={() => router.push('/admin')} accessibilityLabel="Admin" /> : null}
      </Card>

      <Card style={{ gap: space.md }}>
        <SectionLabel>Display</SectionLabel>
        <Segmented<string> label={t('profile.language')} value={lang} onChange={(v) => setLang(v as typeof lang)} options={LANGS.map((l) => ({ value: l.key, label: l.label }))} />
        <Segmented<ThemePreference>
          label="Theme"
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'black', label: 'Black' },
            { value: 'white', label: 'White' },
            { value: 'system', label: 'System' },
          ]}
        />
        <Segmented<UnitSystem>
          label="Units"
          value={unitSystem}
          onChange={(u) => upsert.mutate({ unit_system: u })}
          options={[
            { value: 'metric', label: 'Metric' },
            { value: 'imperial', label: 'Imperial' },
          ]}
        />
        <Segmented<'show' | 'hide'>
          label="Calorie numbers"
          value={p.hide_numbers ? 'hide' : 'show'}
          onChange={(v) => upsert.mutate({ hide_numbers: v === 'hide' })}
          options={[
            { value: 'show', label: 'Show' },
            { value: 'hide', label: 'Hide', hint: 'protein, fibre and consistency instead' },
          ]}
        />
      </Card>

      <Card style={{ gap: space.xs }}>
        <SectionLabel>Privacy and account</SectionLabel>
        <Row title="Diet, allergies and AI consent" subtitle={prefs.data?.ai_photo_consent_at ? 'AI features enabled' : 'AI features off'} onPress={() => router.push('/profile/privacy')} divider />
        <Row title="Sign-in and security" subtitle="Password, email, linked sign-in methods" onPress={() => router.push('/profile/security')} divider />
        <Row title="Connected health apps" subtitle="Apple Health and Health Connect need a native build" onPress={() => router.push('/profile/integrations')} divider />
        <Row title="Export my data" subtitle="JSON and CSV with photos, as a zip" onPress={() => router.push('/profile/export')} divider />
        <Row title="Delete account" subtitle="Removes every row and photo" onPress={() => router.push('/profile/delete')} />
      </Card>

      <Button label="Sign out" variant="ghost" onPress={() => void signOut()} testID="sign-out" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stat: { minWidth: 0 },
});

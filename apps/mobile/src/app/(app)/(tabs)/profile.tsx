import { router } from 'expo-router';
import { View } from 'react-native';
import { formatHeight, formatWeight, type UnitSystem } from '@fitlens/core';

import { useSession } from '@/features/auth/session';
import { useLatestWeight, usePreferences, useProfile, useUpsertProfile } from '@/features/profile/hooks';
import { Button, Card, ErrorState, Row, Screen, Segmented, SkeletonCard, Text, space } from '@/ui';

export default function ProfileScreen() {
  const { session, signOut } = useSession();
  const profile = useProfile();
  const prefs = usePreferences();
  const weight = useLatestWeight();
  const upsert = useUpsertProfile();

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
      <View style={{ marginTop: space.lg, gap: space.xs }}>
        <Text variant="title">{p.display_name ?? 'Profile'}</Text>
        <Text color="textMuted" variant="small">
          {session?.user.email}
        </Text>
      </View>

      <Card style={{ gap: space.xs }}>
        <Row title="Height" right={<Text tabular>{p.height_cm != null ? formatHeight(Number(p.height_cm), unitSystem) : 'Not set'}</Text>} />
        <Row title="Latest weight" right={<Text tabular>{weight.data ? formatWeight(Number(weight.data.kg), unitSystem) : 'Not logged'}</Text>} />
        <Row title="Goal weight" right={<Text tabular>{p.goal_weight_kg != null ? formatWeight(Number(p.goal_weight_kg), unitSystem) : 'Not set'}</Text>} />
        <Row title="Mode" right={<Text>{p.mode === 'tracking_only' ? 'Tracking only' : 'Standard'}</Text>} />
        <Button label="Edit profile" variant="secondary" onPress={() => router.push('/profile/edit')} testID="edit-profile" />
      </Card>

      <Card style={{ gap: space.xs }}>
        <Row title="Targets and TDEE" subtitle="See the formula with your numbers, change goal, pace or activity mode" onPress={() => router.push('/profile/targets')} />
        <Row title="How TDEE differs from the food target" onPress={() => router.push('/profile/tdee')} />
        <Row title="Diet, allergies and AI photo consent" subtitle={prefs.data?.ai_photo_consent_at ? 'Photo analysis enabled' : 'Photo analysis off'} onPress={() => router.push('/profile/privacy')} />
      </Card>

      <Card style={{ gap: space.md }}>
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
        <Row title="Sign-in and security" subtitle="Password, email, linked sign-in methods" onPress={() => router.push('/profile/security')} />
        <Row title="Export my data" subtitle="JSON and CSV with photos, as a zip" onPress={() => router.push('/profile/export')} />
        <Row title="Delete account" subtitle="Removes every row and photo" onPress={() => router.push('/profile/delete')} />
        <Row title="Connected health apps" subtitle="Apple Health and Health Connect need a native build" onPress={() => router.push('/profile/integrations')} />
      </Card>

      <Button label="Sign out" variant="ghost" onPress={() => void signOut()} testID="sign-out" />
    </Screen>
  );
}

import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/features/auth/session';
import { useProfile } from '@/features/profile/hooks';
import { config } from '@/lib/config';
import { Screen, Text, useTheme } from '@/ui';

export default function Index() {
  if (!config.supabaseConfigured) return <Redirect href="/setup" />;
  return <Gate />;
}

function Gate() {
  const { session, loading } = useSession();
  if (loading) return <Loading label="Checking your session" />;
  if (!session) return <Redirect href="/sign-in" />;
  return <OnboardingGate />;
}

function OnboardingGate() {
  const profile = useProfile();
  const { colors } = useTheme();
  if (profile.isLoading) return <Loading label="Loading your profile" />;
  if (profile.isError) {
    return (
      <Screen scroll={false}>
        <Text variant="heading">Could not load your profile</Text>
        <Text color="textMuted">{(profile.error as Error).message}</Text>
        <Text color="accent" onPress={() => profile.refetch()} style={{ color: colors.accent }}>
          Try again
        </Text>
      </Screen>
    );
  }
  if (!profile.data?.onboarding_completed_at) return <Redirect href="/onboarding" />;
  return <Redirect href="/today" />;
}

function Loading({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 12 }}>
      <ActivityIndicator color={colors.accent} />
      <Text color="textMuted" variant="small">
        {label}
      </Text>
    </View>
  );
}

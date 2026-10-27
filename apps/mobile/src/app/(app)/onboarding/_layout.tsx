import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/auth/session';
import { config } from '@/lib/config';

export default function OnboardingLayout() {
  const { session, loading } = useSession();
  if (!config.supabaseConfigured) return <Redirect href="/setup" />;
  if (!loading && !session) return <Redirect href="/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

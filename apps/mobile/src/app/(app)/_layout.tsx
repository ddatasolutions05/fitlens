import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/features/auth/session';
import { config } from '@/lib/config';
import { Text, useTheme } from '@/ui';

/** Every signed-in route lives under this group so no screen renders before a session is known. */
export default function AppLayout() {
  const { session, loading } = useSession();
  const { colors } = useTheme();
  if (!config.supabaseConfigured) return <Redirect href="/setup" />;
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 12 }}>
        <ActivityIndicator color={colors.accent} />
        <Text color="textMuted" variant="small">
          Checking your session
        </Text>
      </View>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
      <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
      <Stack.Screen name="log/weight" options={{ presentation: 'modal' }} />
      <Stack.Screen name="log/activity" options={{ presentation: 'modal' }} />
      <Stack.Screen name="log/water" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

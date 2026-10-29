import { Lato_400Regular, Lato_700Bold, Lato_900Black, useFonts } from '@expo-google-fonts/lato';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '@/features/auth/session';
import { QueryProvider } from '@/lib/query';
import { I18nProvider } from '@/lib/i18n';
import { installGlobalErrorHandlers } from '@/lib/telemetry';
import { captureInstallPrompt } from '@/lib/install';
import { registerServiceWorker } from '@/lib/sw';
import { recordVisit } from '@/lib/visits';
import { AppErrorBoundary, ThemeProvider, ToastHost, useTheme } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});
installGlobalErrorHandlers();
captureInstallPrompt();

function VisitTracker() {
  const { userId } = useSession();
  useEffect(() => {
    void registerServiceWorker();
    void recordVisit('open');
  }, []);
  useEffect(() => {
    if (userId) void recordVisit('signin');
  }, [userId]);
  return null;
}

function Navigator({ fontsReady }: { fontsReady: boolean }) {
  const { colors, scheme } = useTheme();
  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);
  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }} />
      <ToastHost />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ Lato_400Regular, Lato_700Bold, Lato_900Black });
  // A font failure must not block the app; the system face steps in.
  const fontsReady = loaded || Boolean(error);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
          <QueryProvider>
            <SessionProvider>
              <VisitTracker />
              <AppErrorBoundary>
                <Navigator fontsReady={fontsReady} />
              </AppErrorBoundary>
            </SessionProvider>
          </QueryProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

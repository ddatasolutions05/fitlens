import { Redirect, Tabs, router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/features/auth/session';
import { config } from '@/lib/config';
import { Text, layout, radius, space, touch, useTheme } from '@/ui';

interface BottomTabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
}
type RawTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type TabName = 'today' | 'diary' | 'progress' | 'coach' | 'profile';
const TAB_LABELS: Record<TabName, string> = {
  today: 'Today',
  diary: 'Diary',
  progress: 'Progress',
  coach: 'Coach',
  profile: 'Profile',
};
const TAB_GLYPHS: Record<TabName, string> = {
  today: '◎',
  diary: '☰',
  progress: '↗',
  coach: '✦',
  profile: '◯',
};

function TabBar({ state }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;

  const renderTab = (name: TabName) => {
    const route = state.routes.find((r: { name: string }) => r.name === name);
    const focused = current === name;
    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={TAB_LABELS[name]}
        testID={`tab-${name}`}
        onPress={() => {
          if (!route || focused) return;
          router.navigate(`/${name}`);
        }}
        style={styles.tab}
      >
        <Text style={{ fontSize: 18, color: focused ? colors.accent : colors.textFaint }}>{TAB_GLYPHS[name]}</Text>
        <Text variant="caption" style={{ color: focused ? colors.accent : colors.textMuted }}>
          {TAB_LABELS[name]}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, space.sm), backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={styles.bar}>
        {renderTab('today')}
        {renderTab('diary')}
        <View style={styles.cameraSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan meal"
            testID="scan-meal"
            onPress={() => router.push({ pathname: '/scan', params: { fresh: '1' } })}
            style={({ pressed }) => [styles.camera, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={{ color: colors.onAccent, fontSize: 24, lineHeight: 28 }}>📷</Text>
          </Pressable>
          <Text variant="caption" color="textMuted">
            Scan
          </Text>
        </View>
        {renderTab('progress')}
        {renderTab('coach')}
        {renderTab('profile')}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { session, loading } = useSession();
  if (!config.supabaseConfigured) return <Redirect href="/setup" />;
  if (!loading && !session) return <Redirect href="/sign-in" />;
  return (
    <Tabs tabBar={(props: RawTabBarProps) => <TabBar {...(props as unknown as BottomTabBarProps)} />} screenOptions={{ headerShown: false, lazy: true }}>
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="diary" options={{ title: 'Diary' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.xs },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: layout.maxWidth + 80,
    alignSelf: 'center',
  },
  tab: { flex: 1, minHeight: touch.min + 8, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: space.xs },
  cameraSlot: { flex: 1, alignItems: 'center', gap: 2 },
  camera: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});

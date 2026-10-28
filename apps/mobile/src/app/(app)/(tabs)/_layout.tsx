import { Redirect, Tabs, router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/features/auth/session';
import { AddSheet } from '@/features/day/AddSheet';
import { useSelectedDate } from '@/features/day/selected-date';
import { config } from '@/lib/config';
import { Icon, Text, layout, radius, space, touch, useTheme, type IconName } from '@/ui';

interface BottomTabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
}
type RawTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type TabName = 'today' | 'diary' | 'progress' | 'coach' | 'profile';
const TABS: { name: TabName; label: string; icon: IconName }[] = [
  { name: 'today', label: 'Today', icon: 'today' },
  { name: 'diary', label: 'Diary', icon: 'diary' },
  { name: 'progress', label: 'Stats', icon: 'progress' },
  { name: 'coach', label: 'Coach', icon: 'coach' },
  { name: 'profile', label: 'Profile', icon: 'profile' },
];

function TabBar({ state }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [localDate] = useSelectedDate();
  const [sheet, setSheet] = useState(false);
  const current = state.routes[state.index]?.name;

  const renderTab = (t: (typeof TABS)[number]) => {
    const focused = current === t.name;
    return (
      <Pressable
        key={t.name}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={t.label}
        testID={`tab-${t.name}`}
        onPress={() => {
          if (focused) return;
          router.navigate(`/${t.name}`);
        }}
        style={styles.tab}
      >
        <Icon name={t.icon} size={22} color={focused ? colors.text : colors.textFaint} strokeWidth={focused ? 2.2 : 1.6} />
        <Text variant="caption" style={{ color: focused ? colors.text : colors.textFaint, fontSize: 11, lineHeight: 14 }}>
          {t.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, space.sm), backgroundColor: colors.bg, borderTopColor: colors.border }]}>
      <View style={styles.bar}>
        {renderTab(TABS[0]!)}
        {renderTab(TABS[1]!)}
        <View style={styles.centreSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log something"
            testID="add-button"
            onPress={() => setSheet(true)}
            style={({ pressed }) => [styles.centre, { backgroundColor: colors.inverse, opacity: pressed ? 0.85 : 1 }]}
          >
            <Icon name="plus" size={26} color={colors.onInverse} strokeWidth={2.4} />
          </Pressable>
        </View>
        {renderTab(TABS[2]!)}
        {renderTab(TABS[3]!)}
        {renderTab(TABS[4]!)}
      </View>
      <AddSheet visible={sheet} localDate={localDate} onClose={() => setSheet(false)} />
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
      <Tabs.Screen name="progress" options={{ title: 'Stats' }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.xs },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: layout.maxWidth + 80,
    alignSelf: 'center',
  },
  tab: { flex: 1, minHeight: touch.min + 8, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: space.xs },
  centreSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centre: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
  },
});

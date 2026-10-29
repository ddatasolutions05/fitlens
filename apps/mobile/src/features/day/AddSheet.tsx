import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/lib/i18n';
import { Icon, Text, radius, space, touch, useTheme, type IconName } from '@/ui';

interface Action {
  key: string;
  icon: IconName;
  title: string;
  body: string;
  go: (localDate: string) => void;
}

const FOOD: Action[] = [
  { key: 'search', icon: 'search', title: 'add.search', body: 'add.searchBody', go: (d) => router.push({ pathname: '/food/search', params: { date: d, fresh: '1' } }) },
  { key: 'manual', icon: 'pencil', title: 'add.manual', body: 'add.manualBody', go: (d) => router.push({ pathname: '/food/manual', params: { date: d, fresh: '1' } }) },
  { key: 'scan', icon: 'camera', title: 'add.scan', body: 'add.scanBody', go: (d) => router.push({ pathname: '/scan', params: { date: d, fresh: '1' } }) },
  { key: 'barcode', icon: 'barcode', title: 'add.barcode', body: 'add.barcodeBody', go: (d) => router.push({ pathname: '/food/barcode', params: { date: d } }) },
  { key: 'describe', icon: 'coach', title: 'add.describe', body: 'add.describeBody', go: (d) => router.push({ pathname: '/food/describe', params: { date: d } }) },
  { key: 'label', icon: 'diary', title: 'add.label', body: 'add.labelBody', go: (d) => router.push({ pathname: '/food/label', params: { date: d } }) },
];

const OTHER: Action[] = [
  { key: 'water', icon: 'water', title: 'add.water', body: '', go: (d) => router.push({ pathname: '/log/water', params: { date: d } }) },
  { key: 'weight', icon: 'scale', title: 'add.weight', body: '', go: (d) => router.push({ pathname: '/log/weight', params: { date: d } }) },
  { key: 'activity', icon: 'activity', title: 'add.activity', body: '', go: (d) => router.push({ pathname: '/log/activity', params: { date: d } }) },
];

/** The sheet behind the centre tab button: every way to log, food first. */
export function AddSheet({ visible, localDate, onClose }: { visible: boolean; localDate: string; onClose: () => void }) {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const run = (a: Action) => {
    onClose();
    a.go(localDate);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, space.lg) }]} testID="add-sheet">
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <Text variant="label" color="textMuted" style={{ marginBottom: space.sm }}>
          {t('add.logFood')}
        </Text>
        <View style={{ gap: space.sm }}>
          {FOOD.map((a) => (
            <Pressable
              key={a.key}
              accessibilityRole="button"
              accessibilityLabel={t(a.title)}
              testID={`add-${a.key}`}
              onPress={() => run(a)}
              style={({ pressed }) => [styles.foodRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.inverse }]}>
                <Icon name={a.icon} size={22} color={colors.onInverse} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{t(a.title)}</Text>
                <Text variant="small" color="textMuted" numberOfLines={2}>
                  {t(a.body)}
                </Text>
              </View>
              <Icon name="chevronRight" size={18} color={colors.textFaint} />
            </Pressable>
          ))}
        </View>
        <Text variant="label" color="textMuted" style={{ marginTop: space.lg, marginBottom: space.sm }}>
          {t('add.alsoLog')}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {OTHER.map((a) => (
            <Pressable
              key={a.key}
              accessibilityRole="button"
              accessibilityLabel={`Log ${t(a.title).toLowerCase()}`}
              testID={`add-${a.key}`}
              onPress={() => run(a)}
              style={({ pressed }) => [styles.tile, { borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <Icon name={a.icon} size={22} />
              <Text variant="small">{t(a.title)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: space.lg },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: touch.min + 20,
  },
  iconBox: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  tile: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
});

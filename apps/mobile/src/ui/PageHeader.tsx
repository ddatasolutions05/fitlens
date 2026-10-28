import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';
import { space, touch } from './tokens';

export interface PageHeaderProps {
  title: string;
  subtitle?: string | null;
  /** Small uppercase line above the title. */
  eyebrow?: string;
  /** Where the back chevron goes when there is no history (deep link, reload). Omit to hide the chevron. */
  backTo?: Href;
  right?: React.ReactNode;
  testID?: string;
}

/** Top of every pushed screen: chevron, title in display weight, optional subtitle. */
export function PageHeader({ title, subtitle, eyebrow, backTo, right, testID }: PageHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} testID={testID}>
      {backTo ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace(backTo))}
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}
          testID="page-back"
        >
          <Icon name="chevronLeft" size={24} color={colors.text} strokeWidth={2} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? (
          <Text variant="label" color="textMuted">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="title" style={{ fontSize: 28, lineHeight: 32 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.sm },
  back: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center', marginLeft: -space.md, marginTop: -6 },
  right: { alignItems: 'flex-end', justifyContent: 'center', minHeight: touch.min },
});

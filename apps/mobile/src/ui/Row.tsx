import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { space, touch } from './tokens';

export interface RowProps {
  title: string;
  subtitle?: string | null;
  right?: React.ReactNode;
  left?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  chevron?: boolean;
}

/** A list row with a 44 px minimum touch target. */
export function Row({ title, subtitle, right, left, onPress, accessibilityLabel, style, chevron }: RowProps) {
  const { colors } = useTheme();
  const content = (
    <>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.text}>
        <Text numberOfLines={2}>{title}</Text>
        {subtitle ? (
          <Text variant="small" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
      {chevron ?? onPress ? (
        <Text color="textFaint" style={{ marginLeft: space.sm }}>
          ›
        </Text>
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        onPress={onPress}
        style={({ pressed }) => [styles.row, { borderColor: colors.border, opacity: pressed ? 0.8 : 1 }, style]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.row, { borderColor: colors.border }, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    minHeight: touch.min + 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    gap: space.md,
  },
  left: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end' },
});

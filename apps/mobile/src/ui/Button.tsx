import { useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space, touch } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  size?: 'md' | 'lg' | 'sm';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

/** Primary is a solid plate in the opposite colour with an uppercase label. */
export function Button({ label, variant = 'primary', loading, disabled, size = 'md', icon, style, fullWidth, onPressIn, onPressOut, ...rest }: ButtonProps) {
  const { colors, reducedMotion } = useTheme();
  const isDisabled = Boolean(disabled || loading);
  // A small press-down scale on top of the opacity change; skipped under reduced motion.
  const [scale] = useState(() => new Animated.Value(1));
  const settle = (to: number) => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: Platform.OS !== 'web', friction: 6, tension: 160 }).start();
  };

  const bg = variant === 'primary' ? colors.accent : 'transparent';
  const fg = variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.text : colors.textMuted;
  const borderColor = variant === 'secondary' ? colors.text : variant === 'danger' ? colors.danger : 'transparent';
  const height = size === 'lg' ? 56 : size === 'sm' ? touch.min : 48;

  return (
    <Animated.View style={[fullWidth ? { alignSelf: 'stretch' } : null, style, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
        disabled={isDisabled}
        {...rest}
        onPressIn={(e) => {
          settle(0.97);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          settle(1);
          onPressOut?.(e);
        }}
        style={({ pressed }) => [styles.base, { backgroundColor: bg, borderColor, height, opacity: isDisabled ? 0.45 : pressed ? 0.85 : 1 }]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <View style={styles.inner}>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text variant="label" style={{ color: fg, fontSize: size === 'lg' ? 14 : size === 'sm' ? 12 : 13, lineHeight: 18 }} numberOfLines={1}>
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.min,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  icon: { marginRight: 2 },
});

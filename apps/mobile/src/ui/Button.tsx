import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

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

export function Button({ label, variant = 'primary', loading, disabled, size = 'md', icon, style, fullWidth, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = Boolean(disabled || loading);

  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'secondary'
        ? colors.accentSoft
        : variant === 'danger'
          ? colors.danger
          : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? colors.onAccent : variant === 'secondary' ? colors.accent : colors.text;
  const height = size === 'lg' ? 56 : size === 'sm' ? touch.min : 48;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, height, opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
        variant === 'ghost' ? { borderWidth: 1, borderColor: colors.border } : null,
        fullWidth ? { alignSelf: 'stretch' } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.inner}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text variant={size === 'lg' ? 'heading' : 'bodyStrong'} style={{ color: fg }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.min,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  icon: { marginRight: 2 },
});

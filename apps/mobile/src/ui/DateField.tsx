// Web: the browser's own date input, which phones open as a calendar or wheel.
// The native build has its own file (DateField.native.tsx) with the OS picker.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { unstable_createElement } from 'react-native-web';

import { Text } from './Text';
import { useTheme } from './theme';
import { fonts, radius, space, touch } from './tokens';

export interface DateFieldProps {
  label: string;
  /** YYYY-MM-DD or empty. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  hint?: string;
  error?: string | null;
  testID?: string;
}

export function DateField({ label, value, onChange, min, max, hint, error, testID }: DateFieldProps) {
  const { colors, scheme } = useTheme();
  const [focused, setFocused] = useState(false);
  const input = unstable_createElement('input', {
    type: 'date',
    value,
    min,
    max,
    'aria-label': label,
    'data-testid': testID,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      flex: 1,
      minHeight: touch.min,
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.text,
      backgroundColor: 'transparent',
      border: 'none',
      outline: 'none',
      padding: `${space.sm}px 0`,
      colorScheme: scheme,
    },
  });
  return (
    <View style={styles.wrap}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: error ? colors.danger : focused ? colors.text : colors.border }]}>{input}</View>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textFaint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    minHeight: touch.min + 4,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
});

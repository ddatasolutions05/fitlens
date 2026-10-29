// Web: the browser's time input, which phones open as a wheel. Native has its own file.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { unstable_createElement } from 'react-native-web';

import { Text } from './Text';
import { useTheme } from './theme';
import { fonts, radius, space, touch } from './tokens';

export interface TimeFieldProps {
  label: string;
  /** HH:MM, 24 hour. */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  testID?: string;
}

export function TimeField({ label, value, onChange, hint, testID }: TimeFieldProps) {
  const { colors, scheme } = useTheme();
  const [focused, setFocused] = useState(false);
  const input = unstable_createElement('input', {
    type: 'time',
    value,
    'aria-label': label,
    'data-testid': testID,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: { flex: 1, minHeight: touch.min, fontSize: 16, fontFamily: fonts.regular, color: colors.text, backgroundColor: 'transparent', border: 'none', outline: 'none', padding: `${space.sm}px 0`, colorScheme: scheme },
  });
  return (
    <View style={styles.wrap}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: focused ? colors.text : colors.border }]}>{input}</View>
      {hint ? (
        <Text variant="caption" color="textFaint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: { minHeight: touch.min + 4, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center' },
});

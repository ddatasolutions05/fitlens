import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space, touch } from './tokens';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
  wrap?: boolean;
}

/** Single-select chips, 44 px tall, wrapping when asked. The selected chip is a solid plate. */
export function Segmented<T extends string>({ options, value, onChange, label, wrap }: SegmentedProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? (
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      ) : null}
      <View style={[styles.row, wrap ? styles.rowWrap : null]}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              onPress={() => onChange(o.value)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent : 'transparent',
                  borderColor: selected ? colors.accent : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
                wrap ? null : styles.chipGrow,
              ]}
            >
              <Text variant="bodyStrong" style={{ color: selected ? colors.onAccent : colors.text, fontSize: 14, lineHeight: 18 }} align="center" numberOfLines={wrap ? undefined : 1}>
                {o.label}
              </Text>
              {o.hint ? (
                <Text variant="caption" style={{ color: selected ? colors.onAccent : colors.textMuted, opacity: selected ? 0.75 : 1 }} align="center">
                  {o.hint}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  rowWrap: { flexWrap: 'wrap' },
  chip: {
    minHeight: touch.min,
    maxWidth: '100%',
    flexShrink: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
  chipGrow: { flex: 1 },
});

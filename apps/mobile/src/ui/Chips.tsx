import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space, touch } from './tokens';

export interface ChipsProps {
  label?: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}

/** Multi-select chips; a selected chip is a solid plate. */
export function Chips({ label, options, value, onChange }: ChipsProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      {label ? (
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      ) : null}
      <View style={styles.row}>
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <Pressable
              key={o}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              style={({ pressed }) => [styles.chip, { backgroundColor: on ? colors.accent : 'transparent', borderColor: on ? colors.accent : colors.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text variant="bodyStrong" style={{ color: on ? colors.onAccent : colors.text, fontSize: 14, lineHeight: 18 }}>
                {o}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: touch.min - 4, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
});

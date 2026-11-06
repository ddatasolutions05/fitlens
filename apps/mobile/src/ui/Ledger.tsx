import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { space } from './tokens';

export interface LedgerRowProps {
  label: string;
  value: string;
  note?: string | null;
  /** Colour for the figure; placeholders such as "No data" stay quiet. */
  tint?: string;
  /** Marks a figure that met its target with a small dot before the label. */
  on?: boolean;
  testID?: string;
}

/** A plain stats list: rules between rows, no boxes. */
export function Ledger({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
      {children}
    </View>
  );
}

export function LedgerRow({ label, value, note, tint, on, testID }: LedgerRowProps) {
  const { colors } = useTheme();
  const placeholder = /^(no data|off|not set|unknown|none yet|none)$/i.test(value.trim());
  const fg = placeholder ? colors.textFaint : (tint ?? colors.text);
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`} testID={testID} style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.left}>
        <View style={styles.labelLine}>
          {on ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
          <Text variant="bodyStrong" maxFontSizeMultiplier={1.3}>
            {label}
          </Text>
        </View>
        {note ? (
          <Text variant="caption" color="textMuted" numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {note}
          </Text>
        ) : null}
      </View>
      <Text variant="title" tabular style={[styles.value, placeholder ? styles.quiet : null, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.3}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1 },
  left: { flex: 1, minWidth: 0, gap: 2 },
  labelLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  value: { fontSize: 24, lineHeight: 30, textAlign: 'right', maxWidth: '50%', flexShrink: 0 },
  quiet: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
});

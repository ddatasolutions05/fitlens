import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space } from './tokens';

export interface StatProps {
  label: string;
  value: string;
  /** Second line: comparison, unit or a short note. */
  note?: string | null;
  /** 'on' outlines a figure that met its target; 'inverse' is the plate style. */
  tone?: 'neutral' | 'on' | 'inverse';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A KPI tile: big tabular number, quiet label and note. */
export function Stat({ label, value, note, tone = 'neutral', style, testID }: StatProps) {
  const { colors } = useTheme();
  const inverse = tone === 'inverse';
  const fg = inverse ? colors.onInverse : colors.text;
  const muted = inverse ? colors.onInverse : colors.textMuted;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`}
      testID={testID}
      style={[
        styles.tile,
        { backgroundColor: inverse ? colors.inverse : colors.surface, borderColor: inverse ? colors.inverse : tone === 'on' ? colors.text : colors.border },
        style,
      ]}
    >
      <Text variant="caption" style={{ color: muted }} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
      <Text variant="title" tabular style={{ color: fg, fontSize: 24, lineHeight: 28 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.3}>
        {value}
      </Text>
      {note ? (
        <Text variant="caption" style={{ color: muted, opacity: inverse ? 0.75 : 1 }} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 140,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
    gap: 2,
  },
});

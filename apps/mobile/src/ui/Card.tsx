import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from './theme';
import { radius, space } from './tokens';

export interface CardProps extends ViewProps {
  padded?: boolean;
  /** inverse is the white plate on black (black on white in the light scheme). */
  tone?: 'surface' | 'alt' | 'accent' | 'inverse';
}

export function Card({ padded = true, tone = 'surface', style, ...rest }: CardProps) {
  const { colors } = useTheme();
  const bg = tone === 'inverse' ? colors.inverse : tone === 'accent' ? colors.accentSoft : tone === 'alt' ? colors.surfaceAlt : colors.surface;
  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: tone === 'inverse' ? colors.inverse : colors.border },
        padded ? styles.padded : null,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  padded: { padding: space.lg },
});

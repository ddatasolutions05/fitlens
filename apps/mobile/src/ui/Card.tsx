import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from './theme';
import { radius, space } from './tokens';

export interface CardProps extends ViewProps {
  padded?: boolean;
  tone?: 'surface' | 'alt' | 'accent';
}

export function Card({ padded = true, tone = 'surface', style, ...rest }: CardProps) {
  const { colors } = useTheme();
  const bg = tone === 'accent' ? colors.accentSoft : tone === 'alt' ? colors.surfaceAlt : colors.surface;
  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: colors.border },
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

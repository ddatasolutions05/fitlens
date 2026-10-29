import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from './theme';
import { type ColorName, type TypeName, type as typeScale } from './tokens';

export interface TextProps extends RNTextProps {
  variant?: TypeName;
  color?: ColorName;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
}

export function Text({ variant = 'body', color = 'text', align, tabular, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        typeScale[variant],
        { color: colors[color] },
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}

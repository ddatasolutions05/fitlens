import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from './Text';
import { useTheme } from './theme';

export interface RingProps {
  /** 0..1, values above 1 are drawn as a full ring in the same colour. */
  progress: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  textColor?: string;
  label: string;
  value: string;
  caption?: string;
  accessibilityLabel: string;
}

export function Ring({ progress, size = 168, stroke = 12, color, trackColor, textColor, label, value, caption, accessibilityLabel }: RingProps) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = progress == null ? 0 : Math.max(0, Math.min(1, progress));
  const ringColor = color ?? colors.accent;
  const fg = textColor ?? colors.text;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor ?? colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        {progress != null ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ringColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="butt"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - p)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Text variant="caption" style={{ color: fg, opacity: 0.7 }}>
        {label}
      </Text>
      <Text variant="title" tabular style={{ color: fg, fontSize: size > 140 ? 34 : 22, lineHeight: size > 140 ? 38 : 26 }}>
        {value}
      </Text>
      {caption ? (
        <Text variant="caption" style={{ color: fg, opacity: 0.7 }} align="center">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

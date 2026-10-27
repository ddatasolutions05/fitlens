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
  label: string;
  value: string;
  caption?: string;
  accessibilityLabel: string;
}

export function Ring({ progress, size = 168, stroke = 14, color, label, value, caption, accessibilityLabel }: RingProps) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = progress == null ? 0 : Math.max(0, Math.min(1, progress));
  const ringColor = color ?? colors.accent;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        {progress != null ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ringColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - p)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="display" tabular style={{ fontSize: size > 140 ? 36 : 24, lineHeight: size > 140 ? 40 : 28 }}>
        {value}
      </Text>
      {caption ? (
        <Text variant="caption" color="textMuted" align="center">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

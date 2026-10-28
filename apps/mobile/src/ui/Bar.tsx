import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { radius } from './tokens';

export interface BarProps {
  label: string;
  /** Current value, null means not logged. */
  value: number | null;
  target: number | null;
  unit: string;
  color: string;
  unknownCount?: number;
  compact?: boolean;
}

/** A track whose fill eases to its ratio; it jumps when reduced motion is on. */
export function AnimatedFill({ ratio, color, height = 6, track }: { ratio: number; color: string; height?: number; track: string }) {
  const { reducedMotion } = useTheme();
  const [width] = useState(() => new Animated.Value(reducedMotion ? ratio : 0));
  useEffect(() => {
    if (reducedMotion) {
      width.setValue(ratio);
      return;
    }
    Animated.timing(width, { toValue: ratio, duration: 500, useNativeDriver: false }).start();
  }, [ratio, reducedMotion, width]);
  return (
    <View style={[styles.track, { backgroundColor: track, height }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color, width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

export function Bar({ label, value, target, unit, color, unknownCount = 0, compact }: BarProps) {
  const { colors } = useTheme();
  const ratio = value != null && target ? Math.max(0, Math.min(1, value / target)) : 0;
  const valueText = value == null ? (unknownCount > 0 ? 'Unknown' : 'Not logged') : `${Math.round(value).toLocaleString()}${unit}`;
  const targetText = target != null ? ` / ${Math.round(target).toLocaleString()}${unit}` : '';
  const note = unknownCount > 0 ? `, ${unknownCount} unknown` : '';
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${valueText}${targetText}${note}`}
      accessibilityValue={target ? { min: 0, max: target, now: value ?? 0 } : undefined}
      style={styles.wrap}
    >
      <View style={styles.row}>
        <Text variant={compact ? 'caption' : 'small'} color="textMuted">
          {label}
        </Text>
        <Text variant={compact ? 'caption' : 'small'} tabular>
          {valueText}
          {target != null ? (
            <Text variant={compact ? 'caption' : 'small'} color="textFaint" tabular>
              {targetText}
            </Text>
          ) : null}
        </Text>
      </View>
      <AnimatedFill ratio={ratio} color={color} height={compact ? 4 : 6} track={colors.surfaceAlt} />
      {unknownCount > 0 ? (
        <Text variant="caption" color="textFaint">
          {unknownCount} item{unknownCount === 1 ? '' : 's'} with unknown {label.toLowerCase()} not counted
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});

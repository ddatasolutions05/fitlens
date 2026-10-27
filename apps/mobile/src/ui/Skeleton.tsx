import { useEffect } from 'react';
import { Animated, StyleSheet, View, useAnimatedValue, type ViewStyle } from 'react-native';

import { useTheme } from './theme';
import { radius, space } from './tokens';

export function Skeleton({ width = '100%', height = 16, round, style }: { width?: number | `${number}%`; height?: number; round?: boolean; style?: ViewStyle }) {
  const { colors, reducedMotion } = useTheme();
  const opacity = useAnimatedValue(0.6);
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reducedMotion]);
  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[
        { width, height, backgroundColor: colors.skeleton, borderRadius: round ? height / 2 : radius.sm, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton width="40%" height={14} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
});

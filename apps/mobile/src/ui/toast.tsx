// A one-line confirmation that slides up above the tab bar and leaves on its
// own. `toast('Water added')` from anywhere; ToastHost sits once in the root.
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space } from './tokens';

type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function toast(message: string): void {
  listeners.forEach((l) => l(message));
}

const SHOW_MS = 2200;

export function ToastHost() {
  const { colors, reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onToast: Listener = (m) => {
      setMessage(m);
      setShown(true);
      if (timer.current) clearTimeout(timer.current);
      if (reducedMotion) progress.setValue(1);
      else Animated.spring(progress, { toValue: 1, useNativeDriver: Platform.OS !== 'web', friction: 7, tension: 90 }).start();
      timer.current = setTimeout(() => {
        const done = () => setShown(false);
        if (reducedMotion) {
          progress.setValue(0);
          done();
        } else Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(done);
      }, SHOW_MS);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [progress, reducedMotion]);

  if (!shown || !message) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        testID="toast"
        style={[
          styles.toast,
          { backgroundColor: colors.inverse, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        ]}
      >
        <Icon name="check" size={16} color={colors.onInverse} strokeWidth={2.4} />
        <Text variant="bodyStrong" style={{ color: colors.onInverse }} numberOfLines={2}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.lg },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, maxWidth: 420 },
});

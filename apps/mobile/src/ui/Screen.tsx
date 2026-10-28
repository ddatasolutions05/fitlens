import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from './theme';
import { layout, space } from './tokens';

export interface ScreenProps extends ScrollViewProps {
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: boolean;
  children: React.ReactNode;
}

/** Full-height screen with safe-area padding and a centred column on wide viewports. */
export function Screen({ scroll = true, padded = true, bottomInset = true, children, contentContainerStyle, style, ...rest }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const paddingBottom = bottomInset ? Math.max(insets.bottom, space.lg) + space.xl : 0;

  const column = (
    <View style={[styles.column, padded ? { paddingHorizontal: layout.gutter } : null]}>{children}</View>
  );

  if (!scroll) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom }, style]}>
        {column}
      </View>
    );
  }
  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        {...rest}
        style={[styles.root, style]}
        contentContainerStyle={[{ paddingTop: insets.top + space.sm, paddingBottom }, contentContainerStyle]}
      >
        {column}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', gap: space.xl },
});

import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { space } from './tokens';

/** A quiet aside with a rule on the left: why we ask, what happens next. */
export function Note({ label, children }: { label?: string; children: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { borderLeftColor: colors.border }]}>
      {label ? (
        <Text variant="label" color="textFaint">
          {label}
        </Text>
      ) : null}
      <Text variant="small" color="textMuted">
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderLeftWidth: 2, paddingLeft: space.md, paddingVertical: 2, gap: 2 },
});

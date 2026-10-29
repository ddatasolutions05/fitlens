import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { config } from '@/lib/config';
import { track } from '@/lib/telemetry';
import { Icon, Text, radius, space, toast, useTheme } from '@/ui';

function tagFor(name: string | null | undefined, userId: string): string {
  const first = (name ?? '').trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]+/g, '') ?? '';
  return `ref-${first || userId.slice(0, 6)}`;
}

/** A tagged link so the admin page shows who brought whom. */
export function ShareRow({ name, userId }: { name: string | null | undefined; userId: string }) {
  const { colors } = useTheme();
  if (Platform.OS !== 'web') return null;
  const link = `${window.location.origin}${config.basePath}/?s=${tagFor(name, userId)}`;
  const share = async () => {
    track('share_clicked');
    const text = `I'm using ${config.brandName} to keep track of what I eat. Try it: ${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: config.brandName, text, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast('Link copied. Send it to a friend.');
    } catch {
      // the share sheet was closed; nothing to do
    }
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Share with a friend" onPress={() => void share()} testID="home-share" style={({ pressed }) => [styles.row, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <Icon name="profile" size={20} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">Share with a friend</Text>
        <Text variant="caption" color="textMuted">
          Your own link, so you can see who joined
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
});

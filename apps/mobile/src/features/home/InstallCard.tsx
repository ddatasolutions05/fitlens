import { useState } from 'react';
import { View } from 'react-native';

import { appName, dismissInstall, installKind, promptInstall, type InstallKind } from '@/lib/install';
import { track } from '@/lib/telemetry';
import { Button, Card, Text, space, toast } from '@/ui';

/** Asks once to put the app on the Home Screen; that is where reminders and the instant open come from. */
export function InstallCard() {
  const [kind, setKind] = useState<InstallKind>(() => {
    const k = installKind();
    if (k !== 'none') track('install_shown', { kind: k });
    return k;
  });
  if (kind === 'none') return null;
  const close = () => {
    dismissInstall();
    track('install_dismissed');
    setKind('none');
  };
  return (
    <Card style={{ gap: space.md }} testID="install-card">
      <Text variant="bodyStrong">Put {appName()} on your Home Screen</Text>
      {kind === 'ios-steps' ? (
        <Text color="textMuted">Tap the Share button at the bottom of Safari, then Add to Home Screen. It opens full screen, loads instantly, and the daily reminder can reach you.</Text>
      ) : (
        <Text color="textMuted">It opens full screen, loads instantly, and the daily reminder can reach you.</Text>
      )}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {kind === 'prompt' ? (
          <Button
            label="Install"
            style={{ flex: 1 }}
            onPress={async () => {
              track('install_clicked');
              const r = await promptInstall();
              if (r === 'accepted') {
                toast('Added to your Home Screen');
                setKind('none');
              }
            }}
            testID="install-now"
          />
        ) : (
          <Button label="Got it" style={{ flex: 1 }} onPress={close} testID="install-got-it" />
        )}
        <Button label="Not now" variant="ghost" style={{ flex: 1 }} onPress={close} testID="install-later" />
      </View>
    </Card>
  );
}

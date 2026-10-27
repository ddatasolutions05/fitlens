import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';
import { space } from './tokens';

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <Card tone="alt" style={styles.center}>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text color="textMuted" align="center">
          {body}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </Card>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <Card style={styles.center}>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text color="textMuted" align="center">
          {message}
        </Text>
      ) : null}
      {onRetry ? <Button label="Try again" onPress={onRetry} variant="secondary" /> : null}
    </Card>
  );
}

export function NotConfigured({ feature, reason }: { feature: string; reason: string }) {
  return (
    <Card tone="alt" style={styles.center}>
      <Text variant="bodyStrong" align="center">
        {feature}: not configured
      </Text>
      <Text color="textMuted" variant="small" align="center">
        {reason}
      </Text>
    </Card>
  );
}

export function ComingSoon({ feature, body }: { feature: string; body: string }) {
  return (
    <Card tone="alt" style={styles.center}>
      <Text variant="heading" align="center">
        {feature}
      </Text>
      <Text color="textMuted" align="center">
        Coming soon. {body}
      </Text>
    </Card>
  );
}

export function OfflineBanner({ pending, parked, syncing, onRetry }: { pending: number; parked: number; syncing: boolean; onRetry: () => void }) {
  if (pending === 0 && parked === 0) return null;
  return (
    <Card tone="alt" style={styles.banner}>
      <View style={{ flex: 1 }}>
        <Text variant="small">
          {syncing ? 'Syncing…' : pending > 0 ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync` : ''}
          {parked > 0 ? `${pending > 0 ? ' · ' : ''}${parked} need${parked === 1 ? 's' : ''} attention` : ''}
        </Text>
      </View>
      {parked > 0 ? <Button label="Retry" size="sm" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.md },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
});

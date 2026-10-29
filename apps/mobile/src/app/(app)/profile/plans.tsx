import { Linking, StyleSheet, View } from 'react-native';

import { config } from '@/lib/config';
import { Button, Card, Note, PageHeader, Screen, Text, space, useTheme } from '@/ui';

const PLANS = [
  { key: 'member', name: 'Gym member', price: 'Included', note: 'with a participating gym membership', points: ['Food, activity and weight tracking', 'Photo and label reading', 'Workout plans', 'Shares a weekly summary with your trainer'] },
  { key: 'personal', name: 'Personal', price: 'CAD 9 a month', note: 'or CAD 79 a year', points: ['Everything in Gym member', 'The Coach, 30 questions a day', 'Export your data any time'] },
  { key: 'gym', name: 'Gym', price: 'CAD 4 a member a month', note: 'trainer seats included', points: ['Your name and logo on the app', 'Trainer view for every coach', 'Member activity overview', 'Set-up help and a demo'] },
];

export default function PlansScreen() {
  const { colors } = useTheme();
  return (
    <Screen testID="plans-screen">
      <PageHeader title="Plans" subtitle="Draft pricing while the app is in testing. Nothing is charged today." backTo="/profile" />
      {PLANS.map((p, i) => (
        <Card key={p.key} tone={i === 1 ? 'inverse' : undefined} style={{ gap: space.sm }} testID={`plan-${p.key}`}>
          <Text variant="label" style={i === 1 ? { color: colors.onInverse, opacity: 0.6 } : undefined} color={i === 1 ? undefined : 'textMuted'}>
            {p.name}
          </Text>
          <Text variant="title" style={i === 1 ? { color: colors.onInverse } : undefined}>
            {p.price}
          </Text>
          <Text variant="caption" style={i === 1 ? { color: colors.onInverse, opacity: 0.7 } : undefined} color={i === 1 ? undefined : 'textMuted'}>
            {p.note}
          </Text>
          <View style={styles.points}>
            {p.points.map((pt) => (
              <Text key={pt} variant="small" style={i === 1 ? { color: colors.onInverse } : undefined}>
                {pt}
              </Text>
            ))}
          </View>
        </Card>
      ))}
      {config.contactEmail ? <Button label="Ask about pricing" variant="secondary" onPress={() => void Linking.openURL(`mailto:${config.contactEmail}?subject=${encodeURIComponent(`${config.brandName} plans`)}`)} testID="plans-contact" /> : null}
      <Note>Prices are placeholders for the conversation with a gym and will change. Everyone testing today keeps full access.</Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  points: { gap: 4, marginTop: space.xs },
});

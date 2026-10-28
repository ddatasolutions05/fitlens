import { Platform } from 'react-native';

import { Card, NotConfigured, PageHeader, Screen, space, Text } from '@/ui';

export default function Integrations() {
  const native = Platform.OS === 'ios' || Platform.OS === 'android';
  return (
    <Screen testID="integrations-screen">
      <PageHeader title="Connected health apps" backTo="/profile" />
      <Card style={{ gap: space.md }}>
        <Text variant="heading">Apple Health</Text>
        <NotConfigured feature="HealthKit" reason={native ? 'Requires native build. This Expo Go or development build does not include the HealthKit module yet.' : 'Requires native build. Not available on the web.'} />
      </Card>
      <Card style={{ gap: space.md }}>
        <Text variant="heading">Health Connect (Android)</Text>
        <NotConfigured feature="Health Connect" reason={native ? 'Requires native build. Not included in this build yet.' : 'Requires native build. Not available on the web.'} />
      </Card>
      <Text variant="small" color="textMuted">
        Manual steps, workouts and weight stay fully usable. When a connection is added, steps for a day come from one preferred source only, workouts are deduplicated by id and overlapping time, and each record shows its source and last sync time.
      </Text>
    </Screen>
  );
}

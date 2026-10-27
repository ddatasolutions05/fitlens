import { ComingSoon, Screen, Text, space } from '@/ui';

export default function CoachScreen() {
  return (
    <Screen>
      <Text variant="title" style={{ marginTop: space.lg }}>
        Coach
      </Text>
      <ComingSoon
        feature="Chat grounded in your logs"
        body="Ask what to eat for dinner, how to reach protein, or how consistent the week was. Every answer stays within your own data, and any action the Coach proposes needs your confirmation. Until then, the Insight card on Today is computed from your logs."
      />
    </Screen>
  );
}

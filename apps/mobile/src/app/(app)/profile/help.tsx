import { router } from 'expo-router';
import { View } from 'react-native';

import { config } from '@/lib/config';
import { Button, Card, Note, PageHeader, Screen, Text, space } from '@/ui';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'What counts toward the day',
    body: 'Only confirmed meals count. A draft (dashed border) is a meal you have not finished yet: photo scans and copied meals start as drafts so nothing is counted by accident. Open it and tap Confirm when it is right.',
  },
  {
    title: 'Where the numbers come from',
    body: 'Search uses three public food databases (USDA, the Canadian Nutrient File and an Indian foods table) plus foods you have entered. A scanned plate is identified by an AI model and matched to those same databases; the portion is an estimate you can change. Packaged products come from Open Food Facts or the label you photograph.',
  },
  {
    title: 'What "unknown" means',
    body: 'When a food has no value for a nutrient, the app leaves it unknown rather than pretending it is zero. Totals say how many items were left out. Enter the value yourself and it is used from then on.',
  },
  {
    title: 'Targets and burn',
    body: 'Resting energy comes from the Mifflin-St Jeor formula with your height, weight, age and sex. Daily burn multiplies it by your activity level. The food target is burn minus the deficit for your goal, or burn itself for maintenance. Steps and workouts are shown but not added on top, so nothing is counted twice. Tracking-only mode sets no deficit at all.',
  },
  {
    title: 'The weight trend',
    body: 'Daily weigh-ins swing with water, salt and timing. The trend line smooths them. Weigh at the same time of day when you can, and judge progress on the trend, not on one morning.',
  },
  {
    title: 'The Coach',
    body: 'The Coach answers from your own logs of the last fourteen days and never sees your photos. Every action it suggests waits for your tap. It needs the AI consent under Profile, which you can withdraw at any time.',
  },
  {
    title: 'Workouts',
    body: 'Your plan is built from how many days you train, how long, your experience, your goal and your kit. Logging a session from a workout page records it as activity with a calorie estimate from its intensity and your weight.',
  },
  {
    title: 'Trainers',
    body: 'If a coach gives you a six-character code, enter it under Profile, Your trainer. They then see a weekly summary: days logged, calories, protein, workouts and weight. Never your meals, photos or notes. Stop sharing at any time.',
  },
  {
    title: 'Your data',
    body: 'Everything lives in your own account. Export builds a zip of every table and photo; Delete removes all of it and your sign-in immediately. Photos go to the AI provider only after you opt in, and the provider does not train on them.',
  },
];

export default function HelpScreen() {
  return (
    <Screen testID="help-screen">
      <PageHeader title={`How ${config.brandName} works`} subtitle="Short answers to the questions people ask in the first week." backTo="/profile" />
      {SECTIONS.map((s) => (
        <Card key={s.title} style={{ gap: space.xs }}>
          <Text variant="heading" style={{ fontSize: 18, lineHeight: 24 }}>
            {s.title}
          </Text>
          <Text color="textMuted">{s.body}</Text>
        </Card>
      ))}
      <Note>Estimates are approximate and not medical advice. If you are managing a condition, set targets with your care provider and use tracking-only mode.</Note>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Ask the Coach" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/coach')} />
        <Button label="Privacy and consent" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/profile/privacy')} />
      </View>
    </Screen>
  );
}

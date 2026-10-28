import { Card, Screen, Text, space } from '@/ui';
import { config, setupProblems } from '@/lib/config';

export default function Setup() {
  const problems = setupProblems();
  return (
    <Screen>
      <Text variant="title" style={{ marginTop: space.xxl }}>
        {config.brandName} needs a Supabase project
      </Text>
      <Text color="textMuted">
        The app stores your data in your own Supabase project. Nothing runs until it is connected.
      </Text>
      <Card style={{ gap: space.md }}>
        <Text variant="heading">Missing configuration</Text>
        {problems.map((p) => (
          <Text key={p.key} variant="small">
            • {p.message}
          </Text>
        ))}
      </Card>
      <Card style={{ gap: space.md }}>
        <Text variant="heading">Setup in five steps</Text>
        <Text variant="small">1. Create a free project at supabase.com and open Project Settings, API.</Text>
        <Text variant="small">2. Copy .env.example to .env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</Text>
        <Text variant="small">3. Run npx supabase link, then npx supabase db push to create the tables.</Text>
        <Text variant="small">4. Run npx supabase functions deploy and set the function secrets listed in .env.example.</Text>
        <Text variant="small">5. Restart the dev server so the new variables are picked up.</Text>
      </Card>
      <Text variant="caption" color="textFaint">
        Full details are in CLAUDE.md and docs/PLAN.md in the repository.
      </Text>
    </Screen>
  );
}

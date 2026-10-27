import { router } from 'expo-router';

import { MealEditor } from '@/features/meals/MealEditor';
import { Button, Screen, Text, space } from '@/ui';

export default function EditDraft() {
  return (
    <Screen testID="meal-edit-screen">
      <Text variant="title" style={{ marginTop: space.md }}>
        Review meal
      </Text>
      <MealEditor mode="new" />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

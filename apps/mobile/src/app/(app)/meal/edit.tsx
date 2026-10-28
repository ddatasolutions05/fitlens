
import { MealEditor } from '@/features/meals/MealEditor';
import { PageHeader, Screen } from '@/ui';

export default function EditDraft() {
  return (
    <Screen testID="meal-edit-screen">
      <PageHeader title="Review meal" backTo="/today" />
      <MealEditor mode="new" />
    </Screen>
  );
}

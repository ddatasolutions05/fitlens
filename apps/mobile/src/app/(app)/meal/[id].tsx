import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { draftFromMeal } from '@/features/meals/api';
import { getDraft, setDraft } from '@/features/meals/draft-store';
import { useMeal } from '@/features/meals/hooks';
import { MealEditor } from '@/features/meals/MealEditor';
import { EmptyState, ErrorState, PageHeader, Screen, SkeletonCard } from '@/ui';

export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meal = useMeal(id ?? null);

  useEffect(() => {
    if (meal.data && getDraft()?.mealId !== meal.data.id) setDraft(draftFromMeal(meal.data));
  }, [meal.data]);

  return (
    <Screen testID="meal-detail">
      <PageHeader title={meal.data?.status === 'draft' ? 'Draft meal' : 'Edit meal'} backTo="/today" />
      {meal.isLoading ? (
        <SkeletonCard lines={4} />
      ) : meal.isError ? (
        <ErrorState message={(meal.error as Error).message} onRetry={() => meal.refetch()} />
      ) : !meal.data ? (
        <EmptyState title="Meal not found" body="It may have been deleted." action={{ label: 'Back to Today', onPress: () => router.replace('/today') }} />
      ) : (
        <MealEditor mode="existing" />
      )}
    </Screen>
  );
}

// Copies a day's confirmed meals onto another date as drafts, same times of
// day, fresh ids. The person confirms each one, so nothing counts by accident.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { localDateTimeToIso, timeInZone } from '@fitlens/core';

import { useUserId } from '@/features/auth/session';
import { dayKeys } from '@/features/day/hooks';

import { draftFromMeal, saveMeal, type MealWithItems } from './api';
import { newIdempotencyKey, newLocalId } from './model';

export async function copyMealsAsDrafts(i: { userId: string; meals: MealWithItems[]; toDate: string }): Promise<number> {
  let n = 0;
  for (const meal of i.meals) {
    if (meal.meal_items.length === 0) continue;
    const draft = draftFromMeal(meal);
    await saveMeal({
      userId: i.userId,
      status: 'draft',
      draft: {
        ...draft,
        mealId: null,
        idempotencyKey: newIdempotencyKey(),
        localDate: i.toDate,
        eatenAt: localDateTimeToIso(i.toDate, timeInZone(draft.eatenAt, draft.tz), draft.tz),
        eatenAtSource: 'manual',
        previouslyConfirmed: false,
        photos: [],
        items: draft.items.map((it) => ({ ...it, localId: newLocalId() })),
      },
    });
    n += 1;
  }
  return n;
}

export function useCopyMealsAsDrafts() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { meals: MealWithItems[]; toDate: string }) => copyMealsAsDrafts({ userId, ...p }),
    onSuccess: (_n, p) => {
      void qc.invalidateQueries({ queryKey: dayKeys.day(userId, p.toDate) });
      void qc.invalidateQueries({ queryKey: ['log-days'] });
    },
  });
}

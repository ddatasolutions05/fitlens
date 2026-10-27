import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useUserId } from '@/features/auth/session';
import { registerHandler, runOrQueue } from '@/lib/offline-queue';

import { deleteMeal, deletePhoto, fetchMeal, saveMeal, setMealStatus, type SaveMealPayload } from './api';
import type { MealDraft } from './model';

const KIND_SAVE = 'meal.save';
const KIND_DELETE = 'meal.delete';
const KIND_STATUS = 'meal.status';
const KIND_DELETE_PHOTO = 'meal.deletePhoto';

let registered = false;
function ensureHandlers(): void {
  if (registered) return;
  registered = true;
  registerHandler<SaveMealPayload>(KIND_SAVE, async (p) => {
    await saveMeal(p);
  });
  registerHandler<{ mealId: string }>(KIND_DELETE, deleteMeal);
  registerHandler<{ mealId: string; status: 'draft' | 'confirmed' }>(KIND_STATUS, setMealStatus);
  registerHandler<{ photoId: string; storagePath: string }>(KIND_DELETE_PHOTO, deletePhoto);
}
ensureHandlers();

export const mealKeys = {
  meal: (id: string) => ['meal', id] as const,
};

export function useMeal(mealId: string | null) {
  return useQuery({
    queryKey: mealKeys.meal(mealId ?? 'none'),
    queryFn: () => fetchMeal(mealId as string),
    enabled: Boolean(mealId),
  });
}

function useInvalidateDay() {
  const qc = useQueryClient();
  const userId = useUserId();
  return (localDate?: string) => {
    void qc.invalidateQueries({ queryKey: localDate ? ['day', userId, localDate] : ['day', userId] });
    void qc.invalidateQueries({ queryKey: ['progress', userId] });
    void qc.invalidateQueries({ queryKey: ['recents', userId] });
  };
}

/** Saves a draft or confirms it. Returns `queued: true` when stored offline. */
export function useSaveMeal() {
  const userId = useUserId();
  const invalidate = useInvalidateDay();
  const qc = useQueryClient();
  useEffect(ensureHandlers, []);
  return useMutation({
    mutationFn: async (i: { draft: MealDraft; status: 'draft' | 'confirmed' }) => {
      const result = await runOrQueue<SaveMealPayload>(KIND_SAVE, { userId, draft: i.draft, status: i.status });
      return result;
    },
    onSuccess: (_r, vars) => {
      invalidate(vars.draft.localDate);
      if (vars.draft.mealId) void qc.invalidateQueries({ queryKey: mealKeys.meal(vars.draft.mealId) });
    },
  });
}

export function useDeleteMeal() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: async (i: { mealId: string; localDate: string }) => runOrQueue(KIND_DELETE, { mealId: i.mealId }),
    onSuccess: (_r, vars) => invalidate(vars.localDate),
  });
}

export function useSetMealStatus() {
  const invalidate = useInvalidateDay();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { mealId: string; status: 'draft' | 'confirmed'; localDate: string }) =>
      runOrQueue(KIND_STATUS, { mealId: i.mealId, status: i.status }),
    onSuccess: (_r, vars) => {
      invalidate(vars.localDate);
      void qc.invalidateQueries({ queryKey: mealKeys.meal(vars.mealId) });
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { photoId: string; storagePath: string; mealId: string }) =>
      runOrQueue(KIND_DELETE_PHOTO, { photoId: i.photoId, storagePath: i.storagePath }),
    onSuccess: (_r, vars) => {
      void qc.invalidateQueries({ queryKey: mealKeys.meal(vars.mealId) });
    },
  });
}

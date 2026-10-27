import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import { registerHandler, runOrQueue } from '@/lib/offline-queue';

import {
  deleteActivity,
  deleteWater,
  deleteWeight,
  setDayStatus,
  upsertSteps,
  upsertWater,
  upsertWeight,
  upsertWorkout,
  type DayStatusPayload,
  type StepsPayload,
  type WaterPayload,
  type WeightPayload,
  type WorkoutPayload,
} from './api';

const KINDS = {
  weight: 'log.weight',
  weightDelete: 'log.weight.delete',
  water: 'log.water',
  waterDelete: 'log.water.delete',
  steps: 'log.steps',
  workout: 'log.workout',
  activityDelete: 'log.activity.delete',
  dayStatus: 'log.dayStatus',
} as const;

registerHandler<WeightPayload>(KINDS.weight, upsertWeight);
registerHandler<{ id: string }>(KINDS.weightDelete, deleteWeight);
registerHandler<WaterPayload>(KINDS.water, upsertWater);
registerHandler<{ id: string }>(KINDS.waterDelete, deleteWater);
registerHandler<StepsPayload>(KINDS.steps, upsertSteps);
registerHandler<WorkoutPayload>(KINDS.workout, upsertWorkout);
registerHandler<{ id: string }>(KINDS.activityDelete, deleteActivity);
registerHandler<DayStatusPayload>(KINDS.dayStatus, setDayStatus);

function useInvalidate() {
  const qc = useQueryClient();
  const userId = useUserId();
  return (localDate?: string) => {
    void qc.invalidateQueries({ queryKey: localDate ? ['day', userId, localDate] : ['day', userId] });
    void qc.invalidateQueries({ queryKey: ['progress', userId] });
    void qc.invalidateQueries({ queryKey: ['weight', userId] });
    void qc.invalidateQueries({ queryKey: ['logs', userId] });
  };
}

export function useLogWeight() {
  const userId = useUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: Omit<WeightPayload, 'userId'>) => runOrQueue(KINDS.weight, { ...p, userId }),
    onSuccess: (_r, p) => invalidate(p.localDate),
  });
}

export function useDeleteWeight() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: { id: string }) => runOrQueue(KINDS.weightDelete, p),
    onSuccess: () => invalidate(),
  });
}

export function useLogWater() {
  const userId = useUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: Omit<WaterPayload, 'userId'>) => runOrQueue(KINDS.water, { ...p, userId }),
    onSuccess: (_r, p) => invalidate(p.localDate),
  });
}

export function useDeleteWater() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: { id: string }) => runOrQueue(KINDS.waterDelete, p),
    onSuccess: () => invalidate(),
  });
}

export function useLogSteps() {
  const userId = useUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: Omit<StepsPayload, 'userId'>) => runOrQueue(KINDS.steps, { ...p, userId }),
    onSuccess: (_r, p) => invalidate(p.localDate),
  });
}

export function useLogWorkout() {
  const userId = useUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: Omit<WorkoutPayload, 'userId'>) => runOrQueue(KINDS.workout, { ...p, userId }),
    onSuccess: (_r, p) => invalidate(p.localDate),
  });
}

export function useDeleteActivity() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: { id: string }) => runOrQueue(KINDS.activityDelete, p),
    onSuccess: () => invalidate(),
  });
}

export function useSetDayStatus() {
  const userId = useUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (p: Omit<DayStatusPayload, 'userId'>) => runOrQueue(KINDS.dayStatus, { ...p, userId }),
    onSuccess: (_r, p) => invalidate(p.localDate),
  });
}

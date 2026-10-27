// The meal being built right now. Search and scan add items here; the editor
// screen renders it and saves it.
import { useSyncExternalStore } from 'react';
import { deviceTimeZone, localDateTimeToIso, todayLocal } from '@fitlens/core';

import { emptyDraft, type DraftItem, type DraftPhoto, type MealDraft, type MealSource, type MealType } from './model';

let draft: MealDraft | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function getDraft(): MealDraft | null {
  return draft;
}

export function setDraft(next: MealDraft | null): void {
  draft = next;
  emit();
}

export function updateDraft(fn: (d: MealDraft) => MealDraft): void {
  if (!draft) return;
  draft = fn(draft);
  emit();
}

export function mealTypeForHour(hour: number): MealType {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
}

/** Starts a fresh draft for a date unless one is already open for that date. */
export function ensureDraft(i: { localDate: string; source: MealSource; tz?: string }): MealDraft {
  const tz = i.tz ?? deviceTimeZone();
  const now = new Date();
  const isToday = i.localDate === todayLocal(tz);
  const eatenAt = isToday ? now.toISOString() : localDateTimeToIso(i.localDate, '12:00', tz);
  if (!draft || draft.mealId || draft.localDate !== i.localDate) {
    draft = emptyDraft({ localDate: i.localDate, eatenAt, tz, mealType: mealTypeForHour(isToday ? now.getHours() : 12), source: i.source });
    emit();
  }
  return draft;
}

export function addItem(item: DraftItem): void {
  updateDraft((d) => ({ ...d, items: [...d.items, item] }));
}

export function updateItem(localId: string, patch: Partial<DraftItem>): void {
  updateDraft((d) => ({ ...d, items: d.items.map((it) => (it.localId === localId ? { ...it, ...patch } : it)) }));
}

export function removeItem(localId: string): void {
  updateDraft((d) => ({ ...d, items: d.items.filter((it) => it.localId !== localId) }));
}

export function addPhoto(photo: DraftPhoto): void {
  updateDraft((d) => ({ ...d, photos: [...d.photos, photo] }));
}

export function useDraft(): MealDraft | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => draft,
    () => draft,
  );
}

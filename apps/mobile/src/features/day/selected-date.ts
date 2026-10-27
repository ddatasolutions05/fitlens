// The date the Today and Diary tabs are looking at. Shared so switching tabs
// keeps the same day.
import { useSyncExternalStore } from 'react';
import { todayLocal } from '@fitlens/core';

let selected = todayLocal();
const listeners = new Set<() => void>();

export function setSelectedDate(localDate: string): void {
  selected = localDate;
  listeners.forEach((l) => l());
}

export function getSelectedDate(): string {
  return selected;
}

export function useSelectedDate(): [string, (d: string) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selected,
    () => selected,
  );
  return [value, setSelectedDate];
}

// Conversation kept on the device only. The server sees the last few turns
// with each question and stores nothing but the usage counter.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { CoachAction } from '@fitlens/schemas';

export interface CoachMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  actions?: CoachAction[];
  groundedOn?: string[];
  at: string;
}

const STORAGE_KEY = 'fitlens.coach.v1';
const MAX_MESSAGES = 40;

let messages: CoachMessage[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  } catch {
    // Storage is a convenience; the conversation still lives in memory.
  }
}

export async function loadConversation(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CoachMessage[];
      if (Array.isArray(parsed)) messages = parsed;
    }
  } catch {
    messages = [];
  }
  emit();
}

export function appendMessage(m: Omit<CoachMessage, 'id' | 'at'>): CoachMessage {
  const full: CoachMessage = { ...m, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString() };
  messages = [...messages, full].slice(-MAX_MESSAGES);
  emit();
  void persist();
  return full;
}

export function clearConversation(): void {
  messages = [];
  emit();
  void persist();
}

export function useConversation(): CoachMessage[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => messages,
    () => messages,
  );
}

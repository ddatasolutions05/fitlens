// A small durable command queue. Writes that fail with a network error are
// parked here and replayed with exponential backoff. Handlers must be
// idempotent (upsert by key) because a replay can follow a partial success.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isNetworkError, isProbablyOnline, onOnline } from './net';

const STORAGE_KEY = 'fitlens.offline-queue.v1';
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

export interface QueuedCommand {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  parked: boolean;
}

export interface QueueStatus {
  pending: number;
  parked: number;
  syncing: boolean;
  lastSyncAt: string | null;
}

type Handler = (payload: never) => Promise<void>;

const handlers = new Map<string, Handler>();
const listeners = new Set<(s: QueueStatus) => void>();
let queue: QueuedCommand[] = [];
let loaded = false;
let syncing = false;
let lastSyncAt: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function registerHandler<P>(kind: string, handler: (payload: P) => Promise<void>): void {
  handlers.set(kind, handler as Handler);
}

function status(): QueueStatus {
  return {
    pending: queue.filter((c) => !c.parked).length,
    parked: queue.filter((c) => c.parked).length,
    syncing,
    lastSyncAt,
  };
}

function notify(): void {
  const s = status();
  listeners.forEach((l) => l(s));
}

export function subscribe(listener: (s: QueueStatus) => void): () => void {
  listeners.add(listener);
  listener(status());
  return () => {
    listeners.delete(listener);
  };
}

export function getStatus(): QueueStatus {
  return status();
}

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) queue = JSON.parse(raw) as QueuedCommand[];
  } catch {
    queue = [];
  }
  notify();
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Storage failures are not fatal: the in-memory queue still drains.
  }
  notify();
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Runs the handler now when online. On a network failure the command is
 * queued and the promise resolves with `queued: true`.
 */
export async function runOrQueue<P>(kind: string, payload: P): Promise<{ queued: boolean }> {
  await load();
  const handler = handlers.get(kind);
  if (!handler) throw new Error(`No handler registered for ${kind}`);
  if (isProbablyOnline() && queue.length === 0) {
    try {
      await handler(payload as never);
      return { queued: false };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }
  queue.push({
    id: newId(),
    kind,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: Date.now(),
    lastError: null,
    parked: false,
  });
  await persist();
  schedule(0);
  return { queued: true };
}

export async function processQueue(): Promise<void> {
  await load();
  if (syncing) return;
  syncing = true;
  notify();
  try {
    for (const cmd of [...queue]) {
      if (cmd.parked || cmd.nextAttemptAt > Date.now()) continue;
      const handler = handlers.get(cmd.kind);
      if (!handler) {
        cmd.parked = true;
        cmd.lastError = 'no handler';
        continue;
      }
      try {
        await handler(cmd.payload as never);
        queue = queue.filter((c) => c.id !== cmd.id);
        lastSyncAt = new Date().toISOString();
      } catch (err) {
        cmd.attempts += 1;
        cmd.lastError = err instanceof Error ? err.message : String(err);
        if (!isNetworkError(err) || cmd.attempts >= MAX_ATTEMPTS) {
          cmd.parked = true;
        } else {
          cmd.nextAttemptAt = Date.now() + BASE_DELAY_MS * 2 ** (cmd.attempts - 1);
        }
        if (isNetworkError(err)) break;
      }
    }
    await persist();
  } finally {
    syncing = false;
    notify();
    const next = queue.filter((c) => !c.parked).map((c) => c.nextAttemptAt);
    if (next.length) schedule(Math.max(0, Math.min(...next) - Date.now()));
  }
}

function schedule(delayMs: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void processQueue();
  }, delayMs);
}

export async function retryParked(): Promise<void> {
  await load();
  queue.forEach((c) => {
    if (c.parked) {
      c.parked = false;
      c.attempts = 0;
      c.nextAttemptAt = Date.now();
    }
  });
  await persist();
  schedule(0);
}

export async function discardParked(): Promise<void> {
  await load();
  queue = queue.filter((c) => !c.parked);
  await persist();
}

export function startQueue(): () => void {
  void load().then(() => schedule(0));
  return onOnline(() => schedule(0));
}

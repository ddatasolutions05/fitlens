// Error reports go to the owner's own Supabase project (client_events). Nothing
// else is collected: no screen views, no food content, no photos.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { config } from './config';
import type { Json } from './database.types';
import { errorMessage } from './net';
import { supabase } from './supabase';

const MAX_PER_SESSION = 25;
const REPEAT_WINDOW_MS = 60_000;
const lastSent = new Map<string, number>();
let sent = 0;

function trim(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function userAgent(): string {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') return trim(navigator.userAgent, 300);
  return trim(`${Platform.OS} ${String(Platform.Version)}`, 300);
}

function route(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return trim(window.location.pathname, 200);
  return null;
}

/** Records a caught error. Safe to call anywhere; never throws, never blocks. */
export function reportError(scope: string, err: unknown, extra?: Record<string, Json>): void {
  try {
    if (!config.supabaseConfigured) return;
    const message = trim(errorMessage(err) || 'Unknown error', 500);
    const key = `${scope}|${message}`;
    const now = Date.now();
    const last = lastSent.get(key);
    if (last && now - last < REPEAT_WINDOW_MS) return;
    if (sent >= MAX_PER_SESSION) return;
    lastSent.set(key, now);
    sent += 1;
    const stack = err instanceof Error && err.stack ? trim(err.stack, 2000) : null;
    void send({
      scope: trim(scope, 80),
      message,
      stack,
      platform: Platform.OS,
      user_agent: userAgent(),
      app_version: Constants.expoConfig?.version ?? null,
      route: route(),
      extra: extra ?? null,
    });
  } catch {
    // Reporting must never take the app down with it.
  }
}

/** Records a named usage event for the funnel (onboarding, first meal, scan, coach, workout). No content, just the name and a few flags. */
export function track(name: string, extra?: Record<string, Json>): void {
  try {
    if (!config.supabaseConfigured) return;
    void send({ scope: trim(name, 80), message: trim(name, 500), stack: null, platform: Platform.OS, user_agent: userAgent(), app_version: Constants.expoConfig?.version ?? null, route: route(), extra: extra ?? null }, 'event');
  } catch {
    // never let analytics break a screen
  }
}

interface EventRow {
  scope: string;
  message: string;
  stack: string | null;
  platform: string;
  user_agent: string;
  app_version: string | null;
  route: string | null;
  extra: Record<string, Json> | null;
}

async function send(row: EventRow, kind: 'error' | 'event' = 'error'): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    await supabase.from('client_events').insert({ ...row, kind, user_id: data.session?.user.id ?? null });
  } catch {
    // Offline or blocked; the row is dropped.
  }
}

let installed = false;

/** Catches errors nothing else caught: window errors and unhandled promise rejections on web, the global handler on native. */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (event) => reportError('window.error', event.error ?? event.message));
    window.addEventListener('unhandledrejection', (event) => reportError('window.unhandledrejection', event.reason));
    return;
  }
  const utils = (globalThis as { ErrorUtils?: { getGlobalHandler(): (e: Error, fatal?: boolean) => void; setGlobalHandler(h: (e: Error, fatal?: boolean) => void): void } }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, fatal) => {
    reportError(fatal ? 'native.fatal' : 'native.error', error);
    previous(error, fatal);
  });
}

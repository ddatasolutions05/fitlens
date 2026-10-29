// Home Screen install: the browser's own prompt where it exists (Chrome on
// Android and desktop), the two-tap instructions on iPhone, nothing once the
// app already runs from the Home Screen.
import { Platform } from 'react-native';

import { config } from './config';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const DISMISSED_KEY = 'fitlens.install.dismissed';

export function captureInstallPrompt(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
  });
}

export function isStandalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export type InstallKind = 'none' | 'ios-steps' | 'prompt';

/** What the install card should show right now. */
export function installKind(): InstallKind {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'none';
  if (isStandalone()) return 'none';
  try {
    if (window.localStorage.getItem(DISMISSED_KEY)) return 'none';
  } catch {
    // no storage; show it
  }
  if (deferred) return 'prompt';
  const ua = navigator.userAgent;
  if (/iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) return 'ios-steps';
  return 'none';
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const ev = deferred;
  deferred = null;
  await ev.prompt();
  const choice = await ev.userChoice;
  return choice.outcome;
}

export function dismissInstall(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // nothing to remember it in
  }
}

export function appName(): string {
  return config.brandName;
}

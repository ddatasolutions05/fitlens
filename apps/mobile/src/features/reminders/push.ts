// Browser push subscription. Web only; the native build will use the OS
// notification service instead.
import { Platform } from 'react-native';

import { config } from '@/lib/config';
import { supabase } from '@/lib/supabase';

export interface PushSupport {
  ok: boolean;
  /** Why not, in plain words, when ok is false. */
  reason: string | null;
  /** iPhone: the site must be on the Home Screen first. */
  needsInstall: boolean;
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export function pushSupport(): PushSupport {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { ok: false, needsInstall: false, reason: 'Reminders in the phone app come with the native build.' };
  }
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
  if (ios && !isStandalone()) {
    return { ok: false, needsInstall: true, reason: 'On iPhone, add FitLens to your Home Screen first: tap Share, then Add to Home Screen, and open it from there.' };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, needsInstall: false, reason: 'This browser cannot show notifications.' };
  }
  if (!config.vapidPublicKey) {
    return { ok: false, needsInstall: false, reason: 'Not configured: EXPO_PUBLIC_VAPID_PUBLIC_KEY is not set for this build.' };
  }
  if (Notification.permission === 'denied') {
    return { ok: false, needsInstall: false, reason: 'Notifications are blocked for this site. Allow them in the browser settings and try again.' };
  }
  return { ok: true, needsInstall: false, reason: null };
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const base = config.basePath || '';
  await navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
  return navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupport().ok) return null;
  const reg = await navigator.serviceWorker.getRegistration(`${config.basePath || ''}/`);
  return reg ? reg.pushManager.getSubscription() : null;
}

export type SubscribeResult = 'subscribed' | 'denied';

/** Asks for permission, subscribes this browser and stores the subscription for the account. */
export async function subscribeToPush(userId: string): Promise<SubscribeResult> {
  const reg = await registration();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.vapidPublicKey) }));
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error('The browser returned an incomplete subscription');
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 300) }, { onConflict: 'endpoint' });
  if (error) throw error;
  return 'subscribed';
}

/** Drops this browser's subscription on both sides. */
export async function unsubscribeFromPush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

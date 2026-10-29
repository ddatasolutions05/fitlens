// Registers public/sw.js (app shell cache and push). Safe to call many times.
import { Platform } from 'react-native';

import { config } from './config';

export async function registerServiceWorker(): Promise<void> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost' && !config.basePath) return;
  try {
    const base = config.basePath || '';
    await navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
    if (typeof document !== 'undefined') document.title = config.brandName;
  } catch {
    // an old browser or a private window; the app works without it
  }
}

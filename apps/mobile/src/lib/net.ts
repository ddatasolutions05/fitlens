import { Platform } from 'react-native';

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  return /failed to fetch|network request failed|networkerror|load failed|fetch failed|ECONNREFUSED|ENOTFOUND|offline/i.test(message);
}

export function isProbablyOnline(): boolean {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true;
}

export function onOnline(cb: () => void): () => void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('online', cb);
    return () => window.removeEventListener('online', cb);
  }
  return () => {};
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

// After a deploy, a tab opened before it still points at the old hashed
// chunks, which no longer exist. The symptom is a module load failure on
// the next lazy screen. One cache-busting reload fetches the new build.
import { Platform } from 'react-native';

const PATTERN = /Loading module .* failed|Loading chunk|ChunkLoadError|Importing a module script failed|dynamically imported module/i;
const RELOADED_KEY = 'fitlens.reloaded-at';

export function isStaleBuildError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return PATTERN.test(message);
}

/** Reloads once with a fresh query string; false when a reload just happened (so a real outage does not loop). */
export function reloadForNewBuild(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOADED_KEY) ?? '0');
    if (Date.now() - last < 60_000) return false;
    window.sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
  } catch {
    // no storage; reload anyway, once per the browser's own guard
  }
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

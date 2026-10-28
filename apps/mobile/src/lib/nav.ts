import { router, type Href } from 'expo-router';

/** Back when there is history, otherwise to the screen the flow belongs to (deep links and reloads have none). */
export function goBack(fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

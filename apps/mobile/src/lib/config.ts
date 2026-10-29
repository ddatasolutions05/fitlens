// Runtime configuration. Only EXPO_PUBLIC_* values are available in the client.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/.test(value) && !value.includes('your-project');
}

// Runtime white-label for a shared build: open ?brand=<key> once and the
// browser keeps it (?brand=default clears it). Build-time env still wins for a dedicated build.
const BRANDS: Record<string, { name: string; tagline: string; logoUrl: string }> = {
  megagym: { name: 'The Mega Gym', tagline: 'Caledon, Ontario', logoUrl: '' },
};
const BRAND_KEY = 'fitlens.brand';

function runtimeBrand(): { name: string; tagline: string; logoUrl: string } | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('brand');
    if (fromUrl === 'default') window.localStorage.removeItem(BRAND_KEY);
    else if (fromUrl && BRANDS[fromUrl]) window.localStorage.setItem(BRAND_KEY, fromUrl);
    const key = window.localStorage.getItem(BRAND_KEY);
    return key && BRANDS[key] ? BRANDS[key] : null;
  } catch {
    return null;
  }
}
const brand = process.env.EXPO_PUBLIC_BRAND_NAME?.trim() ? null : runtimeBrand();

export const config = {
  /** Shown on sign-in, onboarding and the web title. Set EXPO_PUBLIC_BRAND_NAME to white-label a build. */
  brandName: brand?.name || process.env.EXPO_PUBLIC_BRAND_NAME?.trim() || 'FitLens',
  brandTagline: brand?.tagline || process.env.EXPO_PUBLIC_BRAND_TAGLINE?.trim() || 'Where eating meets evidence',
  /** A square logo image for a white-label build; empty uses the built-in mark. */
  brandLogoUrl: brand?.logoUrl || process.env.EXPO_PUBLIC_BRAND_LOGO_URL?.trim() || '',
  /** Shown on the Plans page as a mailto; empty hides the button. */
  contactEmail: process.env.EXPO_PUBLIC_CONTACT_EMAIL?.trim() ?? '',
  /** Sub-path the web build is served from, e.g. /fitlens on GitHub Pages. Empty locally. */
  basePath: (process.env.EXPO_PUBLIC_BASE_PATH ?? '').replace(/\/$/, ''),
  /** Web push application server key (public half of the VAPID pair). Empty disables reminders. */
  vapidPublicKey: process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? '',
  supabaseUrl,
  supabaseAnonKey,
  supabaseConfigured: looksLikeUrl(supabaseUrl) && supabaseAnonKey.length > 20 && !supabaseAnonKey.includes('your-anon'),
  photoMaxPx: 1600,
  signedUrlSeconds: 300,
  undoWindowMs: 5000,
  aiConsentVersion: '2026-10-27',
} as const;

export interface SetupProblem {
  key: string;
  message: string;
}

export function setupProblems(): SetupProblem[] {
  const problems: SetupProblem[] = [];
  if (!looksLikeUrl(supabaseUrl)) {
    problems.push({ key: 'EXPO_PUBLIC_SUPABASE_URL', message: 'Set EXPO_PUBLIC_SUPABASE_URL to your Supabase project URL.' });
  }
  if (supabaseAnonKey.length <= 20 || supabaseAnonKey.includes('your-anon')) {
    problems.push({ key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY', message: 'Set EXPO_PUBLIC_SUPABASE_ANON_KEY to the anon key from Project Settings > API.' });
  }
  return problems;
}

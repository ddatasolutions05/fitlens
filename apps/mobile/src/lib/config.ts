// Runtime configuration. Only EXPO_PUBLIC_* values are available in the client.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/.test(value) && !value.includes('your-project');
}

export const config = {
  /** Shown on sign-in, onboarding and the web title. Set EXPO_PUBLIC_BRAND_NAME to white-label a build. */
  brandName: process.env.EXPO_PUBLIC_BRAND_NAME?.trim() || 'FitLens',
  brandTagline: process.env.EXPO_PUBLIC_BRAND_TAGLINE?.trim() || 'Where eating meets evidence',
  /** A square logo image for a white-label build; empty uses the built-in mark. */
  brandLogoUrl: process.env.EXPO_PUBLIC_BRAND_LOGO_URL?.trim() || '',
  /** Sub-path the web build is served from, e.g. /fitlens on GitHub Pages. Empty locally. */
  basePath: (process.env.EXPO_PUBLIC_BASE_PATH ?? '').replace(/\/$/, ''),
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

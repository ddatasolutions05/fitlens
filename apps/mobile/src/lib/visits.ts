// Page-open tracking for the owner's admin page: which invite link, what
// device, roughly where. Web only, one record per tab session plus one when
// the person signs in. Nothing about food or health goes with it.
import { Platform } from 'react-native';

import { config } from './config';
import { supabase } from './supabase';

const VISITOR_KEY = 'fitlens.visitor';
const SOURCE_KEY = 'fitlens.source';
const CAMPAIGN_KEY = 'fitlens.campaign';
const OPEN_FLAG = 'fitlens.visit.open';
const USER_FLAG = 'fitlens.visit.user';

function storage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function visitorId(): string {
  const local = storage('local');
  const existing = local?.getItem(VISITOR_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  local?.setItem(VISITOR_KEY, id);
  return id;
}

/** Reads ?s=, ?utm_source= and ?utm_campaign= once; the first tag seen sticks to this browser. */
function captureSource(): { source: string | null; campaign: string | null } {
  const local = storage('local');
  try {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('s') ?? params.get('utm_source') ?? params.get('ref');
    const campaign = params.get('utm_campaign') ?? params.get('c');
    if (source && !local?.getItem(SOURCE_KEY)) local?.setItem(SOURCE_KEY, source.slice(0, 60));
    if (campaign && !local?.getItem(CAMPAIGN_KEY)) local?.setItem(CAMPAIGN_KEY, campaign.slice(0, 60));
  } catch {
    // no URL access; keep what is stored
  }
  return { source: local?.getItem(SOURCE_KEY) ?? null, campaign: local?.getItem(CAMPAIGN_KEY) ?? null };
}

function shouldSkip(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  if (!config.supabaseConfigured) return true;
  // Playwright and other automation set this flag; test runs stay out of the stats.
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return true;
  return false;
}

/** 'open' once per tab; 'signin' once per account per tab. Never throws. */
export async function recordVisit(reason: 'open' | 'signin'): Promise<void> {
  try {
    if (shouldSkip()) return;
    const session = storage('session');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    const userId = data.session?.user.id ?? null;
    if (reason === 'open') {
      if (session?.getItem(OPEN_FLAG)) return;
      session?.setItem(OPEN_FLAG, '1');
    } else {
      if (!userId || session?.getItem(USER_FLAG) === userId) return;
      session?.setItem(USER_FLAG, userId);
    }
    const { source, campaign } = captureSource();
    const body = {
      visitor_id: visitorId(),
      path: window.location.pathname.slice(0, 200),
      referrer: document.referrer ? document.referrer.slice(0, 300) : null,
      source,
      campaign,
      platform: /iP(hone|ad|od)/.test(navigator.userAgent) ? 'ios-web' : /Android/.test(navigator.userAgent) ? 'android-web' : 'web',
    };
    await fetch(`${config.supabaseUrl}/functions/v1/track-visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.supabaseAnonKey, Authorization: `Bearer ${token ?? config.supabaseAnonKey}` },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // never let tracking break a screen
  }
}

// Records a page open: which invite tag, what device, and a coarse location
// from the caller's IP. The IP itself is looked up and dropped, never stored.
// Deployed without gateway JWT verification because most visitors are not
// signed in; a user token, when present, ties the visit to the account.
import { createClient } from '@supabase/supabase-js';

import { readEnv } from '../_shared/auth.ts';
import { HttpError, handle, json, readJson } from '../_shared/http.ts';

interface Body {
  visitor_id?: string;
  path?: string;
  referrer?: string;
  source?: string;
  campaign?: string;
  platform?: string;
}

interface Geo {
  country: string | null;
  region: string | null;
  city: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const geoCache = new Map<string, Geo>();

function clip(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const first = fwd.split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip') || null;
}

async function lookup(ip: string): Promise<Geo> {
  const cached = geoCache.get(ip);
  if (cached) return cached;
  const none: Geo = { country: null, region: null, city: null };
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { signal: AbortSignal.timeout(2500), headers: { 'User-Agent': 'fitlens-track-visit' } });
    if (!res.ok) return none;
    const j = (await res.json()) as { country_name?: string; region?: string; city?: string; error?: boolean };
    if (j.error) return none;
    const geo = { country: clip(j.country_name, 60), region: clip(j.region, 60), city: clip(j.city, 60) };
    if (geoCache.size > 2000) geoCache.clear();
    geoCache.set(ip, geo);
    return geo;
  } catch {
    return none;
  }
}

Deno.serve(
  handle(async (req, requestId) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST only');
    const env = readEnv();
    const body = (await readJson(req)) as Body;
    const visitorId = typeof body.visitor_id === 'string' && UUID.test(body.visitor_id) ? body.visitor_id : null;
    if (!visitorId) throw new HttpError(400, 'bad_request', 'visitor_id must be a uuid');

    let userId: string | null = null;
    const auth = req.headers.get('Authorization') ?? '';
    if (auth.startsWith('Bearer ') && auth.length > 60) {
      const userClient = createClient(env.supabaseUrl, env.anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
      const { data } = await userClient.auth.getUser();
      userId = data.user?.id ?? null;
    }

    const admin = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    // One row per visitor every two minutes at most, unless this one links an account.
    if (!userId) {
      const { data: recent } = await admin.from('visits').select('id').eq('visitor_id', visitorId).gte('created_at', new Date(Date.now() - 120_000).toISOString()).limit(1);
      if ((recent ?? []).length > 0) return json({ ok: true, deduped: true }, 200, { 'x-request-id': requestId });
    }

    const ip = clientIp(req);
    const geo = ip ? await lookup(ip) : { country: null, region: null, city: null };
    const { error } = await admin.from('visits').insert({
      visitor_id: visitorId,
      user_id: userId,
      path: clip(body.path, 200),
      referrer: clip(body.referrer, 300),
      source: clip(body.source, 60),
      campaign: clip(body.campaign, 60),
      platform: clip(body.platform, 20),
      user_agent: clip(req.headers.get('user-agent'), 300),
      country: geo.country,
      region: geo.region,
      city: geo.city,
    });
    if (error) throw new HttpError(500, 'db_error', error.message);
    return json({ ok: true }, 200, { 'x-request-id': requestId });
  }),
);

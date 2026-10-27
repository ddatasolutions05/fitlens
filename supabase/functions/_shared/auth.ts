import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { HttpError } from './http.ts';

export interface Env {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  visionProvider: string | null;
  anthropicApiKey: string | null;
  visionModel: string;
  aiDailyLimit: number;
  fdcApiKey: string | null;
}

export function readEnv(): Env {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new HttpError(500, 'not_configured', 'Supabase environment is missing');
  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    visionProvider: Deno.env.get('VISION_PROVIDER') || null,
    anthropicApiKey: Deno.env.get('ANTHROPIC_API_KEY') || null,
    visionModel: Deno.env.get('VISION_MODEL') || 'claude-opus-5-5',
    aiDailyLimit: Number(Deno.env.get('AI_DAILY_LIMIT') ?? '30') || 30,
    fdcApiKey: Deno.env.get('FDC_API_KEY') || null,
  };
}

export interface Caller {
  userId: string;
  /** Client acting as the user; RLS applies. */
  userClient: SupabaseClient;
  /** Service role client; bypasses RLS. Use only for writes the user may not perform. */
  admin: SupabaseClient;
}

export async function requireUser(req: Request, env: Env): Promise<Caller> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) throw new HttpError(401, 'unauthorized', 'Missing bearer token');
  const userClient = createClient(env.supabaseUrl, env.anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'unauthorized', 'Invalid session');
  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { userId: data.user.id, userClient, admin };
}

export function localDateIn(tz: string, date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

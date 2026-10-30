// Sends the daily reminder over web push. Two callers: the schedule (secret
// header, sweeps everyone whose time has come) and a signed-in person asking
// for a test (sends to their own browsers now). Deployed without JWT
// verification so the schedule can reach it; the secret check is below.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'web-push';

import { isReminderDue, localClockIn, reminderMessage } from '../../../packages/core/src/reminders.ts';

import { readEnv, requireUser } from '../_shared/auth.ts';
import { HttpError, handle, json, readJson } from '../_shared/http.ts';

interface Sub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failures: number;
}

function vapid(): { publicKey: string; privateKey: string; subject: string } {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'https://ddatasolutions05.github.io/fitlens/';
  if (!publicKey || !privateKey) throw new HttpError(500, 'not_configured', 'VAPID keys are not set on the function');
  return { publicKey, privateKey, subject };
}

async function sendToUser(admin: SupabaseClient, userId: string, message: { title: string; body: string }, url: string): Promise<{ sent: number; removed: number; failed: number }> {
  const keys = vapid();
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  const { data: subs, error } = await admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, failures').eq('user_id', userId);
  if (error) throw new HttpError(500, 'db_error', error.message);
  const out = { sent: 0, removed: 0, failed: 0 };
  const payload = JSON.stringify({ title: message.title, body: message.body, url });
  for (const s of (subs ?? []) as Sub[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
      out.sent += 1;
      await admin.from('push_subscriptions').update({ last_sent_at: new Date().toISOString(), failures: 0 }).eq('id', s.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 0;
      if (status === 404 || status === 410 || s.failures + 1 >= 5) {
        await admin.from('push_subscriptions').delete().eq('id', s.id);
        out.removed += 1;
      } else {
        await admin.from('push_subscriptions').update({ failures: s.failures + 1 }).eq('id', s.id);
        out.failed += 1;
      }
      console.error(JSON.stringify({ level: 'warn', code: 'push_failed', status, message: (err as Error).message }));
    }
  }
  return out;
}

Deno.serve(
  handle(async (req, requestId) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST only');
    const env = readEnv();
    const appUrl = Deno.env.get('APP_URL') ?? 'https://ddatasolutions05.github.io/fitlens/';
    const secret = Deno.env.get('REMINDER_CRON_SECRET') ?? '';
    const given = req.headers.get('x-reminder-secret') ?? '';

    if (secret && given && given === secret) {
      const admin = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const now = new Date();
      const { data: rows, error } = await admin.from('reminders').select('user_id, local_time, last_sent_on').eq('enabled', true);
      if (error) throw new HttpError(500, 'db_error', error.message);
      const ids = (rows ?? []).map((r) => r.user_id as string);
      const tzById = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profiles } = await admin.from('profiles').select('user_id, timezone').in('user_id', ids);
        for (const p of profiles ?? []) tzById.set(p.user_id as string, (p.timezone as string) || 'UTC');
      }
      const totals = { checked: ids.length, due: 0, sent: 0, skipped: 0, removed: 0, failed: 0 };
      const twoHoursAgo = new Date(now.getTime() - 2 * 3600_000).toISOString();
      for (const r of rows ?? []) {
        const tz = tzById.get(r.user_id as string) ?? 'UTC';
        const { due, localDate } = isReminderDue({ now, localTime: String(r.local_time), tz, lastSentOn: (r.last_sent_on as string | null) ?? null });
        if (!due) continue;
        totals.due += 1;
        const { data: recent } = await admin.from('meals').select('id').eq('user_id', r.user_id as string).eq('status', 'confirmed').gte('created_at', twoHoursAgo).limit(1);
        await admin.from('reminders').update({ last_sent_on: localDate }).eq('user_id', r.user_id as string);
        if ((recent ?? []).length > 0) {
          totals.skipped += 1;
          continue;
        }
        const hour = Math.floor(localClockIn(tz, now).minutes / 60);
        const result = await sendToUser(admin, r.user_id as string, reminderMessage(hour), appUrl);
        totals.sent += result.sent;
        totals.removed += result.removed;
        totals.failed += result.failed;
      }
      // Owner alerts: a short digest to admins who turned it on, once per sweep with news.
      const alerts = { admins: 0, sent: 0 };
      const { data: admins } = await admin.from('app_admins').select('user_id, alerts, alerted_at').eq('alerts', true);
      for (const a of admins ?? []) {
        alerts.admins += 1;
        const since = (a.alerted_at as string | null) ?? new Date(now.getTime() - 10 * 60_000).toISOString();
        const { data: digest } = await admin.rpc('admin_alert_digest', { p_since: since });
        const d = (digest ?? {}) as { signups?: string[]; first_meals?: string[]; errors?: number };
        const parts: string[] = [];
        if (d.signups?.length) parts.push(`New: ${d.signups.join(', ')}`);
        if (d.first_meals?.length) parts.push(`First meal: ${d.first_meals.join(', ')}`);
        if (d.errors) parts.push(`${d.errors} error${d.errors === 1 ? '' : 's'}`);
        await admin.from('app_admins').update({ alerted_at: now.toISOString() }).eq('user_id', a.user_id as string);
        if (parts.length === 0) continue;
        const result = await sendToUser(admin, a.user_id as string, { title: `${Deno.env.get('BRAND_NAME') ?? 'FitLens'} activity`, body: parts.join('. ') }, `${appUrl}${appUrl.endsWith('/') ? '' : '/'}admin`);
        alerts.sent += result.sent;
      }
      return json({ ok: true, ...totals, alerts }, 200, { 'x-request-id': requestId });
    }

    // A signed-in person: send a test to their own browsers.
    const caller = await requireUser(req, env);
    const body = (await readJson(req)) as { test?: boolean };
    if (!body?.test) throw new HttpError(400, 'bad_request', 'Send {"test": true} or call with the schedule secret');
    const { data: profile } = await caller.userClient.from('profiles').select('timezone').eq('user_id', caller.userId).maybeSingle();
    const hour = Math.floor(localClockIn((profile?.timezone as string) || 'UTC').minutes / 60);
    const result = await sendToUser(caller.admin, caller.userId, reminderMessage(hour), appUrl);
    if (result.sent === 0 && result.removed === 0 && result.failed === 0) throw new HttpError(404, 'no_subscription', 'This account has no browser subscribed yet');
    return json({ ok: true, ...result }, 200, { 'x-request-id': requestId });
  }),
);

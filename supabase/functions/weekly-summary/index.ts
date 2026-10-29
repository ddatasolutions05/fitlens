// Sunday evening email: the week in review, same rules as the in-app screen.
// Runs hourly from the schedule (secret header) and sends to each person at
// 18:00 their local time on Sunday, once a week. A signed-in person can ask
// for a test copy. Needs RESEND_API_KEY and EMAIL_FROM; without them the
// function reports not configured and sends nothing.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { localClockIn } from '../../../packages/core/src/reminders.ts';
import { weeklyReview } from '../../../packages/core/src/review.ts';
import { rangeStats, type StatsDay } from '../../../packages/core/src/stats.ts';
import { readEnv, requireUser } from '../_shared/auth.ts';
import { HttpError, handle, json, readJson } from '../_shared/http.ts';

interface Candidate {
  user_id: string;
  email: string;
  display_name: string | null;
  timezone: string;
  unit_system: string;
  hide_numbers: boolean;
  mode: string;
  sent_on: string | null;
}

function shift(localDate: string, days: number): string {
  const d = new Date(`${localDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function weekDays(admin: SupabaseClient, userId: string, from: string, to: string): Promise<StatsDay[]> {
  const [totals, activity, water, statuses, goals] = await Promise.all([
    admin.from('daily_totals').select('local_date, kcal, protein_g, fibre_g').eq('user_id', userId).gte('local_date', from).lte('local_date', to),
    admin.from('daily_activity').select('local_date, steps, workout_minutes').eq('user_id', userId).gte('local_date', from).lte('local_date', to),
    admin.from('daily_water').select('local_date, ml').eq('user_id', userId).gte('local_date', from).lte('local_date', to),
    admin.from('day_status').select('local_date, status').eq('user_id', userId).gte('local_date', from).lte('local_date', to),
    admin.from('goal_versions').select('effective_from, calorie_target, protein_g, fibre_g, step_goal, water_ml').eq('user_id', userId).lte('effective_from', to).order('effective_from', { ascending: false }).limit(1),
  ]);
  const g = (goals.data ?? [])[0] ?? null;
  const by = <T extends { local_date: string }>(rows: T[] | null) => new Map((rows ?? []).map((r) => [r.local_date, r]));
  const t = by(totals.data as { local_date: string; kcal: unknown; protein_g: unknown; fibre_g: unknown }[] | null);
  const a = by(activity.data as { local_date: string; steps: unknown; workout_minutes: unknown }[] | null);
  const w = by(water.data as { local_date: string; ml: unknown }[] | null);
  const s = by(statuses.data as { local_date: string; status: string }[] | null);
  const days: StatsDay[] = [];
  for (let d = from; d <= to; d = shift(d, 1)) {
    const tt = t.get(d);
    const aa = a.get(d);
    const ww = w.get(d);
    const hasAny = Boolean(tt) || Boolean(aa) || Boolean(ww);
    const st = s.get(d)?.status;
    days.push({
      localDate: d,
      kcal: tt ? num(tt.kcal) : null,
      kcalTarget: num(g?.calorie_target),
      protein: tt ? num(tt.protein_g) : null,
      proteinTarget: num(g?.protein_g),
      fibre: tt ? num(tt.fibre_g) : null,
      fibreTarget: num(g?.fibre_g),
      steps: aa ? num(aa.steps) : null,
      stepTarget: num(g?.step_goal),
      waterMl: ww ? num(ww.ml) : null,
      waterTarget: num(g?.water_ml),
      workoutMinutes: aa ? num(aa.workout_minutes) : null,
      status: st === 'complete' ? 'complete' : hasAny || st === 'partial' ? 'partial' : 'not_logged',
    });
  }
  return days;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function render(name: string | null, from: string, to: string, review: ReturnType<typeof weeklyReview>, appUrl: string, brand: string): { subject: string; html: string; text: string } {
  const hello = name ? `Hi ${escape(name.split(' ')[0] ?? name)},` : 'Hi,';
  const wins = review.wins.map((w) => `<li>${escape(w)}</li>`).join('');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#000;color:#fff;font-family:Lato,Helvetica,Arial,sans-serif;line-height:1.5">
<div style="max-width:560px;margin:0 auto">
<p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.6;margin:0 0 16px">${escape(brand)} &middot; Week of ${from} to ${to}</p>
<p style="margin:0 0 16px">${hello}</p>
<h1 style="font-size:26px;margin:0 0 16px">${escape(review.headline)}</h1>
${wins ? `<p style="margin:0 0 8px;opacity:.7">What went well</p><ul style="margin:0 0 16px;padding-left:20px">${wins}</ul>` : ''}
${review.change ? `<p style="margin:0 0 8px;opacity:.7">One thing to change</p><p style="margin:0 0 16px">${escape(review.change)}</p>` : ''}
${review.comparison ? `<p style="margin:0 0 16px;opacity:.7">${escape(review.comparison)}</p>` : ''}
<p style="margin:24px 0"><a href="${appUrl}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Open ${escape(brand)}</a></p>
<p style="font-size:12px;opacity:.5;margin:32px 0 0">You get this once a week because you finished setup. Turn it off under Profile, Daily reminder.</p>
</div></body></html>`;
  const text = [`${hello}`, '', review.headline, '', ...review.wins, review.change ? `\nOne thing to change: ${review.change}` : '', review.comparison ?? '', '', `Open ${brand}: ${appUrl}`].join('\n');
  return { subject: `${brand}: your week, ${from} to ${to}`, html, text };
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  const key = Deno.env.get('RESEND_API_KEY') ?? '';
  const from = Deno.env.get('EMAIL_FROM') ?? '';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendWeek(admin: SupabaseClient, c: Candidate, today: string, appUrl: string, brand: string): Promise<void> {
  const to = shift(today, -1);
  const from = shift(to, -6);
  const [thisWeek, lastWeek] = await Promise.all([weekDays(admin, c.user_id, from, to), weekDays(admin, c.user_id, shift(from, -7), shift(to, -7))]);
  const review = weeklyReview({ thisWeek: rangeStats(thisWeek), lastWeek: rangeStats(lastWeek), hideNumbers: c.hide_numbers, trackingOnly: c.mode === 'tracking_only' });
  const mail = render(c.display_name, from, to, review, appUrl, brand);
  await sendEmail(c.email, mail.subject, mail.html, mail.text);
}

Deno.serve(
  handle(async (req, requestId) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST only');
    const env = readEnv();
    const configured = Boolean(Deno.env.get('RESEND_API_KEY')) && Boolean(Deno.env.get('EMAIL_FROM'));
    const appUrl = Deno.env.get('APP_URL') ?? 'https://ddatasolutions05.github.io/fitlens/';
    const brand = Deno.env.get('BRAND_NAME') ?? 'FitLens';
    const secret = Deno.env.get('REMINDER_CRON_SECRET') ?? '';
    const given = req.headers.get('x-reminder-secret') ?? '';
    const admin = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

    if (secret && given && given === secret) {
      if (!configured) return json({ ok: true, configured: false, reason: 'RESEND_API_KEY or EMAIL_FROM is not set' }, 200, { 'x-request-id': requestId });
      const { data, error } = await admin.rpc('weekly_email_candidates');
      if (error) throw new HttpError(500, 'db_error', error.message);
      const now = new Date();
      const totals = { candidates: (data ?? []).length, sent: 0, failed: 0 };
      for (const c of (data ?? []) as Candidate[]) {
        const clock = localClockIn(c.timezone || 'UTC', now);
        const weekday = new Date(`${clock.localDate}T00:00:00Z`).getUTCDay();
        const hour = Math.floor(clock.minutes / 60);
        if (weekday !== 0 || hour !== 18) continue;
        if (c.sent_on && c.sent_on >= shift(clock.localDate, -6)) continue;
        try {
          await sendWeek(admin, c, clock.localDate, appUrl, brand);
          await admin.from('preferences').upsert({ user_id: c.user_id, weekly_email_sent_on: clock.localDate }, { onConflict: 'user_id' });
          totals.sent += 1;
        } catch (err) {
          totals.failed += 1;
          console.error(JSON.stringify({ level: 'warn', code: 'weekly_email_failed', message: (err as Error).message }));
        }
      }
      return json({ ok: true, configured: true, ...totals }, 200, { 'x-request-id': requestId });
    }

    const caller = await requireUser(req, env);
    const body = (await readJson(req)) as { test?: boolean };
    if (!body?.test) throw new HttpError(400, 'bad_request', 'Send {"test": true} or call with the schedule secret');
    if (!configured) throw new HttpError(503, 'not_configured', 'Email is not configured on the server yet');
    const { data: me } = await admin.rpc('weekly_email_candidates');
    const c = ((me ?? []) as Candidate[]).find((x) => x.user_id === caller.userId);
    if (!c) throw new HttpError(404, 'not_eligible', 'Finish setup and keep the weekly email on to receive it');
    await sendWeek(admin, c, localClockIn(c.timezone || 'UTC').localDate, appUrl, brand);
    return json({ ok: true, sent: 1 }, 200, { 'x-request-id': requestId });
  }),
);

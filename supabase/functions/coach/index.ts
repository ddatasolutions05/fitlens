// Coach: answers one question from the caller's own logs. The function
// compiles a compact 14 day summary server side (RLS applies through the
// user client), sends it with the question to the same provider adapter as
// photo analysis, validates the JSON reply, and counts the call against the
// daily AI limit. No photos are involved.
import { COACH_PROMPT_VERSION, coachRequestSchema, coachReplySchema, extractJson, type CoachResult } from '@fitlens/schemas';

import { localDateIn, readEnv, requireUser } from '../_shared/auth.ts';
import { HttpError, handle, json, readJson } from '../_shared/http.ts';
import { COACH_SYSTEM, coachUserText } from '../_shared/prompts.ts';
import { makeVisionProvider } from '../_shared/vision/factory.ts';
import { VisionProviderError } from '../_shared/vision/provider.ts';

const DAYS = 14;

function shiftDate(localDate: string, days: number): string {
  const d = new Date(`${localDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function n(v: unknown): number | null {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : null;
}

Deno.serve(
  handle(async (req, requestId) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST only');
    const env = readEnv();
    const caller = await requireUser(req, env);
    const body = coachRequestSchema.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, 'bad_request', body.error.issues.map((i) => i.message).join('; '));
    const { question, history = [] } = body.data;

    const [{ data: profile }, { data: prefs }] = await Promise.all([
      caller.userClient.from('profiles').select('timezone, mode, hide_numbers, unit_system, goal_weight_kg, display_name').eq('user_id', caller.userId).maybeSingle(),
      caller.userClient.from('preferences').select('ai_photo_consent_at, diet_pattern, allergies, cuisines, avoid_foods').eq('user_id', caller.userId).maybeSingle(),
    ]);
    if (!prefs?.ai_photo_consent_at) throw new HttpError(403, 'consent_required', 'The coach needs your AI consent');

    const provider = makeVisionProvider(env);
    const today = body.data.local_date ?? localDateIn(profile?.timezone ?? 'UTC');
    const from = shiftDate(today, -(DAYS - 1));

    const { data: allowed, error: usageError } = await caller.admin.rpc('increment_ai_usage', {
      p_user: caller.userId,
      p_local_date: today,
      p_kind: 'coach_calls',
      p_cap: env.aiDailyLimit,
      p_cost: 0,
    });
    if (usageError) throw new HttpError(500, 'usage_error', 'Could not record usage');
    if (!allowed) throw new HttpError(429, 'rate_limited', `Daily limit of ${env.aiDailyLimit} coach questions reached`);

    const u = caller.userClient;
    const [totals, water, activity, statuses, goal, weights, meals] = await Promise.all([
      u.from('daily_totals').select('local_date, kcal, protein_g, carbs_g, fat_g, fibre_g, meal_count').eq('user_id', caller.userId).gte('local_date', from).lte('local_date', today),
      u.from('daily_water').select('local_date, ml').eq('user_id', caller.userId).gte('local_date', from).lte('local_date', today),
      u.from('daily_activity').select('local_date, steps, workout_count, workout_minutes').eq('user_id', caller.userId).gte('local_date', from).lte('local_date', today),
      u.from('day_status').select('local_date, status').eq('user_id', caller.userId).gte('local_date', from).lte('local_date', today),
      u.rpc('goal_for_date', { p_date: today }),
      u.from('weight_logs').select('local_date, kg').eq('user_id', caller.userId).gte('local_date', shiftDate(today, -30)).lte('local_date', today).order('measured_at'),
      u
        .from('meals')
        .select('local_date, meal_type, title, meal_items(name_snapshot, grams, kcal, protein_g, fibre_g)')
        .eq('user_id', caller.userId)
        .eq('status', 'confirmed')
        .gte('local_date', shiftDate(today, -2))
        .lte('local_date', today)
        .order('eaten_at'),
    ]);
    for (const r of [totals, water, activity, statuses, goal, weights, meals]) if (r.error) throw new HttpError(500, 'db_error', r.error.message);

    const g = (goal.data as Record<string, unknown>[] | null)?.[0] ?? null;
    const hideNumbers = Boolean(profile?.hide_numbers);
    const trackingOnly = profile?.mode === 'tracking_only';
    const statusBy = new Map((statuses.data ?? []).map((s) => [s.local_date, s.status]));
    const waterBy = new Map((water.data ?? []).map((w) => [w.local_date as string, n(w.ml)]));
    const activityBy = new Map((activity.data ?? []).map((a) => [a.local_date as string, a]));

    const days = (totals.data ?? []).map((t) => {
      const a = activityBy.get(t.local_date as string);
      return {
        date: t.local_date,
        kcal: hideNumbers ? undefined : n(t.kcal),
        protein_g: n(t.protein_g),
        carbs_g: hideNumbers ? undefined : n(t.carbs_g),
        fat_g: hideNumbers ? undefined : n(t.fat_g),
        fibre_g: n(t.fibre_g),
        meals: n(t.meal_count),
        water_ml: waterBy.get(t.local_date as string) ?? null,
        steps: a?.steps != null ? Number(a.steps) : null,
        workout_minutes: a?.workout_minutes != null ? Number(a.workout_minutes) : null,
        status: statusBy.get(t.local_date as string) ?? 'partial',
      };
    });

    const context = {
      today,
      window_days: DAYS,
      person: {
        name: profile?.display_name ?? null,
        mode: profile?.mode ?? 'standard',
        hide_numbers: hideNumbers,
        unit_system: profile?.unit_system ?? 'metric',
        goal_weight_kg: n(profile?.goal_weight_kg),
        diet_pattern: prefs.diet_pattern,
        allergies: prefs.allergies ?? [],
        cuisines: prefs.cuisines ?? [],
        avoid_foods: prefs.avoid_foods ?? [],
      },
      targets: g
        ? {
            goal_type: g.goal_type,
            calorie_target: trackingOnly || hideNumbers ? null : g.calorie_target,
            protein_g: g.protein_g,
            fibre_g: g.fibre_g,
            step_goal: g.step_goal,
            water_ml: g.water_ml,
          }
        : null,
      days,
      days_without_logs: DAYS - days.length,
      weights: (weights.data ?? []).map((w) => ({ date: w.local_date, kg: n(w.kg) })),
      recent_meals: (meals.data ?? []).map((m) => ({
        date: m.local_date,
        type: m.meal_type,
        title: m.title,
        items: ((m.meal_items as { name_snapshot: string; grams: unknown; kcal: unknown; protein_g: unknown; fibre_g: unknown }[] | null) ?? []).map((i) => ({
          name: i.name_snapshot.slice(0, 80),
          grams: n(i.grams),
          kcal: hideNumbers ? undefined : n(i.kcal),
          protein_g: n(i.protein_g),
          fibre_g: n(i.fibre_g),
        })),
      })),
    };

    const userText = coachUserText({ context, history: history.slice(-8), question });
    let totalCost = 0;
    let validated: ReturnType<typeof coachReplySchema.parse> | null = null;
    let lastError = '';
    let modelUsed = provider.model;

    for (let attempt = 0; attempt < 2 && !validated; attempt += 1) {
      const text = attempt === 0 ? userText : `${userText}\n\nYour previous reply was not valid. Validation error: ${lastError}. Return only the corrected JSON object.`;
      let res;
      try {
        res = await provider.complete({ system: COACH_SYSTEM, userText: text, images: [], maxTokens: 1200 });
      } catch (err) {
        if (err instanceof VisionProviderError) throw new HttpError(err.code === 'not_configured' ? 503 : err.status >= 500 ? 502 : err.status, err.code, err.message, err.retryable);
        throw new HttpError(502, 'provider_error', err instanceof Error ? err.message : 'provider failed', true);
      }
      totalCost += res.estCostUsd;
      modelUsed = res.model;
      try {
        const parsed = coachReplySchema.safeParse(extractJson(res.text));
        if (parsed.success) validated = parsed.data;
        else lastError = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'not JSON';
      }
    }

    await caller.admin.rpc('add_ai_cost', { p_user: caller.userId, p_local_date: today, p_cost: totalCost });
    if (!validated) throw new HttpError(502, 'invalid_output', 'The coach did not return a usable answer. Try rephrasing the question.', true);

    const { data: usageRow } = await caller.admin.from('ai_usage').select('coach_calls').eq('user_id', caller.userId).eq('local_date', today).maybeSingle();
    const result: CoachResult = {
      prompt_version: COACH_PROMPT_VERSION,
      model: modelUsed,
      reply: validated,
      usage: { coach_calls_today: usageRow?.coach_calls ?? 0, daily_limit: env.aiDailyLimit },
    };
    return json(result, 200, { 'x-request-id': requestId });
  }),
);

// Text -> items. The same JSON contract as photo analysis, from a written or
// dictated description instead of a picture. Shares the consent gate and the
// daily cap with photo analysis.
import { analyzeMealResponseSchema, describeMealRequestSchema, extractJson, type DescribeMealResult } from '@fitlens/schemas';

import { localDateIn, readEnv, requireUser } from '../_shared/auth.ts';
import { HttpError, handle, json, readJson } from '../_shared/http.ts';
import { DESCRIBE_PROMPT_VERSION, DESCRIBE_SYSTEM, describeUserText } from '../_shared/prompts.ts';
import { makeVisionProvider } from '../_shared/vision/factory.ts';
import { VisionProviderError } from '../_shared/vision/provider.ts';

Deno.serve(
  handle(async (req, requestId) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST only');
    const env = readEnv();
    const caller = await requireUser(req, env);
    const body = describeMealRequestSchema.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, 'bad_request', body.error.issues.map((i) => i.message).join('; '));

    const [{ data: prefs }, { data: profile }] = await Promise.all([
      caller.userClient.from('preferences').select('ai_photo_consent_at, diet_pattern, allergies').eq('user_id', caller.userId).maybeSingle(),
      caller.userClient.from('profiles').select('timezone').eq('user_id', caller.userId).maybeSingle(),
    ]);
    if (!prefs?.ai_photo_consent_at) throw new HttpError(403, 'consent_required', 'AI features need your consent');

    const provider = makeVisionProvider(env);
    const localDate = localDateIn(profile?.timezone ?? 'UTC');
    const { data: allowed, error: usageError } = await caller.admin.rpc('increment_ai_usage', { p_user: caller.userId, p_local_date: localDate, p_kind: 'analyses', p_cap: env.aiDailyLimit, p_cost: 0 });
    if (usageError) throw new HttpError(500, 'usage_error', 'Could not record usage');
    if (!allowed) throw new HttpError(429, 'rate_limited', `Daily limit of ${env.aiDailyLimit} analyses reached`);

    const userText = describeUserText({ text: body.data.text, dietPattern: prefs.diet_pattern, allergies: prefs.allergies ?? [] });
    let totalCost = 0;
    let validated: ReturnType<typeof analyzeMealResponseSchema.parse> | null = null;
    let lastError = '';
    let modelUsed = provider.model;
    for (let attempt = 0; attempt < 2 && !validated; attempt += 1) {
      const text = attempt === 0 ? userText : `${userText}\n\nYour previous reply was not valid. Validation error: ${lastError}. Return only the corrected JSON object.`;
      let res;
      try {
        res = await provider.complete({ system: DESCRIBE_SYSTEM, userText: text, images: [], maxTokens: 3000 });
      } catch (err) {
        if (err instanceof VisionProviderError) throw new HttpError(err.code === 'not_configured' ? 503 : err.status >= 500 ? 502 : err.status, err.code, err.message, err.retryable);
        throw new HttpError(502, 'provider_error', err instanceof Error ? err.message : 'provider failed', true);
      }
      totalCost += res.estCostUsd;
      modelUsed = res.model;
      try {
        const parsed = analyzeMealResponseSchema.safeParse(extractJson(res.text));
        if (parsed.success) validated = parsed.data;
        else lastError = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'not JSON';
      }
    }
    await caller.admin.rpc('add_ai_cost', { p_user: caller.userId, p_local_date: localDate, p_cost: totalCost });
    if (!validated) throw new HttpError(502, 'invalid_output', 'The model did not return a usable result. Try a shorter description or add the meal by hand.', true);

    const { data: usageRow } = await caller.admin.from('ai_usage').select('analyses').eq('user_id', caller.userId).eq('local_date', localDate).maybeSingle();
    const result: DescribeMealResult = { prompt_version: DESCRIBE_PROMPT_VERSION, model: modelUsed, result: validated, usage: { analyses_today: usageRow?.analyses ?? 0, daily_limit: env.aiDailyLimit } };
    return json(result, 200, { 'x-request-id': requestId });
  }),
);

// Capture -> Identify. Validates consent, rate limit and ownership, strips
// metadata from the photos, calls the vision provider through the adapter,
// validates the JSON against the shared schema (one retry with the error),
// and records the attempt in photo_analyses.
import { analyzeMealRequestSchema, analyzeMealResponseSchema, extractJson, type AnalyzeMealResult } from '@fitlens/schemas';

import { localDateIn, readEnv, requireUser } from '../_shared/auth.ts';
import { HttpError, handle, json, readJson } from '../_shared/http.ts';
import { MAX_IMAGE_BYTES, sniffMime, stripJpegMetadata } from '../_shared/image.ts';
import { ANALYZE_SYSTEM, PROMPT_VERSION, analyzeUserText } from '../_shared/prompts.ts';
import { makeVisionProvider } from '../_shared/vision/factory.ts';
import { VisionProviderError, type VisionImage } from '../_shared/vision/provider.ts';

Deno.serve(
  handle(async (req, requestId) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST only');
    const env = readEnv();
    const caller = await requireUser(req, env);
    const body = analyzeMealRequestSchema.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, 'bad_request', body.error.issues.map((i) => i.message).join('; '));
    const { meal_id, storage_paths, answers = [] } = body.data;

    for (const p of storage_paths) {
      if (!p.startsWith(`${caller.userId}/`)) throw new HttpError(403, 'forbidden', 'Photo path does not belong to you');
    }

    const [{ data: meal }, { data: prefs }, { data: profile }] = await Promise.all([
      caller.userClient.from('meals').select('id, status').eq('id', meal_id).maybeSingle(),
      caller.userClient.from('preferences').select('ai_photo_consent_at, diet_pattern, allergies').eq('user_id', caller.userId).maybeSingle(),
      caller.userClient.from('profiles').select('timezone').eq('user_id', caller.userId).maybeSingle(),
    ]);
    if (!meal) throw new HttpError(404, 'not_found', 'Meal not found');
    if (!prefs?.ai_photo_consent_at) throw new HttpError(403, 'consent_required', 'Photo analysis needs your consent');

    const provider = makeVisionProvider(env);
    const localDate = localDateIn(profile?.timezone ?? 'UTC');

    const { data: allowed, error: usageError } = await caller.admin.rpc('increment_ai_usage', {
      p_user: caller.userId,
      p_local_date: localDate,
      p_kind: 'analyses',
      p_cap: env.aiDailyLimit,
      p_cost: 0,
    });
    if (usageError) throw new HttpError(500, 'usage_error', 'Could not record usage');
    if (!allowed) throw new HttpError(429, 'rate_limited', `Daily limit of ${env.aiDailyLimit} analyses reached`);

    const { data: analysis, error: insertError } = await caller.admin
      .from('photo_analyses')
      .insert({ user_id: caller.userId, meal_id, status: 'running', provider: provider.name, model: provider.model, prompt_version: PROMPT_VERSION, started_at: new Date().toISOString() })
      .select('id')
      .single();
    if (insertError || !analysis) throw new HttpError(500, 'db_error', 'Could not start analysis');

    const fail = async (code: string, detail: string, status: number, retryable = false): Promise<never> => {
      await caller.admin.from('photo_analyses').update({ status: 'failed', error_code: code, error_detail: detail.slice(0, 500), finished_at: new Date().toISOString() }).eq('id', analysis.id);
      throw new HttpError(status, code, detail, retryable);
    };

    const images: VisionImage[] = [];
    for (const path of storage_paths) {
      const { data: blob, error } = await caller.admin.storage.from('meal-photos').download(path);
      if (error || !blob) return fail('photo_missing', `Could not read ${path}`, 404);
      let bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) return fail('image_too_large', 'Image exceeds 6 MB', 413);
      const mime = sniffMime(bytes);
      if (!mime) return fail('unsupported_image', 'Image must be JPEG, PNG or WebP', 415);
      if (mime === 'image/jpeg') {
        const cleaned = stripJpegMetadata(bytes);
        if (cleaned.length !== bytes.length) {
          await caller.admin.storage.from('meal-photos').upload(path, cleaned, { contentType: 'image/jpeg', upsert: true });
          bytes = cleaned;
        }
      }
      images.push({ bytes, mimeType: mime });
    }

    const userText = analyzeUserText({ dietPattern: prefs.diet_pattern, allergies: prefs.allergies ?? [], answers, photoCount: images.length });
    let totalIn = 0;
    let totalOut = 0;
    let totalCost = 0;
    let validated: ReturnType<typeof analyzeMealResponseSchema.parse> | null = null;
    let lastError = '';
    let modelUsed = provider.model;

    for (let attempt = 0; attempt < 2 && !validated; attempt += 1) {
      const text = attempt === 0 ? userText : `${userText}\n\nYour previous reply was not valid. Validation error: ${lastError}. Return only the corrected JSON object.`;
      let res;
      try {
        res = await provider.complete({ system: ANALYZE_SYSTEM, userText: text, images, maxTokens: 4000 });
      } catch (err) {
        if (err instanceof VisionProviderError) return fail('provider_error', err.message, err.status >= 500 ? 502 : err.status, err.retryable);
        return fail('provider_error', err instanceof Error ? err.message : 'provider failed', 502, true);
      }
      totalIn += res.inputTokens;
      totalOut += res.outputTokens;
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

    if (!validated) {
      await caller.admin
        .from('photo_analyses')
        .update({ status: 'failed', error_code: 'invalid_output', error_detail: lastError.slice(0, 500), input_tokens: totalIn, output_tokens: totalOut, est_cost_usd: totalCost, finished_at: new Date().toISOString() })
        .eq('id', analysis.id);
      throw new HttpError(502, 'invalid_output', 'The model did not return a usable result. The photo is still attached; you can add the meal manually.', true);
    }

    await caller.admin
      .from('photo_analyses')
      .update({ status: 'succeeded', model: modelUsed, validated_response: validated, input_tokens: totalIn, output_tokens: totalOut, est_cost_usd: totalCost, finished_at: new Date().toISOString() })
      .eq('id', analysis.id);

    const { data: usageRow } = await caller.admin.from('ai_usage').select('analyses').eq('user_id', caller.userId).eq('local_date', localDate).maybeSingle();

    const result: AnalyzeMealResult = {
      analysis_id: analysis.id,
      status: 'succeeded',
      prompt_version: PROMPT_VERSION,
      model: modelUsed,
      result: validated,
      usage: { analyses_today: usageRow?.analyses ?? 0, daily_limit: env.aiDailyLimit },
    };
    return json(result, 200, { 'x-request-id': requestId });
  }),
);

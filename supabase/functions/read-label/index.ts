// Reads a nutrition facts panel into the shared label schema. The app shows
// the values for the user to verify before anything is saved.
import { extractJson, labelReadSchema, readLabelRequestSchema, type ReadLabelResult } from '@fitlens/schemas';

import { localDateIn, readEnv, requireUser } from '../_shared/auth.ts';
import { HttpError, handle, json, readJson } from '../_shared/http.ts';
import { MAX_IMAGE_BYTES, sniffMime, stripJpegMetadata } from '../_shared/image.ts';
import { LABEL_PROMPT_VERSION, LABEL_SYSTEM } from '../_shared/prompts.ts';
import { makeVisionProvider } from '../_shared/vision/factory.ts';
import { VisionProviderError } from '../_shared/vision/provider.ts';

Deno.serve(
  handle(async (req, requestId) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST only');
    const env = readEnv();
    const caller = await requireUser(req, env);
    const body = readLabelRequestSchema.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, 'bad_request', body.error.issues.map((i) => i.message).join('; '));
    if (!body.data.storage_path.startsWith(`${caller.userId}/`)) throw new HttpError(403, 'forbidden', 'Photo path does not belong to you');

    const [{ data: prefs }, { data: profile }] = await Promise.all([
      caller.userClient.from('preferences').select('ai_photo_consent_at').eq('user_id', caller.userId).maybeSingle(),
      caller.userClient.from('profiles').select('timezone').eq('user_id', caller.userId).maybeSingle(),
    ]);
    if (!prefs?.ai_photo_consent_at) throw new HttpError(403, 'consent_required', 'Label reading needs your photo consent');

    const provider = makeVisionProvider(env);
    const localDate = localDateIn(profile?.timezone ?? 'UTC');
    const { data: allowed } = await caller.admin.rpc('increment_ai_usage', { p_user: caller.userId, p_local_date: localDate, p_kind: 'label_reads', p_cap: env.aiDailyLimit, p_cost: 0 });
    if (!allowed) throw new HttpError(429, 'rate_limited', `Daily limit of ${env.aiDailyLimit} label reads reached`);

    const { data: blob, error } = await caller.admin.storage.from('meal-photos').download(body.data.storage_path);
    if (error || !blob) throw new HttpError(404, 'photo_missing', 'Could not read the photo');
    let bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'image_too_large', 'Image exceeds 6 MB');
    const mime = sniffMime(bytes);
    if (!mime) throw new HttpError(415, 'unsupported_image', 'Image must be JPEG, PNG or WebP');
    if (mime === 'image/jpeg') bytes = stripJpegMetadata(bytes);

    let lastError = '';
    let cost = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let res;
      try {
        res = await provider.complete({
          system: LABEL_SYSTEM,
          userText: attempt === 0 ? 'Transcribe the nutrition panel into the JSON object.' : `Previous reply was invalid: ${lastError}. Return only the corrected JSON object.`,
          images: [{ bytes, mimeType: mime }],
          maxTokens: 1500,
        });
      } catch (err) {
        if (err instanceof VisionProviderError) throw new HttpError(err.status >= 500 ? 502 : err.status, 'provider_error', err.message, err.retryable);
        throw err;
      }
      cost += res.estCostUsd;
      try {
        const parsed = labelReadSchema.safeParse(extractJson(res.text));
        if (parsed.success) {
          await caller.admin.rpc('add_ai_cost', { p_user: caller.userId, p_local_date: localDate, p_cost: cost });
          const result: ReadLabelResult = { prompt_version: LABEL_PROMPT_VERSION, model: res.model, result: parsed.data };
          return json(result, 200, { 'x-request-id': requestId });
        }
        lastError = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'not JSON';
      }
    }
    throw new HttpError(502, 'invalid_output', 'Could not read the label. Enter the values manually.', true);
  }),
);

// Reports which optional services have credentials. Never substitutes mocks.
import type { FeaturesResult } from '@fitlens/schemas';

import { readEnv, requireUser } from '../_shared/auth.ts';
import { handle, json } from '../_shared/http.ts';
import { visionStatus } from '../_shared/vision/factory.ts';

Deno.serve(
  handle(async (req, requestId) => {
    const env = readEnv();
    await requireUser(req, env);
    const vision = visionStatus(env);
    const result: FeaturesResult = {
      vision,
      coach: { configured: vision.configured, reason: vision.configured ? null : 'Needs the same LLM credentials as photo analysis. Rule-based feedback stays on.' },
      fdc_branded: { configured: Boolean(env.fdcApiKey), reason: env.fdcApiKey ? null : 'FDC_API_KEY is not set; search uses the imported database only.' },
      barcode: { configured: true },
      daily_ai_limit: env.aiDailyLimit,
    };
    return json(result, 200, { 'x-request-id': requestId });
  }),
);

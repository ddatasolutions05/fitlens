import type { Env } from '../auth.ts';
import { HttpError } from '../http.ts';

import { AnthropicVisionProvider } from './anthropic.ts';
import type { VisionProvider } from './provider.ts';

export interface VisionStatus {
  configured: boolean;
  provider: string | null;
  model: string | null;
  reason: string | null;
}

export function visionStatus(env: Env): VisionStatus {
  const provider = env.visionProvider ?? 'anthropic';
  if (provider === 'anthropic') {
    if (!env.anthropicApiKey) return { configured: false, provider, model: env.visionModel, reason: 'ANTHROPIC_API_KEY is not set on the edge functions.' };
    return { configured: true, provider, model: env.visionModel, reason: null };
  }
  return { configured: false, provider, model: null, reason: `Unknown VISION_PROVIDER "${provider}". Supported: anthropic.` };
}

export function makeVisionProvider(env: Env): VisionProvider {
  const status = visionStatus(env);
  if (!status.configured) throw new HttpError(503, 'not_configured', status.reason ?? 'Vision provider not configured');
  return new AnthropicVisionProvider(env.anthropicApiKey as string, env.visionModel, env.anthropicWorkspaceId);
}

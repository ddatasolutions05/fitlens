import Anthropic from '@anthropic-ai/sdk';

import { VisionProviderError, type VisionProvider, type VisionRequest, type VisionResponse } from './provider.ts';

// USD per million tokens, first-party API list prices. Keyed by model id prefix.
const PRICES: { prefix: string; input: number; output: number }[] = [
  { prefix: 'claude-opus-5-5', input: 4, output: 20 },
  { prefix: 'claude-opus-5', input: 5, output: 25 },
  { prefix: 'claude-sonnet-5-5', input: 2, output: 10 },
  { prefix: 'claude-sonnet-5', input: 2, output: 10 },
  { prefix: 'claude-haiku-5-5', input: 0.1, output: 0.5 },
  { prefix: 'claude-sonnet-4', input: 3, output: 15 },
  { prefix: 'claude-opus-4', input: 5, output: 25 },
  { prefix: 'claude-haiku-4', input: 1, output: 5 },
];

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES.find((p) => model.startsWith(p.prefix)) ?? { input: 5, output: 25 };
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export class AnthropicVisionProvider implements VisionProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 });
  }

  async complete(req: VisionRequest): Promise<VisionResponse> {
    try {
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: req.maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: req.system,
        output_config: { effort: 'medium' },
        messages: [
          {
            role: 'user',
            content: [
              ...req.images.map((img) => ({
                type: 'image' as const,
                source: { type: 'base64' as const, media_type: img.mimeType, data: toBase64(img.bytes) },
              })),
              { type: 'text' as const, text: req.userText },
            ],
          },
        ],
      });
      if (response.stop_reason === 'refusal') {
        throw new VisionProviderError(422, 'The model declined to analyse this image', false);
      }
      const text = response.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      return { text, model: response.model, inputTokens, outputTokens, estCostUsd: estimateCostUsd(response.model, inputTokens, outputTokens) };
    } catch (err) {
      if (err instanceof VisionProviderError) throw err;
      if (err instanceof Anthropic.RateLimitError) throw new VisionProviderError(429, 'Provider rate limit', true);
      if (err instanceof Anthropic.AuthenticationError) throw new VisionProviderError(500, 'Provider credentials rejected', false);
      if (err instanceof Anthropic.BadRequestError) throw new VisionProviderError(400, err.message, false);
      if (err instanceof Anthropic.APIError) throw new VisionProviderError(502, `Provider error ${err.status ?? ''}`.trim(), true);
      throw new VisionProviderError(502, err instanceof Error ? err.message : 'Provider unreachable', true);
    }
  }
}

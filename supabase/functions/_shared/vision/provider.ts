// Vision provider adapter. Only this layer knows about a specific API.
export interface VisionImage {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface VisionRequest {
  system: string;
  userText: string;
  images: VisionImage[];
  maxTokens: number;
}

export interface VisionResponse {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Rough USD cost for the call, from the provider's public price list. */
  estCostUsd: number;
}

export interface VisionProvider {
  readonly name: string;
  readonly model: string;
  complete(req: VisionRequest): Promise<VisionResponse>;
}

export type VisionErrorCode = 'provider_error' | 'not_configured';

export class VisionProviderError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryable: boolean,
    /** not_configured means the operator has to act; the user cannot fix it. */
    public readonly code: VisionErrorCode = 'provider_error',
  ) {
    super(message);
  }
}

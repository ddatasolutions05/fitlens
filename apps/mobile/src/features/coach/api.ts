import { coachResultSchema, functionErrorSchema, type CoachRequest, type CoachResult } from '@fitlens/schemas';

import { supabase } from '@/lib/supabase';

export class CoachError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export async function askCoach(req: CoachRequest): Promise<CoachResult> {
  const { data, error } = await supabase.functions.invoke('coach', { method: 'POST', body: req });
  if (error) {
    let body: unknown = data;
    if (body == null && 'context' in error && error.context instanceof Response) {
      body = await error.context.json().catch(() => null);
    }
    const parsed = functionErrorSchema.safeParse(body);
    if (parsed.success) throw new CoachError(parsed.data.error.code, parsed.data.error.message, parsed.data.error.retryable ?? false);
    throw new CoachError('function_error', error.message, true);
  }
  return coachResultSchema.parse(data);
}

export function coachErrorMessage(err: unknown): string {
  if (err instanceof CoachError) {
    switch (err.code) {
      case 'consent_required':
        return 'The coach needs your AI consent. Turn it on under Profile, Diet and AI consent.';
      case 'rate_limited':
        return 'You have used today’s AI questions. The limit resets tomorrow.';
      case 'not_configured':
        return 'The coach is not configured on the server yet.';
      default:
        return err.message;
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}

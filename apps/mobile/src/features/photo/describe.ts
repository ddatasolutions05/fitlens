// Words to items: the describe-meal function returns the photo contract, so
// the same mapping onto the food database applies.
import { describeMealResultSchema, functionErrorSchema, type AnalyzeMealResult } from '@fitlens/schemas';

import { supabase } from '@/lib/supabase';

import { AnalyzeError } from './analyze';

export async function describeMeal(text: string): Promise<AnalyzeMealResult> {
  const { data, error } = await supabase.functions.invoke('describe-meal', { method: 'POST', body: { text } });
  if (error) {
    let body: unknown = data;
    if (body == null && 'context' in error && error.context instanceof Response) body = await error.context.json().catch(() => null);
    const parsed = functionErrorSchema.safeParse(body);
    if (parsed.success) throw new AnalyzeError(parsed.data.error.code, parsed.data.error.message, parsed.data.error.retryable ?? false);
    throw new AnalyzeError('function_error', error.message, true);
  }
  const r = describeMealResultSchema.parse(data);
  return { analysis_id: '00000000-0000-0000-0000-000000000000', status: 'succeeded', prompt_version: r.prompt_version, model: r.model, result: r.result, usage: r.usage };
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

/** The browser's speech recogniser when it has one (Chrome, recent Safari); null elsewhere. */
export function speechRecognizer(): RecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = typeof navigator !== 'undefined' ? navigator.language || 'en-CA' : 'en-CA';
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

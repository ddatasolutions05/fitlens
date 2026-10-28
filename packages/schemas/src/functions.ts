import { z } from 'zod';

import { analyzeMealResponseSchema, labelReadSchema } from './ai.ts';

// analyze-meal
export const analyzeMealRequestSchema = z.object({
  meal_id: z.string().uuid(),
  storage_paths: z.array(z.string().min(1)).min(1).max(4),
  answers: z.array(z.object({ item_ref: z.string(), question: z.string(), answer: z.string().max(120) })).max(8).optional(),
  locale: z.string().max(10).optional(),
});
export type AnalyzeMealRequest = z.infer<typeof analyzeMealRequestSchema>;

export const analyzeMealResultSchema = z.object({
  analysis_id: z.string().uuid(),
  status: z.literal('succeeded'),
  prompt_version: z.string(),
  model: z.string(),
  result: analyzeMealResponseSchema,
  usage: z.object({ analyses_today: z.number(), daily_limit: z.number() }),
});
export type AnalyzeMealResult = z.infer<typeof analyzeMealResultSchema>;

// describe-meal: a written or dictated description, same result shape as a photo
export const describeMealRequestSchema = z.object({ text: z.string().min(2).max(600) });
export const describeMealResultSchema = z.object({
  prompt_version: z.string(),
  model: z.string(),
  result: analyzeMealResponseSchema,
  usage: z.object({ analyses_today: z.number(), daily_limit: z.number() }),
});
export type DescribeMealResult = z.infer<typeof describeMealResultSchema>;

// read-label
export const readLabelRequestSchema = z.object({
  storage_path: z.string().min(1),
  meal_id: z.string().uuid().optional(),
});
export const readLabelResultSchema = z.object({
  prompt_version: z.string(),
  model: z.string(),
  result: labelReadSchema,
});
export type ReadLabelResult = z.infer<typeof readLabelResultSchema>;

// Open Food Facts product, shared by the barcode and name lookups
export const offPer100Schema = z.object({
  kcal: z.number().nullable(),
  protein_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fat_g: z.number().nullable(),
  fibre_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
  sat_fat_g: z.number().nullable(),
});

// lookup-barcode
export const lookupBarcodeRequestSchema = z.object({ barcode: z.string().regex(/^\d{6,14}$/) });
export const lookupBarcodeResultSchema = z.object({
  found: z.boolean(),
  source: z.literal('off'),
  product: z
    .object({
      barcode: z.string(),
      name: z.string(),
      brand: z.string().nullable(),
      per100: offPer100Schema,
      serving_g: z.number().nullable(),
      attribution: z.string(),
    })
    .nullable(),
});
export type LookupBarcodeResult = z.infer<typeof lookupBarcodeResultSchema>;

// lookup-product: name search for a packaged item seen in a photo
export const lookupProductRequestSchema = z.object({ query: z.string().min(2).max(120), limit: z.number().int().min(1).max(5).default(3) });
export const lookupProductResultSchema = z.object({
  source: z.literal('off'),
  query: z.string(),
  products: z
    .array(
      z.object({
        barcode: z.string().nullable(),
        name: z.string(),
        brand: z.string().nullable(),
        per100: offPer100Schema,
        serving_g: z.number().nullable(),
        attribution: z.string(),
        url: z.string().nullable(),
      }),
    )
    .max(5),
});
export type LookupProductResult = z.infer<typeof lookupProductResultSchema>;

// features (which optional services are configured)
export const featuresResultSchema = z.object({
  vision: z.object({ configured: z.boolean(), provider: z.string().nullable(), model: z.string().nullable(), reason: z.string().nullable() }),
  coach: z.object({ configured: z.boolean(), reason: z.string().nullable() }),
  fdc_branded: z.object({ configured: z.boolean(), reason: z.string().nullable() }),
  barcode: z.object({ configured: z.literal(true) }),
  daily_ai_limit: z.number(),
});
export type FeaturesResult = z.infer<typeof featuresResultSchema>;

// coach: a question answered from the caller's own logs
export const coachRequestSchema = z.object({
  question: z.string().min(1).max(500),
  history: z.array(z.object({ role: z.enum(['user', 'coach']), text: z.string().max(1500) })).max(8).optional(),
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type CoachRequest = z.infer<typeof coachRequestSchema>;

export const coachActionSchema = z.object({
  label: z.string().min(1).max(60),
  kind: z.enum(['search_food', 'log_water', 'log_weight', 'log_activity', 'open_targets']),
  query: z.string().max(80).nullable().default(null),
});
export const coachReplySchema = z.object({
  answer: z.string().min(1).max(1500),
  actions: z.array(coachActionSchema).max(3).default([]),
  grounded_on: z.array(z.string().max(80)).max(6).default([]),
});
export type CoachAction = z.infer<typeof coachActionSchema>;
export type CoachReply = z.infer<typeof coachReplySchema>;

export const coachResultSchema = z.object({
  prompt_version: z.string(),
  model: z.string(),
  reply: coachReplySchema,
  usage: z.object({ coach_calls_today: z.number(), daily_limit: z.number() }),
});
export type CoachResult = z.infer<typeof coachResultSchema>;

// export-data
export const exportDataResultSchema = z.object({
  signed_url: z.string().url(),
  expires_in_seconds: z.number(),
  bytes: z.number(),
  tables: z.record(z.string(), z.number()),
  photos: z.number(),
});
export type ExportDataResult = z.infer<typeof exportDataResultSchema>;

// delete-account
export const deleteAccountRequestSchema = z.object({ confirm: z.literal('DELETE') });
export const deleteAccountResultSchema = z.object({
  deleted: z.literal(true),
  photos_removed: z.number(),
});

// error envelope shared by all functions
export const functionErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean().optional(),
  }),
});
export type FunctionError = z.infer<typeof functionErrorSchema>;

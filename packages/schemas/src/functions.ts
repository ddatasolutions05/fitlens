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
      per100: z.object({
        kcal: z.number().nullable(),
        protein_g: z.number().nullable(),
        carbs_g: z.number().nullable(),
        fat_g: z.number().nullable(),
        fibre_g: z.number().nullable(),
        sodium_mg: z.number().nullable(),
        sat_fat_g: z.number().nullable(),
      }),
      serving_g: z.number().nullable(),
      attribution: z.string(),
    })
    .nullable(),
});
export type LookupBarcodeResult = z.infer<typeof lookupBarcodeResultSchema>;

// features (which optional services are configured)
export const featuresResultSchema = z.object({
  vision: z.object({ configured: z.boolean(), provider: z.string().nullable(), model: z.string().nullable(), reason: z.string().nullable() }),
  coach: z.object({ configured: z.boolean(), reason: z.string().nullable() }),
  fdc_branded: z.object({ configured: z.boolean(), reason: z.string().nullable() }),
  barcode: z.object({ configured: z.literal(true) }),
  daily_ai_limit: z.number(),
});
export type FeaturesResult = z.infer<typeof featuresResultSchema>;

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

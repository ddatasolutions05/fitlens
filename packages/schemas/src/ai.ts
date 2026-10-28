import { z } from 'zod';

export const PROMPT_VERSION = 'analyze-meal/2026-10-28.1';
export const LABEL_PROMPT_VERSION = 'read-label/2026-10-27.1';
export const COACH_PROMPT_VERSION = 'coach/2026-10-28.1';

export const confidenceSchema = z.enum(['low', 'medium', 'high']);

export const nutrientsPer100EstimateSchema = z
    .object({
      kcal: z.number().min(0).max(900).nullable(),
      protein_g: z.number().min(0).max(100).nullable(),
      carbs_g: z.number().min(0).max(100).nullable(),
      fat_g: z.number().min(0).max(100).nullable(),
      fibre_g: z.number().min(0).max(60).nullable(),
    })
    .nullable()
    .default(null);

export const analyzedItemSchema = z.object({
  name: z.string().min(1).max(120),
  dish_type: z.string().max(60),
  cuisine: z.string().max(60),
  prep_method_assumed: z.string().max(120),
  portion_g_estimate: z.number().min(0).max(5000),
  portion_g_range: z.tuple([z.number().min(0).max(5000), z.number().min(0).max(5000)]),
  household_unit_estimate: z.string().max(80),
  hidden_ingredients_assumed: z.array(z.string().max(80)).max(10),
  db_query_terms: z.array(z.string().min(1).max(60)).min(1).max(6),
  confidence: confidenceSchema,
  uncertainty_drivers: z.array(z.string().max(120)).max(6),
  // Used only when no database source matches. Labelled "AI estimate" in the app.
  nutrients_per100_estimate: nutrientsPer100EstimateSchema,
});


export const packagedItemSchema = z.object({
  name: z.string().min(1).max(120),
  reason: z.string().max(200),
  // A product the model recognises by brand and name gets its typical label values so the meal is not left empty; the app marks them as estimates to check against the pack.
  serving_g_estimate: z.number().min(0).max(5000).nullable().default(null),
  household_unit_estimate: z.string().max(80).default(''),
  confidence: confidenceSchema.default('low'),
  nutrients_per100_estimate: nutrientsPer100EstimateSchema,
});

export const clarifyingQuestionSchema = z.object({
  item_ref: z.string().max(120),
  question: z.string().min(1).max(200),
  quick_options: z.array(z.string().min(1).max(60)).min(2).max(8),
  affects: z.enum(['portion', 'fat', 'ingredients', 'servings']),
});

export const analyzeMealResponseSchema = z.object({
  items: z.array(analyzedItemSchema).max(12),
  packaged_items: z.array(packagedItemSchema).max(6),
  questions: z.array(clarifyingQuestionSchema).max(4),
});

export type AnalyzedItem = z.infer<typeof analyzedItemSchema>;
export type PackagedItem = z.infer<typeof packagedItemSchema>;
export type ClarifyingQuestion = z.infer<typeof clarifyingQuestionSchema>;
export type AnalyzeMealResponse = z.infer<typeof analyzeMealResponseSchema>;

/** Nutrition panel read by the vision model. Values are per the stated serving. */
export const labelReadSchema = z.object({
  product_name: z.string().max(120).nullable(),
  brand: z.string().max(80).nullable(),
  serving_size_text: z.string().max(60).nullable(),
  serving_size_g: z.number().min(0).max(2000).nullable(),
  servings_per_container: z.number().min(0).max(200).nullable(),
  per_serving: z.object({
    kcal: z.number().min(0).max(5000).nullable(),
    protein_g: z.number().min(0).max(500).nullable(),
    carbs_g: z.number().min(0).max(500).nullable(),
    fat_g: z.number().min(0).max(500).nullable(),
    fibre_g: z.number().min(0).max(200).nullable(),
    sodium_mg: z.number().min(0).max(20000).nullable(),
    sat_fat_g: z.number().min(0).max(200).nullable(),
  }),
  confidence: confidenceSchema,
  notes: z.array(z.string().max(120)).max(5),
});
export type LabelRead = z.infer<typeof labelReadSchema>;

/** Pulls the first JSON object out of a model reply that may include stray text. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model output');
  return JSON.parse(candidate.slice(start, end + 1));
}

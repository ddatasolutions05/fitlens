// Packaged products seen in a photo: the model names them, the internet
// (Open Food Facts) supplies label values, and the person approves one.
import type { Per100 } from '@fitlens/core';
import { lookupProductResultSchema, type LookupProductResult, type NutrientsPer100Estimate } from '@fitlens/schemas';

import { newItem, type DraftItem } from '@/features/meals/model';
import { supabase } from '@/lib/supabase';

export type Product = LookupProductResult['products'][number];

export interface PackagedSuggestion {
  name: string;
  reason: string;
  /** The model's typical values for a product it could read by name, or null. */
  estimate: { per100: NutrientsPer100Estimate; servingG: number; unit: string; confidence: 'low' | 'medium' | 'high' } | null;
}

export async function lookupProduct(query: string, limit = 3): Promise<Product[]> {
  const { data, error } = await supabase.functions.invoke('lookup-product', { method: 'POST', body: { query, limit } });
  if (error) throw error;
  return lookupProductResultSchema.parse(data).products;
}

/** A draft item from an Open Food Facts product; the person has approved it. */
export async function itemFromProduct(product: Product, grams: number, userId: string): Promise<DraftItem> {
  const per100: Per100 = product.per100;
  const name = product.brand ? `${product.name} (${product.brand})` : product.name;
  const { data: food, error } = await supabase
    .from('foods')
    .insert({
      owner_user_id: userId,
      source: 'off',
      name,
      barcode: product.barcode,
      kcal: per100.kcal,
      protein_g: per100.protein_g,
      carbs_g: per100.carbs_g,
      fat_g: per100.fat_g,
      fibre_g: per100.fibre_g,
      sodium_mg: per100.sodium_mg,
      sat_fat_g: per100.sat_fat_g,
      default_serving_g: product.serving_g,
      attribution: product.attribution,
    })
    .select('id')
    .single();
  if (error) throw error;
  return newItem({
    foodId: food.id,
    name,
    grams: Math.round(grams),
    servingLabel: product.serving_g ? `1 serving (${Math.round(product.serving_g)} g)` : null,
    per100,
    provenance: 'community',
    sourceName: 'Open Food Facts',
    confidence: 'medium',
    assumptions: ['Label values from Open Food Facts, approved by you. Community data; check the pack if it matters.'],
  });
}

/** A draft item from the model's typical values; the person has approved it. */
export async function itemFromEstimate(s: PackagedSuggestion, userId: string, model: string): Promise<DraftItem> {
  if (!s.estimate) throw new Error('No estimate to add');
  const e = s.estimate;
  const per100: Per100 = { kcal: e.per100.kcal, protein_g: e.per100.protein_g, carbs_g: e.per100.carbs_g, fat_g: e.per100.fat_g, fibre_g: e.per100.fibre_g, sodium_mg: null, sat_fat_g: null };
  const { data: food, error } = await supabase
    .from('foods')
    .insert({ owner_user_id: userId, source: 'ai_estimate', name: s.name, kcal: per100.kcal, protein_g: per100.protein_g, carbs_g: per100.carbs_g, fat_g: per100.fat_g, fibre_g: per100.fibre_g, default_serving_g: e.servingG, attribution: `AI estimate from the product name (${model})` })
    .select('id')
    .single();
  if (error) throw error;
  return newItem({
    foodId: food.id,
    name: s.name,
    grams: Math.round(e.servingG),
    gramsRange: [e.servingG * 0.9, e.servingG * 1.1],
    servingLabel: e.unit || null,
    per100,
    provenance: 'ai_estimate',
    sourceName: model,
    confidence: e.confidence,
    assumptions: ['Typical label values recalled from the product name, approved by you. Check them against the pack.', s.reason],
  });
}

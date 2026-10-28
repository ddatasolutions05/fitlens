// Calls analyze-meal, then maps the validated result onto draft items using
// the food database first and the AI estimate only as a labelled fallback.
import { FAT_OPTIONS, FAT_PER100, bestMatch, type Per100 } from '@fitlens/core';
import {
  analyzeMealResultSchema,
  functionErrorSchema,
  type AnalyzeMealRequest,
  type AnalyzeMealResult,
  type AnalyzedItem,
  type ClarifyingQuestion,
} from '@fitlens/schemas';

import { newItem, type DraftItem } from '@/features/meals/model';
import { supabase } from '@/lib/supabase';

import type { SearchFoodRow } from '../food/hooks';
import { pickedFromSearch, draftItemFromPicked } from '../food/AddFoodSheet';

export class AnalyzeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export async function analyzeMeal(req: AnalyzeMealRequest): Promise<AnalyzeMealResult> {
  const { data, error } = await supabase.functions.invoke('analyze-meal', { method: 'POST', body: req });
  if (error) {
    let body: unknown = data;
    if (body == null && 'context' in error && error.context instanceof Response) {
      body = await error.context.json().catch(() => null);
    }
    const parsed = functionErrorSchema.safeParse(body);
    if (parsed.success) throw new AnalyzeError(parsed.data.error.code, parsed.data.error.message, parsed.data.error.retryable ?? false);
    throw new AnalyzeError('function_error', error.message, true);
  }
  return analyzeMealResultSchema.parse(data);
}

export interface Answer {
  question: ClarifyingQuestion;
  answer: string;
}

async function searchDb(term: string): Promise<SearchFoodRow[]> {
  const { data, error } = await supabase.rpc('search_foods', { p_query: term, p_limit: 15 });
  if (error) throw error;
  return data;
}

function countFromAnswer(answer: string): number | null {
  const m = answer.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]!.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function portionFactor(answer: string): { grams?: number; fraction?: number } {
  const a = answer.toLowerCase();
  if (/\b(half|1\/2|50%)\b/.test(a)) return { fraction: 0.5 };
  if (/\b(quarter|1\/4|25%)\b/.test(a)) return { fraction: 0.25 };
  if (/\b(three quarters|3\/4|75%)\b/.test(a)) return { fraction: 0.75 };
  if (/\b(all|whole|everything|one serving|single)\b/.test(a)) return { fraction: 1 };
  if (/\bsmall\b/.test(a)) return { grams: 0.75 };
  if (/\blarge\b/.test(a)) return { grams: 1.3 };
  if (/\bmedium\b/.test(a)) return { grams: 1 };
  const g = a.match(/(\d+)\s*g\b/);
  if (g) return { grams: Number(g[1]) };
  return {};
}

function fatItemFor(answer: string): DraftItem | null {
  const a = answer.toLowerCase();
  if (/\bnone\b|no (oil|fat|butter|ghee)/.test(a)) return null;
  const opt = FAT_OPTIONS.find((o) => o.fat !== 'none' && a.includes(o.label.toLowerCase()));
  let fat: 'oil' | 'butter' | 'ghee' | null = opt?.fat === 'none' ? null : (opt?.fat ?? null);
  let grams = opt?.grams ?? null;
  if (!fat) {
    fat = /ghee/.test(a) ? 'ghee' : /butter/.test(a) ? 'butter' : /oil/.test(a) ? 'oil' : null;
  }
  if (!fat) return null;
  if (grams == null) {
    const tbsp = a.match(/(\d+(?:\.\d+)?)\s*tbsp/);
    const tsp = a.match(/(\d+(?:\.\d+)?)\s*tsp/);
    grams = tbsp ? Number(tbsp[1]) * 13.5 : tsp ? Number(tsp[1]) * 4.5 : 13.5;
  }
  return newItem({
    name: fat === 'oil' ? 'Cooking oil' : fat === 'ghee' ? 'Ghee' : 'Butter',
    grams: Math.round(grams * 10) / 10,
    servingLabel: answer,
    per100: FAT_PER100[fat],
    provenance: 'database',
    sourceName: 'USDA FoodData Central',
    assumptions: [`Cooking fat from your answer: ${answer}`],
  });
}

export interface MappedAnalysis {
  items: DraftItem[];
  packaged: { name: string; reason: string }[];
  unmatched: string[];
}

/** Turns the AI items plus the user's answers into draft items with snapshots. */
export async function mapAnalysisToItems(result: AnalyzeMealResult, answers: Answer[], userId: string): Promise<MappedAnalysis> {
  const items: DraftItem[] = [];
  const unmatched: string[] = [];

  for (const ai of result.result.items) {
    const mine = answers.filter((a) => a.question.item_ref === ai.name);
    let grams = ai.portion_g_estimate;
    let range: [number, number] = [ai.portion_g_range[0], ai.portion_g_range[1]];
    let fraction = 1;
    const assumptions: string[] = [];
    if (ai.prep_method_assumed) assumptions.push(`Assumed ${ai.prep_method_assumed}`);
    for (const h of ai.hidden_ingredients_assumed) assumptions.push(`Assumed hidden ingredient: ${h}`);
    for (const u of ai.uncertainty_drivers) assumptions.push(`Uncertain: ${u}`);
    let variantHint: string | null = null;

    for (const a of mine) {
      if (a.question.affects === 'servings') {
        const n = countFromAnswer(a.answer);
        if (n != null) {
          grams = ai.portion_g_estimate * n;
          range = [ai.portion_g_range[0] * n, ai.portion_g_range[1] * n];
          assumptions.push(`${n} × ${ai.household_unit_estimate || 'unit'}`);
        }
      } else if (a.question.affects === 'portion') {
        const f = portionFactor(a.answer);
        if (f.fraction != null) fraction = f.fraction;
        if (f.grams != null) {
          if (f.grams > 5) {
            grams = f.grams;
            range = [f.grams * 0.85, f.grams * 1.15];
          } else {
            grams = grams * f.grams;
            range = [range[0] * f.grams, range[1] * f.grams];
          }
        }
        if (/thin|thick|plain|tadka|ghee|dry|gravy/i.test(a.answer)) variantHint = a.answer;
        assumptions.push(`Portion: ${a.answer}`);
      } else if (a.question.affects === 'ingredients') {
        assumptions.push(`${a.question.question} ${a.answer}`);
      }
    }

    const terms = [...ai.db_query_terms, ai.name];
    let picked: SearchFoodRow | null = null;
    for (const term of terms) {
      const rows = await searchDb(term).catch(() => []);
      if (rows.length === 0) continue;
      const pool = variantHint ? [...rows].sort((r) => (r.variant_label && r.variant_label.toLowerCase().includes(variantHint!.toLowerCase().split(' ')[0]!) ? -1 : 1)) : rows;
      const best = bestMatch(ai.name, pool, (r) => (r.variant_label ? `${r.name} ${r.variant_label}` : r.name));
      const byTerm = bestMatch(term, pool, (r) => r.name);
      const choice = best ?? byTerm;
      if (choice) {
        picked = choice.candidate;
        break;
      }
    }

    if (picked) {
      const item = draftItemFromPicked(pickedFromSearch(picked), Math.round(grams), ai.household_unit_estimate || null);
      items.push({ ...item, gramsRange: range, fractionEaten: fraction, confidence: ai.confidence, assumptions });
      continue;
    }

    if (ai.nutrients_per100_estimate && ai.nutrients_per100_estimate.kcal != null) {
      const per100: Per100 = {
        kcal: ai.nutrients_per100_estimate.kcal,
        protein_g: ai.nutrients_per100_estimate.protein_g,
        carbs_g: ai.nutrients_per100_estimate.carbs_g,
        fat_g: ai.nutrients_per100_estimate.fat_g,
        fibre_g: ai.nutrients_per100_estimate.fibre_g,
        sodium_mg: null,
        sat_fat_g: null,
      };
      const { data: food, error } = await supabase
        .from('foods')
        .insert({ owner_user_id: userId, source: 'ai_estimate', name: ai.name, kcal: per100.kcal, protein_g: per100.protein_g, carbs_g: per100.carbs_g, fat_g: per100.fat_g, fibre_g: per100.fibre_g, default_serving_g: ai.portion_g_estimate, attribution: `AI estimate (${result.model})` })
        .select('id')
        .single();
      if (error) throw error;
      items.push(
        newItem({
          foodId: food.id,
          name: ai.name,
          grams: Math.round(grams),
          gramsRange: range,
          servingLabel: ai.household_unit_estimate || null,
          fractionEaten: fraction,
          per100,
          provenance: 'ai_estimate',
          sourceName: result.model,
          confidence: ai.confidence,
          assumptions: [...assumptions, 'No database match; nutrients are an AI estimate'],
        }),
      );
      continue;
    }
    unmatched.push(ai.name);
  }

  // Packaged products the model could read get their typical label values as an
  // estimate so the meal is not empty; the ones it could not read stay on the list.
  const packaged: MappedAnalysis['packaged'] = [];
  for (const p of result.result.packaged_items) {
    const n = p.nutrients_per100_estimate;
    if (!n || n.kcal == null || !p.serving_g_estimate) {
      packaged.push({ name: p.name, reason: p.reason });
      continue;
    }
    const per100: Per100 = { kcal: n.kcal, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g, fibre_g: n.fibre_g, sodium_mg: null, sat_fat_g: null };
    const { data: food, error } = await supabase
      .from('foods')
      .insert({ owner_user_id: userId, source: 'ai_estimate', name: p.name, kcal: per100.kcal, protein_g: per100.protein_g, carbs_g: per100.carbs_g, fat_g: per100.fat_g, fibre_g: per100.fibre_g, default_serving_g: p.serving_g_estimate, attribution: `AI estimate from the product name (${result.model})` })
      .select('id')
      .single();
    if (error) throw error;
    items.push(
      newItem({
        foodId: food.id,
        name: p.name,
        grams: Math.round(p.serving_g_estimate),
        gramsRange: [p.serving_g_estimate * 0.9, p.serving_g_estimate * 1.1],
        servingLabel: p.household_unit_estimate || null,
        fractionEaten: 1,
        per100,
        provenance: 'ai_estimate',
        sourceName: result.model,
        confidence: p.confidence,
        assumptions: ['Packaged product: typical label values recalled from the name. Check them against the pack.', p.reason],
      }),
    );
  }

  for (const a of answers) {
    if (a.question.affects === 'fat') {
      const fat = fatItemFor(a.answer);
      if (fat) items.push(fat);
    }
  }

  return { items, packaged, unmatched };
}

export function questionsFor(result: AnalyzeMealResult): ClarifyingQuestion[] {
  return result.result.questions.slice(0, 4);
}

export type { AnalyzedItem };

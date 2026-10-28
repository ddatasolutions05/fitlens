// Open Food Facts name search for packaged products seen in a photo. Results
// are community data, labelled as such, and only ever suggested to the person.
import { lookupProductRequestSchema, type LookupProductResult } from '@fitlens/schemas';

import { readEnv, requireUser } from '../_shared/auth.ts';
import { HttpError, handle, json, readJson } from '../_shared/http.ts';

const USER_AGENT = 'FitLens/0.1 (personal nutrition tracker; https://github.com/fitlens) contact: owner';

type Product = LookupProductResult['products'][number];

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** "473 ml", "1 bar (68 g)", "2 sausages (90g)": the grams or millilitres in the text, else null. */
function servingFromText(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = v.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
  if (!m) return null;
  const n = Number(m[1]!.replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 5000 ? n : null;
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !/^(ml|g|can|bottle|pack|of|the|a)$/.test(t));
}

/** Share of query words found in the product name and brand; kcal presence breaks ties. */
function score(query: string, p: Product): number {
  const q = tokens(query);
  if (q.length === 0) return 0;
  const hay = tokens(`${p.name} ${p.brand ?? ''}`);
  const hit = q.filter((t) => hay.some((h) => h.startsWith(t) || t.startsWith(h))).length;
  return hit / q.length + (p.per100.kcal != null ? 0.05 : 0);
}

function toProduct(raw: Record<string, unknown>): Product | null {
  const name = typeof raw.product_name === 'string' ? raw.product_name.trim() : '';
  if (!name) return null;
  const n = (raw.nutriments ?? {}) as Record<string, unknown>;
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) != null ? Math.round((num(n['energy_100g']) as number) / 4.184) : null);
  const sodium = num(n['sodium_100g']);
  const salt = num(n['salt_100g']);
  const code = typeof raw.code === 'string' && /^\d{6,14}$/.test(raw.code) ? raw.code : null;
  return {
    barcode: code,
    name,
    brand: raw.brands ? String(raw.brands).split(',')[0]!.trim() : null,
    per100: {
      kcal,
      protein_g: num(n['proteins_100g']),
      carbs_g: num(n['carbohydrates_100g']),
      fat_g: num(n['fat_100g']),
      fibre_g: num(n['fiber_100g']),
      sodium_mg: sodium != null ? Math.round(sodium * 1000) : salt != null ? Math.round(salt * 400) : null,
      sat_fat_g: num(n['saturated-fat_100g']),
    },
    serving_g: num(raw.serving_quantity) ?? servingFromText(raw.serving_size),
    attribution: 'Open Food Facts (ODbL), community data',
    url: code ? `https://world.openfoodfacts.org/product/${code}` : null,
  };
}

const FIELDS = 'code,product_name,brands,nutriments,serving_quantity,serving_size';

// The newer search service answers branded queries well; the legacy CGI search
// throttles hard (503) but still works for generic names, so it is the fallback.
async function searchOpenFoodFacts(query: string): Promise<Record<string, unknown>[]> {
  const headers = { 'User-Agent': USER_AGENT };
  try {
    const url = new URL('https://search.openfoodfacts.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('page_size', '12');
    url.searchParams.set('fields', FIELDS);
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const data = (await res.json()) as { hits?: Record<string, unknown>[] };
      if (Array.isArray(data.hits)) return data.hits;
    }
  } catch {
    // fall through to the legacy search
  }
  const legacy = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  legacy.searchParams.set('search_terms', query);
  legacy.searchParams.set('search_simple', '1');
  legacy.searchParams.set('action', 'process');
  legacy.searchParams.set('json', '1');
  legacy.searchParams.set('page_size', '12');
  legacy.searchParams.set('fields', FIELDS);
  const res = await fetch(legacy, { headers, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new HttpError(502, 'upstream_error', `Open Food Facts returned ${res.status}`, true);
  const data = (await res.json()) as { products?: Record<string, unknown>[] };
  return data.products ?? [];
}

Deno.serve(
  handle(async (req, requestId) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST only');
    const env = readEnv();
    await requireUser(req, env);
    const body = lookupProductRequestSchema.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, 'bad_request', 'query must be 2 to 120 characters');

    const raw = await searchOpenFoodFacts(body.data.query);
    const products = raw
      .map(toProduct)
      .filter((p): p is Product => p != null && p.per100.kcal != null)
      .map((p) => ({ p, s: score(body.data.query, p) }))
      .filter((x) => x.s >= 0.4)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p)
      .filter((p, i, all) => all.findIndex((q) => `${q.name} ${q.brand ?? ''}`.toLowerCase() === `${p.name} ${p.brand ?? ''}`.toLowerCase()) === i)
      .slice(0, body.data.limit);
    const result: LookupProductResult = { source: 'off', query: body.data.query, products };
    return json(result, 200, { 'x-request-id': requestId });
  }),
);

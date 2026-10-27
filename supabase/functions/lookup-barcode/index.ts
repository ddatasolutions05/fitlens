// Open Food Facts lookup. Results are community data and labelled as such.
import { lookupBarcodeRequestSchema, type LookupBarcodeResult } from '@fitlens/schemas';

import { readEnv, requireUser } from '../_shared/auth.ts';
import { HttpError, handle, json, readJson } from '../_shared/http.ts';

const USER_AGENT = 'FitLens/0.1 (personal nutrition tracker; https://github.com/fitlens) contact: owner';

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

Deno.serve(
  handle(async (req, requestId) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST only');
    const env = readEnv();
    await requireUser(req, env);
    const body = lookupBarcodeRequestSchema.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, 'bad_request', 'Barcode must be 6 to 14 digits');

    const url = `https://world.openfoodfacts.org/api/v2/product/${body.data.barcode}.json?fields=product_name,brands,nutriments,serving_quantity,serving_size`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.status === 404) {
      const notFound: LookupBarcodeResult = { found: false, source: 'off', product: null };
      return json(notFound, 200, { 'x-request-id': requestId });
    }
    if (!res.ok) throw new HttpError(502, 'upstream_error', `Open Food Facts returned ${res.status}`, true);
    const data = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    if (!data.product || data.status === 0) {
      const notFound: LookupBarcodeResult = { found: false, source: 'off', product: null };
      return json(notFound, 200, { 'x-request-id': requestId });
    }
    const p = data.product;
    const n = (p.nutriments ?? {}) as Record<string, unknown>;
    const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) != null ? Math.round((num(n['energy_100g']) as number) / 4.184) : null);
    const sodium = num(n['sodium_100g']);
    const salt = num(n['salt_100g']);
    const result: LookupBarcodeResult = {
      found: true,
      source: 'off',
      product: {
        barcode: body.data.barcode,
        name: String(p.product_name ?? 'Unknown product'),
        brand: p.brands ? String(p.brands) : null,
        per100: {
          kcal,
          protein_g: num(n['proteins_100g']),
          carbs_g: num(n['carbohydrates_100g']),
          fat_g: num(n['fat_100g']),
          fibre_g: num(n['fiber_100g']),
          sodium_mg: sodium != null ? Math.round(sodium * 1000) : salt != null ? Math.round(salt * 400) : null,
          sat_fat_g: num(n['saturated-fat_100g']),
        },
        serving_g: num(p.serving_quantity),
        attribution: 'Open Food Facts (ODbL), community data',
      },
    };
    return json(result, 200, { 'x-request-id': requestId });
  }),
);

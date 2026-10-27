// Builds a zip with JSON and CSV per table plus the photos, uploads it to the
// user's private folder and returns a five-minute signed URL.
import { zipSync, strToU8 } from 'fflate';
import type { ExportDataResult } from '@fitlens/schemas';

import { readEnv, requireUser } from '../_shared/auth.ts';
import { HttpError, handle, json } from '../_shared/http.ts';

const TABLES = [
  'profiles',
  'preferences',
  'goal_versions',
  'foods',
  'food_servings',
  'user_food_usage',
  'meals',
  'meal_items',
  'meal_photos',
  'photo_analyses',
  'saved_meals',
  'saved_meal_items',
  'recipes',
  'recipe_ingredients',
  'weight_logs',
  'activity_records',
  'water_logs',
  'day_status',
  'target_suggestions',
  'integration_connections',
  'ai_usage',
] as const;

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown): string => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

Deno.serve(
  handle(async (req, requestId) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST only');
    const env = readEnv();
    const caller = await requireUser(req, env);

    const files: Record<string, Uint8Array> = {};
    const counts: Record<string, number> = {};
    for (const table of TABLES) {
      const ownerCol = table === 'foods' || table === 'food_servings' ? 'owner_user_id' : 'user_id';
      const { data, error } = await caller.userClient.from(table).select('*').eq(ownerCol, caller.userId);
      if (error) throw new HttpError(500, 'db_error', `Could not read ${table}`);
      const rows = (data ?? []) as Record<string, unknown>[];
      counts[table] = rows.length;
      files[`json/${table}.json`] = strToU8(JSON.stringify(rows, null, 2));
      files[`csv/${table}.csv`] = strToU8(toCsv(rows));
    }

    const { data: photos } = await caller.userClient.from('meal_photos').select('storage_path').eq('user_id', caller.userId);
    let photoCount = 0;
    for (const p of photos ?? []) {
      const { data: blob } = await caller.admin.storage.from('meal-photos').download(p.storage_path);
      if (!blob) continue;
      files[`photos/${p.storage_path.split('/').slice(1).join('_')}`] = new Uint8Array(await blob.arrayBuffer());
      photoCount += 1;
    }
    files['README.txt'] = strToU8(
      `FitLens export for user ${caller.userId}\nCreated ${new Date().toISOString()}\n\njson/: one file per table\ncsv/: the same rows as CSV\nphotos/: original meal photos\n\nNutrient values in meal_items are the snapshots taken when each meal was confirmed.\n`,
    );

    const zipped = zipSync(files, { level: 6 });
    const path = `${caller.userId}/exports/fitlens-export-${Date.now()}.zip`;
    const { error: upErr } = await caller.admin.storage.from('meal-photos').upload(path, zipped, { contentType: 'application/zip', upsert: true });
    if (upErr) throw new HttpError(500, 'storage_error', 'Could not store the export');
    const { data: signed, error: signErr } = await caller.admin.storage.from('meal-photos').createSignedUrl(path, 300);
    if (signErr || !signed) throw new HttpError(500, 'storage_error', 'Could not sign the export');

    const result: ExportDataResult = { signed_url: signed.signedUrl, expires_in_seconds: 300, bytes: zipped.length, tables: counts, photos: photoCount };
    return json(result, 200, { 'x-request-id': requestId });
  }),
);

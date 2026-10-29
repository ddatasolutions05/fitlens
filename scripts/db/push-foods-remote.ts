// Upserts the curated Indian seed into the linked project through the
// Management API, for when the database password is not at hand.
// Usage: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... npx tsx scripts/db/push-foods-remote.ts
import 'dotenv/config';

import { loadIndian } from '../food-import/sources/indian';
import type { FoodRow } from '../food-import/types';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) throw new Error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required');

async function query<T = unknown>(sql: string): Promise<T> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const body = (await res.json()) as T & { message?: string };
  if (!res.ok) throw new Error(`query failed: ${res.status} ${body.message ?? JSON.stringify(body)}`);
  return body;
}

// $json$ cannot appear inside the data; the names are plain text.
function lit(v: unknown): string {
  const s = JSON.stringify(v);
  if (s.includes('$json$')) throw new Error('unexpected $json$ in data');
  return `$json$${s}$json$::jsonb`;
}

async function upsert(rows: FoodRow[]): Promise<Map<string, string>> {
  const payload = rows.map((r) => ({
    source: r.source,
    source_ref: r.sourceRef,
    name: r.name,
    aliases: r.aliases ?? null,
    verified: r.verified,
    kcal: r.kcal,
    protein_g: r.proteinG,
    carbs_g: r.carbsG,
    fat_g: r.fatG,
    fibre_g: r.fibreG,
    sodium_mg: r.sodiumMg,
    sat_fat_g: r.satFatG,
    default_serving_g: r.defaultServingG,
    variant_of_ref: r.variantOfRef,
    variant_label: r.variantLabel,
    attribution: r.attribution,
  }));
  const res = await query<{ id: string; source_ref: string }[]>(`
    insert into public.foods as f
      (source, source_ref, name, aliases, verified, kcal, protein_g, carbs_g, fat_g, fibre_g, sodium_mg, sat_fat_g,
       default_serving_g, variant_of, variant_label, attribution)
    select v.source, v.source_ref, v.name, v.aliases, v.verified, v.kcal, v.protein_g, v.carbs_g, v.fat_g, v.fibre_g,
           v.sodium_mg, v.sat_fat_g, v.default_serving_g, p.id, v.variant_label, v.attribution
    from jsonb_to_recordset(${lit(payload)}) as v(
      source text, source_ref text, name text, aliases text, verified boolean, kcal numeric, protein_g numeric,
      carbs_g numeric, fat_g numeric, fibre_g numeric, sodium_mg numeric, sat_fat_g numeric,
      default_serving_g numeric, variant_of_ref text, variant_label text, attribution text)
    left join public.foods p on p.owner_user_id is null and p.source = v.source and p.source_ref = v.variant_of_ref
    on conflict (source, source_ref) where owner_user_id is null and source_ref is not null do update set
      name = excluded.name, aliases = excluded.aliases, verified = excluded.verified, kcal = excluded.kcal,
      protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g, fibre_g = excluded.fibre_g,
      sodium_mg = excluded.sodium_mg, sat_fat_g = excluded.sat_fat_g, default_serving_g = excluded.default_serving_g,
      variant_of = excluded.variant_of, variant_label = excluded.variant_label, attribution = excluded.attribution
    returning f.id, f.source_ref`);
  return new Map(res.map((r) => [r.source_ref, r.id]));
}

async function replaceServings(rows: FoodRow[], ids: Map<string, string>): Promise<number> {
  const servings: { food_id: string; label: string; grams: number; sort_order: number }[] = [];
  for (const r of rows) {
    const id = ids.get(r.sourceRef);
    if (!id) throw new Error(`no id for ${r.sourceRef}`);
    r.servings.forEach((s, i) => servings.push({ food_id: id, label: s.label, grams: s.grams, sort_order: i }));
  }
  await query(`delete from public.food_servings where owner_user_id is null and food_id = any(select (x->>'id')::uuid from jsonb_array_elements(${lit([...ids.values()].map((id) => ({ id })))}) x)`);
  await query(`insert into public.food_servings (food_id, label, grams, sort_order)
    select food_id, label, grams, sort_order from jsonb_to_recordset(${lit(servings)}) as v(food_id uuid, label text, grams numeric, sort_order smallint)`);
  return servings.length;
}

async function main(): Promise<void> {
  const rows = await loadIndian();
  const bases = rows.filter((r) => r.variantOfRef === null);
  const variants = rows.filter((r) => r.variantOfRef !== null);
  let servings = 0;
  for (const group of [bases, variants]) {
    const ids = await upsert(group);
    servings += await replaceServings(group, ids);
  }
  const check = await query<{ n: string }[]>(`select count(*) as n from public.foods where source = 'ifct' and owner_user_id is null`);
  console.log(`indian: ${rows.length} rows written, ${servings} servings; ifct rows on the project: ${check[0]?.n}`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});

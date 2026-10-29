import type { Client } from 'pg';
import type { FoodRow } from './types';

export interface WriteCounts {
  inserted: number;
  updated: number;
  servings: number;
}

const BATCH = 1000;

// Upserts shared foods on (source, source_ref) and replaces their shared servings.
// Base rows are written before variants so variant_of can resolve in SQL.
export async function writeFoods(client: Client, rows: FoodRow[]): Promise<WriteCounts> {
  const counts: WriteCounts = { inserted: 0, updated: 0, servings: 0 };
  const bases = rows.filter((r) => r.variantOfRef === null);
  const variants = rows.filter((r) => r.variantOfRef !== null);
  for (const group of [bases, variants]) {
    for (let i = 0; i < group.length; i += BATCH) {
      const batch = group.slice(i, i + BATCH);
      const ids = await upsertBatch(client, batch, counts);
      counts.servings += await replaceServings(client, batch, ids);
    }
  }
  return counts;
}

async function upsertBatch(client: Client, batch: FoodRow[], counts: WriteCounts): Promise<Map<string, string>> {
  const col = <T>(f: (r: FoodRow) => T): T[] => batch.map(f);
  const res = await client.query<{ id: string; source_ref: string; inserted: boolean }>(
    `insert into public.foods as f
       (source, source_ref, name, verified, kcal, protein_g, carbs_g, fat_g, fibre_g, sodium_mg, sat_fat_g,
        default_serving_g, variant_of, variant_label, attribution, aliases)
     select v.source, v.source_ref, v.name, v.verified, v.kcal, v.protein_g, v.carbs_g, v.fat_g, v.fibre_g,
            v.sodium_mg, v.sat_fat_g, v.default_serving_g, p.id, v.variant_label, v.attribution, v.aliases
     from unnest($1::text[], $2::text[], $3::text[], $4::boolean[], $5::numeric[], $6::numeric[], $7::numeric[],
                 $8::numeric[], $9::numeric[], $10::numeric[], $11::numeric[], $12::numeric[], $13::text[],
                 $14::text[], $15::text[], $16::text[])
       as v(source, source_ref, name, verified, kcal, protein_g, carbs_g, fat_g, fibre_g, sodium_mg, sat_fat_g,
            default_serving_g, variant_of_ref, variant_label, attribution, aliases)
     left join public.foods p
       on p.owner_user_id is null and p.source = v.source and p.source_ref = v.variant_of_ref
     on conflict (source, source_ref) where owner_user_id is null and source_ref is not null do update set
       name = excluded.name,
       verified = excluded.verified,
       kcal = excluded.kcal,
       protein_g = excluded.protein_g,
       carbs_g = excluded.carbs_g,
       fat_g = excluded.fat_g,
       fibre_g = excluded.fibre_g,
       sodium_mg = excluded.sodium_mg,
       sat_fat_g = excluded.sat_fat_g,
       default_serving_g = excluded.default_serving_g,
       variant_of = excluded.variant_of,
       variant_label = excluded.variant_label,
       attribution = excluded.attribution,
       aliases = excluded.aliases
     returning f.id, f.source_ref, (f.xmax = 0) as inserted`,
    [
      col((r) => r.source),
      col((r) => r.sourceRef),
      col((r) => r.name),
      col((r) => r.verified),
      col((r) => r.kcal),
      col((r) => r.proteinG),
      col((r) => r.carbsG),
      col((r) => r.fatG),
      col((r) => r.fibreG),
      col((r) => r.sodiumMg),
      col((r) => r.satFatG),
      col((r) => r.defaultServingG),
      col((r) => r.variantOfRef),
      col((r) => r.variantLabel),
      col((r) => r.attribution),
      col((r) => r.aliases ?? null),
    ],
  );
  const ids = new Map<string, string>();
  for (const r of res.rows) {
    ids.set(r.source_ref, r.id);
    if (r.inserted) counts.inserted++;
    else counts.updated++;
  }
  const unresolved = batch.filter((r) => r.variantOfRef !== null).length;
  if (unresolved > 0) {
    const missing = await client.query<{ n: string }>(
      `select count(*) as n from public.foods
        where owner_user_id is null and id = any($1::uuid[]) and variant_label is not null and variant_of is null`,
      [[...ids.values()]],
    );
    if (Number(missing.rows[0]?.n ?? 0) > 0) throw new Error(`${missing.rows[0]?.n} variant(s) with an unknown base`);
  }
  return ids;
}

async function replaceServings(client: Client, batch: FoodRow[], ids: Map<string, string>): Promise<number> {
  const foodIds: string[] = [];
  const labels: string[] = [];
  const grams: number[] = [];
  const order: number[] = [];
  for (const r of batch) {
    const id = ids.get(r.sourceRef);
    if (!id) throw new Error(`no id returned for ${r.source}:${r.sourceRef}`);
    r.servings.forEach((s, i) => {
      foodIds.push(id);
      labels.push(s.label);
      grams.push(s.grams);
      order.push(i);
    });
  }
  await client.query(`delete from public.food_servings where owner_user_id is null and food_id = any($1::uuid[])`, [
    [...ids.values()],
  ]);
  if (foodIds.length === 0) return 0;
  await client.query(
    `insert into public.food_servings (food_id, label, grams, sort_order)
     select * from unnest($1::uuid[], $2::text[], $3::numeric[], $4::smallint[])`,
    [foodIds, labels, grams, order],
  );
  return foodIds.length;
}

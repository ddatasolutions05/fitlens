// USDA FoodData Central: Foundation Foods and SR Legacy CSV bundles (public domain).
import { openCsv } from '../csv';
import { ensureDownloaded } from '../download';
import { round2, toNumber, type FoodRow, type Serving } from '../types';
import { ZipArchive } from '../zip';

export const USDA_DATASETS = [
  {
    dataType: 'foundation_food',
    dir: 'usda_foundation_2026-04-30',
    file: 'FoodData_Central_foundation_food_csv_2026-04-30.zip',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip',
  },
  {
    dataType: 'sr_legacy_food',
    dir: 'usda_sr_legacy_2018-04',
    file: 'FoodData_Central_sr_legacy_food_csv_2018-04.zip',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
  },
] as const;

const ATTRIBUTION = 'USDA FoodData Central (public domain)';

// nutrient_id -> field. Energy prefers 1008, then Atwater specific (2048), then general (2047).
// Fat prefers 1004 and falls back to 1085 (NLEA total fat), which some Foundation foods carry alone.
const NUTRIENTS: Record<string, keyof Nutrients> = {
  '1008': 'kcal',
  '2048': 'kcalAtwaterSpecific',
  '2047': 'kcalAtwaterGeneral',
  '1003': 'proteinG',
  '1005': 'carbsG',
  '1004': 'fatG',
  '1085': 'fatNlea',
  '1079': 'fibreG',
  '1093': 'sodiumMg',
  '1258': 'satFatG',
};

interface Nutrients {
  kcal?: number;
  kcalAtwaterSpecific?: number;
  kcalAtwaterGeneral?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fatNlea?: number;
  fibreG?: number;
  sodiumMg?: number;
  satFatG?: number;
}

interface Portion {
  seq: number;
  id: number;
  serving: Serving;
}

export async function loadUsda(): Promise<FoodRow[]> {
  const all: FoodRow[] = [];
  for (const ds of USDA_DATASETS) {
    const path = await ensureDownloaded(ds.url, ds.dir, ds.file);
    const rows = await parseBundle(new ZipArchive(path), ds.dataType);
    console.log(`usda ${ds.dataType}: ${rows.length} foods`);
    all.push(...rows);
  }
  return all;
}

async function parseBundle(zip: ZipArchive, dataType: string): Promise<FoodRow[]> {
  const names = new Map<string, string>();
  {
    const csv = await openCsv(zip.open('food.csv'));
    const [id, type, desc] = [csv.col('fdc_id'), csv.col('data_type'), csv.col('description')];
    for await (const r of csv.rows) {
      if (r[type] === dataType && r[id]) names.set(r[id], (r[desc] ?? '').trim());
    }
  }

  const nutrients = new Map<string, Nutrients>();
  {
    const csv = await openCsv(zip.open('food_nutrient.csv'));
    const [fdc, nid, amount] = [csv.col('fdc_id'), csv.col('nutrient_id'), csv.col('amount')];
    for await (const r of csv.rows) {
      const field = NUTRIENTS[r[nid] ?? ''];
      const id = r[fdc] ?? '';
      if (!field || !names.has(id)) continue;
      const v = toNumber(r[amount]);
      if (v === null) continue;
      let n = nutrients.get(id);
      if (!n) nutrients.set(id, (n = {}));
      n[field] = v;
    }
  }

  // nutrient.csv only confirms the ids we rely on still mean what we expect.
  {
    const csv = await openCsv(zip.open('nutrient.csv'));
    const [id, unit] = [csv.col('id'), csv.col('unit_name')];
    const units = new Map<string, string>();
    for await (const r of csv.rows) units.set(r[id] ?? '', (r[unit] ?? '').toUpperCase());
    for (const [nid, field] of Object.entries(NUTRIENTS)) {
      const expected = field === 'sodiumMg' ? 'MG' : field.startsWith('kcal') ? 'KCAL' : 'G';
      const got = units.get(nid);
      if (got !== undefined && got !== expected) throw new Error(`usda nutrient ${nid} unit ${got}, expected ${expected}`);
    }
  }

  const units = new Map<string, string>();
  {
    const csv = await openCsv(zip.open('measure_unit.csv'));
    const [id, name] = [csv.col('id'), csv.col('name')];
    for await (const r of csv.rows) units.set(r[id] ?? '', (r[name] ?? '').trim());
  }

  const portions = new Map<string, Portion[]>();
  {
    const csv = await openCsv(zip.open('food_portion.csv'));
    const c = {
      id: csv.col('id'),
      fdc: csv.col('fdc_id'),
      seq: csv.col('seq_num'),
      amount: csv.col('amount'),
      unit: csv.col('measure_unit_id'),
      desc: csv.col('portion_description'),
      modifier: csv.col('modifier'),
      grams: csv.col('gram_weight'),
    };
    for await (const r of csv.rows) {
      const fdc = r[c.fdc] ?? '';
      if (!names.has(fdc)) continue;
      const grams = toNumber(r[c.grams]);
      if (grams === null || round2(grams) <= 0) continue;
      const label = portionLabel(r[c.amount], units.get(r[c.unit] ?? ''), r[c.desc], r[c.modifier]);
      let list = portions.get(fdc);
      if (!list) portions.set(fdc, (list = []));
      list.push({
        seq: toNumber(r[c.seq]) ?? Number.MAX_SAFE_INTEGER,
        id: toNumber(r[c.id]) ?? 0,
        serving: { label, grams: round2(grams) },
      });
    }
  }

  const rows: FoodRow[] = [];
  for (const [fdc, name] of names) {
    if (!name) continue;
    const n = nutrients.get(fdc) ?? {};
    const servings = (portions.get(fdc) ?? []).sort((a, b) => a.seq - b.seq || a.id - b.id).map((p) => p.serving);
    rows.push({
      source: 'usda',
      sourceRef: fdc,
      name,
      verified: true,
      kcal: n.kcal ?? n.kcalAtwaterSpecific ?? n.kcalAtwaterGeneral ?? null,
      proteinG: n.proteinG ?? null,
      carbsG: n.carbsG ?? null,
      fatG: n.fatG ?? n.fatNlea ?? null,
      fibreG: n.fibreG ?? null,
      sodiumMg: n.sodiumMg ?? null,
      satFatG: n.satFatG ?? null,
      defaultServingG: servings[0]?.grams ?? null,
      variantOfRef: null,
      variantLabel: null,
      attribution: ATTRIBUTION,
      servings,
    });
  }
  return rows;
}

function portionLabel(
  amount: string | undefined,
  unit: string | undefined,
  desc: string | undefined,
  modifier: string | undefined,
): string {
  const parts: string[] = [];
  const a = toNumber(amount);
  const d = (desc ?? '').trim();
  // Foundation rows sometimes carry the whole label in portion_description.
  if (d && !/^quantity not specified$/i.test(d)) {
    if (a !== null && !/^\d/.test(d)) parts.push(formatAmount(a));
    parts.push(d);
  } else {
    if (a !== null) parts.push(formatAmount(a));
    if (unit && unit !== 'undetermined') parts.push(unit);
  }
  const m = (modifier ?? '').trim();
  if (m && !/^\d+$/.test(m)) parts.push(m);
  const label = parts.join(' ').replace(/\s+/g, ' ').trim();
  return label || 'serving';
}

function formatAmount(n: number): string {
  return String(round2(n));
}

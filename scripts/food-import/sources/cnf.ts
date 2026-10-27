// Canadian Nutrient File 2015, full CSV bundle (Open Government Licence, Canada). Files are windows-1252.
import { openCsv } from '../csv';
import { ensureDownloaded } from '../download';
import { round2, toNumber, type FoodRow, type Serving } from '../types';
import { ZipArchive } from '../zip';

export const CNF_URL =
  'https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/zip/nutrition/fiche-nutri-data/cnf-fcen-csv.zip';
const DIR = 'cnf_2015';
const FILE = 'cnf-fcen-csv.zip';
const ENCODING = 'windows-1252';

// Required verbatim by the licence, dash included.
const ATTRIBUTION = 'Contains information licensed under the Open Government Licence \u2013 Canada';

type Field = 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG' | 'sodiumMg' | 'satFatG';
const NUTRIENTS: Record<string, Field> = {
  '208': 'kcal',
  '203': 'proteinG',
  '205': 'carbsG',
  '204': 'fatG',
  '291': 'fibreG',
  '307': 'sodiumMg',
  '606': 'satFatG',
};

export async function loadCnf(): Promise<FoodRow[]> {
  const zip = new ZipArchive(await ensureDownloaded(CNF_URL, DIR, FILE));

  const names = new Map<string, string>();
  {
    const csv = await openCsv(zip.open('FOOD NAME.csv'), ENCODING);
    const [id, desc] = [csv.col('FoodID'), csv.col('FoodDescription')];
    for await (const r of csv.rows) {
      const name = (r[desc] ?? '').trim();
      if (r[id] && name) names.set(r[id].trim(), name);
    }
  }

  // NutrientID and NutrientCode are equal in CNF 2015; the code is what the brief and docs cite.
  const nutrientById = new Map<string, Field>();
  {
    const csv = await openCsv(zip.open('NUTRIENT NAME.csv'), ENCODING);
    const [id, code] = [csv.col('NutrientID'), csv.col('NutrientCode')];
    for await (const r of csv.rows) {
      const field = NUTRIENTS[(r[code] ?? '').trim()];
      if (field) nutrientById.set((r[id] ?? '').trim(), field);
    }
    if (nutrientById.size !== Object.keys(NUTRIENTS).length) throw new Error('cnf: nutrient codes missing from NUTRIENT NAME');
  }

  const values = new Map<string, Partial<Record<Field, number>>>();
  {
    const csv = await openCsv(zip.open('NUTRIENT AMOUNT.csv'), ENCODING);
    const [food, nid, val] = [csv.col('FoodID'), csv.col('NutrientID'), csv.col('NutrientValue')];
    for await (const r of csv.rows) {
      const field = nutrientById.get((r[nid] ?? '').trim());
      if (!field) continue;
      const id = (r[food] ?? '').trim();
      const v = toNumber(r[val]);
      if (v === null || !names.has(id)) continue;
      let n = values.get(id);
      if (!n) values.set(id, (n = {}));
      n[field] = v;
    }
  }

  const measures = new Map<string, string>();
  {
    const csv = await openCsv(zip.open('MEASURE NAME.csv'), ENCODING);
    const [id, desc] = [csv.col('MeasureID'), csv.col('MeasureDescription')];
    for await (const r of csv.rows) measures.set((r[id] ?? '').trim(), (r[desc] ?? '').trim());
  }

  const servings = new Map<string, Serving[]>();
  {
    const csv = await openCsv(zip.open('CONVERSION FACTOR.csv'), ENCODING);
    const [food, mid, factor] = [csv.col('FoodID'), csv.col('MeasureID'), csv.col('ConversionFactorValue')];
    for await (const r of csv.rows) {
      const id = (r[food] ?? '').trim();
      const label = measures.get((r[mid] ?? '').trim());
      const f = toNumber(r[factor]);
      if (!names.has(id) || !label || f === null) continue;
      const grams = round2(f * 100);
      if (grams <= 0) continue;
      let list = servings.get(id);
      if (!list) servings.set(id, (list = []));
      list.push({ label, grams });
    }
  }

  const rows: FoodRow[] = [];
  for (const [id, name] of names) {
    const n = values.get(id) ?? {};
    rows.push({
      source: 'cnf',
      sourceRef: id,
      name,
      verified: true,
      kcal: n.kcal ?? null,
      proteinG: n.proteinG ?? null,
      carbsG: n.carbsG ?? null,
      fatG: n.fatG ?? null,
      fibreG: n.fibreG ?? null,
      sodiumMg: n.sodiumMg ?? null,
      satFatG: n.satFatG ?? null,
      defaultServingG: null,
      variantOfRef: null,
      variantLabel: null,
      attribution: ATTRIBUTION,
      servings: servings.get(id) ?? [],
    });
  }
  console.log(`cnf: ${rows.length} foods`);
  return rows;
}

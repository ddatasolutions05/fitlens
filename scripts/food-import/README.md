# Food import

Loads the shared food database (`foods` rows with `owner_user_id` null, plus their `food_servings`) into `DATABASE_URL`.

## Run

```sh
npx tsx scripts/food-import/run.ts --source usda|cnf|indian|all [--limit N] [--dry-run]
# or
npm run seed -- --source all
```

- `DATABASE_URL` comes from the environment or `.env`. Not needed with `--dry-run`.
- Missing raw files are downloaded into `supabase/seed/data/raw/<dataset>/` (gitignored), one directory per dataset. Delete a directory to force a fresh download.
- Archives are read in memory by `zip.ts` and parsed by `csv.ts`. Nothing from a download is extracted to disk or executed.
- `--limit N` keeps the first N foods per source (plus any base rows their variants need).
- `--dry-run` downloads and parses, prints counts, writes nothing.
- A full `--source all` run takes about 12 seconds on the dev machine.

## Re-run behaviour

Each source is written in one transaction. Foods are upserted on `(source, source_ref)` against the partial unique index `foods_source_ref`, so a re-run updates rows in place and keeps their ids (user logs that reference them stay valid). For every imported food, its shared servings are deleted and inserted again; user-owned servings are never touched. Rows dropped from a later release of a dataset are not deleted.

## Sources

| Source | `source` | `source_ref` | Licence | Attribution stored |
|---|---|---|---|---|
| USDA FoodData Central, Foundation Foods 2026-04-30 and SR Legacy 2018-04 | `usda` | `fdc_id` | Public domain (CC0) | `USDA FoodData Central (public domain)` |
| Canadian Nutrient File 2015 | `cnf` | `FoodID` | Open Government Licence, Canada | the licence's required sentence, verbatim (see `sources/cnf.ts`) |
| Curated Indian dishes, `supabase/seed/indian_dishes.json` | `ifct` | `curated:<slug>` | Authored for this project | `Compiled from IFCT 2017 published values and typical recipes; approximate` |

URLs:

- https://fdc.nal.usda.gov/download-datasets
  - https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip
  - https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
- https://open.canada.ca/data/en/dataset/089885f9-ed53-44e6-854a-14d21a1ec2e0 (CNF 2015)
  - https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/zip/nutrition/fiche-nutri-data/cnf-fcen-csv.zip (full database; the `update-miseajour` zip holds only deltas)
  - A CNF 2026 release exists (dataset `1b6139bd-ed7e-4043-bc28-ff00e10f3109`) with different file names. Not imported yet.

### USDA mapping

- Foods: `food.csv` rows with `data_type` `foundation_food` or `sr_legacy_food`; `name` = `description`.
- Nutrients per 100 g from `food_nutrient.csv`: energy 1008, falling back to 2048 then 2047 (Atwater); protein 1003; carbohydrate by difference 1005; fat 1004, falling back to 1085 (NLEA total fat); fibre 1079; sodium 1093 (mg); saturated fat 1258. Units are checked against `nutrient.csv`.
- Servings from `food_portion.csv` ordered by `seq_num`: label = amount + measure unit (from `measure_unit.csv`, skipped when "undetermined") or `portion_description`, then `modifier`. `default_serving_g` = first portion.
- Some Foundation foods have no energy value in the release (for example dry beans at 0% moisture); those stay null.

### CNF mapping

- Files are windows-1252. `FOOD NAME.csv` gives `FoodDescription` (English).
- Nutrient codes: 208 kcal, 203 protein, 205 carbohydrate, 204 fat, 291 fibre, 307 sodium (mg), 606 saturated fat.
- Servings from `CONVERSION FACTOR.csv` joined to `MEASURE NAME.csv`: label = measure description, grams = factor x 100. `default_serving_g` is left null because the file has no preferred measure.

### Indian seed

86 rows: 67 base dishes and staples, 19 variants linked by `variant_of` / `variant_label` (tadka vs plain dal, dry vs gravy sabzi, roti with ghee, jeera rice, masala dosa, aloo paratha, butter naan, fried papad and others). Values are per 100 g, approximated from IFCT 2017 (NIN Hyderabad) and typical home recipes; `carbs_g` is total carbohydrate including fibre. Variants that add fat are computed by mass from the base dish, and their servings scale with the added mass. Each row has household servings (katori small/medium/large, roti, piece, cup, glass). The importer validates the file structurally before writing. See D-004 in `docs/DECISIONS.md` for why this is curated rather than imported from INDB.

## Counts after a full run (2026-10-27)

| source | foods | servings |
|---|---|---|
| usda | 8262 (469 Foundation, 7793 SR Legacy) | 14636 |
| cnf | 5690 | 19359 |
| ifct | 86 | 247 |

## Tests

`indian.test.ts` checks the seed: row count, every `variant_of` resolves to a base, every serving has grams > 0, and kcal is within 20% of 4/4/9 from macros.

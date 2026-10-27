# FitLens build plan

Status legend: `todo` / `in progress` / `done` / `blocked`

## 1. Architecture

```
+---------------------------+        +-----------------------------------+
| Expo app (apps/mobile)    |  HTTPS | Supabase project                  |
|  Expo Router, RN Web      | -----> |  Postgres + RLS (supabase/migr.)  |
|  TanStack Query           |        |  Auth (magic link, password)      |
|  AsyncStorage offline q   |        |  Storage: meal-photos (private)   |
|  @fitlens/core (maths)    |        |  Edge Functions (Deno):           |
|  @fitlens/schemas (zod)   |        |    analyze-meal  -> VisionProvider|
+---------------------------+        |    lookup-barcode-> OFF           |
                                     |    read-label    -> VisionProvider|
                                     |    coach, export-data,            |
                                     |    delete-account                 |
                                     +-----------------------------------+
```

- All nutrition maths, target logic, unit conversion, trend smoothing and
  day status live in `packages/core` as pure functions with unit tests. The
  app and the Edge Functions both call into them; neither re-implements them.
- All cross-boundary payloads (AI output, function request/response bodies)
  are Zod schemas in `packages/schemas`. Edge Functions import the same files
  through a Deno import map.
- API keys exist only as Edge Function secrets. The client only ever holds
  the anon key and a user session.
- Writes are idempotent. Every meal carries a client-generated
  `idempotency_key` with a unique constraint; activity imports are unique on
  `(user_id, source, external_id)`. The offline queue replays with
  exponential backoff and relies on those constraints to be safe.
- Dates: every log row stores `timestamptz`, the `local_date` the user saw,
  and the `tz` in force when it was created. Queries group by `local_date`.
  Nothing is ever recomputed from the timestamp.

## 2. Repo layout

```
apps/mobile/              Expo app
  src/app/                routes (Expo Router)
  src/ui/                 design tokens and primitives
  src/features/<domain>/  hooks, components, mutations per domain
  src/lib/                supabase client, query client, offline queue, dates
packages/core/            pure TypeScript domain logic + vitest
packages/schemas/         zod schemas shared by app and functions
supabase/migrations/      append-only SQL
supabase/functions/       Deno edge functions (+ _shared)
supabase/seed/            curated seed data (Indian dishes, household units)
supabase/test/            SQL/RLS/idempotency/timezone tests (vitest + pg)
scripts/db/               migrate runner for a plain DATABASE_URL
scripts/food-import/      USDA FDC, CNF, INDB importers
e2e/                      Playwright specs against Expo web
evals/meal-photos/        optional prompt evaluation harness
docs/                     PLAN, DECISIONS, PRIVACY, COSTS
```

## 3. Data model

All user tables: `user_id uuid not null references auth.users on delete cascade`,
RLS enabled, four policies (`select/insert/update/delete`) on `auth.uid() = user_id`.

| Table | Notes beyond the spec |
|---|---|
| profiles | PK = user_id. `onboarding_completed_at` gates the app. `tracking_only_reasons text[]`. |
| preferences | PK = user_id. `ai_photo_consent_at` null = no consent; `ai_consent_version` matches `docs/PRIVACY.md`. |
| goal_versions | One row per change. Daily views pick the row with the greatest `effective_from <= local_date`. `inputs jsonb` keeps the numbers the calculation used so the explanation screen can show them. |
| foods | Shared rows have `owner_user_id null` and are readable by all authenticated users; only service role writes them. User rows are RLS scoped. `search_tsv` generated column + `pg_trgm` index on `name`. `verified bool` (usda/cnf/indb/ifct = true, off/user/ai_estimate = false). |
| food_servings | Household units, `grams`. Shared or user owned, same rule as foods. |
| meals | `idempotency_key unique`, `status draft/confirmed`. Draft rows are excluded from every total by the `daily_totals` view. |
| meal_items | Nutrient snapshot (`kcal, protein_g, carbs_g, fat_g, fibre_g, sodium_mg, sat_fat_g`, all nullable), `fraction_eaten`, `provenance`, `assumptions jsonb`, `kcal_low/high`, `sort_order`. |
| meal_photos | `storage_path` under `meal-photos/<user_id>/<meal_id>/<uuid>.jpg`. |
| photo_analyses | One row per attempt. `validated_response jsonb` only after Zod validation. |
| saved_meals / saved_meal_items | Snapshot copies, `use_count`, `last_used_at`. |
| recipes / recipe_ingredients | Raw grams per ingredient, `cooked_yield_g`, `servings`. Phase 2 UI, schema in Phase 1. |
| weight_logs | `kg numeric(6,2)`, `source manual/healthkit/health_connect`. |
| activity_records | `unique (user_id, source, external_id)` with `external_id` defaulting to a uuid for manual rows. |
| water_logs | One row per add, summed per day. |
| day_status | PK `(user_id, local_date)`. |
| target_suggestions | Phase 3, schema in Phase 1. |
| integration_connections | Phase 2, schema in Phase 1. |
| ai_usage | PK `(user_id, local_date)`, `analyses int`, `coach_calls int`. Incremented by functions via a `security definer` RPC. |
| user_food_usage | `(user_id, food_id)` with `use_count`, `last_used_at`, `favourite bool`. Powers recents, favourites and search ranking. |
| user_food_defaults | Learned corrections ("your usual roti is 40 g"): `(user_id, food_id)` -> `grams`. |

Views and functions:
- `daily_totals(user_id, local_date)` sums confirmed meal items only, treating null nutrients as excluded and reporting `unknown_count` per nutrient.
- `goal_for_date(uid, date)` returns the effective goal version.
- `search_foods(query, limit)` ranks own recents > verified > community, with trigram similarity.
- `increment_ai_usage(kind)` security definer with a hard cap check.

## 4. Milestones (Phase 1)

| # | Milestone | Status | Notes |
|---|---|---|---|
| 1 | Scaffold, CI scripts, CLAUDE.md, schema, RLS + SQL tests | in progress | Local portable Postgres 17 on :54329 for SQL tests |
| 2 | `packages/core` energy, targets, conversions, recipe, trend, adaptive | todo | |
| 3 | Auth + onboarding, tracking-only, AI consent | todo | Needs Supabase project to run live |
| 4 | Today screen + date navigation | todo | |
| 5 | Food import (USDA, CNF, INDB), search, manual log, recents, favourites | todo | Importers run via DATABASE_URL |
| 6 | Photo flow: capture -> analyze-meal -> clarify -> review -> confirm | todo | Needs ANTHROPIC_API_KEY to test live |
| 7 | Steps, workouts, weight, water | todo | |
| 8 | Progress charts + post-meal feedback | todo | SVG charts, no Skia |
| 9 | Export, photo deletion, account deletion | todo | |
| R | Fresh-context review against section 16, then stop-point report | todo | |

Phase 2 and 3 items are tracked in the spec; schema for them lands in Phase 1 so
no migration rewrite is needed later.

## 5. Open risks

1. **No Docker, no Supabase cloud project yet.** Migrations and SQL tests run
   on a local portable Postgres. Auth, Storage and Edge Functions need a real
   Supabase project. Until the owner creates one (free tier) and fills
   `.env`, the end-to-end flows cannot be exercised here. The app shows its
   setup guide in that state.
2. **No `ANTHROPIC_API_KEY` in this environment.** The photo flow is built
   against the real adapter but cannot be run live here; the Playwright
   photo spec reports `skipped`.
3. **No native toolchain** (no Xcode, no Android SDK). Web and Expo Go only.
   HealthKit / Health Connect are labelled "Requires native build".
4. **Food data licensing** is confirmed per source in `docs/DECISIONS.md`
   before import; INDB terms need checking before shipping.
5. **OneDrive hosts the repo**; file locks can disturb `npm install`. Keep
   `node_modules` out of OneDrive sync if it becomes a problem.

# FitLens build plan

Status legend: `todo` / `in progress` / `built` (code complete, verified by tests
and typecheck) / `verified live` (exercised end to end in the running app) /
`blocked`

## 1. Architecture

```
+---------------------------+        +-----------------------------------+
| Expo app (apps/mobile)    |  HTTPS | Supabase project                  |
|  Expo Router, RN Web      | -----> |  Postgres + RLS (supabase/migr.)  |
|  TanStack Query           |        |  Auth (magic link, password)      |
|  AsyncStorage offline q   |        |  Storage: meal-photos (private)   |
|  @fitlens/core (maths)    |        |  Edge Functions (Deno):           |
|  @fitlens/schemas (zod)   |        |    analyze-meal  -> VisionProvider|
+---------------------------+        |    read-label    -> VisionProvider|
                                     |    lookup-barcode-> OFF           |
                                     |    features, export-data,         |
                                     |    delete-account                 |
                                     +-----------------------------------+
```

- All nutrition maths, target logic, unit conversion, trend smoothing, day
  status and feedback rules live in `packages/core` as pure functions with
  unit tests. The app and the Edge Functions both import them.
- All cross-boundary payloads (AI output, function request/response bodies)
  are Zod schemas in `packages/schemas`. Edge Functions import the same files
  through `supabase/functions/import_map.json`.
- API keys exist only as Edge Function secrets. The client holds the anon key
  and a user session.
- Writes are idempotent. Meals carry a client-generated `idempotency_key`
  (unique per user); logs carry client ids and upsert; imported activity is
  unique on `(user_id, source, external_id)`. The offline queue replays with
  exponential backoff and relies on those constraints.
- Dates: every log row stores `timestamptz`, the `local_date` the user saw, and
  the `tz` in force when it was created. Queries group by `local_date`.

## 2. Repo layout

```
apps/mobile/              Expo app
  src/app/                routes (Expo Router)
  src/ui/                 design tokens and primitives
  src/features/<domain>/  hooks, components, mutations per domain
  src/lib/                supabase client, query client, offline queue, config
packages/core/            pure TypeScript domain logic + vitest
packages/schemas/         zod schemas shared by app and functions
supabase/migrations/      append-only SQL
supabase/functions/       Deno edge functions (+ _shared, import_map.json)
supabase/seed/            curated Indian dishes seed
supabase/test/            SQL tests (RLS, idempotency, timezone, targets, search)
scripts/db/               migrate runner for a plain DATABASE_URL
scripts/food-import/      USDA FDC, CNF and curated Indian importers
e2e/                      Playwright specs against Expo web
docs/                     PLAN, DECISIONS, PRIVACY, COSTS
```

## 3. Data model

All user tables: `user_id` + RLS with four `auth.uid() = user_id` policies.
See the migrations for columns; notable additions beyond the brief:

| Table | Notes |
|---|---|
| profiles | `onboarding_completed_at` gates the app; `tracking_only_reasons text[]`; `goal_weight_kg`, `typical_steps`, training fields. |
| goal_versions | `inputs jsonb` keeps the numbers the calculation used (weight, REE, TDEE, multiplier) for the explanation screen. |
| foods | `verified` flag, `variant_of` + `variant_label` for dish variants, `attribution`, trigram and tsvector indexes. Shared rows (`owner_user_id null`) are written only by the importer. |
| user_food_usage | Recents, favourites and the learned `usual_grams` per food. |
| meal_items | Per-100 g snapshot plus computed per-item values, `kcal_low/high`, `provenance`, `confidence`, `assumptions`. |
| ai_usage | Per-user per-day counters and cost, incremented by `fitlens.increment_ai_usage` (service role only). |

Views and functions: `daily_totals` (confirmed only, null-aware with unknown
counts), `daily_water`, `daily_activity` (one step source per day),
`goal_for_date`, `search_foods`, `touch_food_usage`.

## 4. Milestones (Phase 1)

| # | Milestone | Status | Evidence |
|---|---|---|---|
| 1 | Scaffold, CI scripts, CLAUDE.md, schema, RLS + SQL tests | built | 8 migrations apply to local Postgres 17; 122 SQL tests pass |
| 2 | `packages/core` energy, targets, conversions, recipe, trend, adaptive, feedback | built | 113 unit tests pass |
| 3 | Auth + onboarding, tracking-only, AI consent | built, needs a Supabase project to verify live | typecheck/lint clean; e2e spec written, skipped without project |
| 4 | Today screen + date navigation | built, needs project | same |
| 5 | Food import (USDA, CNF, Indian), search, manual log, recents, favourites | built; import verified on local DB | 8262 USDA + 5690 CNF + 86 IFCT rows, 34k servings; 5 importer tests |
| 6 | Photo flow: capture -> analyze-meal -> clarify -> review -> confirm | built, needs project + `ANTHROPIC_API_KEY` | 6 edge functions typecheck under Deno; 7 schema tests; e2e spec skipped without key |
| 7 | Steps, workouts, weight, water | built, needs project | typecheck/lint clean |
| 8 | Progress charts + post-meal feedback | built, needs project | feedback rules unit tested incl. tone |
| 9 | Export, photo deletion, account deletion | built, needs project | functions typecheck; screens wired |
| R | Fresh-context review against section 16 | done | Found 4 P0 and 6 P1 issues; all fixed in commit "fix: review findings" (see below) |

Review findings and fixes (2026-10-27): the usage RPC lived only in the
`fitlens` schema so analyses would always fail (public wrappers added in
migration 0009); deep links rendered before the session was known and crashed
under static rendering (all signed-in routes moved under `app/(app)` with a
loading gate); the schemas package used extension-less imports Deno cannot
run (`.ts` extensions added, verified with `deno eval`); a second photo or
"Add another item" started a new meal (draft lifecycle reworked with explicit
`fresh` and `replace` params); the day kcal range ignored items without a
range (view rewritten, SQL test added); tracking-only could still display a
stale deficit target; mode B never received workouts; macros showed decimals;
feedback double counted edited meals; three e2e selectors were wrong; pace
lost precision in `numeric(4,3)`; onboarding marked itself complete before
its writes finished; log modals swallowed errors; saved meals were promised
but not surfaced (now listed under Add food).

Verified live (2026-10-27, project `apoollhmgfocnkjvfocq`): migrations applied
through the Management API, six functions deployed (the `features` function
answers with the real "Not configured" state for vision), food database
uploaded (8,262 USDA, 5,690 CNF, 86 Indian, 34,242 servings), and the
Playwright suite against the deployed project at 375 px: **6 passed, 3
skipped** (two setup-guide specs only apply without credentials; the photo
spec waits for `ANTHROPIC_API_KEY`). Live runs found and fixed three more
defects: `useAnimatedValue` is not exported by react-native-web, the custom
tab bar relied on a `navigation` prop Expo Router does not pass, and
post-save navigation stacked a second Today screen.

Milestones 3, 4, 5 (search, manual log, recents), 7, 8 (feedback) and the
targets, tracking-only, Today and Progress screens are therefore
`verified live`. Milestone 6 (photo) and 9 (export, delete) remain `built`
until a key is deployed and the screens are exercised.

## 4b. Phase 2 work pulled forward (2026-10-28)

| # | Milestone | Status | Evidence |
|---|---|---|---|
| 10 | Monochrome theme (black default, white option), Lato type, stroke icon set, plate hero, tab bar with a log sheet | built, verified live | typecheck/lint clean; hosted smoke green; screenshots in the PR description |
| 11 | Manual food entry surfaced everywhere: Today tiles, the centre tab sheet, Add food header | built, verified live | `e2e/manual-log.spec.ts` passes through the new tiles |
| 12 | Stats: KPI grid (days logged, streak, avg calories vs target, days on target, avg protein and fibre, weight change and weekly rate, avg steps, workouts, avg water) on top of the charts, plus a water chart | built, verified live | `packages/core/src/stats.test.ts` (7 tests); `e2e/coach.spec.ts` asserts the grid |
| 13 | Coach: `coach` edge function grounded on a 14 day summary, JSON reply with confirmable actions, device-only conversation | built; live answer needs the Anthropic workspace id | Deno check 7/7; `e2e/coach.spec.ts` passes in the not-configured and consent states |

## 5. Open risks

1. **No Supabase project yet.** Auth, Storage and Edge Functions need one.
   Until `.env` has the project keys and `supabase db push` + `functions
   deploy` have run, the app shows its setup guide and the seven
   Supabase-dependent Playwright specs skip. Everything downstream of sign-in
   is built but not yet exercised in a browser.
2. **No `ANTHROPIC_API_KEY` here.** The photo flow is built against the real
   adapter and cannot be run live. The Playwright photo spec stays skipped.
3. **No native toolchain.** Web and Expo Go only. HealthKit / Health Connect
   are labelled "Requires native build".
4. **Edge Functions are typechecked, not executed.** `supabase functions
   serve` needs Docker. First live run will be against the deployed project.
5. **Food data licensing.** USDA and CNF are clear. The Indian seed is curated
   from IFCT 2017 published values; INDB redistribution terms are unconfirmed
   so no INDB bulk import ships.
6. **OneDrive hosts the repo**; file locks can disturb `npm install`.

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
| 6 | Photo flow: capture -> analyze-meal -> clarify -> review -> confirm | built, verified live (2026-10-28) | `e2e/photo.spec.ts` passes against the deployed function and the real model: draft from a photo, packaged items flagged, confirm and delete update totals |
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
`verified live`. Milestone 6 (photo) became `verified live` on 2026-10-28
once a working Anthropic key was set. Milestone 9 (export, delete) remains
`built` until those screens are exercised.

## 4b. Phase 2 work pulled forward (2026-10-28)

| # | Milestone | Status | Evidence |
|---|---|---|---|
| 10 | Monochrome theme (black default, white option), Lato type, stroke icon set, plate hero, tab bar with a log sheet | built, verified live | typecheck/lint clean; hosted smoke green; screenshots in the PR description |
| 11 | Manual food entry surfaced everywhere: Today tiles, the centre tab sheet, Add food header | built, verified live | `e2e/manual-log.spec.ts` passes through the new tiles |
| 12 | Stats: KPI grid (days logged, streak, avg calories vs target, days on target, avg protein and fibre, weight change and weekly rate, avg steps, workouts, avg water) on top of the charts, plus a water chart | built, verified live | `packages/core/src/stats.test.ts` (7 tests); `e2e/coach.spec.ts` asserts the grid |
| 13 | Coach: `coach` edge function grounded on a 14 day summary, JSON reply with confirmable actions, device-only conversation | built, verified live (2026-10-28) | Deno check 7/7; `e2e/coach.spec.ts`; a live call returned a grounded answer with three actions once a workspace-capable key was set |
| 14 | Polish pass: shared page header, brand config, onboarding redesign, meal editor and scan restyle, log screens, range summary on Stats, empty states, light theme and reduced-motion checks | built, verified live | screenshots of 30 screens in both themes reviewed; `summary.test.ts` (5 tests); Playwright suite green |
| 15 | Web photo resize under the browser canvas cap; first-party error telemetry (`client_events`, `reportError`, global handlers, `AppErrorBoundary`), `scripts/telemetry.mjs` | built, verified live | `photo-resize.spec.ts` (6000 px image comes out at 1,600 px JPEG); RLS test for `client_events`; hosted smoke green |
| 16 | Meal time from the photo: EXIF capture time on gallery picks, capture moment for the camera, editor note, `exif.ts` parser | built, verified live | `exif.test.ts` (7 tests); `photo-resize.spec.ts` capture-time case |
| 17 | Packaged products: `lookup-product` function (Open Food Facts by name) plus the model's typical values, shown as suggestions the person approves before anything is logged | built, verified live | live calls return branded matches; `e2e/packaged.spec.ts`; `photo.spec.ts` against the real model |
| 18 | Calendar date fields: `ui/DateField` (browser date input on web, OS picker on native via `@react-native-community/datetimepicker`) for date of birth and the meal date | built, verified live | onboarding, photo-resize and photo specs drive the field by value; screenshots reviewed |
| 19 | Home tab: avatar upload, greeting, line of the day, today snapshot, day's workout, section cards; tab bar Home, Today, Train, Stats, Coach | built, verified live | `quotes.test.ts`; `e2e/home.spec.ts` |
| 20 | Workouts: 16-session library, rules-based weekly plan from days, minutes, level, focus and equipment, suggestions for today, one-tap logging as activity | built, verified live | `workouts/plan.test.ts` (8 tests); `e2e/train.spec.ts` |
| 21 | Phone sign-in and sign-up with SMS codes, shown only when the project has an SMS provider | built; needs Twilio credentials to switch on | `auth.spec.ts` checks the option against `/auth/v1/settings` |
| 22 | Four-step onboarding (about, body, goal and activity, numbers with AI choice); diet and training details live in Profile | built, verified live | `onboarding.spec.ts`; walkers updated |
| 23 | Funnel events (`track`) and `scripts/funnel.mjs`: sign-ups, finished setup, first meal, active people, feature use | built, verified live | events land in `client_events` with kind `event` |
| 24 | Home tiles tap through to logging with a hint when empty; "Log it again" on search from the last fourteen days of confirmed meals | built, verified live | `home.spec.ts`; `manual-log.spec.ts` |
| 25 | Barcode screen: browser reader where available, typed number elsewhere, `lookup-barcode` function, add a serving | built, verified live | `e2e/barcode.spec.ts` |
| 26 | Native build config (`eas.json` preview APK and production profiles) | built; first build needs an Expo account login | not run |
| 27 | Trainer access: codes, links, weekly member summaries through security definer functions; Profile Coaching card, `/trainer` and `/profile/trainer` screens | built, verified live | `rls.test.ts` trainer case; `e2e/trainer.spec.ts` |
| 28 | Lighter Home and wider section spacing everywhere | built, verified live | screenshots reviewed |
| 29 | Feel and finish: toasts after quick logs, animated bars and calorie track, button press scale, pull to refresh on tabs; white theme walk clean | built, verified live | `e2e/toast.spec.ts`; white-theme sweep 0 findings |
| 30 | Start here plate on Home for new accounts; count-up on calorie figures | built, verified live | `home.spec.ts` |
| 31 | First meal in setup, copy yesterday's meals, streak on Home, gram presets, black icon set | built, verified live | `streak.test.ts`; walkers; suite green |
| 32 | Week in review (`/review`): wins, one change, comparison, rules only | built, verified live | `review.test.ts`; `e2e/review.spec.ts` |
| 33 | Target check (`/profile/adaptive`): gate reasons, observed burn, capped suggestion applied only on tap | built; the unlocked path needs 21 days of a real account's data to exercise live | `adaptive.test.ts` (core); locked state in `e2e/review.spec.ts` |
| 34 | Protein picks on Today from the person's own history | built, verified live | rendered in the manual-log flow |
| 35 | Trainer notes: one line from a coach shown on the member's Home | built, verified live | `rls.test.ts` trainer notes case |
| 36 | White-label logo via `EXPO_PUBLIC_BRAND_LOGO_URL` | built | config only |
| 37 | Describe a meal (typed or spoken) through `describe-meal`, mapped like a photo | built, verified live | `e2e/describe-label.spec.ts` |
| 38 | Read a nutrition label from a photo through `read-label`, saved as a label-sourced food | built, verified live | `e2e/describe-label.spec.ts` |
| 39 | Today: water, weight and activity actions live in the body card; one row of food tiles | built, verified live | suite green; screenshot reviewed |
| 40 | Friction pass: auto-confirmed email sign-up, defaults on the goal step, scan-first first meal, time pickers, water in the chosen units, edit weigh-ins and activity, Coach sample answer, How it works page | built, verified live | `e2e/edit-entries.spec.ts`; suite green |

## 5. Open risks

1. **No Supabase project yet.** Auth, Storage and Edge Functions need one.
   Until `.env` has the project keys and `supabase db push` + `functions
   deploy` have run, the app shows its setup guide and the seven
   Supabase-dependent Playwright specs skip. Everything downstream of sign-in
   is built but not yet exercised in a browser.
2. **`ANTHROPIC_API_KEY` arrived on 2026-10-28.** The photo flow and the Coach
   run live; the Playwright photo spec passes with `E2E_VISION_CONFIGURED=1`.
3. **No native toolchain.** Web and Expo Go only. HealthKit / Health Connect
   are labelled "Requires native build".
4. **Edge Functions are typechecked, not executed.** `supabase functions
   serve` needs Docker. First live run will be against the deployed project.
5. **Food data licensing.** USDA and CNF are clear. The Indian seed is curated
   from IFCT 2017 published values; INDB redistribution terms are unconfirmed
   so no INDB bulk import ships.
6. **OneDrive hosts the repo**; file locks can disturb `npm install`.

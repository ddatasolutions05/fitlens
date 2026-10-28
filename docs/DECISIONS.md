# Decisions

Newest first. Each entry: context, decision, consequences.

## D-019 Coach grounded on a server-compiled summary (2026-10-28)
Context: the owner wants the Coach now rather than in Phase 3, and the spec requires every answer to stay within the person's own data with any action confirmed by the user.
Decision: a `coach` edge function compiles a 14 day summary server side through the user client (RLS applies): daily totals, water, activity, day status, the goal in force, 30 days of weigh-ins and the last three days of confirmed meals with items. No photos. The summary, the last eight turns and the question go to the same provider adapter as photo analysis, which returns JSON validated by `coachReplySchema` (answer, up to three actions, grounded_on). Actions are rendered as buttons; nothing is written until the person taps one. Calls count against `ai_usage.coach_calls` with the same daily cap, and the function reuses the existing AI consent (`preferences.ai_photo_consent_at`), presented in the app as "AI consent". `hide_numbers` strips calorie figures from the context before it leaves the database; `tracking_only` sends no calorie target. The conversation lives on the device only (AsyncStorage, last 40 messages).
Consequences: no new tables or migrations. Coach availability equals vision availability (`features.coach`). The e2e spec passes in all three server states (not configured, consent missing, configured) and asserts an answer or a surfaced error, never silence.

## D-018 Monochrome theme in the Mega Gym register (2026-10-28)
Context: the owner intends to sell the app to The Mega Gym (Caledon, Ontario), whose site is pure black, white Lato headlines, white rectangular uppercase buttons with 8 px radius, white cards with monochrome photography and thin rules as eyebrows.
Decision: one palette per scheme in `apps/mobile/src/ui/tokens.ts`, black by default with a white alternative and a system option, chosen in Profile and stored in AsyncStorage (`fitlens.theme`). The only accent is the opposite of the background; macros, water, steps and weight use a four step grey ramp. Lato 400/700/900 ship through `@expo-google-fonts/lato` and load in the root layout before the first screen; a load failure falls back to the system face. Buttons are uppercase label type on a solid plate; secondary buttons are outlined; icons are a single-weight stroke set in `ui/Icon.tsx` (no unicode glyphs or emoji). The one loud element per screen is a white plate card (`Card tone="inverse"`), used for the calorie hero on Today and the first KPI on Stats. Danger stays a muted red because errors must be found.
Consequences: `userInterfaceStyle` is dark, the web shell and manifest are black, the splash and adaptive icon backgrounds are black. Charts are monochrome: the target line is a dashed mid grey, the weight trend is the solid white line over a faint raw line.

## D-017 Sign-in methods and provider detection (2026-10-27)
Context: the owner wants email and password accounts, magic links and Google sign-in.
Decision: the sign-in screen offers Sign in and Create account with email and password, a magic-link alternative, forgot-password recovery (`/reset-password`), and Google and Apple buttons. Which providers appear is read live from the project's public `/auth/v1/settings`; a disabled provider shows "Not configured" with the dashboard steps instead of a button that fails. On native the OAuth flow uses `expo-web-browser` and the PKCE code exchange. Email confirmation stays on. The built-in Supabase mailer is capped at 2 emails an hour, so a custom SMTP sender is the next step before more than one person uses the app.
Consequences: Google needs a Google Cloud OAuth client id and secret entered in Supabase (Authentication, Providers); Apple needs an Apple Developer Services ID. Neither can be created from this repo.

## D-016 Edge Functions use the Anthropic SDK from npm under Deno (2026-10-27)
Decision: `_shared/vision/anthropic.ts` calls `client.beta.messages.create` from `@anthropic-ai/sdk@1.3.0` with `fallbacks: "default"` so a safety refusal is retried on a fallback model inside the same call. Default `VISION_MODEL` is `claude-opus-5-5`; `claude-sonnet-5-5` and `claude-haiku-5-5` are the cheaper switches (see `docs/COSTS.md`). The adapter is the only file that knows the provider.

## D-015 Metadata stripping happens in two places (2026-10-27)
Context: the client uploads straight to private Storage, so a server cannot sit in the upload path without a second function.
Decision: the client re-encodes every photo to a fresh JPEG with `expo-image-manipulator` (no EXIF is carried over). `analyze-meal` and `read-label` additionally strip APP1 to APP15 and COM segments byte-wise and overwrite the stored object when anything was removed, before sending bytes to the provider. Photos uploaded with consent off are never sent anywhere.

## D-014 AI output schema carries an optional nutrient estimate (2026-10-27)
Context: the brief's output shape has no nutrient numbers, but the fallback rule needs AI-estimated nutrients when no source matches.
Decision: `analyzedItemSchema.nutrients_per100_estimate` (nullable). It is used only when `search_foods` finds no match above the similarity threshold, and the resulting row is a user-owned `foods` record with `source = ai_estimate`.

## D-013 Clarifying answers are applied deterministically on the client (2026-10-27)
Decision: counts multiply the per-unit portion the model was told to return; size words scale grams (small 0.75, large 1.3); fraction words set `fraction_eaten`; fat answers add a separate oil, butter or ghee item from `FAT_PER100`; ingredient answers become assumptions. No second model call is made for answers. Logic in `apps/mobile/src/features/photo/analyze.ts`.

## D-012 Email magic link plus password sign-in (2026-10-27)
Context: the spec asks for magic links. Playwright cannot click a mailed link in CI, and the Supabase provider is unchanged either way.
Decision: Supabase Auth with magic link as the primary path and email + password as a second path on the same screen. E2E tests sign in with a seeded password user.
Consequences: no new provider; one extra form on the sign-in screen.

## D-011 Charts are drawn with react-native-svg (2026-10-27)
Context: Victory Native 43 requires `@shopify/react-native-skia` and Reanimated, and on web ships a multi-MB CanvasKit wasm.
Decision: a small chart kit (`apps/mobile/src/features/progress/charts.tsx`) on `react-native-svg`, which works on web through `react-native-svg`'s web backend.
Consequences: fewer chart types, but every chart is under our control for gaps, accessible colours and reduced motion.

## D-010 npm workspaces (2026-10-27)
Context: pnpm and yarn are not installed; Expo documents npm workspaces as supported without a custom Metro config since SDK 52.
Decision: npm workspaces, hoisted. `overrides` pins a single React.
Consequences: `npm install` at the root only; `npm -w <pkg> run <script>` for package scripts.

## D-009 Local Postgres instead of Docker for SQL tests (2026-10-27)
Context: Docker Desktop and WSL are not installed on this machine and need admin plus a reboot. Supabase CLI's `supabase start` needs Docker.
Decision: a portable PostgreSQL 17 (EDB binaries, no installer) at `~/tools/pgsql`, cluster at `~/tools/pgdata-fitlens`, port 54329. `scripts/db/migrate.ts` applies `supabase/migrations/*.sql` to any `DATABASE_URL`, preceded by `supabase/test/shim_auth.sql` which recreates the parts of Supabase's `auth` schema the migrations touch (`auth.users`, `auth.uid()`, roles). On a real project the shim is never applied.
Consequences: RLS and integrity tests run here and in CI (CI can use `supabase start`). Auth, Storage and Edge Functions still need a real project.

## D-008 Expo web first, native marked as "Requires native build" (2026-10-27)
Context: the only blocking question in the spec. No Xcode or Android SDK here.
Decision: build Expo with web support; HealthKit and Health Connect screens show "Requires native build". Nothing else is gated.

## D-007 Time handling (2026-10-27)
Decision: the client computes `local_date` and `tz` (IANA) at entry time with `Intl.DateTimeFormat`. The database stores all three and never derives `local_date` from `eaten_at`. Editing date or time rewrites all three together.

## D-006 Nutrient snapshot semantics (2026-10-27)
Decision: `meal_items` copy the per-100 g values and the computed per-item values at confirmation. Null stays null end to end and is reported as "unknown" with a count in totals. Totals never coerce null to 0.

## D-005 Food search ranking (2026-10-27)
Decision: `search_foods` SQL function orders by (own recents and favourites) > verified sources > community, then trigram similarity on name, then `websearch_to_tsquery` rank. Own `ai_estimate` foods are included only when the user has used them.

## D-004 Nutrition data sources and licences (2026-10-27)
- USDA FoodData Central: public domain (CC0), Foundation + SR Legacy imported, branded via API when `FDC_API_KEY` is set.
- Canadian Nutrient File 2015: Open Government Licence Canada, attribution required ("Contains information licensed under the Open Government Licence – Canada").
- Open Food Facts: ODbL. Used for barcode lookups at runtime only; results are labelled Community and the attribution plus link appear on the item. Not bulk-imported, so no ODbL share-alike obligation on our database.
- Indian foods: INDB (Indian Nutrient Databank, Anuvaad Solutions) is published for research use; IFCT 2017 is a PDF. Licence for redistribution of either is not confirmed. Decision: ship a curated seed of common Indian dishes authored for this project with household servings and variants, cite IFCT/INDB as references in the row's `source_ref`, and leave the INDB importer behind a flag until terms are confirmed. Status: open, see PLAN risks.

## D-003 Vision provider (2026-10-27)
Decision: `VisionProvider` interface in `supabase/functions/_shared/vision/`, Anthropic implementation using the Messages API with image blocks and a JSON-only instruction. Model from `VISION_MODEL` (default `claude-opus-5-5`, see D-016). Retention terms are documented in `docs/PRIVACY.md` from Anthropic's published commercial terms, not assumed.

## D-002 Offline queue (2026-10-27)
Decision: a small command queue in AsyncStorage (`src/lib/offline-queue.ts`), replayed on reconnect with exponential backoff (1s, 2s, 4s, max 5 tries, then parked with a visible "needs attention" state). Commands are plain JSON with an idempotency key. TanStack Query mutations enqueue when offline and apply optimistic updates.

## D-001 Where the repo lives (2026-10-27)
Decision: `~/OneDrive/Desktop/fitlens`, matching the owner's other projects.

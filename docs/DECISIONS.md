# Decisions

Newest first. Each entry: context, decision, consequences.

## D-012 Email magic link plus password sign-in (2026-10-27)
Context: the spec asks for magic links. Playwright cannot click a mailed link in CI, and the Supabase provider is unchanged either way.
Decision: Supabase Auth with magic link as the primary path and email + password as a second path on the same screen. E2E tests sign in with a seeded password user.
Consequences: no new provider; one extra form on the sign-in screen.

## D-011 Charts are drawn with react-native-svg (2026-10-27)
Context: Victory Native 43 requires `@shopify/react-native-skia` and Reanimated, and on web ships a multi-MB CanvasKit wasm.
Decision: a small chart kit (`src/ui/charts`) on `react-native-svg`, which works on web through `react-native-svg`'s web backend.
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
Decision: `VisionProvider` interface in `supabase/functions/_shared/vision/`, Anthropic implementation using the Messages API with image blocks and a JSON-only instruction. Model from `VISION_MODEL` (default `claude-sonnet-4-5`). Retention terms are documented in `docs/PRIVACY.md` from Anthropic's published commercial terms, not assumed.

## D-002 Offline queue (2026-10-27)
Decision: a small command queue in AsyncStorage (`src/lib/offline-queue.ts`), replayed on reconnect with exponential backoff (1s, 2s, 4s, max 5 tries, then parked with a visible "needs attention" state). Commands are plain JSON with an idempotency key. TanStack Query mutations enqueue when offline and apply optimistic updates.

## D-001 Where the repo lives (2026-10-27)
Decision: `~/OneDrive/Desktop/fitlens`, matching the owner's other projects.

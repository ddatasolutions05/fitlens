# Decisions

Newest first. Each entry: context, decision, consequences.

## D-038 Indian food list and search aliases (2026-10-29)
Decision: the curated seed grows from 86 to 248 dishes (breads, rice dishes, dals, sabzis, eggs and meat, street food, Indo-Chinese, regional staples, drinks, sweets, sides), each with household servings and values set so kcal matches 4/4/9 from the macros. `foods.aliases` holds the other names people type (chawal, anda, sabji, gol gappe, kaapi) and `search_foods` matches it beside the name. Searches that return nothing are written to `search_misses` through `note_search_miss()` (words only, no other data) and listed on the admin page so the list grows where people actually look. `scripts/db/push-foods-remote.ts` upserts the seed through the Management API.

## D-037 Make the first meal pay off (2026-10-29)
Decision: after a confirm the editor shows the day after this meal as two bars (calories, protein against the targets); the first confirmed meal is headed "First meal logged" with one line on what logging the rest of the day unlocks. Items the photo model marked low confidence carry a "Check this" chip. While a photo is being identified the screen shows the seconds elapsed, the usual range, and a "Type it instead" way out that keeps the photo attached.

## D-036 Admin overview for the owner (2026-10-29)
Decision: admins are rows in `app_admins` (no policies; inserted by hand through the SQL editor or Management API, never from the client). `is_admin()` and `admin_overview(p_days)` are security definer functions; the overview returns one JSON document (totals, every account with counts and last activity, errors caught on devices, feature events) and raises `admin only` for anyone else. The screen is `/admin`, reached from a Profile row that only admins see. Edge function logs are not in the database, so they stay with `scripts/telemetry.mjs`.

## D-035 Time is picked in an app sheet (2026-10-29)
Decision: `TimeField` opens an in-app sheet (hour, minute in fives, AM/PM, Now) with a Set time button on every platform. The browser and OS wheels have no confirm button on phones, so a tester changed the time and saw only Clear and Cancel. The native file was removed; one component serves web and native.

## D-034 Interface language: English, Hindi, Punjabi (2026-10-28)
Decision: a small dictionary module (`src/lib/i18n.tsx`) with `useT()`, no i18n library. The choice is stored on the device (`fitlens.lang`, like the theme) and defaults from the browser locale; Profile exposes it next to Theme. Covered: tab bar, Home, Today labels and tiles, the Add sheet, meal editor buttons, sign-in and onboarding. Food names, quotes, the Coach and long explanations stay English. The Hindi and Punjabi strings were written in-house and need a native speaker's read before the gym pitch; keys fall back to English when a string is missing.

## D-033 Friction pass: instant sign-up, pickers, units, editing, help (2026-10-28)
Context: a review of where a new person stalls in the first week.
Decision: email sign-ups are confirmed automatically on the project (auth setting), so nobody waits for a mail that may not arrive; Resend still matters for links and resets. The goal step offers "use sensible defaults" (light activity, maintenance). The first-meal screen after setup leads with "Scan the plate", then describe, then search. Time is picked with the phone's time control (`TimeField`) in the meal editor and the weigh-in form. Water follows the unit choice everywhere: fluid ounces and 8, 16 and 24 oz quick buttons for Imperial, millilitres otherwise. Weigh-ins and activity entries can be edited from Diary; the log screens open in edit mode keyed by the entry so the form mounts with its values rather than patching state in an effect. The Coach consent card shows one sample answer. Profile links to a short "How it works" page. Text props allow a per-element font scale cap for tight rows.
Consequences: `e2e/edit-entries.spec.ts` covers the edit flow and the help page. The auth setting is recorded here because it is not in the repo.

## D-032 Today with one row of actions (2026-10-28)
Context: Today carried two rows of tiles above the fold, and the owner kept asking for a calmer screen.
Decision: the second row (water, weight, activity) moved into the Body and activity card as three small outlined buttons above the bars they affect. The three food tiles stay. Test ids are unchanged.
Consequences: Today shows the calorie plate, the three ways to log food and the insight in the first screen; the body card holds its own actions.

## D-031 Describe a meal in words; read a label from a photo (2026-10-28)
Context: two more ways to log that suit people who will not search or photograph a plate.
Decision: a `describe-meal` function turns a typed or dictated description into the same JSON contract as photo analysis (same consent gate, same daily cap, no image), so the existing database mapping applies and the result lands in the editor like a scan. The screen uses the browser's speech recogniser where one exists and falls back to typing. The `read-label` function, deployed since Phase 1, now has a screen: photograph the nutrition panel, confirm the serving weight and the number of servings, and the product is saved as a label-sourced food with per-100 g values derived from the printed serving.
Consequences: `e2e/describe-label.spec.ts` drives both screens with fixed function replies while the real food database does the matching. Nine functions are deployed.

## D-030 Trainer notes and a swappable logo (2026-10-28)
Context: the gym pitch needs the coach to stay in the loop without a chat product, and a white-label build needs the gym's own logo.
Decision: `trainer_notes` holds one-line notes (up to 300 characters) from a trainer to a member. Only a trainer with an active link can insert, enforced by the row policy, so a revoked link stops notes immediately; the member sees the newest note on Home and clears it with one tap. `EXPO_PUBLIC_BRAND_LOGO_URL` swaps the built-in three-stroke mark for a square image wherever `BrandMark` renders, alongside the existing name and tagline variables.
Consequences: `rls.test.ts` covers write, read, forge, revoke and clear. There is no reply channel on purpose; the Coach handles questions, the trainer handles encouragement.

## D-029 Week in review, target check, protein picks (2026-10-28)
Context: the next two ideas on the list were a reason to come back on day seven and a target that learns from the person's own data.
Decision: `/review` reads the last seven days against the seven before through `weeklyReview` in `packages/core/src/review.ts`: a headline on logged days, wins for every dimension hit on at least 60% of eligible days, the weakest dimension as the one thing to change, and a comparison line. Rules only, tone-tested. `/profile/adaptive` runs the existing adaptive maths over thirty days: the gate explains what is still missing (21 days, 80% complete, 8 weigh-ins), and when unlocked it shows the observed burn and a suggested target capped at 150 kcal; applying it writes a `goal_versions` row with source `adaptive_accepted` and an accepted `target_suggestions` row, never without the tap. Today shows three protein-rich foods from the person's own history when the day is 20 g or more short of the protein target. Home links to the review; Profile and Targets link to the check.
Consequences: `review.test.ts` covers wins, the change, hidden numbers and the empty week. `e2e/review.spec.ts` covers both screens for a fresh account.

## D-028 First meal in setup, same as yesterday, streak, icons (2026-10-28)
Context: the funnel showed people finishing setup and stopping. The app icon on phones was still the Expo template.
Decision: setup now ends on the search screen framed as "Your first meal", with a skip link to Home. When a day has no meals and yesterday had some, Today offers "Copy yesterday's meals" as drafts (same times, fresh ids) and the Home tile says "Same as yesterday?". Home shows "N days in a row" under the greeting from two days up, counting any log and not breaking until a day is over. The add-food sheet has gram presets (50 to 250 g). The icon set (web, iPhone home screen, Android adaptive, splash, favicon) is the three-stroke mark in white on black, generated from the same geometry as `BrandMark`.
Consequences: test helpers and walkers skip the first-meal screen after setup. `streak.test.ts` covers the counting rules. People who already added the app to a home screen need to remove and re-add it to see the new icon.

## D-027 Start here: the first minute after setup (2026-10-28)
Context: ten real sign-ups, six finished setup, one logged a meal. Everyone else stopped on an empty Home.
Decision: for the first two weeks after setup, Home opens with a "Start here" plate: log your first meal, build your workout plan, ask the Coach one thing. Each line is ticked from real data (a confirmed meal, saved plan settings, a coach call in `ai_usage`) and the plate leaves on its own once all three are done. The daily line steps down to a plain card while the plate is up, keeping one plate per screen. Calorie figures on Today and Home count up to their value when a log lands.
Consequences: `home.spec.ts` checks the plate and the first step's destination. The funnel script already reports first meals, so the effect of the plate is measurable.

## D-026 Feel and finish: toasts, pull to refresh, motion (2026-10-28)
Context: the owner asked for more polish after the layout work. The remaining gap was feedback: a quick log returned to Today with nothing acknowledging it, bars snapped to their values, and buttons only dimmed.
Decision: a one-line toast (`toast()` from `ui/toast.tsx`, hosted once in the root layout) confirms water, weight, steps, workouts, plan saves, trainer links and picture updates, then leaves on its own. Progress bars and the calorie track ease to their values through `AnimatedFill`; primary buttons scale down a touch on press. Every tab screen supports pull to refresh, which invalidates the query cache. All motion is skipped when the person has reduced motion on.
Consequences: `e2e/toast.spec.ts` checks a confirmation appears and clears. Animated values are created with lazy state, not refs, to satisfy the React compiler lint.

## D-025 Trainer access by code, and a lighter Home (2026-10-28)
Context: selling to a gym needs a coach's view of their members; the owner also found the first Home layout too crowded.
Decision: a trainer makes a six-character code (`make_trainer_code`), a member enters it (`link_trainer`), and from then on `trainer_members(p_days)` returns one summary row per linked member: days logged, meals, average calories and protein against targets, workouts and minutes, first and last weight, last log date. All three are security definer functions; the only table a trainer can read directly is `trainer_links`, and only the member or the trainer on a link can flip it to revoked. No raw meals, photos or notes ever cross accounts. Either side can be any account; there is no role flag, access is granted per member. Home now shows two headline tiles (eaten, protein), a slim water and steps row, the day's workout and icon-only section tiles, and every screen's section gap grew from 16 to 24 px.
Consequences: `rls.test.ts` covers the two-user flow (own code refused, bad code refused, summary visible only to the linked trainer, revoke by the member, no re-activation by the trainer); `e2e/trainer.spec.ts` covers the screens with one account. Profile has a Coaching card with both entry points.

## D-024 Four-step onboarding, funnel events, repeat a meal, barcodes (2026-10-28)
Context: four of the first seven real sign-ups stopped before finishing the nine onboarding screens, and nobody had logged a meal. The owner asked for everything on the improvement list to be done.
Decision: onboarding is four screens: about you (name, birth date, sex), body (units, height, weight, goal weight), goal and activity (activity level, goal, pace or surplus, pregnancy or breastfeeding chips), and the numbers with the AI consent choice on the same screen. Diet pattern, allergies, cuisines, typical steps and training details moved to Profile where they already had screens. The error table also records a few named usage events (`kind = 'event'`: onboarding started, step, finished, meal confirmed, scan started, coach asked, workout logged, plan built, barcode found and added) through `track()` in `lib/telemetry.ts`; `scripts/funnel.mjs` turns them and the base tables into sign-ups, finished setup, first meal, active people and feature use. Home tiles are buttons with a hint when empty. Search shows "Log it again" (whole confirmed meals from the last fourteen days, deduplicated by their items) above saved meals. A barcode screen uses the browser's built-in reader where it exists and typed numbers elsewhere, looks the code up through the existing `lookup-barcode` function and adds a serving as a community-data item. `apps/mobile/eas.json` holds preview (APK) and production profiles for native builds.
Consequences: the test helpers and screen walkers follow the four-step flow and end on Home. `e2e/barcode.spec.ts` covers the typed path with a fixed lookup response. Reminders, the trainer view, native builds, mail, SMS and the hosting move still need accounts or keys the owner holds.

## D-023 Home, workouts and phone sign-in (2026-10-28)
Context: the owner asked for a home page with the person's picture and a daily line, a workouts section with suggested sessions and a personalised plan, and sign-in with a phone number.
Decision: Home is the landing tab: avatar (private `avatars` bucket, `profiles.avatar_path`, squared and shrunk to 512 px on the device), a greeting by hour, one line a day from a fixed in-app list (`packages/core/src/quotes.ts`, tone-tested, no attribution needed), a four-tile snapshot of today, the day's workout and cards to every section. The tab bar is Home, Today, Train, Stats, Coach; Diary and Profile sit behind Home and the avatar. Workouts are rules, not AI: a library of 16 sessions in `packages/core/src/workouts/library.ts` (each tied to a workout type and intensity so a logged session gets the same MET estimate as a manual log) and `buildWeeklyPlan` in `plan.ts`, which fills the requested days from the focus, level and equipment with a seed to shuffle. Settings live on `preferences`; a completed session is an ordinary `activity_records` workout whose note is `plan:<workout id>`, so Today, Stats and the Coach already count it. Phone sign-in uses Supabase SMS one-time codes behind the project's `external.phone` flag: the screen shows "Use a phone number" only when an SMS provider is configured, which needs a paid Twilio (or similar) account the owner has not set up yet.
Consequences: `e2e/home.spec.ts` and `e2e/train.spec.ts` cover the hub and the plan to session flow; `auth.spec.ts` asserts the phone option matches the project settings. The stale local `.expo/types/router.d.ts` must be deleted or regenerated after adding routes; CI never has one.

## D-022 Meal time from the photo; packaged products are looked up and approved (2026-10-28)
Context: a tester scanned an energy drink and ended up with an empty meal that read "unknown", and asked why. The model files branded goods as packaged items because their nutrition belongs on the label, not in a visual guess, and nothing turned them into a meal item. The owner also asked for the meal time to follow the photo, and for the app to check the internet for the calories and let the person approve them.
Decision: a gallery photo's EXIF capture time (parsed on the device by `packages/core/src/exif.ts`, the bytes never stored) sets the meal's date, time and meal type unless the person already chose them; a camera shot uses the moment of capture; the editor says where the time came from. Packaged items become suggestions on the scan screen: a new `lookup-product` function searches Open Food Facts by name (the search service first, the legacy CGI search as fallback), and the model's typical label values for a product it could read by name ride along as a second choice. Nothing is logged until the person taps Add; the item then carries its provenance (community data or AI estimate) and the pack-check reminder. An empty meal now says "No items yet" instead of "unknown".
Consequences: the analysis prompt version is `analyze-meal/2026-10-28.1` with four new optional fields on packaged items. `e2e/packaged.spec.ts` covers the approval flow with fixed function responses; `photo.spec.ts` keeps exercising the real model and real search. Inputs carry an accessibility label and radio chips expose `aria-checked`.

## D-021 First-party error telemetry and the web photo resizer (2026-10-28)
Context: a tester took a photo on an iPhone and got "The index is not in the allowed range." Nothing reached the server, so there was no trace of it anywhere. iOS Safari caps a canvas at about 16.7 million pixels and the manipulator drew the full camera photo into one before resizing.
Decision: on web the app resizes photos itself, drawing the picture into a canvas no larger than 1,600 px and encoding JPEG at 0.85; native keeps `expo-image-manipulator`. Errors the app catches (photo pick, upload, analysis, meal save, coach, auth, onboarding, render crashes, unhandled rejections) are written to `public.client_events` in the owner's own project: scope, message, trimmed stack, platform, user agent, app version, route. No screen views, no food content, no photos, no third-party SDK. Users can insert and read only their own rows; a signed-out screen may report with no user attached. Rows are purged after 30 days by `scripts/telemetry.mjs --purge`. The same script reads the edge function logs through the Management API so one command shows what users hit.
Consequences: `docs/PRIVACY.md` lists the table. Expected conditions (wrong password, rate limit, consent missing, provider not configured) are not reported. `AppErrorBoundary` replaces a white screen with a Reload button. The provider adapter turns a rejected key or a key without a workspace into `not_configured` (503) with a plain message, so the scan and coach screens say "not configured on the server" instead of showing raw provider JSON. `e2e/webkit.config.ts` runs the suite in WebKit by hand (not in CI).

## D-020 Polish pass: page header, brand config, range summary (2026-10-28)
Context: the owner asked for every look-and-feel improvement from the review list in one pass.
Decision: every pushed screen opens with `PageHeader` (chevron that falls back to the owning tab, display-weight title, optional subtitle); the trailing "Back" ghost buttons are gone. Forms sit directly on the background instead of inside a card, with `Note` for the "why we ask" asides and `Chips` for multi-select. Onboarding keeps its nine steps and test ids but gets a progress rule, one headline per step and a white plate for the calculated target. The meal editor lists items in one card, shows totals on a plate, and animates the saved state (skipped under reduced motion). Stats opens with a rule-based summary from `packages/core/src/summary.ts` (`rangeSummary`), two or three neutral sentences; no AI involved. The brand name and tagline come from `EXPO_PUBLIC_BRAND_NAME` and `EXPO_PUBLIC_BRAND_TAGLINE` (sign-in, onboarding, setup, web title, app name), default FitLens. A per-scheme `inverseLine` token keeps plate dividers visible in both themes.
Consequences: `scripts/screens.mjs` captures every screen, walks onboarding when the e2e user is fresh, and takes a theme argument; both themes were reviewed by eye. Consent copy now names the Coach alongside photo analysis.

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

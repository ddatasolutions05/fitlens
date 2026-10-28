# Privacy

FitLens is a personal app. The owner runs their own Supabase project, so the
only parties that ever see data are: the owner's Supabase project, the
configured AI provider when (and only when) a photo or coach request is sent,
and the open nutrition databases queried for barcodes.

Baseline: PIPEDA's ten fair information principles (accountability, identifying
purposes, consent, limiting collection, limiting use/disclosure/retention,
accuracy, safeguards, openness, individual access, challenging compliance).

## What is collected and why

| Data | Purpose | Where it lives |
|---|---|---|
| Profile (birth date, sex for the equation, height, goal weight, activity, circumstances) | Energy and target calculation | `profiles` (RLS, owner only) |
| Preferences (diet pattern, allergies, cuisines, avoided foods) | Suggestions and allergen flags | `preferences` |
| Meals, items, nutrient snapshots | Daily totals and history | `meals`, `meal_items` |
| Meal photos | Review and AI analysis | Private Storage bucket `meal-photos`, served by signed URLs that expire after 5 minutes |
| Weight, activity, water, day status | Trends and adaptive estimates | `weight_logs`, `activity_records`, `water_logs`, `day_status` |
| AI usage counters and analysis metadata | Rate limiting and cost tracking | `ai_usage`, `photo_analyses` (validated JSON only, never the raw image) |
| Error reports (what failed, the error text, device and app version, the screen) | Fixing bugs users hit | `client_events` (own rows only; purged after 30 days) |

Usage analytics are off and there is no third-party SDK in the client. The only telemetry is the error report above, sent to the owner's own project when something fails; it never carries food, photos or messages.

## Consent for AI photo analysis

- Consent is explicit, separate from onboarding answers, versioned
  (`ai_consent_version`, currently `2026-10-27`) and stored with a timestamp.
- The `analyze-meal` function refuses requests when consent is missing.
- Withdrawal sets the consent timestamp to null, which disables analysis
  immediately. Logging continues to work without it.

What is sent on each analysis: the resized photo (max 1,600 px, EXIF including
GPS stripped and re-encoded server side before storage and before sending), the
diet pattern and allergy list, and nothing else identifying.

## AI provider terms (Anthropic API)

The default provider is the Anthropic API. According to Anthropic's published
commercial terms and usage policy at the time of writing:

- API inputs and outputs are not used to train Anthropic's models unless the
  customer opts in or the content is flagged for trust and safety review.
- Inputs and outputs may be retained for a limited period for abuse monitoring
  (Anthropic states 30 days by default for API traffic, shorter under zero data
  retention agreements that are available on request for eligible accounts).

Sources: https://www.anthropic.com/legal/commercial-terms and
https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-personal-data

FitLens does not claim "never retained" or "never used for training"; the
statements above are what the provider publishes, and the owner should re-check
them when changing provider or plan. `docs/COSTS.md` records the model used.

## Logging rules

Application logs and error reports never contain meal photos, raw AI responses,
weights or other health records. Edge Functions log request ids, status codes,
timings and error codes only.

## Your rights

- **Access and export:** Profile > Export my data produces a zip with JSON and
  CSV files for every table plus the photos.
- **Correction:** every entry is editable in the app.
- **Deletion:** individual photos and entries delete immediately. Account
  deletion (Profile > Delete account) removes all rows via cascading foreign
  keys and all storage objects, then deletes the auth user. The function runs
  synchronously; if storage removal fails part way the app says so and the
  retry completes it.
- **Portability:** the export format is plain JSON and CSV.

## Safeguards

- Row Level Security on every user table, tested in `supabase/test/rls.test.ts`.
- Secrets only in Edge Function environment variables.
- Private storage with short-lived signed URLs.
- Idempotent writes and per-user daily AI rate limits.

# FitLens

Understand what you eat, track how you move, and know what to adjust.

A personal nutrition and fitness tracker: Expo (iOS, Android, web) on a
Supabase backend, with photo-based meal logging through a vision model,
transparent and editable nutrition estimates, and calm, non-judgemental
feedback computed from your own logs.

## Quick start

1. Create a free Supabase project. Copy `.env.example` to `.env` and fill in
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. `npm install`
3. `npx supabase link --project-ref <ref>` then `npx supabase db push`
4. `npx supabase functions deploy` and set the secrets listed in
   `.env.example` (`ANTHROPIC_API_KEY`, `VISION_MODEL`, ...).
5. Import food data: `DATABASE_URL=<direct postgres url> npm run seed -- --source all`
6. `npm run dev` and open http://localhost:8081

Commands, conventions and the local toolchain are in `CLAUDE.md`. The plan
and status are in `docs/PLAN.md`; decisions in `docs/DECISIONS.md`; privacy
in `docs/PRIVACY.md`; costs in `docs/COSTS.md`.

## Tests

- `npm test` unit tests for `packages/core`, `packages/schemas` and the importers
- `npm run test:db` SQL tests (RLS isolation, idempotency, timezone, target history)
- `npm run functions:check` Deno typecheck of the edge functions
- `npm run test:e2e` Playwright against Expo web

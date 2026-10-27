# FitLens

Personal AI-assisted food, activity and weight tracker. Expo (React Native + web),
Supabase, TypeScript strict. Spec lives in the owner's build brief; plan and
status in `docs/PLAN.md`, decisions in `docs/DECISIONS.md`.

## Commands (run from the repo root)

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev server (web) | `npm run dev` then open http://localhost:8081 |
| Dev server (native via Expo Go) | `npm -w apps/mobile run start` |
| Typecheck everything | `npm run typecheck` |
| Lint everything | `npm run lint` |
| Unit tests (core + schemas) | `npm test` |
| SQL tests (RLS, idempotency, timezone, targets) | `npm run test:db` (needs `DATABASE_URL`) |
| E2E (Playwright, Expo web) | `npm run test:e2e` (needs a Supabase project and `E2E_*` vars) |
| Apply migrations to `DATABASE_URL` | `npm run migrate` (`-- --shim` for a plain Postgres, `-- --reset` to drop and recreate) |
| Apply migrations to the linked Supabase project | `npx supabase db push` |
| Deploy edge functions | `npx supabase functions deploy` |
| Typecheck edge functions | `npm run functions:check` (uses `~/tools/deno/deno.exe` or `deno` on PATH) |
| Import food data | `npm run seed -- --source usda|cnf|indian` |

## Local toolchain on this machine

- Node 24, npm 11. No pnpm, no yarn, no Docker, no WSL.
- Portable PostgreSQL 17: `~/tools/pgsql/bin`, data dir `~/tools/pgdata-fitlens`, port 54329, superuser `postgres`, trust auth.
  - start: `~/tools/pgsql/bin/pg_ctl -D ~/tools/pgdata-fitlens -l ~/tools/pgdata-fitlens/server.log start`
  - stop: `~/tools/pgsql/bin/pg_ctl -D ~/tools/pgdata-fitlens stop`
  - `DATABASE_URL=postgres://postgres@localhost:54329/fitlens_test`
- Deno 2.9: `~/tools/deno/deno.exe` (not on PATH).
- Supabase CLI via `npx supabase` (2.122). `supabase start` is unavailable without Docker; use the local Postgres plus `--shim` instead.

## Conventions

- Pure logic goes in `packages/core` with a `*.test.ts` beside it. No I/O, no React, no Supabase there.
- Shared payload shapes go in `packages/schemas` (Zod 4). Functions and app import the same schema.
- Migrations are append-only, named `YYYYMMDDHHMMSS_name.sql`. Never edit an applied file.
- Every user table: `user_id` + RLS with four `auth.uid() = user_id` policies. Add a test in `supabase/test/rls.test.ts` for each new table.
- Nulls mean unknown. Never coerce a missing nutrient to 0 anywhere (SQL, core, UI).
- Dates: store `eaten_at`/`measured_at` (timestamptz), `local_date`, `tz`. Compute `local_date` on the client at entry time with `localDateFor()` in `packages/core`.
- Writes carry an idempotency key where duplicates are possible (meals). Buttons disable while a mutation is in flight.
- Copy: calm, neutral. No "good/bad/junk/cheat", no shaming, no compensatory exercise. Tone rules are tested in `packages/core/src/feedback/tone.test.ts`.
- Secrets only in Edge Function env. The client reads `EXPO_PUBLIC_*` only.
- Commits: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- A milestone is done when typecheck, lint and tests pass, the flow works in the running app, `docs/PLAN.md` is updated and a commit exists.

## Feature flags

Driven by config at runtime (`src/lib/config.ts`): a feature whose credential is missing renders "Not configured" with a one-line reason. Nothing is mocked at runtime.

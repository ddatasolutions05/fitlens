// Wipes the e2e user's rows, the same reset Playwright runs before a suite.
// Usage: npx tsx scripts/e2e-reset.ts
import reset from '../e2e/global-setup';

reset().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

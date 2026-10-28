// Same suite in WebKit, the engine behind every iPhone browser. Not part of CI;
// run it by hand after `npx playwright install webkit`:
//   E2E_NO_SERVER=1 npx playwright test -c e2e/webkit.config.ts
import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'webkit', use: { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } } }],
});

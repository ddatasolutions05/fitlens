// Phone-width screenshots of the main screens for visual review.
// Usage: node scripts/screens.mjs [baseUrl] [outDir]  (needs E2E_USER_* in .env)
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import 'dotenv/config';

const base = (process.argv[2] ?? 'http://localhost:8081/').replace(/\/?$/, '/');
const out = process.argv[3] ?? 'screens';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

async function shot(name) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(`saved ${out}/${name}.png`);
}

await page.goto(`${base}sign-in`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
await page.getByTestId('sign-in-screen').waitFor({ timeout: 240_000 });
await shot('sign-in');

if (process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD) {
  await page.getByTestId('email').fill(process.env.E2E_USER_EMAIL);
  await page.getByTestId('password').fill(process.env.E2E_USER_PASSWORD);
  await page.getByTestId('sign-in').click();
  await page.waitForURL(/today|onboarding/, { timeout: 60_000 });
  if (/onboarding/.test(page.url())) {
    console.log('e2e user needs onboarding; stopping after sign-in');
  } else {
    await page.goto(`${base}today`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.getByTestId('calorie-card').waitFor({ timeout: 60_000 }).catch(() => {});
    await shot('today');
    await page.getByTestId('add-button').click();
    await shot('add-sheet');
    await page.keyboard.press('Escape');
    await page.goto(`${base}progress`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.getByTestId('kpi-grid').waitFor({ timeout: 60_000 }).catch(() => {});
    await shot('stats');
    await page.goto(`${base}coach`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await shot('coach');
    await page.goto(`${base}diary`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await shot('diary');
    await page.goto(`${base}profile`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await shot('profile');
    await page.goto(`${base}food/search`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await shot('search');
  }
}
console.log(`pageErrors=${errors.length ? JSON.stringify(errors) : 'none'}`);
await browser.close();

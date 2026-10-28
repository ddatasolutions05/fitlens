// Phone-width screenshots of the main screens for visual review.
// Usage: node scripts/screens.mjs [baseUrl] [outDir] [black|white]  (needs E2E_USER_* in .env)
// When the e2e user still needs onboarding, the script walks it and captures each step.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import 'dotenv/config';

const base = (process.argv[2] ?? 'http://localhost:8081/').replace(/\/?$/, '/');
const out = process.argv[3] ?? 'screens';
const theme = process.argv[4] ?? 'black';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
await page.addInitScript((t) => {
  try {
    window.localStorage.setItem('fitlens.theme', t);
  } catch {}
}, theme);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

async function shot(name) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(`saved ${out}/${name}.png`);
}

async function go(path, readyTestId) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (readyTestId) await page.getByTestId(readyTestId).waitFor({ timeout: 120_000 }).catch(() => {});
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
    await shot('onboarding-0');
    await page.getByTestId('continue').click();
    await page.getByTestId('birth-date').fill('1990-05-10');
    await page.getByRole('radio', { name: 'Male', exact: true }).click();
    await shot('onboarding-1');
    await page.getByTestId('continue').click();
    await page.getByTestId('height').fill('180');
    await page.getByTestId('weight').fill('80');
    await shot('onboarding-2');
    await page.getByTestId('continue').click();
    await page.getByRole('radio', { name: /^Moderate/ }).click();
    await shot('onboarding-3');
    await page.getByTestId('continue').click();
    await page.getByRole('radio', { name: 'Fat loss' }).click();
    await shot('onboarding-4');
    await page.getByTestId('continue').click();
    await shot('onboarding-5');
    await page.getByTestId('continue').click();
    await page.getByTestId('continue').click();
    await page.getByRole('radio', { name: 'Not now' }).click();
    await shot('onboarding-7');
    await page.getByTestId('continue').click();
    await page.getByTestId('ree-value').waitFor({ timeout: 30_000 });
    await shot('onboarding-8');
    await page.getByTestId('finish').click();
    await page.waitForURL(/today/, { timeout: 60_000 });
  }
  await go('today', 'calorie-card');
  await shot('today');
  await page.getByTestId('add-button').click();
  await shot('add-sheet');
  await page.keyboard.press('Escape');
  await go('progress', 'kpi-grid');
  await shot('stats');
  await go('coach', 'coach-screen');
  await shot('coach');
  await go('diary', 'diary-screen');
  await shot('diary');
  await go('profile', 'profile-screen');
  await shot('profile');
  await go('food/search', 'food-search');
  await shot('search');
  await go('food/manual', 'manual-food');
  await shot('manual');
  await go('scan', 'scan-screen');
  await shot('scan');
  await go('log/weight', 'log-weight');
  await shot('log-weight');
  await go('log/water', 'log-water');
  await shot('log-water');
  await go('log/activity', 'log-activity');
  await shot('log-activity');
  await go('profile/targets', 'targets-screen');
  await shot('targets');
  await go('profile/edit', 'edit-profile');
  await shot('edit-profile');
  await go('profile/privacy', 'privacy-screen');
  await shot('privacy');
  await go('profile/security', 'security-screen');
  await shot('security');
  // A meal through the editor, so the totals plate and saved state get captured.
  await go('food/manual', 'manual-food');
  await page.getByTestId('manual-name').fill('Chicken rice bowl');
  await page.getByTestId('manual-serving').fill('350');
  await page.getByTestId('manual-kcal').fill('520');
  await page.getByTestId('manual-protein').fill('38');
  await page.getByTestId('manual-add').click();
  await page.getByTestId('meal-editor').waitFor({ timeout: 30_000 });
  await shot('meal-editor');
  await page.getByTestId('confirm-meal').click();
  await page.getByTestId('meal-confirmed').waitFor({ timeout: 30_000 });
  await shot('meal-saved');
  await page.getByTestId('done').click();
  await go('today', 'calorie-card');
  await shot('today-with-meal');
}
console.log(`pageErrors=${errors.length ? JSON.stringify(errors) : 'none'}`);
await browser.close();

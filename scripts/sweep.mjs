// Quality sweep: walks every screen as a signed-in person would, performs the
// everyday actions, and reports what a tester would complain about: console
// and page errors, failed requests, sideways scroll, text like "NaN" or
// "undefined", tap targets under 44 px, clipped labels. Screenshots go to
// outDir for review by eye.
// Usage: node scripts/sweep.mjs [baseUrl] [outDir] [chromium|webkit] [black|white]
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, devices, webkit } from '@playwright/test';
import 'dotenv/config';

const base = (process.argv[2] ?? 'https://ddatasolutions05.github.io/fitlens/').replace(/\/?$/, '/');
const out = process.argv[3] ?? 'sweep';
const engine = process.argv[4] ?? 'webkit';
const theme = process.argv[5] ?? 'black';
mkdirSync(out, { recursive: true });

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
if (!email || !password) {
  console.error('E2E_USER_EMAIL and E2E_USER_PASSWORD are required');
  process.exit(1);
}

const EXPECTED_FAILURES = [/auth\/v1\/token/, /lookup-product/];
const SUSPICIOUS = /\bNaN\b|\bundefined\b|\bnull\b|\[object Object\]|Invalid Date|\$\{/;

const browserType = engine === 'chromium' ? chromium : webkit;
const browser = await browserType.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
await context.addInitScript((t) => {
  try {
    window.localStorage.setItem('fitlens.theme', t);
  } catch {}
}, theme);
const page = await context.newPage();

const findings = [];
let current = 'start';
page.on('pageerror', (e) => findings.push({ screen: current, kind: 'pageerror', detail: String(e).slice(0, 300) }));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') findings.push({ screen: current, kind: `console.${m.type()}`, detail: m.text().slice(0, 300) });
});
page.on('response', (r) => {
  if (r.status() >= 400 && !EXPECTED_FAILURES.some((re) => re.test(r.url()))) findings.push({ screen: current, kind: `http ${r.status()}`, detail: r.url().slice(0, 200) });
});

async function inspect(name) {
  current = name;
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${engine}-${name}.png`, fullPage: true });
  const report = await page.evaluate(() => {
    const issues = [];
    const doc = document.scrollingElement ?? document.documentElement;
    if (doc.scrollWidth > window.innerWidth + 1) issues.push({ kind: 'overflow-x', detail: `scrollWidth ${doc.scrollWidth} > ${window.innerWidth}` });
    const text = document.body.innerText;
    const m = text.match(/\bNaN\b|\bundefined\b|\bnull\b|\[object Object\]|Invalid Date|\$\{/);
    if (m) issues.push({ kind: 'suspicious-text', detail: `"${m[0]}" near: ${text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}` });
    const tappable = document.querySelectorAll('[role="button"], [role="radio"], [role="switch"], [role="checkbox"], button, a[href], input');
    for (const el of tappable) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (r.height < 32 || r.width < 32) {
        const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 40);
        issues.push({ kind: 'small-target', detail: `${label}: ${Math.round(r.width)}x${Math.round(r.height)}` });
      }
    }
    for (const el of document.querySelectorAll('div, span')) {
      if (el.children.length > 0) continue;
      const style = getComputedStyle(el);
      if (style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) {
        issues.push({ kind: 'clipped-text', detail: (el.textContent || '').trim().slice(0, 60) });
      }
    }
    const fontUsed = getComputedStyle(document.body).fontFamily;
    return { issues, fontUsed };
  });
  for (const i of report.issues) findings.push({ screen: name, ...i });
  return report;
}

async function go(path, readyTestId) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (readyTestId) await page.getByTestId(readyTestId).waitFor({ timeout: 60_000 }).catch(() => findings.push({ screen: path, kind: 'not-ready', detail: `${readyTestId} never appeared` }));
}

async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    findings.push({ screen: name, kind: 'step-failed', detail: String(err).split('\n')[0].slice(0, 300) });
  }
}

// Sign in
await go('sign-in', 'sign-in-screen');
await inspect('sign-in');
await page.getByTestId('email').fill(email);
await page.getByTestId('password').fill(password);
await page.getByTestId('sign-in').click();
await page.waitForURL(/home|today|onboarding/, { timeout: 60_000 });
if (/onboarding/.test(page.url())) {
  await step('onboarding', async () => {
    await inspect('onboarding-0');
    await page.getByTestId('continue').click();
    await page.getByTestId('birth-date').fill('1990-05-10');
    await page.getByRole('radio', { name: 'Male', exact: true }).click();
    await inspect('onboarding-1');
    await page.getByTestId('continue').click();
    await page.getByTestId('height').fill('180');
    await page.getByTestId('weight').fill('80');
    await inspect('onboarding-2');
    await page.getByTestId('continue').click();
    await page.getByRole('radio', { name: /^Moderate/ }).click();
    await inspect('onboarding-3');
    await page.getByTestId('continue').click();
    await page.getByRole('radio', { name: 'Fat loss' }).click();
    await inspect('onboarding-4');
    await page.getByTestId('continue').click();
    await inspect('onboarding-5');
    await page.getByTestId('continue').click();
    await inspect('onboarding-6');
    await page.getByTestId('continue').click();
    await page.getByRole('radio', { name: 'Not now' }).click();
    await inspect('onboarding-7');
    await page.getByTestId('continue').click();
    await page.getByTestId('ree-value').waitFor({ timeout: 30_000 });
    await inspect('onboarding-8');
    await page.getByTestId('finish').click();
    await page.waitForURL(/today/, { timeout: 60_000 });
  });
}

await go('today', 'calorie-card');
await inspect('today');
await step('add-sheet', async () => {
  await page.getByTestId('add-button').click();
  await inspect('add-sheet');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  if (await page.getByTestId('add-search').isVisible().catch(() => false)) {
    await page.mouse.click(10, 60);
  }
});

// Everyday logging
await step('water', async () => {
  await go('log/water', 'log-water');
  await inspect('log-water');
  await page.getByTestId('water-250').click();
  await page.waitForTimeout(800);
  await inspect('log-water-after');
});
await step('weight', async () => {
  await go('log/weight', 'log-weight');
  await inspect('log-weight');
});
await step('activity', async () => {
  await go('log/activity', 'log-activity');
  await inspect('log-activity');
});
await step('search', async () => {
  await go('food/search', 'food-search');
  await page.getByTestId('food-query').fill('banana');
  await page.waitForTimeout(1500);
  await inspect('search-results');
});
await step('manual', async () => {
  await go('food/manual', 'manual-food');
  await inspect('manual');
  await page.getByTestId('manual-name').fill('Sweep test bowl');
  await page.getByTestId('manual-serving').fill('350');
  await page.getByTestId('manual-kcal').fill('520');
  await page.getByTestId('manual-protein').fill('38');
  await page.getByTestId('manual-add').click();
  await page.getByTestId('meal-editor').waitFor({ timeout: 30_000 });
  await inspect('meal-editor');
  await page.getByTestId('confirm-meal').click();
  await page.getByTestId('meal-confirmed').waitFor({ timeout: 30_000 });
  await inspect('meal-saved');
  await page.getByTestId('done').click();
  await page.getByTestId('calorie-card').waitFor({ timeout: 30_000 });
  await inspect('today-with-meal');
  await page.locator('[data-testid^="meal-"]').first().click();
  await page.getByTestId('meal-editor').waitFor({ timeout: 30_000 });
  await inspect('meal-reopen');
});
await step('train', async () => {
  await go('train', 'train-screen');
  await inspect('train');
  if (await page.getByTestId('build-plan').isVisible().catch(() => false)) {
    await page.getByTestId('build-plan').click();
    await page.getByTestId('plan-screen').waitFor({ timeout: 30_000 });
    await page.getByRole('radio', { name: '4', exact: true }).click();
    await page.getByText('Dumbbells', { exact: true }).click();
    await inspect('plan');
    await page.getByTestId('plan-save').click();
    await page.getByTestId('train-screen').waitFor({ timeout: 30_000 });
    await inspect('train-planned');
  }
  await page.locator('[data-testid^="suggestion-"]').first().click();
  await page.getByTestId('workout-screen').waitFor({ timeout: 30_000 });
  await inspect('workout');
});
await step('home', async () => {
  await go('home', 'home-screen');
  await inspect('home');
});
await step('scan', async () => {
  await go('scan', 'scan-screen');
  await inspect('scan');
});
await step('diary', async () => {
  await go('diary', 'diary-screen');
  await inspect('diary');
});
await step('stats', async () => {
  await go('progress', 'kpi-grid');
  await inspect('stats');
});
await step('coach', async () => {
  await go('coach', 'coach-screen');
  await inspect('coach');
  const suggestion = page.getByTestId('coach-suggestion').first();
  if (await suggestion.isVisible().catch(() => false)) {
    await suggestion.click();
    await Promise.race([page.getByTestId('coach-reply').first().waitFor({ timeout: 60_000 }), page.getByTestId('coach-error').waitFor({ timeout: 60_000 })]).catch(() => {});
    await inspect('coach-reply');
  }
});
for (const [path, ready] of [
  ['profile', 'profile-screen'],
  ['profile/targets', 'targets-screen'],
  ['profile/edit', 'edit-profile'],
  ['profile/privacy', 'privacy-screen'],
  ['profile/security', 'security-screen'],
  ['profile/export', null],
  ['profile/integrations', null],
  ['profile/tdee', null],
  ['profile/delete', null],
]) {
  await step(path, async () => {
    await go(path, ready);
    await inspect(path.replace('/', '-'));
  });
}
// Run again with the theme argument set to white for the light palette.

await browser.close();

const grouped = {};
for (const f of findings) {
  const key = `${f.kind}: ${f.detail}`;
  grouped[key] ??= { kind: f.kind, detail: f.detail, screens: [] };
  if (!grouped[key].screens.includes(f.screen)) grouped[key].screens.push(f.screen);
}
const rows = Object.values(grouped).sort((a, b) => a.kind.localeCompare(b.kind));
writeFileSync(`${out}/${engine}-findings.json`, JSON.stringify(rows, null, 2));
console.log(`${engine}: ${rows.length} distinct finding(s) across ${findings.length} occurrence(s)`);
for (const r of rows) console.log(`  [${r.kind}] ${r.detail}  (${r.screens.join(', ')})`);

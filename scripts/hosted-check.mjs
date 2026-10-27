// Smoke test for a deployed web build: loads the sign-in screen at a phone
// width, checks provider status renders, and that a deep link falls back to
// the SPA. Usage: node scripts/hosted-check.mjs https://host/path/
import { chromium } from '@playwright/test';

const base = (process.argv[2] ?? 'https://ddatasolutions05.github.io/fitlens/').replace(/\/?$/, '/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const signIn = await page.getByTestId('sign-in-screen').isVisible().catch(() => false);
const google = await page.getByText('Google sign-in: not configured').isVisible().catch(() => false);
console.log(`root: url=${page.url()} signIn=${signIn} providerStatus=${google}`);

await page.goto(`${base}today`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const deepLinkOk = await page.getByTestId('sign-in-screen').isVisible().catch(() => false);
console.log(`deep link: url=${page.url()} redirectedToSignIn=${deepLinkOk}`);

const width = await page.evaluate(() => document.documentElement.scrollWidth);
console.log(`scrollWidth=${width} pageErrors=${errors.length ? JSON.stringify(errors) : 'none'}`);
await browser.close();
process.exit(signIn && deepLinkOk && width <= 375 && errors.length === 0 ? 0 : 1);

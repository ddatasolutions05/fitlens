// Clicks "Continue with Google" on the hosted sign-in and reports where it lands.
import { chromium } from '@playwright/test';
const base = (process.argv[2] ?? 'https://ddatasolutions05.github.io/fitlens/').replace(/\/?$/, '/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
let authorize = null;
page.on('request', (r) => {
  if (r.url().includes('/auth/v1/authorize')) authorize = r.url();
});
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.getByTestId('oauth-google').click();
await page.waitForURL(/accounts\.google\.com|supabase\.co\/auth/, { timeout: 30_000 });
await page.waitForTimeout(2000);
const url = new URL(page.url());
console.log(`landed on ${url.host}${url.pathname}`);
const inner = url.searchParams.get('redirect_uri') ?? '';
console.log(`client_id present=${(url.searchParams.get('client_id') ?? '').endsWith('.apps.googleusercontent.com')} redirect_uri=${inner}`);
console.log(`page title: ${await page.title()}`);
const back = authorize ? new URL(authorize).searchParams.get('redirect_to') : null;
console.log(`app redirect_to after Google: ${back}`);
if (!back || !back.startsWith(base)) {
  console.error('redirect_to does not point at the app base path');
  await browser.close();
  process.exit(1);
}
await browser.close();

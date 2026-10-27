import { expect, test } from '@playwright/test';

import { supabaseConfigured } from './helpers';

test.describe('setup guide (no Supabase configured)', () => {
  test.skip(supabaseConfigured, 'Only meaningful when the app has no Supabase credentials');

  test('shows the setup guide instead of a broken app at 375 px', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('FitLens needs a Supabase project')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('EXPO_PUBLIC_SUPABASE_URL', { exact: false }).first()).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(375);
  });

  test('sign-in and tabs redirect to setup', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page).toHaveURL(/setup/, { timeout: 60_000 });
    await page.goto('/today');
    await expect(page).toHaveURL(/setup/, { timeout: 60_000 });
  });
});

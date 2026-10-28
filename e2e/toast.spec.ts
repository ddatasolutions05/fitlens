import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('confirmations', () => {
  requireSupabase();

  test('a quick water log confirms with a toast and returns to Today', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/log/water');
    await page.getByTestId('water-250').click();
    await expect(page.getByTestId('toast')).toContainText('250 ml of water added');
    await expect(page.getByTestId('today-screen')).toBeVisible();
    await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 10_000 });
  });
});

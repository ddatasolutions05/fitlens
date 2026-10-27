import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('missing data is distinct from zero', () => {
  requireSupabase();

  test('an unlogged past day shows Not logged on Today and a gap on Progress', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/today');
    // Go back 400 days: nothing can be logged there.
    for (let i = 0; i < 3; i += 1) await page.getByTestId('date-prev').click();
    await expect(page.getByTestId('today-screen')).toContainText('Not logged');
    await expect(page.getByTestId('today-screen')).not.toContainText(/\b0 kcal\b/);
    await expect(page.getByTestId('insight')).toContainText('Nothing was logged on this day.');

    await page.getByTestId('tab-progress').click();
    await expect(page.getByTestId('progress-screen')).toBeVisible();
    await expect(page.getByText(/not logged/)).toBeVisible();
  });
});

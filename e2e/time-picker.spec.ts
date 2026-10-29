import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('time picker', () => {
  requireSupabase();

  test('a time is picked in the app sheet and confirmed with Set time', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/log/weight');
    await page.getByTestId('weight-time').click();
    await expect(page.getByTestId('weight-time-sheet')).toBeVisible();
    await page.getByTestId('weight-time-h-7').click();
    await page.getByTestId('weight-time-m-30').click();
    await page.getByRole('radio', { name: 'PM', exact: true }).click();
    await expect(page.getByTestId('weight-time-preview')).toHaveText('7:30 PM');
    await page.getByTestId('weight-time-set').click();
    await expect(page.getByTestId('weight-time-sheet')).toHaveCount(0);
    await expect(page.getByTestId('weight-time')).toHaveText('7:30 PM');

    await page.getByTestId('weight-input').fill('80.2');
    await page.getByTestId('save-weight').click();
    await expect(page.getByTestId('toast')).toContainText('Weight saved');
  });
});

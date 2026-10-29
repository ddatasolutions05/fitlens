import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('measurements and plans', () => {
  requireSupabase();

  test('a waist measurement saves and shows on Stats; the plans page opens', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/log/measure');
    await expect(page.getByTestId('log-measure')).toBeVisible();
    await page.getByTestId('save-measure').click();
    await expect(page.getByTestId('measure-error')).toContainText('Add a waist');
    await page.getByTestId('measure-waist').fill('86.5');
    await page.getByTestId('save-measure').click();
    await expect(page.getByTestId('toast')).toContainText('Measurement saved');
    await page.goto('/progress');
    await expect(page.getByTestId('body-card')).toContainText('86.5 cm');

    await page.goto('/profile/plans');
    await expect(page.getByTestId('plans-screen')).toBeVisible();
    await expect(page.getByTestId('plan-gym')).toContainText('a member a month');
  });
});

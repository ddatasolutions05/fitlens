import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('onboarding to Today', () => {
  requireSupabase();

  test('signs in, completes onboarding and lands on Today with a TDEE explanation', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await expect(page.getByTestId('today-screen')).toBeVisible();
    await expect(page.getByTestId('calorie-target')).toContainText('kcal');
    await page.getByText('What is the difference?').click();
    await expect(page.getByTestId('tdee-explainer')).toBeVisible();
    await expect(page.getByText('Resting energy (REE)')).toBeVisible();
    await expect(page.getByText(/× 1\.55/).first()).toBeVisible();
  });

  test('tracking-only mode never shows a deficit target', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/profile/edit');
    await page.getByRole('radio', { name: 'Yes' }).first().click();
    await page.getByTestId('save-profile').click();
    await page.goto('/profile/targets');
    await expect(page.getByText('Tracking-only mode')).toBeVisible();
    await expect(page.getByText('No calorie target', { exact: true })).toBeVisible();
    await page.getByTestId('save-targets').click();
    await page.goto('/today');
    await expect(page.getByTestId('calorie-target')).toContainText('Not set');
    // restore
    await page.goto('/profile/edit');
    await page.getByRole('radio', { name: 'No' }).first().click();
    await page.getByTestId('save-profile').click();
  });
});

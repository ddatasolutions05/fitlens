import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('home cards', () => {
  requireSupabase();

  test('the release note shows once and stays dismissed after a reload', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/home');
    await expect(page.getByTestId('whats-new')).toBeVisible();
    await page.getByTestId('whats-new-dismiss').click();
    await expect(page.getByTestId('whats-new')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('greeting')).toBeVisible();
    await expect(page.getByTestId('whats-new')).toHaveCount(0);
  });
});

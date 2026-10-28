import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('week in review and target check', () => {
  requireSupabase();

  test('the review reads the week without blame and the target check explains what it still needs', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/home');
    await page.getByTestId('home-review').click();
    await expect(page.getByTestId('review-screen')).toBeVisible();
    await expect(page.getByTestId('review-plate')).toContainText(/logged \d of 7 days|No logs this week/);
    await expect(page.getByTestId('review-wins')).toBeVisible();
    await expect(page.getByTestId('review-screen')).not.toContainText(/cheat|junk|guilt|lazy/i);

    await page.goto('/profile/adaptive');
    await expect(page.getByTestId('adaptive-screen')).toBeVisible();
    // A fresh account cannot have thirty days of complete logs, so the gate lists what is missing.
    await expect(page.getByTestId('adaptive-locked')).toContainText(/Needs 21 days|tracking-only/);
  });
});

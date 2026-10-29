import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('admin screen', () => {
  requireSupabase();

  test('an ordinary account sees no Admin row and is refused on the route', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/profile');
    await expect(page.getByText('How it works')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Admin', exact: true })).toHaveCount(0);
    await page.goto('/admin');
    await expect(page.getByTestId('admin-denied')).toBeVisible();
  });
});

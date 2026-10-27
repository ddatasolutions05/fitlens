import { expect, test } from '@playwright/test';

import { e2eUser, requireSupabase } from './helpers';

test.describe('sign-in screen', () => {
  requireSupabase();

  test('offers sign in, account creation, magic link, password reset and shows provider status', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByTestId('sign-in-screen')).toBeVisible();
    await expect(page.getByTestId('sign-in')).toBeDisabled();
    await expect(page.getByTestId('forgot-password')).toBeVisible();
    await expect(page.getByTestId('send-link')).toBeVisible();
    // Providers come from the project's public settings; disabled ones say so instead of failing on click.
    await expect(page.getByText('Google sign-in: not configured')).toBeVisible();
    await page.getByRole('radio', { name: 'Create account' }).click();
    await expect(page.getByTestId('sign-up')).toBeDisabled();
    await page.getByTestId('email').fill(e2eUser.email);
    await page.getByTestId('password').fill('short');
    await expect(page.getByTestId('sign-up')).toBeDisabled();
    await page.getByTestId('password').fill('long-enough-password');
    await expect(page.getByTestId('sign-up')).toBeEnabled();
  });

  test('a wrong password shows a friendly message and does not sign in', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByTestId('email').fill(e2eUser.email);
    await page.getByTestId('password').fill('definitely-wrong-password');
    await page.getByTestId('sign-in').click();
    await expect(page.getByTestId('auth-error')).toContainText(/wrong/i);
    await expect(page).toHaveURL(/sign-in/);
  });

  test('the reset-password page without a recovery session explains and links back', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText(/missing or has expired/)).toBeVisible();
  });
});

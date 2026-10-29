import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('daily reminder', () => {
  requireSupabase();

  test('the reminder screen opens from Profile with a time and a way to turn it on', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Daily reminder' }).click();
    await expect(page.getByTestId('reminders-screen')).toBeVisible();
    await expect(page.getByTestId('reminder-status')).toContainText('Off');
    await expect(page.getByTestId('reminder-time')).toContainText('8:00 PM');
    await expect(page.getByTestId('reminder-on')).toBeVisible();
  });
});

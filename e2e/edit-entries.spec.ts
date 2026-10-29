import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('editing logged entries', () => {
  requireSupabase();

  test('a weigh-in can be corrected from the Diary and the help page opens', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/log/weight');
    await page.getByTestId('weight-input').fill('79.4');
    await page.getByTestId('save-weight').click();
    await expect(page.getByTestId('toast')).toContainText('Weight saved');

    await page.goto('/diary');
    await expect(page.getByText('79.4 kg').first()).toBeVisible();
    // The innermost container holding both the value and an Edit button is that entry's row.
    const row = page.locator('div').filter({ has: page.getByText('79.4 kg', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Edit' }) }).last();
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByTestId('log-weight')).toBeVisible();
    await expect(page.getByTestId('weight-input')).toHaveValue('79.4');
    await page.getByTestId('weight-input').fill('79.9');
    await page.getByTestId('save-weight').click();
    await expect(page.getByTestId('toast')).toContainText('Weigh-in updated');
    await page.goto('/diary');
    await expect(page.getByText('79.9 kg').first()).toBeVisible();
    await expect(page.getByText('79.4 kg')).toHaveCount(0);

    await page.goto('/profile/help');
    await expect(page.getByTestId('help-screen')).toContainText('What counts toward the day');
  });
});

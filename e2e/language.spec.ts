import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('interface language', () => {
  requireSupabase();

  test('switching to Punjabi and back changes the everyday screens', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/profile');
    await page.getByRole('radio', { name: 'ਪੰਜਾਬੀ', exact: true }).click();
    await expect(page.getByTestId('tab-home')).toContainText('ਘਰ');
    await page.goto('/today');
    await expect(page.getByTestId('calorie-card')).toContainText('ਖਾਧੀਆਂ ਕੈਲੋਰੀਆਂ');
    await page.goto('/profile');
    await page.getByRole('radio', { name: 'हिन्दी', exact: true }).click();
    await expect(page.getByTestId('tab-home')).toContainText('होम');
    await page.getByRole('radio', { name: 'English', exact: true }).click();
    await expect(page.getByTestId('tab-home')).toContainText('Home');
  });
});

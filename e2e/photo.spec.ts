import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

const fixture = join(__dirname, 'fixtures', 'meal.jpg');

test.describe('photo flow against the real configured AI', () => {
  requireSupabase();
  test.skip(!process.env.E2E_VISION_CONFIGURED, 'Set E2E_VISION_CONFIGURED=1 once ANTHROPIC_API_KEY is deployed to the edge functions; never mocked');
  test.skip(!existsSync(fixture), 'Add a real meal photo at e2e/fixtures/meal.jpg');

  test('a draft from a photo does not count until confirmed, and confirm then delete updates totals', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/profile/privacy');
    await page.getByRole('radio', { name: 'Allowed' }).click();

    await page.goto('/scan');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('choose-photo').click()]);
    await chooser.setFiles(fixture);
    await page.getByTestId('analyze').click();
    await Promise.race([page.getByTestId('clarify').waitFor({ timeout: 90_000 }), page.getByTestId('meal-editor').waitFor({ timeout: 90_000 })]);
    if (await page.getByTestId('clarify').isVisible()) {
      await page.getByTestId('clarify-continue').click();
    }
    await expect(page.getByTestId('meal-editor')).toBeVisible({ timeout: 90_000 });
    const items = page.locator('[data-testid^="item-"]');
    expect(await items.count()).toBeGreaterThan(0);

    // Draft does not count: keep as draft and check Today shows it as a draft
    await page.getByTestId('save-draft').click();
    await page.goto('/today');
    await expect(page.getByText('Draft').first()).toBeVisible();

    await page.locator('[data-testid^="meal-"]').first().click();
    await page.getByTestId('confirm-meal').click();
    await expect(page.getByTestId('meal-confirmed')).toBeVisible();
    await page.getByTestId('done').click();
    await expect(page.getByText('Draft')).toHaveCount(0);

    await page.locator('[data-testid^="meal-"]').first().click();
    await page.getByTestId('delete-meal').click();
    await expect(page.getByTestId('today-screen')).toBeVisible();
  });
});

test.describe('AI outage leaves manual logging working', () => {
  requireSupabase();

  test('scan screen explains when analysis is unavailable and manual entry still works', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.route('**/functions/v1/analyze-meal', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'provider_error', message: 'simulated outage', retryable: true } }) }));
    await page.goto('/scan');
    await page.getByTestId('manual-instead').click();
    await expect(page.getByTestId('food-search')).toBeVisible();
    await page.getByTestId('manual-entry').click();
    await expect(page.getByTestId('manual-food')).toBeVisible();
  });
});

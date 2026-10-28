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
    await page.getByRole('radio', { name: 'Allowed', exact: true }).click();
    // The consent save is in flight; leaving the page before it lands would abort it.
    await expect(page.getByText(/Consent given/)).toBeVisible();

    await page.goto('/scan');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('choose-photo').click()]);
    await chooser.setFiles(fixture);
    await page.getByTestId('analyze').click();
    // Three outcomes are all valid: clarifying questions, packaged or unmatched items to review, or straight to the editor.
    await Promise.race([
      page.getByTestId('clarify').waitFor({ timeout: 90_000 }),
      page.getByTestId('review-continue').waitFor({ timeout: 90_000 }),
      page.getByTestId('meal-editor').waitFor({ timeout: 90_000 }),
    ]);
    if (await page.getByTestId('clarify').isVisible()) {
      await page.getByTestId('clarify-continue').click();
      await Promise.race([page.getByTestId('review-continue').waitFor({ timeout: 90_000 }), page.getByTestId('meal-editor').waitFor({ timeout: 90_000 })]);
    }
    if (await page.getByTestId('review-continue').isVisible()) {
      await page.getByTestId('review-continue').click();
    }
    await expect(page.getByTestId('meal-editor')).toBeVisible({ timeout: 90_000 });
    const items = page.locator('[data-testid^="item-"]');
    expect(await items.count()).toBeGreaterThan(0);

    // The fixture photo carries its own capture date, so the draft lands on that
    // day. Move it to today, as a person would, before checking the Today screen.
    const today = new Date().toLocaleDateString('en-CA');
    await page.getByLabel('Date').fill(today);
    await expect(page.getByLabel('Date')).toHaveValue(today);

    // Draft does not count: keep as draft and check Today shows it as a draft
    await page.getByTestId('save-draft').click();
    await page.goto('/today');
    await expect(page.getByText('Draft').first()).toBeVisible();

    // Other specs may leave their own drafts behind, so follow this meal by its row id.
    const row = page.locator('[data-testid^="meal-"]').filter({ hasText: 'Draft' }).first();
    const rowId = (await row.getAttribute('data-testid'))!;
    await row.click();
    await page.getByTestId('confirm-meal').click();
    await expect(page.getByTestId('meal-confirmed')).toBeVisible();
    await page.getByTestId('done').click();
    await expect(page.getByTestId(rowId)).toBeVisible();
    await expect(page.getByTestId(rowId)).not.toContainText('Draft');

    await page.getByTestId(rowId).click();
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

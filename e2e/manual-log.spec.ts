import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('manual food log', () => {
  requireSupabase();

  test('manual entry updates totals, persists after reload, portion edit recalculates, delete reverts', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/today');
    const before = (await page.getByTestId('calorie-target').textContent()) ?? '';
    expect(before).toContain('kcal');

    await page.getByTestId('quick-add-food').click();
    await page.getByTestId('manual-entry').click();
    await page.getByTestId('manual-name').fill('E2E test bar');
    await page.getByTestId('manual-serving').fill('50');
    await page.getByTestId('manual-kcal').fill('200');
    await page.getByTestId('manual-protein').fill('10');
    await page.getByTestId('manual-add').click();

    await expect(page.getByTestId('meal-editor')).toBeVisible();
    await expect(page.getByTestId('meal-kcal')).toContainText('200');

    // portion edit recalculates instantly
    const itemCard = page.locator('[data-testid^="item-"]').first();
    await itemCard.click();
    const gramsInput = page.locator('[data-testid^="grams-"]').first();
    await gramsInput.fill('100');
    await expect(page.getByTestId('meal-kcal')).toContainText('400');
    await gramsInput.fill('50');
    await expect(page.getByTestId('meal-kcal')).toContainText('200');

    // A draft must not count: keep it, check Today, then come back and confirm.
    await page.getByTestId('save-draft').click();
    await expect(page.getByTestId('today-screen')).toBeVisible();
    const draftRow = page.locator('[data-testid^="meal-"]').filter({ hasText: 'E2E test bar' }).first();
    await expect(draftRow).toContainText('Draft');
    const eatenBefore = (await page.locator('[aria-label^="Calories:"]').first().getAttribute('aria-label')) ?? '';
    await draftRow.click();
    await page.getByTestId('confirm-meal').click();
    await expect(page.getByTestId('meal-confirmed')).toBeVisible();
    await expect(page.getByTestId('day-after')).toBeVisible();
    await page.getByTestId('done').click();

    await expect(page.getByTestId('today-screen')).toBeVisible();
    expect(eatenBefore).not.toContain('200');
    await expect(page.locator('[aria-label^="Calories:"]').first()).toHaveAttribute('aria-label', /Calories: 200/);
    const mealRow = page.locator('[data-testid^="meal-"]').filter({ hasText: 'E2E test bar' }).first();
    await expect(mealRow).toContainText('200 kcal');

    await page.reload();
    await expect(page.locator('[data-testid^="meal-"]').filter({ hasText: 'E2E test bar' }).first()).toContainText('200 kcal', { timeout: 45_000 });

    // delete updates totals
    await page.locator('[data-testid^="meal-"]').filter({ hasText: 'E2E test bar' }).first().click();
    await page.getByTestId('delete-meal').click();
    await expect(page.getByTestId('today-screen')).toBeVisible();
    await expect(page.locator('[data-testid^="meal-"]').filter({ hasText: 'E2E test bar' })).toHaveCount(0);
  });

  test('a double tap on confirm creates one meal', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/food/search');
    await page.getByTestId('manual-entry').click();
    await page.getByTestId('manual-name').fill('E2E double submit');
    await page.getByTestId('manual-serving').fill('30');
    await page.getByTestId('manual-kcal').fill('100');
    await page.getByTestId('manual-add').click();
    const confirm = page.getByTestId('confirm-meal');
    await confirm.click();
    await confirm.click({ force: true }).catch(() => {});
    await expect(page.getByTestId('meal-confirmed')).toBeVisible();
    await page.getByTestId('done').click();
    await expect(page.locator('[data-testid^="meal-"]').filter({ hasText: 'E2E double submit' })).toHaveCount(1);
    await page.locator('[data-testid^="meal-"]').filter({ hasText: 'E2E double submit' }).first().click();
    await page.getByTestId('delete-meal').click();
  });
});

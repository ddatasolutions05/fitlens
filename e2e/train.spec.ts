import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('workouts', () => {
  requireSupabase();

  test('builds a plan from settings, suggests today, logs a session as activity', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/train');
    await expect(page.getByTestId('train-screen')).toBeVisible();

    // A fresh account has no plan yet (global setup wipes preferences). Wait for either state to render.
    await Promise.race([page.getByTestId('build-plan').waitFor({ timeout: 30_000 }), page.getByTestId('change-plan').waitFor({ timeout: 30_000 })]);
    if (await page.getByTestId('build-plan').isVisible().catch(() => false)) {
      await page.getByTestId('build-plan').click();
    } else {
      await page.getByTestId('change-plan').click();
    }
    await expect(page.getByTestId('plan-screen')).toBeVisible();
    await page.getByRole('radio', { name: '4', exact: true }).click();
    await page.getByRole('radio', { name: 'Build strength', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Dumbbells' }).click().catch(async () => {
      await page.getByText('Dumbbells', { exact: true }).click();
    });
    await expect(page.getByTestId('plan-preview')).toContainText(/dumbbells/i);
    const before = await page.getByTestId('plan-preview').innerText();
    await page.getByTestId('plan-shuffle').click();
    await expect(page.getByTestId('plan-preview')).toBeVisible();
    const after = await page.getByTestId('plan-preview').innerText();
    expect(after).not.toBe('');
    expect(before).not.toBe('');
    await page.getByTestId('plan-save').click();

    await expect(page.getByTestId('train-screen')).toBeVisible();
    await expect(page.getByTestId('plan-week')).toBeVisible();
    const workoutRows = page.locator('[data-testid^="week-"]').filter({ hasText: /min/ });
    expect(await workoutRows.count()).toBe(4);

    // Open today's suggestion (planned or optional) and log it.
    const suggestion = page.locator('[data-testid^="suggestion-"]').first();
    await expect(suggestion).toBeVisible();
    await suggestion.click();
    await expect(page.getByTestId('workout-screen')).toBeVisible();
    await expect(page.getByTestId('exercise-list')).toBeVisible();
    await page.getByTestId('workout-minutes').fill('25');
    await page.getByTestId('workout-done').click();
    await expect(page.getByTestId('workout-saved')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('workout-saved')).toContainText('25 minutes');
    await page.getByTestId('workout-back').click();
    await expect(page.getByTestId('train-screen')).toBeVisible();
    await expect(page.locator('[data-testid^="suggestion-"]').first()).toContainText('done');

    // The session is an activity record, so Today shows it.
    await page.goto('/today');
    await expect(page.getByTestId('today-screen')).toBeVisible();
    await expect(page.getByText(/25 min/)).toBeVisible();
  });
});

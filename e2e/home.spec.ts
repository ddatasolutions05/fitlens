import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('home', () => {
  requireSupabase();

  test('greets by time of day, shows the line of the day and reaches every section', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/home');
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('greeting')).toHaveText(/Good (morning|afternoon|evening|night)|Still up/);
    await expect(page.getByTestId('quote')).toContainText(/\w+/);
    await expect(page.getByTestId('home-avatar')).toBeVisible();
    await expect(page.getByTestId('home-kcal')).toBeVisible();
    // The test account never asks the Coach, so the start-here plate stays up with that step open.
    await expect(page.getByTestId('first-steps')).toBeVisible();
    await expect(page.getByTestId('first-steps')).toContainText('Ask the Coach one thing');
    await page.getByTestId('first-step-meal').click();
    await expect(page.getByTestId('food-search')).toBeVisible();

    for (const [nav, ready] of [
      ['nav-today', 'today-screen'],
      ['nav-diary', 'diary-screen'],
      ['nav-train', 'train-screen'],
      ['nav-progress', 'kpi-grid'],
      ['nav-coach', 'coach-screen'],
      ['nav-profile', 'profile-screen'],
    ] as const) {
      await page.goto('/home');
      await page.getByTestId(nav).click();
      await expect(page.getByTestId(ready)).toBeVisible({ timeout: 30_000 });
    }

    // The tab bar: Home, Today, Train, Stats, Coach
    await page.goto('/today');
    await expect(page.getByTestId('tab-home')).toBeVisible();
    await expect(page.getByTestId('tab-train')).toBeVisible();
    await page.getByTestId('tab-home').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });
});

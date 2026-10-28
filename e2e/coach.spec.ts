import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

test.describe('coach', () => {
  requireSupabase();

  test('explains its grounding, offers suggestions, and either answers or reports the real server state', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/coach');
    await expect(page.getByTestId('coach-screen')).toBeVisible();
    await expect(page.getByText(/last 14 days/)).toBeVisible();
    await expect(page.getByTestId('coach-suggestion').first()).toBeVisible();
    await expect(page.getByTestId('coach-input')).toBeVisible();

    const notConfigured = page.getByText(/Coach: not configured/);
    const consentCard = page.getByText(/Consent needed/);
    await page.waitForTimeout(2500);
    if (await notConfigured.isVisible().catch(() => false)) {
      await expect(page.getByTestId('coach-send')).toBeDisabled();
      return;
    }
    if (await consentCard.isVisible().catch(() => false)) {
      await expect(page.getByTestId('coach-send')).toBeDisabled();
      return;
    }

    await page.getByTestId('coach-suggestion').first().click();
    // Either a grounded reply or an honest provider error; never a silent nothing.
    await expect(page.getByTestId('coach-reply').or(page.getByTestId('coach-error'))).toBeVisible({ timeout: 90_000 });
  });

  test('stats screen shows the KPI grid', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/progress');
    await expect(page.getByTestId('kpi-grid')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('kpi-logged')).toBeVisible();
    await expect(page.getByTestId('kpi-streak')).toBeVisible();
    await expect(page.getByTestId('kpi-protein')).toBeVisible();
  });
});

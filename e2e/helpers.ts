import { expect, test, type Page } from '@playwright/test';

export const supabaseConfigured = Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && !process.env.EXPO_PUBLIC_SUPABASE_URL.includes('your-project'));
export const e2eUser = { email: process.env.E2E_USER_EMAIL ?? '', password: process.env.E2E_USER_PASSWORD ?? '' };
export const hasE2eUser = Boolean(e2eUser.email && e2eUser.password);

/** Skips a spec that needs a real Supabase project, with the reason recorded in the report. */
export function requireSupabase(): void {
  test.skip(!supabaseConfigured, 'Needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY pointing at a real project');
  test.skip(!hasE2eUser, 'Needs E2E_USER_EMAIL and E2E_USER_PASSWORD for a password sign-in test user');
}

export async function signIn(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await page.getByTestId('email').fill(e2eUser.email);
  await page.getByTestId('password').fill(e2eUser.password);
  await page.getByTestId('sign-in').click();
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 30_000 });
}

export async function completeOnboardingIfNeeded(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForURL(/onboarding|today|home/, { timeout: 30_000 });
  if (!page.url().includes('onboarding')) return;
  // Step 1: about you
  await page.getByTestId('birth-date').fill('1990-05-10');
  await page.getByRole('radio', { name: 'Male', exact: true }).click();
  await page.getByTestId('continue').click();
  // Step 2: body
  await page.getByTestId('height').fill('180');
  await page.getByTestId('weight').fill('80');
  await page.getByTestId('continue').click();
  // Step 3: goal and activity
  await page.getByRole('radio', { name: /^Moderate/ }).click();
  await page.getByRole('radio', { name: 'Fat loss' }).click();
  await page.getByTestId('continue').click();
  // Step 4: numbers and AI choice
  await page.getByRole('radio', { name: 'Not now' }).click();
  await expect(page.getByTestId('ree-value')).toContainText('kcal');
  await expect(page.getByTestId('tdee-value')).toContainText('kcal');
  await expect(page.getByTestId('target-value')).toContainText('kcal');
  await page.getByTestId('finish').click();
  // Setup ends on the first-meal screen; skip it to land on Home.
  await page.getByTestId('first-skip').waitFor({ timeout: 30_000 });
  await page.getByTestId('first-skip').click();
  await page.waitForURL(/home/, { timeout: 30_000 });
}

export async function readKcalText(page: Page): Promise<string> {
  return (await page.getByTestId('calorie-target').textContent()) ?? '';
}

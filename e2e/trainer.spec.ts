import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

// One account can be both sides of the screen but cannot link to itself;
// the two-user flow is covered by the SQL test in supabase/test/rls.test.ts.
test.describe('trainer access', () => {
  requireSupabase();

  test('a trainer makes a code; a member cannot use their own or a bad one', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/trainer');
    await expect(page.getByTestId('trainer-screen')).toBeVisible();
    await expect(page.getByTestId('trainer-make-code')).toBeVisible();
    const codeEl = page.getByTestId('trainer-code');
    const before = (await codeEl.count()) > 0 ? ((await codeEl.textContent())?.trim() ?? null) : null;
    await page.getByTestId('trainer-make-code').click();
    await expect(page.getByTestId('trainer-code')).toHaveText(/^[A-Z0-9]{6}$/, { timeout: 30_000 });
    if (before) await expect(page.getByTestId('trainer-code')).not.toHaveText(before, { timeout: 30_000 });
    const code = (await page.getByTestId('trainer-code').textContent())!.trim();
    await expect(page.getByText('No members yet')).toBeVisible();

    await page.goto('/profile/trainer');
    await expect(page.getByTestId('your-trainer-screen')).toBeVisible();
    await page.getByTestId('trainer-code-input').fill(code);
    await page.getByTestId('trainer-link').click();
    await expect(page.getByTestId('trainer-link-error')).toContainText('your own');
    await page.getByTestId('trainer-code-input').fill('ZZZZZZ');
    await page.getByTestId('trainer-link').click();
    await expect(page.getByTestId('trainer-link-error')).toContainText('not valid');
  });
});

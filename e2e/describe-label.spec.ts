import { expect, test, type Page } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

// Both AI functions are answered with fixed responses here so the screens are
// deterministic; the mapping onto the real food database still runs.

const described = {
  prompt_version: 'describe-meal/2026-10-28.1',
  model: 'test-model',
  result: {
    items: [
      {
        name: 'Boiled egg',
        dish_type: 'eggs',
        cuisine: 'general',
        prep_method_assumed: 'boiled',
        portion_g_estimate: 50,
        portion_g_range: [45, 60],
        household_unit_estimate: '1 egg',
        hidden_ingredients_assumed: [],
        db_query_terms: ['egg boiled', 'egg'],
        confidence: 'high',
        uncertainty_drivers: [],
        nutrients_per100_estimate: { kcal: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11, fibre_g: 0 },
      },
    ],
    packaged_items: [],
    questions: [],
  },
  usage: { analyses_today: 1, daily_limit: 30 },
};

const labelRead = {
  prompt_version: 'read-label/2026-10-27.1',
  model: 'test-model',
  result: {
    product_name: 'Greek Yogurt',
    brand: 'Oikos',
    serving_size_text: '175 g',
    serving_size_g: 175,
    servings_per_container: 4,
    per_serving: { kcal: 160, protein_g: 17, carbs_g: 9, fat_g: 6, fibre_g: 0, sodium_mg: 60, sat_fat_g: 4 },
    confidence: 'high',
    notes: [],
  },
};

async function allowAi(page: Page) {
  await page.goto('/profile/privacy');
  await page.getByRole('radio', { name: 'Allowed', exact: true }).click();
  await expect(page.getByText(/Consent given/)).toBeVisible();
}

async function smallJpeg(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ddd';
    ctx.fillRect(0, 0, 64, 48);
    return c.toDataURL('image/jpeg', 0.8);
  });
  return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
}

test.describe('describe a meal and read a label', () => {
  requireSupabase();

  test('a typed description becomes editable items', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await allowAi(page);
    await page.route('**/functions/v1/describe-meal', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(described) }));
    await page.goto('/food/describe');
    await expect(page.getByTestId('describe-screen')).toBeVisible();
    await page.getByTestId('describe-text').fill('one boiled egg');
    await page.getByTestId('describe-go').click();
    await expect(page.getByTestId('meal-editor')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('meal-editor')).toContainText(/egg/i);
  });

  test('a label photo becomes a product with servings', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await allowAi(page);
    await page.route('**/storage/v1/object/meal-photos/**', (route) => {
      const key = route.request().url().split('/storage/v1/object/')[1] ?? 'meal-photos/x';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: key, Id: 'e2e' }) });
    });
    await page.route('**/functions/v1/read-label', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(labelRead) }));
    await page.goto('/food/label');
    const jpeg = await smallJpeg(page);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('label-gallery').click()]);
    await chooser.setFiles({ name: 'label.jpg', mimeType: 'image/jpeg', buffer: jpeg });
    await expect(page.getByTestId('label-result')).toContainText('Greek Yogurt, Oikos', { timeout: 60_000 });
    await expect(page.getByTestId('label-serving-g')).toHaveValue('175');
    await page.getByTestId('label-servings').fill('2');
    await page.getByTestId('label-add').click();
    await expect(page.getByTestId('meal-editor')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('meal-editor')).toContainText('Greek Yogurt Oikos');
    await expect(page.getByTestId('meal-kcal')).toHaveText('320 kcal');
  });
});

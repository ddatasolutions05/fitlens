import { expect, test, type Page } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

// The approval flow for packaged products: the analysis names a product, the
// product search returns label values, nothing is logged until Add is tapped.
// The two function responses are fixed here so the flow is deterministic; the
// real model and the real search are exercised by photo.spec.ts.

const analysis = {
  analysis_id: '7a5b6c0e-1d2f-4a3b-9c8d-0e1f2a3b4c5d',
  status: 'succeeded',
  prompt_version: 'analyze-meal/2026-10-28.1',
  model: 'test-model',
  result: {
    items: [],
    packaged_items: [
      {
        name: 'Clif Bar Chocolate Chip',
        reason: 'Branded bar; values should come from the label',
        serving_g_estimate: 68,
        household_unit_estimate: '1 bar',
        confidence: 'medium',
        nutrients_per100_estimate: { kcal: 370, protein_g: 13, carbs_g: 60, fat_g: 7, fibre_g: 6 },
      },
    ],
    questions: [],
  },
  usage: { analyses_today: 1, daily_limit: 30 },
};

const products = {
  source: 'off',
  query: 'Clif Bar Chocolate Chip',
  products: [
    {
      barcode: '722252100900',
      name: 'Chocolate Chip Energy Bar',
      brand: 'Clif Bar',
      per100: { kcal: 382, protein_g: 13.2, carbs_g: 64.7, fat_g: 7.4, fibre_g: 5.9, sodium_mg: 220, sat_fat_g: 1.5 },
      serving_g: 68,
      attribution: 'Open Food Facts (ODbL), community data',
      url: 'https://world.openfoodfacts.org/product/722252100900',
    },
  ],
};

async function smallJpeg(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#885';
    ctx.fillRect(0, 0, 64, 48);
    return c.toDataURL('image/jpeg', 0.8);
  });
  return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
}

test.describe('packaged product approval', () => {
  requireSupabase();

  test('a product found online is suggested and logged only after Add', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/profile/privacy');
    await page.getByRole('radio', { name: 'Allowed', exact: true }).click();
    await expect(page.getByText(/Consent given/)).toBeVisible();

    await page.route('**/storage/v1/object/meal-photos/**', (route) => {
      const key = route.request().url().split('/storage/v1/object/')[1] ?? 'meal-photos/x';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: key, Id: 'e2e' }) });
    });
    await page.route('**/functions/v1/analyze-meal', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analysis) }));
    let lookupQuery: string | null = null;
    await page.route('**/functions/v1/lookup-product', (route) => {
      lookupQuery = (route.request().postDataJSON() as { query: string }).query;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(products) });
    });

    await page.goto('/scan');
    const jpeg = await smallJpeg(page);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('choose-photo').click()]);
    await chooser.setFiles({ name: 'bar.jpg', mimeType: 'image/jpeg', buffer: jpeg });
    await page.getByTestId('analyze').click();

    const card = page.getByTestId('packaged-0');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText('Clif Bar Chocolate Chip');
    await expect(card).toContainText('Chocolate Chip Energy Bar (Clif Bar)');
    await expect(card).toContainText('260 kcal for 68 g');
    await expect(card).toContainText('Typical values for this product');
    expect(lookupQuery).toBe('Clif Bar Chocolate Chip');

    await page.getByTestId('packaged-add-product-0-0').click();
    await expect(page.getByTestId('meal-editor')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('meal-editor')).toContainText('Chocolate Chip Energy Bar (Clif Bar)');
    await expect(page.getByTestId('meal-kcal')).toHaveText('260 kcal');
  });
});

import { expect, test } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

// The barcode screen with a fixed lookup response: typing the number is the
// path every browser supports; the camera path needs a device.
const product = {
  found: true,
  source: 'off',
  product: {
    barcode: '0722252100900',
    name: 'Chocolate Chip Energy Bar',
    brand: 'Clif Bar',
    per100: { kcal: 382, protein_g: 13.2, carbs_g: 64.7, fat_g: 7.4, fibre_g: 5.9, sodium_mg: 220, sat_fat_g: 1.5 },
    serving_g: 68,
    attribution: 'Open Food Facts (ODbL), community data',
  },
};

test.describe('barcode', () => {
  requireSupabase();

  test('a typed barcode finds the product and adds a serving to the meal', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.route('**/functions/v1/lookup-barcode', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(product) }));
    await page.goto('/food/search');
    await page.getByTestId('barcode-entry').click();
    await expect(page.getByTestId('barcode-screen')).toBeVisible();
    await page.getByTestId('barcode-input').fill('0 722252 100900');
    await page.getByTestId('barcode-lookup').click();
    await expect(page.getByTestId('barcode-product')).toContainText('Chocolate Chip Energy Bar (Clif Bar)');
    await expect(page.getByTestId('barcode-grams')).toHaveValue('68');
    await page.getByTestId('barcode-add').click();
    await expect(page.getByTestId('meal-editor')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('meal-editor')).toContainText('Chocolate Chip Energy Bar (Clif Bar)');
    await expect(page.getByTestId('meal-kcal')).toHaveText('260 kcal');
  });

  test('an unknown barcode offers manual entry', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.route('**/functions/v1/lookup-barcode', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ found: false, source: 'off', product: null }) }));
    await page.goto('/food/barcode');
    await page.getByTestId('barcode-input').fill('12345678');
    await page.getByTestId('barcode-lookup').click();
    await expect(page.getByText('Not in Open Food Facts')).toBeVisible();
  });
});

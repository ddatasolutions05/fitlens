import { expect, test, type Page } from '@playwright/test';

import { completeOnboardingIfNeeded, requireSupabase, signIn } from './helpers';

// Phone cameras produce images larger than a browser canvas may hold on iOS.
// The resizer must never draw the whole photo into a canvas, so a very large
// source has to come out as a 1,600 px JPEG with no error on the screen.

// The upload body is multipart form data; the JPEG starts at the first SOI marker.
function jpegSize(body: Buffer): { width: number; height: number } | null {
  const start = body.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
  if (start < 0) return null;
  const buf = body.subarray(start);
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

async function bigPng(page: Page, width: number, height: number): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ([w, h]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#f2d16b');
      g.addColorStop(1, '#4a6b3a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      return c.toDataURL('image/png');
    },
    [width, height] as const,
  );
  return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
}

test.describe('photo resize on web', () => {
  requireSupabase();

  test('a 6000 px photo is uploaded as a 1600 px JPEG', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/scan');
    await expect(page.getByTestId('choose-photo')).toBeVisible();
    const png = await bigPng(page, 6000, 4500);
    expect(png.length).toBeGreaterThan(1000);

    let uploaded: Buffer | null = null;
    await page.route('**/storage/v1/object/meal-photos/**', async (route) => {
      uploaded = route.request().postDataBuffer();
      const key = route.request().url().split('/storage/v1/object/')[1] ?? 'meal-photos/x';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: key, Id: 'e2e' }) });
    });

    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('choose-photo').click()]);
    await chooser.setFiles({ name: 'plate.png', mimeType: 'image/png', buffer: png });

    await expect.poll(() => uploaded !== null, { timeout: 60_000 }).toBe(true);
    const size = jpegSize(uploaded!);
    expect(size).not.toBeNull();
    expect(Math.max(size!.width, size!.height)).toBe(1600);
    expect(size!.width).toBe(1600);
    expect(size!.height).toBe(1200);
    await expect(page.getByText(/not in the allowed range|Could not open the image|Upload failed/)).toHaveCount(0);
    await expect(page.getByTestId('take-photo')).toBeVisible({ timeout: 30_000 });
  });
});

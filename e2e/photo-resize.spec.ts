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

// A displayable JPEG from the browser's own encoder, with an EXIF APP1 segment
// spliced in after SOI so the capture time can be read.
async function jpegWithCaptureTime(page: Page, exifDate: string): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#c96';
    ctx.fillRect(0, 0, 64, 48);
    return c.toDataURL('image/jpeg', 0.8);
  });
  const jpeg = Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
  const tiff: number[] = [];
  const put16 = (v: number) => tiff.push(v >> 8, v & 0xff);
  const put32 = (v: number) => tiff.push(v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
  tiff.push(0x4d, 0x4d);
  put16(0x2a);
  put32(8);
  put16(1);
  put16(0x8769);
  put16(4);
  put32(1);
  put32(26);
  put32(0);
  put16(1);
  put16(0x9003);
  put16(2);
  put32(20);
  put32(44);
  put32(0);
  tiff.push(...Array.from(exifDate, (ch) => ch.charCodeAt(0)), 0);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1, len >> 8, len & 0xff, ...app1]), jpeg.subarray(2)]);
}

test.describe('photo capture time', () => {
  requireSupabase();

  test('a gallery photo sets the meal date and time from its EXIF', async ({ page }) => {
    await signIn(page);
    await completeOnboardingIfNeeded(page);
    await page.goto('/scan');
    await expect(page.getByTestId('choose-photo')).toBeVisible();
    const jpeg = await jpegWithCaptureTime(page, '2026:10:20 07:35:00');
    await page.route('**/storage/v1/object/meal-photos/**', async (route) => {
      const key = route.request().url().split('/storage/v1/object/')[1] ?? 'meal-photos/x';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: key, Id: 'e2e' }) });
    });
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('choose-photo').click()]);
    await chooser.setFiles({ name: 'breakfast.jpg', mimeType: 'image/jpeg', buffer: jpeg });
    await expect(page.getByTestId('manual-instead')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Another photo/ })).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('manual-instead').click();
    await expect(page.getByTestId('meal-editor')).toBeVisible();
    await expect(page.getByTestId('time-from-photo')).toBeVisible();
    await expect(page.getByLabel('Date')).toHaveValue('2026-10-20');
    await expect(page.getByTestId('meal-time')).toHaveText('7:35 AM');
    await expect(page.getByRole('radio', { name: 'Breakfast', exact: true })).toBeChecked();
  });
});

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

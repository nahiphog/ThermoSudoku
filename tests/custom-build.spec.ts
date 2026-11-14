import { expect, test } from '@playwright/test';

test('Build preserves the layout, displays clues and reveals a verified solution', async ({ page }) => {
  await page.goto('/?page=custom-build');
  await expect(page.locator('#custom-build-page').getByLabel('Logical techniques only (no Brute force)', { exact: true })).toBeChecked();
  await expect(page.locator('#custom-build')).toBeDisabled();
  await page.locator('#custom-board [data-cell="0"]').click();
  await page.locator('#custom-board [data-cell="1"]').click();
  await expect(page.locator('#custom-build')).toBeDisabled();
  await page.locator('#custom-finish').click();
  const path = await page.locator('#custom-board polyline').getAttribute('points');
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await expect(page.locator('#custom-status')).toContainText('exactly one solution', { timeout: 35000 });
  await expect(page.locator('#custom-board polyline')).toHaveAttribute('points', path!);
  const clues = await page.locator('#custom-board .digit').count();
  expect(clues).toBeGreaterThan(0); expect(clues).toBeLessThan(81);
  await expect(page.locator('#custom-rating')).toBeVisible();
  await expect(page.locator('#custom-score')).toHaveText(/^\d+$/);
  await expect(page.locator('#custom-walk-panel')).toBeVisible();
  await expect(page.locator('#custom-tallies')).not.toContainText('Brute force');
  await expect(page.locator('#custom-copy-image')).toBeDisabled();
  await expect(page.locator('#custom-step-prev')).toBeDisabled();
  await page.locator('#custom-step-next').click();
  await expect(page.locator('#custom-step-count')).toContainText('Step 2 of');
  await expect(page.locator('#custom-tallies .technique-step').first()).toBeVisible();
  await page.locator('#custom-tallies .technique-step').first().click();
  await page.locator('#custom-step-last').click();
  await expect(page.locator('#custom-board .digit')).toHaveCount(81);
  await expect(page.locator('#custom-step-next')).toBeDisabled();
  await page.locator('#custom-walk-close').click();
  await expect(page.locator('#custom-copy-image')).toBeEnabled();
  await expect(page.locator('#custom-board .digit')).toHaveCount(clues);
  await page.locator('#custom-walk-open').click();
  await expect(page.locator('#custom-step-count')).toContainText('Step 1 of');
  await page.locator('#custom-reveal').click();
  await expect(page.locator('#custom-board .digit')).toHaveCount(81);
  await page.locator('#custom-reveal').click();
  await expect(page.locator('#custom-board .digit')).toHaveCount(clues);
  await page.locator('#custom-no-givens').check();
  await page.locator('#custom-build').click();
  await expect(page.locator('#custom-status')).toContainText('more than one solution without given cells');
  await expect(page.locator('#custom-board .digit')).toHaveCount(clues);
  await expect(page.locator('#custom-board polyline')).toHaveAttribute('points', path!);
  await expect(page.locator('#custom-rating')).toBeVisible();
  await page.getByRole('button', { name: 'Slow Thermo', exact: true }).click();
  await expect(page.locator('#custom-rating')).toBeHidden();
  await expect(page.locator('#custom-walk-panel')).toBeHidden();
  await page.locator('#custom-undo').click();
  await page.reload();
  await expect(page.locator('#custom-board .digit')).toHaveCount(clues);
});

test('custom logical-only preference persists independently of Generate', async ({ page }) => {
  await page.goto('/?page=custom-build');
  const option = page.locator('#custom-logical-only');
  await expect(option).toBeChecked();
  await option.uncheck();
  await page.reload();
  await expect(option).not.toBeChecked();
  await expect(page.locator('#logical-only')).toBeChecked();
  await option.check();
  await page.reload();
  await expect(option).toBeChecked();
});

test('No given cells defaults off, persists independently and explains Missing Thermometer', async ({ page }) => {
  await page.goto('/?page=custom-build');
  const option = page.locator('#custom-no-givens');
  await expect(option).not.toBeChecked();
  await option.check();
  await page.reload();
  await expect(option).toBeChecked();
  await expect(page.locator('#no-givens')).not.toBeChecked();
  await page.getByRole('button', { name: 'Missing Thermometer', exact: true }).click();
  await page.locator('#custom-board [data-cell="0"]').click();
  await page.locator('#custom-board [data-cell="1"]').click();
  await page.locator('#custom-finish').click();
  await page.locator('#custom-build').click();
  await expect(page.locator('#custom-status')).toContainText('Missing Thermometer needs given cells');
  await option.uncheck();
  await page.reload();
  await expect(option).not.toBeChecked();
});

test('custom image export copies a PNG and downloads when clipboard access fails', async ({ page }) => {
  await page.goto('/?page=custom-build');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      write: async (items: ClipboardItem[]) => {
        const blob = await items[0].getType('image/png');
        const bitmap = await createImageBitmap(blob);
        document.body.dataset.copiedImage = `${blob.type}:${bitmap.width}x${bitmap.height}`;
        bitmap.close();
      },
    } });
  });
  await page.locator('#custom-board [data-cell="0"]').click();
  await expect(page.locator('#custom-copy-image')).toBeDisabled();
  await page.locator('#custom-board [data-cell="1"]').click();
  await page.locator('#custom-finish').click();
  await page.locator('#custom-copy-image').click();
  await expect(page.locator('body')).toHaveAttribute('data-copied-image', 'image/png:904x904');
  await expect(page.locator('#custom-status')).toContainText('Grid image copied');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => { throw new Error('Denied'); } } }));
  const download = page.waitForEvent('download');
  await page.locator('#custom-copy-image').click();
  expect((await download).suggestedFilename()).toBe('thermo-sudoku.png');
  await expect(page.locator('#custom-status')).toContainText('Grid image downloaded');
});

test('custom layouts support all variants, validation, persistence and undo', async ({ page }) => {
  await page.goto('/?page=custom-build');
  await expect(page.getByRole('heading', { name: 'Custom Build', exact: true })).toBeVisible();
  const cell = (i: number) => page.locator(`#custom-board [data-cell="${i}"]`);
  await cell(0).click();
  await cell(20).click();
  await expect(page.locator('#custom-status')).toContainText('next to the current tip');
  await cell(10).click();
  await page.locator('#custom-finish').click();
  await expect(page.locator('#custom-board polyline')).toHaveCount(1);
  await expect(page.locator('#custom-board circle')).toHaveCount(1);
  await page.getByRole('button', { name: 'Missing Thermometer', exact: true }).click();
  await expect(page.locator('#custom-board circle')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#custom-board polyline')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Missing Thermometer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Slow Thermo', exact: true }).click();
  await cell(0).click(); await cell(1).click();
  await page.locator('#custom-finish').click();
  await expect(page.locator('#custom-board polyline')).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete thermo 1', exact: true }).click();
  await expect(page.locator('#custom-board polyline')).toHaveCount(1);
  await page.locator('#custom-undo').click();
  await expect(page.locator('#custom-board polyline')).toHaveCount(2);
  await page.locator('#custom-export').click();
  await expect(page.locator('#custom-string')).toHaveValue(/^TS1\|S\|0{81}\|1122;1112$/);
  await page.locator('#custom-clear').click();
  await expect(page.locator('#custom-board polyline')).toHaveCount(0);
  await page.locator('#custom-undo').click();
  await expect(page.locator('#custom-board polyline')).toHaveCount(2);
});

test('custom build works on mobile and through page navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#page-menu summary').click();
  await page.getByRole('link', { name: 'Custom Build', exact: true }).click();
  await expect(page.locator('#maker-page')).toBeHidden();
  await page.locator('#custom-board [data-cell="80"]').click();
  await page.locator('#custom-board [data-cell="70"]').click();
  await page.locator('#custom-finish').click();
  await expect(page.locator('#custom-count')).toContainText('1 thermometers');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goBack();
  await expect(page.locator('#custom-build-page')).toBeHidden();
});

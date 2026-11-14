import { expect, test } from '@playwright/test';

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

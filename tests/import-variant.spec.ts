import { expect, test } from '@playwright/test';
test('selected import version controls checking and clears stale results', async ({ page }) => {
  await page.goto('/?page=import-grid');
  const selector = page.getByLabel('Puzzle version');
  await expect(selector).toHaveValue('auto');
  await page.locator('#import-text').fill('TS1|T|534678912672195348198342567859761423426853791713924856961537284287419635345286179|1211');
  await selector.selectOption('thermo');
  await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toHaveText('Exactly one solution.');
  await selector.selectOption('slow');
  await expect(page.locator('#import-results')).toBeEmpty();
  await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toContainText('No solution exists');
  await selector.selectOption('missing');
  await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toHaveText('Exactly one solution.');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

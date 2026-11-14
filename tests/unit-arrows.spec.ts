import { expect, test } from '@playwright/test';
test('walkthrough uses external row arrows and clears them between steps', async ({ page }) => {
  await page.goto('/?page=import-grid');
  await page.locator('#import-text').fill('TS1|T|034678912672195348198342567859761423426853791713924856961537284287419635345286179|');
  await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toHaveText('Exactly one solution.', { timeout: 30000 });
  await expect(page.locator('#import-walk-board .unit-arrow')).toHaveCount(0);
  await page.locator('#import-next').click();
  await expect(page.locator('#import-walk-board .row-arrow')).toHaveAttribute('aria-label', 'Row 1 involved');
  await expect(page.locator('#import-walk-board .step-reason')).toHaveCount(1);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const grid = await page.locator('#import-walk-board').boundingBox();
    const arrow = await page.locator('#import-walk-board .row-arrow').boundingBox();
    expect(arrow!.x).toBeGreaterThanOrEqual(0);
    expect(arrow!.x + arrow!.width).toBeLessThanOrEqual(grid!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/unit-arrows-${width}.png`, fullPage: true });
  }
  await page.locator('#import-last').click();
  await expect(page.locator('#import-walk-board .unit-arrow')).toHaveCount(0);
  await expect(page.locator('#import-walk-board .step-reason')).toHaveCount(0);
});

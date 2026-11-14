import { expect, test } from '@playwright/test';
test('box context uses one outline and preserves candidate evidence', async ({ page }) => {
  await page.goto('/?page=import-grid');
  await page.locator('#import-text').fill('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
  await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toHaveText('Exactly one solution.', { timeout: 30000 });
  const range = page.locator('#import-step-range');
  const max = Number(await range.getAttribute('max'));
  let found = false;
  for (let i = 1; i < max; i++) {
    await range.fill(String(i));
    if (await page.locator('#import-walk-board .unit-box-outline').count()) { found = true; break; }
  }
  expect(found).toBe(true);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await page.locator('#import-walk-board .unit-box-outline').first().boundingBox();
    const cell = await page.locator('#import-walk-board .cell').first().boundingBox();
    expect(Math.abs(box!.width - cell!.width * 3)).toBeLessThan(1);
    expect(Math.abs(box!.height - cell!.height * 3)).toBeLessThan(1);
    await expect(page.locator('#import-walk-board .unit-box-outline').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('#import-walk-board .candidate-pattern').first()).toBeVisible();
    await page.screenshot({ path: `test-results/box-outline-${width}.png`, fullPage: true });
  }
  await page.locator('#import-last').click();
  await expect(page.locator('#import-walk-board .unit-box-outline')).toHaveCount(0);
});

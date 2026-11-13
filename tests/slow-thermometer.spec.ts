import { expect, test } from '@playwright/test';

test('the supplied Slow Thermo shows peer-chain eliminations under the named technique', async ({ page }) => {
  await page.goto('/#import-grid');
  await page.locator('#import-text').fill('TS1|S|000000000000000000000000004000400000600209007000008000700000000000000000000000000|3142332324;7968778786;9596858483;1514252627;9899887889;1211223221');
  await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toHaveText('Exactly one solution.', { timeout: 65000 });
  await expect(page.locator('#import-walk-board .step-reason')).toHaveCount(0);
  await page.locator('#import-next').click();
  await expect(page.locator('#import-step-title')).toHaveText('Slow Thermometer bounds');
  await expect(page.locator('#import-step-description')).toContainText('r3c1 < r3c3');
  await expect(page.locator('#import-step-description')).toContainText('r3c3 < r2c3');
  await expect(page.locator('#import-walk-board .cell').nth(20).locator('.removed-candidate')).toContainText(['1']);
  await expect(page.locator('#import-walk-board .cell').nth(11).locator('.removed-candidate').filter({ hasText: /^2$/ })).toHaveCount(1);
  await expect(page.locator('#import-tallies tbody th').filter({ hasText: /^Slow Thermometer bounds$/ })).toHaveCount(1);
  for (const cell of [18, 20, 11]) {
    await expect(page.locator('#import-walk-board .cell').nth(cell)).toHaveClass(/step-reason/);
    await expect(page.locator('#import-walk-board .cell').nth(cell)).toHaveAttribute('aria-label', /strict inequality cell/);
  }
  await expect(page.locator('#import-walk-board .cell').nth(28)).not.toHaveClass(/step-reason/);
  await page.locator('#import-walk-board').screenshot({ path: 'test-results/slow-bounds-highlight.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#import-walk-board').screenshot({ path: 'test-results/slow-bounds-highlight-mobile.png' });
  await page.locator('#import-last').click();
  await expect(page.locator('#import-walk-board .digit')).toHaveCount(81);
  await expect(page.locator('#import-walk-board .step-reason')).toHaveCount(0);
  await page.locator('#import-first').click(); await page.locator('#import-next').click();
  await expect(page.locator('#import-walk-board .cell').nth(18)).toHaveClass(/step-reason/);
});

import { expect, test } from '@playwright/test';
import { checkTallyLinks } from './tally-helpers';

test('Missing Thermometer generation, reveal, image copy, and bulb walkthrough', async ({ page }) => {
  await page.addInitScript(() => {
    const originalArc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (...args: Parameters<typeof originalArc>) {
      localStorage.setItem('image-bulbs', String(Number(localStorage.getItem('image-bulbs') ?? '0') + 1));
      return originalArc.apply(this, args);
    };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      write: async (items: ClipboardItem[]) => { await items[0].getType('image/png'); },
      writeText: async (text: string) => { localStorage.setItem('copied', text); },
    } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Missing Thermometer', exact: true }).click();
  await page.locator('#thermo-lengths').fill('3,3');
  await page.locator('#no-givens').check();
  await expect(page.locator('#generation-error')).toContainText('10 − d');
  await page.locator('#no-givens').uncheck();
  await page.locator('#generate').click();
  await expect(page.locator('#status-title')).toHaveText('A new puzzle, with one solution.', { timeout: 65000 });
  await expect(page.locator('#thermos polyline')).toHaveCount(2);
  await expect(page.locator('#thermos circle')).toHaveCount(0);
  await page.locator('#copy-image').click();
  await expect(page.locator('#status-title')).toHaveText('Grid image copied.');
  expect(await page.evaluate(() => localStorage.getItem('image-bulbs'))).toBeNull();
  await page.locator('#copy-string').click();
  expect(await page.evaluate(() => localStorage.getItem('copied'))).toMatch(/^TS1\|M\|/);
  await page.locator('#reveal').click();
  await expect(page.locator('#thermos circle')).toHaveCount(2);
  await page.locator('#copy-image').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('image-bulbs'))).toBe('2');
  await page.locator('#reveal').click();
  await expect(page.locator('#thermos circle')).toHaveCount(0);
  await page.locator('#walkthrough').click();
  await expect(page.locator('#thermos circle')).toHaveCount(0);
  const row = page.locator('#technique-tallies tbody tr').filter({ hasText: 'Bulb finding' });
  await expect(row.locator('.technique-uses')).toHaveText('2 uses');
  await row.locator('button').first().click();
  await expect(page.locator('#slide-title')).toHaveText('Bulb finding');
  await expect(page.locator('#thermos circle')).toHaveCount(1);
  await row.locator('button').last().click();
  await expect(page.locator('#thermos circle')).toHaveCount(2);
  await page.locator('#slide-first').click();
  await expect(page.locator('#thermos circle')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/missing-thermometer-mobile.png', fullPage: true });
  await page.locator('#about').click();
  await expect(page.locator('#about-dialog')).toContainText('must be placed at one of the open ends');
});

test('import and simulation use Missing Thermometer and show resolved bulbs only in solutions', async ({ page }) => {
  const digits = [...'534678912672195348198342567859761423426853791713924856961537284287419635345286179'];
  for (const c of [0, 1, 7, 8, 17]) digits[c] = '0';
  await page.goto('/?page=import-grid');
  await page.locator('#import-text').fill(`TS1|M|${digits.join('')}|1112;181929`);
  await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toHaveText('Exactly one solution.');
  await expect(page.locator('#import-completed circle')).toHaveCount(2);
  await expect(page.locator('#import-walk-board circle')).toHaveCount(0);
  await checkTallyLinks(page, '#import-tallies', '#import-step-range', '#import-step-title', '#import-walk-board');
  await page.locator('#import-reveal').click();
  await expect(page.locator('#import-completed circle')).toHaveCount(0);
  await page.goto('/?page=simulation');
  await page.locator('#sim-missing-variant').click();
  await page.locator('#sim-thermo-lengths').fill('3,3');
  await page.locator('#sim-trials').selectOption('1');
  await page.locator('#sim-threshold').selectOption('0');
  await page.locator('#sim-start').click();
  await expect(page.locator('#sim-status')).toHaveText('Simulation complete.', { timeout: 65000 });
  await expect(page.locator('#sim-results polyline')).toHaveCount(2);
  await expect(page.locator('#sim-results circle')).toHaveCount(0);
});

import { checkTallyLinks } from './tally-helpers';
import { techniqueScore } from '../src/technique-tallies';
import { expect, test } from '@playwright/test';

const clues = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
test('import page shows a unique completion alongside a navigable walkthrough', async ({ page }) => {
  await page.goto('/#import-grid');
  await expect(page.locator('#maker-page')).not.toBeVisible();
  await page.locator('#import-text').fill(`My puzzle:\nTS1|T|${clues}|181929\nPlease solve.`);
  await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toHaveText('Exactly one solution.', { timeout: 65000 });
  const completed = await page.locator('#import-completed .digit').allTextContents();
  expect(completed).toHaveLength(81);
  await expect(page.locator('#import-completed polyline')).toHaveCount(1);
  await expect(page.locator('#import-walk-board polyline')).toHaveCount(1);
  await expect(page.locator('#import-step-title')).toHaveText('Starting puzzle');
  await expect(page.locator('#import-tallies tbody tr').first()).toBeVisible();
  await checkTallyLinks(page, '#import-tallies', '#import-step-range', '#import-step-title', '#import-walk-board');
  const tallies = await page.locator('#import-tallies').textContent();
  const ratings = (await page.locator('#import-tallies tbody th').allTextContents()).map(techniqueScore);
  expect(ratings).toEqual([...ratings].sort((a, b) => a - b));
  await page.locator('#import-next').click();
  await expect(page.locator('#import-step-count')).toContainText('Step 2');
  await page.locator('#import-last').click();
  await expect(page.locator('#import-step-title')).toHaveText('Puzzle complete');
  await expect(page.locator('#import-walk-board .digit')).toHaveText(completed);
  expect(await page.locator('#import-tallies').textContent()).toBe(tallies);
  await page.screenshot({ path: 'test-results/import-unique.png', fullPage: true });
  // Removing all 1s and 2s leaves at least two completions, swapping those digits.
  await page.locator('#import-text').fill(completed.map(d => d === '1' || d === '2' ? '0' : d).join(''));
  await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toContainText('Multiple solutions.', { timeout: 35000 });
  const grids = page.locator('#import-results .board'); await expect(grids).toHaveCount(2);
  const a = await grids.nth(0).locator('.digit').allTextContents(), b = await grids.nth(1).locator('.digit').allTextContents();
  const diff = a.filter((d, i) => d !== b[i]).length; expect(diff).toBeGreaterThan(0);
  await expect(grids.nth(0).locator('.different-cell')).toHaveCount(diff);
  await expect(grids.nth(1).locator('.different-cell')).toHaveCount(diff);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/import-multiple-mobile.png', fullPage: true });
  await page.locator('#import-text').fill('11' + '0'.repeat(79));
  await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toContainText('No solution exists');
  await expect(page.locator('#import-results .board')).toHaveCount(0);
  await page.locator('#import-text').fill('bad input'); await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toContainText('Paste a TS1');
  await page.locator('#page-menu summary').click();
  await page.getByRole('link', { name: 'Generate', exact: true }).click();
  await expect(page.locator('#maker-page')).toBeVisible();
});


test('import controls export the displayed grid and navigation uses no hashes', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text: string) => { localStorage.setItem('copied-grid', text); },
      write: async (items: ClipboardItem[]) => {
        const blob = await items[0].getType('image/png');
        localStorage.setItem('copied-image', String(blob.size));
      },
    } });
  });
  await page.goto('/');
  await expect(page).toHaveTitle('Thermo');
  await page.locator('#page-menu summary').click();
  await page.getByRole('link', { name: 'Import grid', exact: true }).click();
  await expect(page).toHaveURL(/\?page=import-grid$/);
  await page.reload();
  await expect(page.locator('#import-page')).toBeVisible();
  const ratio = await page.locator('#import-text').evaluate(el => {
    const parent = el.parentElement!;
    const style = getComputedStyle(parent);
    return el.getBoundingClientRect().width / (parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
  });
  expect(ratio).toBeCloseTo(0.5, 2);
  await page.locator('#import-text').fill('TS1|T|' + clues + '|181929');
  await page.locator('#inspect-import').click();
  await expect(page.locator('#import-status')).toHaveText('Exactly one solution.', { timeout: 65000 });
  const solved = (await page.locator('#import-completed .digit').allTextContents()).join('');
  await page.locator('#import-copy-string').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('copied-grid'))).toBe('TS1|T|' + solved + '|181929');
  await page.locator('#import-copy-image').click();
  await expect(page.locator('#import-copy-status')).toHaveText('Completed grid image copied.');
  const completedImage = await page.evaluate(() => localStorage.getItem('copied-image'));
  await page.locator('#import-reveal').click();
  await expect(page.locator('#import-grid-title')).toHaveText('Given grid');
  await expect(page.locator('#import-completed .digit')).toHaveCount(clues.replace(/0/g, '').length);
  await page.locator('#import-copy-string').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('copied-grid'))).toBe('TS1|T|' + clues + '|181929');
  await page.locator('#import-copy-image').click();
  await expect(page.locator('#import-copy-status')).toHaveText('Given grid image copied.');
  expect(await page.evaluate(() => localStorage.getItem('copied-image'))).not.toBe(completedImage);
  await page.locator('#import-reveal').click();
  await expect(page.locator('#import-completed .digit')).toHaveCount(81);
  await page.locator('#page-menu summary').click();
  await page.getByRole('link', { name: 'Generate', exact: true }).click();
  await expect(page).toHaveURL(/\?page=generate$/);
  await page.goBack();
  await expect(page.locator('#import-page')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#maker-page')).toBeVisible();
  await page.goto('/#import-grid');
  await expect(page).toHaveURL(/\?page=import-grid$/);
});

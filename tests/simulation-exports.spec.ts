import { expect, test } from '@playwright/test';
import { example } from '../src/puzzle';
import { encodePuzzle } from '../src/puzzle-string';

test('simulation exports each displayed puzzle and offers clipboard fallbacks', async ({ page }) => {
  const puzzle = example(); puzzle.variant = 'missing';
  await page.addInitScript(p => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text: string) => localStorage.setItem('copied-grid', text),
      write: async (items: ClipboardItem[]) => {
        const blob = await items[0].getType('image/png');
        localStorage.setItem('copied-image', String(blob.size));
      },
    } });
    (window as unknown as { Worker: unknown }).Worker = class {
      onmessage?: (event: { data: unknown }) => void;
      trial = 0; terminated = false;
      postMessage() {
        if (++this.trial > 13) return;
        setTimeout(() => { if (!this.terminated) this.onmessage?.({ data: { score: 1000, match: { puzzle: p, score: 1000, hardest: 'Hidden Single' } } }); }, 5);
      }
      terminate() { this.terminated = true; }
    };
  }, puzzle);
  await page.goto('/?page=simulation');
  await page.locator('#sim-start').click();
  await expect(page.locator('#sim-stats')).toContainText('13 qualifying grids');
  await page.locator('#sim-next').click();
  const card = page.locator('#sim-results article');
  await expect(card).toHaveCount(1);
  await expect(card.locator('h3')).toHaveText('Trial 13');
  await card.getByRole('button', { name: 'Copy grid as a string', exact: true }).click();
  await expect(card.getByRole('status')).toHaveText('Puzzle string copied.');
  expect(await page.evaluate(() => localStorage.getItem('copied-grid'))).toBe(encodePuzzle(puzzle));
  await card.getByRole('button', { name: 'Copy grid as an image', exact: true }).click();
  await expect(card.getByRole('status')).toHaveText('Grid image copied.');
  expect(Number(await page.evaluate(() => localStorage.getItem('copied-image')))).toBeGreaterThan(1000);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await card.getByRole('button', { name: 'Copy grid as a string', exact: true }).click();
  await expect(card.getByLabel('Puzzle string to copy')).toHaveValue(encodePuzzle(puzzle));
  const downloading = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Copy grid as an image', exact: true }).click();
  expect((await downloading).suggestedFilename()).toBe('thermo-trial-13.png');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#sim-start').click();
});

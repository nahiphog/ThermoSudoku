import { expect, test } from '@playwright/test';

test('simulation has Generate options, requested defaults, validation, and a real completed trial', async ({ page }) => {
  await page.goto('/?page=simulation');
  await expect(page.getByRole('heading', { name: 'Simulation', exact: true })).toBeVisible();
  await expect(page.locator('#maker-page')).not.toBeVisible();
  await expect(page.locator('#sim-trials')).toHaveValue('1000000');
  await expect(page.locator('#sim-threshold')).toHaveValue('1000');
  expect(await page.locator('#sim-trials option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value))).toEqual(['1','10','100','1000','10000','1000000']);
  expect(await page.locator('#sim-threshold option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value))).toEqual(['0','500','1000','2000','3000','5000','10000','10000000']);
  await expect(page.locator('#sim-logical-only')).toBeChecked();
  await expect(page.locator('#sim-symmetric-thermos')).toBeChecked();
  await page.locator('#sim-thermo-lengths').fill('4,4,4,5');
  await expect(page.locator('#sim-start')).toBeDisabled();
  await page.locator('#sim-symmetric-thermos').uncheck();
  await expect(page.locator('#sim-start')).toBeEnabled();
  await page.locator('#sim-thermo-lengths').fill('4,4');
  await page.locator('#sim-trials').selectOption('1');
  await page.locator('#sim-threshold').selectOption('0');
  await page.locator('#sim-start').click();
  await expect(page.locator('#sim-status')).toHaveText('Simulation complete.', { timeout: 65000 });
  await expect(page.locator('#sim-stats')).toContainText('1 / 1 trials completed · 1 qualifying grids');
  await expect(page.locator('#sim-results .board')).toHaveCount(1);
  await expect(page.locator('#sim-results polyline')).toHaveCount(2);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/simulation-mobile.png',fullPage:true});
});

test('simulation filters ratings inclusively, paginates, and stops pending trials without losing results', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { Worker: unknown }).Worker = class {
      onmessage?: (event: { data: unknown }) => void;
      terminated = false;
      trial = 0;
      postMessage(request: { puzzle: unknown; threshold: number }) {
        const trial = ++this.trial;
        if (trial > 15) return; // keep the next trial pending for the Stop check
        setTimeout(() => {
          if (this.terminated) return;
          const score = trial === 1 ? 999 : 1000;
          this.onmessage?.({ data: { score, match: score >= request.threshold ? { puzzle: request.puzzle, score, hardest: 'Phistomefel Ring' } : null } });
        }, 5);
      }
      terminate() { this.terminated = true; }
    };
  });
  await page.goto('/?page=simulation');
  await page.locator('#sim-start').click();
  await expect(page.locator('#sim-stats')).toContainText('15 / 1,000,000 trials completed · 14 qualifying grids');
  await expect(page.locator('#sim-results article')).toHaveCount(12);
  await expect(page.locator('#sim-results h3').first()).toHaveText('Trial 2');
  await page.locator('#sim-next').click();
  await expect(page.locator('#sim-results article')).toHaveCount(2);
  await expect(page.locator('#sim-results h3').first()).toHaveText('Trial 14');
  await page.locator('#page-menu summary').click();
  await page.getByRole('link', { name: 'Generate', exact: true }).click();
  await page.locator('#page-menu summary').click();
  await page.getByRole('link', { name: 'Simulation', exact: true }).click();
  await page.locator('#sim-stop').click();
  await expect(page.locator('#sim-status')).toContainText('unfinished trial is not counted');
  await expect(page.locator('#sim-results article')).toHaveCount(2);
  await expect(page.locator('#sim-start')).toBeEnabled();
  await page.locator('#sim-trials').selectOption('1');
  await page.locator('#sim-start').click();
  await expect(page.locator('#sim-status')).toHaveText('Simulation complete.');
  await expect(page.locator('#sim-stats')).toContainText('1 / 1 trials completed · 0 qualifying grids');
  await expect(page.locator('#sim-results article')).toHaveCount(0);
});

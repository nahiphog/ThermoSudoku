import { expect, test, type Page } from '@playwright/test';
test.setTimeout(90000);
const optionLabels = ['Rotationally symmetric thermometers'];
test('logical-only preference persists and generates without Brute force', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#logical-only')).toBeChecked();
  await page.locator('#logical-only').check(); await page.reload();
  await expect(page.locator('#logical-only')).toBeChecked();
  await generate(page);
  expect((await exported(page)).logicalOnly).toBe(true);
  await expect(page.locator('#rating-summary')).toContainText('0 Brute force use(s)');
  await page.locator('#walkthrough').click();
  await expect(page.locator('#technique-tallies')).not.toContainText('Brute force');
  await page.locator('#slide-last').click();
  await expect(page.locator('#filled')).toContainText('81 / 81');
  await page.locator('#close-walkthrough').click();
  await page.locator('#logical-only').uncheck(); await page.reload();
  await expect(page.locator('#logical-only')).not.toBeChecked();
});
test('custom generation options, statistics above grid, and clipboard string round trip', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.locator('#thermometer-count option')).toHaveCount(30);
  await expect(page.locator('#min-thermo-length option')).toHaveCount(10);
  await expect(page.locator('#min-thermo-length')).toHaveValue('3');
  await page.locator('#thermometer-count').selectOption('30');
  await expect(page.locator('#generate')).toBeDisabled();
  await expect(page.locator('#generation-error')).toContainText('81');
  await page.locator('#thermometer-count').selectOption('1');
  await expect(page.locator('#generation-error')).toContainText('even');
  await page.locator('#symmetric-thermos').uncheck();
  await page.locator('#min-thermo-length').selectOption('10');
  await expect(page.locator('#generation-error')).toContainText('at most 9');
  await page.locator('#min-thermo-length').selectOption('2');
  await generate(page);
  const original = await exported(page);
  await expect(page.locator('#generation-stats dt')).toHaveCount(6);
  await expect(page.locator('#stat-score')).toHaveText(/^\d+$/);
  await expect(page.locator('#stat-hardest')).not.toBeEmpty();
  await expect(page.locator('#puzzle-title, #view-label')).toHaveCount(0);
  await expect(page.getByText('Draw the selected number', { exact: false })).toHaveCount(0);
  expect(original.thermos).toHaveLength(1);
  const stats = await page.locator('#generation-stats').boundingBox(), board = await page.locator('#board').boundingBox();
  expect(stats!.y + stats!.height).toBeLessThan(board!.y);
  await page.locator('#reveal').click();
  await page.locator('#copy-string').click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.split('|')[2]).toBe(original.givens.join(''));
  await page.locator('#import').click();
  await page.locator('#puzzle-json').fill(text);
  await page.locator('#load-json').click();
  const restored = await exported(page);
  expect(restored.givens).toEqual(original.givens);
  expect(restored.thermos).toEqual(original.thermos);
  expect(restored.variant).toBe(original.variant);
});
async function generate(page: Page) {
  await page.getByRole('button', { name: 'Generate puzzle', exact: true }).click();
  await expect(page.locator('#confirm')).not.toBeVisible();
  await expect(page.locator('#status-title')).toHaveText('A new puzzle, with one solution.', { timeout: 35000 });
}
async function exported(page: Page) {
  await page.getByRole('button', { name: 'Export', exact: false }).click();
  const p = JSON.parse(await page.locator('#puzzle-json').inputValue());
  await page.getByRole('button', { name: 'Close dialog' }).click(); return p;
}
test('options above the grid, retired controls removed, manual entry blocked', async ({ page }) => {
  await page.goto('/');
  for (const label of optionLabels) await expect(page.getByLabel(label, { exact: true })).toBeChecked();
  for (const text of ['SUDOKU STUDIO', 'YOUR CANVAS · 9 × 9', 'THE TOOLKIT', 'Give me a hint']) await expect(page.getByText(text, { exact: false })).toHaveCount(0);
  await expect(page.locator('.intro, #keypad, [data-tool], .solver-card, .rules, #check, #variant-rules')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Puzzle check', exact: true })).toHaveCount(0);
  const options = await page.locator('.settings-card').boundingBox(), board = await page.locator('#board').boundingBox();
  expect(options!.y + options!.height).toBeLessThan(board!.y);
  const before = await page.locator('.cell').allTextContents();
  for (const c of [0, 2]) {
    await page.locator(`[data-cell="${c}"]`).click();
    for (const k of ['9', '0', 'Delete', 'Backspace', 'Shift+2', 'Control+3']) await page.keyboard.press(k);
  }
  await expect(page.locator('.cell')).toHaveText(before);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});
test('generates symmetric puzzles and reveals/hides without modifying the puzzle', async ({ page }) => {
  test.setTimeout(60000); await page.goto('/');
  for (const variant of ['Thermo', 'Slow Thermo']) {
    await page.getByRole('button', { name: variant, exact: true }).click(); await generate(page);
    const p = await exported(page), before = await page.locator('.cell').allTextContents();
    for (const t of p.thermos as number[][]) {
      expect(t.length).toBeGreaterThanOrEqual(3);
      expect(p.thermos).toContainEqual(t.map(c => 80 - c));
      for (const c of t) expect(p.givens[c]).toBe(0);
    }
    p.givens.forEach((d: number, c: number) => expect(!!d).toBe(!!p.givens[80 - c]));
    expect(new Set(p.thermos.flat()).size).toBe(p.thermos.flat().length);
    const board = await page.locator('#board').boundingBox(), actions = await page.locator('#grid-actions').boundingBox();
    expect(actions!.y).toBeGreaterThan(board!.y + board!.height);
    await page.getByRole('button', { name: 'Reveal solution', exact: true }).click();
    await expect(page.locator('#filled')).toContainText('81 / 81');
    const solution = (await page.locator('.cell').allTextContents()).map(Number);
    if (variant === 'Slow Thermo') expect(p.thermos.some((t: number[]) => t.some((c, i) => i > 0 && solution[c] === solution[t[i - 1]]))).toBe(true);
    expect(await exported(page)).toEqual(p);
    await page.getByRole('button', { name: 'Hide solution', exact: true }).click();
    await expect(page.locator('.cell')).toHaveText(before);
    await page.reload(); await expect(page.locator('.cell')).toHaveText(before);
  }
});
test('thermometer symmetry preference persists and the six-stage report fits mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByLabel('Rotationally symmetric thermometers', { exact: true }).uncheck(); await page.reload();
  await expect(page.getByLabel('Rotationally symmetric thermometers', { exact: true })).not.toBeChecked();
  await generate(page);
  const p = await exported(page);
  expect(p).toMatchObject({ symmetricGivens: true, symmetricThermos: false, noOverlap: true, noThermoGivens: true });
  expect(p.thermos.length).toBeGreaterThanOrEqual(6);
  await expect(page.locator('#stat-givens')).toHaveText(String(p.givens.filter(Boolean).length));
  await expect(page.locator('#stat-thermos')).toHaveText(String(p.thermos.length));
  await expect(page.locator('#stat-occupied')).toHaveText(String(new Set(p.thermos.flat()).size));
  await expect(page.locator('#stat-time')).toContainText('s');
  await expect(page.locator('#difficulty')).toContainText('estimated');
  await expect(page.locator('#dig-summary')).toContainText('No remaining rotational pair');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const options = await page.locator('.settings-card').boundingBox(), board = await page.locator('#board').boundingBox();
  expect(options!.y + options!.height).toBeLessThan(board!.y);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});
test('walkthrough navigates from original puzzle to full solution without editing it', async ({ page }) => {
  await page.goto('/'); await generate(page);
  const original = await exported(page), before = await page.locator('.cell').allTextContents();
  await page.getByRole('button', { name: 'View solution walkthrough' }).click();
  await expect(page.locator('#slide-title')).toHaveText('Starting puzzle');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('#technique-tallies tbody tr').first()).toBeVisible();
  const tallyBefore = await page.locator('#technique-tallies').textContent();
  await expect(page.locator('#slide-prev')).toBeDisabled();
  await expect(page.locator('#board .pencil').first()).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('#slide-count')).toContainText('Slide 2');
  await page.getByRole('button', { name: 'Previous step' }).click();
  await expect(page.locator('#slide-title')).toHaveText('Starting puzzle');
  await page.getByRole('button', { name: 'Completed grid', exact: true }).click();
  await expect(page.locator('#slide-title')).toHaveText('Puzzle complete');
  await expect(page.locator('#filled')).toContainText('81 / 81');
  await expect(page.locator('#slide-next')).toBeDisabled();
  await page.getByLabel('Solution step', { exact: true }).fill('1');
  await expect(page.locator('#slide-count')).toContainText('Slide 2');
  await page.locator('#walkthrough-panel').screenshot({ path: 'test-results/walkthrough.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('#slide-count')).toContainText('Slide 3');
  expect(await page.locator('#walkthrough-panel').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const walkGrid = await page.locator('#board').boundingBox(), lastCell = await page.locator('#board .cell').last().boundingBox();
  expect(lastCell!.y + lastCell!.height).toBeLessThanOrEqual(walkGrid!.y + walkGrid!.height);
  await page.locator('#walkthrough-panel').screenshot({ path: 'test-results/walkthrough-mobile.png' });
  expect(await page.locator('#technique-tallies').textContent()).toBe(tallyBefore);
  await page.getByRole('button', { name: 'Close walkthrough' }).click();
  await expect(page.locator('#walkthrough-panel')).not.toBeVisible();
  expect(await exported(page)).toEqual(original);
  await expect(page.locator('.cell')).toHaveText(before);
  await page.screenshot({ path: 'test-results/report.png', fullPage: true });
});
test('copies a real PNG and uses a download when clipboard access fails', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']); await page.goto('/'); await generate(page);
  await page.getByRole('button', { name: 'Copy grid as an image' }).click();
  await expect(page.locator('#status-title')).toHaveText('Grid image copied.');
  const image = await page.evaluate(async () => {
    const items = await navigator.clipboard.read(), blob = await items[0].getType('image/png');
    const bitmap = await createImageBitmap(blob);
    return { type: blob.type, size: blob.size, width: bitmap.width, height: bitmap.height };
  });
  expect(image).toMatchObject({ type: 'image/png', width: 904, height: 904 }); expect(image.size).toBeGreaterThan(1000);
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'write', { value: () => Promise.reject(new Error('denied')), configurable: true }); });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Copy grid as an image' }).click();
  expect((await download).suggestedFilename()).toBe('thermo-sudoku.png');
  await expect(page.locator('#status-title')).toHaveText('Grid image downloaded.');
});
test('invalid imports preserve the puzzle and solution does not survive replacement', async ({ page }) => {
  await page.goto('/'); const before = await page.locator('.cell').allTextContents();
  await page.getByRole('button', { name: 'Import', exact: false }).click();
  await page.locator('#puzzle-json').fill('{"version":1}'); await page.locator('#load-json').click();
  await expect(page.locator('#import-error')).not.toBeEmpty(); await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.cell')).toHaveText(before);
  await page.getByRole('button', { name: 'Reveal solution', exact: true }).click(); await expect(page.locator('#filled')).toContainText('81 / 81');
  await generate(page); await expect(page.getByRole('button', { name: 'Reveal solution', exact: true })).toBeVisible();
  await expect(page.locator('#filled')).not.toContainText('81 / 81');
});

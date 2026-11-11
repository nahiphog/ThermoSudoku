import { expect, test } from '@playwright/test';

test('authoring, diagonal paths, undo, import, persistence and solving', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.cell')).toHaveCount(81);
  await page.getByRole('button', { name: 'New puzzle' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Thermometer', exact: true }).click();
  for (const i of [0, 10, 20]) await page.locator(`[data-cell="${i}"]`).click();
  await page.getByRole('button', { name: 'Finish thermometer' }).click();
  await expect(page.locator('#thermos circle')).toHaveCount(1);
  await expect(page.locator('#thermos polyline')).toHaveAttribute('points', '50,50 150,150 250,250');
  await page.getByRole('button', { name: 'Undo', exact: false }).click();
  await expect(page.locator('#thermos circle')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: false }).click();
  await expect(page.locator('#thermos circle')).toHaveCount(1);
  await page.reload(); await expect(page.locator('#thermos circle')).toHaveCount(1);
  await page.getByRole('button', { name: 'Import', exact: false }).click();
  await page.locator('#puzzle-json').fill('{"version":1}'); await page.locator('#load-json').click();
  await expect(page.locator('#import-error')).not.toBeEmpty(); await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Load example' }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Check puzzle' }).click();
  await expect(page.locator('#status-title')).toHaveText('Exactly one solution.');
  await page.getByRole('button', { name: 'Give me a hint' }).click();
  await expect(page.locator('#status-title')).toContainText(/SINGLE|HOUSE/);
  await page.getByRole('button', { name: 'Solve puzzle', exact: true }).click();
  await expect(page.locator('#filled')).toContainText('81 / 81'); await expect(page.locator('.conflict')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('drag drawing, erase and mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'New puzzle' }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Thermometer', exact: true }).click();
  await page.locator('#board').scrollIntoViewIfNeeded();
  const a = await page.locator('[data-cell="0"]').boundingBox(), b = await page.locator('[data-cell="10"]').boundingBox();
  await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2); await page.mouse.down();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, { steps: 8 }); await page.mouse.up();
  await expect(page.locator('#thermos circle')).toHaveCount(1);
  await page.getByRole('button', { name: 'Erase thermo', exact: true }).click(); await page.locator('[data-cell="10"]').click();
  await expect(page.locator('#thermos circle')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('compact maker blocks manual digit and pencil-mark input', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 }); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Solve & play' })).toHaveCount(0);
  await expect(page.locator('.intro')).toHaveCount(0);
  await expect(page.getByText('A CLASSIC, WITH A TWIST')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Given digits' })).toHaveCount(0);
  await expect(page.locator('#keypad')).toHaveCount(0);
  const before = await page.locator('.cell').allTextContents();
  for (const cell of [0, 2]) {
    await page.locator('[data-cell="' + cell + '"]').click();
    for (const key of ['1', '9', '0', 'Delete', 'Backspace', 'Shift+2', 'Control+3', 'Alt+4']) await page.keyboard.press(key);
  }
  await expect(page.locator('.cell')).toHaveText(before);
  await expect(page.locator('.pencil')).toHaveCount(0);
  await page.getByLabel('Show candidates').check();
  const autoCandidates = await page.locator('.cell').allTextContents();
  await page.locator('[data-cell="2"]').click();
  await page.keyboard.press('5'); await page.keyboard.press('Shift+5');
  await expect(page.locator('.cell')).toHaveText(autoCandidates);
  await page.getByLabel('Show candidates').uncheck();
  await page.reload();
  await expect(page.locator('.cell')).toHaveText(before);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});

test('generates both variants, persists options, and exports a repeated slow solution', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  await expect(page.getByLabel('No givens on thermometers')).toBeChecked();
  for (const variant of ['Thermo', 'Slow Thermo']) {
    await page.getByRole('button', { name: variant, exact: true }).click();
    await page.getByRole('button', { name: 'Generate puzzle', exact: true }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('#status-title')).toHaveText('A new puzzle, with one solution.', { timeout: 15000 });
    await page.getByRole('button', { name: 'Export' }).click();
    const p = JSON.parse(await page.locator('#puzzle-json').inputValue());
    expect(p.variant).toBe(variant === 'Thermo' ? 'thermo' : 'slow');
    for (const c of p.thermos.flat()) expect(p.givens[c]).toBe(0);
    await page.getByRole('button', { name: 'Close dialog' }).click();
  }
  await page.getByRole('button', { name: 'Solve puzzle', exact: true }).click();
  await expect(page.locator('#filled')).toContainText('81 / 81');
  await page.getByRole('button', { name: 'Export' }).click();
  const solved = JSON.parse(await page.locator('#puzzle-json').inputValue());
  expect(solved.thermos.some((t: number[]) => t.some((c, i) => i > 0 && solved.values[c] === solved.values[t[i - 1]]))).toBe(true);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByLabel('No givens on thermometers').uncheck(); await page.reload();
  await expect(page.getByLabel('No givens on thermometers')).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Slow Thermo', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

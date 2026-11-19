import { expect, test } from '@playwright/test';

test('Custom Build draws and saves branches for every variant and exports shared rules', async ({ page }) => {
  await page.goto('/?page=custom-build');
  await page.locator('#custom-branching').check();
  await page.locator('#custom-board [data-cell="20"]').click();
  await page.locator('#custom-board [data-cell="30"]').click();
  await page.locator('#custom-finish').click();
  await page.getByRole('button', { name: 'Add branch to thermo 1', exact: true }).click();
  await page.locator('#custom-board [data-cell="21"]').click();
  await page.locator('#custom-finish').click();
  await expect(page.locator('#custom-board polyline')).toHaveCount(2);
  await expect(page.locator('#custom-board circle')).toHaveCount(1);
  for (const name of ['Slow Thermo', 'Missing Thermometer', 'Thermo']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('#custom-board circle')).toHaveCount(name === 'Missing Thermometer' ? 0 : 1);
  }
  await page.locator('#custom-export').click();
  await expect(page.locator('#custom-string')).toHaveValue(/^TS2\|T\|0{81}\|3344;3334$/);
  await page.reload();
  await expect(page.locator('#custom-branching')).toBeChecked();
  await expect(page.locator('#custom-board polyline')).toHaveCount(2);
  await page.locator('#custom-build').click();
  await expect(page.locator('#custom-status')).toContainText('exactly one solution', { timeout: 35000 });
  await expect(page.locator('#custom-board circle')).toHaveCount(1);
});

test('Generate and Simulation build shared-bulb layouts', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.locator('#branching').check();
  await page.locator('#symmetric-thermos').uncheck();
  await page.locator('#thermo-lengths').fill('3,3');
  await page.locator('#generate').click();
  await expect(page.locator('#generation-stats')).toBeVisible({ timeout: 45000 });
  await expect(page.locator('#thermos polyline')).toHaveCount(2);
  await expect(page.locator('#thermos circle')).toHaveCount(1);
  await page.locator('#branching').uncheck();
  await expect(page.locator('#generation-stats')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('thermo-studio-v1')!).branching)).toBe(true);
  await page.goto('/?page=simulation');
  await page.locator('#sim-branching').check();
  await page.locator('#sim-symmetric-thermos').uncheck();
  await page.locator('#sim-thermo-lengths').fill('3,3');
  await page.locator('#sim-trials').selectOption('1');
  await page.locator('#sim-threshold').selectOption('0');
  await page.locator('#sim-start').click();
  await expect(page.locator('#sim-status')).toHaveText('Simulation complete.', { timeout: 45000 });
  await expect(page.locator('#sim-results polyline')).toHaveCount(2);
  await expect(page.locator('#sim-results circle')).toHaveCount(1);
});

test('fixed branch counts validate groups, persist and reach both generation workers', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  const count = page.locator('#branches-per-bulb');
  await expect(count).toBeDisabled();
  await page.locator('#branching').check();
  await count.selectOption('3');
  await page.locator('#thermo-lengths').fill('3,3,3,3');
  await expect(page.locator('#generation-error')).toContainText('multiple of 6');
  await expect(page.locator('#generate')).toBeDisabled();
  await page.locator('#symmetric-thermos').uncheck();
  await page.locator('#thermo-lengths').fill('3,3,3');
  await page.locator('#generate').click();
  await expect(page.locator('#generation-stats')).toBeVisible({ timeout: 45000 });
  await expect(page.locator('#thermos polyline')).toHaveCount(3);
  await expect(page.locator('#thermos circle')).toHaveCount(1);
  await count.selectOption('4');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('thermo-studio-v1')!).branchesPerBulb)).toBe(3);
  await page.reload();
  await expect(count).toHaveValue('4');
  await page.goto('/?page=simulation');
  await expect(page.locator('#sim-branches-per-bulb')).toBeDisabled();
  await page.locator('#sim-branching').check();
  await page.locator('#sim-branches-per-bulb').selectOption('4');
  await page.locator('#sim-symmetric-thermos').uncheck();
  await page.locator('#sim-trials').selectOption('1');
  await page.locator('#sim-threshold').selectOption('0');
  await page.locator('#sim-start').click();
  await expect(page.locator('#sim-status')).toHaveText('Simulation complete.', { timeout: 45000 });
  await expect(page.locator('#sim-results polyline')).toHaveCount(4);
  await expect(page.locator('#sim-results circle')).toHaveCount(1);
});

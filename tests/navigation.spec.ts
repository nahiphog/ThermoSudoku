import { expect, test } from '@playwright/test';
test('Generate exact lengths and centered navigation work on desktop and mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#status')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Generate', exact: true })).toBeVisible();
  await page.locator('#thermo-lengths').fill('4,4,4,5');
  await expect(page.locator('#generation-error')).toContainText('each length an even number');
  await page.locator('#symmetric-thermos').uncheck();
  await expect(page.locator('#generate')).toBeEnabled();
  await expect(page.locator('#thermometer-count, #min-thermo-length')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#thermo-lengths')).toHaveValue('4,4,4,5');
  await page.locator('#thermo-lengths').fill('4,,5');
  await expect(page.locator('#generate')).toBeDisabled();
  await page.locator('#thermo-lengths').fill('');
  await expect(page.locator('#generate')).toBeEnabled();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const brand = await page.locator('.brand').boundingBox();
    expect(Math.abs(brand!.x + brand!.width / 2 - width / 2)).toBeLessThan(2);
    await page.locator('#page-menu summary').click();
    await page.getByRole('link', { name: 'Techniques', exact: true }).click();
    await expect(page).toHaveURL(/page=techniques$/);
    await expect(page.getByRole('heading', { name: 'Techniques', exact: true })).toBeVisible();
    const scores = (await page.locator('.technique-catalog tbody td:first-of-type').allTextContents()).map(Number);
    expect(scores).toHaveLength(28);
    expect(scores).toEqual([...scores].sort((a,b) => a-b));
    await expect(page.locator('.technique-catalog tbody tr').last()).toContainText('Brute force');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `test-results/techniques-${width}.png`, fullPage: true});
    await page.locator('#page-menu summary').click();
    await page.getByRole('link', { name: 'Generate', exact: true }).click();
  }
  await page.goto('/?page=techniques');
  await page.reload();
  await expect(page.locator('#techniques-page')).toBeVisible();
});

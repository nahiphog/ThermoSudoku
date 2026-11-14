import { expect, type Page } from '@playwright/test';

export async function checkTallyLinks(page: Page, table: string, range: string, title: string, board: string) {
  const rows = page.locator(`${table} tbody tr`);
  for (let i = 0; i < await rows.count(); i++) {
    const row = rows.nth(i), name = await row.locator('th').innerText();
    const count = Number((await row.locator('.technique-uses').innerText()).split(' ')[0]);
    const buttons = row.locator('.technique-step');
    await expect(buttons).toHaveCount(count);
    const numbers = (await buttons.allTextContents()).map(Number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    const button = buttons.last(), step = Number(await button.innerText());
    await page.locator(range).fill(String(step - 1));
    const expectedGrid = await page.locator(`${board} .cells`).innerHTML();
    await page.locator(range).fill('0');
    await button.focus(); await button.press('Enter');
    await expect(page.locator(range)).toHaveValue(String(step - 1));
    await expect(page.locator(title)).toHaveText(name);
    expect(await page.locator(`${board} .step-reason`).count()).toBeGreaterThan(0);
    expect(await page.locator(`${board} .cells`).innerHTML()).toBe(expectedGrid);
  }
  await page.locator(range).fill('0');
}

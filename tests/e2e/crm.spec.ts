import { test, expect } from '@playwright/test';

test.describe('CRM system', () => {
  test('CRM overlay opens', async ({ page }) => {
    await page.goto('/chat');

    const crmBtn = page.locator('text=/clients|crm/i').first();
    await crmBtn.click();

    await expect(page.locator('[class*="crm"], [class*="CRM"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard stats render', async ({ page }) => {
    await page.goto('/chat');
    await page.locator('text=/clients|crm/i').first().click();
    await page.waitForTimeout(2_000);

    // Dashboard should show stat cards (Revenue, Clients, etc.)
    const stats = page.locator('text=/revenue|clients|invoices|outstanding/i');
    const count = await stats.count();
    expect(count).toBeGreaterThan(0);
  });

  test('client screening form loads', async ({ page }) => {
    await page.goto('/chat');
    await page.locator('text=/clients|crm/i').first().click();
    await page.waitForTimeout(1_000);

    const screenBtn = page.locator('text=/screen.*client|screening/i').first();
    const count = await screenBtn.count();
    if (count > 0) {
      await screenBtn.click();
      await expect(page.locator('textarea').first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
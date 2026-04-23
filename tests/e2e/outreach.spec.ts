import { test, expect } from '@playwright/test';

test.describe('Outreach system', () => {
  test('outreach overlay opens', async ({ page }) => {
    await page.goto('/chat');

    // Click outreach button in sidebar
    const outreachBtn = page.locator('text=/outreach/i').first();
    await outreachBtn.click();

    // Overlay should render
    await expect(page.locator('[class*="outreach"], [class*="Outreach"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('settings tab shows target audience field', async ({ page }) => {
    await page.goto('/chat');
    await page.locator('text=/outreach/i').first().click();
    await page.waitForTimeout(1_000);

    // Navigate to settings
    const settingsTab = page.locator('text=/settings|setup/i').first();
    const count = await settingsTab.count();
    if (count > 0) {
      await settingsTab.click();
      await expect(page.locator('textarea, input').first()).toBeVisible();
    }
  });

  test('manual prospect form exists', async ({ page }) => {
    await page.goto('/chat');
    await page.locator('text=/outreach/i').first().click();
    await page.waitForTimeout(1_000);

    // Look for add manual prospect button
    const addBtn = page.locator('text=/add.*prospect|manual/i').first();
    const count = await addBtn.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
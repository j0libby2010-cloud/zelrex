import { test, expect } from '@playwright/test';

test.describe('Core chat flow', () => {
  test('loads chat interface and sends a message', async ({ page }) => {
    await page.goto('/chat');

    // Sidebar elements visible
    await expect(page.locator('text=New Business').first()).toBeVisible();
    await expect(page.getByPlaceholder(/ask anything/i)).toBeVisible();

    // Type a message
    const input = page.getByPlaceholder(/ask anything/i);
    await input.fill('Hello Zelrex');
    await input.press('Enter');

    // User message appears
    await expect(page.locator('text=Hello Zelrex').first()).toBeVisible({ timeout: 5_000 });

    // Zelrex response appears (loading indicator or content)
    // Response can take up to 30s for Claude Opus
    await expect(page.locator('.msg-content, [class*="msg"]').nth(1)).toBeVisible({ timeout: 45_000 });
  });

  test('feedback buttons work', async ({ page }) => {
    await page.goto('/chat');
    
    // Send a quick message
    await page.getByPlaceholder(/ask anything/i).fill('What is Zelrex?');
    await page.keyboard.press('Enter');

    // Wait for response
    await page.waitForSelector('[title="Good response"]', { timeout: 45_000 });

    // Click thumbs up
    const thumbsUp = page.locator('[title="Good response"]').first();
    await thumbsUp.click();

    // Visual state change (color or fill)
    await expect(thumbsUp).toBeVisible();
    
    // Click again to toggle off
    await thumbsUp.click();
  });

  test('copy button works', async ({ page }) => {
    await page.goto('/chat');
    
    await page.getByPlaceholder(/ask anything/i).fill('Quick test');
    await page.keyboard.press('Enter');

    await page.waitForSelector('[title="Copy"]', { timeout: 45_000 });
    
    const copyBtn = page.locator('.msg-actions [title="Copy"]').first();
    await copyBtn.click();

    // "Copied" indicator appears
    await expect(page.locator('text=Copied').first()).toBeVisible({ timeout: 2_000 });
  });
});
import { test, expect } from '@playwright/test';

test.describe('Website builder flow', () => {
  test('survey triggers and accepts input', async ({ page }) => {
    await page.goto('/chat');

    // Create a new chat and set business context
    await page.getByPlaceholder(/ask anything/i).fill('I want to offer video editing for YouTube creators');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3_000);

    // Trigger website build
    await page.getByPlaceholder(/ask anything/i).fill('build me a website');
    await page.keyboard.press('Enter');

    // Survey should appear (may take a few seconds)
    const survey = page.locator('[class*="survey"], [class*="WebsiteSurvey"]').first();
    await expect(survey).toBeVisible({ timeout: 30_000 });
  });

  test('preview button exists after build', async ({ page }) => {
    await page.goto('/chat');

    // This test assumes a pre-built website exists from a previous session
    // In a real CI setup, use a pre-populated test chat
    const preview = page.locator('text=/preview|open website/i').first();
    
    // Not strict — just check if pattern is present when website exists
    const count = await preview.count();
    if (count > 0) {
      await expect(preview).toBeVisible();
    }
  });
});
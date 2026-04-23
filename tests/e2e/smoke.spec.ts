import { test, expect } from '@playwright/test';

test.describe('Smoke tests — pages load without errors', () => {
  test('/chat loads', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    
    await page.goto('/chat');
    await expect(page.locator('text=/zelrex|new business/i').first()).toBeVisible({ timeout: 15_000 });
    
    expect(errors, `Page errors: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('/contact loads', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('form, textarea').first()).toBeVisible({ timeout: 10_000 });
  });

  test('/admin loads for admin users', async ({ page }) => {
    await page.goto('/admin');
    // Either shows admin dashboard or 403
    const loaded = await page.locator('text=/admin|access denied|forbidden/i').first().isVisible({ timeout: 10_000 });
    expect(loaded).toBeTruthy();
  });

  test('settings panel opens', async ({ page }) => {
    await page.goto('/chat');
    
    const settingsBtn = page.locator('[title="Settings"], [aria-label="Settings"], text=/settings/i').first();
    await settingsBtn.click();
    
    await expect(page.locator('text=/notifications|language|preferences/i').first()).toBeVisible({ timeout: 5_000 });
  });

  test('no console errors on /chat', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/chat');
    await page.waitForTimeout(3_000);

    // Filter out expected/acceptable errors (Stripe widgets, Clerk dev warnings)
    const critical = errors.filter(e => 
      !e.includes('Stripe') && 
      !e.includes('Clerk') && 
      !e.includes('Development') &&
      !e.includes('Warning:')
    );

    expect(critical, `Console errors: ${critical.join(', ')}`).toHaveLength(0);
  });
});
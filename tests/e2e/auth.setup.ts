import { test as setup, expect } from '@playwright/test';
import path from 'path';

/**
 * AUTH SETUP — Signs in test user once and saves session state.
 * Subsequent tests reuse this session so we don't sign in for every test.
 * 
 * PREREQUISITE: Create a test user in Clerk dashboard:
 * - Email: test@zelrex.ai (or your test email)
 * - Password: set in TEST_USER_PASSWORD env var
 * - Allow email/password auth on this account
 */

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.test.local');
  }

  await page.goto('/sign-in');

  // Clerk sign-in form (may vary based on Clerk UI version)
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('button', { name: /continue|sign in/i }).click();

  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /continue|sign in/i }).click();

  // Wait for successful redirect to /chat
  await page.waitForURL('**/chat**', { timeout: 30_000 });
  await expect(page.locator('text=/new business/i').first()).toBeVisible({ timeout: 15_000 });

  // Save session state for reuse
  await page.context().storageState({ path: authFile });
});
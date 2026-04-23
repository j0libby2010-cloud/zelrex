import { defineConfig, devices } from '@playwright/test';

/**
 * ZELREX E2E TESTING
 * 
 * SETUP:
 * 1. npm install -D @playwright/test
 * 2. npx playwright install
 * 3. Create test user in Clerk dashboard (see tests/auth.setup.ts)
 * 4. Add test env vars to .env.test.local:
 *    TEST_USER_EMAIL=test@zelrex.ai
 *    TEST_USER_PASSWORD=your-test-password
 *    PLAYWRIGHT_BASE_URL=http://localhost:3000
 * 5. Run: npm run test:e2e
 * 
 * Add to package.json scripts:
 *   "test:e2e": "playwright test",
 *   "test:e2e:ui": "playwright test --ui",
 *   "test:e2e:debug": "playwright test --debug"
 */

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Sequential — tests share state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid rate limits
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 60_000, // 60s per test
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: 'tests/.auth/user.json',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      dependencies: ['setup'],
    },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
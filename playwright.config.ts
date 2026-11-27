import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke suite (security review 2026-11-18, Copilot finding: "CI lacks
 * meaningful end-to-end coverage").
 *
 * Two layers:
 *  - tests/e2e/public-smoke.spec.ts — runs against ANY deployed public URL
 *    (default: production). Read-only + the rate-limited public AI panel;
 *    safe to run against production on every push.
 *  - tests/e2e/staging-*.spec.ts — account-creating flows (signup,
 *    authentication, firm isolation). These run ONLY when STAGING_URL is
 *    provided, never against production. Until the staging environment
 *    exists (see staging-deploy.yml for the one-time setup) they are
 *    skipped automatically.
 *
 * Run locally:  npx playwright test
 *   PUBLIC_BASE_URL=https://practice-pro-vega.vercel.app npx playwright test
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false, // sequential: account flows must not race each other
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: process.env.PUBLIC_BASE_URL || process.env.STAGING_URL || 'https://practice-pro-vega.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Local/CI runs can point at a pre-installed Chromium (the audit
        // scripts' binary — PLAYWRIGHT_CHROMIUM_PATH) instead of downloading
        // the registry build, and the fake media stream grants the mic the
        // Vox takes need without a real device.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
                args: [
                  '--use-fake-device-for-media-stream',
                  '--use-fake-ui-for-media-stream',
                  '--autoplay-policy=no-user-gesture-required',
                ],
              },
            }
          : {}),
      },
    },
  ],
});

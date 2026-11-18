import { expect, test } from '@playwright/test';

/**
 * STAGING-ONLY auth smoke (security review 2026-11-18: "add automated
 * smoke coverage for signup/onboarding, authentication, and firm
 * isolation — against staging").
 *
 * These tests CREATE accounts and must never run against production.
 * They activate automatically once the staging environment exists and
 * STAGING_URL is set (see .github/workflows/e2e-smoke.yml and
 * staging-deploy.yml for the one-time setup). Until then they are
 * skipped — visibly, with a note.
 *
 * Signup completion (email verification codes) requires the staging seed
 * fixtures or a test mailbox; the smoke here covers the parts that can be
 * asserted without reading email: form validation, server round-trips,
 * and the auth gate. Extend with the seeded fixtures once staging exists.
 */
const STAGING_URL = process.env.STAGING_URL || '';

// Unique-enough emails per run so re-runs don't collide.
const RUN_ID = Date.now().toString(36);
const testEmail = `e2e-${RUN_ID}@staging-test.practicepro.local`;

test.describe('staging auth smoke', () => {
  // Skips every test in this block until the staging environment exists.
  test.skip(!STAGING_URL, 'STAGING_URL not set — staging pending its one-time setup (see staging-deploy.yml)');

  test('signup form validates and reaches the verification step', async ({ page }) => {
    await page.goto('/signup');

    // Fill the firm signup form (see src/components/auth/Signup.tsx).
    await page.getByPlaceholder('e.g. Adenike & Associates').fill(`E2E Firm ${RUN_ID}`);
    await page.getByPlaceholder('Full Name').fill('E2E Runner');
    await page.getByPlaceholder('Work Email').fill(testEmail);
    await page.getByPlaceholder('Password').fill('E2e-Test-Passphrase-2026!');

    await Promise.all([
      page.waitForURL(/login|verify|code/i, { timeout: 30_000 }).catch(() => {
        /* some flows keep the URL — fall through to the content check */
      }),
      page.getByRole('button', { name: /sign\s*up|continue|create/i }).first().click(),
    ]);

    // The flow must reach a verification step (6-digit code input) —
    // proving the backend round-trip (startSignup) fired.
    await expect(page.locator('body')).toContainText(/code|verify/i, { timeout: 30_000 });
  });

  test('login page gates the app', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 20_000 });
    // Navigating into the app must bounce anonymous users back to auth.
    await page.goto('/?view=matters');
    await page.waitForURL(/login|signup|\//, { timeout: 20_000 });
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 20_000 });
  });
});

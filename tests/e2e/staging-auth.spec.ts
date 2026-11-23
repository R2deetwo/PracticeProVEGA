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
 * 2026-11-23 FIX (before the STAGING_URL secret was ever set): the CI
 * workflow exports BOTH PUBLIC_BASE_URL (production) and STAGING_URL, and
 * playwright.config.ts resolves baseURL as PUBLIC_BASE_URL || STAGING_URL
 * — so with both set, these account-creating tests would have run against
 * PRODUCTION. The suite now pins its own baseURL to STAGING_URL (and
 * refuses to run if STAGING_URL points at the production origin).
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

  // Hard safety rail: these tests create accounts — if STAGING_URL was
  // misconfigured to the production origin, refuse to run at all.
  const pointsAtProduction = /^https:\/\/practice-pro-vega\.vercel\.app\/?$/i.test(STAGING_URL);
  test.skip(pointsAtProduction, 'STAGING_URL points at PRODUCTION — account-creating tests refuse to run there');

  // Pin this suite to the staging origin, never the workflow's
  // PUBLIC_BASE_URL (which is production in CI).
  if (STAGING_URL) test.use({ baseURL: STAGING_URL });

  // The public site serves EVERY anonymous URL (there is no /signup or
  // /login route) — auth opens as a MODAL from the product pages. The
  // cookie/terms overlays are pre-accepted so they can never intercept
  // the click (the established QA pattern).
  async function openAuthModal(page: import('@playwright/test').Page, which: 'signup' | 'login') {
    await page.addInitScript(() => {
      localStorage.setItem('practicepro_cookie_consent', 'true');
      localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
      localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
    });
    await page.goto('/vega');
    await page
      .getByRole('button', { name: which === 'signup' ? 'Start Free Trial' : 'Log In' })
      .first()
      .click();
  }

  test('signup form validates and reaches the verification step', async ({ page }) => {
    await openAuthModal(page, 'signup');

    // Fill the signup form (see src/components/auth/Signup.tsx — the
    // product is preselected by the Vega opener, so the form shows
    // directly; the firm name arrives later, in the onboarding wizard).
    await page.getByPlaceholder('Full Name').fill('E2E Runner');
    await page.getByPlaceholder('Work Email').fill(testEmail);
    await page.getByPlaceholder('Password').fill('E2e-Test-Passphrase-2026!');
    await page.locator('#terms').check();
    await page.locator('#privacy').check();
    await page.getByRole('button', { name: /create account/i }).first().click();

    // The flow must reach the verification step (the 6-digit code input)
    // — proving the backend round-trip (startSignup) fired on staging.
    await expect(page.locator('body')).toContainText('6-digit code', { timeout: 30_000 });
  });

  test('login modal opens with the auth gate; the app stays closed to anonymous visitors', async ({ page }) => {
    await openAuthModal(page, 'login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 20_000 });

    // The authenticated app is unreachable without a session: every
    // anonymous URL serves the public hub (the SPA has no app routes) —
    // an in-app view request lands on the public hero, never app chrome.
    await page.goto('/?view=matters');
    await expect(
      page.getByRole('heading', { name: /We design, build, and run custom business solutions/i }),
    ).toBeVisible({ timeout: 20_000 });
  });
});

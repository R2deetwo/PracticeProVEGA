import { expect, test } from '@playwright/test';

/**
 * Login-modal speed + welcome-email deep links (2026-11-25), the live-issue
 * regression suite:
 *
 *   1. Clicking "Log In" on /vega (and /atrium) must render the full login
 *      form IMMEDIATELY — the auth modals are eagerly bundled in the entry
 *      chunk, so opening login performs NO network fetch. The reported bug
 *      was a three-bar skeleton shown for ~5-10 seconds (the lazy
 *      Login-chunk fetch on a mobile network) before "Log in to Vega"
 *      appeared. The 2-second waitFor below is the assertion: the stalled
 *      build could not pass it.
 *   2. The themed login header carries NO duplicate uppercase microlabel
 *      ("LEGAL WORKFLOW AUTOMATION") under the product tagline.
 *   3. The welcome email's unified CTA destination (/?app=vega&login=vega,
 *      resp. Atrium) auto-opens the product-scoped login modal, and the
 *      param is consumed (stripped) after mount.
 *
 * Read-only + anonymous: no account is created and no mutation is fired.
 */

test('login modal on /vega opens instantly with the full form', async ({ page }) => {
  await page.goto('/vega');

  const loginButton = page.getByRole('button', { name: 'Log In' }).first();
  await loginButton.waitFor({ state: 'visible', timeout: 20_000 });
  await loginButton.click();

  // THE speed gate: the email field must be visible within 2s of the
  // click. The eager-bundled form renders in the same frame; the retired
  // lazy-chunk build sat on a skeleton for 5-10s on mobile networks.
  const email = page.locator('input#email[type="email"]');
  await email.waitFor({ state: 'visible', timeout: 2_000 });

  // The themed header + the whole form.
  await expect(page.getByRole('heading', { name: 'Log in to Vega' })).toBeVisible();
  await expect(page.getByText('Legal workflow automation for Nigerian law firms.')).toBeVisible();
  await expect(page.locator('input#password_login')).toBeVisible();
  await expect(page.getByText('Remember me')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  // No duplicate uppercase microlabel INSIDE the modal. (Scoped to the
  // dialog: the /vega hero band legitimately renders a CSS-uppercased
  // "LEGAL WORKFLOW AUTOMATION" kicker behind the modal — page copy,
  // not the login modal's duplicate line that was reported inside it.)
  const dialogText = await page.getByRole('dialog').innerText();
  expect((dialogText.match(/LEGAL WORKFLOW AUTOMATION/g) || []).length).toBe(0);
  expect((dialogText.match(/Legal workflow automation for Nigerian law firms\./g) || []).length).toBe(1);
});

test('login modal on /atrium opens instantly with the full form', async ({ page }) => {
  await page.goto('/atrium');

  const loginButton = page.getByRole('button', { name: 'Log In' }).first();
  await loginButton.waitFor({ state: 'visible', timeout: 20_000 });
  await loginButton.click();

  const email = page.locator('input#email[type="email"]');
  await email.waitFor({ state: 'visible', timeout: 2_000 });

  await expect(page.getByRole('heading', { name: 'Log in to Atrium' })).toBeVisible();
  await expect(page.getByText('The Well-Kept Estate — built by PracticePro.')).toBeVisible();
  await expect(page.locator('input#password_login')).toBeVisible();
  // No duplicate uppercase microlabel inside the modal (page kickers
  // behind it are out of scope — see the /vega note above).
  const dialogText = await page.getByRole('dialog').innerText();
  expect((dialogText.match(/PROPERTY MANAGEMENT OS/g) || []).length).toBe(0);
  expect((dialogText.match(/The Well-Kept Estate — built by PracticePro\./g) || []).length).toBe(1);
});

test('the welcome-email CTA deep link (?app=vega&login=vega) auto-opens the Vega login', async ({ page }) => {
  // The exact URL the redesigned welcome email's CTA button points at.
  await page.goto('/?app=vega&login=vega');

  const email = page.locator('input#email[type="email"]');
  await email.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Log in to Vega' })).toBeVisible();

  // The param is consumed on mount — it cannot re-fire the auto-open on
  // a later refresh or re-render.
  await expect
    .poll(async () => page.url(), { timeout: 10_000 })
    .not.toContain('login=');
});

test('the Atrium welcome deep link (?app=atrium&login=atrium) auto-opens the Atrium login', async ({ page }) => {
  await page.goto('/?app=atrium&login=atrium');

  const email = page.locator('input#email[type="email"]');
  await email.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Log in to Atrium' })).toBeVisible();

  await expect
    .poll(async () => page.url(), { timeout: 10_000 })
    .not.toContain('login=');
});

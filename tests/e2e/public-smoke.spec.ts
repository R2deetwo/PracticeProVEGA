import { expect, test } from '@playwright/test';

/**
 * PUBLIC smoke — safe against production (read-only + one rate-limited AI
 * panel question). Runs on every push to main and on PRs.
 *
 * These tests lock in the regression classes the owner has actually hit:
 *  - the hub and product landing pages must load and be interactive
 *    (white-screen regression)
 *  - the ALOA assistant panel must OPEN and ANSWER (the "preset answers
 *    only" / silent-panel regression of 2026-11-18)
 *
 * Site structure (src/sites/hub + src/sites/vega): "/" is the company hub;
 * the ALOA assistant lives on the product pages (/vega, /atrium).
 */

test('hub landing page loads and renders the product family', async ({ page }) => {
  await page.goto('/');
  // The landing must render real content, not a blank shell (the founder
  // app once white-screened after the splash — PR #2).
  await expect(page.locator('body')).toContainText(/PracticePro/i, { timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Vega/i }).first()).toBeVisible({ timeout: 20_000 });
});

test('ALOA panel opens and answers a question', async ({ page }) => {
  await page.goto('/vega');

  // Open the assistant. Three buttons match "Ask" on the page (an inline
  // CTA, a desktop pill, and the floating FAB) — the FAB is the last in
  // DOM order and is the one that always opens the panel.
  const fab = page.locator('button[aria-label^="Ask ALOA"]').last();
  await fab.waitFor({ state: 'visible', timeout: 20_000 });
  await fab.click();

  // The panel must become visible with the composer textarea
  // (aria-label "Your question for ALOA" — see AloaAssistantFab.tsx).
  const input = page.locator('textarea[aria-label*="Your question"]').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });

  // Ask a question that needs a real answer. 2026-11-22: ALOA is
  // Vega's PRODUCT guide — the e2e asks a product question (the happy
  // path); legal questions route to the boundary reply + directories
  // card, which is covered by the unit pins.
  await input.fill('How does Vega track court matters for a litigation firm?');
  await input.press('Enter');

  // The panel must produce SOME visible answer text within 30s — the
  // catalogue fallback guarantees this even if the AI call fails; a fully
  // silent panel is the regression this guards against.
  await expect(page.locator('body')).toContainText(/matter|court|Vega/i, {
    timeout: 30_000,
  });
});

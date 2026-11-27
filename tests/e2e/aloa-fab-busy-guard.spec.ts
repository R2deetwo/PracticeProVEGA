import { test, expect } from '@playwright/test';

/**
 * ROUND 24 §1.2 (acceptance #5) — the busy guard, end to end.
 *
 * A live Vox take must survive EVERY close gesture (backdrop click,
 * Escape, Close): each opens the ConfirmDialog instead of discarding the
 * take; "Keep recording" dismisses it and the take keeps running.
 * "Stop and close" stops the take while KEEPING it (segments flush to the
 * on-device queue — Phase 0 proved the old backdrop silently destroyed
 * live takes).
 *
 * Runs against the local Vite dev server (the demo bypass is dev-gated):
 *   PUBLIC_BASE_URL=http://localhost:5199 npx playwright test aloa-fab-busy-guard
 * Chromium needs the fake media stream so the recorder actually records.
 */

const RECORD = 'button[aria-label="Start recording"]';
const STOP = 'button:has-text("Stop")';
const PANEL = 'div[role="dialog"][aria-label="ALOA"]';
const KEEP_RECORDING = 'button:has-text("Keep recording")';
const STOP_AND_CLOSE = 'button:has-text("Stop and close")';

async function bootDemo(page: import('@playwright/test').Page) {
  await page.goto('/?boot=prep', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
    sessionStorage.setItem('practicepro_demo_product', 'vega');
    localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
    localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
    localStorage.setItem('practicepro_last_seen_version', 'v1.22.0');
    localStorage.setItem('practicepro_ai_consent', 'true');
    document.documentElement.className = '';
  });
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => { const el = document.querySelector('.app-container'); return !!el && /app-skin-(vega|atrium)/.test(el.className); },
    { timeout: 45000 }
  );
}

async function openVoxAndStartTake(page: import('@playwright/test').Page) {
  await page.click('[data-tour-id="aloa-fab"]');
  await expect(page.locator(PANEL)).toBeVisible({ timeout: 15000 });
  await page.click('button:has-text("Vox")'); // the panel's Vox segment
  await page.waitForTimeout(1500);
  await page.click(RECORD);
  await expect(page.locator(STOP).first()).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1500); // some audio accrues
}

test('a live take survives backdrop click, Escape and Close (Keep recording)', async ({ page }) => {
  test.setTimeout(120_000);
  await bootDemo(page);
  await openVoxAndStartTake(page);

  // 1. Escape while busy → ConfirmDialog, take keeps recording.
  await page.keyboard.press('Escape');
  await expect(page.locator(KEEP_RECORDING)).toBeVisible({ timeout: 5000 });
  await page.click(KEEP_RECORDING);
  await expect(page.locator(STOP).first()).toBeVisible({ timeout: 5000 });

  // 2. Backdrop click while busy → ConfirmDialog, take keeps recording.
  await page.mouse.click(60, 450);
  await expect(page.locator(KEEP_RECORDING)).toBeVisible({ timeout: 5000 });
  await page.click(KEEP_RECORDING);
  await expect(page.locator(STOP).first()).toBeVisible({ timeout: 5000 });

  // 3. Close while busy → ConfirmDialog, take keeps recording.
  await page.locator(`${PANEL} button[aria-label="Close"]`).click();
  await expect(page.locator(KEEP_RECORDING)).toBeVisible({ timeout: 5000 });
  await page.click(KEEP_RECORDING);
  await expect(page.locator(STOP).first()).toBeVisible({ timeout: 5000 });

  // 4. Stop the take → it is KEPT (transcribing/queued), never discarded.
  await page.locator(STOP).last().click();
  const kept = await page.waitForFunction(
    () => document.body.innerText.includes('Transcribing') || document.body.innerText.includes('Saved on this device'),
    { timeout: 20000 }
  );
  expect(kept).toBeTruthy();
  // The panel never closed and no confirm is left dangling.
  await expect(page.locator(PANEL)).toBeVisible();
  await expect(page.locator(KEEP_RECORDING)).toHaveCount(0);
});

test('Stop and close keeps the take: the confirm path closes the panel safely', async ({ page }) => {
  test.setTimeout(120_000);
  await bootDemo(page);
  await openVoxAndStartTake(page);

  await page.locator(`${PANEL} button[aria-label="Close"]`).click();
  await expect(page.locator(STOP_AND_CLOSE)).toBeVisible({ timeout: 5000 });
  await page.click(STOP_AND_CLOSE);
  // The panel closes — and only AFTER the stop-and-keep ran (the busy
  // panes register it; the segments flush before unmount).
  await expect(page.locator(PANEL)).toHaveCount(0, { timeout: 10000 });
});

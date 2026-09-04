/**
 * smoke-toast-hover.mjs — Round 15 browser smoke for hover-hold toasts.
 *
 * Serves the production dist/ via `vite preview` (started by the caller)
 * and verifies, end-to-end in a real browser:
 *   1. A toast dispatched via the app's `practicepro-toast` event appears.
 *   2. Hovering it holds it in place PAST its normal expiry.
 *   3. Moving the mouse away after expiry removes it gracefully.
 *   4. Control: a toast that is never hovered auto-dismisses at its normal
 *      timing (the on-screen time is unchanged, per the user spec).
 *   5. Zero console errors / page errors on boot.
 *
 * Headless Chromium may report `(hover: hover)` as false; we force it true
 * via addInitScript so the mouse path is exercised (the capability gate
 * itself is covered by unit semantics — this smoke verifies the wiring).
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4173/';
const errors = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

await page.addInitScript(() => {
  const native = window.matchMedia.bind(window);
  window.matchMedia = (q) => {
    const mql = native(q);
    if (q === '(hover: hover)') {
      try { Object.defineProperty(mql, 'matches', { value: true }); } catch {}
    }
    return mql;
  };
});

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(3000);

const hoverCapable = await page.evaluate(() => window.matchMedia('(hover: hover)').matches);
console.log('[smoke] hover capability reported:', hoverCapable);

// ── 1+2+3: hover-hold behavior ────────────────────────────────────────
await page.evaluate(() => {
  window.dispatchEvent(new CustomEvent('practicepro-toast', {
    detail: { message: 'SMOKE TOAST HOVER HOLD', options: { type: 'success', duration: 1500 } },
  }));
});
const toast = page.locator('text=SMOKE TOAST HOVER HOLD').first();
await toast.waitFor({ state: 'visible', timeout: 5000 });
console.log('[smoke] toast appeared');

await toast.hover();
await page.waitForTimeout(3000); // 1.5s past its 1500ms expiry, still hovered
const heldVisible = await toast.isVisible();
console.log('[smoke] held past expiry while hovered:', heldVisible);

await page.mouse.move(5, 5); // cursor leaves — time already expired
let removed = false;
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(250);
  if (!(await toast.isVisible().catch(() => false))) { removed = true; break; }
}
console.log('[smoke] removed gracefully on mouse-leave after expiry:', removed);

// ── 4: control — normal timing unchanged without hover ────────────────
await page.evaluate(() => {
  window.dispatchEvent(new CustomEvent('practicepro-toast', {
    detail: { message: 'SMOKE TOAST AUTO', options: { type: 'info', duration: 1200 } },
  }));
});
const t2 = page.locator('text=SMOKE TOAST AUTO').first();
await t2.waitFor({ state: 'visible', timeout: 5000 });
let autoRemoved = false;
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(250);
  if (!(await t2.isVisible().catch(() => false))) { autoRemoved = true; break; }
}
console.log('[smoke] auto-dismissed without hover (timing unchanged):', autoRemoved);

console.log('[smoke] console/page errors:', errors.length, errors.slice(0, 3));
await browser.close();

const pass = heldVisible && removed && autoRemoved && errors.length === 0;
console.log(pass ? '[smoke] ALL CHECKS PASSED' : '[smoke] FAILED');
process.exit(pass ? 0 : 1);

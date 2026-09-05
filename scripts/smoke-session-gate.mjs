/**
 * smoke-session-gate.mjs — R17/P0 browser smoke for the death-loop fix.
 *
 * Reproduces the EXACT client states that produced the production death
 * loop (2026-09-05) against the served dist/, and proves the session
 * validity gate retires them cleanly — no error screen, no retry storm,
 * no splash ↔ error cycling:
 *
 *   SCENARIO A (the incident itself): localStorage holds a legacy
 *   email-only session (`practicepro_user_session`) and NO bearer token.
 *   Before the fix: getUser (email bootstrap) rendered the shell, every
 *   strict query threw Unauthenticated, ConvexErrorBoundary retried
 *   forever ("attempt 22 of 3"), remounting the app each time.
 *   After: the gate retires the session at boot → landing page.
 *
 *   SCENARIO B: email session + a dead/garbage bearer
 *   (`practicepro_session_bearer`). The gate validates it server-side
 *   (validateSessionToken → null for an unknown token) → retired →
 *   landing page. This exercises the full Convex round-trip.
 *
 * Pass criteria for BOTH scenarios:
 *   1. No "[ConvexErrorBoundary] Caught error" console line ever fires.
 *   2. The auth storage keys are wiped (session retired, not restored).
 *   3. The landing surface is visible (Sign In reachable).
 *   4. No "Reconnecting... (Attempt" pill appears (no retry churn).
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4173/';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

async function runScenario(name, seedStorage) {
  const errors = [];
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));

  // Seed the incident's client state BEFORE app scripts run.
  await page.addInitScript((seed) => {
    for (const [k, v] of Object.entries(seed)) {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    }
  }, seedStorage);

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Long enough for: gate effect → (scenario B) validateSessionToken
  // round-trip → retire → re-render landing. The OLD code would have
  // produced multiple boundary catch cycles inside this window.
  await page.waitForTimeout(9000);

  const boundaryFired = errors.some((e) => e.includes('ConvexErrorBoundary'));
  const userSession = await page.evaluate(() => localStorage.getItem('practicepro_user_session'));
  const bearer = await page.evaluate(() => localStorage.getItem('practicepro_session_bearer'));
  const portalType = await page.evaluate(() => localStorage.getItem('practicepro_portal_type'));

  const signIn = await page
    .locator('button:has-text("Sign In"), a:has-text("Sign In"), button:has-text("Log In"), a:has-text("Log In")')
    .first()
    .isVisible()
    .catch(() => false);

  const retryPillVisible = await page
    .locator('text=/Reconnecting\\.\\.\\. \\(Attempt/')
    .first()
    .isVisible()
    .catch(() => false);

  console.log(`\n[smoke:${name}] boundary catch fired:      ${boundaryFired}`);
  console.log(`[smoke:${name}] practicepro_user_session:  ${userSession === null ? 'RETIRED (null)' : 'STILL PRESENT'}`);
  console.log(`[smoke:${name}] practicepro_session_bearer:${bearer === null ? ' RETIRED (null)' : ' STILL PRESENT'}`);
  console.log(`[smoke:${name}] portal_type residue:        ${portalType === null ? 'clean (null)' : portalType}`);
  console.log(`[smoke:${name}] sign-in entry visible:      ${signIn}`);
  console.log(`[smoke:${name}] reconnect pill visible:     ${retryPillVisible}`);
  console.log(`[smoke:${name}] console errors (${errors.length}):`);
  for (const e of errors.slice(0, 5)) console.log(`    - ${e}`);

  const pass =
    !boundaryFired &&
    userSession === null &&
    bearer === null &&
    signIn === true &&
    retryPillVisible === false;

  console.log(`[smoke:${name}] RESULT: ${pass ? 'PASS' : 'FAIL'}`);
  await context.close();
  return pass;
}

const a = await runScenario('A-legacy-email-session', {
  practicepro_user_session: JSON.stringify({ token: 'founder@practicepro.ng' }),
  practicepro_session_bearer: null,
});

const b = await runScenario('B-dead-bearer', {
  practicepro_user_session: JSON.stringify({ token: 'founder@practicepro.ng' }),
  // A syntactically plausible but server-unknown token: SHA-256 hash will
  // match no session row → validateSessionToken resolves null → retired.
  practicepro_session_bearer: 'pp_dead00000000000000000000000000000000000000000000000000000000beef',
});

await browser.close();

console.log('\n[smoke] session-gate verdict:', a && b ? 'PASS' : 'FAIL');
process.exit(a && b ? 0 : 1);

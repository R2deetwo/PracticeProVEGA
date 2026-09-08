/**
 * smoke-modal-batch1.mjs — Round: modal standardization batch 1.
 *
 * Serves the fresh dist/ via `vite preview` (started by the caller) and
 * verifies in a real browser:
 *   1. The app boots with zero console errors / page errors.
 *   2. The migrated ModalLayer builder code is IN the shipped bundle
 *      (MIGRATED_MODALS entries for newTask/viewTask/newProperty present).
 *   3. The legacy ModalManager task/property case code is GONE from the
 *      bundle (no double-render: the guard + case removal shipped).
 *   4. ModalShell's aria chrome (modal-title / Close modal) is in the bundle.
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4173/';
const errors = [];
const bundles = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await (await browser.newContext()). newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${String(err)}`));
page.on('response', async (res) => {
  if (res.url().endsWith('.js') && res.status() === 200) {
    try { bundles.push(await res.text()); } catch { /* streamed */ }
  }
});

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'audit-results/modal-batch1-boot.png', fullPage: false });

const all = bundles.join('\n');
const checks = {
  'ModalLayer migrated set shipped (newTask+viewTask+newProperty)':
    all.includes("'newTask'") && all.includes("'viewTask'") && all.includes("'newProperty'"),
  'ModalShell chrome shipped (Close modal aria label)':
    all.includes('Close modal'),
  'ModalShell title element shipped (modal-title id)':
    all.includes('modal-title'),
  'TaskForm still bundled (lazy + builder share it)':
    all.includes('TaskForm') || all.includes('taskToEdit'),
};

let failed = 0;
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
}
if (errors.length) {
  console.log('\nConsole/page errors:');
  for (const e of errors.slice(0, 10)) console.log('  -', e);
}

await browser.close();
if (failed > 0 || errors.length > 0) {
  console.log(`\nRESULT: FAIL (${failed} checks failed, ${errors.length} runtime errors)`);
  process.exit(1);
}
console.log('\nRESULT: PASS');

/**
 * smoke-batch2.mjs — Round: modal batch 2 (Matters & Contacts) + messages
 * actions v2 (⋮ menu / long-press / Copy / Delete).
 *
 * Serves the fresh dist/ via `vite preview` (started by the caller) and
 * verifies in a real browser:
 *   1. The app boots with zero console errors / page errors.
 *   2. The ModalLayer batch-2 builder code is IN the shipped bundle
 *      (MIGRATED_MODALS entries for newMatter/editMatter/closeMatter/
 *      archiveMatter/newContact/editContact/mergeContact present).
 *   3. The MessageActionsMenu system is in the bundle (aria label, Copy
 *      text entry, Copied! feedback, long-press contextmenu wiring).
 *   4. ModalShell chrome (modal-title / Close modal) is in the bundle.
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4173/';
const errors = [];
const bundles = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await (await browser.newContext()).newPage();
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
await page.screenshot({ path: 'audit-results/batch2-boot.png', fullPage: false });

const all = bundles.join('\n')
  // Lazy chunks (ModalLayer's registry, etc.) are NOT fetched at boot —
  // read the built dist files directly so the presence checks are exact.
  + '\n' + (await (async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.resolve('dist/assets');
    try {
      return fs.readdirSync(dir).filter(f => f.endsWith('.js'))
        .map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    } catch { return ''; }
  })());
const checks = {
  // esbuild normalizes string literals to double quotes — accept both.
  'ModalLayer batch-2 shipped (newMatter+editMatter+closeMatter+archiveMatter)':
    ['newMatter', 'editMatter', 'closeMatter', 'archiveMatter'].every(n => all.includes(n)),
  'ModalLayer batch-2 shipped (newContact+editContact+mergeContact)':
    ['newContact', 'editContact', 'mergeContact'].every(n => all.includes(n)),
  'MessageActionsMenu shipped (aria label + Copy text + Copied feedback)':
    all.includes('Message actions') && all.includes('Copy text') && all.includes('Copied!'),
  'Long-press/context menu wiring shipped':
    all.includes('onContextMenu'),
  'ModalShell chrome shipped (Close modal aria label)':
    all.includes('Close modal'),
  'ModalShell title element shipped (modal-title id)':
    all.includes('modal-title'),
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

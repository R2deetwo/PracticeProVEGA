/**
 * capture-editor-r78.ts — takes the landing page's new DraftPro editor
 * capture (editor-r78.jpg) from the REAL app, dev mode + demo session:
 *
 *   1. boot the dev server (npm run dev — the caller does this)
 *   2. seed the demo session (DEV-only bypass, demo@practicepro.ng) and
 *      the draft-session store with the properly-assembled Statement of
 *      Claim bundle (built by scripts/build-soc-draft.ts through the
 *      app's own assemble pipeline)
 *   3. open /editor?draftKey=…&title=… (the DraftPro tab route — splash
 *      is bypassed for draftKey tabs)
 *   4. wait for the editor + the document's centred caption to paint
 *   5. screenshot at 1440×900 @2x → public/assets/landing/app/editor-r78.jpg
 *
 * Run: npx tsx scripts/capture-editor-r78.ts  (dev server on :5173)
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.CAPTURE_BASE || 'http://localhost:5173';
const DRAFT_KEY = 'draft:general:statement-of-claim';
const FIRM_ID = 'demo-firm-id'; // AuthContext's demo Vega firm
const OUT = 'public/assets/landing/app/editor-r78.jpg';

async function main() {
  const session = readFileSync('/tmp/soc-draft-session.json', 'utf8');

  // The sandbox carries chromium-1200 (a different Playwright build than
  // the repo's test dependency) — point at it directly instead of
  // downloading a matching build.
  const EXECUTABLE = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  // Boot once logged-out (the landing), then seed the demo session +
  // the draft session, then enter the editor route.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(([firmId, draftKey, sessionJson]) => {
    sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
    sessionStorage.setItem('practicepro_demo_product', 'vega');
    localStorage.setItem(`draftpro:${firmId}:${draftKey}`, sessionJson);
  }, [FIRM_ID, DRAFT_KEY, session]);

  await page.goto(
    `${BASE}/editor?draftKey=${encodeURIComponent(DRAFT_KEY)}&title=${encodeURIComponent('Statement of Claim — Meridian Agro v. Savannah Haulage')}`,
    { waitUntil: 'domcontentloaded' },
  );

  // Wait for the editor's document: the centred court caption + the
  // underlined process title must be on screen.
  await page.waitForSelector('text=IN THE HIGH COURT OF LAGOS STATE', { timeout: 60_000 });
  await page.waitForSelector('text=STATEMENT OF CLAIM', { timeout: 30_000 });
  // Let TipTap settle (placeholder pills + fonts paint a frame later).
  await page.waitForTimeout(2500);

  // The document scrolls — the caption sits at the top of page 1. Make
  // sure the editor is scrolled to the very top so the caption, parties
  // block and title are all in frame.
  await page.evaluate(() => {
    const scroller = document.querySelector('.ProseMirror')?.closest('.overflow-y-auto, [class*="overflow"]') as HTMLElement | null;
    if (scroller) scroller.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);

  const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
  writeFileSync(OUT, buf);
  console.log('wrote', OUT, buf.length, 'bytes');

  // Also drop a DOM text sample for verification.
  const text = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log('--- page text sample ---');
  console.log(text);

  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });

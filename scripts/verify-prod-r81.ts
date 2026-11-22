/**
 * verify-prod-r81.ts — production verification of the R81 round on
 * https://practice-pro-vega.vercel.app:
 *   1. the landing's Documents tab exhibits editor-r81.jpg (the re-captured
 *      parties block);
 *   2. the lightbox opens with the Fit/1:1 toggle and 1:1 renders the
 *      native 1440px frame;
 *   3. the deadlines copy states the honest coverage model;
 *   4. the editor route parses the party-row HTML (the structural parties
 *      block renders in the live product).
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE = 'https://practice-pro-vega.vercel.app';

async function main() {
  const EXECUTABLE = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1-3: the landing.
  await page.goto(BASE + '/vega', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const docTab = page.locator('button[role="tab"]', { hasText: 'Smart Documents' });
  await docTab.click();
  await page.waitForTimeout(1200);
  const editorImg = await page.locator('img[src*="editor-r8"]').first().getAttribute('src').catch(() => null);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const landing = {
    editorImg,
    honestCopy: bodyText.includes('one manual entry') || bodyText.includes('Record the service'),
    oldClaimGone: !bodyText.includes('windows are computed under the matter\u2019s court and state, with the governing'),
  };
  console.log('LANDING:', JSON.stringify(landing));

  // 2: the lightbox.
  await page.locator('button[aria-label*="Expand the"]').first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
  const fitGeo = await page.evaluate(() => {
    const frame = document.querySelector('[role="dialog"] figure > div') as HTMLElement | null;
    const toggle = document.querySelector('[role="dialog"] button[aria-pressed]');
    return { fitWidth: frame ? Math.round(frame.getBoundingClientRect().width) : null, hasToggle: !!toggle };
  });
  const toggleBtn = page.locator('[role="dialog"] button[aria-pressed]', { hasText: 'Fit' });
  await toggleBtn.click();
  await page.waitForTimeout(1200);
  const fullGeo = await page.evaluate(() => {
    const frame = document.querySelector('[role="dialog"] figure > div') as HTMLElement | null;
    const stage = document.querySelector('[role="dialog"] .overflow-auto') as HTMLElement | null;
    return {
      fullWidth: frame ? Math.round(frame.getBoundingClientRect().width) : null,
      scrollable: stage ? stage.scrollWidth > stage.clientWidth : null,
    };
  });
  console.log('LIGHTBOX:', JSON.stringify({ ...fitGeo, ...fullGeo }));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // 4: the editor route with the party-row HTML (demo session).
  const session = readFileSync('/tmp/soc-draft-session.json', 'utf8');
  await page.evaluate((sessionJson) => {
    sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
    sessionStorage.setItem('practicepro_demo_product', 'vega');
    localStorage.setItem('draftpro:demo-firm-id:draft:general:statement-of-claim', sessionJson);
  }, session);
  await page.goto(
    `${BASE}/editor?draftKey=${encodeURIComponent('draft:general:statement-of-claim')}&title=${encodeURIComponent('Statement of Claim')}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  );
  await page.waitForSelector('text=IN THE HIGH COURT OF LAGOS STATE', { timeout: 60000 });
  await page.waitForTimeout(2500);
  const editor = await page.evaluate(() => {
    const pm = document.querySelector('.ProseMirror') as HTMLElement | null;
    const pmRect = pm?.getBoundingClientRect();
    const rows = Array.from(document.querySelectorAll('.node-partyRow'));
    const suitNo = Array.from(document.querySelectorAll('.ProseMirror p')).find(p => (p.textContent || '').includes('SUIT NO'));
    const suitRect = suitNo?.getBoundingClientRect();
    const firstRow = rows[0];
    const leader = firstRow ? Array.from(firstRow.querySelectorAll('span')).find(s => s.getAttribute('aria-hidden') === 'true') : null;
    return {
      partyRowCount: rows.length,
      firstName: firstRow?.querySelector('[data-node-view-content]')?.textContent?.slice(0, 40) || null,
      suitNoRight: pmRect && suitRect ? Math.round(suitRect.right - pmRect.left) : null,
      firstLeaderRight: pmRect && leader ? Math.round(leader.getBoundingClientRect().right + 10 - pmRect.left) : null,
    };
  });
  console.log('EDITOR:', JSON.stringify(editor));
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });

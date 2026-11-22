/**
 * probe-editor-r81.ts — verifies the capture state: the editor must show
 * the assembled Statement of Claim with the STRUCTURAL party rows — the
 * designation's RIGHT edge aligned with the right-aligned SUIT NO line's
 * right edge (both within a few px), one uniform dotted leader per row,
 * BETWEEN/AND centered, the underlined process title.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE = process.env.CAPTURE_BASE || 'http://localhost:5000';
const DRAFT_KEY = 'draft:general:statement-of-claim';
const FIRM_ID = 'demo-firm-id';

async function main() {
  const session = readFileSync('/tmp/soc-draft-session.json', 'utf8');
  const EXECUTABLE = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

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

  await page.waitForSelector('text=IN THE HIGH COURT OF LAGOS STATE', { timeout: 60_000 });
  await page.waitForTimeout(2500);

  const probe = await page.evaluate(() => {
    const pm = document.querySelector('.ProseMirror') as HTMLElement | null;
    if (!pm) return { error: 'no ProseMirror' };
    const pmRect = pm.getBoundingClientRect();
    const rows = Array.from(pm.querySelectorAll('.node-partyRow'));
    const suitNo = Array.from(pm.querySelectorAll('p')).find(p => (p.textContent || '').includes('SUIT NO'));
    const suitRect = suitNo?.getBoundingClientRect();
    const rowInfo = rows.map(r => {
      const designation = (r.querySelector('input[aria-label="Party designation"]') as HTMLInputElement | null)?.value;
      const nameEl = r.querySelector('[data-node-view-content]') as HTMLElement | null;
      const leader = Array.from(r.querySelectorAll('span')).find(s => (s.getAttribute('aria-hidden') === 'true'));
      const nameRect = nameEl?.getBoundingClientRect();
      const leaderRect = leader?.getBoundingClientRect();
      return {
        designation,
        name: nameEl?.textContent?.slice(0, 45),
        nameLeft: nameRect ? Math.round(nameRect.left - pmRect.left) : null,
        designationRight: leaderRect ? Math.round(leaderRect.right + 10 - pmRect.left) : null,
        leaderWidth: leaderRect ? Math.round(leaderRect.width) : null,
        leaderStyle: leader ? getComputedStyle(leader).borderBottomStyle : null,
        rowWidth: Math.round(r.getBoundingClientRect().width),
      };
    });
    return {
      partyRowCount: rows.length,
      rows: rowInfo,
      suitNoRight: suitRect ? Math.round(suitRect.right - pmRect.left) : null,
      hasProcessTitle: !!Array.from(pm.querySelectorAll('u')).find(u => (u.textContent || '').includes('STATEMENT OF CLAIM')),
    };
  });
  console.log(JSON.stringify(probe, null, 2));
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });

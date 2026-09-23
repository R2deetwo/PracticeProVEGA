/**
 * aloa-task70-verify.cjs — E2E verification of the 2026-09-24 ALOA/DraftPro
 * polish round (user feedback round 3).
 *
 * Verifies, against a REAL browser + local Convex backend + mocked Gemini:
 *
 *  1. FULL SIGNUP E2E (Vega, Growth trial — AI unlocked) via the real UI.
 *  2. PACKET + "DRAFT ALL" FIX: asking for "the documents necessary" plans
 *     a packet; hitting "Draft all" —
 *       • opens document #1 in a named DraftPro tab (live draft),
 *       • FULLY drafts documents #2..n in the background,
 *       • rows show live visual cues (Queued → Drafting… → Drafted ✓),
 *       • the progress bar + counter appear,
 *       • clicking a "Drafted ✓" row opens the PRE-DRAFTED content
 *         instantly (no re-draft, no "Preparing your document" overlay).
 *  3. GAP CLEANUP: a deliberately gappy model draft (empty paragraphs,
 *     <br><br>, markdown bold, code fence) renders with ZERO empty
 *     paragraphs and zero <br><br> in the editor.
 *  4. PLACEHOLDER HIGHLIGHTS: placeholders render as background highlights
 *     (not text colour) — computed background non-transparent, text colour
 *     = the editor ink (#111827), so they are legible.
 *  5. NO TEXT OVERLAP: on a 3-page draft, no two top-level blocks in the
 *     editor intersect — the pagination never stacks text on text.
 *  6. WEB-RESEARCH LEARNING: planning a packet persists a scrubbed firm
 *     playbook (localStorage), retrievable for a later similar job, with
 *     no user-identifying data in it.
 *
 * Run:  node scripts/aloa-task70-verify.cjs
 * Needs: local Convex (3210) + vite dev (5000) already running.
 */
const { chromium } = require('playwright');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.E2E_BASE || 'http://localhost:5000';
const SQLITE = path.resolve(__dirname, '../.convex/local/default/convex_local_backend.sqlite3');
const SHOTS = path.resolve(__dirname, '../audit-shots/task70');
fs.mkdirSync(SHOTS, { recursive: true });

const EMAIL = `task70-${Date.now().toString(36)}@e2e.test`;
const PASSWORD = 'E2ePass!2026';

// ─── Results tracking ────────────────────────────────────────────────────────
const results = [];
const check = (name, ok, extra = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
};
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false }).catch(() => {});

// ─── The three packet documents ──────────────────────────────────────────────
const DOCS = [
    { name: 'Notice to Quit', marker: 'E2E-MARKER-DOC-0-NOTICE-TO-QUIT' },
    { name: "Notice of Owner's Intention to Recover Possession", marker: 'E2E-MARKER-DOC-1-OWNERS-INTENTION' },
    { name: 'Writ of Summons', marker: 'E2E-MARKER-DOC-2-WRIT-OF-SUMMONS' },
];

/** A deliberately MESSY draft: code fence, empty paragraphs, <br><br>,
 *  markdown bold, [PLACEHOLDERS]. The client-side pipeline must clean it. */
function messyDraftHtml(docIndex) {
    const doc = DOCS[docIndex];
    const paras = [];
    // Long enough (doc 0) to force multi-page pagination and test overlap.
    const bodyParas = docIndex === 0 ? 46 : 9;
    paras.push('```html');
    paras.push('<p style="text-align: right;"><strong>[DATE]</strong></p>');
    paras.push('<p></p>');
    paras.push(`<p>Re: Recovery of possession — ${doc.name}. This draft carries marker ${doc.marker}.</p>`);
    paras.push('<p>&nbsp;</p>');
    paras.push('<p>Dear Sir/Madam,<br><br>We act as Solicitors to [CLIENT NAME] of [CLIENT ADDRESS].</p>');
    paras.push('<p>**This bold sentence arrives as markdown** and must render as bold.</p>');
    for (let i = 1; i <= bodyParas; i++) {
        paras.push(`<p>${i}. That the tenant [TENANT NAME] has occupied the premises at [PROPERTY ADDRESS] since [DATE], and the annual rent of [RENT AMOUNT] is in arrears. This is substantive paragraph ${i} of the ${doc.name}, included so the document spans enough pages to exercise the auto-pagination pass.</p>`);
        if (i % 7 === 0) paras.push('<p><br></p>');
    }
    paras.push('<p style="text-align: center;"><strong>BEFORE ME,</strong></p>');
    paras.push('<p></p>');
    paras.push('<p style="text-align: center;">_______________________________</p>');
    paras.push('<p style="text-align: center;"><strong>COMMISSIONER FOR OATHS</strong></p>');
    paras.push('```');
    return paras.join('\n');
}

// ─── SSE chunk helpers ───────────────────────────────────────────────────────
function sseBody(objs) {
    return objs.map(o => `data: ${JSON.stringify(o)}\n\n`).join('');
}
const textChunk = (text, finish) => ({
    candidates: [{ content: { parts: [{ text }] }, ...(finish ? { finishReason: 'STOP' } : {}) }],
});

// ─── Gemini mock state ───────────────────────────────────────────────────────

async function handleGemini(route) {
    const req = route.request();
    const url = req.url();
    const body = JSON.parse(req.postData() || '{}');

    if (url.includes(':embedContent')) {
        // Embedding calls (Brain / memory search) — a plain JSON embedding.
        const dims = 768;
        const values = new Array(dims).fill(0.01);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ embedding: { values } }),
        });
        return;
    }

    if (url.includes(':streamGenerateContent')) {
        if (Array.isArray(body.tools)) {
            // ── CHAT CALL (has tool declarations) ──
            const hasToolResponse = JSON.stringify(body.contents || []).includes('functionResponse');
            const lastUser = JSON.stringify(body.contents || []);
            const isPossessionRequest = lastUser.includes('recover possession');
            if (isPossessionRequest && !hasToolResponse) {
                // Turn 1 → plan the packet (with research citations).
                const planArgs = {
                    jobTitle: 'Recovering possession of a tenanted flat in Lagos',
                    processSummary: 'Serve a Notice to Quit; upon expiry serve a 7-day Notice of Owner\'s Intention to Recover Possession; if the tenant still refuses, file at the Lagos State High Court.',
                    legalRequirements: 'Lagos Tenancy Law 2011: six months notice to quit for a yearly tenancy; Recovery of Premises provisions require the 7-day owner-intention notice before filing.',
                    documents: [
                        { name: DOCS[0].name, purpose: 'Terminates the tenancy at the expiration date — the foundation document for recovery.', legalBasis: 's. 13, Lagos Tenancy Law 2011' },
                        { name: DOCS[1].name, purpose: 'Statutory 7-day warning after the quit notice expires; a precondition to filing.', legalBasis: 'Recovery of Premises provisions, Lagos Tenancy Law 2011' },
                        { name: DOCS[2].name, purpose: 'Originating court process to recover possession and arrears.', legalBasis: 'Lagos State High Court (Civil Procedure) Rules 2019' },
                    ],
                    citations: [{ type: 'statute', text: 'Lagos Tenancy Law 2011, s. 13', url: 'https://example.com/lagos-tenancy-law', jurisdiction: 'Nigeria' }],
                };
                const toolCallFrame = {
                    candidates: [{
                        content: {
                            parts: [{ functionCall: { name: 'plan_document_packet', args: planArgs } }],
                        },
                    }],
                };
                await route.fulfill({
                    status: 200,
                    contentType: 'text/event-stream',
                    body: sseBody([toolCallFrame, textChunk('', true)]),
                });
                return;
            }
            // Continuation after the tool result, or any other message.
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: sseBody([
                    textChunk('I have itemised the three documents this recovery job needs in the packet card below. Review them and say "draft them all", or tell me which to draft first.'),
                    textChunk('', true),
                ]),
            });
            return;
        }

        // ── DRAFT CALL (no tools) — stream the messy document in chunks ──
        const prompt = (body.contents || []).map(c => (c.parts || []).map(p => p.text || '').join('')).join('\n');
        // Parse the explicit "THIS DOCUMENT (n of m): <name>" line — never
        // match document names loosely (the packet prompt's PROCESS text
        // legitimately mentions every document's name).
        const docLine = /THIS DOCUMENT \((\d+) of \d+\)/.exec(prompt);
        const docIndex = docLine ? Math.max(0, parseInt(docLine[1], 10) - 1) : 0;
        const html = messyDraftHtml(docIndex);
        // Stream in 6 chunks with tiny delays to exercise the stream path.
        const chunks = [];
        const size = Math.ceil(html.length / 6);
        for (let i = 0; i < html.length; i += size) chunks.push(html.slice(i, i + size));
        const frames = chunks.map(c => textChunk(c));
        frames.push(textChunk('', true));
        // Small delay so streaming is observable but the E2E stays fast.
        await new Promise(r => setTimeout(r, 150));
        await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: sseBody(frames),
        });
        return;
    }

    // Model listing etc.
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [] }) });
}

// ─── Local Convex helpers ────────────────────────────────────────────────────
function getVerificationCode(email) {
    const db = new DatabaseSync(SQLITE);
    try {
        const rows = db.prepare("SELECT json_value FROM documents WHERE json_value LIKE ? AND deleted=0 ORDER BY ts DESC LIMIT 5")
            .all(`%"${email}"%`);
        for (const r of rows) {
            try {
                const v = JSON.parse(r.json_value);
                if (v.email === email && typeof v.verificationCode === 'string' && v.verificationCode.length >= 6) {
                    return v.verificationCode.slice(0, 6);
                }
            } catch { /* skip */ }
        }
        return null;
    } finally {
        db.close();
    }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Editor page assertions (run inside the DraftPro tab) ────────────────────
async function assertEditorClean(page, label, expectedMarker) {
    // Wait for the expected marker to appear (draft loaded/drafted).
    await page.waitForFunction(
        marker => document.body.innerText.includes(marker),
        expectedMarker,
        { timeout: 60000 },
    );
    // Let the final setContent + pagination pass settle.
    await sleep(1800);

    const audit = await page.evaluate(() => {
        const out = { emptyParas: 0, brPairs: 0, placeholders: 0, highlighted: 0, wrongInk: 0, overlaps: [], blockCount: 0, editorHtmlLen: 0, literalBracketText: false, bodySnippet: '' };
        const pm = document.querySelector('.ProseMirror');
        if (!pm) { out.bodySnippet = document.body.innerText.slice(0, 200); return out; }
        out.editorHtmlLen = pm.innerHTML.length;
        const blocks = Array.from(pm.children);
        out.blockCount = blocks.length;
        for (const b of blocks) {
            if (b.tagName === 'P') {
                const hasPlaceholder = !!b.querySelector('[data-type="legal-placeholder"], [data-node-view-wrapper]');
                const hasImg = !!b.querySelector('img');
                const text = (b.textContent || '').trim();
                // A paragraph with only a trailing-break and no content/placeholder.
                if (!text && !hasPlaceholder && !hasImg && b.innerText.trim() === '') out.emptyParas++;
            }
            const brs = (b.innerHTML.match(/<br[\s/]*>[\s\S]{0,20}<br[\s/]*>/gi) || []).length;
            out.brPairs += brs;
        }
        // Literal [BRACKETED] text that should have been converted to
        // placeholder chips (fails the finalize pipeline).
        out.literalBracketText = /\[[A-Z][^\]\n]{2,60}\]/.test(pm.innerText || '');
        // Placeholder node views: React NodeViewWrapper renders the chip with
        // a title attribute ("... — click to fill (...)").
        const spans = Array.from(pm.querySelectorAll('span[title*="click to fill"]'));
        out.placeholders = spans.length;
        for (const s of spans) {
            const cs = getComputedStyle(s);
            const bg = cs.backgroundColor;
            const isTransparent = !bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
            if (!isTransparent) out.highlighted++;
            // The visible text must keep the editor ink (#111827), not a
            // re-dyed colour.
            const col = getComputedStyle(s).color;
            if (col !== 'rgb(17, 24, 39)') out.wrongInk++;
        }
        // Overlap check: no two top-level blocks may intersect.
        const rects = blocks.map(b => b.getBoundingClientRect());
        for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
                const a = rects[i], b = rects[j];
                const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                if (xOverlap > 4 && yOverlap > 4) {
                    out.overlaps.push(`${i}↔${j} (y=${Math.round(yOverlap)}px)`);
                }
            }
        }
        return out;
    });
    check(`[${label}] expected marker present in editor`, true, expectedMarker);
    check(`[${label}] ZERO empty paragraphs in editor (gap cleanup)`, audit.emptyParas === 0, `found ${audit.emptyParas}`);
    check(`[${label}] ZERO <br><br> remnants`, audit.brPairs === 0, `found ${audit.brPairs}`);
    check(`[${label}] no literal [BRACKETED] text left unconverted`, !audit.literalBracketText);
    check(`[${label}] placeholders present`, audit.placeholders > 0, `${audit.placeholders} found`);
    check(`[${label}] placeholders are BACKGROUND highlights`, audit.placeholders > 0 && audit.highlighted === audit.placeholders, `${audit.highlighted}/${audit.placeholders} highlighted`);
    check(`[${label}] placeholder text keeps editor ink (legible)`, audit.placeholders === 0 || audit.wrongInk === 0, `${audit.wrongInk} wrong`);
    check(`[${label}] NO overlapping text blocks`, audit.overlaps.length === 0, audit.overlaps.slice(0, 4).join('; ') || `checked ${audit.blockCount} blocks`);
    return audit;
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
    const browser = await chromium.launch({
        headless: true,
        // This sandbox's Playwright cache has chromium-1243 while the repo's
        // playwright pins a different build — point straight at the binary.
        executablePath: '/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('**/generativelanguage.googleapis.com/**', handleGemini);

    const page = await context.newPage();
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(String(err)));

    // 1. Landing → signup
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2500);
    await shot(page, '01-landing');
    await page.getByRole('button', { name: /Start Free Trial/i }).first().click();
    await sleep(1200);

    // 2. Product chooser → Vega (scoped to the open dialog — the landing
    //    page has its own "Vega" nav buttons that sit under the modal)
    await page.locator('[role="dialog"] button:has-text("Vega")').first().click();
    await sleep(800);

    // 3. Signup form (inputs scoped to the dialog)
    const dlg = page.locator('[role="dialog"]');
    await dlg.getByPlaceholder('Full Name').fill('Ada E2E Lawyer');
    await dlg.getByPlaceholder('Work Email').fill(EMAIL);
    await dlg.getByPlaceholder(/Password/i).first().fill(PASSWORD);
    // Confirm password if present
    const confirm = dlg.getByPlaceholder(/Confirm/i).first();
    if (await confirm.count()) await confirm.fill(PASSWORD);
    // ToS + Privacy checkboxes gate the Create Account button
    const terms = dlg.locator('#terms');
    if (await terms.count()) await terms.check();
    const privacy = dlg.locator('#privacy');
    if (await privacy.count()) await privacy.check();
    await shot(page, '02-signup-filled');
    await dlg.getByRole('button', { name: /Create Account|Sign Up|Continue/i }).first().click();
    await sleep(2500);

    // 4. Verification code from local Convex sqlite
    let code = null;
    for (let i = 0; i < 20 && !code; i++) {
        code = getVerificationCode(EMAIL);
        if (!code) await sleep(500);
    }
    check('verification code retrieved from local backend', !!code, code || 'not found');
    if (!code) throw new Error('Could not retrieve the verification code — signup did not create the pending user.');
    await page.getByPlaceholder(/6-digit Code/i).fill(code);
    await shot(page, '03-code-entered');
    await page.getByRole('button', { name: /Verify/i }).first().click();
    await sleep(2500);
    const afterVerify = await page.evaluate(() => document.body.innerText.slice(0, 500).replace(/\n/g, ' | '));
    console.log('   [after verify]', afterVerify);

    // 5. Onboarding wizard — firm name (step 1 of 6)
    const stepText = () => page.locator('text=/Step \\d of 6/').first();
    await stepText().waitFor({ state: 'visible', timeout: 30000 });
    const firmInput = page.getByPlaceholder(/Adeyemi & Co/i).first();
    if (await firmInput.count()) {
        await firmInput.fill('E2e & Co. Solicitors');
        await page.getByRole('button', { name: /Next: Confirm Plan/i }).click();
        await sleep(1500);
    }
    await shot(page, '04-wizard-plan');
    const planHeading = await page.locator('[role="dialog"]').first().innerText().catch(() => '');
    console.log('   [wizard step 2 text]', planHeading.slice(0, 220).replace(/\n/g, ' | '));

    // Select Growth (paid tier → trial → AI unlocked)
    const showPlans = page.getByRole('button', { name: /Compare with other plans/i }).first();
    if (await showPlans.count()) { await showPlans.click(); await sleep(700); }
    const growthCard = page.locator('h4:text-is("Growth")').first();
    if (await growthCard.count()) { await growthCard.click(); await sleep(700); }
    // Agree to DPA + terms
    const dpa = page.locator('#agree-dpa');
    if (await dpa.count()) { await dpa.check(); }
    await shot(page, '05-growth-selected');
    await page.getByRole('button', { name: /Start 30-Day Free Trial/i }).first().click();
    await sleep(3000);

    // Step 3: Practice Profile → Next
    const nextChannels = page.getByRole('button', { name: /Next: Communication Channels/i }).first();
    if (await nextChannels.count()) { await nextChannels.click(); await sleep(1200); }
    // Step 4: Channels — answer "Not yet" for WhatsApp + Email (two buttons share the label)
    const notYet = page.getByRole('button', { name: /Not yet/i });
    const notYetCount = await notYet.count();
    for (let i = 0; i < Math.min(notYetCount, 2); i++) { await notYet.nth(i).click(); await sleep(300); }
    await page.getByRole('button', { name: /Next: Team Setup/i }).first().click();
    await sleep(1200);
    // Step 5: Team — "Not right now — it's just me" → Next: Review & Confirm
    const justMe = page.getByText(/Not right now/i).first();
    if (await justMe.count()) { await justMe.click(); await sleep(500); }
    await page.getByRole('button', { name: /Next: Review & Confirm/i }).first().click();
    await sleep(1200);
    // Step 6: Review → "Start using PracticePro" (creates matter types etc.)
    await page.getByRole('button', { name: /Start using PracticePro/i }).first().click();
    await sleep(9000); // final workspace configuration takes a moment
    await shot(page, '06-app-home');
    check('signup E2E reached the app home', await page.getByRole('button', { name: /Open AI Assistant|ALOA/i }).first().count() > 0 || (await page.locator('[aria-label*="AI Assistant"]').count()) > 0);

    // 6. Configure a (mocked) Gemini key so ALOA can call out
    await page.evaluate(() => {
        localStorage.setItem('practicepro_custom_gemini_key', 'e2e-mock-api-key-0123456789abcdef');
    });

    // 7. Open ALOA
    const fab = page.locator('[aria-label*="AI Assistant"]').first();
    await fab.click();
    await sleep(1200);
    // First-open AI consent modal — accept it so the chat unlocks
    const consentBtn = page.getByRole('button', { name: /I Consent/i }).first();
    if (await consentBtn.count()) { await consentBtn.click(); await sleep(800); }
    await sleep(1000);
    await shot(page, '07-aloa-open');
    const textarea = page.locator('textarea').last();
    check('ALOA chat input visible', await textarea.count() > 0);

    // 8. Ask for the documents necessary (packet trigger)
    await textarea.fill('I want to recover possession of my tenant\'s flat in Lekki, Lagos. The tenancy is yearly. Draft the documents necessary for this process.');
    await textarea.press('Enter');
    // Wait for the packet card (tool turn 1 + text turn 2). The header is
    // CSS-uppercased, so match case-insensitively.
    await page.waitForFunction(() => /document packet/i.test(document.body.innerText), { timeout: 60000 });
    await sleep(1500);
    await shot(page, '08-packet-card');
    check('Document Packet card rendered with 3 documents', (await page.getByText('Draft all 3 documents').count()) > 0);

    // 9. Playbook learning assertion (localStorage, scrubbed)
    const playbookAudit = await page.evaluate((email) => {
        const out = { saved: false, hasUserEmail: false, hasDocNames: false, count: 0 };
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('legalplaybooks:')) {
                try {
                    const books = JSON.parse(localStorage.getItem(k));
                    out.count = books.length;
                    const raw = localStorage.getItem(k);
                    out.saved = books.length > 0;
                    out.hasUserEmail = raw.includes(email);
                    out.hasDocNames = raw.includes('Notice to Quit') && raw.includes('Writ of Summons');
                } catch { /* skip */ }
            }
        }
        return out;
    }, EMAIL);
    check('web-research playbook LEARNED (saved on packet plan)', playbookAudit.saved && playbookAudit.hasDocNames, `${playbookAudit.count} playbooks`);
    check('playbook contains NO user data (email never stored)', !playbookAudit.hasUserEmail);

    // 10. DRAFT ALL — doc 0 opens; docs 1-2 pre-draft in background
    const draftAllBtn = page.getByRole('button', { name: /Draft all 3 documents/i }).first();
    await draftAllBtn.click();

    // Doc 0 opens in a new (named) tab
    const editorPagePromise = context.waitForEvent('page', { timeout: 20000 });
    const editorPage0 = await editorPagePromise;
    await editorPage0.waitForLoadState('domcontentloaded');
    check('document #1 opened in a dedicated DraftPro tab', editorPage0.url().includes('draftKey='));
    await shot(editorPage0, '09-doc0-live-draft');

    // Meanwhile the remaining rows show cues and complete
    await page.waitForFunction(() => {
        const t = document.body.innerText;
        return t.includes('Drafted — ready to open');
    }, { timeout: 90000 });
    await sleep(1000);
    await shot(page, '10-rows-drafted');
    const cues = await page.evaluate(() => {
        const t = document.body.innerText;
        return {
            draftingCueSeen: t.includes('Drafting your packet'),
            draftedCue: (t.match(/Drafted — ready to open/g) || []).length,
            counter: /drafted/.test(t),
        };
    });
    check('in-chat visual cue: packet progress line during draft-all', cues.counter, JSON.stringify(cues));
    check('in-chat visual cue: 2 background drafts completed with ✓', cues.draftedCue >= 2, `${cues.draftedCue} rows`);

    // 11. Doc 0 editor: gap cleanup + highlights + overlap (3-page doc)
    await assertEditorClean(editorPage0, 'doc0-live', DOCS[0].marker);
    await shot(editorPage0, '11-doc0-clean');

    // 12. Open a background-drafted doc (row 2 → doc index 1)
    // First verify the background draft really persisted with content.
    const savedDraft = await page.evaluate(() => {
        const out = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('draftpro:')) {
                try {
                    const v = JSON.parse(localStorage.getItem(k));
                    if (v && typeof v.content === 'string' && v.content.includes('E2E-MARKER-DOC-1')) {
                        out.key = k;
                        out.hasMarker = true;
                        out.contentLen = v.content.length;
                        out.hasPlaceholderSpan = v.content.includes('legal-placeholder');
                    }
                } catch { /* skip */ }
            }
        }
        return out;
    });
    check('background draft persisted with content (doc #2)', !!savedDraft.hasMarker, JSON.stringify(savedDraft).slice(0, 140));

    const openDraftBtn = page.getByRole('button', { name: /Open Draft/i }).first();
    await openDraftBtn.click();
    const editorPage1Promise = context.waitForEvent('page', { timeout: 20000 });
    const editorPage1 = await editorPage1Promise;
    await editorPage1.waitForLoadState('domcontentloaded');
    console.log('   [doc1 tab]', editorPage1.url().slice(0, 120));

    // MUST NOT show the drafting overlay — content must already exist.
    await sleep(1200);
    const overlayShown = await editorPage1.getByText(/Preparing your document/i).count();
    try {
        await assertEditorClean(editorPage1, 'doc1-predraft', DOCS[1].marker);
    } catch (e) {
        await shot(editorPage1, '12-doc1-FAILED');
        const txt = await editorPage1.evaluate(() => document.body.innerText.slice(0, 400).replace(/\n/g, ' | '));
        console.log('   [doc1 FAILURE body]', txt);
        const ls = await editorPage1.evaluate(() => {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('draftpro:')) keys.push(k);
            }
            return keys;
        });
        console.log('   [doc1 editor localStorage draft keys]', JSON.stringify(ls));
        throw e;
    }
    check('background-drafted doc opened WITHOUT re-drafting (no overlay)', overlayShown === 0);
    await shot(editorPage1, '12-doc1-instant-open');

    // 13. Playbook is retrievable for a similar later job (learning works)
    const retrieval = await page.evaluate(() => {
        // Simulate the lookup AloaChat does when drafting a similar job.
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('legalplaybooks:')) keys.push(JSON.parse(localStorage.getItem(k)));
        }
        const books = keys.flat();
        const q = 'recover possession tenanted flat lagos'.toLowerCase().split(/\s+/);
        let best = 0;
        for (const b of books) {
            const hay = (b.jobTitle + ' ' + (b.keywords || []).join(' ')).toLowerCase();
            const hits = q.filter(t => hay.includes(t)).length;
            if (hits > best) best = hits;
        }
        return { books: books.length, bestScore: best / q.length };
    });
    check('playbook retrievable for a similar future job', retrieval.books > 0 && retrieval.bestScore >= 0.5, `score ${retrieval.bestScore.toFixed(2)}`);

    // 14. Wrap up
    const fatalErrors = consoleErrors.filter(e => !/ResizeObserver|Failed to load resource|favicon|agenteval/i.test(e));
    check('no page errors during the flow', fatalErrors.length === 0, fatalErrors.slice(0, 3).join(' | ').slice(0, 200));

    await browser.close();

    const failed = results.filter(r => !r.ok).length;
    console.log(`\nRESULT: ${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed}/${results.length} checks passed`);
    process.exit(failed === 0 ? 0 : 1);
})().catch(err => {
    console.error('E2E harness crashed:', err);
    process.exit(2);
});

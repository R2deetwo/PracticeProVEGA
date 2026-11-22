/* Vega claims-audit DOM verification (2026-11-22): assert the rendered
 * /vega carries the corrected claims, the expanded FAQ and the cleaned
 * footer — the rendered truth, not just the source pins. */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:4173';

(async () => {
    const cached = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
    const launchArgs = fs.existsSync(cached) ? { executablePath: cached } : {};
    const browser = await chromium.launch(launchArgs);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/vega`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    const text = await page.evaluate(() => document.body.innerText);

    const results = [];
    const check = (name, cond) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);

    // ── Footer cleanup ────────────────────────────────────────────────
    check('footer: "by Practice Pro" attribution present', /by Practice Pro/.test(text));
    check('footer: no "Open Atrium" button', !/Open Atrium/.test(text));
    check('footer: no "Vega & Atrium · Built by PracticePro"', !/Vega & Atrium · Built by PracticePro/.test(text));
    check('footer: no NDPA/TLS strip line', !/NDPA 2023 Compliant · TLS 1\.3/.test(text));
    check('footer: © line present', /© 2026 Practice Pro Systems Limited, Lagos, Nigeria/.test(text));

    // Lockup geometry: mark and wordmark on ONE horizontal line, with the
    // attribution below aligned to the mark's left edge.
    const lockup = await page.evaluate(() => {
        const mark = document.querySelector('footer .flex.items-center svg') || document.querySelector('footer img');
        const wordmark = [...document.querySelectorAll('footer span')].find((s) => s.textContent.trim() === 'Vega');
        const attr = [...document.querySelectorAll('footer p')].find((p) => p.textContent.trim() === 'by Practice Pro');
        if (!mark || !wordmark || !attr) return null;
        const m = mark.getBoundingClientRect(), w = wordmark.getBoundingClientRect(), a = attr.getBoundingClientRect();
        return {
            horizontal: Math.abs(m.top - w.top) < 8 && w.left > m.right,
            attrBelow: a.top >= w.bottom - 2,
            attrAlignedToMark: Math.abs(a.left - m.left) <= 2,
            attrLeft: a.left, markLeft: m.left,
        };
    });
    check('footer: mark + Vega horizontal like the header', !!lockup && lockup.horizontal);
    check('footer: "by Practice Pro" below the wordmark', !!lockup && lockup.attrBelow);
    check('footer: attribution aligned to the mark start', !!lockup && lockup.attrAlignedToMark);

    // No divider rule above the © line (the old border-t pt-8 wrapper).
    const divider = await page.evaluate(() => {
        const p = [...document.querySelectorAll('footer p')].find((x) => x.textContent.includes('Practice Pro Systems Limited'));
        const wrap = p ? p.parentElement : null;
        if (!wrap) return null;
        return getComputedStyle(wrap).borderTopWidth;
    });
    check('footer: no divider rule above the © line', divider === '0px');

    // ── FAQ expansion ────────────────────────────────────────────────
    for (const q of [
        'How much does Vega cost?',
        'What does the free plan include?',
        'How long does it take to get started?',
        'How do court date reminders reach me?',
        'Does Vega handle litigation and transactional work alike?',
        'Can I bring my existing matters and documents?',
        'Is my data secure?',
        'What happens to my data if I leave?',
        'How do support and updates work?',
    ]) {
        check(`faq: "${q}"`, text.includes(q));
    }
    check('faq: Questions? Answered. heading', text.includes('Questions? Answered.'));

    // ── Corrected claims ─────────────────────────────────────────────
    check('claims: no "shipping" vocabulary on the page', !/shipping/i.test(text));
    check('claims: WhatsApp reminder channel (trust band)', /delivered to assigned counsel on WhatsApp \(paid plans\)/.test(text));
    check('claims: NDPA 2023-aligned (attestation)', /NDPA 2023-aligned safeguards/.test(text));
    check('claims: no-training is the Terms commitment', /never used to train or fine-tune any model/.test(text));
    check('claims: regulatory engine is Enterprise-only', !/Available as an add-on/.test(text) && /Included with the Enterprise plan\./.test(text));
    check('claims: court-rules honesty caveat', /confirm your division/.test(text));

    await browser.close();
    console.log(results.join('\n'));
    const fails = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - fails}/${results.length} passed`);
    process.exit(fails ? 1 : 0);
})();

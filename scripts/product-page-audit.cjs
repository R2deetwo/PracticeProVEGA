/**
 * product-page-audit.cjs — Playwright crawler that navigates to a product
 * page (Vega or Atrium) and verifies all landing page sections including
 * the new How It Works, Testimonials, FAQ, Final CTA, AI Capabilities sections.
 * Also verifies pricing changes (tier labels, monthly billing, Komplete price).
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.AUDIT_URL || 'http://127.0.0.1:4173';
const PRODUCT = process.env.AUDIT_PRODUCT || 'vega'; // 'vega' or 'atrium'

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        bypassCSP: true,
    });
    const page = await context.newPage();

    const errors = [];
    const passes = [];
    const warnings = [];

    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(`Console: ${msg.text()}`);
    });

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  PRACTICEPRO PRODUCT PAGE AUDIT (${PRODUCT.toUpperCase()})`);
    console.log(`  Target: ${TARGET_URL}`);
    console.log(`${'═'.repeat(70)}\n`);

    // Load the hub page first
    console.log(`▶ Loading hub page...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click the product card to enter the product page
    console.log(`▶ Clicking ${PRODUCT} card...`);
    const productSelectors = [
        `text=Enter ${PRODUCT.charAt(0).toUpperCase() + PRODUCT.slice(1)}`,
        `text=${PRODUCT} →`,
        `a:has-text("${ProductCoverty(PRODUCT)}")`,
        `div:has-text("${PRODUCT}") >> nth=0`,
    ];

    let clicked = false;
    for (const sel of productSelectors) {
        try {
            const el = page.locator(sel).first();
            if (await el.count() > 0 && await el.isVisible()) {
                await el.click({ timeout: 5000 });
                clicked = true;
                console.log(`  Clicked via: ${sel}`);
                break;
            }
        } catch (e) { /* try next */ }
    }

    if (!clicked) {
        // Fallback: try clicking the product name directly
        try {
            await page.locator(`text=${PRODUCT.charAt(0).toUpperCase() + PRODUCT.slice(1)}`).first().click({ timeout: 5000 });
            clicked = true;
            console.log(`  Clicked via product name text`);
        } catch (e) {
            console.log(`  Could not click product card, trying URL fallback...`);
            await page.goto(`${TARGET_URL}/?product=${PRODUCT}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
        }
    }

    await page.waitForTimeout(3000);

    // Scroll through the page to trigger all sections
    console.log(`▶ Scrolling through page to load all sections...`);
    await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
        window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1000);

    // ─── Section Checks ──────────────────────────────────────────────────
    console.log('\n── Section Checks ──────────────────────────────────────────');

    const sectionChecks = [
        { name: 'Navigation (sticky header)', selector: 'header' },
        { name: 'Hero Section', selector: 'section#home, [id="home"]' },
        { name: 'Features Section', selector: 'section#features, [id="features"]' },
        { name: 'AI Capabilities (dark)', selector: 'section.bg-slate-900' },
        { name: 'Pricing Section', selector: 'section#pricing, [id="pricing"]' },
        { name: 'How It Works', selector: 'section#howItWorks, [id="howItWorks"]' },
        { name: 'Testimonials', selector: 'section:has-text("What Nigerian professionals say")' },
        { name: 'FAQ', selector: 'section:has-text("Questions? Answered")' },
        { name: 'Final CTA', selector: 'section:has-text("Ready to stop managing chaos")' },
        { name: 'Footer', selector: 'footer' },
        { name: 'WhatsApp FAB', selector: 'a[aria-label*="WhatsApp"]' },
        { name: 'Skip-to-content link', selector: 'a[href="#main-content"]' },
        { name: 'Mobile sticky CTA (check mobile)', selector: '.fixed.bottom-0' },
    ];

    for (const check of sectionChecks) {
        const count = await page.locator(check.selector).count();
        if (count > 0) {
            passes.push(`✓ ${check.name}`);
            console.log(`  ✓ ${check.name}`);
        } else {
            warnings.push(`✗ ${check.name}`);
            console.log(`  ✗ ${check.name}`);
        }
    }

    // ─── How It Works Legibility Check ───────────────────────────────────
    console.log('\n── How It Works Legibility ─────────────────────────────────');
    const howItWorks = page.locator('section#howItWorks');
    if (await howItWorks.count() > 0) {
        // Check step numbers are not text-slate-100 (too light)
        const stepNumbers = howItWorks.locator('div:has-text("1"), div:has-text("2"), div:has-text("3")');
        const stepText = await howItWorks.textContent();
        if (stepText.includes('01') || stepText.includes('02') || stepText.includes('03')) {
            warnings.push('✗ How It Works still uses 01/02/03 (should be 1/2/3)');
            console.log('  ✗ Still uses 01/02/03');
        } else {
            passes.push('✓ How It Works uses 1/2/3 (not 01/02/03)');
            console.log('  ✓ Uses 1/2/3');
        }

        // Check for product-specific content
        if (PRODUCT === 'vega') {
            if (stepText.includes('Matter Ingestion Wizard')) {
                passes.push('✓ Vega steps mention Matter Ingestion Wizard');
                console.log('  ✓ Vega steps mention Matter Ingestion Wizard');
            } else {
                warnings.push('✗ Vega steps do not mention Matter Ingestion Wizard');
                console.log('  ✗ Missing Matter Ingestion Wizard mention');
            }
            if (stepText.includes('DraftPro')) {
                passes.push('✓ Vega steps mention DraftPro');
                console.log('  ✓ Vega steps mention DraftPro');
            } else {
                warnings.push('✗ Vega steps do not mention DraftPro');
                console.log('  ✗ Missing DraftPro mention');
            }
        } else {
            if (stepText.includes('properties') || stepText.includes('tenants')) {
                passes.push('✓ Atrium steps mention properties/tenants');
                console.log('  ✓ Atrium steps mention properties/tenants');
            } else {
                warnings.push('✗ Atrium steps do not mention properties/tenants');
                console.log('  ✗ Missing properties/tenants mention');
            }
        }
    }

    // ─── Pricing Checks ──────────────────────────────────────────────────
    console.log('\n── Pricing Checks ──────────────────────────────────────────');

    // Check for tier label changes
    const pricingSection = page.locator('section#pricing');
    if (await pricingSection.count() > 0) {
        const pricingText = await pricingSection.textContent();

        if (PRODUCT === 'vega') {
            if (pricingText.includes('Free')) {
                passes.push('✓ Vega shows "Free" label (was "Core")');
                console.log('  ✓ Vega shows "Free" label');
            } else {
                warnings.push('✗ Vega does not show "Free" label');
                console.log('  ✗ Missing "Free" label');
            }
        } else {
            if (pricingText.includes('Starter')) {
                passes.push('✓ Atrium shows "Starter" label (was "Core")');
                console.log('  ✓ Atrium shows "Starter" label');
            } else {
                warnings.push('✗ Atrium does not show "Starter" label');
                console.log('  ✗ Missing "Starter" label');
            }
        }

        // Check for billing toggle
        if (pricingText.includes('Monthly') && pricingText.includes('Annual')) {
            passes.push('✓ Billing toggle shows Monthly + Annual');
            console.log('  ✓ Billing toggle present');
        } else {
            warnings.push('✗ Billing toggle missing');
            console.log('  ✗ Billing toggle missing');
        }

        // Check for 30-day money-back guarantee
        if (pricingText.includes('30-day money-back')) {
            passes.push('✓ 30-day money-back guarantee badge present');
            console.log('  ✓ Money-back guarantee badge present');
        } else {
            warnings.push('✗ 30-day money-back guarantee badge missing');
            console.log('  ✗ Money-back guarantee badge missing');
        }

        // Check for Save 20% badge
        if (pricingText.includes('Save 20%')) {
            passes.push('✓ Save 20% badge present');
            console.log('  ✓ Save 20% badge present');
        } else {
            warnings.push('✗ Save 20% badge missing');
            console.log('  ✗ Save 20% badge missing');
        }
    }

    // ─── JSON-LD Check ───────────────────────────────────────────────────
    console.log('\n── SEO / Structured Data ────────────────────────────────────');
    const jsonLdCount = await page.locator('script[type="application/ld+json"]').count();
    if (jsonLdCount >= 2) {
        passes.push(`✓ JSON-LD present (${jsonLdCount} scripts)`);
        console.log(`  ✓ JSON-LD present (${jsonLdCount} scripts)`);
    } else {
        warnings.push(`✗ JSON-LD missing (${jsonLdCount} found)`);
        console.log(`  ✗ JSON-LD missing (${jsonLdCount} found)`);
    }

    // Check for Komplete price N2.2M
    const html = await page.content();
    if (html.includes('2,200,000') || html.includes('2200000')) {
        passes.push('✓ Komplete price N2.2M found');
        console.log('  ✓ Komplete price N2.2M');
    } else {
        warnings.push('✗ Komplete price N2.2M not found');
        console.log('  ✗ Komplete price N2.2M not found');
    }

    // ─── Screenshot ──────────────────────────────────────────────────────
    console.log('\n── Screenshot ───────────────────────────────────────────────');
    const screenshotDir = path.join(__dirname, '..', 'audit-results', 'landing-screenshots');
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

    await page.screenshot({
        path: path.join(screenshotDir, `product-${PRODUCT}-full-page.png`),
        fullPage: true,
    });
    passes.push('✓ Full-page screenshot captured');
    console.log('  ✓ Screenshot captured');

    // ─── Summary ─────────────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  AUDIT SUMMARY (${PRODUCT.toUpperCase()})`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`\n  ✅ PASSED: ${passes.length}`);
    console.log(`  ⚠️  WARNINGS: ${warnings.length}`);
    console.log(`  ❌ ERRORS: ${errors.length}`);

    if (warnings.length > 0) {
        console.log(`\n── Warnings ──────────────────────────────────────────────`);
        warnings.forEach(w => console.log(`  ${w}`));
    }

    const report = { product: PRODUCT, passes, warnings, errors };
    fs.writeFileSync(
        path.join(__dirname, '..', 'audit-results', `product-${PRODUCT}-report.json`),
        JSON.stringify(report, null, 2)
    );

    await browser.close();
    process.exit(errors.length > 0 ? 1 : 0);
})();

function ProductCoverty(p) {
    return p.charAt(0).toUpperCase() + p.slice(1);
}

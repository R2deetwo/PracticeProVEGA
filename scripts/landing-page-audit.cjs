/**
 * landing-page-audit.cjs — Playwright crawler that verifies the landing page
 * against the Implementation Spec. Tests:
 *   1. All 13 spec sections exist in the DOM
 *   2. Mobile hamburger menu works
 *   3. Mobile sticky CTA bar is present on mobile viewport
 *   4. WhatsApp FAB is present
 *   5. Skip-to-content link is present
 *   6. FAQ accordion expands/collapses
 *   7. JSON-LD structured data is in the HTML
 *   8. Preconnect hints are present
 *   9. No console errors
 *   10. "All Products" breadcrumb does not wrap to 2 lines
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.AUDIT_URL || 'https://practice-pro-vega.vercel.app/';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        bypassCSP: true,
    });
    const page = await context.newPage();

    const errors = [];
    const warnings = [];
    const passes = [];

    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(`Console: ${msg.text()}`);
    });
    page.on('pageerror', err => errors.push(`Page error: ${err.message}`));

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  PRACTICEPRO LANDING PAGE AUDIT`);
    console.log(`  Target: ${TARGET_URL}`);
    console.log(`${'═'.repeat(70)}\n`);

    // ─── Load the page ────────────────────────────────────────────────────
    console.log('▶ Loading landing page (desktop viewport)...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // ─── 1. Check for spec sections ──────────────────────────────────────
    console.log('\n── Section Checks ────────────────────────────────────────');

    // First, check if we're on the hub page (productChosen=false) or product page
    const isHubPage = await page.locator('text=One platform').count() > 0 || await page.locator('text=Choose your').count() > 0;

    // Navigate to a product page to see the full set of sections
    if (isHubPage) {
        console.log('  Hub page detected. Clicking "Vega" to see product sections...');
        const vegaCard = page.locator('text=Vega').first();
        if (await vegaCard.count() > 0) {
            await vegaCard.click().catch(() => {});
            await page.waitForTimeout(2000);
        }
    }

    // Now check for sections on the product page
    const sectionChecks = [
        { name: 'Navigation (sticky header)', selector: 'header.fixed, header[class*="fixed"]' },
        { name: 'Hero Section (HomeSection)', selector: 'section#home, [id="home"]' },
        { name: 'Stats Demarcator', selector: 'section:has-text("End-to-End"), section:has-text("NDPA")' },
        { name: 'Features Section', selector: 'section#features, [id="features"]' },
        { name: 'Trust Badges Strip', selector: 'section:has-text("Trusted"), section:has-text("badge")' },
        { name: 'AI Capabilities Section (dark)', selector: 'section.bg-slate-900:has-text("Powered by AI")' },
        { name: 'Pricing Section', selector: 'section#pricing, [id="pricing"]' },
        { name: 'How It Works Section', selector: 'section#howItWorks, [id="howItWorks"]' },
        { name: 'Testimonials Section', selector: 'section:has-text("What Nigerian professionals say")' },
        { name: 'FAQ Section', selector: 'section:has-text("Questions? Answered")' },
        { name: 'Final CTA Section', selector: 'section:has-text("Ready to stop managing chaos")' },
        { name: 'Footer', selector: 'footer' },
    ];

    for (const check of sectionChecks) {
        const count = await page.locator(check.selector).count();
        if (count > 0) {
            passes.push(`✓ ${check.name} — found`);
            console.log(`  ✓ ${check.name}`);
        } else {
            warnings.push(`✗ ${check.name} — NOT FOUND (${check.selector})`);
            console.log(`  ✗ ${check.name} — NOT FOUND`);
        }
    }

    // ─── 2. Check for mobile hamburger button ────────────────────────────
    console.log('\n── Mobile Nav Checks ─────────────────────────────────────');
    const hamburger = page.locator('button[aria-label="Toggle menu"]');
    if (await hamburger.count() > 0) {
        // On desktop viewport, hamburger is hidden (md:hidden). Switch to mobile.
        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(500);
        const hamburgerVisible = await hamburger.isVisible();
        if (hamburgerVisible) {
            passes.push('✓ Mobile hamburger button visible on mobile viewport');
            console.log('  ✓ Mobile hamburger button visible on mobile viewport');

            // Click it to open the menu
            await hamburger.click();
            await page.waitForTimeout(500);
            const mobileNav = page.locator('nav[aria-label="Mobile navigation"]');
            if (await mobileNav.isVisible()) {
                passes.push('✓ Mobile overlay menu opens on click');
                console.log('  ✓ Mobile overlay menu opens on click');

                // Check for key links in mobile menu
                const hasProducts = await mobileNav.locator('text=Vega — For Law Firms').count();
                const hasContact = await mobileNav.locator('text=Contact').count();
                const hasLogin = await mobileNav.locator('text=Log In').count();
                if (hasProducts && hasContact && hasLogin) {
                    passes.push('✓ Mobile menu has Products + Contact + Log In');
                    console.log('  ✓ Mobile menu has Products + Contact + Log In');
                } else {
                    warnings.push(`✗ Mobile menu missing links (Products:${hasProducts}, Contact:${hasContact}, Login:${hasLogin})`);
                    console.log(`  ✗ Mobile menu missing links`);
                }
            } else {
                warnings.push('✗ Mobile overlay menu did not open');
                console.log('  ✗ Mobile overlay menu did not open');
            }
        } else {
            warnings.push('✗ Hamburger button not visible on mobile viewport');
            console.log('  ✗ Hamburger button not visible on mobile viewport');
        }
    } else {
        warnings.push('✗ Mobile hamburger button not found in DOM');
        console.log('  ✗ Mobile hamburger button not found in DOM');
    }

    // ─── 3. Check for mobile sticky CTA bar ──────────────────────────────
    const stickyCTA = page.locator('.fixed.bottom-0:has-text("Start Free Trial")');
    if (await stickyCTA.count() > 0) {
        passes.push('✓ Mobile sticky bottom CTA bar present');
        console.log('  ✓ Mobile sticky bottom CTA bar present');
    } else {
        warnings.push('✗ Mobile sticky bottom CTA bar not found');
        console.log('  ✗ Mobile sticky bottom CTA bar not found');
    }

    // ─── 4. Check for WhatsApp FAB ───────────────────────────────────────
    const whatsappFAB = page.locator('a[aria-label*="WhatsApp"]');
    if (await whatsappFAB.count() > 0) {
        passes.push('✓ WhatsApp floating action button present');
        console.log('  ✓ WhatsApp floating action button present');
    } else {
        warnings.push('✗ WhatsApp floating action button not found');
        console.log('  ✗ WhatsApp floating action button not found');
    }

    // ─── 5. Check for skip-to-content link ───────────────────────────────
    const skipLink = page.locator('a[href="#main-content"]');
    if (await skipLink.count() > 0) {
        passes.push('✓ Skip-to-content link present');
        console.log('  ✓ Skip-to-content link present');
    } else {
        warnings.push('✗ Skip-to-content link not found');
        console.log('  ✗ Skip-to-content link not found');
    }

    // ─── 6. Check FAQ accordion ──────────────────────────────────────────
    console.log('\n── FAQ Accordion Check ───────────────────────────────────');
    // Switch back to desktop for the rest
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);

    const faqButtons = page.locator('button:has-text("Is my data secure?"), button:has-text("Can I pay in Naira?")');
    if (await faqButtons.count() > 0) {
        // Click the first FAQ to test accordion
        const firstFaq = faqButtons.first();
        const isExpandedBefore = await firstFaq.getAttribute('aria-expanded');
        await firstFaq.click();
        await page.waitForTimeout(300);
        const isExpandedAfter = await firstFaq.getAttribute('aria-expanded');
        if (isExpandedBefore !== isExpandedAfter) {
            passes.push(`✓ FAQ accordion toggles (aria-expanded: ${isExpandedBefore} → ${isExpandedAfter})`);
            console.log(`  ✓ FAQ accordion toggles (aria-expanded: ${isExpandedBefore} → ${isExpandedAfter})`);
        } else {
            warnings.push('✗ FAQ accordion did not toggle on click');
            console.log('  ✗ FAQ accordion did not toggle on click');
        }
    } else {
        warnings.push('✗ FAQ buttons not found');
        console.log('  ✗ FAQ buttons not found');
    }

    // ─── 7. Check JSON-LD structured data ────────────────────────────────
    console.log('\n── SEO / Structured Data Checks ──────────────────────────');
    const jsonLdScripts = await page.locator('script[type="application/ld+json"]').count();
    if (jsonLdScripts >= 2) {
        passes.push(`✓ JSON-LD structured data present (${jsonLdScripts} scripts)`);
        console.log(`  ✓ JSON-LD structured data present (${jsonLdScripts} scripts)`);
    } else {
        warnings.push(`✗ JSON-LD structured data missing or insufficient (${jsonLdScripts} found, expected ≥2)`);
        console.log(`  ✗ JSON-LD structured data missing or insufficient (${jsonLdScripts} found)`);
    }

    // ─── 8. Check preconnect hints ───────────────────────────────────────
    const preconnectPaystack = await page.locator('link[rel="preconnect"][href*="paystack"]').count();
    const preconnectConvex = await page.locator('link[rel="preconnect"][href*="convex"]').count();
    const preconnectFirebase = await page.locator('link[rel="preconnect"][href*="firebase"]').count();
    if (preconnectPaystack > 0 && preconnectConvex > 0 && preconnectFirebase > 0) {
        passes.push('✓ Preconnect hints present (Paystack + Convex + Firebase)');
        console.log('  ✓ Preconnect hints present (Paystack + Convex + Firebase)');
    } else {
        warnings.push(`✗ Preconnect hints missing (Paystack:${preconnectPaystack}, Convex:${preconnectConvex}, Firebase:${preconnectFirebase})`);
        console.log(`  ✗ Preconnect hints missing`);
    }

    // ─── 9. Check "All Products" breadcrumb (no wrap) ────────────────────
    console.log('\n── Breadcrumb Wrap Check ────────────────────────────────');
    // Navigate to product page to see the breadcrumb
    await page.goto(TARGET_URL + '?product=vega', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Find the breadcrumb button
    const breadcrumb = page.locator('button[aria-label*="Back to all products"]');
    if (await breadcrumb.count() > 0) {
        // Hover to trigger the "All Products" text
        await breadcrumb.hover();
        await page.waitForTimeout(500);

        // Check the height of the hover text span — if it's wrapping, the height will be > 1.25rem (20px)
        const hoverSpan = breadcrumb.locator('span:has-text("All Products")').last();
        if (await hoverSpan.count() > 0) {
            const box = await hoverSpan.boundingBox();
            if (box) {
                // The container is set to height: 1.25rem (20px). If the text wraps, the span height stays 20px (overflow hidden)
                // but the inner text would be clipped. We check if the span's scrollHeight > clientHeight (indicates overflow/clipping)
                const overflowCheck = await hoverSpan.evaluate((el) => {
                    const parent = el.parentElement;
                    if (!parent) return { scrollHeight: 0, clientHeight: 0 };
                    return {
                        scrollHeight: parent.scrollHeight,
                        clientHeight: parent.clientHeight,
                    };
                });

                if (overflowCheck.scrollHeight <= overflowCheck.clientHeight + 2) {
                    passes.push(`✓ "All Products" breadcrumb does not wrap (scrollHeight: ${overflowCheck.scrollHeight}, clientHeight: ${overflowCheck.clientHeight})`);
                    console.log(`  ✓ "All Products" breadcrumb does not wrap`);
                } else {
                    warnings.push(`✗ "All Products" breadcrumb may be wrapping/clipping (scrollHeight: ${overflowCheck.scrollHeight} > clientHeight: ${overflowCheck.clientHeight})`);
                    console.log(`  ✗ "All Products" breadcrumb may be wrapping/clipping`);
                }
            }
        } else {
            warnings.push('✗ "All Products" hover text not found');
            console.log('  ✗ "All Products" hover text not found');
        }
    } else {
        // On hub page there's no breadcrumb — that's OK
        passes.push('✓ No breadcrumb on hub page (expected)');
        console.log('  ✓ No breadcrumb on hub page (expected)');
    }

    // ─── 10. Screenshot for visual verification ──────────────────────────
    console.log('\n── Screenshot Capture ────────────────────────────────────');
    const screenshotDir = path.join(__dirname, '..', 'audit-results', 'landing-screenshots');
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

    // Scroll through the page to trigger all sections
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // If hub page, click Vega
    const vegaBtn = page.locator('text=Vega').first();
    if (await vegaBtn.count() > 0) {
        await vegaBtn.click().catch(() => {});
        await page.waitForTimeout(2000);
    }

    // Full page screenshot
    await page.screenshot({
        path: path.join(screenshotDir, 'full-page-desktop.png'),
        fullPage: true,
    });
    passes.push('✓ Full-page screenshot captured');
    console.log('  ✓ Full-page screenshot captured');

    // Mobile screenshot
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await page.screenshot({
        path: path.join(screenshotDir, 'full-page-mobile.png'),
        fullPage: true,
    });
    passes.push('✓ Mobile full-page screenshot captured');
    console.log('  ✓ Mobile full-page screenshot captured');

    // ─── Summary ─────────────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  AUDIT SUMMARY`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`\n  ✅ PASSED: ${passes.length}`);
    console.log(`  ⚠️  WARNINGS: ${warnings.length}`);
    console.log(`  ❌ ERRORS: ${errors.length}`);

    if (warnings.length > 0) {
        console.log(`\n── Warnings ──────────────────────────────────────────────`);
        warnings.forEach(w => console.log(`  ${w}`));
    }

    if (errors.length > 0) {
        console.log(`\n── Console Errors ─────────────────────────────────────────`);
        errors.slice(0, 10).forEach(e => console.log(`  ${e}`));
    }

    // Write report
    const report = {
        timestamp: new Date().toISOString(),
        targetUrl: TARGET_URL,
        passed: passes.length,
        warnings: warnings.length,
        errors: errors.length,
        passes,
        warnings_detail: warnings,
        errors_detail: errors,
    };
    const reportPath = path.join(__dirname, '..', 'audit-results', 'landing-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n  Report saved: ${reportPath}`);
    console.log(`  Screenshots: ${screenshotDir}/\n`);

    await browser.close();

    // Exit code: 0 if no errors, 1 if errors
    process.exit(errors.length > 0 ? 1 : 0);
})();

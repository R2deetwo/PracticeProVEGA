import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../contexts/UIContext';
import { useSiteChrome } from '../shared/useSiteChrome';
import { useSiteScroll } from '../shared/useSiteScroll';
import { useSignupOpener, useContactSales } from '../shared/useSignupOpener';
import { PrimaryButton, GhostButton } from '../shared/ctas';
import ContactSalesDrawer from '../shared/ContactSalesDrawer';
import { VegaNavBar, VegaFooter, VegaMobileStickyCTA, VegaChatFab } from './VegaShell';
import { vegaSiteConfig } from './siteConfig';
import { VegaHero } from './sections/VegaHero';
import { VegaSuite } from './sections/VegaSuite';
import { VegaWhyNigeria } from './sections/VegaWhyNigeria';
import { VegaTrust } from './sections/VegaTrust';
import { VegaPricing } from './sections/VegaPricing';
import { VegaFinalCTA } from './sections/VegaFinalCTA';

import { Z_CLASS } from '../../overlays/constants';
/**
 * VegaSite — /vega, the light-enterprise edition (R56).
 *
 * Owner direction: "Transform the Vega marketing website from a
 * dark-themed, text-heavy page into a clean, modern, light-themed,
 * enterprise-grade landing page… consolidating redundant content into
 * an ultra-focused, high-converting layout." Twelve sections fold to
 * SIX core bands:
 *
 *   hero (light, dashboard preview) → THE CORE SUITE (one interactive
 *   tabbed hub: matters, documents/DraftPro, billing, team) →
 *   BUILT FOR NIGERIAN PRACTICE (court rules + regulatory + ALOA) →
 *   WHY FIRMS RUN ON VEGA (attestations + the practice segments) →
 *   PRICING (the VEGA_TIERS matrix + the compact FAQ) → the navy
 *   final-CTA band with the cross-sells.
 *
 * Retired in R56: VegaTeam, VegaSegments, VegaAIDrafting,
 * VegaCourtRules, VegaScaleOfCharges, VegaRegulatory, VegaCredentials
 * and VegaFAQInk as standalone bands (their substance rides the six),
 * the Fraunces/espresso "Reading Room" register, and the full-screen
 * photograph hero. The reveal machinery (data-vg-reveal) survives.
 */
export const VegaSite: React.FC = () => {
    const navigate = useNavigate();
    const { openModal } = useUI();
    useSiteChrome('vega');
    const { scrollRef, activeSection, scrollTo } = useSiteScroll(
        ['home', 'suite', 'practice-areas', 'pricing']
    );
    const openSignup = useSignupOpener('vega');
    // R64 — the demo entry: "View Live Demo" opens the demo-access modal
    // (the home of the Vega | Atrium toggle), pre-toggled to THIS page's
    // product. In dev it launches the chosen demo; in production the email
    // capture hands off to signup with the product preselected.
    const openDemo = () => openModal('leadCapture', null, { demoProduct: 'vega' });
    const {
        isContactDrawerOpen,
        contactDrawerSource,
        openContactSales,
        closeContactSales,
    } = useContactSales();

    // R22 "The Night Chambers" — scroll-reveal machinery for /vega. Sections
    // opt in with [data-vg-reveal]; ONE observer reveals them as they enter
    // the viewport (staggered via each element's --vg-d delay custom prop).
    // A 'vg:reveal-all' document event force-reveals everything — used by
    // the audit/screenshot scripts before full-page captures and a safe
    // fallback for anchor jumps. Reduced-motion users get everything
    // visible immediately via CSS (no observer needed).
    useEffect(() => {
        document.body.classList.add('site-vega');
        return () => document.body.classList.remove('site-vega');
    }, []);

    useEffect(() => {
        const root = scrollRef.current;
        if (!root) return;
        const revealAll = () => {
            root.querySelectorAll('[data-vg-reveal]:not(.vg-in)').forEach((el) => {
                el.classList.add('vg-in');
            });
        };
        document.addEventListener('vg:reveal-all', revealAll);
        const els = Array.from(root.querySelectorAll('[data-vg-reveal]'));
        if (els.length === 0) return;
        if (!('IntersectionObserver' in window)) {
            revealAll();
            return () => document.removeEventListener('vg:reveal-all', revealAll);
        }
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        e.target.classList.add('vg-in');
                        io.unobserve(e.target);
                    }
                });
            },
            { threshold: 0.06, rootMargin: '0px 0px -6% 0px' }
        );
        els.forEach((el) => io.observe(el));
        return () => {
            io.disconnect();
            document.removeEventListener('vg:reveal-all', revealAll);
        };
    }, []);

    // W14 (navigation truth): from a product page, the mark is the way HOME.
    const handleBackToHub = () => {
        if (window.location.pathname !== vegaSiteConfig.hubUrl) navigate(vegaSiteConfig.hubUrl);
    };

    // R21 (owner direction): selecting a product OPENS ITS OWN PAGE IN A
    // NEW TAB.
    const openProductPage = (p: 'vega' | 'atrium') => {
        window.open(p === 'vega' ? '/vega' : '/atrium', '_blank', 'noopener,noreferrer');
    };

    return (
        <div
            ref={scrollRef}
            className="h-[100dvh] w-full overflow-y-auto font-sans scroll-smooth md:[scrollbar-gutter:stable] theme-vega"
            style={{ background: 'var(--color-paper)', color: 'var(--color-ink)', colorScheme: 'light' }}
            data-public-page
        >
            <VegaNavBar
                activeSection={activeSection}
                scrollTo={scrollTo}
                onLogin={() => openModal('login', null, { productTheme: 'vega' })}
                onSignup={openSignup}
                onResources={() => navigate(vegaSiteConfig.resourcesPath)}
                onContactSales={() => openContactSales('Nav')}
                onOpenProduct={openProductPage}
                onBackToHub={handleBackToHub}
            />

            {/* Skip to content link — Vega's focus state lands on ink. */}
            <a
                href="#main-content"
                className={`sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:${Z_CLASS.siteOverlay} focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:rounded-lg focus:bg-vega-gilt focus:text-vega-parchment`}
            >
                Skip to content
            </a>

            <main id="main-content" className="animate-swap-in">
                <VegaHero
                    cta={(
                        <PrimaryButton onClick={() => openSignup()} tone="vega" className="text-base px-8 py-4">
                            Get Started
                        </PrimaryButton>
                    )}
                    demoCta={(
                        <GhostButton onClick={openDemo} tone="vega" className="text-base px-8 py-4">
                            View Live Demo
                        </GhostButton>
                    )}
                    onSignup={openSignup}
                />
                {/* The six core bands (R56): the tabbed suite hub, the
                    Nigeria differentiators, the trust/segments band, the
                    pricing matrix with its compact FAQ, and the navy
                    final-CTA close. */}
                <VegaSuite onSignup={openSignup} />
                <VegaWhyNigeria />
                <VegaTrust />
                <VegaPricing onContactSales={(s) => openContactSales(s || 'Vega Pricing')} onSignup={openSignup} />
                <VegaFinalCTA
                    onSignup={openSignup}
                    onContactSales={openContactSales}
                />
            </main>

            {/* Mobile sticky bottom CTA bar */}
            <VegaMobileStickyCTA onSignup={openSignup} onContactSales={() => openContactSales('Mobile Sticky CTA')} />

            {/* Chat floating action button */}
            <VegaChatFab onContactSales={() => openContactSales('WhatsApp FAB')} />

            <ContactSalesDrawer isOpen={isContactDrawerOpen} onClose={closeContactSales} source={contactDrawerSource} />
            <VegaFooter
                onPrivacyClick={() => navigate(vegaSiteConfig.legal.privacy)}
                onTermsClick={() => navigate(vegaSiteConfig.legal.terms)}
                onCookieClick={() => navigate(vegaSiteConfig.legal.cookies)}
                onUsageClick={() => navigate(vegaSiteConfig.legal.usage)}
                onResources={() => navigate(vegaSiteConfig.resourcesPath)}
                onContactSales={() => openContactSales('Footer')}
                onOpenProduct={openProductPage}
            />
        </div>
    );
};

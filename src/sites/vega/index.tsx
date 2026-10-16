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
import { VegaIndexLine } from './sections/VegaIndexLine';
import { VegaSuite } from './sections/VegaSuite';
import { VegaRecord } from './sections/VegaRecord';
import { VegaSegments } from './sections/VegaSegments';
import { VegaMattersLedger } from './sections/VegaMattersLedger';
import { VegaAIDrafting } from './sections/VegaAIDrafting';
import { VegaCourtRules } from './sections/VegaCourtRules';
import { VegaScaleOfCharges } from './sections/VegaScaleOfCharges';
import { VegaProcedure } from './sections/VegaProcedure';
import { VegaCredentials } from './sections/VegaCredentials';
import { VegaFAQInk } from './sections/VegaFAQInk';
import { VegaFinalCTA } from './sections/VegaFinalCTA';

/**
 * VegaSite — /vega, "The Chambers Standard" (P0 split), rearranged to the
 * LawPavilion composition (owner direction: "let us have it looking like
 * LawPavilion in terms of arrangement"). Their order — products grid first,
 * then the trust band, then the segment switch, then the alternating
 * feature deep-dives — maps onto Vega as:
 *
 *   hero → index line → THE SUITE (six instruments, the products grid) →
 *   THE RECORD (the trust band) → PRACTICE AREAS (the segment tabs) →
 *   the four deep-dive bands in alternating rhythm (matters ledger → ALOA
 *   ink band → court-rule chronology → scale of charges, flipped) →
 *   procedure → attestations → ink FAQ → colophon CTA.
 *
 * Same Night Chambers visual language as R22; only the ARRANGEMENT is
 * LawPavilion's. Zero shared marketing sections below the nav.
 */
export const VegaSite: React.FC = () => {
    const navigate = useNavigate();
    const { openModal } = useUI();
    useSiteChrome('vega');
    const { scrollRef, activeSection, scrollTo } = useSiteScroll(
        ['home', 'suite', 'practice-areas', 'features', 'howItWorks']
    );
    const openSignup = useSignupOpener('vega');
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
            style={{ background: 'var(--color-paper)', color: 'var(--color-ink)', colorScheme: 'dark' }}
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
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[300] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:rounded-lg focus:bg-vega-gilt focus:text-vega-night"
            >
                Skip to content
            </a>

            <main id="main-content" className="animate-swap-in">
                <VegaHero
                    eyebrow={'The Chambers Standard — Built by PracticePro'}
                    cta={(
                        <>
                            <PrimaryButton onClick={() => openSignup()} tone="vega" className="text-base px-8 py-4">
                                Get Started
                            </PrimaryButton>
                            <GhostButton onClick={() => openContactSales('Vega Hero')} tone="vega" className="text-base px-8 py-4">
                                Talk to Sales
                            </GhostButton>
                        </>
                    )}
                />
                <VegaIndexLine />
                {/* The LawPavilion arrangement: products grid, trust band,
                    segment tabs — then the deep-dives. */}
                <VegaSuite />
                <VegaRecord />
                <VegaSegments />
                <VegaMattersLedger />
                <VegaAIDrafting />
                <VegaCourtRules />
                <VegaScaleOfCharges />
                <VegaProcedure />
                <VegaCredentials />
                <VegaFAQInk />
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

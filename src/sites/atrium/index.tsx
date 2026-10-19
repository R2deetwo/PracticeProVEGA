import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../contexts/UIContext';
import { useSiteChrome } from '../shared/useSiteChrome';
import { useSiteScroll } from '../shared/useSiteScroll';
import { useSignupOpener, useContactSales } from '../shared/useSignupOpener';
import { PrimaryButton, GhostButton } from '../shared/ctas';
import ContactSalesDrawer from '../shared/ContactSalesDrawer';
import { AtriumNavBar, AtriumFooter, AtriumMobileStickyCTA, AtriumChatFab } from './AtriumShell';
import { AtriumHero } from './sections/AtriumHero';
import { AtriumStats } from './sections/AtriumStats';
import { AtriumFeatures } from './sections/AtriumFeatures';
import { AtriumTrust } from './sections/AtriumTrust';
import { AtriumAI } from './sections/AtriumAI';
import { AtriumEstate } from './sections/AtriumEstate';
import { AtriumReceipt } from './sections/AtriumReceipt';
import { AtriumSentryPass } from './sections/AtriumSentryPass';
import { AtriumHowItWorks } from './sections/AtriumHowItWorks';
import { AtriumWhyRunOn } from './sections/AtriumWhyRunOn';
import { AtriumFAQ } from './sections/AtriumFAQ';
import { AtriumFinalCTA } from './sections/AtriumFinalCTA';

/**
 * AtriumSite — /atrium, "The Well-Kept Estate" (P0 split). 12 bands, this
 * exact order: photo hero → sage stat band → features grid → trust strip →
 * light AI band → estate occupancy grid → resident receipt → gatehouse
 * Sentry Pass → 3-step onboarding → capability attestations → light FAQ →
 * sage close. Zero shared marketing sections below the nav.
 * Behaviour-identical to the pre-split atrium branch.
 */
export const AtriumSite: React.FC = () => {
    const navigate = useNavigate();
    const { openModal } = useUI();
    useSiteChrome('atrium');
    const { scrollRef, activeSection, scrollTo } = useSiteScroll(
        ['home', 'features', 'howItWorks']
    );
    const openSignup = useSignupOpener('atrium');
    const {
        isContactDrawerOpen,
        contactDrawerSource,
        openContactSales,
        closeContactSales,
    } = useContactSales();

    // W14 (navigation truth): from a product page, the mark is the way HOME.
    const handleBackToHub = () => {
        if (window.location.pathname !== '/') navigate('/');
    };

    // R21 (owner direction): selecting a product OPENS ITS OWN PAGE IN A
    // NEW TAB.
    const openProductPage = (p: 'vega' | 'atrium') => {
        window.open(p === 'vega' ? '/vega' : '/atrium', '_blank', 'noopener,noreferrer');
    };

    return (
        <div
            ref={scrollRef}
            className="h-[100dvh] w-full overflow-y-auto font-sans scroll-smooth md:[scrollbar-gutter:stable] theme-atrium"
            style={{ background: 'var(--color-paper)', color: 'var(--color-ink)', colorScheme: 'light' }}
            data-public-page
        >
            <AtriumNavBar
                activeSection={activeSection}
                scrollTo={scrollTo}
                onLogin={() => openModal('login', null, { productTheme: 'atrium' })}
                onSignup={openSignup}
                onResources={() => navigate('/atrium/resources')}
                onContactSales={() => openContactSales('Nav')}
                onOpenProduct={openProductPage}
                onBackToHub={handleBackToHub}
            />

            {/* Skip to content link — Atrium's focus state lands on its
                clay. */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[300] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:rounded-lg focus:bg-atrium-clay focus:text-white"
            >
                Skip to content
            </a>

            <main id="main-content" className="animate-swap-in">
                <AtriumHero
                    eyebrow={'Atrium · Built by PracticePro'}
                    cta={(
                        <>
                            <PrimaryButton onClick={() => openSignup()} tone="atrium" className="text-base px-8 py-4">
                                Get Started
                            </PrimaryButton>
                            <GhostButton onClick={() => openContactSales('Atrium Hero')} tone="atrium" className="text-base px-8 py-4">
                                Talk to Sales
                            </GhostButton>
                        </>
                    )}
                />
                <AtriumStats />
                <AtriumFeatures />
                <AtriumTrust />
                <AtriumAI />
                <AtriumEstate />
                <AtriumReceipt />
                <AtriumSentryPass />
                <AtriumHowItWorks />
                <AtriumWhyRunOn />
                <AtriumFAQ />
                <AtriumFinalCTA
                    onSignup={() => openSignup()}
                    onContactSales={() => openContactSales('Final CTA')}
                />
            </main>

            {/* Mobile sticky bottom CTA bar */}
            <AtriumMobileStickyCTA onSignup={openSignup} onContactSales={() => openContactSales('Mobile Sticky CTA')} />

            {/* Chat floating action button */}
            <AtriumChatFab onContactSales={() => openContactSales('WhatsApp FAB')} />

            <ContactSalesDrawer isOpen={isContactDrawerOpen} onClose={closeContactSales} source={contactDrawerSource} />
            <AtriumFooter
                onPrivacyClick={() => navigate('/privacy-policy')}
                onTermsClick={() => navigate('/terms-of-service')}
                onCookieClick={() => navigate('/cookie-policy')}
                onUsageClick={() => navigate('/usage-policy')}
                onResources={() => navigate('/atrium/resources')}
                onContactSales={() => openContactSales('Footer')}
                onOpenProduct={openProductPage}
            />
        </div>
    );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../contexts/UIContext';
import { useSiteChrome } from '../shared/useSiteChrome';
import { useSiteScroll } from '../shared/useSiteScroll';
import { useContactSales } from '../shared/useSignupOpener';
import ContactSalesDrawer from '../shared/ContactSalesDrawer';
import { HubNavBar, HubFooter, HubChatFab } from './HubShell';
import {
    HubHero,
    MarqueeStrip,
    PainMirrorSection,
    FluidSeam,
    WhatWeDoSection,
    OurWorkSection,
    HowWeWorkSection,
    AboutSection,
    HubFinalCTASection,
} from './sections/HubSections';

/**
 * HubSite — the PracticePro corporate home (/), moved from LandingPage.tsx
 * (P0 split). The company page: hero → pain mirror → what we do → our work
 * → how we work → about → contact CTA. No signup CTA lives here — trials
 * start on the product pages (W14). Behaviour-identical to the pre-split
 * hub branch.
 */
export const HubSite: React.FC = () => {
    const navigate = useNavigate();
    const { openModal } = useUI();
    useSiteChrome(null);
    const { scrollRef, activeSection, scrollTo } = useSiteScroll(
        ['home', 'whatWeDo', 'ourWork', 'howWeWork', 'about']
    );
    const {
        isContactDrawerOpen,
        contactDrawerSource,
        openContactSales,
        closeContactSales,
    } = useContactSales();

    // R21 (owner direction): selecting a product OPENS ITS OWN PAGE IN A
    // NEW TAB — Vega and Atrium are separate product surfaces.
    const openProductPage = (p: 'vega' | 'atrium') => {
        window.open(p === 'vega' ? '/vega' : '/atrium', '_blank', 'noopener,noreferrer');
    };

    return (
        <div
            ref={scrollRef}
            className="h-[100dvh] w-full overflow-y-auto font-sans scroll-smooth md:[scrollbar-gutter:stable]"
            style={{ background: 'var(--color-paper)', color: 'var(--color-ink)', colorScheme: 'light' }}
            data-public-page
        >
            <HubNavBar
                activeSection={activeSection}
                scrollTo={scrollTo}
                onResources={() => navigate('/resources')}
                onContactSales={() => openContactSales('Nav')}
                onOpenProduct={openProductPage}
            />

            {/* Skip to content link for accessibility. */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[300] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:rounded-lg focus:bg-primary-600 focus:text-white"
            >
                Skip to content
            </a>

            {/* W6: the corporate hub — the company's own home page. */}
            <main id="main-content" className="animate-swap-in">
                <HubHero
                    onContactSales={() => openContactSales('Hub Hero')}
                    scrollTo={scrollTo}
                />
                <MarqueeStrip />
                {/* W14: the mirror before the pitch. */}
                <PainMirrorSection onContactSales={() => openContactSales('Sound Familiar')} />
                {/* W8: liquid seams — each section pours into the next. */}
                <FluidSeam from="#0A101C" to="#FFFFFF" phase={0} />
                <WhatWeDoSection scrollTo={scrollTo} />
                <FluidSeam from="#FFFFFF" to="#0A101C" phase={1} />
                <OurWorkSection onContactSales={() => openContactSales('Our Work')} />
                <FluidSeam from="#0A101C" to="#FFFFFF" phase={2} />
                <HowWeWorkSection />
                <AboutSection onContactSales={() => openContactSales('About')} />
                <FluidSeam from="#FBFBF9" to="#0A101C" phase={3} />
                <HubFinalCTASection
                    onContactSales={() => openContactSales('Hub Final CTA')}
                    scrollTo={scrollTo}
                />
            </main>

            {/* Chat floating action button */}
            <HubChatFab onContactSales={() => openContactSales('WhatsApp FAB')} />

            <ContactSalesDrawer isOpen={isContactDrawerOpen} onClose={closeContactSales} source={contactDrawerSource} />
            <HubFooter
                onPrivacyClick={() => navigate('/privacy-policy')}
                onTermsClick={() => navigate('/terms-of-service')}
                onCookieClick={() => navigate('/cookie-policy')}
                onUsageClick={() => navigate('/usage-policy')}
                onResources={() => navigate('/resources')}
                onContactSales={() => openContactSales('Footer')}
            />
        </div>
    );
};

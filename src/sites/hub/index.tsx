import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteChrome } from '../shared/useSiteChrome';
import { useSiteScroll } from '../shared/useSiteScroll';
import { useContactSales } from '../shared/useSignupOpener';
import ContactSalesDrawer from '../shared/ContactSalesDrawer';
import { HubNavBar, HubFooter, WhatsAppFAB } from './HubShell';
import { HubHero } from './sections/HeroSection';
import { FluidSeam, MarqueeStrip } from './sections/MarqueeSection';
import { WhatWeDoSection } from './sections/WhatWeDoSection';
import { OurWorkSection } from './sections/OurWorkSection';
import { HowWeWorkSection } from './sections/HowWeWorkSection';
import { AboutSection } from './sections/AboutSection';
import { HubFinalCTASection } from './sections/HubFinalCTASection';

/**
 * HubSite — the PracticePro corporate hub (/), W18-era look restored on
 * the P0 split architecture (hub-restore task, Phase B).
 *
 * Section order (W18 composition, simplified R40): hero → marquee →
 * seam → What we do (the system core) → seam → Our work → seam → How we
 * work → About → seam → the dark aurora close.
 *
 * R40 (owner direction): the "Sound familiar?" pain-mirror page is
 * retired — "I don't think we need it any more." The hub leads with
 * what we do, not with the visitor's pain.
 *
 * Keeps: P0 site split, honest copy, brand naming, structured data,
 * routing (legal/resources pages, products open in new tabs), self-hosted
 * R20 fonts, 12px label floor.
 */
export const HubSite: React.FC = () => {
    const navigate = useNavigate();
    useSiteChrome(null);
    useEffect(() => {
        document.body.classList.add('site-hub');
        return () => document.body.classList.remove('site-hub');
    }, []);
    const { scrollRef, activeSection, scrollTo } = useSiteScroll(
        ['home', 'whatWeDo', 'ourWork', 'howWeWork', 'about']
    );
    const {
        isContactDrawerOpen,
        contactDrawerSource,
        openContactSales,
        closeContactSales,
    } = useContactSales();

    // R21 (routing keep): selecting a product OPENS ITS OWN PAGE IN A
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
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[300] focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
            >
                Skip to content
            </a>

            <main id="main-content" className="animate-swap-in">
                <HubHero
                    onContactSales={() => openContactSales('Hub Hero')}
                    scrollTo={scrollTo}
                />
                <MarqueeStrip />
                {/* R40: the pain-mirror ("Sound familiar?") retired by
                    owner direction — the hub leads with the work. */}
                {/* Liquid seams — each section pours into the next. */}
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

            {/* Chat FAB (no mobile sticky CTA on the hub — as in the era). */}
            <WhatsAppFAB onContactSales={() => openContactSales('WhatsApp FAB')} />

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

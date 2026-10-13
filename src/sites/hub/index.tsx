import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteChrome } from '../shared/useSiteChrome';
import { useSiteScroll } from '../shared/useSiteScroll';
import { useContactSales } from '../shared/useSignupOpener';
import ContactSalesDrawer from '../shared/ContactSalesDrawer';
import { HubNavBar, HubFooter, HubChatFab, HubMobileStickyCTA } from './HubShell';
import { HubHero } from './sections/HeroSection';
import { ProductsSection } from './sections/ProductsSection';
import { WhatWeBuildSection } from './sections/WhatWeBuildSection';
import { WorkSection } from './sections/WorkSection';
import { SoundFamiliarSection } from './sections/SoundFamiliarSection';
import { HowWeWorkSection, AboutSection, ContactSection } from './sections/ProcessSections';
import './tokens.css';

/**
 * HubSite v2 — the PracticePro systems studio home (/), P1 redesign.
 * Paper ground, ink type, 1px rules, one moss signal, Archivo display —
 * the company register (docs/brand/practicepro.md). Section order:
 * hero → 01 PRODUCTS → 02 WHAT WE BUILD → 03 WORK → 04 SOUND FAMILIAR →
 * 05 HOW WE WORK → 06 ABOUT → 07 CONTACT. No WebGL, no marquee, no
 * glass — the WebGL hero era is retired on the hub.
 */
export const HubSite: React.FC = () => {
    const navigate = useNavigate();
    useSiteChrome(null);
    useEffect(() => {
        document.body.classList.add('site-hub');
        return () => document.body.classList.remove('site-hub');
    }, []);
    const { scrollRef, activeSection, scrollTo } = useSiteScroll(
        ['home', 'products', 'work', 'howWeWork', 'about']
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
            className="theme-hub h-[100dvh] w-full overflow-y-auto font-sans scroll-smooth md:[scrollbar-gutter:stable]"
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
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[300] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:rounded-[2px] focus:bg-[#14171A] focus:text-[#F3F0E8]"
            >
                Skip to content
            </a>

            <main id="main-content">
                <HubHero
                    onContactSales={() => openContactSales('Hub Hero')}
                    scrollTo={scrollTo}
                />
                <ProductsSection onOpenProduct={openProductPage} />
                <WhatWeBuildSection />
                <WorkSection onContactSales={() => openContactSales('Our Work')} />
                <SoundFamiliarSection onContactSales={() => openContactSales('Sound Familiar')} />
                <HowWeWorkSection />
                <AboutSection />
                <ContactSection onContactSales={() => openContactSales('Contact')} />
            </main>

            {/* Mobile sticky CTA + chat button */}
            <HubMobileStickyCTA onContactSales={() => openContactSales('Mobile Sticky CTA')} />
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

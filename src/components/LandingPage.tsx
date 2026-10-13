
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
    Logo, CheckIcon, ZapIcon,
    ShieldCheckIcon,
    SearchIcon, ArrowLeftIcon, LockClosedIcon,
    // W6 (corporate hub): icons for the company landing sections.
    BriefcaseIcon, LinkIcon, UsersIcon, NairaCircleIcon, BrainIcon,
    MapPinIcon, ClipboardListIcon, PencilSquareIcon, ComputerDesktopIcon,
    CheckBadgeIcon, ExternalLinkIcon,
    // W7 (the wow site): hero scroll cue, modal close, device/stack markers.
    ChevronDownIcon, XMarkIcon, ChevronRightIcon, DeviceMobileIcon,
    // W9 (the living page): the workflow engine capability card.
    BellIcon,
    // W11 (real interiors + our tool): the Woosh temp-mail card.
    MailIcon
} from '../constants';
import { useUI } from '../contexts/UIContext';
// Legal pages and Resources are now routed via URL in App.tsx — no need to import them here.
import {
    // LandingPage-level signup routing still needs the ProductMode type;
    // tier machinery lives in the app (signup/billing) — the marketing
    // pages no longer display pricing tiers (owner direction, R21).
    type ProductMode,
} from '../constants/tiers';
// TASK 54: click-event-safe product normalization for the signup funnel.
import { normalizeSignupProduct } from '../utils/signupProduct';
import ContactSalesDrawer from './marketing/ContactSalesDrawer';
// W7 (the wow site): the hero's WebGL morphing orb. three.js is imported
// dynamically inside MorphScene, so it code-splits away from the app bundle.
import MorphScene from './marketing/MorphScene';
// W13 (the system core): a real 3D rendering above "What we can build for
// you" — seven glass modules orbiting a faceted core, one per capability.
// NO mark in this section (owner direction), and everything renders inside
// the scene's own canvas: nothing floats over the page's text, ever.
import SystemCoreScene from './marketing/SystemCoreScene';
import { SystemTour, type TourSystem } from './marketing/SystemTour';
// VEGA REBRAND ("The Chambers Standard"): /vega's editorial hero and its
// signature exhibits — court-rule chronology, Scale of Charges ledger,
// DraftPro tracked-changes. Presentational, zero raw buttons (ADR-0004).
import { VegaHero } from './marketing/vega/VegaHero';
import { VegaCourtRules } from './marketing/vega/VegaCourtRules';
import { VegaScaleOfCharges } from './marketing/vega/VegaScaleOfCharges';
// VEGA PASS A (full page rebuild): /vega no longer renders ANY shared
// marketing section. Every band below the hero is a Vega-owned component
// with its own layout physics — index line, ruled matters ledger, ink AI
// band, ledger pricing, procedure schedule, attestations, ink FAQ,
// colophon CTA.
// ATRIUM PASS B (full page rebuild): the shared template is deleted
// wholesale — every /atrium section below the hero is now an
// Atrium-owned component in src/components/marketing/atrium/ (stat
// band, features grid, trust strip, light AI band, SCE pricing,
// onboarding steps, attestations, light FAQ, sage close). Zero shared
// sections between the two product pages.
import { VegaIndexLine } from './marketing/vega/VegaIndexLine';
import { VegaMattersLedger } from './marketing/vega/VegaMattersLedger';
import { VegaAIDrafting } from './marketing/vega/VegaAIDrafting';
import { VegaProcedure } from './marketing/vega/VegaProcedure';
import { VegaCredentials } from './marketing/vega/VegaCredentials';
import { VegaFAQInk } from './marketing/vega/VegaFAQInk';
import { VegaFinalCTA } from './marketing/vega/VegaFinalCTA';
// R21 product identity: the product marks (nav, footer, dropdowns, work
// cards) and the per-route document branding (favicon, title, OG card).
import { VegaMark, AtriumMark } from './marketing/brand/ProductMarks';
import { useProductBranding } from './marketing/brand/useProductBranding';
import { AtriumHero } from './marketing/atrium/AtriumHero';
import { AtriumReceipt } from './marketing/atrium/AtriumReceipt';
import { AtriumEstate } from './marketing/atrium/AtriumEstate';
import { AtriumSentryPass } from './marketing/atrium/AtriumSentryPass';
import { AtriumStats } from './marketing/atrium/AtriumStats';
import { AtriumFeatures } from './marketing/atrium/AtriumFeatures';
import { AtriumTrust } from './marketing/atrium/AtriumTrust';
import { AtriumAI } from './marketing/atrium/AtriumAI';
import { AtriumHowItWorks } from './marketing/atrium/AtriumHowItWorks';
import { AtriumWhyRunOn } from './marketing/atrium/AtriumWhyRunOn';
import { AtriumFAQ } from './marketing/atrium/AtriumFAQ';
import { AtriumFinalCTA } from './marketing/atrium/AtriumFinalCTA';
// W1 (website repositioning): new interactive elements use the ui/ Button
// primitive per ADR-0004 — the raw-element ratchet must not grow.
import { Button } from './ui';

// ─── SHARED PRIMITIVE COMPONENTS ────────────────────────────────────────────

/**
 * useScrollReveal — subtle fade-in-up when element enters viewport.
 * Returns a ref to attach to the element. Professional, not bouncy.
 * Respects prefers-reduced-motion (CSS handles the actual disable).
 */
function useScrollReveal<T extends HTMLElement = HTMLDivElement>(options?: { threshold?: number; rootMargin?: string }) {
    const ref = useRef<T>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // If IntersectionObserver isn't supported, just show the element.
        if (!('IntersectionObserver' in window)) {
            el.classList.add('is-visible');
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: options?.threshold ?? 0.15,
            rootMargin: options?.rootMargin ?? '0px 0px -60px 0px',
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return ref;
}

/**
 * useScrollParallax — subtle vertical parallax on scroll.
 * Returns a ref to attach to the image element. The image translates
 * slowly as the user scrolls, creating depth. Max offset ±20px.
 */
function useScrollParallax<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // Skip parallax if user prefers reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let rafId: number | null = null;
        const update = () => {
            const rect = el.getBoundingClientRect();
            const viewportH = window.innerHeight;
            // How far is the element's center from the viewport center?
            const elementCenter = rect.top + rect.height / 2;
            const viewportCenter = viewportH / 2;
            const distance = elementCenter - viewportCenter;
            // Normalize to -1..1 (element fully in viewport)
            const normalized = Math.max(-1, Math.min(1, distance / viewportCenter));
            // Apply parallax: max ±16px translate
            const offset = normalized * -16;
            el.style.transform = `translateY(${offset}px) scale(1.08)`;
            rafId = null;
        };
        const onScroll = () => {
            if (rafId === null) rafId = requestAnimationFrame(update);
        };
        update(); // Initial position
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, []);
    return ref;
}

/**
 * useSectionProgress (W7) — how far the viewport has scrolled through a
 * section, 0..1. Runs a rAF loop only while the section is on screen and
 * reads getBoundingClientRect(), so it works no matter which element
 * owns the scrollbar (the landing page scrolls inside its own div).
 * Returns a ref; the caller reads progress via the callback.
 */
function useSectionProgress<T extends HTMLElement = HTMLDivElement>(onProgress: (p: number) => void) {
    const ref = useRef<T>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let rafId: number | null = null;
        let inView = false;
        const io = new IntersectionObserver((entries) => {
            inView = entries.some((en) => en.isIntersecting);
            if (inView && rafId === null) {
                rafId = requestAnimationFrame(tick);
            }
        }, { threshold: 0 });
        const tick = () => {
            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight;
            // 0 when the section's top hits the viewport bottom; 1 when its
            // bottom reaches the viewport top. Clamped for safety.
            const traveled = vh - rect.top;
            const total = rect.height + vh;
            const p = Math.min(1, Math.max(0, traveled / total));
            onProgress(p);
            rafId = inView ? requestAnimationFrame(tick) : null;
        };
        io.observe(el);
        return () => {
            io.disconnect();
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [onProgress]);
    return ref;
}

/** Primary CTA button — the ramp fill (brand.md §4.1 sanctioned gradient
 *  #2) on the 6px interactive radius, neutral elevation only.
 *  tone='vega' is the Night Chambers register: a brass fill with night
 *  text — the plaque on the dark page (amber-family gilt is the Vega
 *  product accent, not page decoration).
 *  tone='atrium' is the Well-Kept Estate register: a flat emerald fill
 *  (the Atrium accent #059669), never a gradient, never moss. */
const PrimaryButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string; tone?: 'green' | 'vega' | 'atrium' }> = ({ onClick, children, className = '', tone = 'green' }) => (
    <button
        onClick={onClick}
        className={`relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm transition-all duration-300 active:scale-[0.97] ${
            tone === 'vega'
                ? 'bg-vega-gilt text-vega-night hover:bg-vega-gilt-bright shadow-sm'
                : tone === 'atrium'
                ? 'bg-atrium-emerald text-white hover:bg-emerald-700 shadow-sm'
                : 'text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-md'
        } ${className}`}
    >
        {children}
    </button>
);

/** Ghost/secondary button — tone='vega' is the night-hairline variant
 *  (a quiet white rule that warms to gilt on hover);
 *  tone='atrium' is the warm emerald-outline variant for the photo hero. */
const GhostButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string; tone?: 'green' | 'vega' | 'atrium' }> = ({ onClick, children, className = '', tone = 'green' }) => (
    <button
        onClick={onClick}
        className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm transition-all duration-300 active:scale-[0.97] ${
            tone === 'vega'
                ? 'bg-transparent text-vega-parchment border border-white/25 hover:border-vega-gilt hover:text-vega-gilt-bright'
                : tone === 'atrium'
                ? 'bg-white/85 text-emerald-700 border border-emerald-600/40 backdrop-blur-sm hover:border-emerald-600 hover:bg-white'
                : 'bg-white/70 text-slate-800 border border-slate-200 backdrop-blur-sm hover:bg-white'
        } ${className}`}
    >
        {children}
    </button>
);

// ─── NAVBAR ─────────────────────────────────────────────────────────────────

const NAV_LINKS: { label: string; id: string; isPage?: boolean }[] = [
    { label: 'Features', id: 'features' },
    { label: 'Pricing', id: 'pricing' },
    { label: 'Resources', id: 'resources', isPage: true },
];

const NavBar: React.FC<{
    activeSection: string;
    scrollTo: (id: string) => void;
    onLogin: () => void;
    onSignup: () => void;
    onResources: () => void;
    onContactSales: () => void;
    activeProduct: 'vega' | 'atrium';
    onOpenProduct: (p: 'vega' | 'atrium') => void;
    productChosen: boolean;
    onBackToHub: () => void;
}> = ({ activeSection, scrollTo, onLogin, onSignup, onResources, onContactSales, activeProduct, onOpenProduct, productChosen, onBackToHub }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    // R22 "The Night Chambers": while /vega is shown, the shared light nav
    // chrome flips to a dark glass register — night surface, parchment
    // text, gilt accents. The hub and /atrium keep the light chrome.
    const onVega = productChosen && activeProduct === 'vega';
    const navLinkCls = onVega
        ? 'text-slate-300 hover:text-white hover:bg-white/5'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100';
    const navLinkActiveCls = onVega ? 'text-vega-gilt-bright' : 'text-primary-700';
    const menuItemCls = onVega
        ? 'text-slate-300 hover:bg-white/5 hover:text-white'
        : 'text-slate-700 hover:bg-slate-50';
    // Products dropdown/menu item classes — hoisted out of the JSX so the
    // NavBar adds NO brace-then-vega-ternary marker sequence: the
    // websiteRepositioning test extracts the /vega RENDER BRANCH by that
    // exact marker; a NavBar copy would hijack the match.
    const vegaItemCls = activeProduct === 'vega'
        ? (onVega ? 'bg-white/10 text-vega-gilt-bright' : 'bg-primary-50 text-primary-700')
        : (onVega ? 'text-slate-300 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900');
    const atriumItemCls = activeProduct === 'atrium'
        ? 'bg-emerald-50 text-emerald-700'
        : (onVega ? 'text-slate-300 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900');
    // Products dropdown — click-toggle (not hover) so iPad/tablet touch users
    // can open it. Hover is unreliable on iPadOS Safari.
    const [productsOpen, setProductsOpen] = React.useState(false);
    // W14: the old onBlur+setTimeout auto-close was fragile — a blur that
    // landed between mousedown and click (touch, assistive tech, automation)
    // closed the menu before the choice registered, which read as "the
    // Products menu doesn't do anything". The robust pattern instead:
    // outside-pointer closes, Escape closes, choosing closes.
    const productsRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (!productsOpen) return;
        const onPointerDown = (e: PointerEvent) => {
            if (productsRef.current && !productsRef.current.contains(e.target as Node)) setProductsOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProductsOpen(false); };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [productsOpen]);

    // W8: the fluid nav — a single pill that morphs between the section links
    // as the visitor scrolls (and between page modes), instead of per-button
    // background swaps. Purely decorative; the buttons sit above it.
    const navRef = React.useRef<HTMLElement>(null);
    const pillRef = React.useRef<HTMLDivElement>(null);
    React.useLayoutEffect(() => {
        const movePill = () => {
            const nav = navRef.current, pill = pillRef.current;
            if (!nav || !pill) return;
            const btn = nav.querySelector<HTMLElement>(`[data-nav-id="${activeSection}"]`);
            if (!btn || btn.getBoundingClientRect().width === 0) {
                pill.classList.remove('is-live');
                return;
            }
            const nb = nav.getBoundingClientRect();
            const bb = btn.getBoundingClientRect();
            pill.style.width = `${Math.round(bb.width)}px`;
            pill.style.transform = `translate(${Math.round(bb.left - nb.left)}px, -50%)`;
            pill.classList.add('is-live');
        };
        movePill();
        window.addEventListener('resize', movePill);
        return () => window.removeEventListener('resize', movePill);
    }, [activeSection, productChosen, productsOpen, mobileMenuOpen]);

    // Close mobile menu on product switch or navigation
    const handleNavClick = (fn: () => void) => {
        setMobileMenuOpen(false);
        fn();
    };

    return (
    <header className="fixed top-0 left-0 right-0 z-[250] transition-all duration-300 pt-safe">
        {/* Glass layer — light on the hub + /atrium, night glass on /vega */}
        <div className={`absolute inset-0 backdrop-blur-xl border-b transition-colors duration-500 ${
            onVega ? 'bg-vega-night/85 border-white/10' : 'bg-white/80 border-slate-200/60'
        }`} />

        <div className="relative container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Logo + back-to-hub breadcrumb */}
            <div className="flex items-center gap-3">
                {/* W14 (navigation truth): from a product page, the mark is the
                    way HOME — it navigates back to the company page with the
                    morphing crystal, exactly what every visitor expects a
                    logo to do. On the hub it simply scrolls to the top. The
                    old version only ever scrolled, so from /atrium the logo
                    appeared to "do nothing". */}
                {productChosen ? (
                    /* R21: on a product page the brand is the PRODUCT's own
                       mark + wordmark, with the company retained as the
                       attribution line — PracticePro stays the company that
                       owns the products; Vega and Atrium get their own
                       iconography. */
                    <button
                        onClick={onBackToHub}
                        aria-label={activeProduct === 'vega' ? 'Vega — a PracticePro product, back to all products' : 'Atrium — a PracticePro product, back to all products'}
                        className="flex items-center gap-2.5 group"
                    >
                        {activeProduct === 'vega'
                            ? <VegaMark className="h-8 w-8 group-hover:scale-105 transition-transform" />
                            : <AtriumMark className="h-8 w-8 group-hover:scale-105 transition-transform" />}
                        <span className="flex flex-col items-start leading-none">
                            <span className={`text-lg font-bold tracking-tight ${activeProduct === 'vega' ? 'font-vega text-vega-parchment' : activeProduct === 'atrium' ? 'font-display text-slate-900' : 'font-display text-slate-900'}`}>
                                {activeProduct === 'vega' ? 'Vega' : 'Atrium'}
                            </span>
                            <span className={`font-mono text-2xs tracking-[0.18em] mt-1 ${onVega ? 'text-slate-500' : 'text-slate-400'}`}>BY PRACTICEPRO</span>
                        </span>
                    </button>
                ) : (
                    <button
                        onClick={() => scrollTo('home')}
                        aria-label="PracticePro Systems — home"
                        className="flex items-center gap-2 group"
                    >
                        <Logo className="h-7 w-7 text-primary-500 group-hover:scale-105 transition-transform drop-shadow-sm" />
                        <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center">
                            Practice<span className="text-primary-500">Pro</span>
                        </span>
                    </button>
                )}
                {productChosen && (
                    <button
                        onClick={onBackToHub}
                        className={`hidden md:flex items-center gap-1 pl-3 border-l h-7 text-2xs font-black uppercase tracking-widest transition-colors ${
                            onVega
                                ? 'border-white/15 text-slate-400 hover:text-vega-gilt-bright'
                                : 'border-slate-200 text-slate-400 hover:text-primary-500'
                        }`}
                        aria-label="Back to all products"
                    >
                        <ArrowLeftIcon className="w-3 h-3" />
                        <span>All Products</span>
                    </button>
                )}
            </div>

            {/* Desktop Links — shown on lg+ (1024px+). Raised from md: to lg:
                because iPad portrait (768-820px) was showing this nav and
                overflowing horizontally on /vega and /atrium pages (9 items
                don't fit in 720px). iPad portrait now uses the mobile menu. */}
            <nav ref={navRef} className="hidden lg:flex items-center gap-1 relative" aria-label="Main navigation">
                {/* W8: the fluid pill — it morphs to whichever section link is
                    active. Decorative; the links themselves sit above it. */}
                <div ref={pillRef} className="w8-nav-pill" aria-hidden="true" />
                {/* Products dropdown — click-toggle (was hover-only, which
                    broke iPad/tablet touch). Click to open, click again or
                    click outside to close. */}
                <div className="relative" ref={productsRef}>
                    <button
                        onClick={() => setProductsOpen(o => !o)}
                        aria-expanded={productsOpen}
                        aria-haspopup="true"
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-all duration-200 ${navLinkCls}`}
                    >
                        Products
                        <svg className={`w-4 h-4 ml-0.5 opacity-60 transition-transform ${productsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {productsOpen && (
                        <div className="absolute top-full left-0 pt-1 w-[210px]">
                            <div className={`border rounded-lg shadow-xl flex flex-col p-1 ${onVega ? 'bg-vega-night-2 border-white/10' : 'bg-white border-slate-200'}`}>
                                <button
                                    onClick={() => { onOpenProduct('vega'); setProductsOpen(false); }}
                                    className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${vegaItemCls}`}
                                >
                                    <VegaMark className="w-4 h-4" />
                                    <span className="flex-1">Vega</span>
                                    <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40" />
                                </button>
                                <button
                                    onClick={() => { onOpenProduct('atrium'); setProductsOpen(false); }}
                                    className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${atriumItemCls}`}
                                >
                                    <AtriumMark className="w-4 h-4" />
                                    <span className="flex-1">Atrium</span>
                                    <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                {productChosen && (
                    <>
                    <button
                        onClick={() => scrollTo('features')}
                        data-nav-id="features"
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === 'features'
                                ? navLinkActiveCls
                                : navLinkCls
                        }`}
                    >
                        Features
                    </button>
                    <button
                        onClick={() => scrollTo('howItWorks')}
                        data-nav-id="howItWorks"
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === 'howItWorks'
                                ? navLinkActiveCls
                                : navLinkCls
                        }`}
                    >
                        How It Works
                    </button>
                    </>
                )}
                {/* W6 (corporate hub): on the company home page, the nav walks
                    the corporate sections instead of a product's. ui/Button
                    (bare) per ADR-0004 — the ratchet must not grow. */}
                {!productChosen && (
                    <>
                    <Button
                        variant="bare"
                        data-nav-id="whatWeDo"
                        onClick={() => scrollTo('whatWeDo')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === 'whatWeDo'
                                ? 'text-primary-700'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        What We Do
                    </Button>
                    <Button
                        variant="bare"
                        data-nav-id="ourWork"
                        onClick={() => scrollTo('ourWork')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === 'ourWork'
                                ? 'text-primary-700'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        Our Work
                    </Button>
                    <Button
                        variant="bare"
                        data-nav-id="howWeWork"
                        onClick={() => scrollTo('howWeWork')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === 'howWeWork'
                                ? 'text-primary-700'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        How We Work
                    </Button>
                    <Button
                        variant="bare"
                        data-nav-id="about"
                        onClick={() => scrollTo('about')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === 'about'
                                ? 'text-primary-700'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        About
                    </Button>
                    </>
                )}
                <button
                    onClick={onResources}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${navLinkCls}`}
                >
                    Resources
                </button>
                <button
                    onClick={onContactSales}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${navLinkCls}`}
                >
                    Contact
                </button>
            </nav>

            {/* Right Actions — W8: auth lives with the products. On the
                company page the right hand offers a quiet conversation
                instead; Log In / Start Free Trial render only on the product
                pages, next to the systems they open. */}
            <div className="flex items-center gap-2">
                <div className={`hidden lg:block h-4 w-px mx-1 ${onVega ? 'bg-white/15' : 'bg-slate-200'}`} />

                {productChosen ? (
                    <>
                        <button
                            onClick={onLogin}
                            className={`hidden lg:block px-4 py-2 text-sm font-semibold transition-colors ${
                                onVega ? 'text-slate-300 hover:text-vega-gilt-bright' : 'text-slate-700 hover:text-primary-600'
                            }`}
                        >
                            Log In
                        </button>
                        {/* TASK 54: invoke with NO arguments — passing the handler
                            directly leaked the click event into openSignup's
                            productOverride (see comment at openSignup). */}
                        <PrimaryButton
                            onClick={() => onSignup()}
                            tone={activeProduct === 'vega' ? 'vega' : activeProduct === 'atrium' ? 'atrium' : 'green'}
                            className="!px-3 !py-2 sm:!px-3 sm:!py-1.5 !rounded-sm !text-xs sm:!text-2xs ml-1 lg:ml-2 lg:!text-sm lg:!px-5 lg:!py-2.5 lg:!rounded-sm"
                        >
                            Start Free Trial
                        </PrimaryButton>
                    </>
                ) : (
                    <Button
                        variant="bare"
                        onClick={onContactSales}
                        className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 hover:text-primary-600 transition-colors min-h-[2rem]"
                    >
                        Talk to us <span aria-hidden="true">→</span>
                    </Button>
                )}

                {/* Mobile hamburger button — shown below lg (1024px) so iPad
                    portrait uses the mobile menu instead of the overflowed
                    desktop nav. */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className={`lg:hidden flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                        onVega ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    aria-label="Toggle menu"
                    aria-expanded={mobileMenuOpen}
                >
                    {mobileMenuOpen ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    )}
                </button>
            </div>
        </div>

        {/* Mobile overlay menu — shown below lg (1024px). Raised from md:
            so iPad portrait uses this instead of the overflowed desktop nav. */}
        {mobileMenuOpen && (
            <div className={`lg:hidden fixed inset-0 top-[calc(4rem+env(safe-area-inset-top,0px))] z-[240] overflow-y-auto ${onVega ? 'bg-vega-night' : 'bg-white'}`}>
                <nav className="container mx-auto px-4 py-6 flex flex-col gap-1" aria-label="Mobile navigation">
                    {/* Back-to-hub affordance — mobile users on /vega or /atrium
                        need a way to get back to the hub page. Previously this
                        was only available via the (invisible on touch) hover
                        breadcrumb in the desktop nav. */}
                    {productChosen && (
                        <button
                            onClick={() => handleNavClick(onBackToHub)}
                            className={`w-full text-left px-4 py-3 mb-2 rounded-lg text-sm font-semibold flex items-center gap-3 ${menuItemCls}`}
                        >
                            <ArrowLeftIcon className="w-5 h-5 opacity-70" /> All Products
                        </button>
                    )}
                    <div className="mb-2">
                        <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 px-4 py-2">Products</p>
                        <button onClick={() => handleNavClick(() => onOpenProduct('vega'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-3 ${vegaItemCls}`}>
                            <VegaMark className="w-5 h-5" /> Vega — For Law Firms <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                        </button>
                        <button onClick={() => handleNavClick(() => onOpenProduct('atrium'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-3 ${atriumItemCls}`}>
                            <AtriumMark className="w-5 h-5" /> Atrium — For Property Managers <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                        </button>
                    </div>
                    {productChosen && (
                        <>
                        <button onClick={() => handleNavClick(() => scrollTo('features'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold ${menuItemCls}`}>Features</button>
                        <button onClick={() => handleNavClick(() => scrollTo('howItWorks'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold ${menuItemCls}`}>How It Works</button>
                        </>
                    )}
                    {!productChosen && (
                        <>
                        <Button variant="bare" onClick={() => handleNavClick(() => scrollTo('whatWeDo'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">What We Do</Button>
                        <Button variant="bare" onClick={() => handleNavClick(() => scrollTo('ourWork'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Our Work</Button>
                        <Button variant="bare" onClick={() => handleNavClick(() => scrollTo('howWeWork'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">How We Work</Button>
                        <Button variant="bare" onClick={() => handleNavClick(() => scrollTo('about'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">About</Button>
                        </>
                    )}
                    <button onClick={() => handleNavClick(onResources)} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold ${menuItemCls}`}>Resources</button>
                    <button onClick={() => handleNavClick(onContactSales)} className={`w-full text-left px-4 py-3 rounded-sm text-sm font-semibold ${menuItemCls}`}>Contact</button>
                    <div className={`h-px my-3 ${onVega ? 'bg-white/10' : 'bg-slate-200'}`} />
                    {productChosen ? (
                        <>
                            <button onClick={() => handleNavClick(onLogin)} className={`w-full text-left px-4 py-3 rounded-sm text-sm font-semibold ${menuItemCls}`}>Log In</button>
                            <PrimaryButton onClick={() => handleNavClick(onSignup)} className="!w-full !py-3 !rounded-sm !text-sm mt-2">
                                Start Free Trial
                            </PrimaryButton>
                            <p className="text-2xs text-slate-400 text-center mt-4">No credit card required · 30-day free trial</p>
                        </>
                    ) : (
                        <Button
                            variant="bare"
                            onClick={() => handleNavClick(onContactSales)}
                            className="!w-full !py-3 !rounded-lg !text-sm font-semibold text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600"
                        >
                            Talk to us about your system
                        </Button>
                    )}
                </nav>
            </div>
        )}
    </header>
    );
};

// ─── FOOTER ─────────────────────────────────────────────────────────────────

const Footer: React.FC<{ onPrivacyClick: () => void; onTermsClick: () => void; onCookieClick: () => void; onUsageClick: () => void; onResources: () => void; onContactSales: () => void; activeProduct: 'vega' | 'atrium'; onOpenProduct: (p: 'vega' | 'atrium') => void; productChosen: boolean }> = ({ onPrivacyClick, onTermsClick, onCookieClick, onUsageClick, onResources, onContactSales, activeProduct, onOpenProduct, productChosen }) => (
    <footer className="bg-slate-950 border-t border-white/5 py-10 md:py-16 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-16">
        <div className="container mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-10 mb-12">
                {/* Brand */}
                <div>
                    <div className="flex items-center gap-2.5 mb-4">
                        {productChosen ? (
                            /* R21: the product's own mark on its page — the
                               company stays as the attribution line. */
                            <>
                                {activeProduct === 'vega' ? <VegaMark className="h-7 w-7" /> : <AtriumMark className="h-7 w-7" />}
                                <span className="flex flex-col leading-none">
                                    <span className={`text-white font-bold text-lg ${activeProduct === 'vega' ? 'font-vega' : 'font-display'}`}>
                                        {activeProduct === 'vega' ? 'Vega' : 'Atrium'}
                                    </span>
                                    <span className="font-mono text-2xs tracking-[0.18em] text-slate-400 mt-1">BY PRACTICEPRO</span>
                                </span>
                            </>
                        ) : (
                            <>
                                <Logo className="h-6 w-6 text-primary-500" aria-hidden="true" />
                                <span className="text-white font-bold text-lg flex items-center">
                                    Practice<span className="text-primary-500">Pro</span>
                                </span>
                            </>
                        )}
                    </div>
                    {/* W6/W7: corporate tagline — the company builds AND runs
                        systems, for itself and for clients. Broadened per owner
                        direction: Lagos is where we work from, not a limit on
                        where we work. */}
                    <p className="text-slate-500 text-sm leading-relaxed max-w-xs">We design, build and run the systems businesses manage their affairs with — our products Vega and Atrium, and custom commissions for clients. From Lagos, for businesses anywhere.</p>
                    {productChosen && (
                        <div className="mt-4 flex items-center gap-3">
                            <button
                                onClick={() => onOpenProduct(activeProduct === 'vega' ? 'atrium' : 'vega')}
                                className={`text-2xs font-bold uppercase tracking-widest flex items-center gap-1.5 py-1 px-2 rounded-lg border transition-all ${activeProduct === 'vega'
                                    ? 'text-vega-claret hover:text-vega-claret/80 border-vega-claret/30 hover:bg-vega-claret/10'
                                    : 'text-emerald-400 hover:text-emerald-300 border-emerald-400/30 hover:bg-emerald-400/10'}`}
                            >
                                Open {activeProduct === 'vega' ? 'Atrium' : 'Vega'} <span className="text-xs">↗</span>
                            </button>
                        </div>
                    )}
                </div>
                {/* Product — only rendered when a product is chosen */}
                {productChosen && (
                    <div>
                        <p className="font-mono text-slate-400 text-xs font-medium uppercase tracking-widest mb-4">Product</p>
                        <div className="flex flex-col gap-2.5">
                            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Features</button>
                            <button onClick={onResources} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Resources</button>
                            {/* ROUND 9: Changelog previously scrolled to #pricing —
                                the actual changelog (What's New) lives on the
                                Resources page, so route there instead. */}
                            <button onClick={onResources} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Changelog</button>
                        </div>
                    </div>
                )}
                {/* Portals — only rendered when a product is chosen */}
                {productChosen && (
                    <div>
                        <p className="font-mono text-slate-400 text-xs font-medium uppercase tracking-widest mb-4">Portals</p>
                        <div className="flex flex-col gap-2.5">
                            {activeProduct === 'vega' && (
                                <a href="/portal/client/login" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Client Portal</a>
                            )}
                            {activeProduct === 'atrium' && (
                                <a href="/portal/tenant/login" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Residents' Portal</a>
                            )}
                        </div>
                    </div>
                )}
                {/* Products — hub mode: the company's portfolio. On product pages
                    the Product column (Features/Pricing/…) serves this role. */}
                {!productChosen && (
                    <div>
                        <p className="font-mono text-slate-400 text-xs font-medium uppercase tracking-widest mb-4">Products &amp; Work</p>
                        <div className="flex flex-col gap-2.5">
                            {/* W14: real anchors to the real pages — the
                                footer navigates exactly like the Products
                                menu does (and right-click / open-in-new-tab
                                works, which a button never offered). */}
                            <a href="/vega" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                                Vega — Legal Practice OS ↗
                            </a>
                            <a href="/atrium" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                                Atrium — Property Management OS ↗
                            </a>
                            <Button variant="bare" onClick={onContactSales} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors min-h-[2rem] flex items-center">
                                Komplete — both, for real-estate attorneys
                            </Button>
                            {/* W6: the company's other line of business — custom
                                client systems (Kozy Care is the live example). */}
                            <a href="https://kozycare.ng" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                                Kozy Care — a client build ↗
                            </a>
                            {/* W11: our own free tool — live and public. */}
                            <a href="https://woosh.dpdns.org" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                                Woosh — free temp email ↗
                            </a>
                            <Button variant="bare" onClick={onContactSales} className="text-primary-400 hover:text-primary-300 text-sm text-left font-semibold transition-colors min-h-[2rem] flex items-center">
                                Custom systems — built to order →
                            </Button>
                        </div>
                    </div>
                )}
                {/* Company — always on the far right (column 4) */}
                <div className={productChosen ? '' : 'md:col-start-4'}>
                    <p className="font-mono text-slate-400 text-xs font-medium uppercase tracking-widest mb-4">Company</p>
                    <div className="flex flex-col gap-1">
                        <span onClick={onPrivacyClick} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors min-h-[2rem] flex items-center">Privacy Policy</span>
                        <span onClick={onTermsClick} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors min-h-[2rem] flex items-center">Terms of Service</span>
                        <span onClick={onCookieClick} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors min-h-[2rem] flex items-center">Cookie Policy</span>
                        <span onClick={onUsageClick} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors min-h-[2rem] flex items-center">Usage Policy</span>
                        <span onClick={onContactSales} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors min-h-[2rem] flex items-center">Contact Sales</span>
                        <a href="mailto:dpo@practicepro.ng" className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors min-h-[2rem] flex items-center">Email Us</a>
                        <span onClick={onResources} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors min-h-[2rem] flex items-center">Security</span>
                    </div>
                </div>
            </div>
            <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-400">© {new Date().getFullYear()} PracticePro Systems Limited Lagos, Nigeria.</p>
                {/* W2: the product→company attribution mark. */}
                <p className="text-xs text-slate-500 order-last md:order-none">Vega &amp; Atrium · Built by PracticePro</p>
                <p className="text-xs text-slate-500">NDPA 2023 Compliant · TLS 1.3 Encrypted · *Encryption provided by infrastructure</p>
            </div>
        </div>
    </footer>
);

// ─── CORPORATE HUB (PracticePro Systems home — no product chosen) ───────────
// W6 (2026-10-07, owner direction): the root page is no longer a thin product
// picker. It is the corporate home of PracticePro Systems — the company that
// builds and runs the systems businesses manage their affairs with. The page
// sells the BUILDER: what we can do (services already shipping inside Vega,
// Atrium and Kozy Care), what we have done (the portfolio), how we work, and
// how to reach us. Vega and Atrium remain one click away (nav, work cards,
// footer); Kozy Care is presented as a client commission — proof we build
// for other people's businesses too.
//
// P8 (honest marketing) still applies: every claim below maps to shipped,
// verifiable behaviour. No invented clients, no invented metrics.

/**
 * W17 — the scaling noun, refined (owner direction). The promise is
 * “Build systems that help scale your X”, X = a noun the owner of a
 * Nigerian business instantly recognises as theirs — practice, firm,
 * clinic, pharmacy, school, restaurant, organization — with
 * “business” as the universal opener.
 *
 * W16 held the line shape by padding every noun into a box as wide as
 * “organization” — which left a long dead gap after every shorter word
 * (“too much of a gap with all of them except organizations”), and a
 * redundant full stop. W17 replaces the fixed box with a MEASURED,
 * GLIDING slot: every noun is measured in the headline's exact font
 * (responsive sizes, web-font swap) and the slot's width eases to
 * precisely the live noun — the sentence always looks typeset, and the
 * only motion is the word exchanging itself while the line's tail
 * breathes with it (nothing else in the sentence moves).
 *
 * Line count can never change: below sm the noun owns its own line
 * (an sm:hidden break after “scale your”), and from sm up
 * “scale your <noun>” is the final line, sized for the widest noun
 * (geometry verified in W16). SSR/no-JS/reduced-motion degrade to the
 * static first noun.
 *
 * W18 (rendering fix, owner: “your X is not clear or rendering
 * properly”): the gradient is painted PER SPAN. One ancestor-clipped
 * gradient cannot paint through this slot — the live span is an
 * inline-block that carries transform + filter (its own stacking
 * context), and several browsers exclude such descendants from the
 * ancestor's background-clip:text, leaving the noun colour:transparent
 * and effectively invisible. Each text-bearing span now carries its
 * own clipped gradient (“scale your”: mint → emerald; the noun:
 * emerald → green), and at rest the slot holds no transform/filter
 * (none still transitions to value, so the exchange stays fluid).
 */
const SCALE_NOUNS = [
    'business',
    'practice',
    'firm',
    'clinic',
    'pharmacy',
    'school',
    'restaurant',
    'organization',
];

const ScalingNoun: React.FC = () => {
    const [i, setI] = useState(0);
    const [on, setOn] = useState(true);
    const [widths, setWidths] = useState<number[] | null>(null);
    const measureRef = useRef<HTMLSpanElement>(null);

    // Measure every noun in the live headline font so the slot can
    // glide to exactly the live word. The measuring twin is absolute +
    // invisible: fully laid out (so every width is real) but never
    // part of the sentence's own layout.
    useEffect(() => {
        const measure = () => {
            const host = measureRef.current;
            if (!host) return;
            const next = Array.from(host.children).map(
                (c) => (c as HTMLElement).getBoundingClientRect().width,
            );
            if (next.length === SCALE_NOUNS.length && next.every((w) => w > 0)) {
                setWidths(next);
            }
        };
        measure();
        // Space Grotesk lands async — remeasure once it does, and again
        // whenever a responsive font-size change resizes the twin.
        if (document.fonts?.ready) {
            document.fonts.ready.then(() => measure()).catch(() => {});
        }
        const ro = new ResizeObserver(() => measure());
        if (measureRef.current) ro.observe(measureRef.current);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let swapId: number | null = null;
        const tick = window.setInterval(() => {
            setOn(false);
            if (swapId !== null) window.clearTimeout(swapId);
            swapId = window.setTimeout(() => {
                setI((v) => (v + 1) % SCALE_NOUNS.length);
                setOn(true);
            }, 380);
        }, 2700);
        return () => {
            window.clearInterval(tick);
            if (swapId !== null) window.clearTimeout(swapId);
        };
    }, []);

    const live = widths?.[i];
    return (
        // The outer span is the layout atom: its width IS the slot's
        // width, so the sentence always ends exactly at the noun — no
        // reserve, no trailing gap.
        <span className="relative inline-block align-baseline whitespace-nowrap">
            <span
                ref={measureRef}
                aria-hidden="true"
                className="absolute left-0 top-0 pointer-events-none"
                style={{ visibility: 'hidden' }}
            >
                {SCALE_NOUNS.map((n) => (
                    <span key={n} className="inline-block whitespace-nowrap">
                        {n}
                    </span>
                ))}
            </span>
            {/* The live slot — the word exchanges itself (soft blur +
                slide) while the box glides to the incoming noun's exact
                width. One fluid motion, nothing jarring. */}
            <span
                className="inline-block align-baseline text-transparent bg-clip-text pb-1"
                style={{
                    width: live !== undefined ? `${live}px` : undefined,
                    transition:
                        'width 520ms cubic-bezier(0.33, 0, 0.15, 1), opacity 380ms ease, transform 380ms ease, filter 380ms ease',
                    opacity: on ? 1 : 0,
                    transform: on ? 'none' : 'translateY(-0.22em)',
                    filter: on ? 'none' : 'blur(5px)',
                    backgroundImage: 'linear-gradient(to right, #34D399, #4ADE80)',
                }}
            >
                {SCALE_NOUNS[i]}
            </span>
        </span>
    );
};

const HubHero: React.FC<{
    onContactSales: () => void;
    scrollTo: (id: string) => void;
}> = ({ onContactSales, scrollTo }) => {
    // W8 (structured fluidity): the hero keeps the dark cinematic stage but
    // the blob becomes a SYSTEM — a morphing crystal lattice (see
    // MorphScene.tsx). Positioning stays broadened per owner direction: no
    // "Lagos software company" line here — we build systems, full stop.
    // The company-and-location eyebrow stays retired.
    //
    // W8 auth policy: Log in / Start Free Trial live with the products
    // (the Vega and Atrium pages). The company page sells the company.
    return (
        <section id="home" className="relative overflow-hidden min-h-[92vh] flex items-center w7-dark">
            {/* Layer 0 — deep ink base */}
            <div className="absolute inset-0 bg-[#070D18]" aria-hidden="true" />
            {/* Layer 1 — the living lattice (WebGL; a structural CSS fallback
                sits behind it), arriving with one slow settle. */}
            <div className="absolute inset-0 w8-lattice-fallback" aria-hidden="true" />
            <div className="absolute inset-0 w8-scene-enter" aria-hidden="true">
                <MorphScene className="absolute inset-0" />
            </div>
            {/* Layer 2 — vignette + grain so the headline always reads */}
            <div className="absolute inset-0 w7-vignette pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            {/* pb-24 on mobile clears the chat FAB (bottom-20 = 80px). */}
            <div className="hero-stagger relative z-10 container mx-auto px-4 sm:px-6 pt-28 pb-24 sm:pt-32 sm:pb-20 flex flex-col items-center text-center">

                <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-6 text-emerald-400/90">
                    We design, build &amp; run business software
                </p>

                <h1 className="font-display text-[2.25rem] sm:text-5xl md:text-6xl lg:text-[5rem] font-bold tracking-tight leading-[1.08] mb-7 max-w-5xl text-white w7-headline-shadow">
                    Build systems that help{' '}
                    <br className="hidden sm:block" />
                    {/* W17: the gradient is all-green (mint → emerald →
                        green) — the brand's color, no amber lead. Below sm
                        the noun owns its own line, so no noun can ever
                        change the headline's line count.
                        W18: every text-bearing span paints its OWN clipped
                        gradient — an ancestor's background-clip:text does
                        not paint through the noun's inline-block slot
                        (it carries transform/filter), which left the noun
                        colourless and invisible in several browsers. */}
                    <span className="inline sm:inline-block align-baseline">
                        <span className="text-transparent bg-clip-text inline pb-1" style={{ backgroundImage: 'linear-gradient(to right, #6EE7B7, #34D399)' }}>
                            scale your
                        </span>{' '}
                        <br className="sm:hidden" />
                        <ScalingNoun />
                    </span>
                </h1>

                <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-[1.75] text-slate-300/95">
                    PracticePro Systems designs, builds and runs the operating systems
                    businesses scale on — from the orders that arrive on WhatsApp to the receipts that leave with every job.
                    When spreadsheets, chat threads and memory can no longer keep up, we build the system that takes over — so
                    you can take on more customers, and take care of them, without the chaos doubling.
                </p>

                {/* CTAs — ui/Button (bare) per ADR-0004: new interactive
                    elements never grow the raw-element ratchet. */}
                <div className="flex flex-col sm:flex-row gap-4 mb-14 w-full sm:w-auto justify-center">
                    <Button
                        variant="bare"
                        onClick={onContactSales}
                        className="relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-md transition-all duration-300 active:scale-[0.97]"
                    >
                        Talk to us about your system
                    </Button>
                    <Button
                        variant="bare"
                        onClick={() => scrollTo('ourWork')}
                        className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm bg-white/10 text-white border border-white/15 backdrop-blur-sm hover:bg-white/15 hover:border-white/25 transition-all duration-300 active:scale-[0.97]"
                    >
                        See what we&apos;ve built
                    </Button>
                </div>

                {/* W14: the "Our products" quick-links are GONE from the hero —
                    the owner's direction: it is far too early to walk visitors
                    into the catalogue. The hero sells the problem and the
                    promise; the products are introduced later, inside "Systems
                    we've built", once the story has earned them. */}

                {/* W8: auth lives with the products. The company page sells
                    the company — the sign-in link lives on the product pages. */}
            </div>

            {/* Scroll cue — invites the descent into the story. */}
            <Button
                variant="bare"
                onClick={() => scrollTo('whatWeDo')}
                aria-label="Scroll to what we do"
                className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 p-2 text-slate-500 hover:text-slate-200 transition-colors w7-scroll-cue"
            >
                <ChevronDownIcon className="w-6 h-6" />
            </Button>

            {/* Bottom fade into the marquee band */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-[#070D18] pointer-events-none" aria-hidden="true" />
        </section>
    );
};

// ─── FLUID SEAMS (W8 → W9 → W10) ───────────────────────────────────────────────
// W10: the curvature is BACK and impossible to miss. Each seam is now a
// true SVG wave — the previous section's colour pours into the next through
// a visible arc whose crest slides and breathes as the seam crosses the
// viewport (plus a slow ambient drift). The W9 organic-radius blob read
// as a straight cut; this is a real curve again, and it morphs as you
// scroll from page to page.

const FluidSeam: React.FC<{ from: string; to: string; phase?: number }> = ({ from, to, phase = 0 }) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const pathRef = useRef<SVGPathElement>(null);
    useEffect(() => {
        const host = hostRef.current;
        const path = pathRef.current;
        if (!host || !path) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // p: 0 as the seam enters from the bottom, 1 as it leaves the top.
        // The wave's crest slides horizontally and its amplitude breathes
        // with the seam's viewport position — morphing, never static.
        // The fill paints the region ABOVE the curve with the previous
        // section's colour, which then pours into the next section below —
        // dark at top, flowing to light at the bottom, through a living arc.
        const draw = (p: number, t: number) => {
            const breath = 0.5 + 0.5 * Math.sin(Math.PI * p);          // peaks mid-viewport
            const amp = 13 + 15 * breath;                              // 13–28 of 100 units
            const slide = Math.sin(t * 0.35 + phase * 1.7) * 8;         // slow ambient drift
            const cRest = Math.sin(p * Math.PI * 1.3 + phase) * amp;
            const cLead = Math.cos(p * Math.PI * 1.1 + phase * 0.8) * amp;
            const a = 46 - cRest * 0.35 + slide * 0.5;
            const b = 54 + cLead * 0.35 - slide * 0.5;
            path.setAttribute('d',
                `M0,0 L100,0 L100,${b.toFixed(2)} C70,${(b - amp * 0.9).toFixed(2)} 30,${(a + amp * 0.9).toFixed(2)} 0,${a.toFixed(2)} Z`);
        };
        if (reduced) { draw(0.5, 0); return; }
        let inView = true;
        let rafId: number | null = null;
        const t0 = performance.now();
        const io = new IntersectionObserver((entries) => {
            inView = entries.some((en) => en.isIntersecting);
            if (inView && rafId === null) rafId = requestAnimationFrame(frame);
        }, { threshold: 0 });
        io.observe(host);
        const frame = (now: number) => {
            const rect = host.getBoundingClientRect();
            const vh = window.innerHeight;
            const p = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
            draw(p, (now - t0) / 1000);
            rafId = inView ? requestAnimationFrame(frame) : null;
        };
        rafId = requestAnimationFrame(frame);
        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            io.disconnect();
        };
    }, [phase]);
    return (
        <div ref={hostRef} className="relative h-24 sm:h-32 overflow-hidden w10-seam" style={{ background: to }} aria-hidden="true">
            {/* The previous section's colour, hanging into this one through a
                living curve — the wave shape is the liquid boundary. */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path ref={pathRef} fill={from} d="M0,0 L100,0 L100,54 C70,42 30,58 0,46 Z" />
            </svg>
        </div>
    );
};

// ─── MARQUEE (W7) — the capabilities ticker ─────────────────────────────────
// A slow infinite band that carries the builder's vocabulary across the
// seam between the dark hero and the light body. Pure CSS animation;
// frozen under prefers-reduced-motion.

const MARQUEE_ITEMS = [
    'Custom Systems',
    'Custom Integrations',
    'Customer Portals',
    'Payments & Billing',
    'Workflow Automation',
    'AI & Automation',
    'Mobile Apps',
    'Web Platforms',
    'Security & Compliance',
];

const MarqueeStrip: React.FC = () => (
    <div className="relative overflow-hidden border-y border-white/5 bg-[#0A101C] py-5" aria-label="What we build">
        <div className="w7-marquee-track flex items-center gap-10 whitespace-nowrap w-max">
            {[0, 1].map((dup) => (
                <div key={dup} className="flex items-center gap-10" aria-hidden={dup === 1}>
                    {MARQUEE_ITEMS.map((item) => (
                        <span key={`${dup}-${item}`} className="flex items-center gap-10">
                            <span className="font-mono text-xs sm:text-sm uppercase tracking-[0.22em] text-slate-500">
                                {item}
                            </span>
                            <span className="w-1.5 h-1.5 rotate-45 bg-gradient-to-br from-emerald-300 to-emerald-500 opacity-70" aria-hidden="true" />
                        </span>
                    ))}
                </div>
            ))}
        </div>
        {/* Edge fades so the band dissolves instead of clipping */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0A101C] to-transparent pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0A101C] to-transparent pointer-events-none" aria-hidden="true" />
    </div>
);

// ─── SOUND FAMILIAR? (W14) — the bridge from "nice 3D" to "I need this" ────
// Owner direction: "I don't think people who want the service(s) know they
// need or want it." Before "What we do" can land as an answer, the page has
// to hold a mirror up and name the daily friction in the visitor's own
// words. Each row is a symptom any owner or manager will recognise — and
// its system counterpart. This is the section that converts "cool site"
// into "wait, that is MY business".

const PAIN_MIRROR: Array<{ today: string; system: string }> = [
    {
        today: 'Orders and requests arrive by WhatsApp, SMS and walk-in — nobody sees all of them in one place.',
        system: 'Every order lands in one queue — assigned, tracked, never lost.',
    },
    {
        today: "Who has paid, who still owes, who renewed — it lives in somebody's head and a tattered notebook.",
        system: 'Balances, receipts and reminders computed and sent without anyone chasing.',
    },
    {
        today: 'Customer records scattered across three phones, two notebooks and a Gmail account.',
        system: 'One record per customer — history, documents, payments and messages together.',
    },
    {
        today: 'Month-end means days of reconciling bank alerts with hand-written receipts.',
        system: 'Reconciliation that happens as the money lands — reports one click away.',
    },
    {
        today: 'The only person who understands the whole process is on leave — and everything stalls.',
        system: 'The system holds the process, so any member of the team can run the day.',
    },
];

const PainMirrorSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const rowsRef = useScrollReveal<HTMLDivElement>();
    const closeRef = useScrollReveal<HTMLDivElement>();
    return (
        <section className="relative py-16 sm:py-24 overflow-hidden" style={{ background: '#0A101C' }}>
            {/* the same ink stage as the hero, carried through the marquee */}
            <div className="absolute -top-32 right-1/4 w-[34rem] h-[24rem] rounded-full bg-emerald-500/[0.07] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-40 left-1/4 w-[36rem] h-[24rem] rounded-full bg-emerald-600/[0.08] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-10 md:mb-14 max-w-3xl mx-auto">
                    <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-4 text-emerald-400/90">
                        Sound familiar?
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        Your business already runs on a system.
                        <br />
                        <span className="text-transparent bg-clip-text inline-block pb-1" style={{ backgroundImage: 'linear-gradient(to right, #6EE7B7, #34D399)' }}>
                            It&rsquo;s just not software.
                        </span>
                    </h2>
                    <p className="text-lg text-slate-400 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        Spreadsheets, chat threads, memory and paper will get a business started —
                        then quietly hold it back. Recognise any of these?
                    </p>
                </div>

                <div ref={rowsRef} className="w9-reveal-stagger max-w-4xl mx-auto flex flex-col gap-3.5">
                    {PAIN_MIRROR.map((row, i) => (
                        <div
                            key={i}
                            className="group grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6 rounded-md border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm px-5 py-4 md:px-7 md:py-5 transition-all duration-500 hover:border-white/[0.16] hover:bg-white/[0.045]"
                        >
                            {/* Today — the friction, in the visitor's words */}
                            <div className="flex items-start gap-3.5 md:justify-end md:text-right">
                                <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-emerald-400/70 flex-shrink-0 translate-y-2" aria-hidden="true" />
                                <p className="text-sm leading-[1.7] text-slate-400 transition-colors duration-500 group-hover:text-slate-500">{row.today}</p>
                                <span className="md:hidden w-1.5 h-1.5 rounded-full bg-emerald-400/70 flex-shrink-0 translate-y-2" aria-hidden="true" />
                            </div>
                            {/* The turn */}
                            <span className="hidden md:flex items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-white/[0.03] text-slate-500 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors duration-500" aria-hidden="true">
                                <ChevronRightIcon className="w-4 h-4" />
                            </span>
                            <span className="flex md:hidden items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-white/[0.03] text-slate-500" aria-hidden="true">
                                <ChevronDownIcon className="w-4 h-4" />
                            </span>
                            {/* On a system — the same day, running on software */}
                            <div className="flex items-start gap-3.5">
                                <span className="w-1.5 h-1.5 rotate-45 bg-emerald-400 flex-shrink-0 translate-y-2 transition-transform duration-500 group-hover:scale-150" aria-hidden="true" />
                                <p className="text-sm font-medium leading-[1.7] text-slate-200/90 transition-colors duration-500 group-hover:text-emerald-100">{row.system}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div ref={closeRef} className="w9-reveal text-center mt-12 md:mt-14 max-w-2xl mx-auto">
                    <p className="text-lg text-slate-300/95 leading-[1.75]">
                        If any of that is your business, you don&rsquo;t need more discipline or a
                        better spreadsheet. <span className="text-white font-semibold">You need a system</span> —
                        and building it is exactly what we do.
                    </p>
                    <div className="mt-7">
                        <Button
                            variant="bare"
                            onClick={onContactSales}
                            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-md transition-all duration-300 active:scale-[0.97]"
                        >
                            Tell us what runs your business today
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ─── WHAT WE DO (corporate hub) ─────────────────────────────────────────────
// The services PracticePro Systems sells. Each card is a capability already
// running in production inside Vega, Atrium or Kozy Care — the pitch to a
// prospective client is "this exact engineering, applied to your business".

const WHAT_WE_DO: Array<{
    title: string;
    body: string;
    Icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        title: 'Custom business systems',
        body: 'A system shaped around your operations, not your operations reshaped around software. We study how your business actually runs — the paperwork, the phone calls, the spreadsheets — then build the software that runs it. Kozy Care, a complete dry-cleaning operations platform, was built exactly this way.',
        Icon: BriefcaseIcon,
    },
    {
        title: 'Custom integrations',
        body: 'The tools you already use, wired into one workflow: WhatsApp and SMS messaging, Paystack payments, email, calendars and document tools. Vega and Atrium ship with integrations like these — we can build yours into whatever your business runs on.',
        Icon: LinkIcon,
    },
    {
        title: 'Portals your customers actually use',
        body: 'Self-service portals for the people you serve — track cases, view receipts and ledgers, book services, request maintenance. Your customers help themselves at any hour, on any phone, without a call to your office.',
        Icon: UsersIcon,
    },
    {
        title: 'Payments & revenue operations',
        body: 'Invoicing, collections, defaulter tracking, automatic receipts and reconciliation — with dashboards that answer revenue questions in seconds. Built naira-first, with Paystack and bank transfer flows already in production.',
        Icon: NairaCircleIcon,
    },
    {
        title: 'AI & automation',
        body: 'AI drafting, deadline computation, smart reminders and workflow automation that take over the repetitive work — the same engine that drafts court documents in Vega and applies tenancy law across 36 states and the FCT in Atrium.',
        Icon: BrainIcon,
    },
    {
        title: 'Workflow & notification engines',
        body: 'The rules that run the business day to day: approvals, reminders, escalations and banner alerts that reach the right person on WhatsApp, SMS or email. When a payment fails or a deadline looms, the system moves first — your team simply sees what needs doing.',
        Icon: BellIcon,
    },
    {
        title: 'Hosting, security & compliance',
        body: 'Deployment, monitoring, backups and NDPA 2023-aligned data handling, so your system stays up and your data stays yours. We run the infrastructure on our own products every day — we can run yours too.',
        Icon: ShieldCheckIcon,
    },
];

// W14: the seven wireframe shapes — one per capability card, matching the
// geometry the 3D scene builds above (cube, cuboid, pyramid, octahedron,
// prism, gem, hex prism). Each card carries its own shape as a slowly
// turning watermark; when the card lands in the viewport the shape DROPS IN
// — the moment the orbiting shape above "arrives" in its card.
const SHAPE_STROKE = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
};
const IsoCube: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M24 7 L39 15.5 L39 32.5 L24 41 L9 32.5 L9 15.5 Z" />
        <path {...SHAPE_STROKE} d="M9 15.5 L24 24 L39 15.5 M24 24 L24 41" />
    </svg>
);
const IsoCuboid: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M24 4 L36 10 L36 33 L24 39 L12 33 L12 10 Z" />
        <path {...SHAPE_STROKE} d="M12 10 L24 16 L36 10 M24 16 L24 39" />
    </svg>
);
const IsoPyramid: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M24 6 L8 27 L24 36 L40 27 Z" />
        <path {...SHAPE_STROKE} d="M24 6 L24 36 M8 27 L40 27" />
    </svg>
);
const IsoOctahedron: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M24 4 L41 24 L24 44 L7 24 Z" />
        <path {...SHAPE_STROKE} d="M7 24 L41 24" />
    </svg>
);
const IsoPrism: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M9 17 L33 17 L21 37 Z" />
        <path {...SHAPE_STROKE} d="M15 9 L39 9 L27 29 Z" />
        <path {...SHAPE_STROKE} d="M9 17 L15 9 M33 17 L39 9 M21 37 L27 29" />
    </svg>
);
const IsoGem: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M14 12 L34 12 L42 21 L24 42 L6 21 Z" />
        <path {...SHAPE_STROKE} d="M14 12 L24 21 L34 12 M6 21 L24 21 L42 21 M24 21 L24 42" />
    </svg>
);
const IsoHexPrism: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M24 7 L33 12 L33 19 L24 24 L15 19 L15 12 Z" />
        <path {...SHAPE_STROKE} d="M24 28 L33 33 L33 40 L24 45 L15 40 L15 33 Z" />
        <path {...SHAPE_STROKE} d="M15 12 L15 33 M33 12 L33 33" />
    </svg>
);
const CARD_SHAPES = [IsoCube, IsoCuboid, IsoPyramid, IsoOctahedron, IsoPrism, IsoGem, IsoHexPrism];

/**
 * useLandingCards (W14) — the descent's landing signal. As each capability
 * card crosses into the viewport it gains .w14-landed (its wireframe shape
 * drops in, its icon chip pings, its border flashes emerald) and loses it
 * again on the way back up — so the story replays exactly like the 3D
 * shapes above, which also return to orbit when you scroll up. Reversible,
 * scroll-driven, no timers.
 */
function useLandingCards<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T>(null);
    useEffect(() => {
        const root = ref.current;
        if (!root) return;
        const cards = Array.from(root.querySelectorAll<HTMLElement>('.w14-card'));
        if (!('IntersectionObserver' in window)) {
            cards.forEach((c) => c.classList.add('w14-landed'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            for (const en of entries) en.target.classList.toggle('w14-landed', en.isIntersecting);
        }, { threshold: 0.3 });
        cards.forEach((c) => io.observe(c));
        return () => io.disconnect();
    }, []);
    return ref;
}

const WhatWeDoSection: React.FC<{ scrollTo: (id: string) => void }> = ({ scrollTo }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const gridRef = useScrollReveal<HTMLDivElement>();
    const landingRef = useLandingCards<HTMLDivElement>();
    // W7: bento spans — an asymmetric grid reads as designed, not templated.
    // W9: a seventh capability (workflow & notification engines) joins, so
    // the grid closes with two half-wide cards instead of one banner.
    // [4,2] / [2,2,2] / [3,3]: first capability breathes, the workflow +
    // hosting pair closes the grid side by side.
    const bentoSpan = [
        'md:col-span-4',
        'md:col-span-2',
        'md:col-span-2',
        'md:col-span-2',
        'md:col-span-2',
        'md:col-span-3',
        'md:col-span-3',
    ];
    const handleSpotlight = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        el.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };
    return (
        <section id="whatWeDo" className="py-16 sm:py-24 bg-white relative">
            {/* W8: the FluidSeam above owns the dark→light transition now —
                the static sage wash is retired. */}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                {/* W13→W14: the system core — a real three.js rendering (lazy
                    chunk, same contract as the hero). Seven GLASS SHAPES —
                    cubes that morph into pyramids, prisms and gems — orbit a
                    faceted core, one per capability card below. As you scroll,
                    the shapes DESCEND out of the scene toward their cards,
                    and each card receives its own shape. All inside the
                    canvas — no mark here, no overlays, nothing crosses text. */}
                <div className="relative mx-auto mb-9 md:mb-12 w-full max-w-[620px]">
                    <div className="w13-stage">
                        <div className="w13-fallback" aria-hidden="true" />
                        <SystemCoreScene className="w13-canvas" />
                    </div>
                    {/* W14: the owner's own words replace "Seven modules. One
                        system." — a promise a layman can feel, not jargon. */}
                    <p className="w13-caption">Making your systems one.</p>
                    {/* W14: the descent continues — a cue under the scene walks
                        the visitor down to the parts of the business, the way
                        the hero cue walks them into this scene. */}
                    <Button
                        variant="bare"
                        onClick={() => scrollTo('whatWeDoGrid')}
                        aria-label="Scroll to what each part becomes"
                        className="mx-auto flex items-center justify-center p-2 mt-1 text-slate-400 hover:text-slate-700 transition-colors w14-cue"
                    >
                        <ChevronDownIcon className="w-5 h-5" />
                    </Button>
                </div>
                <div ref={ref} className="w9-reveal text-center mb-12 md:mb-16">
                    <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--color-moss)' }}>
                        What we do
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        What we can build for you
                    </h2>
                    <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        Every part of a business — orders, payments, customers, paperwork — becomes
                        one system. Each piece below already runs in production inside Vega, Atrium
                        or Kozy Care; the same engineering can run yours.
                    </p>
                </div>
                {/* Both reveal and landing hooks watch the SAME grid: one
                    fades the cards in, the other fires each card's shape
                    drop when it truly lands in the viewport. */}
                <div
                    ref={(node) => {
                        (gridRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                        (landingRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                    }}
                    id="whatWeDoGrid"
                    className="w9-reveal-stagger grid grid-cols-1 md:grid-cols-6 gap-5 md:gap-6 max-w-6xl mx-auto"
                >
                    {WHAT_WE_DO.map((c, i) => {
                        const Shape = CARD_SHAPES[i % CARD_SHAPES.length];
                        return (
                        <div
                            key={i}
                            onMouseMove={handleSpotlight}
                            style={{ '--w14-i': i } as React.CSSProperties}
                            className={`w14-card w7-spotlight-card group relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-7 shadow-sm hover:shadow-xl hover:shadow-slate-900/5 hover:border-slate-300 transition-all duration-300 ${bentoSpan[i]}`}
                        >
                            {/* W14: the card's own wireframe shape — the same
                                geometry that orbits above — drops in when the
                                card lands, then turns slowly as a watermark. */}
                            <Shape className="w14-shape pointer-events-none absolute top-4 right-4 w-11 h-11 text-emerald-500/60 group-hover:text-emerald-600/80 transition-colors duration-500" />
                            {/* W13: a quiet, always-on icon chip — the orbiting
                                shapes above carry the motion now; the cards
                                stay calm and legible. W14: the chip pings
                                emerald when its shape lands. */}
                            <div className="w14-chip w-12 h-12 mb-5 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors duration-300" aria-hidden="true">
                                <c.Icon className="w-6 h-6" />
                            </div>
                            <h3 className="font-display text-lg font-bold text-slate-900 mb-2.5 tracking-tight">{c.title}</h3>
                            <p className="text-slate-600 text-sm leading-[1.7]">{c.body}</p>
                        </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};


// ─── OUR WORK (corporate hub) — the portfolio ──────────────────────────────
// P8: every card maps to a real, deployed system. Vega and Atrium are
// PracticePro's own products (their marketing pages live at /vega and
// /atrium on this site); Kozy Care is a client commission, live at
// kozycare.ng — shown here as proof we build for other people's businesses.

// W7 (the wow site): every project ships with REAL SCREENS captured from the
// live systems — marketing pages, portal logins and actual in-app screens —
// plus the STACK it is built with and WHAT'S INSIDE it. Prospective clients
// can see what we can do (capabilities), what we have done (these screens)
// and how we could help them (the preview + CTA).

type WorkScreen = {
    src: string;
    alt: string;
    kind: 'browser' | 'phone';
    label: string;
};

const OUR_WORK: Array<{
    name: string;
    tagline: string;
    badge: string;
    badgeClass: string;
    Icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    body: string;
    cta: { label: string; href: string; external: boolean };
    ctaClass: string;
    // ── W7 additions ──
    frameUrl: string;          // shown in the browser-chrome mockup
    stack: string[];           // what it's built with
    inside: string[];          // modules inside the system
    primaryScreen: WorkScreen; // the card's main showcase shot
    detailScreens: WorkScreen[]; // the preview modal's gallery
    glowClass: string;         // accent glow behind the devices
    borderGlowClass: string;   // hover ring on the device stack
    // ── W9 additions ──
    tourSystem: TourSystem;    // the guided tour's screen set (demo data)
}> = [
    {
        name: 'Vega',
        tagline: 'Legal Practice OS',
        badge: 'Our product',
        badgeClass: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
        Icon: VegaMark,
        iconClass: '',
        body: 'Case management, AI-assisted drafting with DraftPro and ALOA, court-rule-aware calendaring and billing for Nigerian law firms — from case intake to filing.',
        cta: { label: 'Explore Vega', href: '/vega', external: true },
        ctaClass: 'group-hover:text-amber-400 text-amber-400',
        frameUrl: 'practicepro.ng/vega',
        tourSystem: 'vega',
        stack: ['React + TypeScript', 'Convex', 'Tailwind CSS', 'Gemini AI', 'Paystack', 'Android app (Capacitor)'],
        inside: [
            'Matter & case management',
            'AI drafting — DraftPro & ALOA',
            'Court-rule-aware calendaring',
            'Billing, invoices & receipts',
            'Client portal with live case tracking',
            'WhatsApp, SMS & email notifications',
        ],
        primaryScreen: {
            src: '/assets/landing/work/vega-page.jpg',
            alt: 'The PracticePro Vega product page — Practice Management for Nigerian Law Firms',
            kind: 'browser',
            label: 'Product page — practicepro.ng/vega',
        },
        detailScreens: [
            {
                src: '/assets/landing/work/vega-page.jpg',
                alt: 'The PracticePro Vega product page — Practice Management for Nigerian Law Firms',
                kind: 'browser',
                label: 'Product page — practicepro.ng/vega',
            },
            {
                src: '/assets/landing/work/vega-calendar.jpg',
                alt: 'Vega\u2019s court-rule-aware calendar, running in the PracticePro Android app',
                kind: 'phone',
                label: 'Court-rule calendar — the mobile app',
            },
            {
                src: '/assets/landing/work/vega-messages.jpg',
                alt: 'Vega\u2019s scheduled messaging screen for client updates by email, SMS and WhatsApp',
                kind: 'phone',
                label: 'Scheduled client messaging — the mobile app',
            },
            {
                src: '/assets/landing/work/vega-portal.jpg',
                alt: 'The Vega client portal sign-in screen',
                kind: 'browser',
                label: 'Client portal — sign-in',
            },
        ],
        glowClass: 'bg-amber-500/25',
        borderGlowClass: 'group-hover:border-amber-500/40',
    },
    {
        name: 'Atrium',
        tagline: 'Property Management OS',
        badge: 'Our product',
        badgeClass: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
        Icon: AtriumMark,
        iconClass: '',
        body: "Rent and service-charge collection, residents' portal, maintenance workflows and revenue intelligence for property portfolios — applying the tenancy law of all 36 states and the FCT.",
        cta: { label: 'Explore Atrium', href: '/atrium', external: true },
        ctaClass: 'group-hover:text-emerald-400 text-emerald-400',
        frameUrl: 'practicepro.ng/atrium',
        tourSystem: 'atrium',
        stack: ['React + TypeScript', 'Convex', 'Tailwind CSS', 'Paystack', 'WhatsApp & SMS', 'Web + Android'],
        inside: [
            'Rent & service-charge collection',
            "Residents' portal with statements",
            'Maintenance request workflows',
            'Revenue intelligence & forecasting',
            'Tenancy law engine — 36 states + FCT',
            'Defaulter tracking & escalation',
        ],
        primaryScreen: {
            src: '/assets/landing/work/atrium-page.jpg',
            alt: 'The PracticePro Atrium product page — Revenue Monitor for Property Managers',
            kind: 'browser',
            label: 'Product page — practicepro.ng/atrium',
        },
        detailScreens: [
            {
                src: '/assets/landing/work/atrium-page.jpg',
                alt: 'The PracticePro Atrium product page — Revenue Monitor for Property Managers',
                kind: 'browser',
                label: 'Product page — practicepro.ng/atrium',
            },
            {
                src: '/assets/landing/work/atrium-financials.jpg',
                alt: 'Atrium\u2019s financials dashboard showing collected revenue, outstanding balances and invoices, in the PracticePro mobile app',
                kind: 'phone',
                label: 'Revenue & collections dashboard — the mobile app',
            },
            {
                src: '/assets/landing/work/atrium-portal.jpg',
                alt: 'The Atrium residents\u2019 portal sign-in screen',
                kind: 'browser',
                label: "Residents' portal — sign-in",
            },
        ],
        glowClass: 'bg-emerald-500/25',
        borderGlowClass: 'group-hover:border-emerald-500/40',
    },
    {
        name: 'Kozy Care',
        tagline: 'Dry-cleaning & laundry platform',
        badge: 'Built for a client',
        badgeClass: 'bg-primary-500/10 text-primary-300 border border-primary-500/30',
        Icon: MapPinIcon,
        iconClass: 'bg-primary-500/10 text-primary-400',
        body: '“Uncompromising care. Exceptional convenience.” Pickup-and-delivery laundry is a crowded business — nothing special about the idea. What lets this one scale is the system behind it: guest booking, Kozy Circle memberships, a customer portal with live order tracking, GPS rider dispatch across 12 Lagos zones, a multi-branch admin console and a partner network — more customers, handled well, without the chaos doubling.',
        cta: { label: 'Visit kozycare.ng', href: 'https://kozycare.ng', external: true },
        ctaClass: 'group-hover:text-primary-400 text-primary-400',
        frameUrl: 'kozycare.ng',
        tourSystem: 'kozy',
        stack: ['Next.js', 'Prisma + Supabase', 'NextAuth', 'Paystack', 'Termii SMS', 'Vercel'],
        inside: [
            'Guest pickup booking & quotes',
            'Kozy Circle memberships',
            'Customer portal & order tracking',
            'Payments, receipts & invoices — Paystack',
            'GPS rider dispatch — 12 zones',
            'Multi-branch admin console',
            'Partner garment-care network',
        ],
        primaryScreen: {
            src: '/assets/landing/work/kozy-home.jpg',
            alt: 'The Kozy Care home page — dry cleaning and laundry services, with pickup booking',
            kind: 'browser',
            label: 'Home page — kozycare.ng',
        },
        detailScreens: [
            {
                src: '/assets/landing/work/kozy-home.jpg',
                alt: 'The Kozy Care home page — dry cleaning and laundry services, with pickup booking',
                kind: 'browser',
                label: 'Home page — kozycare.ng',
            },
            {
                src: '/assets/landing/work/kozy-order-service.jpg',
                alt: 'Kozy Care\u2019s signed-in ordering flow — the service picker with per-item naira pricing',
                kind: 'browser',
                label: 'Ordering — the service picker',
            },
            {
                src: '/assets/landing/work/kozy-order-checkout.jpg',
                alt: 'Kozy Care\u2019s checkout — the live quote with discounts applied, card or bank transfer',
                kind: 'browser',
                label: 'Ordering — checkout',
            },
            {
                src: '/assets/landing/work/kozy-portal-order.jpg',
                alt: 'The Kozy Care customer portal — an active order with its status timeline',
                kind: 'browser',
                label: 'Customer portal — live order tracking',
            },
            {
                src: '/assets/landing/work/kozy-invoice.jpg',
                alt: 'A Kozy Care invoice — itemised in naira, printable and downloadable',
                kind: 'browser',
                label: 'The invoice',
            },
            {
                src: '/assets/landing/work/kozy-membership-active.jpg',
                alt: 'An active Kozy Circle membership on a live account, in the customer portal',
                kind: 'phone',
                label: 'Kozy Circle — an active membership',
            },
            {
                src: '/assets/landing/work/kozy-admin-kanban.jpg',
                alt: 'The Kozy Care admin console\u2019s order board',
                kind: 'browser',
                label: 'Admin console — the order board',
            },
            {
                src: '/assets/landing/work/kozy-admin-crm.jpg',
                alt: 'The Kozy Care admin CRM — customers with lifetime value and MEMBER badges',
                kind: 'browser',
                label: 'Admin console — the CRM',
            },
            {
                src: '/assets/landing/work/kozy-book.jpg',
                alt: 'The Kozy Care pickup booking flow — items, live quote, pickup slot and zone',
                kind: 'browser',
                label: 'Guest booking & quotes — kozycare.ng/book',
            },
            {
                src: '/assets/landing/work/kozy-services.jpg',
                alt: 'Kozy Care\u2019s services catalogue — men\u2019s and women\u2019s dry cleaning, home linens, shoe care and alterations',
                kind: 'browser',
                label: 'Services catalogue — kozycare.ng/services',
            },
            {
                src: '/assets/landing/work/kozy-memberships.jpg',
                alt: 'Kozy Care\u2019s membership plans page with laundry pricing',
                kind: 'browser',
                label: 'Membership plans — kozycare.ng/memberships',
            },
            {
                src: '/assets/landing/work/kozy-login.jpg',
                alt: 'The Kozy Care customer portal sign-in screen',
                kind: 'browser',
                label: 'Customer portal — sign-in',
            },
            {
                src: '/assets/landing/work/kozy-partners.jpg',
                alt: 'The Kozy Care partner network page — other laundry operators running under the Kozy brand',
                kind: 'browser',
                label: 'Partner network — kozycare.ng/partners',
            },
        ],
        glowClass: 'bg-primary-500/25',
        borderGlowClass: 'group-hover:border-primary-500/40',
    },
    {
        name: 'Woosh',
        tagline: 'Free temporary email — for humans and test rigs',
        badge: 'Our tool',
        badgeClass: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30',
        Icon: MailIcon,
        iconClass: 'bg-indigo-500/10 text-indigo-400',
        body: 'A free temporary-email service we built in-house: instant disposable inboxes that keep spam out of real mailboxes — plus a documented API with webhooks, revocable API keys and extracted verification codes. Our own test rigs run signup, payment and notification batteries on it, sparing our transactional email quota.',
        cta: { label: 'Visit woosh.dpdns.org', href: 'https://woosh.dpdns.org', external: true },
        ctaClass: 'group-hover:text-indigo-400 text-indigo-400',
        frameUrl: 'woosh.dpdns.org',
        tourSystem: 'woosh',
        stack: ['Cloudflare edge', 'REST API + webhooks', 'Verification-code extraction', 'Free — no sign-up'],
        inside: [
            'Instant disposable inboxes',
            'Shareable inbox links',
            'Codes & links extracted for you',
            'Webhooks — push instead of poll',
            'Revocable API keys, docs + console',
            'Dark mode & mail notifications',
        ],
        primaryScreen: {
            src: '/assets/landing/work/woosh-home.jpg',
            alt: 'Woosh — a free temporary email address in one click, at woosh.dpdns.org',
            kind: 'browser',
            label: 'The tool — woosh.dpdns.org',
        },
        detailScreens: [
            {
                src: '/assets/landing/work/woosh-home.jpg',
                alt: 'Woosh — a free temporary email address in one click, at woosh.dpdns.org',
                kind: 'browser',
                label: 'The tool — woosh.dpdns.org',
            },
            {
                src: '/assets/landing/work/woosh-inbox.jpg',
                alt: 'A live Woosh inbox receiving Kozy Care\u2019s real transactional email',
                kind: 'browser',
                label: 'A live inbox — receiving Kozy Care\u2019s mail',
            },
            {
                src: '/assets/landing/work/woosh-message.jpg',
                alt: 'A verification email opened in Woosh, with the code extracted and ready to copy',
                kind: 'browser',
                label: 'Message view — codes extracted for you',
            },
            {
                src: '/assets/landing/work/woosh-dark.jpg',
                alt: 'Woosh in dark mode, with a live inbox',
                kind: 'browser',
                label: 'Dark mode',
            },
            {
                src: '/assets/landing/work/woosh-api.jpg',
                alt: 'The Woosh Email Testing API documentation — endpoints, webhooks, API keys and an llms.txt prompt block',
                kind: 'browser',
                label: 'The developer API — woosh.dpdns.org/api-docs',
            },
        ],
        glowClass: 'bg-indigo-500/25',
        borderGlowClass: 'group-hover:border-indigo-500/40',
    },
];

/** W7: a macOS-style browser chrome around a real screen capture. */
const BrowserFrame: React.FC<{ url: string; src: string; alt: string; className?: string; eager?: boolean }> = ({ url, src, alt, className = '', eager = false }) => (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-[#0E1626] shadow-lg shadow-black/50 ${className}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-[#111A2C] border-b border-white/[0.06]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" aria-hidden="true" />
            <span className="flex-1 mx-1 px-3 py-1 rounded-md bg-black/40 text-[10px] leading-none text-slate-400 font-medium truncate flex items-center gap-1.5 min-h-[1.25rem]">
                <LockClosedIcon className="w-2.5 h-2.5 flex-shrink-0" />
                {url}
            </span>
        </div>
        <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} className="w-full aspect-[16/10] object-cover object-top block" />
    </div>
);

/** W7: a phone chrome around a real in-app screen capture. */
const PhoneFrame: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className = '' }) => (
    <div className={`overflow-hidden rounded-[1.6rem] border-[5px] border-[#1A2334] bg-black shadow-2xl shadow-black/60 ${className}`}>
        <div className="relative">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-white/20 z-10" aria-hidden="true" />
            <img src={src} alt={alt} loading="lazy" className="w-full aspect-[9/20] object-cover object-top block" />
        </div>
    </div>
);

/** W7: the "Preview the system" modal — real screens, the stack, what's inside.
 *  W10: the preview is REAL CAPTURES ONLY — live pages from the deployed
 *  systems plus the real app running its own demo data (P8 honesty: every
 *  screen is labelled with exactly what it is). No mocked-up UI. */
const WorkDetailModal: React.FC<{
    work: (typeof OUR_WORK)[number] | null;
    onClose: () => void;
    onContactSales: () => void;
}> = ({ work, onClose, onContactSales }) => {
    // Escape + scroll-lock (the landing page scrolls inside its own div).
    useEffect(() => {
        if (!work) return;
        const scroller = document.querySelector('[data-public-page]') as HTMLElement | null;
        const prevOverflow = scroller?.style.overflow ?? '';
        if (scroller) scroller.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            if (scroller) scroller.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [work, onClose]);

    if (!work) return null;

    return createPortal(
        // z-[10000] — above the cookie consent banner (z-[9999]) so a preview
        // is never obscured; the banner reappears once the modal closes.
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label={`${work.name} — system preview`}>
            <div className="absolute inset-0 bg-[#070D18]/85 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col animate-swap-in">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${work.iconClass}`}>
                            <work.Icon className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">{work.name}</h3>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{work.tagline}</p>
                        </div>
                    </div>
                    <Button
                        variant="bare"
                        onClick={onClose}
                        autoFocus
                        aria-label="Close preview"
                        className="p-2 rounded-sm text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </Button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-6 sm:px-8 py-6">
                    {/* W10: real captures only — live pages from the deployed
                        systems plus the real app on demo data. */}
                    <div className="mb-8">
                        <SystemTour system={work.tourSystem} />
                    </div>

                    <p className="text-slate-600 text-sm leading-[1.75] mb-8 max-w-2xl">{work.body}</p>

                    {/* What's inside */}
                    <p className="font-mono text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">Inside the system</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-8">
                        {work.inside.map((item) => (
                            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                                <CheckIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-500" />
                                {item}
                            </li>
                        ))}
                    </ul>

                    {/* Stack */}
                    <p className="font-mono text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">Built with</p>
                    <div className="flex flex-wrap gap-2 mb-8">
                        {work.stack.map((s) => (
                            <span key={s} className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                                {s}
                            </span>
                        ))}
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-3 pb-2">
                        <a
                            href={work.cta.href}
                            {...(work.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 transition-all shadow-md"
                        >
                            {work.cta.label}
                            {work.cta.external ? <ExternalLinkIcon className="w-4 h-4" /> : <span aria-hidden="true">→</span>}
                        </a>
                        <Button
                            variant="bare"
                            onClick={onContactSales}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm font-semibold text-sm text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                        >
                            Ask us about a system like this
                        </Button>
                    </div>
                    <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400 mt-4">
                        {work.name} · Built by PracticePro
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

const OurWorkSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const panelsRef = useScrollReveal<HTMLDivElement>();
    const [preview, setPreview] = useState<(typeof OUR_WORK)[number] | null>(null);

    return (
        <section id="ourWork" className="relative py-16 sm:py-24 overflow-hidden w7-dark">
            {/* deep ink base + brand aurora, so the real screens glow */}
            <div className="absolute inset-0 bg-[#0A101C]" aria-hidden="true" />
            <div className="absolute -top-40 left-1/4 w-[42rem] h-[42rem] rounded-full bg-emerald-600/10 blur-[140px] pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-52 right-1/4 w-[38rem] h-[38rem] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-12 md:mb-16">
                    <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-4 text-emerald-400/90">
                        Our work
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        Systems we&apos;ve built
                    </h2>
                    <p className="text-lg text-slate-400 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        Two products we run ourselves, a platform built to order for a client, and a free tool running on the open internet.
                        Each one takes a real workflow end to end — and shows what it takes to run a business that scales. Real screens, real stack, really live.
                    </p>
                </div>

                <div ref={panelsRef} className="w9-reveal-stagger grid grid-cols-1 gap-6 md:gap-10 max-w-6xl mx-auto">
                    {OUR_WORK.map((w, i) => (
                        <div
                            key={w.name}
                            className={`group relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 sm:p-10 transition-all duration-500 hover:border-white/20 hover:bg-white/[0.05] ${w.borderGlowClass}`}
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                                {/* Text side — alternates sides so the page breathes */}
                                <div className={`${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className={`w-11 h-11 rounded-md flex items-center justify-center ${w.iconClass}`}>
                                            <w.Icon className="w-5 h-5" />
                                        </span>
                                        <span className={`text-2xs font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-full ${w.badgeClass}`}>
                                            {w.badge}
                                        </span>
                                    </div>
                                    <h3 className="font-display text-3xl font-bold tracking-tight text-white">{w.name}</h3>
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1.5 mb-4">{w.tagline}</p>
                                    <p className="text-slate-300/90 text-sm leading-[1.75] mb-6">{w.body}</p>

                                    {/* Stack chips — the first few, full list in the preview */}
                                    <p className="font-mono text-2xs font-medium uppercase tracking-widest text-slate-500 mb-2.5">Built with</p>
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {w.stack.slice(0, 4).map((s) => (
                                            <span key={s} className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-2xs font-semibold text-slate-300">
                                                {s}
                                            </span>
                                        ))}
                                        {w.stack.length > 4 && (
                                            <span className="px-2.5 py-1 rounded-full text-2xs font-semibold text-slate-500">
                                                +{w.stack.length - 4} more
                                            </span>
                                        )}
                                    </div>

                                    {/* Key modules — a taste of what's inside */}
                                    <p className="font-mono text-2xs font-medium uppercase tracking-widest text-slate-500 mb-2.5">Inside the system</p>
                                    <ul className="space-y-1.5 mb-8">
                                        {w.inside.slice(0, 3).map((item) => (
                                            <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                                                <CheckIcon className="w-3.5 h-3.5 mt-1 flex-shrink-0 text-primary-500" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                                        <a
                                            href={w.cta.href}
                                            {...(w.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                            className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-all duration-300 group-hover:gap-2.5 ${w.ctaClass}`}
                                        >
                                            {w.cta.label} {w.cta.external
                                                ? <ExternalLinkIcon className="w-3.5 h-3.5" />
                                                : <span aria-hidden="true">→</span>}
                                        </a>
                                        <Button
                                            variant="bare"
                                            onClick={() => setPreview(w)}
                                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors min-h-[2rem]"
                                        >
                                            <DeviceMobileIcon className="w-4 h-4" /> Preview the system
                                        </Button>
                                        <span className="text-2xs font-semibold uppercase tracking-wider text-slate-600">Built by PracticePro</span>
                                    </div>
                                </div>

                                {/* Device side — real screens, floating in the glow */}
                                <div className={`relative ${i % 2 === 1 ? 'lg:order-1' : ''}`}>
                                    <div className={`absolute -inset-6 rounded-[2rem] blur-3xl opacity-60 group-hover:opacity-90 transition-opacity duration-700 ${w.glowClass}`} aria-hidden="true" />
                                    <div className="relative transition-transform duration-500 ease-out group-hover:-translate-y-1.5">
                                        <BrowserFrame
                                            url={w.frameUrl}
                                            src={w.primaryScreen.src}
                                            alt={w.primaryScreen.alt}
                                            className="transition-transform duration-500 group-hover:scale-[1.015] rotate-[-1.2deg] group-hover:rotate-0"
                                        />
                                        {/* The second surface: an in-app phone screen (Vega/Atrium)
                                            or a second live page (Kozy Care). */}
                                        {w.detailScreens[1].kind === 'phone' ? (
                                            <PhoneFrame
                                                src={w.detailScreens[1].src}
                                                alt={w.detailScreens[1].alt}
                                                className="absolute -bottom-8 -right-3 sm:-right-6 w-[27%] min-w-[92px] rotate-[3deg] w7-float"
                                            />
                                        ) : (
                                            <div className="absolute -bottom-8 -right-2 sm:-right-5 w-[46%] rotate-[2.2deg] w7-float">
                                                <BrowserFrame url={w.frameUrl + (w.name === 'Kozy Care' ? '/services' : '')} src={w.detailScreens[1].src} alt={w.detailScreens[1].alt} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <WorkDetailModal work={preview} onClose={() => setPreview(null)} onContactSales={onContactSales} />
        </section>
    );
};

// ─── HOW WE WORK (corporate hub) — the engagement process ──────────────────

const HOW_WE_WORK: Array<{
    num: string;
    title: string;
    body: string;
    Icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        num: '1',
        title: 'Understand your operations',
        body: 'We sit with your team and map how the business actually runs — the paperwork, the phone calls, the spreadsheets — and where the friction lives. You talk; we listen and take notes.',
        Icon: ClipboardListIcon,
    },
    {
        num: '2',
        title: 'Design the system',
        body: 'Workflows, data model, integrations and screens — designed with you and agreed before a line of code is written, so there are no surprises at handover.',
        Icon: PencilSquareIcon,
    },
    {
        num: '3',
        title: 'Build & integrate',
        body: 'We build in weekly increments and demo as we go, so your feedback lands in the product from week one — not at the end, when changes are expensive.',
        Icon: ComputerDesktopIcon,
    },
    {
        num: '4',
        title: 'Launch, train & run with you',
        body: 'We deploy, train your staff and migrate your records. Then we stay on — monitoring, supporting and iterating as the business grows.',
        Icon: CheckBadgeIcon,
    },
];

const HowWeWorkSection: React.FC = () => {
    const ref = useScrollReveal<HTMLDivElement>();
    const stepsRef = useScrollReveal<HTMLDivElement>();
    // W7: a vertical timeline whose spine fills with brand gradient as the
    // visitor scrolls — the process literally draws itself.
    // W9: the process also WALKS ITSELF — steps light up in sequence while
    // the section is in view (auto-advance every 3s), each node filling with
    // the brand gradient and its card lifting, with a pulse riding the
    // leading edge of the spine fill. Scroll progress and the walk combine:
    // the spine shows whichever is further along.
    const [progress, setProgress] = useState(0);
    const [active, setActive] = useState(0);
    const onProgress = React.useCallback((p: number) => setProgress(p), []);
    const timelineRef = useSectionProgress<HTMLDivElement>(onProgress);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let inView = false;
        const io = new IntersectionObserver((entries) => {
            inView = entries.some((en) => en.isIntersecting);
        }, { threshold: 0.25 });
        if (timelineRef.current) io.observe(timelineRef.current);
        const iv = window.setInterval(() => {
            if (inView) setActive((a) => (a + 1) % HOW_WE_WORK.length);
        }, 3000);
        return () => {
            io.disconnect();
            window.clearInterval(iv);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fill = Math.max(progress, (active + 1) / HOW_WE_WORK.length);
    return (
        <section id="howWeWork" className="py-16 sm:py-24 bg-white relative overflow-hidden">
            {/* W8: the FluidSeam above owns the dark→light transition now. */}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-12 md:mb-16">
                    <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--color-moss)' }}>
                        How we work
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        From first conversation to a system you scale with
                    </h2>
                    <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        The same process that produced Vega, Atrium and Kozy Care.
                    </p>
                </div>

                <div ref={timelineRef} className="relative max-w-3xl mx-auto">
                    <div className="absolute left-[27px] sm:left-1/2 sm:-translate-x-1/2 top-2 bottom-2 w-[3px] rounded-full bg-slate-200 overflow-visible" aria-hidden="true">
                        <div
                            className="w-full rounded-full bg-gradient-to-b from-emerald-300 via-emerald-500 to-primary-600 will-change-[height]"
                            style={{ height: `${Math.round(fill * 100)}%` }}
                        />
                        {/* W9: a pulse riding the leading edge of the fill. */}
                        {!reducedMotion && (
                            <span className="w9-spine-pulse" style={{ top: `${Math.round(fill * 100)}%` }} />
                        )}
                    </div>

                    <div ref={stepsRef} className="w9-reveal-stagger space-y-10 sm:space-y-14">
                        {HOW_WE_WORK.map((step, i) => (
                            <div key={step.num} className={`relative flex items-start gap-6 sm:gap-0 ${i % 2 === 1 ? 'sm:flex-row-reverse' : ''}`}>
                                {/* Node on the spine — W9: lights up as the walk passes. */}
                                <div className="relative z-10 flex-shrink-0 sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:flex-shrink">
                                    <span className={`w9-step-node flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-md shadow-slate-900/5 font-display text-xl font-extrabold ${i <= active ? 'is-active' : ''}`}>
                                        <span className="w9-step-num text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-primary-600">{step.num}</span>
                                    </span>
                                </div>
                                {/* Card — W9: the current step lifts. */}
                                <div className={`flex-1 sm:w-[calc(50%-3.5rem)] sm:max-w-sm ${i % 2 === 1 ? 'sm:mr-auto sm:text-right' : 'sm:ml-auto'}`}>
                                    <div className={`w9-step-card bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all ${i === active ? 'is-active' : ''}`}>
                                        <div className={`flex items-center gap-3 mb-3 ${i % 2 === 1 ? 'sm:flex-row-reverse' : ''}`}>
                                            <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                                                <step.Icon className="w-5 h-5" />
                                            </span>
                                            <h3 className="font-display text-lg font-bold text-slate-900 tracking-tight">{step.title}</h3>
                                        </div>
                                        <p className="text-slate-600 text-sm leading-[1.7]">{step.body}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

// ─── WHO WE ARE (corporate hub) — about the company ────────────────────────
// Where "Lagos, Nigeria" legitimately lives: not as a top-of-page eyebrow,
// but as the company's identity — a software company that runs its own
// products in production, which is the credibility pitch for client builds.

const ABOUT_FACTS: Array<{
    text: string;
    Icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        text: '3 systems live in production — Vega, Atrium and Kozy Care',
        Icon: CheckIcon,
    },
    {
        text: 'Payments, messaging, portals and AI automation shipping today, not planned',
        Icon: ZapIcon,
    },
    {
        text: 'NDPA 2023-aligned data handling, encrypted in transit and at rest',
        Icon: ShieldCheckIcon,
    },
    {
        text: 'Working with businesses across Nigeria and beyond — wherever a process needs a system',
        Icon: MapPinIcon,
    },
];

const AboutSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    // W10: the section settles in as a cascade — eyebrow, headline and each
    // paragraph arrive in sequence, then the facts card rises after the
    // copy (the old single-block reveal read as bland).
    const leftRef = useScrollReveal<HTMLDivElement>();
    const cardRef = useScrollReveal<HTMLDivElement>();
    return (
        <section id="about" className="py-16 sm:py-24" style={{ background: 'var(--color-paper)' }}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 max-w-6xl mx-auto items-center">
                    <div ref={leftRef} className="w9-reveal-stagger">
                        <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--color-moss)' }}>
                            Who we are
                        </p>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-6">
                            Built in Lagos.
                            <br />
                            Run in production.
                        </h2>
                            <p className="text-slate-600 leading-[1.75] mb-5">
                                PracticePro Systems is a software company based in Lagos, Nigeria. We build
                                the systems businesses use to manage their affairs — the daily operating
                                software that tracks the work, moves the money, talks to the customers and
                                keeps the records straight.
                            </p>
                            <p className="text-slate-600 leading-[1.75] mb-5">
                                We don&apos;t just build systems for other people — we run our own, every
                                working day. Vega serves Nigerian law firms and Atrium serves property
                                portfolios. That means the foundations a client system stands on — payments,
                                messaging, portals, automation, security — are already in production, not on
                                a roadmap.
                            </p>
                            <p className="text-slate-600 leading-[1.75]">
                                That is the difference between a software vendor and a software partner:
                                we live with the consequences of our engineering, in products we operate
                                ourselves. And when a business needs something that doesn&apos;t exist
                                yet — in any industry, anywhere — we build that too.
                            </p>
                    </div>
                    <div ref={cardRef} className="w9-reveal bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10 flex flex-col" style={{ '--w9-d': '420ms' } as React.CSSProperties}>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">PracticePro Systems at a glance</p>
                        <ul className="space-y-6 flex-1">
                            {ABOUT_FACTS.map((f, i) => (
                                <li key={i} className="flex items-start gap-4">
                                    <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                                        <f.Icon className="w-5 h-5" />
                                    </span>
                                    <span className="text-sm leading-[1.7] text-slate-700">{f.text}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="border-t border-slate-100 mt-8 pt-6">
                            <Button
                                variant="bare"
                                onClick={onContactSales}
                                className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors min-h-[2rem] inline-flex items-center gap-1.5"
                            >
                                Talk to us <span aria-hidden="true">→</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ─── HUB FINAL CTA (corporate hub) ─────────────────────────────────────────

const HubFinalCTASection: React.FC<{ onContactSales: () => void; scrollTo: (id: string) => void }> = ({ onContactSales, scrollTo }) => {
    // W7: the closing argument goes dark — an aurora of the brand colors
    // breathing behind the headline, so the page ends the way it began.
    // W9: it settles in with the same soft reveal as the rest of the page.
    const ref = useScrollReveal<HTMLDivElement>();
    return (
    <section className="relative py-20 md:py-28 overflow-hidden w7-dark">
        <div className="absolute inset-0 bg-[#0A101C]" aria-hidden="true" />
        {/* Aurora — two brand-green clouds drifting on a slow loop */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[46rem] h-[26rem] rounded-full bg-emerald-600/15 blur-[120px] w7-aurora-a" aria-hidden="true" />
        <div className="absolute -bottom-40 left-1/4 w-[30rem] h-[22rem] rounded-full bg-emerald-300/10 blur-[110px] w7-aurora-b" aria-hidden="true" />
        <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

        <div ref={ref} className="w9-reveal container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl relative">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white font-display">
                Have a process that should{' '}
                <span className="text-transparent bg-clip-text inline-block" style={{ backgroundImage: 'linear-gradient(to right, #6EE7B7, #34D399)' }}>
                    run itself?
                </span>
            </h2>
            <p className="text-lg text-slate-400 mt-4 max-w-2xl mx-auto">
                Tell us how your business works today — we&apos;ll show you what its system could
                look like. If one of our products already fits, we&apos;ll say so. If it
                doesn&apos;t, we&apos;ll build the one that does.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <Button
                    variant="bare"
                    onClick={onContactSales}
                    className="bg-white text-slate-900 px-8 py-4 rounded-sm font-semibold hover:bg-slate-100 hover:scale-[1.02] transition-all shadow-md"
                >
                    Tell us what you need
                </Button>
                <Button
                    variant="bare"
                    onClick={() => scrollTo('ourWork')}
                    className="bg-transparent border-2 border-white/20 text-white px-8 py-4 rounded-sm font-semibold hover:bg-white/10 hover:border-white/30 transition-all"
                >
                    Explore our products
                </Button>
            </div>
            <p className="text-sm text-slate-500 mt-6">
                We reply within 24 hours.
            </p>
        </div>
    </section>
    );
};

// (ResourcesSection removed — Resources is now a dedicated page)

// ─── MOBILE STICKY BOTTOM CTA BAR ─────────────────────────────────────────
// Fixed to the viewport bottom on mobile only (md:hidden). Sits above the
// WhatsApp FAB in z-order so the primary CTAs are always tappable. Uses
// backdrop-blur + bg-white/95 for a translucent backdrop so any hero text
// scrolling behind it stays partially visible rather than fully occluded.
// (Hero text already gets pb-28 padding on mobile to clear this bar + FAB.)
const MobileStickyCTA: React.FC<{ onSignup: () => void; onContactSales: () => void; activeProduct: 'vega' | 'atrium' }> = ({ onSignup, onContactSales, activeProduct }) => (
    <div className={`md:hidden fixed bottom-0 inset-x-0 z-[210] backdrop-blur-md border-t px-4 py-3 flex gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] ${
        activeProduct === 'vega'
            ? 'bg-vega-night/95 border-white/10'
            : 'bg-white/95 border-slate-200'
    }`}>
        <button
            onClick={onContactSales}
            className={`flex-1 py-3 rounded-lg border text-sm font-semibold transition-colors ${
                activeProduct === 'vega'
                    ? 'border-white/20 text-slate-200 hover:bg-white/5 active:bg-white/10'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100'
            }`}
        >
            Talk to Sales
        </button>
        {/* TASK 54: no-arg invocation — never leak the click event into the
            product override. Vega's primary is brass on the night page;
            Atrium's is its own emerald — never the moss brand ramp. */}
        <button
            onClick={() => onSignup()}
            className={`flex-[1.5] py-3 rounded-lg text-sm font-semibold transition-colors ${activeProduct === 'vega'
                ? 'bg-vega-gilt text-vega-night hover:bg-vega-gilt-bright active:bg-vega-gilt-bright'
                : 'bg-atrium-emerald hover:bg-emerald-700 active:bg-emerald-800 text-white'}`}
        >
            Start Free Trial
        </button>
    </div>
);

// ─── CHAT FLOATING ACTION BUTTON ───────────────────────────────────────────
// WHATSAPP REMOVAL (2026-09-14): the FAB previously wore WhatsApp's logo and
// brand green, implying a WhatsApp chat — but PracticePro has no registered
// WhatsApp Business number and the integration is retired. To keep the page
// honest, the FAB is now a neutral "Chat with us" bubble (emerald brand
// color, chat glyph) that opens the Contact Sales drawer — the actual
// working conversion flow (email-based, responds within 24 hours).
//
// MOBILE POSITIONING:
//   - On mobile (default), sits at bottom-24 (96px) — ABOVE the MobileStickyCTA
//     bar (~64px tall) so it never overlaps the primary CTAs.
//   - On md+ screens, drops to bottom-6 (24px) since there's no sticky bar.
//   - z-[220] sits ABOVE the MobileStickyCTA (z-210) so the FAB is always
//     tappable, but BELOW modal overlays (z-300+) so modals cover it.
const WhatsAppFAB: React.FC<{ onContactSales: () => void; activeProduct: 'vega' | 'atrium' }> = ({ onContactSales, activeProduct }) => (
    <button
        onClick={onContactSales}
        className={`fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[220] w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform ${activeProduct === 'vega'
            ? 'bg-vega-gilt'
            : 'bg-atrium-emerald'}`}
        aria-label="Chat with us — Contact Sales"
        title="Chat with us"
    >
        <svg className={`w-7 h-7 ${activeProduct === 'vega' ? 'text-vega-night' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
    </button>
);

// ─── ROOT COMPONENT ──────────────────────────────────────────────────────

export const LandingPage: React.FC<{ initialProduct?: 'vega' | 'atrium' }> = ({ initialProduct }) => {
    const { openModal } = useUI();
    const [activeSection, setActiveSection] = useState('home');
    const [activeProduct, setActiveProduct] = useState<'vega' | 'atrium'>(initialProduct || 'vega');
    const [productChosen, setProductChosen] = useState(!!initialProduct);
    const navigate = useNavigate();

    // Legal pages and Resources now use URL-based routing (navigate to /resources, /privacy-policy, etc.)
    // instead of local state flags. This makes them bookmarkable, shareable, and fetchable by external tools.

    const scrollRef = useRef<HTMLDivElement>(null);

    // ── Force LIGHT MODE on landing page ──────────────────────────────
    // The landing page is always light — no dark theme, no theme-* variants.
    // We strip the 'dark' and 'theme-*' classes from <html> on mount and
    // restore the previous classes on unmount so the app (after login) can
    // still respect the user's saved theme.
    useEffect(() => {
        const html = document.documentElement;
        // Capture current theme classes so we can restore them on unmount
        const savedClasses = html.className;
        // Strip all theme-related classes
        html.classList.remove('dark', 'theme-midnight', 'theme-oled', 'theme-neon-cyber', 'theme-sunlight-soft', 'theme-city-lights', 'theme-city-emerald', 'theme-midnight-emerald', 'theme-army-dark', 'theme-army-light');
        // FIX: Also strip font-size-sm if the user had it set from a previous
        // session. The landing page should always use the default font size (md).
        // Without this, the entire landing page renders at 87.5% scale if the
        // user previously set their font preference to "small" in the app.
        html.classList.remove('font-size-sm', 'font-size-lg');
        html.classList.add('font-size-md');
        return () => {
            // Restore on unmount — needed if user navigates away from landing
            // to the app (which should respect their saved theme and font size)
            html.className = savedClasses;
        };
    }, []);

    // VEGA REGISTER: App-level fixed surfaces (cookie bar, terms gate) live
    // OUTSIDE this root div, so .theme-vega cannot reach them. Flag the body
    // while /vega is the active product so scoped CSS can re-tint them there
    // — and only there. Removed on unmount and on every product switch.
    // ATRIUM REGISTER: same mechanism, emerald hooks (.on-atrium-page).
    useEffect(() => {
        const body = document.body;
        const onVega = productChosen && activeProduct === 'vega';
        const onAtrium = productChosen && activeProduct === 'atrium';
        body.classList.toggle('on-vega-page', onVega);
        body.classList.toggle('on-atrium-page', onAtrium);
        return () => {
            body.classList.remove('on-vega-page');
            body.classList.remove('on-atrium-page');
        };
    }, [productChosen, activeProduct]);

    // R21: per-product document identity — favicon, <title>, theme-color
    // and the og:/twitter: card swap with the page's product and restore
    // the PracticePro company identity on the hub.
    useProductBranding(activeProduct, productChosen);

    // R22 "The Night Chambers" — scroll-reveal machinery for /vega. Sections
    // opt in with [data-vg-reveal]; ONE observer reveals them as they enter
    // the viewport (staggered via each element's --vg-d delay custom prop).
    // A 'vg:reveal-all' document event force-reveals everything — used by
    // the audit/screenshot scripts before full-page captures and a safe
    // fallback for anchor jumps. Reduced-motion users get everything
    // visible immediately via CSS (no observer needed).
    useEffect(() => {
        if (!(productChosen && activeProduct === 'vega')) return;
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
    }, [productChosen, activeProduct]);

    // TASK 14: Sync productChosen + activeProduct with initialProduct when it
    // changes (SPA navigation). Without this, navigating from /vega back to /
    // via the browser's back button or logo click would leave productChosen=true,
    // showing the HomeSection ("Get Started" button) instead of the HubHero
    // (product cards). useState only uses the initial value on FIRST mount —
    // subsequent prop changes are ignored unless we sync them in a useEffect.
    useEffect(() => {
        if (initialProduct) {
            setActiveProduct(initialProduct);
            setProductChosen(true);
        } else {
            // On / (root), always show the HubHero — reset productChosen to false.
            // W14: also settle the page at the top — arriving back at the hub
            // (browser back, logo, All Products) should present the hero, not
            // a mid-scroll cut of the previous product page.
            setProductChosen(false);
            scrollRef.current?.scrollTo({ top: 0 });
        }
    }, [initialProduct]);

    useEffect(() => {
        const handleScroll = () => {
            if (!scrollRef.current) return;
            // W6: section tracking follows the page mode — the corporate hub
            // tracks its own sections (whatWeDo/ourWork/howWeWork/about),
            // product pages track features/pricing (as before) plus howItWorks.
            const sections = productChosen
                ? ['home', 'features', 'howItWorks']
                : ['home', 'whatWeDo', 'ourWork', 'howWeWork', 'about'];
            const scrollPos = scrollRef.current.scrollTop + 100;
            for (const section of sections) {
                const el = document.getElementById(section);
                if (el && scrollPos >= el.offsetTop && scrollPos < el.offsetTop + el.offsetHeight) {
                    setActiveSection(section);
                    break;
                }
            }
        };
        const container = scrollRef.current;
        container?.addEventListener('scroll', handleScroll);
        return () => container?.removeEventListener('scroll', handleScroll);
    }, [productChosen]);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el && scrollRef.current) {
            // W14: rect-based math — el.offsetTop lies for elements nested
            // inside positioned ancestors (the What-we-do grid sits inside a
            // `relative` section, so its offsetTop was measured from the
            // SECTION, not the page, and the cue landed ~2300px too high).
            // Measuring against the scroll container's own rect is correct
            // for every element, nested or not.
            const container = scrollRef.current;
            const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 64;
            container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
    };

    // W6/W14: product cards are gone from the hub — Vega/Atrium are reached
    // through the Products menu, the footer links and the work cards, all of
    // which now navigate to the real /vega and /atrium pages.

    // W14 (navigation truth): the hub and the product pages are REAL pages at
    // /, /vega and /atrium — so every path between them now moves the URL as
    // well as the state. The back button, refreshes and shared links all tell
    // the same story the screen does. The old state-only switching left
    // /atrium in the address bar while the hub rendered, and the Products
    // menu felt like it "didn't do anything".
    const handleBackToHub = () => {
        setProductChosen(false);
        scrollRef.current?.scrollTo({ top: 0 });
        if (window.location.pathname !== '/') navigate('/');
    };

    // R21 (owner direction): selecting a product OPENS ITS OWN PAGE IN A
    // NEW TAB — Vega and Atrium are separate product surfaces. This tab
    // stays exactly where it is. The old in-tab SPA product switch (and its
    // pricing-table scroll preservation) is retired along with the pricing
    // tiers the owner removed from the product pages.
    const openProductPage = (p: 'vega' | 'atrium') => {
        window.open(p === 'vega' ? '/vega' : '/atrium', '_blank', 'noopener,noreferrer');
    };

    // BUG FIX (Task 11): Only pass selectedProduct when the user has EXPLICITLY
    // chosen a product on the landing page. If they haven't (e.g. they clicked
    // "Get Started for Free" directly from the hero section without picking
    // Vega/Atrium/Komplete first), we pass NO selectedProduct — the Signup
    // modal will then start at the 'product_selection' step and ask them
    // which product they want.
    //
    // Previously, activeProduct defaulted to 'vega' and was ALWAYS passed to
    // the signup modal, so users who hadn't chosen a product were silently
    // funneled into the Vega signup flow — even though the Signup modal
    // already had a perfectly good product-selection step that was being
    // bypassed.
    //
    // TASK 17: When no product is chosen, "Get Started Free" scrolls to the
    // product cards and highlights them (one-pulse glow) instead of opening
    // the signup modal. The user explicitly requested this flow.
    // TASK 21: "Get Started" ALWAYS opens the signup modal with the product
    // selection step showing — UNLESS a specific productOverride is passed
    // (e.g. from the pricing section's product-specific CTAs).
    //
    // Previously, when productChosen was true (on /vega or /atrium), clicking
    // "Get Started" passed selectedProduct to the modal, which skipped the
    // product_selection step and went straight to the registration form.
    // The user explicitly requested: "Clicking 'Get Started' should immediately
    // present the product selection screen before prompting the user for their
    // registration details."
    //
    // Now: ALL "Get Started" buttons (header, hub, product pages) open the
    // signup modal with NO selectedProduct → the product_selection step shows.
    // Only the pricing section's product-specific CTAs pass an override.
    // TASK 21 (REVISED): "Get Started" should respect the user's current
    // product context:
    // - On '/' (root, no product chosen) → open signup with NO selectedProduct
    // → signup modal shows the product_selection step (asks which product).
    // - On '/vega' or '/atrium' (product already chosen via URL) → open
    // signup WITH selectedProduct = activeProduct → signup skips the
    // product_selection step and goes straight to the registration form.
    // - From the "Are you a real estate lawyer?" Komplete CTA → passes
    // 'unified' as productOverride → signup skips to form with product=unified.
    // - From the pricing section's tier CTAs → passes the active product
    // as productOverride → signup skips to form.
    //
    // This eliminates the repetitive "which product do you want?" question
    // when the user has already chosen a product by navigating to /vega or
    // /atrium, while still asking the question on the root hub page when
    // the user hasn't committed to a product yet.
    // FIX: When the user clicks "Start Free Trial" from the main landing page
    // (root hub, not a product-specific page like /vega or /atrium), they
    // should see the product selection step in the signup modal — NOT skip
    // directly to the create account form.
    //
    // The previous logic passed `undefined` as selectedProduct when the user
    // hadn't explicitly chosen a product (productChosen=false). But Signup.tsx's
    // useEffect treats `modalContext.selectedProduct` being falsy as "show
    // product_selection step" — EXCEPT the migration flow check at line 49-55
    // can override this and skip to the form.
    //
    // The fix: explicitly pass `null` (not `undefined`) when no product is
    // chosen, AND add a `forceProductSelection: true` flag that Signup.tsx
    // reads to guarantee the product_selection step is shown.
    // TASK 54 (2026-09-17 live incident): openSignup used to be wired directly
    // as `onClick={openSignup}` on the "Start Free Trial" buttons — React
    // passes the click event as the first argument, so the SyntheticEvent
    // object became `productOverride`. An event is TRUTHY, so it sailed past
    // the `productOverride ||` fallback, was passed to the signup modal as
    // `selectedProduct` (skipping the "Choose Your Solution" step — users
    // landed on the form and had to hit "← Back"), and on submit reached the
    // backend as the string "[object Object]", which every `|| 'legal'`
    // default downstream branded as Vega. A user signing up from the Atrium
    // page was told they had signed up for Vega.
    //
    // Fix: ONLY accept known product ids. Anything else (events, objects,
    // garbage) is treated as "no override". The call sites are also fixed to
    // `() => onSignup()`, but this guard makes openSignup safe to wire
    // directly to onClick forever.
    const openSignup = (productOverride?: ProductMode | unknown) => {
        // Normalize: null for anything that isn't a known product id.
        const override = normalizeSignupProduct(productOverride);
        // Priority: explicit valid override > current activeProduct (if chosen) > none
        const product = override || (productChosen ? normalizeSignupProduct(activeProduct) : null);
        openModal('signup', null, {
            selectedProduct: product,
            forceProductSelection: !product, // true when no product chosen
        });
    };
    const [isContactDrawerOpen, setIsContactDrawerOpen] = useState(false);
    const [contactDrawerSource, setContactDrawerSource] = useState('landing_page');
    const openContactSales = (source: string) => { setContactDrawerSource(source); setIsContactDrawerOpen(true); };

    // Legal pages and Resources are now handled by URL routing in App.tsx
    // (navigateTo('resources') → /resources, navigateTo('privacyPolicy') → /privacy-policy, etc.)
    // The LandingPage no longer conditionally renders them — the router handles it.

    return (
        <div
            ref={scrollRef}
            className={`h-[100dvh] w-full overflow-y-auto font-sans scroll-smooth md:[scrollbar-gutter:stable]${
                productChosen ? (activeProduct === 'vega' ? ' theme-vega' : ' theme-atrium') : ''
            }`}
            style={{ background: 'var(--color-paper)', color: 'var(--color-ink)', colorScheme: productChosen && activeProduct === 'vega' ? 'dark' : 'light' }}
            data-public-page
        >
            <NavBar
                activeSection={activeSection}
                scrollTo={scrollTo}
                onLogin={() => openModal('login')}
                onSignup={openSignup}
                onResources={() => navigate('/resources')}
                onContactSales={() => openContactSales('Nav')}
                activeProduct={activeProduct}
                onOpenProduct={openProductPage}
                productChosen={productChosen}
                onBackToHub={handleBackToHub}
            />

            {/* Skip to content link for accessibility — Vega's focus state
                lands on ink, Atrium's on its emerald; both keep their pages
                free of the other product's accent. */}
            <a
                href="#main-content"
                className={`sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[300] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:rounded-lg ${
                    productChosen && activeProduct === 'vega'
                        ? 'focus:bg-vega-gilt focus:text-vega-night'
                        : productChosen && activeProduct === 'atrium'
                        ? 'focus:bg-atrium-emerald focus:text-white'
                        : 'focus:bg-primary-600 focus:text-white'
                }`}
            >
                Skip to content
            </a>

            {!productChosen ? (
                // W6: the corporate hub — the company's own home page. The old
                // thin product-picker hero is replaced by the full corporate
                // narrative: hero → what we do → our work → how we work →
                // who we are → contact CTA.
                <main id="main-content" className="animate-swap-in">
                    <HubHero
                        onContactSales={() => openContactSales('Hub Hero')}
                        scrollTo={scrollTo}
                    />
                    <MarqueeStrip />
                    {/* W14: the mirror before the pitch — name the visitor's
                        daily friction FIRST, so "What we do" lands as the
                        answer to a problem they just recognised as theirs. */}
                    <PainMirrorSection onContactSales={() => openContactSales('Sound Familiar')} />
                    {/* W8: liquid seams — each section pours into the next
                        through a slowly morphing organic edge. */}
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
            ) : (
                <main key={activeProduct} id="main-content" className="animate-swap-in">
                    {activeProduct === 'vega' ? (
                        /* ══════════════════════════════════════════════════════
                           VEGA PASS A — "The Chambers Standard".
                           /vega renders ONLY Vega-owned sections: zero shared
                           marketing components below the nav. Section
                           inventory and order are deliberately different
                           from Atrium's page (hero → index line → matters
                           ledger → ink AI band → court-rule chronology →
                           Scale of Charges ledger → procedure schedule →
                           attestations → ink FAQ → colophon CTA = 10
                           bands; the pricing rate-card was removed by owner
                           direction — pricing is now sales-led).
                           ══════════════════════════════════════════════════════ */
                        <>
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
                        </>
                    ) : (
                        /* ══════════════════════════════════════════════════════
                           ATRIUM PASS B — "The Well-Kept Estate".
                           /atrium renders ONLY Atrium-owned sections: zero
                           shared marketing components below the nav. Section
                           inventory and order are deliberately different
                           from Vega's page (photo hero → sage stat band →
                           features grid → trust strip → light AI band →
                           estate occupancy grid → resident receipt →
                           gatehouse Sentry Pass → 3-step onboarding →
                           capability attestations → light FAQ → sage
                           close = 12 bands; the SCE pricing band was
                           removed by owner direction — pricing is now
                           sales-led).
                           ══════════════════════════════════════════════════════ */
                        <>
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
                                                </>
                    )}
                </main>
            )}

            {/* Mobile sticky bottom CTA bar */}
            {productChosen && (
                <MobileStickyCTA onSignup={openSignup} onContactSales={() => openContactSales('Mobile Sticky CTA')} activeProduct={activeProduct} />
            )}

            {/* WhatsApp floating action button */}
            <WhatsAppFAB onContactSales={() => openContactSales('WhatsApp FAB')} activeProduct={productChosen ? activeProduct : 'atrium'} />

            <ContactSalesDrawer isOpen={isContactDrawerOpen} onClose={() => setIsContactDrawerOpen(false)} source={contactDrawerSource} />
            <Footer
                onPrivacyClick={() => navigate('/privacy-policy')}
                onTermsClick={() => navigate('/terms-of-service')}
                onCookieClick={() => navigate('/cookie-policy')}
                onUsageClick={() => navigate('/usage-policy')}
                onResources={() => navigate('/resources')}
                onContactSales={() => openContactSales('Footer')}
                activeProduct={activeProduct}
                onOpenProduct={openProductPage}
                productChosen={productChosen}
            />
        </div>
    );
}

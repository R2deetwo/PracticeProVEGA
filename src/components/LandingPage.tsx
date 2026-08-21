
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
    Logo, CheckIcon, ZapIcon,
    ScalesIcon, ShieldCheckIcon, DocumentIcon, MattersIcon, SparklesIcon,
    OfficeBuildingIcon, SearchIcon, ArrowLeftIcon, LockClosedIcon, KeyIcon
} from '../constants';
import { useUI } from '../contexts/UIContext';
// Legal pages and Resources are now routed via URL in App.tsx — no need to import them here.
import {
    getDisplayTiersForProduct,
    formatTierPrice,
    DISPLAY_TIER_IDS,
    type ProductMode,
    type TierId,
    type TierDef,
} from '../constants/tiers';
import ContactSalesDrawer from './marketing/ContactSalesDrawer';

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

/** Primary CTA button – high-contrast gradient fill */
const PrimaryButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string }> = ({ onClick, children, className = '' }) => (
    <button
        onClick={onClick}
        className={`relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-lg shadow-primary-600/25 hover:shadow-glow-primary transition-all duration-300 active:scale-[0.97] ${className}`}
    >
        {children}
    </button>
);

/** Ghost/secondary button */
const GhostButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string }> = ({ onClick, children, className = '' }) => (
    <button
        onClick={onClick}
        className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-sm bg-white/70 text-slate-800 border border-slate-200 backdrop-blur-sm hover:bg-white transition-all duration-300 active:scale-[0.97] ${className}`}
    >
        {children}
    </button>
);

/** Pill badge */
const Pill: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-bold uppercase tracking-widest border ${className}`}>
        {children}
    </span>
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
    setActiveProduct: (p: 'vega' | 'atrium') => void;
    productChosen: boolean;
    onBackToHub: () => void;
}> = ({ activeSection, scrollTo, onLogin, onSignup, onResources, onContactSales, activeProduct, setActiveProduct, productChosen, onBackToHub }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    // Products dropdown — click-toggle (not hover) so iPad/tablet touch users
    // can open it. Hover is unreliable on iPadOS Safari.
    const [productsOpen, setProductsOpen] = React.useState(false);

    // Close mobile menu on product switch or navigation
    const handleNavClick = (fn: () => void) => {
        setMobileMenuOpen(false);
        fn();
    };

    return (
    <header className="fixed top-0 left-0 right-0 z-[250] transition-all duration-300 pt-safe">
        {/* Glass layer — always light on landing page */}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 transition-colors duration-500" />

        <div className="relative container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Logo + back-to-hub breadcrumb */}
            <div className="flex items-center gap-3">
                <button onClick={() => productChosen ? scrollTo('home') : undefined} className="flex items-center gap-2 group">
                    <Logo className="h-7 w-7 text-primary-500 group-hover:scale-105 transition-transform drop-shadow-sm" />
                    <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center">
                        Practice<span className="text-primary-500">Pro</span>
                    </span>
                </button>
                {productChosen && (
                    <button
                        onClick={onBackToHub}
                        className="hidden md:flex items-center pl-3 border-l border-slate-200 group/breadcrumb relative h-7"
                        style={{ overflow: 'hidden' }}
                        aria-label={`Back to all products — currently viewing ${activeProduct === 'vega' ? 'Vega' : 'Atrium'}`}
                    >
                        {/* Container — fixed width wide enough for "← All Products" on one line. */}
                        <span
                            className="relative flex items-center"
                            style={{ height: '1.25rem', width: '9rem', overflow: 'hidden', whiteSpace: 'nowrap' }}
                        >
                            <span
                                className={`absolute inset-0 flex items-center text-sm font-black uppercase tracking-tight transition-all duration-300 ease-out group-hover/breadcrumb:-translate-y-full group-hover/breadcrumb:opacity-0 ${activeProduct === 'vega' ? 'text-amber-500' : 'text-violet-400'}`}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                {activeProduct === 'vega' ? 'VEGA' : 'ATRIUM'}
                            </span>
                            <span
                                className="absolute inset-0 flex items-center gap-1 text-2xs font-black uppercase tracking-wide text-slate-400 translate-y-full opacity-0 group-hover/breadcrumb:translate-y-0 group-hover/breadcrumb:opacity-100 group-hover/breadcrumb:text-primary-500 transition-all duration-300 ease-out"
                                style={{ whiteSpace: 'nowrap', flexWrap: 'nowrap' }}
                            >
                                <ArrowLeftIcon className="w-3 h-3" style={{ flexShrink: 0 }} />
                                <span style={{ flexShrink: 0 }}>All Products</span>
                            </span>
                        </span>
                    </button>
                )}
            </div>

            {/* Desktop Links — shown on lg+ (1024px+). Raised from md: to lg:
                because iPad portrait (768-820px) was showing this nav and
                overflowing horizontally on /vega and /atrium pages (9 items
                don't fit in 720px). iPad portrait now uses the mobile menu. */}
            <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
                {/* Products dropdown — click-toggle (was hover-only, which
                    broke iPad/tablet touch). Click to open, click again or
                    click outside to close. */}
                <div className="relative">
                    <button
                        onClick={() => setProductsOpen(o => !o)}
                        onBlur={() => setTimeout(() => setProductsOpen(false), 150)}
                        aria-expanded={productsOpen}
                        aria-haspopup="true"
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 transition-all duration-200"
                    >
                        Products
                        <svg className={`w-4 h-4 ml-0.5 opacity-60 transition-transform ${productsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {productsOpen && (
                        <div className="absolute top-full left-0 pt-1 w-[210px]">
                            <div className="bg-white border border-slate-200 rounded-lg shadow-xl flex flex-col p-1">
                                <button
                                    onClick={() => { setActiveProduct('vega'); setProductsOpen(false); }}
                                    className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${activeProduct === 'vega' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                >
                                    <ScalesIcon className="w-4 h-4 opacity-70" />
                                    Vega
                                </button>
                                <button
                                    onClick={() => { setActiveProduct('atrium'); setProductsOpen(false); }}
                                    className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${activeProduct === 'atrium' ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                >
                                    <OfficeBuildingIcon className="w-4 h-4 opacity-70" />
                                    Atrium
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                {productChosen && (
                    <>
                    <button
                        onClick={() => scrollTo('features')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === 'features'
                                ? 'bg-primary-50 text-primary-700'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        Features
                    </button>
                    <button
                        onClick={() => scrollTo('pricing')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === 'pricing'
                                ? 'bg-primary-50 text-primary-700'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        Pricing
                    </button>
                    <button
                        onClick={() => scrollTo('howItWorks')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === 'howItWorks'
                                ? 'bg-primary-50 text-primary-700'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        How It Works
                    </button>
                    </>
                )}
                <button
                    onClick={onResources}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200"
                >
                    Resources
                </button>
                <button
                    onClick={onContactSales}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200"
                >
                    Contact
                </button>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
                <div className="hidden lg:block h-4 w-px bg-slate-200 mx-1" />

                <button
                    onClick={onLogin}
                    className="hidden lg:block px-4 py-2 text-sm font-semibold text-slate-700 hover:text-primary-600 transition-colors"
                >
                    Log In
                </button>
                <PrimaryButton onClick={onSignup} className="!px-3 !py-2 sm:!px-3 sm:!py-1.5 !rounded-lg !text-xs sm:!text-2xs ml-1 lg:ml-2 lg:!text-sm lg:!px-5 lg:!py-2.5 lg:!rounded-lg">
                    Start Free Trial
                </PrimaryButton>

                {/* Mobile hamburger button — shown below lg (1024px) so iPad
                    portrait uses the mobile menu instead of the overflowed
                    desktop nav. */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
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
            <div className="lg:hidden fixed inset-0 top-[calc(4rem+env(safe-area-inset-top,0px))] z-[240] bg-white overflow-y-auto">
                <nav className="container mx-auto px-4 py-6 flex flex-col gap-1" aria-label="Mobile navigation">
                    {/* Back-to-hub affordance — mobile users on /vega or /atrium
                        need a way to get back to the hub page. Previously this
                        was only available via the (invisible on touch) hover
                        breadcrumb in the desktop nav. */}
                    {productChosen && (
                        <button
                            onClick={() => handleNavClick(onBackToHub)}
                            className="w-full text-left px-4 py-3 mb-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                        >
                            <ArrowLeftIcon className="w-5 h-5 opacity-70" /> All Products
                        </button>
                    )}
                    <div className="mb-2">
                        <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 px-4 py-2">Products</p>
                        <button onClick={() => handleNavClick(() => setActiveProduct('vega'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-3 ${activeProduct === 'vega' ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                            <ScalesIcon className="w-5 h-5 opacity-70" /> Vega — For Law Firms
                        </button>
                        <button onClick={() => handleNavClick(() => setActiveProduct('atrium'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-3 ${activeProduct === 'atrium' ? 'bg-purple-50 text-purple-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                            <OfficeBuildingIcon className="w-5 h-5 opacity-70" /> Atrium — For Property Managers
                        </button>
                    </div>
                    {productChosen && (
                        <>
                        <button onClick={() => handleNavClick(() => scrollTo('features'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Features</button>
                        <button onClick={() => handleNavClick(() => scrollTo('pricing'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Pricing</button>
                        <button onClick={() => handleNavClick(() => scrollTo('howItWorks'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">How It Works</button>
                        </>
                    )}
                    <button onClick={() => handleNavClick(onResources)} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Resources</button>
                    <button onClick={() => handleNavClick(onContactSales)} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Contact</button>
                    <div className="h-px bg-slate-200 my-3" />
                    <button onClick={() => handleNavClick(onLogin)} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Log In</button>
                    <PrimaryButton onClick={() => handleNavClick(onSignup)} className="!w-full !py-3 !rounded-lg !text-sm mt-2">
                        Start Free Trial
                    </PrimaryButton>
                    <p className="text-2xs text-slate-400 text-center mt-4">No credit card required · 30-day free trial</p>
                </nav>
            </div>
        )}
    </header>
    );
};

// ─── FOOTER ─────────────────────────────────────────────────────────────────

const Footer: React.FC<{ onPrivacyClick: () => void; onTermsClick: () => void; onCookieClick: () => void; onUsageClick: () => void; onResources: () => void; onContactSales: () => void; activeProduct: 'vega' | 'atrium'; setActiveProduct: (p: 'vega' | 'atrium') => void; productChosen: boolean }> = ({ onPrivacyClick, onTermsClick, onCookieClick, onUsageClick, onResources, onContactSales, activeProduct, setActiveProduct, productChosen }) => (
    <footer className="bg-slate-950 border-t border-white/5 py-10 md:py-16 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-16">
        <div className="container mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-10 mb-12">
                {/* Brand */}
                <div>
                    <div className="flex items-center gap-2.5 mb-4">
                        <Logo className="h-6 w-6 text-primary-500" aria-hidden="true" />
                        <span className="text-white font-bold text-lg flex items-center">
                            Practice<span className="text-primary-500">Pro</span>
                            {productChosen && (
                                <span
                                    className={`ml-2 text-sm font-black uppercase tracking-tight ${activeProduct === 'vega' ? 'text-amber-500' : 'text-violet-400'}`}
                                >
                                    {activeProduct === 'vega' ? 'VEGA' : 'ATRIUM'}
                                </span>
                            )}
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-xs">Building systems for Nigerian organizations.</p>
                    {productChosen && (
                        <div className="mt-4 flex items-center gap-3">
                            <button
                                onClick={() => setActiveProduct(activeProduct === 'vega' ? 'atrium' : 'vega')}
                                className="text-2xs font-bold uppercase tracking-widest text-primary-500 hover:text-primary-400 flex items-center gap-1.5 py-1 px-2 rounded-lg border border-primary-500/20 hover:bg-primary-500/5 transition-all"
                            >
                                Switch to {activeProduct === 'vega' ? 'Atrium' : 'Vega'} <span className="text-xs">→</span>
                            </button>
                        </div>
                    )}
                </div>
                {/* Product — only rendered when a product is chosen */}
                {productChosen && (
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Product</p>
                        <div className="flex flex-col gap-2.5">
                            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Features</button>
                            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Pricing</button>
                            <button onClick={onResources} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Resources</button>
                            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Changelog</button>
                        </div>
                    </div>
                )}
                {/* Portals — only rendered when a product is chosen */}
                {productChosen && (
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Portals</p>
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
                {/* Company — always on the far right (column 4) */}
                <div className={productChosen ? '' : 'md:col-start-4'}>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Company</p>
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
                <p className="text-xs text-slate-500">NDPA 2023 Compliant · TLS 1.3 Encrypted · *Encryption provided by infrastructure</p>
            </div>
        </div>
    </footer>
);

// ─── TRUST BADGES ─────────────────────────────────────────────────────────────

const BADGES = [
    { label: 'NDPA 2023 Compliant', Icon: ScalesIcon },
    { label: 'TLS 1.3 Encrypted', Icon: LockClosedIcon },
    { label: 'Data Encrypted at Rest*', Icon: KeyIcon }
];

const TrustBadgesStrip: React.FC = () => {
    const ref = useScrollReveal<HTMLDivElement>();
    return (
        <div ref={ref} className="scroll-reveal bg-white border-y border-slate-200/60 py-5 px-4 sm:px-6">
            <div className="container mx-auto flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-10">
                {BADGES.map((b, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-50 shadow-sm border border-slate-200/60 flex items-center justify-center">
                            <b.Icon className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="text-2xs sm:text-xs font-semibold text-slate-600 tracking-wide whitespace-nowrap">
                            {b.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── STATS DEMARCATOR (Issue 1 fix — user's actual request) ──────────────────
// The stats strip (3-Tier, End-to-End, 99.9%, NDPA 2023) is moved OUT of the
// HomeSection hero and into its own centered section that sits between the
// hero and the features section. This makes it function as a structural
// break / demarcator between the top landing page and the features part —
// exactly what the user asked for. NOT a new content section, just the
// existing stats strip repositioned and centered.

const StatsDemarcator: React.FC<{ activeProduct: 'vega' | 'atrium' }> = ({ activeProduct }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const isVega = activeProduct === 'vega';
    const stats = isVega ? VEGA_STATS : ATRIUM_STATS;

    return (
        <section
            ref={ref}
            className="scroll-reveal w-full py-10 sm:py-16 lg:py-20 px-4 sm:px-6"
            style={{ background: 'var(--color-sage)' }}
        >
            <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 text-center">
                    {stats.map((s, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <p
                                className="font-display nums-tabular text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 whitespace-nowrap"
                                style={{ color: 'var(--color-ink)' }}
                            >
                                {s.value}
                            </p>
                            <p className="text-xs md:text-sm leading-tight text-slate-600 tracking-wide">
                                {s.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// ─── HUB HERO (no product chosen yet) ───────────────────────────────────────

const HubHero: React.FC<{
    onPickProduct: (p: 'vega' | 'atrium') => void;
    onLogin: () => void;
    highlightKey?: number;
}> = ({ onPickProduct, onLogin, highlightKey }) => {
    // Landing page is ALWAYS light mode. Hub is intentionally minimal:
    // headline, subheadline, two product cards, auth link. Nothing else.
    // Uses Paper background (warm off-white) + Space Grotesk for headline.
    return (
        <section className="relative overflow-hidden min-h-[100dvh] flex flex-col" style={{ background: 'var(--color-paper)' }}>
            {/* Subtle dot grid — the only background texture */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,_#e2e8f0_1px,_transparent_1px)] [background-size:32px_32px] opacity-50" />

            {/* hero-stagger: orchestrates headline → subheadline → cards → auth link */}
            <div className="hero-stagger relative z-10 flex-1 flex flex-col items-center justify-center pt-24 pb-16 px-4 sm:px-6 text-center">

                <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-[5rem] font-bold tracking-tight leading-[1.06] mb-5 max-w-4xl" style={{ color: 'var(--color-ink)' }}>
                    Professional Practice,
                    <br />
                    <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, var(--color-amber), var(--color-emerald), var(--color-moss))` }}>
                        Precisely Managed.
                    </span>
                </h1>

                <p className="text-lg md:text-xl max-w-xl mx-auto mb-14 leading-[1.75] text-slate-600">
                    Select your discipline to enter your dedicated workspace.
                </p>

                {/* Audience routing cards — unified .landing-card token system */}
                <div data-product-cards className="grid md:grid-cols-2 gap-5 w-full max-w-3xl mx-auto mb-12">
                    {/* Vega card — typographic, amber accent on hover */}
                    <button
                        key={`vega-${highlightKey || 0}`}
                        onClick={() => onPickProduct('vega')}
                        className="landing-card group relative text-left active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                        style={{ '--border-card-hover': 'rgba(217, 119, 6, 0.4)' } as React.CSSProperties}
                    >
                        <div className="flex items-baseline gap-3 mb-3">
                            <span className="font-display text-3xl font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>Vega</span>
                            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-amber)' }}>Legal</span>
                        </div>
                        <h3 className="text-base font-semibold mb-3 text-slate-700">For Nigerian Law Firms</h3>
                        <p className="text-sm leading-[1.7] text-slate-500 mb-6">
                            Case management, AI-assisted drafting, and automated billing.
                        </p>
                        <div className="flex items-center gap-1.5 text-sm font-semibold transition-all duration-300 group-hover:gap-2.5" style={{ color: 'var(--color-amber)' }}>
                            Enter Vega <span aria-hidden="true">→</span>
                        </div>
                    </button>

                    {/* Atrium card — typographic, emerald accent on hover */}
                    <button
                        key={`atrium-${highlightKey || 0}`}
                        onClick={() => onPickProduct('atrium')}
                        className="landing-card group relative text-left active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                        style={{ '--border-card-hover': 'rgba(5, 150, 105, 0.4)' } as React.CSSProperties}
                    >
                        <div className="flex items-baseline gap-3 mb-3">
                            <span className="font-display text-3xl font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>Atrium</span>
                            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-emerald)' }}>Property</span>
                        </div>
                        <h3 className="text-base font-semibold mb-3 text-slate-700">For Property Managers</h3>
                        <p className="text-sm leading-[1.7] text-slate-500 mb-6">
                            Revenue monitoring, rent collection, and portfolio analytics.
                        </p>
                        <div className="flex items-center gap-1.5 text-sm font-semibold transition-all duration-300 group-hover:gap-2.5" style={{ color: 'var(--color-emerald)' }}>
                            Enter Atrium <span aria-hidden="true">→</span>
                        </div>
                    </button>
                </div>

                {/* Auth link — single, quiet. Min 32px touch target. */}
                <button
                    onClick={onLogin}
                    className="text-sm transition-colors text-slate-500 hover:text-slate-700 min-h-[2rem] py-1"
                >
                    Already have an account?{' '}
                    <span className="font-semibold hover:underline" style={{ color: 'var(--color-moss)' }}>Sign in →</span>
                </button>

                {/* Compliance note — quiet, bottom */}
                <p className="text-xs mt-10 tracking-wide text-slate-500">NDPA 2023 Compliant · TLS 1.3 · Encrypted at Rest*</p>
            </div>
        </section>
    );
};

// ─── HOME / HERO ─────────────────────────────────────────────────────────────

const VEGA_STATS = [
    { value: '3-Tier', label: 'Flexible Pricing' },
    { value: 'End-to-End', label: 'Case Lifecycle' },
    { value: '99.9%', label: 'Platform Uptime' },
    { value: 'NDPA 2023', label: 'Data Compliant' },
];

const ATRIUM_STATS = [
    { value: '20–∞', label: 'Managed Units' },
    { value: 'End-to-End', label: 'Rent Collection' },
    { value: '99.9%', label: 'Platform Uptime' },
    { value: 'NDPA 2023', label: 'Data Compliant' },
];

const HomeSection: React.FC<{ onSignup: () => void; activeProduct: 'vega' | 'atrium'; setActiveProduct: (p: 'vega' | 'atrium') => void }> = ({ onSignup, activeProduct, setActiveProduct }) => {
    // FIX: Use activeProduct instead of useProduct() — landing page has no firm
    const isProperty = activeProduct === 'atrium';
    // Landing page is ALWAYS light mode — no isDark logic.
    const isVega = activeProduct === 'vega';

    // ── Image cycling ──────────────────────────────────────────────
    // Auto-rotate through 3 images per product every 6 seconds with a
    // crossfade. Younger lawyers/pros, varied scenes (desk work, mentoring,
    // team meeting). Cache-busted via build SHA so new deploys always fetch
    // fresh images instead of serving stale cached versions.
    const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();
    const heroImages = isVega
        ? [
            `/assets/landing/vega-hero-1.jpg?v=${buildSha}`,
            `/assets/landing/vega-hero-2.jpg?v=${buildSha}`,
            `/assets/landing/vega-hero-3.jpg?v=${buildSha}`,
        ]
        : [
            `/assets/landing/atrium-hero-1.jpg?v=${buildSha}`,
            `/assets/landing/atrium-hero-2.jpg?v=${buildSha}`,
            `/assets/landing/atrium-hero-3.jpg?v=${buildSha}`,
        ];
    const [currentImageIdx, setCurrentImageIdx] = useState(0);
    useEffect(() => {
        // Skip cycling if user prefers reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const interval = setInterval(() => {
            setCurrentImageIdx(prev => (prev + 1) % heroImages.length);
        }, 6000);
        return () => clearInterval(interval);
    }, [heroImages.length]);

    // Duotone brand tint — amber for Vega, emerald for Atrium.
    const accentColorValue = isVega ? '#D97706' : '#059669';

    return (
        <section id="home" className="relative overflow-hidden" style={{ background: 'var(--color-paper)' }}>
            {/* ── Subtle dot grid only — no radial glow blob ── */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,_#e2e8f0_1px,_transparent_1px)] [background-size:32px_32px] opacity-50" />

            {/* ── Hero Content — 2-column on desktop, stacked on mobile ── */}
            <div className="hero-stagger relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:pt-48 lg:pb-32">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                    {/* Left: text content */}
                    <div className="text-center lg:text-left">
                        {/* Headline — Space Grotesk display */}
                        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6" style={{ color: 'var(--color-ink)' }}>
                            {isVega ? <>Practice<br />Management</> : <>Revenue<br />Monitor</>}{' '}
                            <br className="hidden md:block" />
                            for{' '}
                            <span className="relative">
                                <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, ${accentColorValue}, var(--color-moss))` }}>
                                    {isVega ? 'Nigerian Law Firms' : 'Property Managers'}
                                </span>
                            </span>
                        </h1>

                        {/* Sub-copy */}
                        <p className="text-lg max-w-2xl mx-auto lg:mx-0 mb-10 leading-[1.7] text-slate-600">
                            {isVega
                                ? 'Enterprise-grade case management, AI-assisted drafting, and automated billing — built from the ground up for Nigerian legal practice.'
                                : 'Purpose-built for Nigerian property portfolios — for professional property managers and diaspora property owners alike. Facilities management, service charge collection, a residents\' portal, and AI-powered revenue intelligence in one platform.'}
                        </p>

                        {/* CTAs */}
                        <div className="flex gap-4 justify-center lg:justify-start items-center mb-8">
                            <PrimaryButton onClick={onSignup} className="text-base px-8 py-4 shadow-xl shadow-primary-500/30">
                                Get Started
                            </PrimaryButton>
                        </div>

                        {/* Image pagination dots — shows which image is active */}
                        <div className="flex gap-2 justify-center lg:justify-start items-center">
                            {heroImages.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentImageIdx(i)}
                                    className="p-2.5 flex items-center justify-center touch-target"
                                    aria-label={`View image ${i + 1}`}
                                    aria-pressed={i === currentImageIdx}
                                >
                                    <span
                                        className="h-1.5 rounded-full transition-all duration-300 block"
                                        style={{
                                            width: i === currentImageIdx ? '24px' : '8px',
                                            backgroundColor: i === currentImageIdx ? accentColorValue : 'rgb(203 213 225)',
                                        }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: hero image — CYCLING GALLERY with crossfade, bleeds to right edge */}
                    <div className="relative order-first lg:order-last">
                        {/* On desktop: image bleeds to the right edge of the section (negative margin) */}
                        <div className="relative aspect-[4/3] lg:-mr-6 xl:-mr-12 rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5">
                            {/* Stack all images, only the current one is visible (crossfade) */}
                            {heroImages.map((imgSrc, i) => (
                                <img
                                    key={i}
                                    src={imgSrc}
                                    alt={isVega
                                        ? `Nigerian lawyers collaborating — image ${i + 1}`
                                        : `Nigerian property professionals collaborating — image ${i + 1}`}
                                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-out"
                                    style={{
                                        opacity: i === currentImageIdx ? 1 : 0,
                                        zIndex: i === currentImageIdx ? 2 : 1,
                                    }}
                                    loading={i === 0 ? 'eager' : 'lazy'}
                                />
                            ))}
                            {/* Duotone brand-color overlay — amber for Vega, emerald for Atrium. */}
                            <div
                                className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-20"
                                style={{ backgroundColor: accentColorValue, zIndex: 3 }}
                                aria-hidden="true"
                            />
                            {/* Subtle gradient overlay for depth */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent pointer-events-none" style={{ zIndex: 4 }} aria-hidden="true" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom fade into next section */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t to-transparent pointer-events-none" style={{ backgroundImage: 'linear-gradient(to top, var(--color-sage), transparent)' }} />
        </section>
    );
};

// ─── FEATURES ────────────────────────────────────────────────────────────────

const VEGA_FEATURE_CATEGORIES = [
    {
        category: 'Case Management',
        Icon: ScalesIcon,
        items: [
            { title: 'Matter Management', desc: 'Organize cases by court, jurisdiction, and matter type. Link documents, parties, and deadlines in a unified workspace with custom matter IDs and court rule templates.' },
            { title: 'Court Date Reminders', desc: 'Automated WhatsApp reminders 7, 3, and 1 day(s) before each hearing. Never miss a court date again — reminders fire automatically based on your matter\'s adjourned date, sent directly to the assigned lawyer(s).', badge: 'Pro' },
            { title: 'Task Board', desc: 'Kanban-style task management with assignments, due dates, priority levels, and matter linking. Track every deliverable from intake to resolution.' },
            { title: 'Client Portal', desc: 'Self-service portal for clients to view matter milestones, upload and access documents, and submit KYC uploads. Available on Growth and Pro plans.', badge: 'Growth+' },
            { title: 'Contacts & Parties', desc: 'Structured contact management with party grouping, witness tracking, and counsel records. Link contacts to matters and documents automatically.' },
        ],
    },
    {
        category: 'Legal Drafting',
        Icon: SparklesIcon,
        items: [
            { title: 'DraftPro Editor', desc: 'Rich-text editor with A4 pagination and Nigerian legal fonts. Placeholder guardrails block printing until every blank is filled — so you never accidentally send incomplete work. Draft, tweak, then save to a matter, print, or copy to Word.' },
            { title: 'ALOA AI Copilot', desc: 'Your firm\'s always-on legal intelligence — ask questions about your matters, get instant case summaries, analyze opposing counsel patterns, research precedent across Nigerian courts, and surface insights from your document vault. Trained on Nigerian legal terminology and court rules.', badge: 'Growth+' },
            { title: 'Document Vault', desc: 'Secure document storage linked to every matter. Version history, access controls, NDPA-compliant metadata, and full-text search across your firm\'s document library.' },
            { title: 'Research Studio', desc: 'Legal research workspace with jurisdiction-specific modules, statute lookup, and AI-assisted case analysis.', badge: 'Growth+', isLegalOnly: true },
        ],
    },
    {
        category: 'Billing & Finance',
        Icon: DocumentIcon,
        items: [
            { title: 'Legal Billing', desc: 'Generate professional invoices seamlessly. Track billable hours, apply court-aligned rates, and automate retainer billing cycles.' },
            { title: 'Financial Dashboard', desc: 'Real-time revenue analytics, outstanding balances, and payment tracking. See which matters are profitable and which clients are overdue.', badge: 'Pro' },
            { title: 'Bank Transfer Payments', desc: 'Honest payment workflow with Nigerian bank account details displayed on invoices. No pretend card forms — clients transfer directly to your firm\'s account.' },
        ],
    },
];

const ATRIUM_FEATURE_CATEGORIES = [
    {
        category: 'Property Management',
        Icon: OfficeBuildingIcon,
        items: [
            { title: 'Property Portfolio', desc: 'Manage residential, commercial, and mixed-use properties from a single dashboard. Track occupancy, upload photos, organize by location, and link to tenancy records.' },
            { title: 'Resident Management', desc: 'Complete resident profiles with KYC fields, lease agreements, and communication history. Manage resident lifecycles from application through to departure.' },
            { title: "Residents' Portal", desc: "Self-service portal where residents view SC/MV payment status, download rent receipts, and log maintenance tickets directly into your workflow. Available on Growth and Pro plans.", badge: 'Growth+' },
            { title: 'Revenue Monitor', desc: 'Real-time defaulter dashboard, rent collection tracking, and portfolio-level financial analytics. Know which residents are overdue and which properties are underperforming.' },
        ],
    },
    {
        category: 'Rent & Collections',
        Icon: DocumentIcon,
        items: [
            { title: 'Rent Collection', desc: 'Collect rent in Naira with payment reminders, receipt generation, and payment tracking. Generate invoices and track status at a glance.' },
            { title: 'Service Charge Tracking', desc: 'Itemized SC (Service Charge) and MV (Minimum Vend) tracking per unit. Monitor payment status, flag defaulters, and generate compliance-ready financial reports.' },
            { title: 'WhatsApp Notifications', desc: 'Send rent reminders and demand notices via WhatsApp directly from the platform. Tiered volume limits with morning notification throttles on Pro plans.', badge: 'Pro' },
            { title: 'Lease Management', desc: 'Lease expiry alerts and calendar integration. Send renewal notices and rent review communications. Never miss a critical date again.' },
        ],
    },
    {
        category: 'Maintenance & Operations',
        Icon: ShieldCheckIcon,
        items: [
            { title: 'Sentry Pass', desc: 'Generate 6-digit visitor access codes for guests, contractors, and delivery personnel. Gatekeepers verify codes at the security terminal via PIN or QR code scan. Full audit trail with check-in/check-out timestamps. Includes offline fallback for unreliable gatehouse connectivity.', badge: 'Add-on' },
            { title: 'Maintenance Tickets', desc: 'Residents log issues directly into your workflow via the portal. Categorize by plumbing, electrical, structural, or other. Track status from open to resolved.' },
            { title: 'Expense Tracking', desc: 'Log maintenance costs, service charges, and utility bills per property. Track income vs. expenses with cash flow visualizations.' },
            { title: 'Estate Administration Documents', desc: 'Streamline property administration, manage tenancy records, and generate standard estate management administrative documents with precision.', badge: 'Pro' },
        ],
    },
    {
        category: 'AI & Research',
        Icon: SparklesIcon,
        items: [
            { title: 'ARIA AI Copilot', desc: 'Your portfolio\'s always-on property intelligence — ask questions about your properties, get instant revenue insights, analyze defaulter patterns, research Nigerian property law, and surface insights from your portfolio data. Built for Nigerian property management.', badge: 'Growth+' },
            { title: 'Research Studio', desc: 'Research workspace with document analysis, intelligent search, and AI-assisted document review. Build research notebooks with source citations for property law and compliance matters.', badge: 'Growth+' },
        ],
    },
];

const FeaturesSection: React.FC<{ activeProduct: 'vega' | 'atrium' }> = ({ activeProduct }) => {
    // FIX: Use activeProduct (local state) instead of useProduct() (which returns
    // 'unified' on the landing page when no firm is loaded). This was causing
    // the Vega page to filter features incorrectly.
    const isVega = activeProduct === 'vega';
    const isProperty = activeProduct === 'atrium';
    const categories = isVega ? VEGA_FEATURE_CATEGORIES.map(cat => ({ ...cat, items: cat.items.filter(item => isProperty ? !item.isLegalOnly : !item.isPropertyOnly) })).filter(cat => cat.items.length > 0) : ATRIUM_FEATURE_CATEGORIES;

    // Scroll reveal — subtle fade-in when section enters viewport
    const headerRef = useScrollReveal<HTMLDivElement>();
    const sectionsRef = useScrollReveal<HTMLDivElement>();

    // ISSUE 2 FIX: per-ROW expand state (not per-card).
    // When user hovers ANY card in a category's row, ALL cards in that row
    // expand together. On mouseleave from the entire row, all collapse together.
    // Moving the mouse between two cards in the same row does NOT trigger
    // close/reopen flicker. Mobile/tap behavior unchanged (accordion, one card
    // at a time per category).
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [tappedCard, setTappedCard] = useState<string | null>(null);
    const accentColorValue = isVega ? '#D97706' : '#059669';
    const accentShadow = isVega ? 'rgba(217, 119, 6, 0.15)' : 'rgba(5, 150, 105, 0.15)';

    return (
        <section id="features" className="py-12 sm:py-20 lg:py-28" style={{ background: 'var(--color-paper)' }}>
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                {/* Header */}
                <div ref={headerRef} className="scroll-reveal text-center mb-10 md:mb-16">
                    <Pill className="mb-5 bg-primary-50 text-primary-700 border-primary-200">
                        Features
                    </Pill>
                    <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'var(--color-ink)' }}>
                        {isVega ? <>Case Management &<br />Legal Intelligence</> : <>Property Management &<br />Revenue Operations</>}
                    </h2>
                    <p className="text-lg max-w-2xl mx-auto leading-relaxed text-slate-600">
                        {isVega
                            ? 'From intake to resolution, Vega covers every stage of your legal practice — drafting, research, billing, and client collaboration.'
                            : 'From rent collection to defaulter management, Atrium covers every aspect of your property portfolio — residents, maintenance, and financials.'}
                    </p>
                    {/* Hint for interactivity */}
                    <p className="text-xs mt-4 text-slate-400 font-medium tracking-wide">
                        <span className="hidden md:inline">Hover a category to expand all cards</span>
                        <span className="md:hidden">Tap a card to learn more</span>
                    </p>
                </div>

                {/* Feature Categories — each row is independent */}
                <div ref={sectionsRef} className="scroll-reveal scroll-reveal-stagger">
                    {categories.map((cat, catIndex) => {
                        const isRowExpanded = expandedRow === catIndex;
                        return (
                            <div
                                key={cat.category}
                                className="mb-14 last:mb-0"
                                onMouseEnter={() => setExpandedRow(catIndex)}
                                onMouseLeave={() => setExpandedRow(null)}
                            >
                                <div className="flex items-center gap-3 mb-8">
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${accentColorValue}15`, color: accentColorValue }}
                                    >
                                        <cat.Icon className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>{cat.category}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                    {cat.items.map((item) => {
                                        const cardKey = `${cat.category}-${item.title}`;
                                        const isCardTapped = tappedCard === cardKey;
                                        const showExpanded = isRowExpanded || isCardTapped;
                                        return (
                                            <div
                                                key={item.title}
                                                className={`landing-card feature-card cursor-pointer ${showExpanded ? 'is-expanded' : ''}`}
                                                style={{
                                                    '--feature-accent': accentColorValue,
                                                    '--feature-accent-shadow': accentShadow,
                                                    '--border-card-hover': `${accentColorValue}66`,
                                                } as React.CSSProperties}
                                                onClick={() => setTappedCard(isCardTapped ? null : cardKey)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setTappedCard(isCardTapped ? null : cardKey);
                                                    }
                                                }}
                                            >
                                                {/* Accent bar — slides in on hover/expand */}
                                                <div className="feature-card__accent" aria-hidden="true" />
                                                <h4 className="font-display text-base font-bold text-slate-900 pr-4">
                                                    {item.title}
                                                    {item.badge && (
                                                        <span
                                                            className="ml-2 text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                                                            style={{
                                                                backgroundColor: `${accentColorValue}15`,
                                                                color: accentColorValue,
                                                                borderColor: `${accentColorValue}30`,
                                                            }}
                                                        >
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </h4>
                                                {/* Description — hidden by default, expands on row hover/tap */}
                                                <div className="feature-card__desc">
                                                    <p className="text-sm leading-relaxed text-slate-600">
                                                        {item.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

// ─── PRICING ──────────────────────────────────────────────────────────────

const TIER_DESCRIPTIONS: Record<ProductMode, Record<TierId, string>> = {
    legal: {
        Core: 'For Solo Practitioners & Boutiques',
        Growth: 'For Expanding Firms & Partnerships',
        Pro: 'For Enterprise Operations',
        Enterprise: '',
    },
    property: {
        Core: 'For Individual Landlords & Micro-Agents',
        Growth: 'For Professional Estate Managers',
        Pro: 'For Large-Scale Estate Portfolios',
        Enterprise: '',
    },
    atrium: {
        Core: 'For Individual Landlords & Micro-Agents',
        Growth: 'For Professional Estate Managers',
        Pro: 'For Large-Scale Estate Portfolios',
        Enterprise: '',
    },
    vega: {
        Core: 'For Solo Practitioners & Boutiques',
        Growth: 'For Expanding Firms & Partnerships',
        Pro: 'For Enterprise Operations',
        Enterprise: '',
    },
    unified: {
        Core: 'Legal + property essentials in one workspace.',
        Growth: 'Growing firms managing matters and portfolios.',
        Pro: 'Full Komplete suite for integrated practices.',
        Enterprise: '',
    },
};

const TIER_CTAS: Record<TierId, string> = {
    Core: 'Get Started',
    Growth: 'Start Growth',
    Pro: 'Start Pro Trial',
    Enterprise: 'Contact Sales',
};

// ─── SCE CALCULATOR MODAL (Atrium only) ─────────────────────────────────────
// Interactive slider-based calculator that lets property managers:
//   1. Drag a slider to set their unit count (1-500)
//   2. Toggle between monthly and annual billing
//   3. See live-updating per-tenant SCE for each tier
//   4. Visualise "absorbability" — whether residents will notice the cost
//      on their service charge invoice (based on Lagos SC benchmarks)
//
// DESIGN DECISION: "Average rent per unit" input REMOVED.
// The previous version asked for average rent and showed "SCE as % of rent".
// However, average rent does NOT change the SCE calculation at all — SCE is
// simply (annual subscription ÷ 12 ÷ units). The percentage was purely
// informational and confused users ("does this change anything?"). The
// absorbability benchmark (₦2,000-5,000/mo based on typical Lagos service
// charges) is a more useful comparison point and doesn't require the user
// to guess their average rent. If we ever need the percentage back, it's
// trivial to re-add — but the slider UX is cleaner without it.

const SceCalculatorModal: React.FC<{
    tiers: Record<Exclude<TierId, 'Enterprise'>, TierDef>;
    onClose: () => void;
    onSignup: (productOverride?: ProductMode) => void;
}> = ({ tiers, onClose, onSignup }) => {
    // ── State ────────────────────────────────────────────────────────────
    // Unit count drives the entire calculation. Default to 50 (a typical
    // small-to-medium Lagos portfolio). Slider range: 1-500, with smart
    // step scaling (1-unit steps for small portfolios, 5-unit steps for
    // larger ones) so the slider feels precise at low values and fast at
    // high values.
    const [unitCount, setUnitCount] = useState<number>(50);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

    const units = Math.max(1, unitCount);

    // ── Calculations ────────────────────────────────────────────────────
    // For each tier, compute:
    //   - SCE per tenant per month = (price ÷ 12 ÷ units) for annual,
    //     or (monthlyPrice ÷ units) for monthly billing
    //   - Total cost (monthly or annual, matching the toggle)
    //   - Absorbability: based on Lagos SC benchmark
    //     · Easy:   SCE < ₦2,000/mo — residents barely notice
    //     · Moderate: SCE ₦2,000-5,000/mo — noticeable but reasonable
    //     · Tight:  SCE > ₦5,000/mo — consider a higher tier
    //   - Whether this tier is the "best fit" for the user's unit count
    //     (i.e., units falls within the tier's included range)
    const calculations = (['Core', 'Growth', 'Pro'] as const).map(id => {
        const tier = tiers[id];
        const annualPrice = tier.annualPrice || 0;
        const monthlyPrice = tier.monthlyPrice || 0;

        // SCE calculation depends on billing cycle
        const scePerTenantMonthly = billingCycle === 'annual'
            ? (units > 0 ? Math.round(annualPrice / 12 / units) : 0)
            : (units > 0 ? Math.round(monthlyPrice / units) : 0);

        const totalAnnual = annualPrice;
        const totalMonthly = monthlyPrice;

        // Absorbability — based on Lagos SC benchmark
        let absorbability: 'easy' | 'moderate' | 'tight' = 'easy';
        if (scePerTenantMonthly > 5000) absorbability = 'tight';
        else if (scePerTenantMonthly > 2000) absorbability = 'moderate';

        // Absorbability percentage for the visual bar (0-100%)
        // Map SCE to a 0-100 scale where:
        //   0 = ₦0/mo (0%)
        //   ₦2,000/mo = 33% (end of "easy")
        //   ₦5,000/mo = 67% (end of "moderate")
        //   ₦10,000/mo = 100% (very tight)
        const absorbabilityPct = Math.min(100, Math.round((scePerTenantMonthly / 10000) * 100));

        // Best fit: units falls within the tier's included range
        // (tierMaxUnits is the included cap; beyond that, overage applies)
        const tierMaxUnits = tier.maxUnits;
        const isBestFit = tierMaxUnits !== null && units <= tierMaxUnits;
        const exceedsCapacity = tierMaxUnits !== null && units > tierMaxUnits;

        // Overage calculation (if units exceed the tier's included cap)
        let overageUnits = 0;
        let overageCost = 0;
        if (tier.overageRate && tier.overageStartUnit && units >= tier.overageStartUnit) {
            overageUnits = units - (tier.overageStartUnit - 1);
            overageCost = overageUnits * tier.overageRate;
        }

        return {
            id,
            tierName: tier.label,
            tierMaxUnits,
            scePerTenantMonthly,
            totalAnnual,
            totalMonthly,
            overageCost,
            overageUnits,
            absorbability,
            absorbabilityPct,
            isBestFit,
            exceedsCapacity,
        };
    });

    const fmtNaira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

    // ── Render ──────────────────────────────────────────────────────────
    // Use createPortal to render at document.body level — escapes any
    // transformed parent (like <main className="animate-swap-in"> which
    // applies a CSS transform that creates a containing block, trapping
    // position:fixed elements and causing the "empty glass slate" bug).
    return createPortal(
        <div
            className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sce-calc-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto flex flex-col">
                {/* Brand accent bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-2xl sm:rounded-t-2xl" />

                {/* Header */}
                <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-slate-100">
                    <div>
                        <h2 id="sce-calc-title" className="font-display text-lg font-bold text-slate-900">SCE Calculator</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Drag the slider to see your per-resident cost</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                        aria-label="Close calculator"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="px-4 sm:px-6 py-5 space-y-5">
                    {/* Explanation — shorter and clearer than before */}
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                        <p className="text-xs text-emerald-900 leading-relaxed">
                            <strong>Service Charge Equivalent (SCE)</strong> is your Atrium subscription divided across your residents — shown as a per-resident monthly amount. You can add this line to your service charge invoices to recover the cost. It is <strong>not</strong> an extra fee from Atrium.
                        </p>
                    </div>

                    {/* ── Primary slider: Units under management ─────────────── */}
                    <div className="space-y-3">
                        <div className="flex items-baseline justify-between">
                            <label htmlFor="sce-units-slider" className="text-sm font-semibold text-slate-700">
                                Units under management
                            </label>
                            <div className="flex items-baseline gap-1">
                                <span className="font-display text-2xl font-extrabold text-emerald-600 nums-tabular transition-all duration-150">
                                    {units.toLocaleString('en-NG')}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">units</span>
                            </div>
                        </div>

                        {/* Custom-styled range slider */}
                        <div className="relative pt-1">
                            <input
                                id="sce-units-slider"
                                type="range"
                                min="1"
                                max="500"
                                step="1"
                                value={units}
                                onChange={e => {
                                    const val = parseInt(e.target.value);
                                    // Snap to the smart step (1, 5, or 10) so the
                                    // slider feels precise at low values and fast
                                    // at high values. Without snapping, dragging
                                    // from 25 to 100 would go 1-by-1.
                                    const step = val <= 25 ? 1 : val <= 100 ? 5 : 10;
                                    const snapped = Math.round(val / step) * step;
                                    setUnitCount(Math.max(1, Math.min(500, snapped)));
                                }}
                                className="sce-slider w-full"
                                aria-valuemin={1}
                                aria-valuemax={500}
                                aria-valuenow={units}
                                style={{ '--sce-fill-pct': `${((units - 1) / 499) * 100}%` } as React.CSSProperties}
                            />
                            {/* Tick marks for context */}
                            <div className="flex justify-between mt-2 text-3xs text-slate-400 font-medium">
                                <span>1</span>
                                <span>50</span>
                                <span>100</span>
                                <span>250</span>
                                <span>500+</span>
                            </div>
                        </div>

                        {/* Quick-set buttons for common portfolio sizes */}
                        <div className="flex flex-wrap gap-2">
                            {[10, 25, 50, 100, 250].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setUnitCount(n)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all touch-target ${
                                        units === n
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Billing cycle toggle ──────────────────────────────── */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div>
                            <p className="text-sm font-semibold text-slate-700">Billing cycle</p>
                            <p className="text-xs text-slate-500">
                                {billingCycle === 'annual' ? 'Save 20% with annual billing' : 'Flexibility of monthly billing'}
                            </p>
                        </div>
                        <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                            <button
                                onClick={() => setBillingCycle('monthly')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    billingCycle === 'monthly'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setBillingCycle('annual')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    billingCycle === 'annual'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Annual
                            </button>
                        </div>
                    </div>

                    {/* ── Tier cards (live-updating) ────────────────────────── */}
                    {/* Three cards in a responsive grid. Each card shows the
                        tier name, the big SCE number, total cost, and an
                        absorbability bar. The "best fit" card gets a
                        highlighted border and badge. */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {calculations.map(calc => {
                            // Use static class lookups instead of dynamic template
                            // strings (e.g. `text-${color}-600`) — Tailwind purges
                            // classes it can't see at build time, so dynamic
                            // strings would silently break the styling.
                            const absorbabilityStyles = {
                                easy: {
                                    text: 'text-emerald-600',
                                    bg: 'bg-emerald-500',
                                    label: 'Easy',
                                },
                                moderate: {
                                    text: 'text-amber-600',
                                    bg: 'bg-amber-500',
                                    label: 'Moderate',
                                },
                                tight: {
                                    text: 'text-red-600',
                                    bg: 'bg-red-500',
                                    label: 'Tight',
                                },
                            }[calc.absorbability];

                            return (
                                <div
                                    key={calc.id}
                                    className={`relative rounded-xl border-2 p-4 transition-all duration-300 ${
                                        calc.isBestFit
                                            ? 'border-emerald-500 bg-emerald-50/30 shadow-lg scale-[1.02]'
                                            : calc.exceedsCapacity
                                            ? 'border-slate-200 bg-slate-50/50 opacity-75'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                >
                                    {/* Best fit badge */}
                                    {calc.isBestFit && (
                                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-600 text-white text-3xs font-black uppercase tracking-wider rounded-full shadow-sm whitespace-nowrap">
                                            Best fit
                                        </div>
                                    )}

                                    {/* Tier name + capacity */}
                                    <div className="mb-3">
                                        <h3 className="font-display font-bold text-slate-900 text-sm">{calc.tierName}</h3>
                                        <p className="text-3xs text-slate-500 font-medium">
                                            {calc.tierMaxUnits ? `Up to ${calc.tierMaxUnits} units` : 'Unlimited units'}
                                            {calc.exceedsCapacity && (
                                                <span className="text-amber-600 font-bold ml-1">· Over capacity</span>
                                            )}
                                        </p>
                                    </div>

                                    {/* Big SCE number — the headline */}
                                    <div className="mb-3">
                                        <p className="text-3xs text-slate-400 uppercase tracking-wider font-bold mb-0.5">SCE per resident / mo</p>
                                        <p className={`font-display text-2xl font-extrabold nums-tabular transition-all duration-150 ${absorbabilityStyles.text}`}>
                                            {fmtNaira(calc.scePerTenantMonthly)}
                                        </p>
                                    </div>

                                    {/* Total cost */}
                                    <div className="mb-3">
                                        <p className="text-3xs text-slate-400 uppercase tracking-wider font-bold mb-0.5">
                                            {billingCycle === 'annual' ? 'Annual total' : 'Monthly total'}
                                        </p>
                                        <p className="text-sm font-bold text-slate-900 nums-tabular">
                                            {billingCycle === 'annual'
                                                ? fmtNaira(calc.totalAnnual)
                                                : fmtNaira(calc.totalMonthly)
                                            }
                                        </p>
                                        {/* Overage warning */}
                                        {calc.overageUnits > 0 && (
                                            <p className="text-3xs text-amber-600 font-semibold mt-0.5">
                                                + {fmtNaira(calc.overageCost)}/mo for {calc.overageUnits} extra units
                                            </p>
                                        )}
                                    </div>

                                    {/* Absorbability bar — visual indicator */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-3xs text-slate-400 uppercase tracking-wider font-bold">Absorbability</span>
                                            <span className={`text-3xs font-bold uppercase tracking-wider ${absorbabilityStyles.text}`}>
                                                {absorbabilityStyles.label}
                                            </span>
                                        </div>
                                        {/* Track with three colored zones */}
                                        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                                            {/* Zone backgrounds (green 0-33%, amber 33-67%, red 67-100%) */}
                                            <div className="absolute inset-0 flex">
                                                <div className="w-1/3 bg-emerald-100" />
                                                <div className="w-1/3 bg-amber-100" />
                                                <div className="w-1/3 bg-red-100" />
                                            </div>
                                            {/* Fill bar — animated width transition */}
                                            <div
                                                className={`relative h-full ${absorbabilityStyles.bg} transition-all duration-300 ease-out`}
                                                style={{ width: `${calc.absorbabilityPct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── How to use this number ────────────────────────────── */}
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="text-xs font-bold text-slate-700 mb-2">How to use this number</p>
                        <ol className="space-y-1.5 text-xs text-slate-600 leading-relaxed list-decimal list-inside">
                            <li>Pick the tier whose SCE feels comfortable for your residents.</li>
                            <li>Add the SCE as a line item on your monthly service charge invoice.</li>
                            <li>Your residents pay it as part of their normal service charge — no separate collection needed.</li>
                            <li>The subscription cost is recovered; the platform effectively pays for itself.</li>
                        </ol>
                    </div>

                    {/* ── Absorbability legend ──────────────────────────────── */}
                    <div className="space-y-1.5 text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">What the colors mean:</p>
                        <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 align-middle"></span> <strong>Easy</strong> — under ₦2,000/mo. Residents barely notice it on their service charge invoice.</p>
                        <p><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle"></span> <strong>Moderate</strong> — ₦2,000-5,000/mo. Noticeable but reasonable vs typical Nigerian service charges.</p>
                        <p><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 align-middle"></span> <strong>Tight</strong> — over ₦5,000/mo. Consider a higher tier with more units to spread the cost.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-4 pb-safe border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                        {units.toLocaleString('en-NG')} units · {billingCycle === 'annual' ? 'Annual billing' : 'Monthly billing'}
                    </p>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => { onClose(); onSignup('atrium'); }}
                            className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm transition-all"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const PricingSection: React.FC<{ onSignup: (productOverride?: ProductMode) => void; onContactSales: (source: string) => void; activeProduct: 'vega' | 'atrium'; setActiveProduct: (p: 'vega' | 'atrium') => void; setProductChosen: (v: boolean) => void }> = ({ onSignup, onContactSales, activeProduct, setActiveProduct, setProductChosen }) => {
    // FIX: Use activeProduct instead of useProduct() — same as FeaturesSection
    const isAtrium = activeProduct === 'atrium';
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const isVega = activeProduct === 'vega';
    // SCE Calculator modal state (Atrium only)
    const [showSceCalculator, setShowSceCalculator] = useState(false);
    // Tooltip hover state for the "SCE shown per unit" pill (desktop only).
    // The Calculate button itself is now always visible — no hover gating.
    const [isHoveringArea, setIsHoveringArea] = useState(false);
    const productMode: ProductMode = isVega ? 'legal' : 'property';
    const tiers = getDisplayTiersForProduct(productMode);
    // PRICING AUDIT: Atrium now supports monthly billing too (was annual-only)
    const cycle = billingCycle; // Both Vega and Atrium use the toggle

    // Scroll reveal
    const headerRef = useScrollReveal<HTMLDivElement>();
    const gridRef = useScrollReveal<HTMLDivElement>();
    const ctaRef = useScrollReveal<HTMLDivElement>();

    const dynamicPlans = DISPLAY_TIER_IDS.map((id: TierId) => {
        const tier = tiers[id as keyof typeof tiers];
        const { price, per } = formatTierPrice(tier, cycle);
        const tenantContribution =
            !isVega && tier.scePer || '';
        const description = TIER_DESCRIPTIONS[productMode][id];
        const features = tier.features.map((text) => ({
            text,
            note: (id === 'Core' && (text.includes('ARIA') || text.includes('ALOA'))) ? 'Growth+' : undefined,
        }));
        return {
            id,
            name: tier.label,
            price,
            per,
            tenantContribution,
            features,
            description,
            highlighted: tier.recommended,
            cta: TIER_CTAS[id],
        };
    });

    return (
    <section id="pricing" className="min-h-[100dvh] pt-16 pb-16 px-4 sm:px-6" style={{ background: 'var(--color-paper)' }}>
        <div className="container mx-auto max-w-7xl">
            {/* Header */}
            <div ref={headerRef} className="scroll-reveal text-center mb-10 md:mb-16">
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'var(--color-ink)' }}>
                    {isVega ? 'Transparent Pricing. Professional Grade.' : 'Institutional Property Management. Simplified.'}
                </h2>
                <p className="text-slate-500 max-w-lg mx-auto text-lg leading-relaxed mb-6">
                    {isVega ? 'Equip your firm with the tools to manage complex cases and scale efficiently.' : 'Frame your technology cost as a service benefit to your residents.'}
                </p>

                {/* Billing Toggle — PRICING AUDIT: now available for both Vega AND Atrium */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
                    <button
                        onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                        className="relative w-16 h-9 bg-slate-200 rounded-full transition-colors"
                        aria-label="Toggle billing cycle"
                    >
                        <div className={`absolute top-1 left-1 w-7 h-7 bg-white rounded-full shadow-md transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-7' : ''}`} />
                    </button>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${billingCycle === 'annual' ? 'text-slate-900' : 'text-slate-400'}`}>Annual</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-2xs font-black uppercase rounded-full border border-emerald-200">
                            Save 20%
                        </span>
                    </div>
                </div>

                {/* 30-day money-back guarantee badge (PRICING AUDIT) */}
                <div className="flex justify-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        <span className="text-sm font-semibold text-emerald-700">30-day money-back guarantee on annual plans</span>
                    </div>
                </div>

                {!isVega && (
                    <div
                        className="flex flex-col sm:flex-row justify-center items-center mt-4 gap-3 relative"
                    >
                        {/* SCE explanation tooltip — shows when hovering the pill (desktop only; on touch devices the info is in the calculator itself) */}
                        <div
                            className="group relative"
                            onMouseEnter={() => setIsHoveringArea(true)}
                            onMouseLeave={() => setIsHoveringArea(false)}
                        >
                            {/* Pill — always visible. PRICING AUDIT: removed "Billed Annually" (Atrium now has monthly too) */}
                            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold border border-blue-200 whitespace-nowrap cursor-help">
                                SCE shown per unit<span className="text-blue-500 font-bold">*</span>
                            </span>
                            {/* Tooltip */}
                            <div
                                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 max-w-[90vw] rounded-lg bg-slate-900 px-4 py-3 text-xs leading-relaxed text-white shadow-2xl transition-all duration-300 pointer-events-none ${
                                    isHoveringArea ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                                }`}
                            >
                                <strong className="block mb-1">What is SCE?</strong>
                                Service Charge Equivalent is your annual Atrium subscription divided across your resident base — shown as a per-resident monthly amount. You can itemize this on service charge invoices to offset the cost. It is not an additional fee charged by Atrium.
                                {/* Arrow */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
                            </div>
                        </div>

                        {/* Calculate button — ALWAYS visible, full-width on mobile
                            so it's impossible to miss. Previously gated behind a
                            hover requirement that made it invisible on touch devices. */}
                        <button
                            onClick={() => setShowSceCalculator(true)}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 rounded-full bg-emerald-600 text-white text-sm font-bold border border-emerald-700 hover:bg-emerald-700 active:scale-95 transition-all duration-200 whitespace-nowrap shadow-md hover:shadow-lg touch-target"
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            <span>Calculate your SCE</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Grid */}
            <div
                ref={gridRef}
                className="scroll-reveal scroll-reveal-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8 items-stretch pb-12 max-w-5xl mx-auto"
            >
                {dynamicPlans.map((plan) => (
                    <div
                        key={plan.id}
                        className={`pricing-card group rounded-3xl sm:rounded-[40px] border p-5 sm:p-8 md:p-10 flex flex-col relative ${plan.highlighted
                            ? 'bg-slate-900 border-transparent shadow-2xl shadow-slate-900/30 lg:-translate-y-4'
                            : 'bg-white border-slate-200 shadow-lg shadow-slate-900/5 hover:shadow-2xl hover:border-primary-300'
                            }`}
                    >
                        {plan.highlighted && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-2xs font-black uppercase tracking-wide-label rounded-full shadow-xl z-20 whitespace-nowrap">
                                Most Popular
                            </div>
                        )}

                        <h3 className={`font-display text-xl font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                        <p className={`text-sm mb-6 ${plan.highlighted ? 'text-slate-300' : 'text-slate-500'}`}>{plan.description}</p>

                        {/* Price */}
                        <div className="flex items-baseline gap-1 mb-2">
                            <span className={`font-display nums-tabular text-4xl font-extrabold tracking-tight ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                            <span className={`text-sm ${plan.highlighted ? 'text-slate-300' : 'text-slate-500'}`}>{plan.per}</span>
                        </div>

                        {/* For Atrium: show SCE per tenant as a clean inline line (no tooltip, no box) */}
                        {!isVega && plan.tenantContribution && (
                            <p className={`text-xs mb-2 ${plan.highlighted ? 'text-slate-300' : 'text-slate-500'}`}>
                                <span className="font-semibold">~{plan.tenantContribution}</span> per resident/mo (SCE)
                            </p>
                        )}

                        {/* Spacer to keep card heights consistent */}
                        <div className="mb-8" />

                        {/* Features */}
                        <ul className="space-y-3.5 mb-8 flex-1">
                            {plan.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <CheckIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                    <span className={`text-sm leading-snug ${plan.highlighted ? 'text-slate-200' : 'text-slate-700'}`}>
                                        {f.text}
                                        {f.note && (
                                            <span className="ml-2 text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">
                                                {f.note}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        {/* CTA */}
                        <button
                            onClick={plan.id === 'Enterprise' ? () => onContactSales('Enterprise Pricing CTA') : () => onSignup()}
                            className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg ${
                                plan.highlighted
                                ? 'bg-gradient-to-r from-blue-500 to-emerald-500 text-white hover:opacity-90'
                                : 'bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-200'
                            }`}
                        >
                            {plan.cta}
                        </button>
                    </div>
                ))}
            </div>

            {/* ── Dual CTA Banner: Real Estate Lawyer Hook + Custom Automation Pipeline ── */}
            <div ref={ctaRef} className="scroll-reveal max-w-5xl mx-auto mt-10 mb-12 space-y-5">
                {/* A. Real Estate Lawyer Hook — Komplete Tier (Vega/unified only) */}
                {!isAtrium && (
                <div className="relative overflow-hidden p-8 md:p-10 rounded-3xl bg-gradient-to-br from-primary-500/10 via-emerald-500/5 to-indigo-500/10 border border-primary-500/20">
                    <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl bg-primary-400/10 pointer-events-none" />
                    <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-3xl bg-emerald-400/8 pointer-events-none" />
                    <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex-1">
                            <h4 className="font-display text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">
                                Are you a Real Estate Lawyer?
                            </h4>
                            <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                                Discover <strong className="text-primary-600">Komplete</strong> — our specialized, unified workspace designed exclusively for real estate attorneys to coordinate high-stakes property legal operations, manage tenancy portfolios, and track chamber matters from a single secure terminal.
                            </p>
                        </div>
                        <button
                            onClick={() => onSignup('unified')}
                            className="whitespace-nowrap px-7 py-3.5 rounded-2xl bg-gradient-to-r from-primary-500 to-emerald-600 hover:from-primary-600 hover:to-emerald-700 text-white text-sm font-bold shadow-lg shadow-primary-500/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <SparklesIcon className="w-4 h-4" />
                            Explore Komplete
                        </button>
                    </div>
                </div>
                )}

                {/* B. Custom Automation Pipeline — PracticePro Bespoke Systems */}
                <div className="relative overflow-hidden p-8 md:p-10 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/40">
                    <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full blur-3xl bg-violet-500/10 pointer-events-none" />
                    <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full blur-3xl bg-blue-500/8 pointer-events-none" />
                    <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex-1">
                            <h4 className="text-2xl font-extrabold text-white mb-2 tracking-tight">
                                Need Custom Automations or Tailored Management Tools?
                            </h4>
                            <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                                PracticePro develops bespoke operational systems, specialized CRMs, and custom workflow automations tailored to your organization's precise processes. Talk to us about building high-performance management tools engineered around your specific business architecture.
                            </p>
                        </div>
                        <button
                            onClick={() => onContactSales('Custom Automation Pipeline')}
                            className="whitespace-nowrap px-7 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 text-sm font-bold shadow-lg shadow-white/10 transition-all active:scale-95 flex items-center gap-2"
                        >
                            Contact Sales
                        </button>
                    </div>
                </div>
            </div>

            {/* Footnote */}
            <p className="text-center text-slate-400 text-xs mt-10">
                Start for free. Upgrade when you need to scale. Framework compliant with NDPA 2023.
            </p>
        </div>

        {/* SCE Calculator Modal (Atrium only) */}
        {showSceCalculator && (
            <SceCalculatorModal
                tiers={tiers}
                onClose={() => setShowSceCalculator(false)}
                onSignup={onSignup}
            />
        )}
    </section>
    );
};

// (ResourcesSection removed — Resources is now a dedicated page)

// ─── AI CAPABILITIES SECTION (dark) ──────────────────────────────────────
// ─── AI CAPABILITIES SECTION (dark, product-specific) ────────────────────
const AI_CAPABILITIES = {
    vega: {
        assistantName: 'ALOA',
        assistantFull: 'Advanced Legal Office Assistant',
        headline: 'Powered by ALOA. Built for Nigerian law.',
        subtitle: 'Your AI legal copilot drafts documents, researches precedents, and analyzes cases — with privacy-first architecture that keeps client data safe.',
        capabilities: [
            {
                title: 'Legal Drafting & Analysis',
                body: 'Draft writs, affidavits, and motions with Nigerian court-specific formatting. Analyze opposing counsel\'s arguments, identify weaknesses, and research locus classicus across jurisdictions.',
                features: ['DraftPro editor with A4 pagination', 'Nigerian citation formats (NWLR, NSC)', 'Cross-jurisdictional analysis with caveats'],
            },
            {
                title: 'PII Shield',
                body: 'Client names, phone numbers, NIN, BVN, and bank accounts are automatically stripped before AI processing. Your client data never trains external models. NDPA 2023 compliant.',
                features: ['Email & phone stripping', 'NIN/BVN/credit card detection', 'Nigerian bank account masking'],
            },
            {
                title: 'Firm-Grade Security',
                body: 'Your firm\'s data is fully isolated from every other organization on the platform. AI queries only access your matters, your documents, and your clients. No cross-organization data leakage — ever.',
                features: ['Complete data isolation between organizations', 'Matter-level access control', 'Full audit trail on all AI activity'],
            },
        ],
    },
    atrium: {
        assistantName: 'ARIA',
        assistantFull: 'Asset & Revenue Intelligence Assistant',
        headline: 'Powered by ARIA. Built for Nigerian property.',
        subtitle: 'Your AI property copilot monitors revenue, drafts demand notices, and analyzes your portfolio — with privacy-first architecture that keeps resident data safe.',
        capabilities: [
            {
                title: 'Revenue Intelligence & Drafting',
                body: 'Monitor rent collection, identify defaulters, and draft demand notices, quit notices, and tenancy agreements. Analyze portfolio performance and predict revenue at risk. ARIA is trained on the property and tenancy laws of all 36 Nigerian states and the FCT*, and applies the law of the state where each property is located.',
                features: ['Revenue Monitor with defaulter tracking', 'All 36 state property & tenancy laws + FCT*', 'Automated demand notice generation'],
            },
            {
                title: 'PII Shield',
                body: 'Resident names, phone numbers, NIN, BVN, and bank accounts are automatically stripped before AI processing. Your resident data never trains external models. NDPA 2023 compliant.',
                features: ['Email & phone stripping', 'NIN/BVN/credit card detection', 'Nigerian bank account masking'],
            },
            {
                title: 'Portfolio-Grade Security',
                body: 'Your portfolio data is fully isolated from every other organization on the platform. AI queries only access your properties, your residents, and your financials. No cross-organization data leakage — ever.',
                features: ['Complete data isolation between organizations', 'Property-level access control', 'Full audit trail on all AI activity'],
            },
        ],
    },
};

const AICapabilitiesSection: React.FC<{ activeProduct: 'vega' | 'atrium' }> = ({ activeProduct }) => {
    const config = AI_CAPABILITIES[activeProduct];
    const accentColor = activeProduct === 'vega' ? 'text-amber-400' : 'text-emerald-400';
    const accentBg = activeProduct === 'vega' ? 'bg-amber-500/20' : 'bg-emerald-500/20';
    const accentBorder = activeProduct === 'vega' ? 'hover:border-amber-500/50' : 'hover:border-emerald-500/50';
    return (
        <section className="py-20 md:py-28 bg-slate-900 text-white">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12 md:mb-16">
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 ${accentBg} rounded-full mb-4`}>
                        <svg className={`w-4 h-4 ${accentColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span className={`text-sm font-bold ${accentColor}`}>{config.assistantName} — {config.assistantFull}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                        {config.headline}
                    </h2>
                    <p className="text-lg text-slate-300 mt-4 max-w-2xl mx-auto">
                        {config.subtitle}
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
                    {config.capabilities.map((cap, i) => (
                        <div key={i} className={`bg-slate-800/50 border border-slate-700 rounded-2xl p-8 ${accentBorder} transition-colors`}>
                            <div className={`w-12 h-12 rounded-xl ${accentBg} flex items-center justify-center mb-5`}>
                                <svg className={`w-6 h-6 ${accentColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {i === 0 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />}
                                    {i === 1 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />}
                                    {i === 2 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />}
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3">{cap.title}</h3>
                            <p className="text-slate-300 text-sm leading-relaxed mb-4">
                                {cap.body}
                            </p>
                            <ul className="space-y-2">
                                {cap.features.map((f, j) => (
                                    <li key={j} className="flex items-start gap-2 text-sm text-slate-400">
                                        <svg className={`w-4 h-4 ${accentColor} flex-shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                {/* Legal-advice disclaimer — only shown for Atrium, where ARIA
                    drafts property/tenancy documents using state-specific law.
                    Vega doesn't need this because ALOA's legal drafting is
                    explicitly for legal practitioners (the user IS the lawyer). */}
                {activeProduct === 'atrium' && (
                    <p className="text-xs text-slate-500 mt-8 max-w-3xl mx-auto text-center leading-relaxed">
                        * ARIA is trained on the property and tenancy laws of all 36 Nigerian states and the Federal Capital Territory (FCT), and applies the law of the state where each property is located. ARIA does not provide legal advice. Drafts generated by ARIA are tools to assist your property management workflow and do not constitute legal opinions. For legal advice on recovery of premises, tenancy disputes, or other legal matters, consult a qualified legal practitioner.
                    </p>
                )}
            </div>
        </section>
    );
};

// ─── HOW IT WORKS SECTION (3 steps, product-specific) ────────────────────
const HOW_IT_WORKS_STEPS = {
    vega: [
        {
            num: '1',
            title: 'Create your firm workspace',
            body: 'Sign up in 2 minutes. No credit card required for trial. Choose Vega and invite your team.',
        },
        {
            num: '2',
            title: 'Add your matters',
            body: 'Use the Matter Ingestion Wizard to bulk-import case files from a folder, or create matters one at a time. Link clients, documents, and court dates.',
        },
        {
            num: '3',
            title: 'Start practicing',
            body: 'Draft your first legal document with DraftPro, send a court date reminder via WhatsApp, or run an AI case analysis.',
        },
    ],
    atrium: [
        {
            num: '1',
            title: 'Create your property workspace',
            body: 'Sign up in 2 minutes. No credit card required for trial. Choose Atrium and set up your portfolio.',
        },
        {
            num: '2',
            title: 'Add your properties & residents',
            body: 'Create properties, add units, and assign residents. Set rent amounts and service charges. Optionally request our Managed Data Migration service to digitize your records for you.',
        },
        {
            num: '3',
            title: 'Start collecting',
            body: 'Send your first WhatsApp collection reminder, collect a payment via bank transfer with proof upload, or generate a visitor pass with Sentry Pass.',
        },
    ],
};

const HowItWorksSection: React.FC<{ activeProduct: 'vega' | 'atrium' }> = ({ activeProduct }) => {
    const steps = HOW_IT_WORKS_STEPS[activeProduct];
    const accentColor = activeProduct === 'vega' ? 'text-amber-500' : 'text-emerald-500';
    const accentBg = activeProduct === 'vega' ? 'bg-amber-50' : 'bg-emerald-50';
    const accentBorder = activeProduct === 'vega' ? 'border-amber-200' : 'border-emerald-200';
    return (
        <section id="howItWorks" className="py-20 md:py-28 bg-white">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12 md:mb-16">
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                        Get started in 3 steps
                    </h2>
                    <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto">
                        {activeProduct === 'vega'
                            ? 'From sign-up to your first legal draft — in minutes, not weeks.'
                            : 'From sign-up to your first collection — in minutes, not weeks.'}
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 max-w-5xl mx-auto">
                    {steps.map((step, i) => (
                        <div key={i} className={`text-center relative ${accentBg} ${accentBorder} border rounded-2xl p-8`}>
                            {/* Legible step number — solid accent color, not slate-100 */}
                            <div className={`text-5xl md:text-6xl font-extrabold ${accentColor} mb-4`}>{step.num}</div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                {step.body}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// ─── TESTIMONIALS SECTION ────────────────────────────────────────────────
// Product-specific testimonials. Vega shows lawyer testimonials, Atrium
// shows property manager testimonials. Previously showed a mixed bag of
// 3 testimonials regardless of which product page the user was on.
const TESTIMONIALS: Record<'vega' | 'atrium', Array<{
    quote: string;
    name: string;
    role: string;
    initials: string;
    color: string;
}>> = {
    vega: [
        {
            quote: "DraftPro saves me 4 hours per brief. ALOA's case summaries are scarily accurate — it pulls the holding, the ratio, and the dissent in seconds.",
            name: "Barrister Adebayo Ogundimu",
            role: "Senior Associate, Lagos",
            initials: "AO",
            color: "bg-primary-500",
        },
        {
            quote: "The Court Rules Agent has eliminated deadline misses in our office. It calculates filing deadlines automatically based on the correct state's Civil Procedure Rules.",
            name: "Adaeze Nwosu",
            role: "Managing Partner, Abuja",
            initials: "AN",
            color: "bg-indigo-500",
        },
        {
            quote: "We migrated 200+ matters from Excel in a weekend. The Matter Ingestion Wizard is a game-changer for any firm drowning in paper files.",
            name: "Chidi Okafor",
            role: "Practice Manager, Port Harcourt",
            initials: "CO",
            color: "bg-violet-500",
        },
    ],
    atrium: [
        {
            quote: "PracticePro cut our rent collection cycle from 3 weeks to 8 days. The Revenue Monitor alone is worth the subscription.",
            name: "Tunde Bakare",
            role: "Property Manager, Lagos",
            initials: "TB",
            color: "bg-emerald-500",
        },
        {
            quote: "Our residents love the Residents' Portal. We went from 20 'where is my receipt?' calls per week to zero. Receipts generate automatically now.",
            name: "Funmi Adewale",
            role: "Estate Surveyor, Lekki",
            initials: "FA",
            color: "bg-amber-500",
        },
        {
            quote: "ARIA flags defaulters before they become a problem. The morning briefing tells me exactly which units need attention before I even open my laptop.",
            name: "Emeka Obi",
            role: "Portfolio Manager, Abuja",
            initials: "EO",
            color: "bg-teal-500",
        },
    ],
};

const TestimonialsSection: React.FC<{ activeProduct: 'vega' | 'atrium' }> = ({ activeProduct }) => {
    const testimonials = TESTIMONIALS[activeProduct];
    const isVega = activeProduct === 'vega';
    return (
        <section className="py-12 sm:py-20 lg:py-28 bg-slate-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12 md:mb-16">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                        What Nigerian {isVega ? 'lawyers' : 'property managers'} say
                    </h2>
                    <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto">
                        Real results from {isVega ? 'law firms' : 'property managers and owners'} across Nigeria and abroad.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 max-w-5xl mx-auto">
                    {testimonials.map((t, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm hover:shadow-md transition-shadow">
                            {/* Star rating */}
                            <div className="flex gap-1 mb-4">
                                {[...Array(5)].map((_, s) => (
                                    <svg key={s} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                ))}
                            </div>
                            <p className="text-slate-700 italic text-base leading-relaxed mb-6">
                                "{t.quote}"
                            </p>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-sm font-bold`}>
                                    {t.initials}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                                    <p className="text-xs text-slate-500">{t.role}</p>
                                </div>
                            </div>
                        </div>
                ))}
            </div>
        </div>
    </section>
    );
};

// ─── FAQ SECTION (accordion, product-specific) ───────────────────────────
const FAQ_ITEMS = {
    shared: [
        {
            q: "Is my data secure?",
            a: "Yes. Your data is fully isolated and never shared with other firms. We're NDPA 2023 compliant, offer 2FA, and never train AI on your data. All data is encrypted at rest and in transit.",
        },
        {
            q: "Can I pay in Naira?",
            a: "Absolutely. Pay via bank transfer with proof upload, or use Paystack for card and USSD payments (currently activating). Manual bank transfer is the live default today.",
        },
        {
            q: "Is there a free trial?",
            a: "Yes. All paid tiers include a 30-day free trial. No credit card required to start. Sentry Pass also includes a 30-day free trial as an add-on.",
        },
        {
            q: "Do you offer support?",
            a: "Yes. Email support for all tiers. WhatsApp support for Growth and above. Dedicated account manager for Enterprise and Komplete.",
        },
        {
            q: "Can I switch between plans?",
            a: "Yes. Upgrade or downgrade anytime. Prorated billing applies. Annual plans include a 30-day money-back guarantee.",
        },
    ],
    vega: [
        {
            q: "How does the legal drafting work?",
            a: "DraftPro is a rich-text editor built specifically for Nigerian legal documents. It handles A4 pagination, Nigerian legal fonts (Times New Roman), court-specific formatting, and placeholder guardrails that prevent printing until every blank is filled. ALOA, your AI copilot, can generate drafts, summarize cases, and research precedents — all within the editor.",
        },
        {
            q: "Can I manage matters for multiple courts and jurisdictions?",
            a: "Yes. Each matter is tagged with its court, judicial division, and matter type. The system supports all Nigerian court tiers (Supreme Court, Court of Appeal, Federal High Court, State High Courts, Magistrate Courts) and can handle matters from any jurisdiction with appropriate caveats.",
        },
        {
            q: "Do court date reminders really work via WhatsApp?",
            a: "Yes. Automated WhatsApp reminders are sent 7, 3, and 1 day before each hearing to assigned lawyers. Client-facing reminders are opt-in per matter. Available on the Pro plan and above.",
        },
        {
            q: "Can my clients access their case information?",
            a: "Yes. The Client Portal lets clients view milestones, upload documents, submit KYC, and track case progress — without calling your office. Available on Growth and above (up to 20 clients), uncapped on Pro.",
        },
    ],
    atrium: [
        {
            q: "How does rent collection work?",
            a: "Residents pay via bank transfer with proof upload, or through Paystack (card, bank, USSD — currently activating). Receipts generate automatically. The Revenue Monitor shows you who has paid, who hasn't, and how much is outstanding — in real time.",
        },
        {
            q: "Can residents use the portal on their phones?",
            a: "Yes. The Resident Portal is mobile-first. Residents can view payment status, download receipts, log maintenance tickets, and generate visitor passes — all from their phone, no app install required.",
        },
        {
            q: "How does Sentry Pass (visitor management) work?",
            a: "Residents generate 6-digit access codes and QR passes for their guests from the portal. Gatekeepers verify codes at a secure web terminal. The system works offline with a 100-visitor cache. Includes a 30-day free trial, then N15,000/month as an add-on.",
        },
        {
            q: "What happens if a resident doesn't pay?",
            a: "The Revenue Monitor tracks defaulters by days overdue and sends automated WhatsApp demand notices. You can calculate outstanding balances with late penalties and draft statutory quit notices using the tenancy law of the state where your property is located — all 36 states and the FCT are supported, backed by the Land Use Act. For property owners managing remotely from abroad, this means full visibility into arrears and recovery without needing a local proxy — ARIA tracks every unit and drafts notices even while you're away.",
        },
        {
            q: "I'm a property owner living abroad. Can I use PracticePro to manage my Nigerian properties?",
            a: "Yes. While PracticePro Atrium is built primarily for professional property managers, diaspora property owners can use it directly to manage their own portfolios. You get real-time visibility into collections, service charges, maintenance tickets, and resident communications via the dashboard and WhatsApp alerts. Your residents use the Residents' Portal for payments and requests. You can also assign a local property manager with granular access controls if you want boots on the ground — or run everything yourself remotely.",
        },
    ],
};

const FAQSection: React.FC<{ activeProduct: 'vega' | 'atrium' }> = ({ activeProduct }) => {
    const [openIndex, setOpenIndex] = React.useState<number | null>(0);
    // Merge shared FAQs with product-specific FAQs
    const allFaqs = [...FAQ_ITEMS.shared, ...FAQ_ITEMS[activeProduct]];
    return (
        <section className="py-20 md:py-28 bg-white">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
                <div className="text-center mb-12 md:mb-16">
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                        Questions? Answered.
                    </h2>
                    <p className="text-lg text-slate-500 mt-4">
                        Everything you need to know about {activeProduct === 'vega' ? 'PracticePro Vega for law firms' : 'PracticePro Atrium for property managers'}.
                    </p>
                </div>
                <div className="space-y-3">
                    {allFaqs.map((item, i) => (
                        <div key={i} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <button
                                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                                aria-expanded={openIndex === i}
                            >
                                <span className="font-semibold text-slate-900 text-sm md:text-base">{item.q}</span>
                                <svg
                                    className={`w-5 h-5 text-slate-400 flex-shrink-0 ml-3 transition-transform ${openIndex === i ? 'rotate-180' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {openIndex === i && (
                                <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">
                                    {item.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// ─── FINAL CTA SECTION ───────────────────────────────────────────────────
// Product-specific headline + body. The green background (bg-primary-600) is
// preserved across both products per user request — only the copy changes.
const FINAL_CTA_COPY = {
    vega: {
        headline: 'Ready to run a sharper practice?',
        body: 'Join Nigerian law firms who have already switched to PracticePro Vega — matter management, AI drafting, and court-rule-aware calendaring built for the way you actually work.',
    },
    atrium: {
        headline: 'Ready to stop managing chaos?',
        body: 'Join Nigerian property managers who have already switched to PracticePro Atrium — rent collection, resident portals, and revenue intelligence built for portfolios that scale.',
    },
};

const FinalCTASection: React.FC<{ onSignup: () => void; onContactSales: () => void; activeProduct: 'vega' | 'atrium' }> = ({ onSignup, onContactSales, activeProduct }) => {
    const copy = FINAL_CTA_COPY[activeProduct];
    return (
        <section className="py-20 md:py-28 bg-primary-600 text-white">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
                    {copy.headline}
                </h2>
                <p className="text-lg text-white/80 mt-4 max-w-2xl mx-auto">
                    {copy.body}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                    <button
                        onClick={onSignup}
                        className="bg-white text-primary-600 px-8 py-4 rounded-xl font-semibold hover:bg-white/90 hover:scale-[1.02] transition-all shadow-lg"
                    >
                        Start Free Trial
                    </button>
                    <button
                        onClick={onContactSales}
                        className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-all"
                    >
                        Talk to Sales
                    </button>
                </div>
                <p className="text-sm text-white/60 mt-6">
                    No credit card · 30-day trial · Cancel anytime
                </p>
            </div>
        </section>
    );
};

// ─── MOBILE STICKY BOTTOM CTA BAR ─────────────────────────────────────────
const MobileStickyCTA: React.FC<{ onSignup: () => void; onContactSales: () => void }> = ({ onSignup, onContactSales }) => (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-[200] bg-white border-t border-slate-200 px-4 py-3 flex gap-2 shadow-lg">
        <button
            onClick={onContactSales}
            className="flex-1 py-3 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
        >
            Talk to Sales
        </button>
        <button
            onClick={onSignup}
            className="flex-[1.5] py-3 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
            Start Free Trial
        </button>
    </div>
);

// ─── WHATSAPP FLOATING ACTION BUTTON ──────────────────────────────────────
// PracticePro doesn't have a registered WhatsApp Business number yet.
// The FAB opens the Contact Sales drawer instead — the actual working
// conversion flow (email-based, responds within 24 hours).
// When a WhatsApp Business number is registered, replace the onClick with:
// href="https://wa.me/234XXXXXXXXXX?text=Hi%20PracticePro..."
// MOBILE FIX: On mobile, the FAB sits above the sticky CTA bar (bottom-20)
// to avoid overlapping the "Start Free Trial" button. On desktop (md+),
// it sits at the standard bottom-6 position since there's no sticky bar.
const WhatsAppFAB: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => (
    <button
        onClick={onContactSales}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[200] w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#25D366] shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        aria-label="Chat with us — Contact Sales"
        title="Chat with us"
    >
        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
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
        return () => {
            // Restore on unmount — needed if user navigates away from landing
            // to the app (which should respect their saved theme)
            html.className = savedClasses;
        };
    }, []);

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
            setProductChosen(false);
        }
    }, [initialProduct]);

    useEffect(() => {
        const handleScroll = () => {
            if (!scrollRef.current) return;
            const sections = ['home', 'features', 'pricing'];
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
    }, []);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el && scrollRef.current) {
            scrollRef.current.scrollTo({ top: el.offsetTop - 64, behavior: 'smooth' });
        }
    };

    const handlePickProduct = (p: 'vega' | 'atrium') => {
        // Navigate in-place to /vega or /atrium (NOT new tab — popup blockers
        // were preventing the new tab from opening, and the user saw nothing
        // happen or got redirected to the wrong product).
        // The URL changes to /vega or /atrium, which App.tsx picks up via
        // urlProduct and passes to LandingPage as initialProduct.
        window.location.href = `/${p}`;
    };

    const handleBackToHub = () => {
        setProductChosen(false);
        scrollRef.current?.scrollTo({ top: 0 });
    };

    const handleProductSwitch = (p: 'vega' | 'atrium') => {
        setActiveProduct(p);
        setProductChosen(true);
        const pricingEl = document.getElementById('pricing');
        if (pricingEl && scrollRef.current) {
            const scrollPos = scrollRef.current.scrollTop + 100;
            if (scrollPos >= pricingEl.offsetTop - 300) {
                setTimeout(() => {
                    scrollRef.current?.scrollTo({ top: pricingEl.offsetTop - 64, behavior: 'smooth' });
                }, 50);
            }
        }
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
    const openSignup = (productOverride?: ProductMode) => {
        // Priority: explicit override > current activeProduct (if chosen) > null
        const product = productOverride || (productChosen ? activeProduct : null);
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
            className="h-[100dvh] w-full overflow-y-auto font-sans scroll-smooth md:[scrollbar-gutter:stable]"
            style={{ background: 'var(--color-paper)', color: 'var(--color-ink)', colorScheme: 'light' }}
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
                setActiveProduct={handleProductSwitch}
                productChosen={productChosen}
                onBackToHub={handleBackToHub}
            />

            {/* Skip to content link for accessibility */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[300] focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
            >
                Skip to content
            </a>

            {!productChosen ? (
                <HubHero
                    onPickProduct={handlePickProduct}
                    onLogin={() => openModal('login')}
                    highlightKey={0}
                />
            ) : (
                <main key={activeProduct} id="main-content" className="animate-swap-in">
                    <HomeSection onSignup={openSignup} activeProduct={activeProduct} setActiveProduct={handleProductSwitch} />
                    <StatsDemarcator activeProduct={activeProduct} />
                    <FeaturesSection activeProduct={activeProduct} />
                    <TrustBadgesStrip />
                    <AICapabilitiesSection activeProduct={activeProduct} />
                    <PricingSection onSignup={openSignup} onContactSales={openContactSales} activeProduct={activeProduct} setActiveProduct={setActiveProduct} setProductChosen={setProductChosen} />
                    <HowItWorksSection activeProduct={activeProduct} />
                    <TestimonialsSection activeProduct={activeProduct} />
                    <FAQSection activeProduct={activeProduct} />
                    <FinalCTASection onSignup={openSignup} onContactSales={() => openContactSales('Final CTA')} activeProduct={activeProduct} />
                </main>
            )}

            {/* Mobile sticky bottom CTA bar */}
            {productChosen && (
                <MobileStickyCTA onSignup={openSignup} onContactSales={() => openContactSales('Mobile Sticky CTA')} />
            )}

            {/* WhatsApp floating action button */}
            <WhatsAppFAB onContactSales={() => openContactSales('WhatsApp FAB')} />

            <ContactSalesDrawer isOpen={isContactDrawerOpen} onClose={() => setIsContactDrawerOpen(false)} source={contactDrawerSource} />
            <Footer
                onPrivacyClick={() => navigate('/privacy-policy')}
                onTermsClick={() => navigate('/terms-of-service')}
                onCookieClick={() => navigate('/cookie-policy')}
                onUsageClick={() => navigate('/usage-policy')}
                onResources={() => navigate('/resources')}
                onContactSales={() => openContactSales('Footer')}
                activeProduct={activeProduct}
                setActiveProduct={handleProductSwitch}
                productChosen={productChosen}
            />
        </div>
    );
}

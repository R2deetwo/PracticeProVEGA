
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Logo, CheckIcon, ZapIcon,
    ScalesIcon, ShieldCheckIcon, DocumentIcon, MattersIcon, SparklesIcon,
    OfficeBuildingIcon, SearchIcon, ArrowLeftIcon, LockClosedIcon, KeyIcon
} from '../constants';
import { useUI } from '../contexts/UIContext';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import DataProcessingAgreement from './DataProcessingAgreement';
import CookiePolicy from './CookiePolicy';
import UsagePolicy from './UsagePolicy';
import ResourcesPage from './ResourcesPage';
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
        className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-sm bg-white/70 dark:bg-white/5 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 backdrop-blur-sm hover:bg-white dark:hover:bg-white/10 transition-all duration-300 active:scale-[0.97] ${className}`}
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
    activeProduct: 'vega' | 'atrium';
    setActiveProduct: (p: 'vega' | 'atrium') => void;
    productChosen: boolean;
    onBackToHub: () => void;
}> = ({ activeSection, scrollTo, onLogin, onSignup, onResources, activeProduct, setActiveProduct, productChosen, onBackToHub }) => (
    <header className="fixed top-0 left-0 right-0 z-[250] transition-all duration-300">
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
                        className="hidden md:flex items-center pl-3 border-l border-slate-200 group/breadcrumb relative h-7 overflow-hidden"
                        aria-label={`Back to all products — currently viewing ${activeProduct === 'vega' ? 'Vega' : 'Atrium'}`}
                    >
                        {/* Container with fixed width to prevent layout shift during transition */}
                        <span className="relative h-5 w-28 overflow-hidden flex items-center">
                            {/* Default state: product name (VEGA in amber, ATRIUM in emerald) */}
                            <span
                                className={`absolute inset-0 flex items-center text-sm font-black uppercase tracking-tight transition-all duration-300 ease-out group-hover/breadcrumb:-translate-y-full group-hover/breadcrumb:opacity-0 ${activeProduct === 'vega' ? 'text-amber-500' : 'text-violet-400'}`}
                            >
                                {activeProduct === 'vega' ? 'VEGA' : 'ATRIUM'}
                            </span>
                            {/* Hover state: All Products slides up from below */}
                            <span className="absolute inset-0 flex items-center gap-1 text-2xs font-black uppercase tracking-widest text-slate-400 translate-y-full opacity-0 group-hover/breadcrumb:translate-y-0 group-hover/breadcrumb:opacity-100 group-hover/breadcrumb:text-primary-500 transition-all duration-300 ease-out">
                                <ArrowLeftIcon className="w-3 h-3" />
                                All Products
                            </span>
                        </span>
                    </button>
                )}
            </div>

            {/* Desktop Links */}
            <nav className="hidden md:flex items-center gap-1">
                <div className="relative group">
                    <button className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 transition-all duration-200">
                        Products
                        <svg className="w-4 h-4 ml-0.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {/* Invisible hover bridge: transparent padding fills the gap between
                        trigger and dropdown so the cursor never leaves the hover boundary */}
                    <div className="absolute top-full left-0 pt-1 w-[210px]">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1">
                        <button onClick={() => setActiveProduct('vega')} className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${activeProduct === 'vega' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                            <ScalesIcon className="w-4 h-4 opacity-70" />
                            Vega
                        </button>
                        <button onClick={() => setActiveProduct('atrium')} className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${activeProduct === 'atrium' ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                            <OfficeBuildingIcon className="w-4 h-4 opacity-70" />
                            Atrium
                        </button>
                    </div>
                    </div>
                </div>
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
                    onClick={onResources}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200"
                >
                    Resources
                </button>
            </nav>

            {/* Right Actions — theme toggle removed; landing page is always light */}
            <div className="flex items-center gap-2">
                <div className="hidden md:block h-4 w-px bg-slate-200 mx-1" />

                <button
                    onClick={onLogin}
                    className="hidden md:block px-4 py-2 text-sm font-semibold text-slate-700 hover:text-primary-600 transition-colors"
                >
                    Log In
                </button>
                <PrimaryButton onClick={onSignup} className="!px-3 !py-2 sm:!px-3 sm:!py-1.5 !rounded-lg !text-xs sm:!text-2xs ml-1 md:ml-2 md:!text-sm md:!px-5 md:!py-2.5 md:!rounded-lg">
                    Get Started Free
                </PrimaryButton>
            </div>
        </div>
    </header>
);

// ─── FOOTER ─────────────────────────────────────────────────────────────────

const Footer: React.FC<{ onPrivacyClick: () => void; onTermsClick: () => void; onCookieClick: () => void; onUsageClick: () => void; onResources: () => void; onContactSales: () => void; activeProduct: 'vega' | 'atrium'; setActiveProduct: (p: 'vega' | 'atrium') => void; productChosen: boolean }> = ({ onPrivacyClick, onTermsClick, onCookieClick, onUsageClick, onResources, onContactSales, activeProduct, setActiveProduct, productChosen }) => (
    <footer className="bg-slate-950 dark:bg-black border-t border-white/5 py-10 md:py-16">
        <div className="container mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-10 mb-12">
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
                                : 'Purpose-built for Nigerian property portfolios — facilities management, service charge collection, and a residents\' portal.'}
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
            { title: 'Research Studio', desc: 'Research workspace with document analysis, intelligent search, and AI-assisted document review. Build research notebooks with source citations.', badge: 'Growth+', isPropertyOnly: true },
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
        Icon: MattersIcon,
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
            { title: 'Maintenance Tickets', desc: 'Residents log issues directly into your workflow via the portal. Categorize by plumbing, electrical, structural, or other. Track status from open to resolved.' },
            { title: 'Expense Tracking', desc: 'Log maintenance costs, service charges, and utility bills per property. Track income vs. expenses with cash flow visualizations.' },
            { title: 'Estate Administration Documents', desc: 'Streamline property administration, manage tenancy records, and generate standard estate management administrative documents with precision.', badge: 'Pro' },
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
                <div ref={headerRef} className="scroll-reveal text-center mb-16">
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
// Lets property managers input their unit count and see:
// - Per-tenant SCE for each tier
// - Total annual cost
// - Whether their residents can absorb the cost (based on a typical
//   Lagos service charge benchmark of ₦2,000-5,000/unit/month)
// Helps them decide if Atrium makes economic sense for their portfolio.

const SceCalculatorModal: React.FC<{
    tiers: Record<Exclude<TierId, 'Enterprise'>, TierDef>;
    onClose: () => void;
    onSignup: (productOverride?: ProductMode) => void;
}> = ({ tiers, onClose, onSignup }) => {
    const [unitCount, setUnitCount] = useState<string>('50');
    const [avgRentPerUnit, setAvgRentPerUnit] = useState<string>('1500000');

    const units = Math.max(1, parseInt(unitCount) || 0);
    const avgRent = Math.max(0, parseInt(avgRentPerUnit) || 0);

    // Calculate SCE per tenant per month for each tier
    const calculations = (['Core', 'Growth', 'Pro'] as const).map(id => {
        const tier = tiers[id];
        const annualPrice = tier.annualPrice || 0;
        const scePerTenantMonthly = units > 0 ? Math.round(annualPrice / 12 / units) : 0;
        const totalAnnual = annualPrice;
        // SCE as % of average annual rent (rent × 12)
        const annualRent = avgRent * 12;
        const sceAsPercentOfRent = annualRent > 0 ? (scePerTenantMonthly * 12 / annualRent) * 100 : 0;
        // Absorbability: typical Lagos SC is ₦2,000-5,000/mo per unit
        // If SCE < ₦2,000, residents barely notice it. If > ₦5,000, it's noticeable.
        let absorbability: 'easy' | 'moderate' | 'tight' = 'easy';
        if (scePerTenantMonthly > 5000) absorbability = 'tight';
        else if (scePerTenantMonthly > 2000) absorbability = 'moderate';
        return {
            id,
            tierName: tier.label,
            tierMaxUnits: tier.maxUnits,
            scePerTenantMonthly,
            totalAnnual,
            sceAsPercentOfRent,
            absorbability,
            exceedsCapacity: tier.maxUnits !== null && units > tier.maxUnits,
        };
    });

    const fmtNaira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

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
            <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Brand accent bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-2xl sm:rounded-t-2xl" />

                {/* Header */}
                <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-slate-100">
                    <div>
                        <h2 id="sce-calc-title" className="font-display text-lg font-bold text-slate-900">SCE Calculator</h2>
                        <p className="text-xs text-slate-500 mt-0.5">See how Atrium fits your portfolio</p>
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
                    {/* Explanation */}
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                        <p className="text-xs text-emerald-900 leading-relaxed">
                            <strong>Service Charge Equivalent (SCE)</strong> is your annual Atrium subscription divided across your tenant base — shown as a per-tenant monthly amount. You can itemize this on service charge invoices to offset the cost. It is <strong>not</strong> an additional fee charged by Atrium.
                        </p>
                    </div>

                    {/* Inputs */}
                    <div className="grid sm:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="block text-sm font-semibold text-slate-700 mb-1.5">Units under management</span>
                            <input
                                type="number"
                                min="1"
                                value={unitCount}
                                onChange={e => setUnitCount(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-300 rounded-lg shadow-sm p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder="e.g. 50"
                            />
                            <span className="block text-xs text-slate-400 mt-1">Total units across all properties</span>
                        </label>
                        <label className="block">
                            <span className="block text-sm font-semibold text-slate-700 mb-1.5">Avg. annual rent per unit (₦)</span>
                            <input
                                type="number"
                                min="0"
                                step="50000"
                                value={avgRentPerUnit}
                                onChange={e => setAvgRentPerUnit(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-300 rounded-lg shadow-sm p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder="e.g. 1,500,000"
                            />
                            <span className="block text-xs text-slate-400 mt-1">Used to calculate SCE as % of rent</span>
                        </label>
                    </div>

                    {/* Results — stacked cards on mobile, table on desktop */}
                    <div className="space-y-3 sm:hidden">
                        {calculations.map(calc => (
                            <div key={calc.id} className="border border-slate-200 rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-display font-bold text-slate-900 text-sm">{calc.tierName}</p>
                                        {calc.exceedsCapacity && (
                                            <p className="text-3xs text-amber-600 font-bold mt-0.5">Exceeds tier cap ({calc.tierMaxUnits} units)</p>
                                        )}
                                    </div>
                                    <span
                                        className={`inline-block px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                                            calc.absorbability === 'easy'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : calc.absorbability === 'moderate'
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}
                                    >
                                        {calc.absorbability}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <p className="text-slate-400 uppercase tracking-wider text-3xs font-bold">SCE/tenant/mo</p>
                                        <p className="font-display nums-tabular font-bold text-slate-900">{fmtNaira(calc.scePerTenantMonthly)}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 uppercase tracking-wider text-3xs font-bold">% of rent</p>
                                        <p className="nums-tabular text-slate-600">{avgRent > 0 ? `${calc.sceAsPercentOfRent.toFixed(2)}%` : '—'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block border border-slate-200 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-4 gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <span>Tier</span>
                            <span className="text-right">SCE / tenant / mo</span>
                            <span className="text-right">% of rent</span>
                            <span className="text-right">Absorbability</span>
                        </div>
                        {calculations.map(calc => (
                            <div key={calc.id} className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-slate-100 last:border-b-0 items-center">
                                <div>
                                    <p className="font-display font-bold text-slate-900 text-sm">{calc.tierName}</p>
                                    {calc.exceedsCapacity && (
                                        <p className="text-3xs text-amber-600 font-bold mt-0.5">Exceeds tier cap ({calc.tierMaxUnits} units)</p>
                                    )}
                                </div>
                                <p className="text-right font-display nums-tabular font-bold text-slate-900 text-sm">
                                    {fmtNaira(calc.scePerTenantMonthly)}
                                </p>
                                <p className="text-right nums-tabular text-slate-600 text-sm">
                                    {avgRent > 0 ? `${calc.sceAsPercentOfRent.toFixed(2)}%` : '—'}
                                </p>
                                <div className="text-right">
                                    <span
                                        className={`inline-block px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                                            calc.absorbability === 'easy'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : calc.absorbability === 'moderate'
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}
                                    >
                                        {calc.absorbability}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Legend / guidance */}
                    <div className="space-y-1.5 text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">How to read absorbability:</p>
                        <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 align-middle"></span> <strong>Easy</strong> — SCE under ₦2,000/mo. Residents barely notice it on their service charge invoice.</p>
                        <p><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle"></span> <strong>Moderate</strong> — SCE ₦2,000-5,000/mo. Noticeable but reasonable vs typical Lagos SC.</p>
                        <p><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 align-middle"></span> <strong>Tight</strong> — SCE over ₦5,000/mo. Consider a higher tier with more units to spread the cost.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                        {units} units · {fmtNaira(parseInt(avgRentPerUnit) || 0)}/unit/yr
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
    // Hover behavior: Calculate button hidden until user hovers a plan,
    // then slides in when hovering the pill area
    const [hasHoveredPlan, setHasHoveredPlan] = useState(false);
    const [isHoveringArea, setIsHoveringArea] = useState(false);
    const productMode: ProductMode = isVega ? 'legal' : 'property';
    const tiers = getDisplayTiersForProduct(productMode);
    const cycle = isVega ? billingCycle : 'annual';  // Atrium: always annual

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
            <div ref={headerRef} className="scroll-reveal text-center mb-16">
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'var(--color-ink)' }}>
                    {isVega ? 'Transparent Pricing. Professional Grade.' : 'Institutional Property Management. Simplified.'}
                </h2>
                <p className="text-slate-500 max-w-lg mx-auto text-lg leading-relaxed mb-6">
                    {isVega ? 'Equip your firm with the tools to manage complex cases and scale efficiently.' : 'Frame your technology cost as a service benefit to your residents.'}
                </p>

                {/* Billing Toggle (VEGA Only — Atrium is annual-only) */}
                {isVega && (
                    <div className="flex items-center justify-center gap-4 mb-8">
                        <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
                        <button 
                            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                            className="relative w-16 h-9 bg-slate-200 rounded-full transition-colors"
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
                )}

                {!isVega && (
                    <div
                        className="flex justify-center items-center mt-2 relative"
                        onMouseEnter={() => setIsHoveringArea(true)}
                        onMouseLeave={() => setIsHoveringArea(false)}
                    >
                        {/* SCE explanation tooltip — shows when hovering the area */}
                        <div
                            className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 max-w-[90vw] rounded-lg bg-slate-900 px-4 py-3 text-xs leading-relaxed text-white shadow-2xl transition-all duration-300 pointer-events-none ${
                                isHoveringArea ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                            }`}
                        >
                            <strong className="block mb-1">What is SCE?</strong>
                            Service Charge Equivalent is your annual Atrium subscription divided across your tenant base — shown as a per-tenant monthly amount. You can itemize this on service charge invoices to offset the cost. It is not an additional fee charged by Atrium.
                            {/* Arrow */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
                        </div>

                        {/* Pill — always centered */}
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold border border-blue-200 whitespace-nowrap">
                            Billed Annually · SCE shown per unit<span className="text-blue-500 font-bold">*</span>
                        </span>

                        {/* Calculate button — slides in gracefully after user has hovered a plan */}
                        <button
                            onClick={() => setShowSceCalculator(true)}
                            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-600 text-white text-sm font-bold border border-emerald-700 hover:bg-emerald-700 transition-all duration-500 ease-out whitespace-nowrap overflow-hidden ${
                                hasHoveredPlan && isHoveringArea
                                    ? 'opacity-100 max-w-[200px] ml-3'
                                    : 'opacity-0 max-w-0 ml-0'
                            }`}
                        >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            <span>Calculate your SCE</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Grid */}
            <div
                ref={gridRef}
                className="scroll-reveal scroll-reveal-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8 items-stretch pb-12 max-w-5xl mx-auto"
                onMouseEnter={() => setHasHoveredPlan(true)}
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
                                <span className="font-semibold">~{plan.tenantContribution}</span> per tenant/mo (SCE)
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

// ─── ROOT COMPONENT ──────────────────────────────────────────────────────

export const LandingPage: React.FC<{ initialProduct?: 'vega' | 'atrium' }> = ({ initialProduct }) => {
    const { openModal } = useUI();
    const [activeSection, setActiveSection] = useState('home');
    const [activeProduct, setActiveProduct] = useState<'vega' | 'atrium'>(initialProduct || 'vega');
    const [productChosen, setProductChosen] = useState(!!initialProduct);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [showCookiePolicy, setShowCookiePolicy] = useState(false);
    const [showResources, setShowResources] = useState(false);
    const [showDPA, setShowDPA] = useState(false);
    const [showUsagePolicy, setShowUsagePolicy] = useState(false);

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
    //   - On '/' (root, no product chosen) → open signup with NO selectedProduct
    //     → signup modal shows the product_selection step (asks which product).
    //   - On '/vega' or '/atrium' (product already chosen via URL) → open
    //     signup WITH selectedProduct = activeProduct → signup skips the
    //     product_selection step and goes straight to the registration form.
    //   - From the "Are you a real estate lawyer?" Komplete CTA → passes
    //     'unified' as productOverride → signup skips to form with product=unified.
    //   - From the pricing section's tier CTAs → passes the active product
    //     as productOverride → signup skips to form.
    //
    // This eliminates the repetitive "which product do you want?" question
    // when the user has already chosen a product by navigating to /vega or
    // /atrium, while still asking the question on the root hub page when
    // the user hasn't committed to a product yet.
    const openSignup = (productOverride?: ProductMode) => {
        // Priority: explicit override > current activeProduct (if chosen) > none
        const product = productOverride || (productChosen ? activeProduct : undefined);
        openModal('signup', null, {
            selectedProduct: product,
        });
    };
    const [isContactDrawerOpen, setIsContactDrawerOpen] = useState(false);
    const [contactDrawerSource, setContactDrawerSource] = useState('landing_page');
    const openContactSales = (source: string) => { setContactDrawerSource(source); setIsContactDrawerOpen(true); };

    if (showPrivacy) return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />;
    if (showTerms) return <TermsOfService onBack={() => setShowTerms(false)} activeProduct={activeProduct} />;
    if (showDPA) return <DataProcessingAgreement onBack={() => setShowDPA(false)} />;
    if (showCookiePolicy) return <CookiePolicy onBack={() => setShowCookiePolicy(false)} />;
    if (showUsagePolicy) return <UsagePolicy onBack={() => setShowUsagePolicy(false)} />;
    if (showResources) return <ResourcesPage onBack={() => setShowResources(false)} onPrivacyClick={() => { setShowResources(false); setShowPrivacy(true); }} onTermsClick={() => { setShowResources(false); setShowTerms(true); }} onDPAClick={() => { setShowResources(false); setShowDPA(true); }} activeProduct={activeProduct} setActiveProduct={handleProductSwitch} />;

    return (
        <div
            ref={scrollRef}
            className="h-[100dvh] w-full overflow-y-auto font-sans scroll-smooth md:[scrollbar-gutter:stable]"
            style={{ background: 'var(--color-paper)', color: 'var(--color-ink)' }}
        >
            <NavBar
                activeSection={activeSection}
                scrollTo={scrollTo}
                onLogin={() => openModal('login')}
                onSignup={openSignup}
                onResources={() => setShowResources(true)}
                activeProduct={activeProduct}
                setActiveProduct={handleProductSwitch}
                productChosen={productChosen}
                onBackToHub={handleBackToHub}
            />

            {!productChosen ? (
                <HubHero
                    onPickProduct={handlePickProduct}
                    onLogin={() => openModal('login')}
                    highlightKey={0}
                />
            ) : (
                <main key={activeProduct} className="animate-swap-in">
                    <HomeSection onSignup={openSignup} activeProduct={activeProduct} setActiveProduct={handleProductSwitch} />
                    <StatsDemarcator activeProduct={activeProduct} />
                    <FeaturesSection activeProduct={activeProduct} />
                    <TrustBadgesStrip />
                    <PricingSection onSignup={openSignup} onContactSales={openContactSales} activeProduct={activeProduct} setActiveProduct={setActiveProduct} setProductChosen={setProductChosen} />
                </main>
            )}

            <ContactSalesDrawer isOpen={isContactDrawerOpen} onClose={() => setIsContactDrawerOpen(false)} source={contactDrawerSource} />
            <Footer
                onPrivacyClick={() => setShowPrivacy(true)}
                onTermsClick={() => setShowTerms(true)}
                onCookieClick={() => setShowCookiePolicy(true)}
                onUsageClick={() => setShowUsagePolicy(true)}
                onResources={() => setShowResources(true)}
                onContactSales={() => openContactSales('Footer')}
                activeProduct={activeProduct}
                setActiveProduct={handleProductSwitch}
                productChosen={productChosen}
            />
        </div>
    );
}

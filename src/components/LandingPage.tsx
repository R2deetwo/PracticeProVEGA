
import React, { useState, useEffect, useRef } from 'react';
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
import ResourcesPage from './ResourcesPage';
import {
    getDisplayTiersForProduct,
    formatTierPrice,
    DISPLAY_TIER_IDS,
    type ProductMode,
    type TierId,
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

        <div className="relative container mx-auto px-6 h-16 flex items-center justify-between">
            {/* Logo + back-to-hub breadcrumb */}
            <div className="flex items-center gap-3">
                <button onClick={() => productChosen ? scrollTo('home') : undefined} className="flex items-center gap-2 group">
                    <Logo className="h-7 w-7 text-primary-500 group-hover:scale-105 transition-transform drop-shadow-sm" />
                    <span className="text-[19px] font-bold tracking-tight text-slate-900 flex items-center">
                        Practice<span className="text-primary-500">Pro</span>
                    </span>
                </button>
                {productChosen && (
                    <button
                        onClick={onBackToHub}
                        className="hidden md:flex items-center gap-1 text-2xs font-black uppercase tracking-widest text-slate-400 hover:text-primary-500 transition-colors pl-3 border-l border-slate-200"
                    >
                        <ArrowLeftIcon className="w-3 h-3" />
                        All Products
                    </button>
                )}
            </div>

            {/* Desktop Links */}
            <nav className="hidden md:flex items-center gap-1">
                <div className="relative group">
                    <button className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 transition-all duration-200">
                        Products
                        <svg className="w-4 h-4 ml-0.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {/* Invisible hover bridge: transparent padding fills the gap between
                        trigger and dropdown so the cursor never leaves the hover boundary */}
                    <div className="absolute top-full left-0 pt-1 w-[210px]">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1">
                        <button onClick={() => setActiveProduct('vega')} className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${activeProduct === 'vega' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                            <ScalesIcon className="w-4 h-4 opacity-70" />
                            Vega
                        </button>
                        <button onClick={() => setActiveProduct('atrium')} className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${activeProduct === 'atrium' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                            <OfficeBuildingIcon className="w-4 h-4 opacity-70" />
                            Atrium
                        </button>
                    </div>
                    </div>
                </div>
                <button
                    onClick={() => scrollTo('features')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        activeSection === 'features'
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    Features
                </button>
                <button
                    onClick={() => scrollTo('pricing')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        activeSection === 'pricing'
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    Pricing
                </button>
                <button
                    onClick={onResources}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200"
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
                <PrimaryButton onClick={onSignup} className="!px-3 !py-1.5 !rounded-lg !text-2xs ml-1 md:ml-2 md:!text-sm md:!px-5 md:!py-2.5 md:!rounded-xl">
                    Get Started Free
                </PrimaryButton>
            </div>
        </div>
    </header>
);

// ─── FOOTER ─────────────────────────────────────────────────────────────────

const Footer: React.FC<{ onPrivacyClick: () => void; onTermsClick: () => void; onCookieClick: () => void; onResources: () => void; onContactSales: () => void; activeProduct: 'vega' | 'atrium'; setActiveProduct: (p: 'vega' | 'atrium') => void; productChosen: boolean }> = ({ onPrivacyClick, onTermsClick, onCookieClick, onResources, onContactSales, activeProduct, setActiveProduct, productChosen }) => (
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
                                    className={`ml-2 text-[15px] font-black uppercase tracking-tight ${activeProduct === 'vega' ? 'text-amber-500' : 'text-violet-400'}`}
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
                    <div className="flex flex-col gap-2.5">
                        <span onClick={onPrivacyClick} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Privacy Policy</span>
                        <span onClick={onTermsClick} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Terms of Service</span>
                        <span onClick={onCookieClick} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Cookie Policy</span>
                        <span onClick={onContactSales} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Contact Sales</span>
                        <a href="mailto:dpo@practicepro.ng" className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Email Us</a>
                        <span onClick={onResources} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Security</span>
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
        <div ref={ref} className="scroll-reveal bg-slate-50 border-y border-slate-200 py-5 px-6">
            <div className="container mx-auto flex flex-wrap items-center justify-center gap-6 md:gap-10">
                {BADGES.map((b, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-slate-200/60 flex items-center justify-center">
                            <b.Icon className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 tracking-wide whitespace-nowrap">
                            {b.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── HUB HERO (no product chosen yet) ───────────────────────────────────────

const HubHero: React.FC<{
    onPickProduct: (p: 'vega' | 'atrium') => void;
    onLogin: () => void;
    onSignup: () => void;
    highlightKey?: number;
}> = ({ onPickProduct, onLogin, onSignup, highlightKey }) => {
    // Landing page is ALWAYS light mode — no isDark logic.
    // hub-bg.jpg provides a subtle brand-tinted background behind the dot grid.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { const t = setTimeout(() => setMounted(true), 40); return () => clearTimeout(t); }, []);

    return (
        <section className="relative overflow-hidden min-h-[100dvh] flex flex-col bg-gradient-to-b from-slate-50 to-white">
            {/* Hub background image — very subtle, brand-tinted */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.15] bg-cover bg-center"
                style={{ backgroundImage: 'url(/assets/landing/hub-bg.jpg)' }}
                aria-hidden="true"
            />
            {/* Ambient mesh — light, soft */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full blur-[140px] bg-primary-400/8" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full blur-[120px] bg-amber-300/8" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full blur-[120px] bg-emerald-300/8" />
                <div className="absolute inset-0 bg-[radial-gradient(circle,_#334155_1px,_transparent_1px)] [background-size:28px_28px] opacity-[0.04]" />
            </div>

            <div className={`relative z-10 flex-1 flex flex-col items-center justify-center pt-28 pb-20 px-6 text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

                <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-bold tracking-tight leading-[1.06] mb-6 max-w-5xl text-slate-900">
                    Professional Practice,
                    <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-violet-500 to-emerald-500">
                        Precisely Managed.
                    </span>
                </h1>

                <p className="text-lg md:text-xl max-w-xl mx-auto mb-14 leading-[1.75] text-slate-600">
                    Select your professional discipline to enter your dedicated workspace.
                </p>

                {/* Audience routing cards — data-product-cards is used by the
                    "Get Started Free" scroll handler to find this element. */}
                <div data-product-cards className="grid md:grid-cols-2 gap-5 w-full max-w-3xl mx-auto mb-12">
                    {/* Vega — with one-pulse glow on mount + re-triggered when highlightKey changes (Task 17) */}
                    <button
                        key={`vega-${highlightKey || 0}`}
                        onClick={() => onPickProduct('vega')}
                        style={{ '--glow-color': 'rgba(245, 158, 11, 0.10)', '--glow-border': 'rgba(245, 158, 11, 0.20)' } as React.CSSProperties}
                        className={`product-glow-pulse product-glow-pulse-delay-1 group relative text-left p-7 md:p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1.5 active:scale-[0.975] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-300 shadow-sm hover:shadow-md`}
                    >
                        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl bg-amber-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        <div className="relative z-10">
                            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
                                <ScalesIcon className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="flex items-center gap-2 mb-2.5">
                                <span className="text-2xs font-black uppercase tracking-[0.22em] text-amber-500">Vega</span>
                                <span className="text-3xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/[0.08] text-amber-500/70 border border-amber-500/15">Legal</span>
                            </div>
                            <h3 className="text-lg font-bold mb-2.5 text-slate-900">For Law Firms</h3>
                            <p className="text-sm leading-[1.75] text-slate-600">
                                Case management, automated billing, and AI-assisted research — built for Nigerian legal practice.
                            </p>
                            <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-amber-500/70 group-hover:text-amber-400 group-hover:gap-2.5 transition-all duration-300">
                                Enter Vega <span aria-hidden="true">→</span>
                            </div>
                        </div>
                    </button>

                    {/* Atrium — with one-pulse glow on mount + re-triggered when highlightKey changes (Task 17) */}
                    <button
                        key={`atrium-${highlightKey || 0}`}
                        onClick={() => onPickProduct('atrium')}
                        style={{ '--glow-color': 'rgba(16, 185, 129, 0.10)', '--glow-border': 'rgba(16, 185, 129, 0.20)' } as React.CSSProperties}
                        className={`product-glow-pulse product-glow-pulse-delay-2 group relative text-left p-7 md:p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1.5 active:scale-[0.975] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 shadow-sm hover:shadow-md`}
                    >
                        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl bg-emerald-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        <div className="relative z-10">
                            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
                                <OfficeBuildingIcon className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="flex items-center gap-2 mb-2.5">
                                <span className="text-2xs font-black uppercase tracking-[0.22em] text-emerald-500">Atrium</span>
                                <span className="text-3xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/[0.08] text-emerald-500/70 border border-emerald-500/15">Property</span>
                            </div>
                            <h3 className="text-lg font-bold mb-2.5 text-slate-900">For Property Managers</h3>
                            <p className="text-sm leading-[1.75] text-slate-600">
                                Revenue monitoring, rent collection, and portfolio analytics for modern Nigerian estates.
                            </p>
                            <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-emerald-500/70 group-hover:text-emerald-400 group-hover:gap-2.5 transition-all duration-300">
                                Enter Atrium <span aria-hidden="true">→</span>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Auth link */}
                <button
                    onClick={onLogin}
                    className="text-sm transition-colors text-slate-500 hover:text-slate-700"
                >
                    Already have an account?{' '}
                    <span className="font-semibold hover:underline text-primary-600 hover:text-primary-700">Sign in →</span>
                </button>

                {/* TASK 17: "Get Started Free" CTA in the middle of the hub.
                    When no product is chosen, this scrolls to the product cards
                    and highlights them (instead of opening the signup modal).
                    The user explicitly requested this flow. */}
                <div className="mt-2">
                    <button
                        onClick={onSignup}
                        className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-bold text-base shadow-xl shadow-primary-500/30 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                        Get Started Free
                        <span className="text-sm opacity-80 group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span>
                    </button>
                    <p className="text-xs mt-3 text-slate-500">Not sure which product fits? Browse all options.</p>
                </div>

                {/* Compliance note — full trust strip lives in TrustBadgesStrip below */}
                <p className="text-2xs mt-12 tracking-wide text-slate-400">NDPA 2023 Compliant · TLS 1.3 · Encrypted at Rest*</p>
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
    const [mounted, setMounted] = useState(false);
    useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

    const isVega = activeProduct === 'vega';
    const heroImage = isVega ? '/assets/landing/vega-hero.jpg' : '/assets/landing/atrium-hero.jpg';

    return (
        <section id="home" className="relative overflow-hidden bg-white">
            {/* ── Subtle brand-tinted mesh background ── */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Radial glow centred top */}
                <div className={`absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[120px] ${isVega ? 'bg-primary-400/10' : 'bg-blue-400/8'}`} />
                {/* Dot grid */}
                <div className="absolute inset-0 bg-[radial-gradient(circle,_#334155_1px,_transparent_1px)] [background-size:28px_28px] opacity-[0.04]" />
            </div>

            {/* ── Hero Content — 2-column on desktop, stacked on mobile ── */}
            <div className={`relative z-10 pt-36 pb-24 lg:pt-48 lg:pb-32 px-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                    {/* Left: text content */}
                    <div className="text-center lg:text-left">
                        {/* Headline */}
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6 text-slate-900">
                            {isVega ? <>Practice<br />Management</> : <>Revenue<br />Monitor</>}{' '}
                            <br className="hidden md:block" />
                            for{' '}
                            <span className="relative">
                                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${isVega ? 'from-primary-500 via-emerald-500 to-teal-500' : 'from-blue-500 via-indigo-500 to-cyan-500'}`}>
                                    {isVega ? 'Nigerian Law Firms' : 'Modern Portfolios'}
                                </span>
                            </span>
                        </h1>

                        {/* Sub-copy */}
                        <p className="text-lg max-w-2xl mx-auto lg:mx-0 mb-10 leading-[1.7] text-slate-600">
                            {isVega
                                ? 'Enterprise-grade case management, AI-assisted drafting, and automated billing — built from the ground up for Nigerian legal practice.'
                                : 'Revenue monitoring, rent collection, and defaulter management — purpose-built for Nigerian property portfolios and estate operations.'}
                        </p>

                        {/* CTAs */}
                        <div className="flex gap-4 justify-center lg:justify-start items-center mb-16">
                            <PrimaryButton onClick={onSignup} className="text-base px-8 py-4 shadow-xl shadow-primary-500/30">
                                Get Started
                            </PrimaryButton>
                        </div>

                        {/* Stats strip */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden max-w-3xl mx-auto lg:mx-0 border shadow-sm bg-slate-200 border-slate-200">
                            {(isVega ? VEGA_STATS : ATRIUM_STATS).map((s, i) => (
                                <div key={i} className="px-6 py-5 bg-white">
                                    <p className="text-2xl font-bold mb-0.5 text-slate-900">{s.value}</p>
                                    <p className="text-xs leading-tight text-slate-500">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: hero portrait image */}
                    <div className="relative order-first lg:order-last">
                        <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5">
                            <img
                                src={heroImage}
                                alt={isVega ? 'Nigerian lawyer in a modern Lagos law office' : 'Nigerian property manager on a residential estate rooftop'}
                                className="w-full h-full object-cover"
                                loading="eager"
                            />
                            {/* Subtle gradient overlay for depth + text legibility if caption is added later */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" aria-hidden="true" />
                        </div>
                        {/* Decorative brand glow behind image */}
                        <div
                            className={`absolute -inset-4 -z-10 rounded-[2rem] blur-2xl opacity-20 ${isVega ? 'bg-primary-500' : 'bg-blue-500'}`}
                            aria-hidden="true"
                        />
                    </div>
                </div>
            </div>

            {/* Bottom fade into next section */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t to-transparent pointer-events-none from-white" />
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
            { title: 'ALOA AI Copilot', desc: 'AI-powered drafting assistant built on Gemini, trained for Nigerian legal terminology, court rules, and document structures. Draft originating processes, affidavits, and conveyances with natural language instructions.', badge: 'Growth+' },
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

    return (
        <section id="features" className="py-20 lg:py-28 bg-slate-50">
            <div className="container mx-auto px-6 max-w-7xl">
                {/* Header */}
                <div ref={headerRef} className="scroll-reveal text-center mb-16">
                    <Pill className="mb-5 bg-primary-50 text-primary-700 border-primary-200">
                        Features
                    </Pill>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900">
                        {isVega ? <>Case Management &<br />Legal Intelligence</> : <>Property Management &<br />Revenue Operations</>}
                    </h2>
                    <p className="text-lg max-w-2xl mx-auto leading-relaxed text-slate-500">
                        {isVega
                            ? 'From intake to resolution, VEGA covers every stage of your legal practice — drafting, research, billing, and client collaboration.'
                            : 'From rent collection to defaulter management, Atrium covers every aspect of your property portfolio — residents, maintenance, and financials.'}
                    </p>
                </div>

                {/* Feature Categories */}
                <div ref={sectionsRef} className="scroll-reveal">
                    {categories.map((cat) => (
                        <div key={cat.category} className="mb-14 last:mb-0">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-100 text-primary-600">
                                    <cat.Icon className="w-5 h-5" />
                                </div>
                                <h3 className="text-2xl font-bold tracking-tight text-slate-900">{cat.category}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {cat.items.map((item) => (
                                    <div
                                        key={item.title}
                                        className="group relative rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl bg-white border-slate-200 hover:border-primary-300 hover:shadow-primary-500/5"
                                    >
                                        <h4 className="text-base font-bold mb-2 text-slate-900">
                                            {item.title}
                                            {item.badge && (
                                                <span className="ml-2 text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-100 text-primary-600 border border-primary-200">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </h4>
                                        <p className="text-sm leading-relaxed text-slate-500">
                                            {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
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

const PricingSection: React.FC<{ onSignup: (productOverride?: ProductMode) => void; onContactSales: (source: string) => void; activeProduct: 'vega' | 'atrium'; setActiveProduct: (p: 'vega' | 'atrium') => void; setProductChosen: (v: boolean) => void }> = ({ onSignup, onContactSales, activeProduct, setActiveProduct, setProductChosen }) => {
    // FIX: Use activeProduct instead of useProduct() — same as FeaturesSection
    const isAtrium = activeProduct === 'atrium';
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const isVega = activeProduct === 'vega';
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
    <section id="pricing" className="bg-white min-h-[100dvh] pt-24 pb-24 px-6">
        <div className="container mx-auto max-w-7xl">
            {/* Header */}
            <div ref={headerRef} className="scroll-reveal text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
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
                            className="relative w-14 h-7 bg-slate-200 rounded-full transition-colors"
                        >
                            <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-7' : ''}`} />
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
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold border border-blue-200">
                        Billed Annually · SCE shown per unit
                    </span>
                )}
            </div>

            {/* Grid */}
            <div ref={gridRef} className="scroll-reveal grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8 items-stretch pb-12 max-w-5xl mx-auto">
                {dynamicPlans.map((plan) => (
                    <div
                        key={plan.id}
                        className={`group rounded-[40px] border p-8 md:p-10 flex flex-col relative transition-all duration-500 ${plan.highlighted
                            ? 'bg-slate-900 dark:bg-white border-transparent shadow-2xl shadow-slate-900/30 dark:shadow-white/10 lg:-translate-y-4'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/[0.06] hover:shadow-2xl hover:border-blue-500/30 dark:hover:border-white/20'
                            }`}
                    >
                        {plan.highlighted && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-2xs font-black uppercase tracking-[0.2em] rounded-full shadow-xl z-20 whitespace-nowrap">
                                Most Popular
                            </div>
                        )}

                        <h3 className={`text-xl font-bold mb-1 ${plan.highlighted ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'}`}>{plan.name}</h3>
                        <p className={`text-sm mb-6 ${plan.highlighted ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>{plan.description}</p>

                        {/* Price */}
                        <div className="flex items-baseline gap-1 mb-2">
                            <span className={`text-4xl font-extrabold tracking-tight ${plan.highlighted ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'}`}>{plan.price}</span>
                            <span className={`text-sm ${plan.highlighted ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>{plan.per}</span>
                        </div>

                        {/* Tenant Contribution Section (Atrium Only) */}
                        {!isVega && (
                            <div className={`mb-8 p-4 rounded-2xl border ${plan.highlighted ? 'bg-white/5 border-white/10 dark:bg-slate-50 dark:border-slate-200' : 'bg-slate-50 border-slate-100 dark:bg-white/5 dark:border-white/5'}`}>
                                <p className={`text-2xs font-black uppercase tracking-widest mb-1 ${plan.highlighted ? 'text-blue-400 dark:text-blue-600' : 'text-blue-600 dark:text-blue-400'}`}>
                                    <span className="inline-flex items-center gap-1">
                                        Service Charge Equiv.
                                        <span className="group relative inline-flex items-center">
                                            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span role="tooltip" className="pointer-events-none absolute left-1/2 bottom-full z-30 mb-2 w-60 -translate-x-1/2 scale-95 rounded-lg bg-slate-900 dark:bg-slate-700 px-3 py-2 text-2xs font-normal normal-case tracking-normal leading-snug text-white opacity-0 shadow-xl transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
                                                This is the annual subscription cost divided across your tenant base, shown as a per-tenant monthly amount. You can itemize this on service charge invoices to offset the cost — it is not an additional fee charged by Atrium.
                                            </span>
                                        </span>
                                    </span>
                                </p>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-lg font-bold ${plan.highlighted ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'}`}>{plan.tenantContribution}</span>
                                    <span className={`text-2xs ${plan.highlighted ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>/tenant</span>
                                </div>
                                <p className={`text-3xs mt-1 leading-tight ${plan.highlighted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>Cost benefit for the manager to pass on to the estate.</p>
                            </div>
                        )}

                        {isVega && <div className="mb-8" />}

                        {/* Features */}
                        <ul className="space-y-3.5 mb-8 flex-1">
                            {plan.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <CheckIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-emerald-400 dark:text-emerald-600' : 'text-emerald-600 dark:text-emerald-400'}`} />
                                    <span className={`text-sm leading-snug ${plan.highlighted ? 'text-slate-200 dark:text-slate-700' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {f.text}
                                        {f.note && (
                                            <span className="ml-2 text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
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
                                : 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 hover:bg-slate-200'
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
                <div className="relative overflow-hidden p-8 md:p-10 rounded-3xl bg-gradient-to-br from-primary-500/10 via-emerald-500/5 to-indigo-500/10 border border-primary-500/20 dark:border-primary-500/10">
                    <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl bg-primary-400/10 pointer-events-none" />
                    <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-3xl bg-emerald-400/8 pointer-events-none" />
                    <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex-1">
                            <h4 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
                                Are you a Real Estate Lawyer?
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                                Discover <strong className="text-primary-600 dark:text-primary-400">Komplete</strong> — our specialized, unified workspace designed exclusively for real estate attorneys to coordinate high-stakes property legal operations, manage tenancy portfolios, and track chamber matters from a single secure terminal.
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
                <div className="relative overflow-hidden p-8 md:p-10 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-950 border border-slate-700/40 dark:border-white/[0.06]">
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
    if (showResources) return <ResourcesPage onBack={() => setShowResources(false)} onPrivacyClick={() => { setShowResources(false); setShowPrivacy(true); }} onTermsClick={() => { setShowResources(false); setShowTerms(true); }} onDPAClick={() => { setShowResources(false); setShowDPA(true); }} activeProduct={activeProduct} setActiveProduct={handleProductSwitch} />;

    return (
        <div
            ref={scrollRef}
            className="h-[100dvh] w-full overflow-y-auto bg-white text-slate-900 font-sans scroll-smooth"
            style={{ scrollbarGutter: 'stable' }}
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
                    onSignup={openSignup}
                    highlightKey={0}
                />
            ) : (
                <main key={activeProduct} className="animate-swap-in">
                    <HomeSection onSignup={openSignup} activeProduct={activeProduct} setActiveProduct={handleProductSwitch} />
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
                onResources={() => setShowResources(true)}
                onContactSales={() => openContactSales('Footer')}
                activeProduct={activeProduct}
                setActiveProduct={handleProductSwitch}
                productChosen={productChosen}
            />
        </div>
    );
}

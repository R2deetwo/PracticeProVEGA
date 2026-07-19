
import React, { useState, useEffect, useRef } from 'react';
import {
    Logo, SunIcon, MoonIcon, CheckIcon, ZapIcon,
    ScalesIcon, ShieldCheckIcon, DocumentIcon, MattersIcon, SparklesIcon,
    OfficeBuildingIcon, SearchIcon, ArrowLeftIcon, LockClosedIcon, KeyIcon
} from '../constants';
import { useUI } from '../contexts/UIContext';
import { useProduct } from '../contexts/ProductContext';
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
    onDemo: () => void;
    onResources: () => void;
    isDark: boolean;
    toggleTheme: () => void;
    activeProduct: 'vega' | 'atrium';
    setActiveProduct: (p: 'vega' | 'atrium') => void;
    productChosen: boolean;
    onBackToHub: () => void;
}> = ({ activeSection, scrollTo, onLogin, onSignup, onDemo, onResources, isDark, toggleTheme, activeProduct, setActiveProduct, productChosen, onBackToHub }) => (
    <header className="fixed top-0 left-0 right-0 z-[250] transition-all duration-300">
        {/* Glass layer */}
        <div className="absolute inset-0 bg-white/75 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.06] transition-colors duration-500" />

        <div className="relative container mx-auto px-6 h-16 flex items-center justify-between">
            {/* Logo + back-to-hub breadcrumb */}
            <div className="flex items-center gap-3">
                <button onClick={() => productChosen ? scrollTo('home') : undefined} className="flex items-center gap-2 group">
                    <Logo className="h-7 w-7 text-primary-600 group-hover:scale-105 transition-transform drop-shadow-sm" />
                    <span className="text-[19px] font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
                        Practice<span className="text-primary-600">Pro</span>
                    </span>
                </button>
                {productChosen && (
                    <button
                        onClick={onBackToHub}
                        className="hidden md:flex items-center gap-1 text-2xs font-black uppercase tracking-widest text-slate-400 hover:text-primary-500 transition-colors pl-3 border-l border-slate-200 dark:border-white/10"
                    >
                        <ArrowLeftIcon className="w-3 h-3" />
                        All Products
                    </button>
                )}
            </div>

            {/* Desktop Links */}
            <nav className="hidden md:flex items-center gap-1">
                <div className="relative group">
                    <button className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-1 transition-all duration-200">
                        Products
                        <svg className="w-4 h-4 ml-0.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {/* Invisible hover bridge: transparent padding fills the gap between
                        trigger and dropdown so the cursor never leaves the hover boundary */}
                    <div className="absolute top-full left-0 pt-1 w-[210px]">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1">
                        <button onClick={() => setActiveProduct('vega')} className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${activeProduct === 'vega' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}>
                            <ScalesIcon className="w-4 h-4 opacity-70" />
                            Vega
                        </button>
                        <button onClick={() => setActiveProduct('atrium')} className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${activeProduct === 'atrium' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}>
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
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                >
                    Features
                </button>
                <button
                    onClick={() => scrollTo('pricing')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        activeSection === 'pricing'
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                >
                    Pricing
                </button>
                <button
                    onClick={onResources}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-200"
                >
                    Resources
                </button>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                    className="w-8 h-8 md:w-8 md:h-8 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                    aria-label="Toggle colour theme"
                >
                    {isDark ? <SunIcon className="w-5 h-5 md:w-4 md:h-4" aria-hidden="true" /> : <MoonIcon className="w-5 h-5 md:w-4 md:h-4" aria-hidden="true" />}
                </button>

                <div className="hidden md:block h-4 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                <button
                    onClick={onLogin}
                    className="hidden md:block px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                    Log In
                </button>
                <button
                    onClick={onDemo}
                    className="hidden lg:flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                >
                    Demo
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
                        <a href="mailto:practiceprovega@gmail.com" className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Email Us</a>
                        <span onClick={onResources} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Security</span>
                    </div>
                </div>
            </div>
            <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-600">© {new Date().getFullYear()} PracticePro Legal Technologies Limited Lagos, Nigeria.</p>
                <p className="text-xs text-slate-700">NDPA 2023 Compliant · TLS 1.3 Encrypted · *Encryption provided by infrastructure</p>
            </div>
        </div>
    </footer>
);

// ─── TRUST BADGES ─────────────────────────────────────────────────────────────

const BADGES = [
    { label: 'NDPA 2023 Compliant', Icon: ScalesIcon },
    { label: 'TLS 1.3 Encrypted', Icon: LockClosedIcon },
    { label: 'Data Encrypted at Rest*', Icon: KeyIcon },
    
];

const TrustBadgesStrip: React.FC = () => (
    <div className="bg-slate-50 dark:bg-slate-900/80 border-y border-slate-200 dark:border-white/[0.04] py-5 px-6">
        <div className="container mx-auto flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {BADGES.map((b, i) => (
                <div key={i} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-[#151b2b] shadow-sm border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-center">
                        <b.Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide whitespace-nowrap">
                        {b.label}
                    </span>
                </div>
            ))}
        </div>
    </div>
);

// ─── HUB HERO (no product chosen yet) ───────────────────────────────────────

const HubHero: React.FC<{
    onPickProduct: (p: 'vega' | 'atrium') => void;
    onLogin: () => void;
    onSignup: () => void;
    highlightKey?: number;
}> = ({ onPickProduct, onLogin, onSignup, highlightKey }) => {
    const { isProperty } = useProduct();
    // TASK 17: Respect light/dark mode. The hub hero was hardcoded to
    // bg-slate-950 (always dark). Now it uses dark: variants so that in
    // light mode it's a clean light background, and in dark mode it uses
    // the "midnight royal" aesthetic the user requested.
    const { theme } = useUI();
    const isDark = theme === 'dark' || theme === 'midnight' || theme === 'oled' ||
        theme === 'neon-cyber' || theme === 'midnight-emerald' || theme === 'army-dark' ||
        (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { const t = setTimeout(() => setMounted(true), 40); return () => clearTimeout(t); }, []);

    return (
        <section className={`relative overflow-hidden min-h-[100dvh] flex flex-col transition-colors duration-500 ${isDark ? 'bg-slate-950' : 'bg-gradient-to-b from-slate-50 to-white'}`}>
            {/* Ambient mesh */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className={`absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full blur-[140px] ${isDark ? 'bg-indigo-600/10' : 'bg-indigo-400/8'}`} />
                <div className={`absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full blur-[120px] ${isDark ? 'bg-amber-500/5' : 'bg-amber-300/8'}`} />
                <div className={`absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full blur-[120px] ${isDark ? 'bg-emerald-500/5' : 'bg-emerald-300/8'}`} />
                <div className={`absolute inset-0 bg-[radial-gradient(circle,_#334155_1px,_transparent_1px)] [background-size:28px_28px] ${isDark ? 'opacity-[0.08]' : 'opacity-[0.04]'}`} />
            </div>

            <div className={`relative z-10 flex-1 flex flex-col items-center justify-center pt-28 pb-20 px-6 text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

                {/* Corporate badge */}
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-10 ${isDark ? 'bg-white/[0.04] border border-white/[0.08]' : 'bg-slate-900/[0.03] border border-slate-900/[0.08]'}`}>
                    <Logo className="w-4 h-4 text-primary-500" />
                    <span className={`text-2xs font-black uppercase tracking-[0.25em] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>PracticePro · Nigeria</span>
                </div>

                <h1 className={`text-5xl md:text-6xl lg:text-[5.5rem] font-bold tracking-tight leading-[1.06] mb-6 max-w-5xl ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Professional Practice,
                    <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-violet-500 to-emerald-500">
                        Precisely Managed.
                    </span>
                </h1>

                <p className={`text-lg md:text-xl max-w-xl mx-auto mb-14 leading-[1.75] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
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
                        className={`product-glow-pulse product-glow-pulse-delay-1 group relative text-left p-7 md:p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1.5 active:scale-[0.975] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${isDark ? 'border-white/[0.08] bg-white/[0.03] hover:bg-amber-500/[0.06] hover:border-amber-500/25' : 'border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-300 shadow-sm hover:shadow-md'}`}
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
                            <h3 className="text-lg font-bold text-white mb-2.5">For Law Firms</h3>
                            <p className="text-sm text-slate-500 leading-[1.75]">
                                {isProperty ? 'Case management, automated billing, and AI-assisted research.' : 'Case management, automated billing, and AI-assisted research — built for Nigerian legal practice.'}
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
                        className={`product-glow-pulse product-glow-pulse-delay-2 group relative text-left p-7 md:p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1.5 active:scale-[0.975] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${isDark ? 'border-white/[0.08] bg-white/[0.03] hover:bg-emerald-500/[0.06] hover:border-emerald-500/25' : 'border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 shadow-sm hover:shadow-md'}`}
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
                            <h3 className="text-lg font-bold text-white mb-2.5">For Property Managers</h3>
                            <p className="text-sm text-slate-500 leading-[1.75]">
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
                    className={`text-sm transition-colors ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Already have an account?{' '}
                    <span className="text-primary-500 font-semibold hover:text-primary-600">Sign in →</span>
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
                    <p className={`text-xs mt-3 ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>Not sure which product fits? Browse all options.</p>
                </div>

                {/* Compliance note — full trust strip lives in TrustBadgesStrip below */}
                <p className={`text-2xs mt-12 tracking-wide ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>NDPA 2023 Compliant · TLS 1.3 · Encrypted at Rest*</p>
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

const HomeSection: React.FC<{ onSignup: () => void; onDemo: () => void; activeProduct: 'vega' | 'atrium'; setActiveProduct: (p: 'vega' | 'atrium') => void }> = ({ onSignup, onDemo, activeProduct, setActiveProduct }) => {
    const { isProperty } = useProduct();
    // TASK 18: Respect light/dark mode for BOTH Vega and Atrium landing pages.
    // Previously, Atrium was hardcoded to bg-slate-950 (always dark) even in
    // light mode. Now both products use light backgrounds in light mode and
    // dark backgrounds in dark mode.
    const { theme } = useUI();
    const isDark = theme === 'dark' || theme === 'midnight' || theme === 'oled' ||
        theme === 'neon-cyber' || theme === 'midnight-emerald' || theme === 'army-dark' ||
        (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

    const isVega = activeProduct === 'vega';

    return (
        <section id="home" className={`relative overflow-hidden transition-colors duration-500 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
            {/* ── Mesh / Noise background ── */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Radial glow centred top */}
                <div className={`absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[120px] ${isVega ? (isDark ? 'bg-primary-500/8' : 'bg-primary-400/10') : (isDark ? 'bg-blue-500/15' : 'bg-blue-400/8')}`} />
                {/* Dot grid */}
                <div className={`absolute inset-0 bg-[radial-gradient(circle,_#334155_1px,_transparent_1px)] [background-size:28px_28px] ${isDark ? 'opacity-[0.07]' : 'opacity-[0.04]'}`} />
            </div>

            {/* ── Hero Content ── */}
            <div className={`relative z-10 pt-36 pb-24 lg:pt-48 lg:pb-32 text-center px-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                {/* Headline */}
                <h1 className={`text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6 max-w-4xl mx-auto ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
                <p className={`text-lg max-w-2xl mx-auto mb-10 leading-[1.7] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {isVega
                        ? (isProperty
                            ? 'Enterprise-grade case management, AI-assisted drafting, and automated billing.'
                            : 'Enterprise-grade case management, AI-assisted drafting, and automated billing — built from the ground up for Nigerian legal practice.')
                        : 'Revenue monitoring, rent collection, and defaulter management — purpose-built for Nigerian property portfolios and estate operations.'}
                </p>

                {/* CTAs */}
                <div className="flex gap-4 justify-center items-center mb-16">
                    <PrimaryButton onClick={onSignup} className="text-base px-8 py-4 shadow-xl shadow-primary-500/30">
                        Get Started
                    </PrimaryButton>
                    <GhostButton onClick={() => onDemo()} className="text-base px-8 py-4">
                        Try Demo
                    </GhostButton>
                </div>

                {/* Stats strip */}
                <div className={`grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden max-w-3xl mx-auto border shadow-sm ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-200 border-slate-200'}`}>
                    {(isVega ? VEGA_STATS : ATRIUM_STATS).map((s, i) => (
                        <div key={i} className={`px-6 py-5 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                            <p className={`text-2xl font-bold mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.value}</p>
                            <p className={`text-xs leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom fade into next section */}
            <div className={`absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t to-transparent pointer-events-none ${isDark ? 'from-slate-950' : 'from-white'}`} />
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
    const { isProperty } = useProduct();
    const isVega = activeProduct === 'vega';
    const categories = isVega ? VEGA_FEATURE_CATEGORIES.map(cat => ({ ...cat, items: cat.items.filter(item => isProperty ? !item.isLegalOnly : !item.isPropertyOnly) })).filter(cat => cat.items.length > 0) : ATRIUM_FEATURE_CATEGORIES;

    return (
        <section id="features" className={`py-20 lg:py-28 transition-colors duration-500 ${isVega ? 'bg-slate-50 dark:bg-slate-900/40' : 'bg-slate-950'}`}>
            <div className="container mx-auto px-6 max-w-7xl">
                {/* Header */}
                <div className="text-center mb-16">
                    <Pill className={`mb-5 ${isVega ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-800/50' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-800/50'}`}>
                        Features
                    </Pill>
                    <h2 className={`text-4xl md:text-5xl font-bold tracking-tight mb-4 ${isVega ? 'text-slate-900 dark:text-white' : 'text-white'}`}>
                        {isVega ? <>Case Management &<br />Legal Intelligence</> : <>Property Management &<br />Revenue Operations</>}
                    </h2>
                    <p className={`text-lg max-w-2xl mx-auto leading-relaxed ${isVega ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400'}`}>
                        {isVega
                            ? 'From intake to resolution, VEGA covers every stage of your legal practice — drafting, research, billing, and client collaboration.'
                            : 'From rent collection to defaulter management, Atrium covers every aspect of your property portfolio — residents, maintenance, and financials.'}
                    </p>
                </div>

                {/* Feature Categories */}
                {categories.map((cat) => (
                    <div key={cat.category} className="mb-14 last:mb-0">
                        <div className="flex items-center gap-3 mb-8">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isVega ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                <cat.Icon className="w-5 h-5" />
                            </div>
                            <h3 className={`text-2xl font-bold tracking-tight ${isVega ? 'text-slate-900 dark:text-white' : 'text-white'}`}>{cat.category}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {cat.items.map((item) => (
                                <div
                                    key={item.title}
                                    className={`group relative rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                                        isVega
                                            ? 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-white/[0.06] hover:border-primary-300 dark:hover:border-primary-700/50 hover:shadow-primary-500/5'
                                            : 'bg-white/[0.03] border-white/[0.06] hover:border-blue-500/30 hover:shadow-blue-500/5'
                                    }`}
                                >
                                    <h4 className={`text-base font-bold mb-2 ${isVega ? 'text-slate-900 dark:text-white' : 'text-white'}`}>
                                        {item.title}
                                        {item.badge && (
                                            <span className="ml-2 text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800/50">
                                                {item.badge}
                                            </span>
                                        )}
                                    </h4>
                                    <p className={`text-sm leading-relaxed ${isVega ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400'}`}>
                                        {item.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
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
        Pro: 'For Institutional Developers & Commercial RE',
        Enterprise: '',
    },
    atrium: {
        Core: 'For Individual Landlords & Micro-Agents',
        Growth: 'For Professional Estate Managers',
        Pro: 'For Institutional Developers & Commercial RE',
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
    const { isAtrium } = useProduct();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const isVega = activeProduct === 'vega';
    const productMode: ProductMode = isVega ? 'legal' : 'property';
    const tiers = getDisplayTiersForProduct(productMode);
    const cycle = isVega ? billingCycle : 'annual';  // Atrium: always annual

    const dynamicPlans = DISPLAY_TIER_IDS.map((id: TierId) => {
        const tier = tiers[id as keyof typeof tiers];
        const { price, per } = formatTierPrice(tier, cycle);
        const tenantContribution =
            !isVega && tier.scePer || '';
        const description = TIER_DESCRIPTIONS[productMode][id];
        const features = tier.features.map((text) => ({
            text,
            note: (text.includes('ARIA') || text.includes('ALOA')) ? 'Growth+' : undefined,
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
    <section id="pricing" className="bg-white dark:bg-slate-950 min-h-[100dvh] pt-24 pb-24 px-6 transition-colors duration-500">
        <div className="container mx-auto max-w-7xl">
            {/* Header */}
            <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">
                    {isVega ? 'Transparent Pricing. Professional Grade.' : 'Institutional Property Management. Simplified.'}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-lg leading-relaxed mb-6">
                    {isVega ? 'Equip your firm with the tools to manage complex cases and scale efficiently.' : 'Frame your technology cost as a service benefit to your residents.'}
                </p>

                {/* Billing Toggle (VEGA Only — Atrium is annual-only) */}
                {isVega && (
                    <div className="flex items-center justify-center gap-4 mb-8">
                        <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Monthly</span>
                        <button 
                            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                            className="relative w-14 h-7 bg-slate-200 dark:bg-white/10 rounded-full transition-colors"
                        >
                            <div className={`absolute top-1 left-1 w-5 h-5 bg-white dark:bg-primary-500 rounded-full shadow-md transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-7' : ''}`} />
                        </button>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${billingCycle === 'annual' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Annual</span>
                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-2xs font-black uppercase rounded-full border border-emerald-200 dark:border-emerald-800">
                                Save 20%
                            </span>
                        </div>
                    </div>
                )}

                {!isVega && (
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm font-semibold border border-blue-200 dark:border-blue-800/50">
                        Billed Annually · SCE shown per unit
                    </span>
                )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8 items-stretch pb-12 max-w-5xl mx-auto">
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
                        <p className={`text-sm mb-6 ${plan.highlighted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>{plan.description}</p>

                        {/* Price */}
                        <div className="flex items-baseline gap-1 mb-2">
                            <span className={`text-4xl font-extrabold tracking-tight ${plan.highlighted ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'}`}>{plan.price}</span>
                            <span className={`text-sm ${plan.highlighted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>{plan.per}</span>
                        </div>

                        {/* Tenant Contribution Section (Atrium Only) */}
                        {!isVega && (
                            <div className={`mb-8 p-4 rounded-2xl border ${plan.highlighted ? 'bg-white/5 border-white/10 dark:bg-slate-50 dark:border-slate-200' : 'bg-slate-50 border-slate-100 dark:bg-white/5 dark:border-white/5'}`}>
                                <p className={`text-2xs font-black uppercase tracking-widest mb-1 ${plan.highlighted ? 'text-blue-400 dark:text-blue-600' : 'text-blue-600 dark:text-blue-400'}`}>Service Charge Equiv.</p>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-lg font-bold ${plan.highlighted ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'}`}>{plan.tenantContribution}</span>
                                    <span className={`text-2xs ${plan.highlighted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>/tenant</span>
                                </div>
                                <p className={`text-3xs mt-1 leading-tight ${plan.highlighted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>Cost benefit for the manager to pass on to the estate.</p>
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
            <div className="max-w-5xl mx-auto mt-10 mb-12 space-y-5">
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

export const LandingPage: React.FC<{ onDemo: (product: 'vega' | 'atrium') => void; initialProduct?: 'vega' | 'atrium' }> = ({ onDemo, initialProduct }) => {
    const { openModal, theme, setTheme } = useUI();
    const [activeSection, setActiveSection] = useState('home');
    // TASK 13: If the URL is /vega or /atrium, start with that product
    // pre-selected AND mark it as chosen (so "Get Started" goes straight
    // to the signup form for that product, not the product selection step).
    // On / (root), activeProduct defaults to 'vega' but productChosen is false
    // — so "Get Started Free" opens the signup with the product selection step.
    const [activeProduct, setActiveProduct] = useState<'vega' | 'atrium'>(initialProduct || 'vega');
    const [productChosen, setProductChosen] = useState(!!initialProduct);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [showCookiePolicy, setShowCookiePolicy] = useState(false);
    const [showResources, setShowResources] = useState(false);
    const [showDPA, setShowDPA] = useState(false);

    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const scrollRef = useRef<HTMLDivElement>(null);

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
        // TASK 13: Open the product-specific landing page in a NEW TAB.
        // The user wants the hub to stay open while the product page opens
        // separately. The URL reflects the product (/vega or /atrium) so
        // it's clear which product the user is viewing.
        //
        // We DON'T set activeProduct/productChosen here — the new tab will
        // initialize its own state from the URL via the initialProduct prop.
        window.open(`/${p}`, '_blank', 'noopener,noreferrer');
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
    const openSignup = (productOverride?: ProductMode) => {
        openModal('signup', null, {
            selectedProduct: productOverride || undefined,
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
            className="h-[100dvh] w-full overflow-y-auto bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-500 scroll-smooth"
            style={{ scrollbarGutter: 'stable' }}
        >
            <NavBar
                activeSection={activeSection}
                scrollTo={scrollTo}
                onLogin={() => openModal('login')}
                onSignup={openSignup}
                onDemo={() => onDemo(activeProduct)}
                onResources={() => setShowResources(true)}
                isDark={isDark}
                toggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
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
                    <HomeSection onSignup={openSignup} onDemo={() => onDemo(activeProduct)} activeProduct={activeProduct} setActiveProduct={handleProductSwitch} />
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

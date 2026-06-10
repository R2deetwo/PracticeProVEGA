
import React, { useState, useEffect, useRef } from 'react';
import {
    Logo, SunIcon, MoonIcon, CheckIcon, ZapIcon,
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
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border ${className}`}>
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
                        className="hidden md:flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary-500 transition-colors pl-3 border-l border-slate-200 dark:border-white/10"
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
                <PrimaryButton onClick={onSignup} className="!px-3 !py-1.5 !rounded-lg !text-[11px] ml-1 md:ml-2 md:!text-sm md:!px-5 md:!py-2.5 md:!rounded-xl">
                    Get Started Free
                </PrimaryButton>
            </div>
        </div>
    </header>
);

// ─── FOOTER ─────────────────────────────────────────────────────────────────

const Footer: React.FC<{ onPrivacyClick: () => void; onTermsClick: () => void; onCookieClick: () => void; onResources: () => void; onContactSales: () => void; activeProduct: 'vega' | 'atrium'; setActiveProduct: (p: 'vega' | 'atrium') => void; productChosen: boolean }> = ({ onPrivacyClick, onTermsClick, onCookieClick, onResources, onContactSales, activeProduct, setActiveProduct, productChosen }) => (
    <footer className="bg-slate-950 dark:bg-black border-t border-white/5 py-16">
        <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-10 mb-12">
                {/* Brand */}
                <div>
                    <div className="flex items-center gap-2.5 mb-4">
                        <Logo className="h-6 w-6 text-primary-500" aria-hidden="true" />
                        <span className="text-white font-bold text-lg flex items-center">
                            Practice<span className="text-primary-500">Pro</span>
                            {productChosen && (
                                <span
                                    className={`ml-2 text-[15px] font-black uppercase tracking-tight ${activeProduct === 'vega' ? 'text-amber-500' : 'text-emerald-500'}`}
                                >
                                    {activeProduct === 'vega' ? 'VEGA' : 'ATRIUM'}
                                </span>
                            )}
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-xs">Building systems for Nigerian Firms.</p>
                    {productChosen && (
                        <div className="mt-4 flex items-center gap-3">
                            <button
                                onClick={() => setActiveProduct(activeProduct === 'vega' ? 'atrium' : 'vega')}
                                className="text-[10px] font-bold uppercase tracking-widest text-primary-500 hover:text-primary-400 flex items-center gap-1.5 py-1 px-2 rounded-lg border border-primary-500/20 hover:bg-primary-500/5 transition-all"
                            >
                                Switch to {activeProduct === 'vega' ? 'Atrium' : 'Vega'} <span className="text-xs">→</span>
                            </button>
                        </div>
                    )}
                </div>
                {/* Product */}
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Product</p>
                    <div className="flex flex-col gap-2.5">
                        <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Features</button>
                        <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Pricing</button>
                        <button onClick={onResources} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Resources</button>
                        <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Changelog</button>
                    </div>
                </div>
                {/* Portals — only shown when a product is chosen; Vega→Client, Atrium→Tenant, Komplete→both */}
                {productChosen && (
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Portals</p>
                        <div className="flex flex-col gap-2.5">
                            {activeProduct === 'vega' && (
                                <a href="/portal/client/login" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Client Portal</a>
                            )}
                            {activeProduct === 'atrium' && (
                                <a href="/portal/tenant/login" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Tenant Portal</a>
                            )}
                        </div>
                    </div>
                )}
                {/* Company */}
                <div>
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
                <p className="text-xs text-slate-600">© {new Date().getFullYear()} PracticePro Tech Ltd. Lagos, Nigeria.</p>
                <p className="text-xs text-slate-700">ISO 27001 Aligned · NDPA 2023 Compliant · TLS Encrypted</p>
            </div>
        </div>
    </footer>
);

// ─── TRUST BADGES ─────────────────────────────────────────────────────────────

const BADGES = [
    { label: 'ISO 27001 Aligned', Icon: ShieldCheckIcon },
    { label: 'NDPA 2023 Compliant', Icon: ScalesIcon },
    { label: 'TLS 1.3 Encrypted', Icon: LockClosedIcon },
    { label: 'AES-256 at Rest', Icon: KeyIcon }
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
}> = ({ onPickProduct, onLogin }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { const t = setTimeout(() => setMounted(true), 40); return () => clearTimeout(t); }, []);

    return (
        <section className="relative overflow-hidden bg-slate-950 min-h-screen flex flex-col">
            {/* Ambient mesh */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full blur-[140px] bg-indigo-600/10" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full blur-[120px] bg-amber-500/5" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full blur-[120px] bg-emerald-500/5" />
                <div className="absolute inset-0 bg-[radial-gradient(circle,_#334155_1px,_transparent_1px)] [background-size:28px_28px] opacity-[0.08]" />
            </div>

            <div className={`relative z-10 flex-1 flex flex-col items-center justify-center pt-28 pb-20 px-6 text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

                {/* Corporate badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-10">
                    <Logo className="w-4 h-4 text-primary-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">PracticePro · Nigeria</span>
                </div>

                <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-bold text-white tracking-tight leading-[1.06] mb-6 max-w-5xl">
                    Professional Practice,
                    <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-violet-400 to-emerald-400">
                        Precisely Managed.
                    </span>
                </h1>

                <p className="text-lg md:text-xl text-slate-500 max-w-xl mx-auto mb-14 leading-[1.75]">
                    Select your professional discipline to enter your dedicated workspace.
                </p>

                {/* Audience routing cards */}
                <div className="grid md:grid-cols-2 gap-5 w-full max-w-3xl mx-auto mb-12">
                    {/* Vega */}
                    <button
                        onClick={() => onPickProduct('vega')}
                        className="group relative text-left p-7 md:p-8 rounded-3xl border border-white/[0.08] bg-white/[0.03] hover:bg-amber-500/[0.06] hover:border-amber-500/25 transition-all duration-300 hover:-translate-y-1.5 active:scale-[0.975] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                    >
                        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl bg-amber-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        <div className="relative z-10">
                            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
                                <ScalesIcon className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="flex items-center gap-2 mb-2.5">
                                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-500">Vega</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/[0.08] text-amber-500/70 border border-amber-500/15">Legal</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2.5">For Law Firms</h3>
                            <p className="text-sm text-slate-500 leading-[1.75]">
                                Case management, automated billing, and AI-assisted research — built for Nigerian legal practice.
                            </p>
                            <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-amber-500/70 group-hover:text-amber-400 group-hover:gap-2.5 transition-all duration-300">
                                Enter Vega <span aria-hidden="true">→</span>
                            </div>
                        </div>
                    </button>

                    {/* Atrium */}
                    <button
                        onClick={() => onPickProduct('atrium')}
                        className="group relative text-left p-7 md:p-8 rounded-3xl border border-white/[0.08] bg-white/[0.03] hover:bg-emerald-500/[0.06] hover:border-emerald-500/25 transition-all duration-300 hover:-translate-y-1.5 active:scale-[0.975] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    >
                        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl bg-emerald-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        <div className="relative z-10">
                            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
                                <OfficeBuildingIcon className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="flex items-center gap-2 mb-2.5">
                                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">Atrium</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/[0.08] text-emerald-500/70 border border-emerald-500/15">Property</span>
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
                    className="text-sm text-slate-600 hover:text-slate-400 transition-colors"
                >
                    Already have an account?{' '}
                    <span className="text-primary-400 font-semibold hover:text-primary-300">Sign in →</span>
                </button>

                {/* Compliance note — full trust strip lives in TrustBadgesStrip below */}
                <p className="text-[10px] text-slate-600 mt-12 tracking-wide">NDPA 2023 Compliant · TLS 1.3 · AES-256</p>
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
    const [mounted, setMounted] = useState(false);
    useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

    const isVega = activeProduct === 'vega';

    return (
        <section id="home" className={`relative overflow-hidden transition-colors duration-500 ${isVega ? 'bg-white dark:bg-slate-950' : 'bg-slate-950'}`}>
            {/* ── Mesh / Noise background ── */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Radial glow centred top */}
                <div className={`absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[120px] ${isVega ? 'bg-primary-400/10 dark:bg-primary-500/8' : 'bg-blue-500/15'}`} />
                {/* Dot grid */}
                <div className={`absolute inset-0 bg-[radial-gradient(circle,_#334155_1px,_transparent_1px)] [background-size:28px_28px] ${isVega ? 'opacity-[0.04] dark:opacity-[0.07]' : 'opacity-10'}`} />
            </div>

            {/* ── Hero Content ── */}
            <div className={`relative z-10 pt-36 pb-24 lg:pt-48 lg:pb-32 text-center px-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                {/* Headline */}
                <h1 className={`text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6 max-w-4xl mx-auto ${isVega ? 'text-slate-900 dark:text-white' : 'text-white'}`}>
                    {isVega ? <>Practice<br />Management</> : <>Revenue<br />Monitor</>}{' '}
                    <br className="hidden md:block" />
                    for{' '}
                    <span className="relative">
                        <span className={`text-transparent bg-clip-text bg-gradient-to-r ${isVega ? 'from-primary-500 via-emerald-500 to-teal-500' : 'from-blue-400 via-indigo-400 to-cyan-400'}`}>
                            {isVega ? 'Nigerian Law Firms' : 'Modern Portfolios'}
                        </span>
                    </span>
                </h1>

                {/* Sub-copy */}
                <p className={`text-lg max-w-2xl mx-auto mb-10 leading-[1.7] ${isVega ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400'}`}>
                    {isVega
                        ? 'Enterprise-grade case management, AI-assisted drafting, and automated billing — built from the ground up for Nigerian legal practice.'
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
                <div className={`grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden max-w-3xl mx-auto border shadow-sm ${isVega ? 'bg-slate-200 dark:bg-white/5 border-slate-200 dark:border-white/5' : 'bg-white/10 border-white/10'}`}>
                    {(isVega ? VEGA_STATS : ATRIUM_STATS).map((s, i) => (
                        <div key={i} className={`px-6 py-5 ${isVega ? 'bg-white dark:bg-slate-900' : 'bg-slate-900/80 backdrop-blur-md'}`}>
                            <p className={`text-2xl font-bold mb-0.5 ${isVega ? 'text-slate-900 dark:text-white' : 'text-white'}`}>{s.value}</p>
                            <p className={`text-xs leading-tight ${isVega ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400'}`}>{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom fade into next section */}
            <div className={`absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t to-transparent pointer-events-none ${isVega ? 'from-slate-50 dark:from-slate-950' : 'from-slate-950'}`} />
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
            { title: 'Client Portal', desc: 'Self-service portal for clients to view matter milestones, access documents, and submit KYC uploads. Available on Growth and Pro plans.', badge: 'Growth+' },
            { title: 'Contacts & Parties', desc: 'Structured contact management with party grouping, witness tracking, and counsel records. Link contacts to matters and documents automatically.' },
        ],
    },
    {
        category: 'Legal Drafting',
        Icon: SparklesIcon,
        items: [
            { title: 'DraftPro Editor', desc: 'Rich-text legal editor with true A4 pagination, Nigerian legal fonts, and court-compliant formatting. What you see is what prints — no reformatting required.' },
            { title: 'ALOA AI Copilot', desc: 'AI-powered drafting assistant built on Gemini, trained for Nigerian legal terminology, court rules, and document structures. Draft originating processes, affidavits, and conveyances with natural language instructions.', badge: 'Growth+' },
            { title: 'Document Vault', desc: 'Secure document storage linked to every matter. Version history, access controls, NDPA-compliant metadata, and full-text search across your firm\'s document library.' },
            { title: 'Research Studio', desc: 'Legal research workspace with jurisdiction-specific modules, statute lookup, and AI-assisted case analysis. Build research notebooks with source citations.', badge: 'Growth+' },
        ],
    },
    {
        category: 'Billing & Finance',
        Icon: DocumentIcon,
        items: [
            { title: 'Legal Billing', desc: 'Generate professional invoices with sequential numbering (INV-[Firm][Manager]-[Seq]). Track billable hours, apply court-aligned rates, and manage trust accounts.' },
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
            { title: 'Tenant Management', desc: 'Complete tenant profiles with KYC fields, lease agreements, and communication history. Manage tenant lifecycles from application through to departure.' },
            { title: 'Tenant Portal', desc: 'Self-service portal where tenants view SC/MV payment status, download rent receipts, and log maintenance tickets directly into your workflow. Available on Growth and Pro plans.', badge: 'Growth+' },
            { title: 'Revenue Monitor', desc: 'Real-time defaulter dashboard, rent collection tracking, and portfolio-level financial analytics. Know which tenants are overdue and which properties are underperforming.' },
        ],
    },
    {
        category: 'Rent & Collections',
        Icon: MattersIcon,
        items: [
            { title: 'Rent Collection', desc: 'Collect rent in Naira with payment reminders, receipt generation, and payment tracking. Generate invoices and track status at a glance.' },
            { title: 'Service Charge Tracking', desc: 'Itemized SC (Service Charge) and MV (Minimum Vend) tracking per unit. Monitor payment status, flag defaulters, and generate compliance-ready financial reports.' },
            { title: 'WhatsApp Automation', desc: 'Automated rent reminders and demand notices via WhatsApp. Tiered volume limits with morning notification throttles on Pro plans.', badge: 'Pro' },
            { title: 'Lease Management', desc: 'Lease expiry alerts and calendar integration. Send renewal notices and rent review communications. Never miss a critical date again.' },
        ],
    },
    {
        category: 'Maintenance & Operations',
        Icon: ShieldCheckIcon,
        items: [
            { title: 'Maintenance Tickets', desc: 'Tenants log issues directly into your workflow via the portal. Categorize by plumbing, electrical, structural, or other. Track status from open to resolved.' },
            { title: 'Expense Tracking', desc: 'Log maintenance costs, service charges, and utility bills per property. Track income vs. expenses with cash flow visualizations.' },
            { title: 'Legal Document Generation', desc: 'Pro plan includes automated generation of notices, demands, and other legal documents tailored to Nigerian property law.', badge: 'Pro' },
        ],
    },
];

const FeaturesSection: React.FC<{ activeProduct: 'vega' | 'atrium' }> = ({ activeProduct }) => {
    const isVega = activeProduct === 'vega';
    const categories = isVega ? VEGA_FEATURE_CATEGORIES : ATRIUM_FEATURE_CATEGORIES;

    return (
        <section id="features" className={`py-20 lg:py-28 transition-colors duration-500 ${isVega ? 'bg-slate-50 dark:bg-slate-900/40' : 'bg-slate-950'}`}>
            <div className="container mx-auto px-6 max-w-7xl">
                {/* Header */}
                <div className="text-center mb-16">
                    <Pill className={`mb-5 ${isVega ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-800/50' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                        {isVega ? 'Vega Features' : 'Atrium Features'}
                    </Pill>
                    <h2 className={`text-4xl md:text-5xl font-bold tracking-tight mb-4 ${isVega ? 'text-slate-900 dark:text-white' : 'text-white'}`}>
                        {isVega ? <>Case Management &<br />Legal Intelligence</> : <>Property Management &<br />Revenue Operations</>}
                    </h2>
                    <p className={`text-lg max-w-2xl mx-auto leading-relaxed ${isVega ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400'}`}>
                        {isVega
                            ? 'From intake to resolution, VEGA covers every stage of your legal practice — drafting, research, billing, and client collaboration.'
                            : 'From rent collection to defaulter management, Atrium covers every aspect of your property portfolio — tenants, maintenance, and financials.'}
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
                                            <span className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800/50">
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

const PricingSection: React.FC<{ onSignup: () => void; onContactSales: (source: string) => void; activeProduct: 'vega' | 'atrium' }> = ({ onSignup, onContactSales, activeProduct }) => {
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
            note: text.includes('ALOA') ? 'Growth+' : undefined,
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
    <section id="pricing" className="bg-white dark:bg-slate-950 min-h-screen pt-24 pb-24 px-6 transition-colors duration-500">
        <div className="container mx-auto max-w-7xl">
            {/* Header */}
            <div className="text-center mb-16">
                <Pill className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 mb-5">
                    {isVega ? 'Vega Plans' : 'Atrium Plans'}
                </Pill>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">
                    {isVega ? 'Transparent Pricing. Professional Grade.' : 'Institutional Property Management. Simplified.'}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-lg leading-relaxed mb-6">
                    {isVega ? 'Equip your firm with the tools to manage complex cases and scale efficiently.' : 'Frame your technology cost as a service benefit to your tenants.'}
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
                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase rounded-full border border-emerald-200 dark:border-emerald-800">
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
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-full shadow-xl z-20 whitespace-nowrap">
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
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${plan.highlighted ? 'text-blue-400 dark:text-blue-600' : 'text-blue-600 dark:text-blue-400'}`}>Service Charge Equiv.</p>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-lg font-bold ${plan.highlighted ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'}`}>{plan.tenantContribution}</span>
                                    <span className={`text-[10px] ${plan.highlighted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>/tenant</span>
                                </div>
                                <p className={`text-[9px] mt-1 leading-tight ${plan.highlighted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>Cost benefit for the manager to pass on to the estate.</p>
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
                                            <span className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                                {f.note}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        {/* CTA */}
                        <button 
                            onClick={plan.id === 'Enterprise' ? () => onContactSales('Enterprise Pricing CTA') : onSignup} 
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

            {/* Unified Suite Callout */}
            <div className="max-w-4xl mx-auto mt-8 mb-12 p-8 rounded-3xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 dark:border-indigo-500/10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                <div>
                    <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center justify-center sm:justify-start gap-2">
                        <SparklesIcon className="w-5 h-5 text-indigo-500" />
                        Need both Legal & Property tools?
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Get <strong className="text-indigo-600 dark:text-indigo-400">Komplete</strong> and manage your entire professional portfolio from a single unified workspace.
                    </p>
                </div>
                <button 
                    onClick={() => onContactSales('Komplete Callout')}
                    className="whitespace-nowrap px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                >
                    Contact Sales
                </button>
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

export const LandingPage: React.FC<{ onDemo: (product: 'vega' | 'atrium') => void }> = ({ onDemo }) => {
    const { openModal, theme, setTheme } = useUI();
    const [activeSection, setActiveSection] = useState('home');
    const [activeProduct, setActiveProduct] = useState<'vega' | 'atrium'>('vega');
    const [productChosen, setProductChosen] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [showCookiePolicy, setShowCookiePolicy] = useState(false);
    const [showResources, setShowResources] = useState(false);
    const [showDPA, setShowDPA] = useState(false);

    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const scrollRef = useRef<HTMLDivElement>(null);

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
        setActiveProduct(p);
        setProductChosen(true);
        scrollRef.current?.scrollTo({ top: 0 });
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

    const openSignup = () => openModal('signup', null, { selectedProduct: activeProduct });
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
            className="h-screen w-full overflow-y-auto bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-500 scroll-smooth"
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
                />
            ) : (
                <main key={activeProduct} className="animate-swap-in">
                    <HomeSection onSignup={openSignup} onDemo={() => onDemo(activeProduct)} activeProduct={activeProduct} setActiveProduct={handleProductSwitch} />
                    <FeaturesSection activeProduct={activeProduct} />
                    <TrustBadgesStrip />
                    <PricingSection onSignup={openSignup} onContactSales={openContactSales} activeProduct={activeProduct} />
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

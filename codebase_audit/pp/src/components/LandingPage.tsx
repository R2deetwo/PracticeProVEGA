
import React, { useState, useEffect, useRef } from 'react';
import {
    Logo, SunIcon, MoonIcon, CheckIcon, ZapIcon,
    ScalesIcon, ArchiveIcon, ShieldCheckIcon, DocumentIcon, MattersIcon, SparklesIcon,
    OfficeBuildingIcon, SearchIcon, ArrowLeftIcon, LockClosedIcon, KeyIcon
} from '../constants';
import { useUI } from '../contexts/UIContext';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import DataProcessingAgreement from './DataProcessingAgreement';
import ResourcesPage from './ResourcesPage';

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
}> = ({ activeSection, scrollTo, onLogin, onSignup, onDemo, onResources, isDark, toggleTheme, activeProduct, setActiveProduct }) => (
    <header className="fixed top-0 left-0 right-0 z-[250] transition-all duration-300">
        {/* Glass layer */}
        <div className="absolute inset-0 bg-white/75 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.06] transition-colors duration-500" />

        <div className="relative container mx-auto px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <button onClick={() => scrollTo('home')} className="flex items-center gap-2 group">
                <Logo className="h-7 w-7 text-primary-600 group-hover:scale-105 transition-transform drop-shadow-sm" />
                <span className="text-[19px] font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
                    Practice<span className="text-primary-600">Pro</span>
                </span>
            </button>

            {/* Desktop Links */}
            <nav className="hidden md:flex items-center gap-1">
                <div className="relative group">
                    <button className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-1 transition-all duration-200">
                        Products
                        <svg className="w-4 h-4 ml-0.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-[210px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1">
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

const Footer: React.FC<{ onPrivacyClick: () => void; onTermsClick: () => void; onResources: () => void; activeProduct: 'vega' | 'atrium'; setActiveProduct: (p: 'vega' | 'atrium') => void }> = ({ onPrivacyClick, onTermsClick, onResources, activeProduct, setActiveProduct }) => (
    <footer className="bg-slate-950 dark:bg-black border-t border-white/5 py-16">
        <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-10 mb-12">
                {/* Brand */}
                <div>
                    <div className="flex items-center gap-2.5 mb-4">
                        <Logo className="h-6 w-6 text-primary-500" aria-hidden="true" />
                        <span className="text-white font-bold text-lg flex items-center">
                            Practice<span className="text-primary-500">Pro</span>
                            <span 
                                className={`ml-2 text-[15px] font-black uppercase tracking-tight ${activeProduct === 'vega' ? 'text-amber-500' : 'text-emerald-500'}`}
                            >
                                {activeProduct === 'vega' ? 'VEGA' : 'ATRIUM'}
                            </span>
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-xs">Building systems for Nigerian Firms.</p>
                    <div className="mt-4 flex items-center gap-3">
                        <button 
                            onClick={() => setActiveProduct(activeProduct === 'vega' ? 'atrium' : 'vega')}
                            className="text-[10px] font-bold uppercase tracking-widest text-primary-500 hover:text-primary-400 flex items-center gap-1.5 py-1 px-2 rounded-lg border border-primary-500/20 hover:bg-primary-500/5 transition-all"
                        >
                            Switch to {activeProduct === 'vega' ? 'Atrium' : 'Vega'} <span className="text-xs">→</span>
                        </button>
                    </div>
                </div>
                {/* Product */}
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Product</p>
                    <div className="flex flex-col gap-2.5">
                        <button className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Features</button>
                        <button className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Pricing</button>
                        <button onClick={onResources} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Resources</button>
                        <button className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Changelog</button>
                    </div>
                </div>
                {/* Company */}
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Company</p>
                    <div className="flex flex-col gap-2.5">
                        <span onClick={onPrivacyClick} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Privacy Policy</span>
                        <span onClick={onTermsClick} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Terms of Service</span>
                        <span className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Contact</span>
                        <span onClick={onResources} className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer transition-colors">Security</span>
                    </div>
                </div>
            </div>
            <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-600">© {new Date().getFullYear()} PracticePro Tech Ltd. Lagos, Nigeria.</p>
                <p className="text-xs text-slate-700">Convex Infrastructure · NDPA 2023 Compliant · AES-256 at Rest</p>
            </div>
        </div>
    </footer>
);

// ─── TRUST BADGES ─────────────────────────────────────────────────────────────

const BADGES = [
    { label: 'Convex Infrastructure', Icon: ShieldCheckIcon },
    { label: 'NDPA 2023 Compliant', Icon: ScalesIcon },
    { label: 'TLS Encrypted', Icon: LockClosedIcon },
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

// ─── HOME / HERO ─────────────────────────────────────────────────────────────

const VEGA_STATS = [
    { value: 'NDPA', label: '2023 Compliant' },
    { value: 'Convex', label: 'Real-time Backend' },
    { value: 'AES-256', label: 'Encrypted at Rest' },
    { value: 'ALOA', label: 'AI Copilot Built In' },
];

const ATRIUM_STATS = [
    { value: '₦ Naira', label: 'Native Billing' },
    { value: 'WhatsApp', label: 'Reminders & Automation' },
    { value: 'Convex', label: 'Real-time Backend' },
    { value: 'NDPA', label: '2023 Compliant' },
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
                        ? 'The operating system for Nigerian law firms. Manage cases, draft documents, and automate billing — all from one high-performance platform.'
                        : 'The revenue monitor for modern portfolios. Centralize rent collection, tenant management, and maintenance workflows in one seamless platform.'}
                </p>

                {/* CTAs */}
                <div className="flex gap-4 justify-center items-center mb-16">
                    <PrimaryButton onClick={onSignup} className="text-base px-8 py-4 shadow-xl shadow-primary-500/30">
                        Start Free Trial
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

// ─── FEATURES / BENTO GRID ────────────────────────────────────────────────

interface BentoCardProps {
    icon: React.ReactNode;
    title: string;
    desc: string;
    accent: string;
    span?: string;
    badge?: string;
}

const BentoCard: React.FC<BentoCardProps> = ({ icon, title, desc, accent, span = '', badge }) => (
    <div className={`group relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/[0.06] p-8 flex flex-col gap-5 overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/60 dark:hover:shadow-black/40 transition-all duration-500 cursor-default ${span}`}>
        {/* Subtle gradient corner */}
        <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl ${accent}`} />

        {/* Icon */}
        <div className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center ${accent} bg-opacity-10`}>
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-6 h-6' })}
        </div>

        {/* Text */}
        <div className="relative z-10 flex-1">
            <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{title}</h3>
                {badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
                        {badge}
                    </span>
                )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-[1.7]">{desc}</p>
        </div>
    </div>
);

const FeaturesSection: React.FC<{ activeProduct: 'vega' | 'atrium' }> = ({ activeProduct }) => {
    const isVega = activeProduct === 'vega';
    return (
    <section id="features" className="bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-500">
        <div className="container mx-auto px-6 py-24">
            {/* Section header */}
            <div className="text-center mb-16">
                <Pill className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 mb-5">
                    Everything You Need
                </Pill>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight mb-4 leading-tight">
                    {isVega 
                        ? <>Procedural Precision for<br className="hidden sm:block" /> Modern Nigerian Firms</>
                        : <>Intelligent Control for<br className="hidden sm:block" /> Modern Property Portfolios</>
                    }
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
                    {isVega 
                        ? 'From intake to invoice, PracticePro handles the complexity of Nigerian legal practice.'
                        : 'From tenant management to rent collection, PracticePro simplifies property management.'}
                </p>
            </div>

            {/* Bento grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                {isVega ? (
                    <>
                        <BentoCard
                            icon={<MattersIcon />}
                            title="Case Management"
                            desc="Visualize your entire caseload with Kanban boards tailored for Litigation and Corporate practice. Track deadlines and hearings in one place."
                            accent="bg-green-500 text-green-600 dark:text-green-400"
                            span="lg:col-span-2"
                        />
                        <BentoCard
                            icon={<ZapIcon />}
                            title="ALOA® AI Copilot"
                            desc="Your strategic AI partner. Analyze contracts, draft motions, and research strategy — it understands your case files."
                            accent="bg-purple-500 text-purple-600 dark:text-purple-400"
                            badge="New"
                        />
                        <BentoCard
                            icon={<ScalesIcon />}
                            title="Procedural Intelligence"
                            desc="Nigerian court rules and procedural requirements indexed by jurisdiction. AI-powered jurisdiction validation for Lagos, FHC, NIC, and more."
                            accent="bg-amber-500 text-amber-600 dark:text-amber-400"
                        />
                        <BentoCard
                            icon={<DocumentIcon />}
                            title="Jurisdiction Intake"
                            desc="Validate court jurisdiction and applicable rules during matter creation. Seamlessly transition into the drafting workspace with all metadata pre-populated."
                            accent="bg-blue-500 text-blue-600 dark:text-blue-400"
                        />
                    </>
                ) : (
                    <>
                        <BentoCard
                            icon={<OfficeBuildingIcon />}
                            title="Portfolio Dashboard"
                            desc="Get a bird's-eye view of your entire real estate portfolio, occupancy rates, and revenue metrics."
                            accent="bg-emerald-500 text-emerald-600 dark:text-emerald-400"
                            span="lg:col-span-2"
                        />
                        <BentoCard
                            icon={<ScalesIcon />}
                            title="Rent Collection"
                            desc="Track payments, generate invoices and receipts, and send payment reminders via WhatsApp. Keep your financials organized."
                            accent="bg-blue-500 text-blue-600 dark:text-blue-400"
                        />
                        <BentoCard
                            icon={<DocumentIcon />}
                            title="Lease Management"
                            desc="Track expiration dates, send renewal notices, and manage rent reviews. Never miss a critical lease date."
                            accent="bg-purple-500 text-purple-600 dark:text-purple-400"
                        />
                        <BentoCard
                            icon={<ZapIcon />}
                            title="Maintenance & Service Charges"
                            desc="Log maintenance records, track service charges, and manage utility costs across your portfolio."
                            accent="bg-amber-500 text-amber-600 dark:text-amber-400"
                        />
                    </>
                )}
                <BentoCard
                    icon={<ShieldCheckIcon />}
                    title="Secure & NDPA Compliant"
                    desc="Convex-hosted encryption (AES-256 at rest, TLS in transit) with role-based access control. Associates only see what they need to see."
                    accent="bg-red-500 text-red-600 dark:text-red-400"
                />
            </div>

            {/* Atrium: Document Generation for Legal Notices — shown for Atrium only */}
            {!isVega && (
            <div className="mt-8 bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-white/[0.06] shadow-sm">
                <div className="flex flex-col lg:flex-row">
                    <div className="p-10 lg:p-14 lg:w-1/2 flex flex-col justify-center gap-6">
                        <div>
                            <Pill className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50 mb-5">
                                <DocumentIcon className="w-3 h-3" />
                                Legal Document Generation
                            </Pill>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 leading-tight">
                                Generate Legal Notices<br />from Atrium
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                                Draft quit notices, rent review letters, and tenancy agreements directly from property records. All pre-populated with tenant and property data.
                            </p>
                        </div>
                    </div>
                    <div className="lg:w-1/2 bg-slate-100 dark:bg-slate-800/50 p-10 flex items-center justify-center">
                        <div className="w-full max-w-xs space-y-3">
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center gap-3 shadow-sm">
                                <DocumentIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Quit Notice</span>
                                <span className="ml-auto text-[10px] text-slate-400">Auto-populated</span>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center gap-3 shadow-sm">
                                <DocumentIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Rent Review Letter</span>
                                <span className="ml-auto text-[10px] text-slate-400">Template-ready</span>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center gap-3 shadow-sm">
                                <DocumentIcon className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tenancy Agreement</span>
                                <span className="ml-auto text-[10px] text-slate-400">Draft from record</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}
        </div>
    </section>
    );
};

// ─── PRICING ──────────────────────────────────────────────────────────────

interface PlanConfig {
    name: string;
    price: string;
    per: string;
    description: string;
    features: { text: string; note?: string; muted?: boolean }[];
    cta: string;
    fineprint?: string;
    highlighted?: boolean;
    ctaVariant?: 'primary' | 'ghost' | 'dark';
    tenantContribution?: string;
}

const PLANS: PlanConfig[] = [
    {
        name: 'Core',
        price: 'Free',
        per: '',
        description: 'Perfect for small portfolios or private landlords.',
        ctaVariant: 'ghost',
        cta: 'Start Free',
        features: [
            { text: '1 User Account' },
            { text: 'Up to 15 Units' },
            { text: 'Up to 20 Tenants' },
            { text: '100 WhatsApp Reminders/mo' },
            { text: 'Revenue Ledger' },
        ],
        tenantContribution: '₦1,056/mo',
    },
    {
        name: 'Growth',
        price: '₦360,000',
        per: '/yr',
        description: 'Scalable efficiency for growing agencies.',
        ctaVariant: 'primary',
        cta: 'Start Growth',
        features: [
            { text: 'Up to 3 Users' },
            { text: 'Up to 35 Units' },
            { text: 'Up to 50 Tenants' },
            { text: '500 WhatsApp Reminders/mo' },
            { text: 'Service Charge Tracking' },
        ],
        tenantContribution: '₦857/mo',
    },
    {
        name: 'Pro',
        price: '₦840,000',
        per: '/yr',
        description: 'The complete Revenue Monitor.',
        highlighted: true,
        ctaVariant: 'primary',
        cta: 'Start Pro Trial',
        features: [
            { text: 'Up to 10 Users' },
            { text: 'Up to 100 Units' },
            { text: 'Up to 200 Tenants' },
            { text: 'Unlimited WhatsApp Reminders' },
            { text: 'Legal Document Generation' },
            { text: 'Tenant Scoring & Pipeline' },
        ],
        tenantContribution: '₦700/mo',
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        per: 'contact us',
        description: 'Advanced controls for large scale estates.',
        ctaVariant: 'ghost',
        cta: 'Contact Sales',
        features: [
            { text: 'Unlimited Users' },
            { text: 'Unlimited Units & Tenants' },
            { text: '₦150k One-Time Setup Fee', note: 'Required' },
            { text: 'Audit Logs & Role-Based Access' },
            { text: 'Dedicated Account Manager' },
        ],
    },
];

const PricingSection: React.FC<{ onSignup: () => void; activeProduct: 'vega' | 'atrium' }> = ({ onSignup, activeProduct }) => {
    const isVega = activeProduct === 'vega';
    
    // Dynamically adjust data for Vega vs Atrium
    const dynamicPlans = PLANS.map(p => {
        let name = p.name;
        let price = p.price;
        let per = p.per;
        let tenantContribution = p.tenantContribution || '';
        let features = [...p.features];
        let description = p.description;

        if (isVega) {
            // Vega Pricing (Legal)
            if (p.name === 'Core') {
                price = 'Free';
                description = 'Perfect for solo practitioners or small legal teams.';
                features = [
                    { text: '1 User Account' },
                    { text: '10 Active Matters' },
                    { text: 'Unlimited Data & Records' },
                    { text: 'Basic Case Management' },
                    { text: 'Procedural Intelligence' },
                ];
            }
            if (p.name === 'Growth') {
                price = '₦45,000';
                per = '/mo';
                description = 'Scalable efficiency for growing law firms.';
                features = [
                    { text: 'Up to 3 Users' },
                    { text: '50 Active Matters' },
                    { text: 'Unlimited Data & Records' },
                    { text: 'Client Communication' },
                    { text: 'Advanced Legal Billing' },
                ];
            }
            if (p.name === 'Pro') {
                price = '₦80,000';
                per = '/mo';
                description = 'The complete legal operating system.';
                features = [
                    { text: 'Up to 10 Users' },
                    { text: 'Unlimited Matters' },
                    { text: 'Unlimited Data & Records' },
                    { text: 'ALOA® AI Copilot', note: 'Exclusive' },
                    { text: 'Enterprise Jurisdiction Intake' },
                ];
            }
        } else {
            // Atrium Pricing (Property) — ANNUAL ONLY
            // SCE (Service Charge Equivalent) is the only per-month figure shown.
            // It is a framing device (annual ÷ 12 ÷ units), NOT a payment option.
            if (p.name === 'Core') {
                name = 'Starter';
                price = '₦190,000';
                per = '/yr';
                description = 'Perfect for small portfolios or private landlords.';
                features = [
                    { text: '1 User Account' },
                    { text: 'Up to 15 Units' },
                    { text: 'Up to 20 Tenants' },
                    { text: '100 WhatsApp Reminders/mo' },
                    { text: 'Revenue Ledger' },
                ];
                tenantContribution = '₦1,056/mo';
            }
            if (p.name === 'Growth') {
                price = '₦360,000';
                per = '/yr';
                description = 'Scalable efficiency for growing agencies.';
                features = [
                    { text: 'Up to 3 Users' },
                    { text: 'Up to 35 Units' },
                    { text: 'Up to 50 Tenants' },
                    { text: '500 WhatsApp Reminders/mo' },
                    { text: 'Service Charge Tracking' },
                ];
                tenantContribution = '₦857/mo';
            }
            if (p.name === 'Pro') {
                price = '₦840,000';
                per = '/yr';
                description = 'The complete Revenue Monitor.';
                features = [
                    { text: 'Up to 10 Users' },
                    { text: 'Up to 100 Units' },
                    { text: 'Up to 200 Tenants' },
                    { text: 'Unlimited WhatsApp Reminders' },
                    { text: 'Legal Document Generation' },
                    { text: 'Tenant Scoring & Pipeline' },
                ];
                tenantContribution = '₦700/mo';
            }
            if (p.name === 'Enterprise') {
                features = [
                    { text: 'Unlimited Users' },
                    { text: 'Unlimited Units & Tenants' },
                    { text: '₦150k One-Time Setup Fee', note: 'Required' },
                    { text: 'Audit Logs & Role-Based Access' },
                    { text: 'Dedicated Account Manager' },
                ];
            }
        }

        return { ...p, name, price, per, tenantContribution, features, description };
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
                    {isVega ? 'Transparent Pricing. Professional Grade.' : 'Strictly Annual. Professionally Managed.'}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-lg leading-relaxed mb-6">
                    {isVega ? 'Equip your firm with the tools to manage complex cases and scale efficiently.' : 'Frame your technology cost as a service benefit to your tenants.'}
                </p>

                {/* Atrium: Annual-only badge */}
                {!isVega && (
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold border border-emerald-200 dark:border-emerald-800/50">
                        Billed Annually · SCE shown per unit
                    </span>
                )}

                {isVega && (
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold border border-emerald-200 dark:border-emerald-800/50">
                        Billed Monthly
                    </span>
                )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8 items-stretch pb-12 max-w-7xl mx-auto">
                {dynamicPlans.map((plan) => (
                    <div
                        key={plan.name}
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
                                    <span className={`text-[10px] ${plan.highlighted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>/unit</span>
                                </div>
                                <p className={`text-[9px] mt-1 leading-tight ${plan.highlighted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>Annual cost broken down per unit per month. Passable to tenants as a service charge.</p>
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
                            onClick={onSignup} 
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
                    onClick={onSignup}
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
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
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

    const handleProductSwitch = (p: 'vega' | 'atrium') => {
        setActiveProduct(p);
        const pricingEl = document.getElementById('pricing');
        if (pricingEl && scrollRef.current) {
            const scrollPos = scrollRef.current.scrollTop + 100;
            // If they are past the features section (near pricing), snap them to pricing smoothly
            if (scrollPos >= pricingEl.offsetTop - 300) {
                setTimeout(() => {
                    scrollRef.current?.scrollTo({ top: pricingEl.offsetTop - 64, behavior: 'smooth' });
                }, 50);
            }
        }
    };

    if (showPrivacy) return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />;
    if (showTerms) return <TermsOfService onBack={() => setShowTerms(false)} activeProduct={activeProduct} />;
    if (showDPA) return <DataProcessingAgreement onBack={() => setShowDPA(false)} />;
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
                onSignup={() => openModal('signup', null, { selectedProduct: activeProduct })}
                onDemo={() => onDemo(activeProduct)}
                onResources={() => setShowResources(true)}
                isDark={isDark}
                toggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
                activeProduct={activeProduct}
                setActiveProduct={handleProductSwitch}
            />

            <main key={activeProduct} className="animate-swap-in">
                <HomeSection onSignup={() => openModal('signup', null, { selectedProduct: activeProduct })} onDemo={() => onDemo(activeProduct)} activeProduct={activeProduct} setActiveProduct={handleProductSwitch} />
                <TrustBadgesStrip />
                <FeaturesSection activeProduct={activeProduct} />
                <PricingSection onSignup={() => openModal('signup', null, { selectedProduct: activeProduct })} activeProduct={activeProduct} />
            </main>

            <Footer
                onPrivacyClick={() => setShowPrivacy(true)}
                onTermsClick={() => setShowTerms(true)}
                onResources={() => setShowResources(true)}
                activeProduct={activeProduct}
                setActiveProduct={handleProductSwitch}

            />
        </div>
    );
}

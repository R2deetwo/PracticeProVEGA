import React from 'react';
import { ArrowLeftIcon, ExternalLinkIcon } from '../../constants';
import { VegaMark, AtriumMark } from '../../components/marketing/brand/ProductMarks';
import { PrimaryButton } from '../shared/ctas';
import { vegaSiteConfig } from './siteConfig';

/**
 * VegaShell — /vega's chrome (P0 split). A copy of the shared
 * NavBar/Footer/MobileStickyCTA/WhatsAppFAB from LandingPage.tsx with
 * every branch resolved to the VEGA surface (productChosen=true,
 * activeProduct='vega', onVega=true — the Night Chambers register: night
 * glass, parchment type, gilt accents). No activeProduct ternaries remain.
 */

const navLinkCls = 'text-slate-300 hover:text-white hover:bg-white/5';
const navLinkActiveCls = 'text-vega-gilt-bright';
const menuItemCls = 'text-slate-300 hover:bg-white/5 hover:text-white';
const vegaItemCls = 'bg-white/10 text-vega-gilt-bright';
const atriumItemCls = 'text-slate-300 hover:bg-white/5 hover:text-white';

export const VegaNavBar: React.FC<{
    activeSection: string;
    scrollTo: (id: string) => void;
    onLogin: () => void;
    onSignup: () => void;
    onResources: () => void;
    onContactSales: () => void;
    onOpenProduct: (p: 'vega' | 'atrium') => void;
    onBackToHub: () => void;
}> = ({ activeSection, scrollTo, onLogin, onSignup, onResources, onContactSales, onOpenProduct, onBackToHub }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    // Products dropdown — click-toggle (not hover) so iPad/tablet touch users
    // can open it. Outside-pointer closes, Escape closes, choosing closes.
    const [productsOpen, setProductsOpen] = React.useState(false);
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

    // W8: the fluid nav — a single pill that morphs between the section links.
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
    }, [activeSection, productsOpen, mobileMenuOpen]);

    const handleNavClick = (fn: () => void) => {
        setMobileMenuOpen(false);
        fn();
    };

    return (
    <header className="fixed top-0 left-0 right-0 z-[250] transition-all duration-300 pt-safe">
        {/* Glass layer — night glass on /vega (R22 The Night Chambers) */}
        <div className="absolute inset-0 backdrop-blur-xl border-b transition-colors duration-500 bg-vega-night/85 border-white/10" />

        <div className="relative container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Product lockup + back-to-hub breadcrumb */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onBackToHub}
                    aria-label="Vega — a PracticePro product, back to all products"
                    className="flex items-center gap-2.5 group"
                >
                    <VegaMark className="h-8 w-8 group-hover:scale-105 transition-transform" />
                    <span className="flex flex-col items-start leading-none">
                        <span className="text-lg font-bold tracking-tight font-vega text-vega-parchment">
                            Vega
                        </span>
                    </span>
                </button>
                <button
                    onClick={onBackToHub}
                    className="hidden md:flex items-center gap-1 pl-3 border-l h-7 text-xs font-black uppercase tracking-widest transition-colors border-white/15 text-slate-300 hover:text-vega-gilt-bright"
                    aria-label="Back to all products"
                >
                    <ArrowLeftIcon className="w-3 h-3" />
                    <span>All Products</span>
                </button>
            </div>

            {/* Desktop Links — shown on lg+ (1024px+). */}
            <nav ref={navRef} className="hidden lg:flex items-center gap-1 relative" aria-label="Main navigation">
                <div ref={pillRef} className="w8-nav-pill" aria-hidden="true" />
                {/* Products dropdown — click-toggle. */}
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
                            <div className="border rounded-lg shadow-xl flex flex-col p-1 bg-vega-night-2 border-white/10">
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
                <button
                    onClick={() => scrollTo('suite')}
                    data-nav-id="suite"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeSection === 'suite'
                            ? navLinkActiveCls
                            : navLinkCls
                    }`}
                >
                    The Suite
                </button>
                <button
                    onClick={() => scrollTo('practice-areas')}
                    data-nav-id="practice-areas"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeSection === 'practice-areas'
                            ? navLinkActiveCls
                            : navLinkCls
                    }`}
                >
                    Practice Areas
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

            {/* Right Actions — Log In / Start Free Trial on product pages. */}
            <div className="flex items-center gap-2">
                <div className="hidden lg:block h-4 w-px mx-1 bg-white/15" />
                <button
                    onClick={onLogin}
                    className="hidden lg:block px-4 py-2 text-sm font-semibold transition-colors text-slate-300 hover:text-vega-gilt-bright"
                >
                    Log In
                </button>
                {/* TASK 54: invoke with NO arguments — passing the handler
                    directly leaked the click event into openSignup's
                    productOverride. */}
                <PrimaryButton
                    onClick={() => onSignup()}
                    tone="vega"
                    className="!px-3 !py-2 sm:!px-3 sm:!py-1.5 !rounded-sm !text-xs sm:!text-2xs ml-1 lg:ml-2 lg:!text-sm lg:!px-5 lg:!py-2.5 lg:!rounded-sm"
                >
                    Start Free Trial
                </PrimaryButton>

                {/* Mobile hamburger button — shown below lg (1024px). */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-slate-300 hover:bg-white/5"
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

        {/* Mobile overlay menu — shown below lg (1024px). */}
        {mobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 top-[calc(4rem+env(safe-area-inset-top,0px))] z-[240] overflow-y-auto bg-vega-night">
                <nav className="container mx-auto px-4 py-6 flex flex-col gap-1" aria-label="Mobile navigation">
                    {/* Back-to-hub affordance — mobile users need a way back. */}
                    <button
                        onClick={() => handleNavClick(onBackToHub)}
                        className={`w-full text-left px-4 py-3 mb-2 rounded-lg text-sm font-semibold flex items-center gap-3 ${menuItemCls}`}
                    >
                        <ArrowLeftIcon className="w-5 h-5 opacity-70" /> All Products
                    </button>
                    <div className="mb-2">
                        <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 px-4 py-2">Products</p>
                        <button onClick={() => handleNavClick(() => onOpenProduct('vega'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-3 ${vegaItemCls}`}>
                            <VegaMark className="w-5 h-5" /> Vega — For Law Firms <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                        </button>
                        <button onClick={() => handleNavClick(() => onOpenProduct('atrium'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-3 ${atriumItemCls}`}>
                            <AtriumMark className="w-5 h-5" /> Atrium — For Property Managers <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                        </button>
                    </div>
                    <button onClick={() => handleNavClick(() => scrollTo('suite'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold ${menuItemCls}`}>The Suite</button>
                    <button onClick={() => handleNavClick(() => scrollTo('practice-areas'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold ${menuItemCls}`}>Practice Areas</button>
                    <button onClick={() => handleNavClick(() => scrollTo('howItWorks'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold ${menuItemCls}`}>How It Works</button>
                    <button onClick={() => handleNavClick(onResources)} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold ${menuItemCls}`}>Resources</button>
                    <button onClick={() => handleNavClick(onContactSales)} className={`w-full text-left px-4 py-3 rounded-sm text-sm font-semibold ${menuItemCls}`}>Contact</button>
                    <div className="h-px my-3 bg-white/10" />
                    <button onClick={() => handleNavClick(onLogin)} className={`w-full text-left px-4 py-3 rounded-sm text-sm font-semibold ${menuItemCls}`}>Log In</button>
                    <PrimaryButton onClick={() => handleNavClick(onSignup)} className="!w-full !py-3 !rounded-sm !text-sm mt-2">
                        Start Free Trial
                    </PrimaryButton>
                    <p className="text-2xs text-slate-400 text-center mt-4">No credit card required · 30-day free trial</p>
                </nav>
            </div>
        )}
    </header>
    );
};

export const VegaFooter: React.FC<{
    onPrivacyClick: () => void;
    onTermsClick: () => void;
    onCookieClick: () => void;
    onUsageClick: () => void;
    onResources: () => void;
    onContactSales: () => void;
    onOpenProduct: (p: 'vega' | 'atrium') => void;
}> = ({ onPrivacyClick, onTermsClick, onCookieClick, onUsageClick, onResources, onContactSales, onOpenProduct }) => (
    <footer className="bg-slate-950 border-t border-white/5 py-10 md:py-16 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-16">
        <div className="container mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-10 mb-12">
                {/* Brand — the product's own mark; the company as attribution. */}
                <div>
                    <div className="flex items-center gap-2.5 mb-4">
                        <VegaMark className="h-7 w-7" />
                        <span className="flex flex-col leading-none">
                            <span className="text-white font-bold text-lg font-vega">
                                Vega
                            </span>
                            <span className="font-mono text-2xs tracking-[0.18em] text-slate-400 mt-1">BY PRACTICEPRO</span>
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-xs">We design, build and run the systems businesses manage their affairs with — our products Vega and Atrium, and custom commissions for clients. From Lagos, for businesses anywhere.</p>
                    <div className="mt-4 flex items-center gap-3">
                        <button
                            onClick={() => onOpenProduct('atrium')}
                            className="text-2xs font-bold uppercase tracking-widest flex items-center gap-1.5 py-1 px-2 rounded-lg border transition-all text-vega-claret hover:text-vega-claret/80 border-vega-claret/30 hover:bg-vega-claret/10"
                        >
                            Open Atrium <span className="text-xs">↗</span>
                        </button>
                    </div>
                </div>
                {/* Product */}
                <div>
                    <p className="font-mono text-slate-400 text-xs font-medium uppercase tracking-widest mb-4">Product</p>
                    <div className="flex flex-col gap-2.5">
                        <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Features</button>
                        <button onClick={onResources} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Resources</button>
                        {/* ROUND 9: Changelog routes to the Resources page. */}
                        <button onClick={onResources} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors">Changelog</button>
                    </div>
                </div>
                {/* Portals */}
                <div>
                    <p className="font-mono text-slate-400 text-xs font-medium uppercase tracking-widest mb-4">Portals</p>
                    <div className="flex flex-col gap-2.5">
                        <a href={vegaSiteConfig.portal.client} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Client Portal</a>
                    </div>
                </div>
                {/* Company */}
                <div>
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
                <p className="text-xs text-slate-500 order-last md:order-none">Vega &amp; Atrium · Built by PracticePro</p>
                <p className="text-xs text-slate-500">NDPA 2023 Compliant · TLS 1.3 Encrypted · *Encryption provided by infrastructure</p>
            </div>
        </div>
    </footer>
);

/** Mobile sticky bottom CTA — the night bar with brass primary. */
export const VegaMobileStickyCTA: React.FC<{ onSignup: () => void; onContactSales: () => void }> = ({ onSignup, onContactSales }) => (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-[210] backdrop-blur-md border-t px-4 py-3 flex gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] bg-vega-night/95 border-white/10">
        <button
            onClick={onContactSales}
            className="flex-1 py-3 rounded-lg border text-sm font-semibold transition-colors border-white/20 text-slate-200 hover:bg-white/5 active:bg-white/10"
        >
            Talk to Sales
        </button>
        {/* TASK 54: no-arg invocation — never leak the click event into the
            product override. Vega's primary is brass on the night page. */}
        <button
            onClick={() => onSignup()}
            className="flex-[1.5] py-3 rounded-lg text-sm font-semibold transition-colors bg-vega-gilt text-vega-night hover:bg-vega-gilt-bright active:bg-vega-gilt-bright"
        >
            Start Free Trial
        </button>
    </div>
);

/** Chat FAB — the gilt tile of the Night Chambers. */
export const VegaChatFab: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => (
    <button
        onClick={onContactSales}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[220] w-12 h-12 md:w-14 md:h-14 rounded-none border flex items-center justify-center hover:scale-105 active:scale-95 transition-transform bg-vega-night border-vega-gilt"
        aria-label="Chat with us — Contact Sales"
        title="Chat with us"
    >
        <svg className="w-7 h-7 text-vega-gilt" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
    </button>
);

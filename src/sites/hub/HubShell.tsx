import React from 'react';
import { Logo, ExternalLinkIcon } from '../../constants';
import { VegaMark, AtriumMark } from '../../components/marketing/brand/ProductMarks';

/**
 * HubShell — the W18-era hub chrome, restored (P1's systems-studio chrome
 * retired with the P1 redesign).
 *
 * Nav: light glass bar, the W8 fluid pill morphing between the corporate
 *      sections, the Products dropdown (opens each product's own page in a
 *      new tab — R21 routing keep) and a quiet "Talk to us" on the right.
 * Footer: the dark slate-950 colophon, hub columns.
 * FAB: the emerald chat bubble (opens the Contact Sales drawer).
 *
 * No MobileStickyCTA on the hub (as in the era — the hero CTAs + FAB carry
 * mobile conversion). Auth lives with the products, not the company page.
 */

const NAV_SECTIONS: { label: string; id: string }[] = [
    { label: 'What We Do', id: 'whatWeDo' },
    { label: 'Our Work', id: 'ourWork' },
    { label: 'How We Work', id: 'howWeWork' },
    { label: 'About', id: 'about' },
];

export const HubNavBar: React.FC<{
    activeSection: string;
    scrollTo: (id: string) => void;
    onResources: () => void;
    onContactSales: () => void;
    onOpenProduct: (p: 'vega' | 'atrium') => void;
}> = ({ activeSection, scrollTo, onResources, onContactSales, onOpenProduct }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    // Click-toggle dropdown (not hover) so iPad/tablet touch users can open
    // it. Outside-pointer closes, Escape closes, choosing closes — the
    // robust W14 pattern (the old onBlur+setTimeout was fragile).
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

    // The fluid pill morphs to whichever section link is active. Decorative;
    // the buttons themselves sit above it.
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
        {/* Glass layer — always light on the hub */}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 transition-colors duration-500" />

        <div className="relative container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Logo — on the hub it scrolls home. */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => scrollTo('home')}
                    aria-label="PracticePro Systems — home"
                    className="flex items-center gap-2 group"
                >
                    <Logo className="h-7 w-7 text-primary-500 group-hover:scale-105 active:scale-[0.98] transition-transform duration-150 drop-shadow-sm" />
                    <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center">
                        Practice<span className="text-primary-500">Pro</span>
                    </span>
                </button>
            </div>

            {/* Desktop links — lg+ (iPad portrait uses the mobile menu). */}
            <nav ref={navRef} className="hidden lg:flex items-center gap-1 relative" aria-label="Main navigation">
                {/* W8: the fluid pill */}
                <div ref={pillRef} className="w8-nav-pill" aria-hidden="true" />
                {/* Products dropdown — each product opens its own page in a
                    new tab (R21): they are separate product surfaces. */}
                <div className="relative" ref={productsRef}>
                    <button
                        onClick={() => setProductsOpen(o => !o)}
                        aria-expanded={productsOpen}
                        aria-haspopup="true"
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 transition-all duration-150 active:scale-[0.98]"
                    >
                        Products
                        <svg className={`w-4 h-4 ml-0.5 opacity-60 transition-transform duration-150 ${productsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {productsOpen && (
                        <div className="absolute top-full left-0 pt-1.5 w-[210px] menu-in origin-top-left">
                            <div className="bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-900/10 flex flex-col p-1">
                                <button
                                    onClick={() => { onOpenProduct('vega'); setProductsOpen(false); }}
                                    className="px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-all duration-150 active:scale-[0.98] flex items-center gap-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                >
                                    <VegaMark className="w-4 h-4 opacity-80" />
                                    Vega
                                    <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                                </button>
                                <button
                                    onClick={() => { onOpenProduct('atrium'); setProductsOpen(false); }}
                                    className="px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-all duration-150 active:scale-[0.98] flex items-center gap-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                >
                                    <AtriumMark className="w-4 h-4 opacity-80" />
                                    Atrium
                                    <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                {NAV_SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => scrollTo(s.id)}
                        data-nav-id={s.id}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                            activeSection === s.id
                                ? 'text-primary-700'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
                <button
                    onClick={onResources}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150 active:scale-[0.98]"
                >
                    Resources
                </button>
                <button
                    onClick={onContactSales}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150 active:scale-[0.98]"
                >
                    Contact
                </button>
            </nav>

            {/* Right — the one conversation CTA. Auth lives with the products. */}
            <div className="flex items-center gap-2">
                <div className="hidden lg:block h-4 w-px bg-slate-200 mx-1" />
                <button
                    onClick={onContactSales}
                    className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 hover:text-primary-600 transition-all duration-150 active:scale-[0.98] min-h-[2rem]"
                >
                    Talk to us <span aria-hidden="true">→</span>
                </button>

                {/* Mobile hamburger — below lg so iPad portrait uses this menu. */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100 transition-all duration-150 active:scale-[0.98]"
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

        {/* Mobile overlay menu */}
        {mobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 top-16 z-[240] bg-white overflow-y-auto menu-in-top origin-top">
                <nav className="container mx-auto px-4 py-6 flex flex-col gap-1" aria-label="Mobile navigation">
                    <div className="mb-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-4 py-2">Products</p>
                        <button onClick={() => handleNavClick(() => onOpenProduct('vega'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all duration-150 active:scale-[0.98] flex items-center gap-3">
                            <VegaMark className="w-5 h-5 opacity-80" /> Vega — For Law Firms <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                        </button>
                        <button onClick={() => handleNavClick(() => onOpenProduct('atrium'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all duration-150 active:scale-[0.98] flex items-center gap-3">
                            <AtriumMark className="w-5 h-5 opacity-80" /> Atrium — For Property Managers <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                        </button>
                    </div>
                    {NAV_SECTIONS.map((s) => (
                        <button key={s.id} onClick={() => handleNavClick(() => scrollTo(s.id))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all duration-150 active:scale-[0.98]">
                            {s.label}
                        </button>
                    ))}
                    <button onClick={() => handleNavClick(onResources)} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all duration-150 active:scale-[0.98]">Resources</button>
                    <button onClick={() => handleNavClick(onContactSales)} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all duration-150 active:scale-[0.98]">Contact</button>
                    <div className="h-px bg-slate-200 my-3" />
                    <button
                        onClick={() => handleNavClick(onContactSales)}
                        className="w-full py-3 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 transition-all duration-150 active:scale-[0.98]"
                    >
                        Talk to us about your system
                    </button>
                </nav>
            </div>
        )}
    </header>
    );
};

/** Hub footer — the W18 dark colophon (hub columns, no product branches). */
export const HubFooter: React.FC<{
    onPrivacyClick: () => void;
    onTermsClick: () => void;
    onCookieClick: () => void;
    onUsageClick: () => void;
    onResources: () => void;
    onContactSales: () => void;
}> = ({ onPrivacyClick, onTermsClick, onCookieClick, onUsageClick, onResources, onContactSales }) => (
    <footer className="bg-slate-950 border-t border-white/5 py-10 md:py-16 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-16">
        <div className="container mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-10 mb-12">
                {/* Brand */}
                <div>
                    <div className="flex items-center gap-2.5 mb-4">
                        <Logo className="h-6 w-6 text-primary-500" aria-hidden="true" />
                        <span className="text-white font-bold text-lg flex items-center">
                            Practice<span className="text-primary-500">Pro</span>
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-xs">We design, build and run the systems businesses manage their affairs with — two products, Vega and Atrium, and custom commissions for clients. From Lagos, for businesses anywhere.</p>
                </div>
                {/* Products & work — real anchors, new tabs (R21 routing keep). */}
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Products &amp; Work</p>
                    <div className="flex flex-col gap-2.5">
                        <a href="/vega" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                            Vega — Legal Practice OS
                        </a>
                        <a href="/atrium" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                            Atrium — Property Management OS
                        </a>
                        <button onClick={onContactSales} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors min-h-[2rem] flex items-center">
                            Komplete — both, for real-estate attorneys
                        </button>
                        <a href="https://kozycare.ng" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                            Kozy Care — a client build ↗
                        </a>
                        <a href="https://woosh.dpdns.org" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                            Woosh — free temp email ↗
                        </a>
                        <button onClick={onContactSales} className="text-primary-400 hover:text-primary-300 text-sm text-left font-semibold transition-colors min-h-[2rem] flex items-center">
                            Custom systems — built to order →
                        </button>
                    </div>
                </div>
                {/* Company — far right column. */}
                <div className="md:col-start-4">
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
                <p className="text-xs text-slate-500 order-last md:order-none">Vega &amp; Atrium · Built by PracticePro</p>
                <p className="text-xs text-slate-500">NDPA 2023 Compliant · TLS 1.3 Encrypted · *Encryption provided by infrastructure</p>
            </div>
        </div>
    </footer>
);

/** Chat FAB — the emerald bubble; opens the Contact Sales drawer (the
 *  working conversion flow, honest about what it is). Mobile: bottom-24
 *  (above any safe area), md+: bottom-6. */
export const WhatsAppFAB: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => (
    <button
        onClick={onContactSales}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[220] w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary-600 flex items-center justify-center transition-all duration-150 active:scale-95 hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-600/30"
        aria-label="Chat with us — Contact Sales"
        title="Chat with us"
    >
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
    </button>
);

import React from 'react';
import { Logo, ExternalLinkIcon } from '../../constants';
import { Button } from '../../components/ui';
import { VegaMark, AtriumMark } from '../../components/marketing/brand/ProductMarks';

/**
 * HubShell — the PracticePro corporate hub's chrome (P0 split). A copy of
 * the shared NavBar/Footer/WhatsAppFAB from LandingPage.tsx with every
 * branch resolved to the HUB surface (productChosen=false, light chrome):
 * no activeProduct ternaries remain. Restyle happens in Prompt 1.
 */

const navLinkCls = 'text-slate-600 hover:text-slate-900 hover:bg-slate-100';
const navLinkActiveCls = 'text-primary-700';
const menuItemCls = 'text-slate-700 hover:bg-slate-50';
// Hub quirk preserved verbatim: activeProduct defaults to 'vega' in the
// original state, so the Vega item renders active in the Products dropdown.
const vegaItemCls = 'bg-primary-50 text-primary-700';
const atriumItemCls = 'text-slate-600 hover:bg-slate-50 hover:text-slate-900';

export const HubNavBar: React.FC<{
    activeSection: string;
    scrollTo: (id: string) => void;
    onResources: () => void;
    onContactSales: () => void;
    onOpenProduct: (p: 'vega' | 'atrium') => void;
}> = ({ activeSection, scrollTo, onResources, onContactSales, onOpenProduct }) => {
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
        {/* Glass layer — light on the hub */}
        <div className="absolute inset-0 backdrop-blur-xl border-b transition-colors duration-500 bg-white/80 border-slate-200/60" />

        <div className="relative container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
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
            </div>

            {/* Desktop Links — shown on lg+ (1024px+). iPad portrait uses the
                mobile menu (9 items don't fit in 720px). */}
            <nav ref={navRef} className="hidden lg:flex items-center gap-1 relative" aria-label="Main navigation">
                <div ref={pillRef} className="w8-nav-pill" aria-hidden="true" />
                {/* Products dropdown — click-toggle (was hover-only, which
                    broke iPad/tablet touch). */}
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
                            <div className="border rounded-lg shadow-xl flex flex-col p-1 bg-white border-slate-200">
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
                {/* W6 (corporate hub): on the company home page, the nav walks
                    the corporate sections. ui/Button (bare) per ADR-0004. */}
                <Button
                    variant="bare"
                    data-nav-id="whatWeDo"
                    onClick={() => scrollTo('whatWeDo')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeSection === 'whatWeDo'
                            ? navLinkActiveCls
                            : navLinkCls
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
                            ? navLinkActiveCls
                            : navLinkCls
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
                            ? navLinkActiveCls
                            : navLinkCls
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
                            ? navLinkActiveCls
                            : navLinkCls
                    }`}
                >
                    About
                </Button>
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

            {/* Right Actions — on the company page the right hand offers a
                quiet conversation instead of Log In / Start Free Trial. */}
            <div className="flex items-center gap-2">
                <div className="hidden lg:block h-4 w-px mx-1 bg-slate-200" />
                <Button
                    variant="bare"
                    onClick={onContactSales}
                    className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 hover:text-primary-600 transition-colors min-h-[2rem]"
                >
                    Talk to us <span aria-hidden="true">→</span>
                </Button>

                {/* Mobile hamburger button — shown below lg (1024px). */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-slate-700 hover:bg-slate-100"
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
            <div className="lg:hidden fixed inset-0 top-[calc(4rem+env(safe-area-inset-top,0px))] z-[240] overflow-y-auto bg-white">
                <nav className="container mx-auto px-4 py-6 flex flex-col gap-1" aria-label="Mobile navigation">
                    <div className="mb-2">
                        <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 px-4 py-2">Products</p>
                        <button onClick={() => handleNavClick(() => onOpenProduct('vega'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-3 ${vegaItemCls}`}>
                            <VegaMark className="w-5 h-5" /> Vega — For Law Firms <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                        </button>
                        <button onClick={() => handleNavClick(() => onOpenProduct('atrium'))} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-3 ${atriumItemCls}`}>
                            <AtriumMark className="w-5 h-5" /> Atrium — For Property Managers <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                        </button>
                    </div>
                    <Button variant="bare" onClick={() => handleNavClick(() => scrollTo('whatWeDo'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">What We Do</Button>
                    <Button variant="bare" onClick={() => handleNavClick(() => scrollTo('ourWork'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Our Work</Button>
                    <Button variant="bare" onClick={() => handleNavClick(() => scrollTo('howWeWork'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">How We Work</Button>
                    <Button variant="bare" onClick={() => handleNavClick(() => scrollTo('about'))} className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">About</Button>
                    <button onClick={() => handleNavClick(onResources)} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold ${menuItemCls}`}>Resources</button>
                    <button onClick={() => handleNavClick(onContactSales)} className={`w-full text-left px-4 py-3 rounded-sm text-sm font-semibold ${menuItemCls}`}>Contact</button>
                    <div className="h-px my-3 bg-slate-200" />
                    <Button
                        variant="bare"
                        onClick={() => handleNavClick(onContactSales)}
                        className="!w-full !py-3 !rounded-lg !text-sm font-semibold text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600"
                    >
                        Talk to us about your system
                    </Button>
                </nav>
            </div>
        )}
    </header>
    );
};

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
                    <p className="text-slate-500 text-sm leading-relaxed max-w-xs">We design, build and run the systems businesses manage their affairs with — our products Vega and Atrium, and custom commissions for clients. From Lagos, for businesses anywhere.</p>
                </div>
                {/* Products & Work — hub mode: the company's portfolio. */}
                <div>
                    <p className="font-mono text-slate-400 text-xs font-medium uppercase tracking-widest mb-4">Products &amp; Work</p>
                    <div className="flex flex-col gap-2.5">
                        <a href="/vega" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                            Vega — Legal Practice OS ↗
                        </a>
                        <a href="/atrium" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                            Atrium — Property Management OS ↗
                        </a>
                        <Button variant="bare" onClick={onContactSales} className="text-slate-500 hover:text-slate-300 text-sm text-left transition-colors min-h-[2rem] flex items-center">
                            Komplete — both, for real-estate attorneys
                        </Button>
                        <a href="https://kozycare.ng" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                            Kozy Care — a client build ↗
                        </a>
                        <a href="https://woosh.dpdns.org" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-sm transition-colors min-h-[2rem] flex items-center">
                            Woosh — free temp email ↗
                        </a>
                        <Button variant="bare" onClick={onContactSales} className="text-primary-400 hover:text-primary-300 text-sm text-left font-semibold transition-colors min-h-[2rem] flex items-center">
                            Custom systems — built to order →
                        </Button>
                    </div>
                </div>
                {/* Company — always on the far right (column 4) */}
                <div className="md:col-start-4">
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

/** Chat FAB — hub copy: the emerald chat bubble (the original rendered the
 *  FAB with activeProduct defaulting to 'atrium' on the hub). */
export const HubChatFab: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => (
    <button
        onClick={onContactSales}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[220] w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform bg-atrium-emerald"
        aria-label="Chat with us — Contact Sales"
        title="Chat with us"
    >
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
    </button>
);

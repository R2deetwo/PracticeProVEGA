import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo, ExternalLinkIcon } from '../../constants';
import { VegaMark, AtriumMark } from '../../components/marketing/brand/ProductMarks';

/**
 * HubShell v2 — "the systems studio" chrome (P1 redesign).
 *
 * The hub speaks as the COMPANY (docs/brand/practicepro.md): solid paper
 * surfaces, 1px rules, ink type, one moss signal, Archivo display, 2px
 * radius. No translucency, no glass, no product-page registers.
 *
 * B2: own nav (wordmark left; Products, Work, How we work, About,
 * Resources, Contact; "Talk to us" right; solid paper background with a
 * 1px bottom rule), own footer (4 ruled columns, company details, "Vega
 * and Atrium are built by PracticePro Systems Limited"), own chat button
 * (ink circle, moss dot, label "WhatsApp"), own mobile sticky CTA.
 */

const NAV_SECTIONS: { label: string; id: string }[] = [
    { label: 'Products', id: 'products' },
    { label: 'Work', id: 'work' },
    { label: 'How we work', id: 'howWeWork' },
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

    const handleNavClick = (fn: () => void) => {
        setMobileMenuOpen(false);
        fn();
    };

    return (
    <header className="fixed top-0 left-0 right-0 z-[250] pt-safe" style={{ background: 'rgb(var(--hub-paper))', borderBottom: '1px solid rgb(var(--hub-rule))' }}>
        <div className="hub-container relative h-16 flex items-center justify-between">
            {/* Wordmark */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => scrollTo('home')}
                    aria-label="PracticePro Systems — home"
                    className="flex items-center gap-2 group"
                >
                    <span className="group-hover:scale-105 transition-transform" style={{ color: 'rgb(var(--hub-signal))' }}><Logo className="h-7 w-7" /></span>
                    <span className="hub-display text-lg flex items-center" style={{ fontWeight: 700 }}>
                        PracticePro
                    </span>
                </button>
            </div>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
                <div className="relative" ref={productsRef}>
                    <button
                        onClick={() => setProductsOpen(o => !o)}
                        aria-expanded={productsOpen}
                        aria-haspopup="true"
                        className="px-3 py-2 rounded-[2px] text-sm font-medium transition-colors"
                        style={{ color: 'rgb(var(--hub-ink))' }}
                    >
                        Products
                        <svg className={`w-4 h-4 ml-0.5 inline opacity-60 transition-transform ${productsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {productsOpen && (
                        <div className="absolute top-full left-0 pt-1 w-[210px]">
                            <div
                                className="border flex flex-col p-1 rounded-[2px]"
                                style={{ background: '#FFFFFF', borderColor: 'rgb(var(--hub-rule))', boxShadow: '0 8px 24px rgb(20 23 26 / 0.12)' }}
                            >
                                <button
                                    onClick={() => { onOpenProduct('vega'); setProductsOpen(false); }}
                                    className="px-4 py-2.5 text-left text-sm font-semibold rounded-[2px] flex items-center gap-2 transition-colors hover:bg-black/5"
                                    style={{ color: 'rgb(var(--hub-ink))' }}
                                >
                                    <VegaMark className="w-4 h-4" />
                                    <span className="flex-1">Vega</span>
                                    <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40" />
                                </button>
                                <button
                                    onClick={() => { onOpenProduct('atrium'); setProductsOpen(false); }}
                                    className="px-4 py-2.5 text-left text-sm font-semibold rounded-[2px] flex items-center gap-2 transition-colors hover:bg-black/5"
                                    style={{ color: 'rgb(var(--hub-ink))' }}
                                >
                                    <AtriumMark className="w-4 h-4" />
                                    <span className="flex-1">Atrium</span>
                                    <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                {NAV_SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => scrollTo(s.id)}
                        className="px-3 py-2 rounded-[2px] text-sm font-medium transition-colors"
                        style={{
                            color: activeSection === s.id ? 'rgb(var(--hub-ink))' : 'rgb(var(--hub-mute))',
                            boxShadow: activeSection === s.id ? 'inset 0 -2px 0 rgb(var(--hub-signal))' : undefined,
                        }}
                    >
                        {s.label}
                    </button>
                ))}
                <button
                    onClick={onResources}
                    className="px-3 py-2 rounded-[2px] text-sm font-medium transition-colors"
                    style={{ color: 'rgb(var(--hub-mute))' }}
                >
                    Resources
                </button>
                <button
                    onClick={() => scrollTo('contact')}
                    className="px-3 py-2 rounded-[2px] text-sm font-medium transition-colors"
                    style={{ color: 'rgb(var(--hub-mute))' }}
                >
                    Contact
                </button>
            </nav>

            {/* Right — the one conversation CTA */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onContactSales}
                    className="hidden lg:inline-flex items-center hub-cta !min-h-[2.5rem] !py-2 !px-4 !text-sm"
                >
                    Talk to us
                </button>

                {/* Mobile hamburger */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden flex items-center justify-center w-11 h-11 rounded-[2px] transition-colors"
                    style={{ color: 'rgb(var(--hub-ink))' }}
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
            <div className="lg:hidden fixed inset-0 top-16 z-[240] overflow-y-auto" style={{ background: 'rgb(var(--hub-paper))' }}>
                <nav className="hub-container py-6 flex flex-col" aria-label="Mobile navigation">
                    <p className="hub-label px-1 pb-2">Products</p>
                    <button onClick={() => handleNavClick(() => onOpenProduct('vega'))} className="text-left px-1 py-3.5 text-sm font-semibold flex items-center gap-3 rounded-[2px]" style={{ minHeight: 44, color: 'rgb(var(--hub-ink))' }}>
                        <VegaMark className="w-5 h-5" /> Vega — For Law Firms <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                    </button>
                    <button onClick={() => handleNavClick(() => onOpenProduct('atrium'))} className="text-left px-1 py-3.5 text-sm font-semibold flex items-center gap-3 rounded-[2px]" style={{ minHeight: 44, color: 'rgb(var(--hub-ink))' }}>
                        <AtriumMark className="w-5 h-5" /> Atrium — For Property Managers <ExternalLinkIcon className="w-3.5 h-3.5 opacity-40 ml-auto" />
                    </button>
                    <div className="my-3" style={{ borderTop: '1px solid rgb(var(--hub-rule))' }} />
                    {NAV_SECTIONS.map((s) => (
                        <button key={s.id} onClick={() => handleNavClick(() => scrollTo(s.id))} className="text-left px-1 py-3.5 text-sm font-semibold rounded-[2px]" style={{ minHeight: 44, color: 'rgb(var(--hub-ink))' }}>
                            {s.label}
                        </button>
                    ))}
                    <button onClick={() => handleNavClick(onResources)} className="text-left px-1 py-3.5 text-sm font-semibold rounded-[2px]" style={{ minHeight: 44, color: 'rgb(var(--hub-ink))' }}>Resources</button>
                    <button onClick={() => handleNavClick(() => scrollTo('contact'))} className="text-left px-1 py-3.5 text-sm font-semibold rounded-[2px]" style={{ minHeight: 44, color: 'rgb(var(--hub-ink))' }}>Contact</button>
                    <div className="my-3" style={{ borderTop: '1px solid rgb(var(--hub-rule))' }} />
                    <button onClick={() => handleNavClick(onContactSales)} className="hub-cta w-full">
                        Talk to us about your system
                    </button>
                </nav>
            </div>
        )}
    </header>
    );
};

/** Hub footer — 4 ruled columns on the ink band. */
export const HubFooter: React.FC<{
    onPrivacyClick: () => void;
    onTermsClick: () => void;
    onCookieClick: () => void;
    onUsageClick: () => void;
    onResources: () => void;
    onContactSales: () => void;
}> = ({ onPrivacyClick, onTermsClick, onCookieClick, onUsageClick, onResources, onContactSales }) => (
    <footer className="hub-section !border-t-0" style={{ background: 'rgb(var(--hub-ink))', color: 'rgb(var(--hub-paper))' }}>
        <div className="hub-container">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-0">
                {/* Company — the studio */}
                <div className="md:pr-8">
                    <div className="flex items-center gap-2 mb-4">
                        <span aria-hidden="true" style={{ color: 'rgb(var(--hub-signal))' }}><Logo className="h-6 w-6" /></span>
                        <span className="hub-display text-lg" style={{ fontWeight: 700 }}>PracticePro Systems</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgb(216 211 198 / 0.9)' }}>
                        We design, build and run the systems businesses manage their affairs with.
                        From Lagos, for businesses anywhere.
                    </p>
                    <p className="text-xs mt-4" style={{ color: 'rgb(216 211 198 / 0.65)' }}>
                        PracticePro Systems Limited · Lagos, Nigeria
                    </p>
                </div>
                {/* Products & work */}
                <div className="md:px-8 md:border-l" style={{ borderColor: 'rgb(216 211 198 / 0.25)' }}>
                    <p className="hub-label mb-4" style={{ color: 'rgb(216 211 198 / 0.65)' }}>Products &amp; work</p>
                    <div className="flex flex-col gap-2.5">
                        <a href="/vega" target="_blank" rel="noopener noreferrer" className="text-sm transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>
                            Vega — Legal Practice OS ↗
                        </a>
                        <a href="/atrium" target="_blank" rel="noopener noreferrer" className="text-sm transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>
                            Atrium — Property Management OS ↗
                        </a>
                        <button onClick={onContactSales} className="text-left text-sm transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>
                            Komplete — both, for real-estate attorneys
                        </button>
                        <a href="https://kozycare.ng" target="_blank" rel="noopener noreferrer" className="text-sm transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>
                            Kozy Care — a client build ↗
                        </a>
                        <a href="https://woosh.dpdns.org" target="_blank" rel="noopener noreferrer" className="text-sm transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>
                            Woosh — free temp email ↗
                        </a>
                        <button onClick={onContactSales} className="text-left text-sm font-semibold transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(var(--hub-signal))' }}>
                            Custom systems — built to order →
                        </button>
                    </div>
                </div>
                {/* Company / legal */}
                <div className="md:px-8 md:border-l" style={{ borderColor: 'rgb(216 211 198 / 0.25)' }}>
                    <p className="hub-label mb-4" style={{ color: 'rgb(216 211 198 / 0.65)' }}>Company</p>
                    <div className="flex flex-col gap-1">
                        <span onClick={onPrivacyClick} className="text-sm cursor-pointer transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>Privacy Policy</span>
                        <span onClick={onTermsClick} className="text-sm cursor-pointer transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>Terms of Service</span>
                        <span onClick={onCookieClick} className="text-sm cursor-pointer transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>Cookie Policy</span>
                        <span onClick={onUsageClick} className="text-sm cursor-pointer transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>Usage Policy</span>
                        <span onClick={onContactSales} className="text-sm cursor-pointer transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>Contact Sales</span>
                    </div>
                </div>
                {/* Contact */}
                <div className="md:pl-8 md:border-l" style={{ borderColor: 'rgb(216 211 198 / 0.25)' }}>
                    <p className="hub-label mb-4" style={{ color: 'rgb(216 211 198 / 0.65)' }}>Reach us</p>
                    <div className="flex flex-col gap-1">
                        <a href="mailto:dpo@practicepro.ng" className="text-sm transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>dpo@practicepro.ng</a>
                        <button onClick={onContactSales} className="text-left text-sm transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>WhatsApp</button>
                        <button onClick={onResources} className="text-left text-sm transition-colors hover:underline min-h-[2rem] flex items-center" style={{ color: 'rgb(216 211 198 / 0.9)' }}>Security</button>
                    </div>
                </div>
            </div>
            <div className="mt-12 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3" style={{ borderTop: '1px solid rgb(216 211 198 / 0.25)' }}>
                <p className="text-xs" style={{ color: 'rgb(216 211 198 / 0.65)' }}>© {new Date().getFullYear()} PracticePro Systems Limited. All rights reserved.</p>
                <p className="text-xs" style={{ color: 'rgb(216 211 198 / 0.65)' }}>Vega and Atrium are built by PracticePro Systems Limited.</p>
            </div>
        </div>
    </footer>
);

/** Chat button — ink circle, moss dot, label "WhatsApp" (opens the
 *  Contact Sales drawer, the working conversion flow). */
export const HubChatFab: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => (
    <button
        onClick={onContactSales}
        className="hub-chat-fab fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[220] flex items-center gap-2.5 h-12 px-4 rounded-full transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'rgb(var(--hub-ink))', color: 'rgb(var(--hub-paper))' }}
        aria-label="WhatsApp — Contact Sales"
        title="WhatsApp"
    >
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgb(var(--hub-signal))' }} aria-hidden="true" />
        <span className="text-sm font-semibold">WhatsApp</span>
    </button>
);

/** Mobile sticky CTA — the hub's own bar (paper on paper, 1px top rule). */
export const HubMobileStickyCTA: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => (
    <div
        className="md:hidden fixed bottom-0 inset-x-0 z-[210] px-4 py-3 flex gap-2"
        style={{ background: 'rgb(var(--hub-paper))', borderTop: '1px solid rgb(var(--hub-rule))' }}
    >
        <button
            onClick={onContactSales}
            className="hub-cta flex-1"
        >
            Talk to us
        </button>
    </div>
);

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Z_CLASS } from '../../overlays/constants';
/**
 * LegalDirectoriesDrawer — the classy "Official Legal Directories (Lagos
 * & Nigeria)" slide-over (desktop) / bottom sheet (mobile), 2026-11-22
 * owner spec.
 *
 * WHY THIS EXISTS: landing-page ALOA is now strictly Vega's Product Guide
 * & Onboarding Specialist — it never answers legal questions and never
 * refers visitors to PracticePro for legal help (PracticePro is a B2B
 * software provider, not a law firm). When a visitor needs legal
 * REPRESENTATION, the only referral path is the official Nigerian Bar
 * Association resources — rendered here as clean directory cards.
 *
 * RPC NEUTRALITY (Rule 39 — no touting, no endorsement): PracticePro
 * does not endorse, rank, or recommend individual lawyers. The disclosure
 * at the top of the drawer states this plainly, the cards carry no
 * ranking language, and every link points at an OFFICIAL NBA resource
 * (never a private directory or a "vetted" shortlist).
 *
 * Triggers: the ALOA panel's "Official Legal Directories" action pill
 * (legal-question declines) and the audience toggle's non-lawyer link.
 * Mounted on the Vega site; opens ABOVE the ALOA panel (contact z-tier)
 * so closing it returns the visitor to the chat.
 */
const DIRECTORIES: Array<{
    id: string;
    title: string;
    href: string | null; // null = informational card (no external link)
    subtitle: string;
    /** Muted inline icon (stroke, 20px) rendered per card. */
    icon: React.ReactNode;
}> = [
    {
        id: 'nba_slp_firms',
        title: 'NBA-SLP Law Firms Directory',
        href: 'https://lfd.nbaslp.org/',
        subtitle: 'Browse registered law firms across Nigeria — including practices in Lagos (Ikeja, Victoria Island, Ikoyi, Lekki) — by practice area and office location.',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-5h6v5M9 11h.01M15 11h.01M9 14h.01M15 14h.01" />
            </svg>
        ),
    },
    {
        id: 'nba_find_lawyer',
        title: 'Nigerian Bar Association — Find a Lawyer',
        href: 'https://www.nigerianbar.org.ng/find-a-lawyer',
        subtitle: "Official NBA member lookup to verify a practitioner's name and Supreme Court enrolment status.",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4.418 0-8 2.239-8 5v2h16v-2c0-2.761-3.582-5-8-5z" />
            </svg>
        ),
    },
    {
        id: 'nba_lagos_branches',
        title: 'Local NBA Branches (Lagos State)',
        href: 'https://www.nigerianbar.org.ng',
        subtitle: 'Official Lagos branches — such as NBA Lagos Branch and NBA Ikeja Branch — handle branch-level practitioner inquiries.',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
];

const LegalDirectoriesDrawer: React.FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Animate in/out (the ContactSalesDrawer pattern) + Escape to close.
    useEffect(() => {
        if (isOpen) {
            const raf = requestAnimationFrame(() => setIsVisible(true));
            return () => cancelAnimationFrame(raf);
        }
        setIsVisible(false);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <>
            {/* Veil — click-away. Sits above the ALOA panel so the visitor
                returns to the chat when this drawer closes. */}
            <div
                className={`fixed inset-0 ${Z_CLASS.contactVeil} bg-black/25 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="legal-directories-heading"
                className={`fixed ${Z_CLASS.contact} inset-x-0 bottom-0 sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:w-[440px] sm:max-w-[92vw] flex flex-col bg-white shadow-2xl border border-slate-200 rounded-t-2xl sm:rounded-none sm:border-l-0 sm:border-t-0 sm:border-b-0 max-h-[88dvh] sm:max-h-none transition-transform duration-300 ease-out ${isVisible ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-x-full'}`}
            >
                {/* Header */}
                <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
                    <div className="min-w-0 flex-1">
                        <p className="font-mono text-2xs font-medium uppercase tracking-[0.18em] text-slate-400 mb-1">
                            Official legal directories · Lagos &amp; Nigeria
                        </p>
                        <h2 id="legal-directories-heading" className="font-display text-lg font-semibold leading-snug text-slate-900">
                            Locate a Licensed Legal Practitioner
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                        aria-label="Close directories"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-5">
                    {/* RPC neutrality disclosure — states the non-endorsement
                        position plainly, before any directory card. */}
                    <p className="text-xs leading-[1.7] text-slate-500 border-l-2 border-slate-200 pl-3.5 mb-6">
                        PracticePro is a software provider and does not endorse, rank, or
                        recommend individual lawyers. Use the official Nigerian Bar
                        Association resources below to verify enrolment and locate legal
                        practitioners in Lagos State.
                    </p>

                    <div className="space-y-3">
                        {DIRECTORIES.map((d) => {
                            const inner = (
                                <>
                                    <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 transition-colors group-hover:text-slate-500">
                                        {d.icon}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-slate-900 leading-snug group-hover:text-[#1E3A8A] transition-colors">
                                            {d.title}
                                        </p>
                                        <p className="mt-1 text-xs leading-[1.65] text-slate-500">
                                            {d.subtitle}
                                        </p>
                                    </div>
                                    {d.href && (
                                        <svg className="w-4 h-4 text-slate-300 group-hover:text-[#1E3A8A] transition-colors shrink-0 mt-1" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    )}
                                </>
                            );
                            const cls = 'group flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all p-4 text-left';
                            return d.href ? (
                                <a key={d.id} href={d.href} target="_blank" rel="noopener noreferrer" className={cls}>
                                    {inner}
                                </a>
                            ) : (
                                <div key={d.id} className={cls}>{inner}</div>
                            );
                        })}
                    </div>

                    <p className="mt-6 text-2xs leading-relaxed text-slate-400">
                        External links open the official Nigerian Bar Association
                        resources in a new tab. PracticePro is not affiliated with the
                        NBA and receives no referral benefit.
                    </p>
                </div>
            </div>
        </>,
        document.body,
    );
};

export default LegalDirectoriesDrawer;

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui';
import { ArrowsExpandIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from '../../../constants';
import { CollabPresence } from './CollabPresence';

/**
 * AppShotLightbox — R69: the expandable, navigable view of the live
 * captures.
 *
 * Owner direction (verbatim shape): "add a hover effect or
 * click-to-expand feature that allows users to open a larger
 * modal/lightbox view of the live capture... users should be able to
 * seamlessly scroll or click through the different available app views
 * (e.g., Tasks, Calendar, Notes) without having to close the modal and
 * click separate tabs on the main page. Each view must be clearly and
 * prominently labeled (matching the tab titles like Tasks, Calendar,
 * Notes)."
 *
 * One flat exhibit index across every group (Dashboard + the four suite
 * tabs): prev/next and the pill strip walk the WHOLE gallery, so a
 * visitor opened on "Calendar" can step straight into "Notes" or the
 * DraftPro editor without closing. The label is prominent — the exhibit
 * name in the display face, the group above it in mono — matching the
 * page's tab/exhibit vocabulary. The collab presence overlay rides the
 * expanded capture too (owner: "visible across all relevant live capture
 * views"), at 1.3x scale where the header strip has room for it.
 *
 * Practical notes: portal'd to document.body (the page scrolls in an
 * inner container and the capture frames clip); the scroller is locked
 * while open; ←/→ walk the gallery, Escape closes; focus lands on the
 * dialog and returns to the opener on close.
 */

export interface LightboxExhibit {
    src: string;
    alt: string;
    caption: string;
    label: string;
}
export interface LightboxGroup {
    id: string;
    label: string;
    exhibits: LightboxExhibit[];
}

export const AppShotLightbox: React.FC<{
    groups: LightboxGroup[];
    /** Flat index into groups[].exhibits[] — the open exhibit. */
    index: number;
    onNavigate: (index: number) => void;
    onClose: () => void;
    onSignup?: () => void;
}> = ({ groups, index, onNavigate, onClose, onSignup }) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const openerRef = useRef<Element | null>(null);

    // Flatten once per render for the nav + strip.
    const flat = groups.flatMap((g) => g.exhibits.map((e) => ({ ...e, group: g.label })));
    const count = flat.length;
    const current = flat[Math.max(0, Math.min(index, count - 1))];

    // Focus + scroll lock — ONCE per open (the landing page scrolls inside
    // its [data-public-page] root; lock it while the lightbox is open).
    useEffect(() => {
        openerRef.current = document.activeElement;
        dialogRef.current?.focus();
        const scroller = document.querySelector('[data-public-page]');
        const prevOverflow = scroller ? (scroller as HTMLElement).style.overflowY : '';
        if (scroller) (scroller as HTMLElement).style.overflowY = 'hidden';
        return () => {
            if (scroller) (scroller as HTMLElement).style.overflowY = prevOverflow;
            (openerRef.current as HTMLElement | null)?.focus?.();
        };
    }, []);
    // The gallery keys — ←/→ walk, Escape closes.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight') onNavigate((index + 1) % count);
            else if (e.key === 'ArrowLeft') onNavigate((index - 1 + count) % count);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [index, count, onClose, onNavigate]);

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="appshot-lightbox-title"
            ref={dialogRef}
            tabIndex={-1}
            className="fixed inset-0 z-[280] flex flex-col bg-slate-950/85 backdrop-blur-sm animate-swap-in outline-none"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Header — the prominent label + the close. */}
            <div className="flex items-start justify-between gap-4 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 text-left">
                <div className="min-w-0">
                    <p className="font-mono text-2xs tracking-[0.18em] uppercase text-indigo-300 mb-1 truncate">
                        {current.group} · Live capture
                    </p>
                    <h2
                        id="appshot-lightbox-title"
                        className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white truncate"
                    >
                        {current.label}
                    </h2>
                </div>
                <Button
                    variant="bare"
                    iconOnly
                    aria-label="Close the expanded view"
                    onClick={onClose}
                    className="flex-shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <XIcon className="h-5 w-5" aria-hidden="true" />
                </Button>
            </div>

            {/* The stage — the capture at its largest, prev/next at the
                sides, the caption under it. */}
            <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 sm:px-16 pb-2">
                <Button
                    variant="bare"
                    iconOnly
                    aria-label={`Previous view — ${flat[(index - 1 + count) % count].label}`}
                    onClick={() => onNavigate((index - 1 + count) % count)}
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur transition-colors"
                >
                    <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </Button>
                <figure className="max-w-full max-h-full flex flex-col items-center justify-center min-h-0">
                    {/* The capture frame — sized EXPLICITLY (height + the
                        captures' own 8:5 aspect) because a
                        container-type wrapper must never be shrink-to-fit:
                        size containment forbids the content from informing
                        the box, so a content-sized wrapper collapses to
                        0x0 (the first r69 harness caught the lightbox
                        rendering a 0x0 image). height = min(66vh, 56vw):
                        viewport-tall on desktop, width-capped on mobile. */}
                    <div
                        className="relative rounded-xl overflow-hidden ring-1 ring-white/20 shadow-2xl shadow-black/50"
                        style={{ containerType: 'inline-size', aspectRatio: '8 / 5', height: 'min(66vh, 56vw)' }}
                    >
                        <img
                            key={current.src}
                            src={current.src}
                            alt={current.alt}
                            className="absolute inset-0 h-full w-full object-cover select-none"
                            decoding="async"
                        />
                        <CollabPresence scale={1.3} onSignup={onSignup} />
                    </div>
                    <figcaption className="mt-3 font-mono text-2xs tracking-widest text-slate-400 text-center px-14 sm:px-2">
                        {current.caption}
                    </figcaption>
                </figure>
                <Button
                    variant="bare"
                    iconOnly
                    aria-label={`Next view — ${flat[(index + 1) % count].label}`}
                    onClick={() => onNavigate((index + 1) % count)}
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur transition-colors"
                >
                    <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                </Button>
            </div>

            {/* The gallery strip — every exhibit one click away, the
                active one marked. Grouped with separators so the strip
                reads as the page's tab structure. */}
            <nav
                aria-label="App views"
                className="flex flex-wrap justify-center items-center gap-1.5 px-4 sm:px-6 py-4 border-t border-white/10 max-h-[22vh] overflow-y-auto"
            >
                {groups.map((g, gi) => (
                    <React.Fragment key={g.id}>
                        {gi > 0 && <span aria-hidden="true" className="mx-1 h-4 w-px bg-white/15" />}
                        {g.exhibits.map((e) => {
                            const flatIdx = flat.findIndex((f) => f.src === e.src);
                            const activeEx = flatIdx === index;
                            return (
                                <Button
                                    key={e.src}
                                    variant="bare"
                                    aria-pressed={activeEx}
                                    onClick={() => onNavigate(flatIdx)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                        activeEx
                                            ? 'bg-indigo-500 border-indigo-400 text-white'
                                            : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {e.label}
                                </Button>
                            );
                        })}
                    </React.Fragment>
                ))}
            </nav>
        </div>,
        document.body
    );
};

/** The expand affordance overlay — wraps a capture; hover reveals the
 *  hint on fine pointers, touch always shows a corner chip. */
export const ExpandHint: React.FC = () => (
    <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-slate-950/0 transition-colors duration-200 group-hover:bg-slate-950/35 group-focus-visible:bg-slate-950/35"
    >
        <span className="hidden [@media(pointer:fine)]:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-slate-900 text-xs font-semibold shadow-lg opacity-0 scale-95 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100">
            <ArrowsExpandIcon className="h-3.5 w-3.5" />
            Expand
        </span>
        <span className="absolute bottom-2 right-2 inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-900/10 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100 transition-opacity">
            <ArrowsExpandIcon className="h-4 w-4" />
        </span>
    </span>
);

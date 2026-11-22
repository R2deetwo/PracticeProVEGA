import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui';
import { ArrowsExpandIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from '../../../constants';
import { DashboardHotspots } from './DashboardHotspots';
import { MattersHotspots } from './MattersHotspots';
import { TaskBoardPreview } from './TaskBoardPreview';

import { Z_CLASS } from '../../../overlays/constants';
/**
 * AppShotLightbox — R69: the expandable, navigable view of the live
 * captures; R78: the gallery walks in APP PAGE ORDER under a visible
 * "App views" section label, and the interactive overlays are
 * load-gated + exhibit-keyed.
 *
 * Owner direction, R69 (verbatim shape): "add a hover effect or
 * click-to-expand feature that allows users to open a larger
 * modal/lightbox view of the live capture... users should be able to
 * seamlessly scroll or click through the different available app views
 * (e.g., Tasks, Calendar, Notes) without having to close the modal and
 * click separate tabs on the main page. Each view must be clearly and
 * prominently labeled (matching the tab titles like Tasks, Calendar,
 * Notes)."
 *
 * R78 owner direction (2026-11-22): the multi-screen preview navigation
 * reads as "an arbitrary order or raw image-swapping" — the groups now
 * walk the APP'S OWN PAGE ORDER (Overview → Matters → Tasks → Documents
 * → Contacts → Financials → Team) with a visible mono "App views"
 * section label above the strip.
 *
 * R80 owner direction (2026-11-22): the interactive preview MOVES HERE
 * — "take this and then put it inside the See All space… it could be
 * larger and the user can hover over things and get info on them."
 * The Dashboard exhibit becomes THE INTERACTIVE PREVIEW, rendered
 * LARGER than the other exhibits, carrying the hover zones (dim-the-
 * rest + floating hints), the click menus, the hover-revealed teammate
 * monikers and the flippable calendar. Every OTHER exhibit renders as
 * a clean capture — no presence stack, no hotspots — which also kills
 * the owner-reported bug of the monikers floating over views they
 * don't belong on (e.g. over the DraftPro document title).
 *
 * R78 TRANSITION FIX (the "floating badges" bug): the overlays mount
 * only after the image's own load event and are keyed per exhibit, so
 * nothing lingers across a swap.
 *
 * 2026-11-22 (owner direction, this round): (1) the Tasks exhibits —
 * "Task board" renders as a TRUE KANBAN preview and "Team tasks" as
 * the per-counsel table with overlapping multi-assignee avatars, both
 * as interactive HTML previews in the app's own register (the app's
 * task model carries assignedUsers[] — the stacks are the real
 * behaviour, honestly Preview-chipped); the redundant "Task list"
 * exhibit is retired. (2) The Matters exhibit gains the same
 * interactive highlight callouts as the Dashboard (zones + floating
 * hints — what each feature does for a firm). (3) The close X beside
 * the Fit/1:1 toggle is a VISIBLE chip at all times (owner: "not
 * invisible until hovered") — it wears the same white-glass chip as
 * the prev/next arrows.
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
    /** 2026-11-22: render an interactive HTML preview instead of the
     * static capture — 'taskboard' (the Kanban) or 'teamtasks' (the
     * per-counsel table with multi-assignee stacks). */
    preview?: 'taskboard' | 'teamtasks';
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
    // R78: the current exhibit's load state — the overlays mount only
    // once the swapped-in image has actually painted, and reset (keyed)
    // on every navigation so no panel state survives a preview change.
    const [imgLoaded, setImgLoaded] = useState(false);
    // R81 (owner, 2026-11-22): "when you hit expand… it doesn't actually
    // expand, it just brings it to the center of the screen and that is
    // barely legible." The stage now renders the capture MUCH larger, and
    // a FIT ↔ 1:1 toggle reads it at NATIVE logical resolution (the
    // captures are 2880px wide @2x — razor sharp at 1:1), scrollable and
    // drag-pannable inside the stage. Re-arms per exhibit.
    const [zoom, setZoom] = useState<'fit' | 'full'>('fit');
    const stageRef = useRef<HTMLDivElement>(null);
    // Drag-to-pan state (pointer events; no capture outside the stage).
    const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

    // Flatten once per render for the nav + strip.
    const flat = groups.flatMap((g) => g.exhibits.map((e) => ({ ...e, group: g.label })));
    const count = flat.length;
    const current = flat[Math.max(0, Math.min(index, count - 1))];
    // R80: the Dashboard exhibit carries the interactive preview and
    // renders LARGER than the inspection exhibits. 2026-11-22: the
    // Matters exhibit joins it (the interactive highlight callouts),
    // and the HTML task previews render at the same larger seat.
    const isInteractive = current.src === '/assets/landing/app/dashboard.jpg'
        || current.src === '/assets/landing/app/matters-ledger.jpg'
        || !!current.preview;
    const isCapture = !current.preview;

    // Any exhibit change re-arms the load gate + the zoom mode.
    useEffect(() => {
        setImgLoaded(false);
        setZoom('fit');
        stageRef.current?.scrollTo?.({ top: 0, left: 0 });
    }, [current.src]);

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
            className={`fixed inset-0 ${Z_CLASS.lightbox} flex flex-col bg-slate-950/85 backdrop-blur-sm animate-swap-in outline-none`}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Header — the prominent label, the zoom toggle + the close. */}
            <div className="flex items-start justify-between gap-4 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 text-left">
                <div className="min-w-0">
                    <p className="font-mono text-2xs tracking-[0.18em] uppercase text-indigo-300 mb-1 truncate">
                        {current.group}
                    </p>
                    <h2
                        id="appshot-lightbox-title"
                        className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white truncate"
                    >
                        {current.label}
                    </h2>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                    {/* R81: FIT ↔ 1:1 — the expand that actually expands.
                        2026-11-22: capture exhibits only (the HTML task
                        previews scale with the stage; a 1:1 toggle would
                        be a no-op on them). */}
                    {isCapture && (
                        <Button
                            variant="bare"
                            aria-pressed={zoom === 'full'}
                            onClick={() => setZoom((z) => (z === 'fit' ? 'full' : 'fit'))}
                            className={`inline-flex items-center gap-1.5 px-3 h-10 rounded-full text-xs font-semibold border transition-colors ${
                                zoom === 'full'
                                    ? 'bg-indigo-500 border-indigo-400 text-white'
                                    : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border-white/20'
                            }`}
                        >
                            <ArrowsExpandIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            {zoom === 'full' ? '1:1' : 'Fit'}
                        </Button>
                    )}
                    {/* 2026-11-22 (owner): the close X is a clearly visible
                        chip AT ALL TIMES — the same white-glass treatment
                        as the Fit/1:1 toggle and the prev/next arrows.
                        (The glyph now actually renders: ui/Button's
                        iconOnly ignores children — the icon rides the
                        `icon` prop, so the old child-XIcon painted an
                        empty circle, the real reason the owner read the
                        control as invisible.) */}
                    <Button
                        variant="bare"
                        iconOnly
                        icon={XIcon}
                        aria-label="Close the expanded view"
                        onClick={onClose}
                        className="flex-shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white transition-colors"
                    />
                </div>
            </div>

            {/* The stage — the capture at its largest, prev/next at the
                sides, the caption under it. R81: the stage SCROLLS (the
                1:1 mode renders the capture at native logical width,
                1440px); drag-to-pan on fine pointers. */}
            <div
                ref={stageRef}
                className="relative flex-1 min-h-0 flex overflow-auto custom-scrollbar"
                onPointerDown={(e) => {
                    if (zoom !== 'full' || e.button !== 0) return;
                    const stage = stageRef.current;
                    if (!stage) return;
                    panRef.current = { x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop };
                    stage.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                    const pan = panRef.current;
                    const stage = stageRef.current;
                    if (!pan || !stage) return;
                    stage.scrollLeft = pan.left - (e.clientX - pan.x);
                    stage.scrollTop = pan.top - (e.clientY - pan.y);
                }}
                onPointerUp={(e) => {
                    panRef.current = null;
                    stageRef.current?.releasePointerCapture?.(e.pointerId);
                }}
                onPointerCancel={() => { panRef.current = null; }}
            >
                <Button
                    variant="bare"
                    iconOnly
                    icon={ChevronLeftIcon}
                    aria-label={`Previous view — ${flat[(index - 1 + count) % count].label}`}
                    onClick={() => onNavigate((index - 1 + count) % count)}
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur transition-colors"
                />
                <figure
                    className={`flex flex-col items-center justify-center min-h-0 m-auto px-4 sm:px-16 pb-2 ${zoom === 'full' && isCapture ? 'max-w-none cursor-grab active:cursor-grabbing' : 'max-w-full max-h-full'}`}
                    onDoubleClick={() => { if (isCapture) setZoom((z) => (z === 'fit' ? 'full' : 'fit')); }}
                >
                    {/* The capture frame — sized EXPLICITLY and WIDTH-driven
                        (R81): fit mode = min(94vw, (100dvh − 190px) × 1.6),
                        which on a 1440×900 laptop renders ~20% larger than
                        the old height-driven min(66vh, 56vw) and reaches
                        ~native width on desktop; 1:1 mode = the capture's
                        NATIVE LOGICAL width (1440px), scrollable in the
                        stage. A container-type wrapper must never be
                        shrink-to-fit: size containment forbids the content
                        from informing the box, so a content-sized wrapper
                        collapses to 0x0 (the first r69 harness caught the
                        lightbox rendering a 0x0 image). */}
                    <div
                        className={`relative rounded-xl overflow-hidden ring-1 ring-white/20 shadow-2xl shadow-black/50 ${zoom === 'full' && isCapture ? 'flex-shrink-0' : ''}`}
                        style={{
                            containerType: 'inline-size',
                            aspectRatio: '8 / 5',
                            ...(zoom === 'full' && isCapture
                                ? { width: '1440px' }
                                : isInteractive
                                  ? { width: 'min(94vw, calc((100dvh - 190px) * 1.6))' }
                                  : { width: 'min(94vw, calc((100dvh - 175px) * 1.6))' }),
                        }}
                    >
                        {current.preview ? (
                            /* 2026-11-22: the HTML task previews — the
                             * Kanban board and the per-counsel table with
                             * multi-assignee stacks — rendered in the
                             * capture frame's seat, interactive. */
                            <div key={`preview-${current.src}`} className="absolute inset-0 animate-fade-in">
                                <TaskBoardPreview view={current.preview} />
                            </div>
                        ) : (
                            <>
                                <img
                                    key={current.src}
                                    src={current.src}
                                    alt={current.alt}
                                    className="absolute inset-0 h-full w-full object-cover select-none"
                                    style={{ imageRendering: zoom === 'full' ? 'auto' : undefined }}
                                    decoding="async"
                                    draggable={false}
                                    onLoad={() => setImgLoaded(true)}
                                />
                                {/* R80: the interactive preview — the
                                    Dashboard exhibit (the owner moved it
                                    into See All; zones, hints, menus and
                                    the flippable calendar) and, from
                                    2026-11-22, the Matters exhibit (the
                                    highlight callouts). Every other
                                    exhibit stays a clean capture — no
                                    overlays, so the monikers can never
                                    float over a view they don't belong
                                    on. Load-gated + keyed per exhibit so
                                    nothing lingers across a swap. */}
                                {imgLoaded && current.src === '/assets/landing/app/dashboard.jpg' && (
                                    <div key={`interactive-${current.src}`} className="absolute inset-0 animate-fade-in">
                                        <DashboardHotspots onSignup={onSignup} />
                                    </div>
                                )}
                                {imgLoaded && current.src === '/assets/landing/app/matters-ledger.jpg' && (
                                    <div key={`matters-${current.src}`} className="absolute inset-0 animate-fade-in">
                                        <MattersHotspots />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <figcaption className="mt-3 font-mono text-2xs tracking-widest text-slate-400 text-center px-14 sm:px-2 w-full">
                        {current.caption}
                    </figcaption>
                </figure>
                <Button
                    variant="bare"
                    iconOnly
                    icon={ChevronRightIcon}
                    aria-label={`Next view — ${flat[(index + 1) % count].label}`}
                    onClick={() => onNavigate((index + 1) % count)}
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur transition-colors"
                />
            </div>

            {/* The gallery strip — every exhibit one click away, the
                active one marked. R78: a visible mono "App views" section
                label above the pills (the strip reads as the app's own
                page order, not raw image-swapping), groups separated so
                the walk mirrors the sidebar's page sequence. */}
            <nav
                aria-label="App views"
                className="flex flex-wrap justify-center items-center gap-1.5 px-4 sm:px-6 pt-3 pb-4 border-t border-white/10 max-h-[22vh] overflow-y-auto"
            >
                <p className="w-full text-center font-mono text-2xs tracking-[0.18em] uppercase text-slate-400 mb-1" aria-hidden="true">
                    App views
                </p>
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

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ZoomIn,
    ZoomOut,
    Maximize2,
    LayoutGrid,
    Eye,
    Download,
    Printer,
    X,
    Loader2,
} from 'lucide-react';
import { sanitize } from '../../utils/sanitization';

type ViewMode = 'fit' | 'continuous' | 'reading';

type ZoomState =
    | { mode: 'fit-page' }
    | { mode: 'fit-width' }
    | { mode: 'custom'; percent: number };

export interface HtmlPagePreviewProps {
    html: string;
    title: string;
    isFullScreen?: boolean;
    onRequestFullScreen?: () => void;
    onRequestClose?: () => void;
}

const MIN_ZOOM = 25;
const MAX_ZOOM = 400;
const ZOOM_STEP = 25;
// Pixels-per-mm approximation for fit calculations (96 DPI = 25.4 mm/inch)
const MM_PER_PX = 25.4 / 96;
// Approximate character count that fits a single A4 page with 25mm margins
const CHARS_PER_PAGE = 3000;

const pageSheetCss = `
    .html-page-sheet, .html-page-sheet * { box-sizing: border-box; }
    .html-page-sheet {
        font-family: 'Times New Roman', serif;
        font-size: 12pt;
        line-height: 1.5;
        color: #1a1a1a;
        padding: 25mm;
        white-space: normal;
        word-wrap: break-word;
    }
    .html-page-sheet h1 { font-size: 16pt; font-weight: bold; margin: 16pt 0 8pt; }
    .html-page-sheet h2 { font-size: 14pt; font-weight: bold; margin: 14pt 0 6pt; }
    .html-page-sheet h3 { font-size: 12pt; font-weight: bold; margin: 12pt 0 4pt; }
    .html-page-sheet h4 { font-size: 12pt; font-weight: bold; margin: 10pt 0 4pt; }
    .html-page-sheet h5 { font-size: 11pt; font-weight: bold; margin: 10pt 0 4pt; }
    .html-page-sheet h6 { font-size: 11pt; font-weight: bold; margin: 10pt 0 4pt; }
    .html-page-sheet p { margin: 0 0 8pt; text-align: justify; }
    .html-page-sheet ul, .html-page-sheet ol { margin: 0 0 8pt; padding-left: 20pt; }
    .html-page-sheet li { margin-bottom: 4pt; }
    .html-page-sheet table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
    .html-page-sheet td, .html-page-sheet th { border: 1px solid #ccc; padding: 4pt 8pt; }
    .html-page-sheet th { background: #f5f5f5; font-weight: bold; }
    .html-page-sheet strong { font-weight: bold; }
    .html-page-sheet em { font-style: italic; }
    .html-page-sheet u { text-decoration: underline; }
    .html-page-sheet sup { font-size: 0.7em; vertical-align: super; }
    .html-page-sheet a { color: #1d4ed8; text-decoration: underline; }
    .html-page-sheet blockquote { border-left: 3px solid #ccc; padding-left: 12pt; margin: 8pt 0; color: #555; }
    .html-page-sheet pre { background: #f5f5f5; padding: 8pt; border-radius: 4pt; overflow: auto; }
    .html-page-sheet code { font-family: 'Courier New', monospace; font-size: 0.9em; }
`;

// ─── Pagination ─────────────────────────────────────────────────────
// Split on page-break markers; if no markers found, fall back to splitting
// at paragraph boundaries (~3000 chars per page) so very long unbroken
// documents still render page-by-page.
const paginate = (rawHtml: string): string[] => {
    const clean = sanitize(rawHtml);
    if (!clean.trim()) return ['<p style="color:#94a3b8;text-align:center;padding:40px;">No content on this page.</p>'];

    // Split on page-break divs of various shapes produced by DraftPro
    const parts = clean.split(
        /<div[^>]*data-type="page-break"[^>]*><\/div>|<div[^>]*class="[^"]*page-break[^"]*"[^>]*><\/div>|<div[^>]*style="[^"]*page-break[^"]*"[^>]*><\/div>|<hr[^>]*class="[^"]*page-break[^"]*"[^>]*\/?>(?:<\/hr>)?/i
    );
    const filtered = parts.filter(p => p.trim());
    if (filtered.length > 1) return filtered;

    // No explicit page breaks — try to split at paragraph boundaries near 3000 chars
    const all = filtered[0] || clean;
    // Tokenize into top-level block elements + raw text
    const blockRegex = /<(p|div|h[1-6]|ul|ol|table|blockquote|pre|li)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
    const blocks: string[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(all)) !== null) {
        if (match.index > lastIdx) {
            const between = all.slice(lastIdx, match.index).trim();
            if (between) blocks.push(between);
        }
        blocks.push(match[0]);
        lastIdx = match.index + match[0].length;
    }
    if (lastIdx < all.length) {
        const tail = all.slice(lastIdx).trim();
        if (tail) blocks.push(tail);
    }

    if (blocks.length === 0) return [all];

    const pages: string[] = [];
    let current: string[] = [];
    let currentLen = 0;
    for (const block of blocks) {
        // Strip HTML tags to estimate plain-text length
        const textLen = block.replace(/<[^>]+>/g, '').length;
        // If a single block is larger than a page, emit it as its own page anyway
        if (textLen >= CHARS_PER_PAGE) {
            if (current.length > 0) {
                pages.push(current.join(''));
                current = [];
                currentLen = 0;
            }
            pages.push(block);
            continue;
        }
        if (currentLen + textLen > CHARS_PER_PAGE && current.length > 0) {
            pages.push(current.join(''));
            current = [];
            currentLen = 0;
        }
        current.push(block);
        currentLen += textLen;
    }
    if (current.length > 0) pages.push(current.join(''));
    return pages.length > 0 ? pages : [all];
};

// ─── PageSheet: outer div has scaled pixel dimensions, inner uses CSS transform.
// This lets the parent flex container (align-items: center) properly center
// the page even when it's been scaled — because the layout system sees the
// post-scale bounding box, not the pre-scale one.
const PageSheet: React.FC<{
    html: string;
    zoomPercent: number;
    pageLabel?: string;
    totalPages?: number;
}> = ({ html, zoomPercent, pageLabel, totalPages }) => {
    const scale = zoomPercent / 100;
    // A4 dimensions in mm
    const widthMm = 210 * scale;
    const heightMm = 297 * scale;
    return (
        <div
            className="bg-white dark:bg-zinc-900 shadow-2xl border border-slate-300 dark:border-zinc-700 relative flex-shrink-0"
            style={{
                width: `${widthMm}mm`,
                height: `${heightMm}mm`,
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    width: '210mm',
                    height: '297mm',
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                }}
            >
                <div
                    className="html-page-sheet"
                    dangerouslySetInnerHTML={{
                        __html: html || '<p style="color:#94a3b8;text-align:center;padding:40px;">No content on this page.</p>',
                    }}
                />
            </div>
            {pageLabel && totalPages && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: `${10 * scale}mm`,
                        right: `${25 * scale}mm`,
                        fontSize: `${9 * scale}pt`,
                        color: '#94a3b8',
                        fontWeight: 600,
                    }}
                >
                    Page {pageLabel} of {totalPages}
                </div>
            )}
        </div>
    );
};

const HtmlPagePreview: React.FC<HtmlPagePreviewProps> = ({
    html,
    title,
    isFullScreen,
    onRequestFullScreen,
    onRequestClose,
}) => {
    const pages = useMemo(() => paginate(html), [html]);
    const pageCount = pages.length;
    const [currentPage, setCurrentPage] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>('fit');
    const [zoom, setZoom] = useState<ZoomState>({ mode: 'fit-page' });
    const [showThumbnails, setShowThumbnails] = useState(false);
    const [actualScale, setActualScale] = useState(1);
    const actualScaleRef = useRef(1);
    const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

    const containerRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const touchStateRef = useRef<{ initialDistance: number; initialScale: number } | null>(null);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const safeCurrentPage = Math.min(currentPage, pageCount - 1);
    const isDark = viewMode === 'reading';

    // ─── Compute the zoom percent for fit modes based on container size ─
    const computeFitPercent = useCallback((): number => {
        const container = containerRef.current;
        if (!container) return 100;
        const containerWidth = container.clientWidth - 32; // padding
        const containerHeight = container.clientHeight - 32;
        // 210mm = 210 / 25.4 * 96 ≈ 793.7px; 297mm ≈ 1122.5px
        const pageWidthPx = 210 / MM_PER_PX;
        const pageHeightPx = 297 / MM_PER_PX;
        if (zoom.mode === 'fit-page') {
            const scaleW = containerWidth / pageWidthPx;
            const scaleH = containerHeight / pageHeightPx;
            return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(Math.min(scaleW, scaleH) * 100)));
        }
        if (zoom.mode === 'fit-width') {
            return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor((containerWidth / pageWidthPx) * 100)));
        }
        return zoom.percent;
    }, [zoom]);

    // Compute & track the actual scale whenever inputs change
    useEffect(() => {
        if (viewMode === 'continuous') {
            // In continuous mode, fit-width is the natural behavior
            const container = containerRef.current;
            if (!container) return;
            const containerWidth = container.clientWidth - 32;
            const pageWidthPx = 210 / MM_PER_PX;
            const pct = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor((containerWidth / pageWidthPx) * 100)));
            actualScaleRef.current = pct / 100;
            setActualScale(pct / 100);
        } else {
            const pct = computeFitPercent();
            actualScaleRef.current = pct / 100;
            setActualScale(pct / 100);
        }
    }, [computeFitPercent, viewMode, zoom, pageCount]);

    // Reset current page when document changes
    useEffect(() => {
        setCurrentPage(0);
        pageRefs.current = {};
    }, [html]);

    // ─── ResizeObserver: recompute fit on container resize ────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const ro = new ResizeObserver(() => {
            if (zoom.mode !== 'custom') {
                const pct = computeFitPercent();
                actualScaleRef.current = pct / 100;
                setActualScale(pct / 100);
            }
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, [zoom.mode, computeFitPercent]);

    // ─── Navigation ───────────────────────────────────────────────────
    const goToPage = useCallback(
        (page: number) => {
            const target = Math.max(0, Math.min(pageCount - 1, page));
            setCurrentPage(target);
            if (viewMode === 'continuous') {
                pageRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        },
        [pageCount, viewMode]
    );

    const nextPage = useCallback(() => {
        if (viewMode === 'continuous') {
            const scroller = scrollAreaRef.current;
            if (!scroller) return;
            const scrollTop = scroller.scrollTop;
            let bestPage = safeCurrentPage;
            let bestDist = Infinity;
            for (let p = 0; p < pageCount; p++) {
                const el = pageRefs.current[p];
                if (!el) continue;
                const dist = Math.abs(el.offsetTop - scroller.offsetTop - scrollTop);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestPage = p;
                }
            }
            const target = Math.min(pageCount - 1, bestPage + 1);
            setCurrentPage(target);
            pageRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            setCurrentPage(p => Math.min(pageCount - 1, p + 1));
        }
    }, [pageCount, viewMode, safeCurrentPage]);

    const prevPage = useCallback(() => {
        if (viewMode === 'continuous') {
            const scroller = scrollAreaRef.current;
            if (!scroller) return;
            const scrollTop = scroller.scrollTop;
            let bestPage = safeCurrentPage;
            let bestDist = Infinity;
            for (let p = 0; p < pageCount; p++) {
                const el = pageRefs.current[p];
                if (!el) continue;
                const dist = Math.abs(el.offsetTop - scroller.offsetTop - scrollTop);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestPage = p;
                }
            }
            const target = Math.max(0, bestPage - 1);
            setCurrentPage(target);
            pageRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            setCurrentPage(p => Math.max(0, p - 1));
        }
    }, [pageCount, viewMode, safeCurrentPage]);

    // ─── Zoom helpers (read actual scale from ref, not stale percent) ─
    const zoomIn = useCallback(() => {
        const currentPercent = Math.round(actualScaleRef.current * 100);
        setZoom({ mode: 'custom', percent: Math.min(MAX_ZOOM, currentPercent + ZOOM_STEP) });
    }, []);

    const zoomOut = useCallback(() => {
        const currentPercent = Math.round(actualScaleRef.current * 100);
        setZoom({ mode: 'custom', percent: Math.max(MIN_ZOOM, currentPercent - ZOOM_STEP) });
    }, []);

    const zoomReset = useCallback(() => {
        setZoom({ mode: 'fit-page' });
    }, []);

    // ─── Keyboard shortcuts ───────────────────────────────────────────
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target.isContentEditable
            ) {
                return;
            }
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
                e.preventDefault();
                nextPage();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
                e.preventDefault();
                prevPage();
            } else if (e.key === 'Home') {
                e.preventDefault();
                goToPage(0);
            } else if (e.key === 'End') {
                e.preventDefault();
                goToPage(pageCount - 1);
            } else if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                zoomIn();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                zoomOut();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                zoomReset();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                setShowThumbnails(v => !v);
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                setViewMode('reading');
            } else if (e.key === 'Escape') {
                if (viewMode === 'reading') {
                    e.preventDefault();
                    setViewMode('fit');
                } else if (isFullScreen && onRequestClose) {
                    e.preventDefault();
                    onRequestClose();
                }
            }
        };
        const el = containerRef.current;
        el?.addEventListener('keydown', handleKey);
        return () => el?.removeEventListener('keydown', handleKey);
    }, [nextPage, prevPage, goToPage, pageCount, zoomIn, zoomOut, zoomReset, viewMode, isFullScreen, onRequestClose]);

    // ─── Touch handlers: swipe + pinch ────────────────────────────────
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            touchStartRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                time: Date.now(),
            };
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStateRef.current = {
                initialDistance: Math.hypot(dx, dy),
                initialScale: actualScaleRef.current,
            };
        }
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2 && touchStateRef.current) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (touchStateRef.current.initialDistance > 0) {
                const ratio = dist / touchStateRef.current.initialDistance;
                const newPercent = Math.round(
                    Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, touchStateRef.current.initialScale * ratio * 100))
                );
                setZoom({ mode: 'custom', percent: newPercent });
            }
        }
    }, []);

    const handleTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            const start = touchStartRef.current;
            touchStartRef.current = null;
            touchStateRef.current = null;
            if (!start || viewMode === 'continuous') return;
            if (e.changedTouches.length === 1) {
                const dx = e.changedTouches[0].clientX - start.x;
                const dy = e.changedTouches[0].clientY - start.y;
                const elapsed = Date.now() - start.time;
                if (elapsed < 600 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                    if (dx < 0) nextPage();
                    else prevPage();
                }
            }
        },
        [nextPage, prevPage, viewMode]
    );

    // ─── Print: open an iframe and trigger print ──────────────────────
    const handlePrint = useCallback(() => {
        const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${title || 'Document'}</title><style>${pageSheetCss}@page { size: A4; margin: 25mm; } body { margin: 0; }</style></head><body>${pages
            .map((p, i) => `<div class="html-page-sheet" data-page="${i + 1}">${p}</div>`)
            .join('<div style="page-break-after: always;"></div>')}</body></html>`;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (!doc) {
            document.body.removeChild(iframe);
            return;
        }
        doc.open();
        doc.write(fullHtml);
        doc.close();
        const win = iframe.contentWindow;
        if (!win) {
            document.body.removeChild(iframe);
            return;
        }
        const cleanup = () => {
            try {
                document.body.removeChild(iframe);
            } catch {
                /* noop */
            }
        };
        // Give the iframe a tick to layout before invoking print
        setTimeout(() => {
            try {
                win.focus();
                win.print();
            } catch {
                /* noop */
            }
            setTimeout(cleanup, 1000);
        }, 300);
    }, [pages, title]);

    // ─── Download as HTML ─────────────────────────────────────────────
    const handleDownloadHtml = useCallback(() => {
        const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${title || 'Document'}</title><style>${pageSheetCss}@page { size: A4; margin: 25mm; } body { margin: 0; background: #f1f5f9; padding: 16px; }</style></head><body>${pages
            .map((p, i) => `<div class="html-page-sheet" data-page="${i + 1}" style="background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 0 auto 16px; max-width: 210mm;">${p}</div>`)
            .join('')}</body></html>`;
        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(title || 'document').replace(/[^a-z0-9-_]+/gi, '_')}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, [pages, title]);

    // ─── Derived display values ───────────────────────────────────────
    const displayPercent = useMemo(() => {
        if (zoom.mode === 'custom') return zoom.percent;
        return Math.round(actualScale * 100);
    }, [zoom, actualScale]);

    // ─── Render ───────────────────────────────────────────────────────
    return (
        <div
            ref={containerRef}
            tabIndex={0}
            className={`flex flex-col h-full w-full overflow-hidden outline-none rounded-xl border ${
                isDark
                    ? 'bg-zinc-950 border-zinc-800'
                    : 'bg-slate-200 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800'
            }`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <style>{pageSheetCss}</style>

            {/* ─── Top toolbar ─── */}
            <div
                className={`flex items-center justify-between gap-2 px-3 py-2 border-b flex-shrink-0 ${
                    isDark
                        ? 'bg-zinc-900 border-zinc-800'
                        : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'
                }`}
            >
                {/* Left: file info + close */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isFullScreen && onRequestClose && (
                        <button
                            onClick={onRequestClose}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isDark
                                    ? 'text-zinc-300 hover:bg-zinc-800'
                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700'
                            }`}
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isDark ? 'text-zinc-200' : 'text-slate-700 dark:text-zinc-200'}`}>
                            {title || 'Document'}
                        </p>
                    </div>
                </div>

                {/* Center: page navigation */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={() => goToPage(0)}
                        disabled={safeCurrentPage === 0}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        title="First page (Home)"
                    >
                        <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={prevPage}
                        disabled={safeCurrentPage === 0}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Previous page (←)"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className={`text-2xs font-bold w-16 text-center ${isDark ? 'text-zinc-400' : 'text-slate-500 dark:text-zinc-400'}`}>
                        {safeCurrentPage + 1} / {pageCount}
                    </span>
                    <button
                        onClick={nextPage}
                        disabled={safeCurrentPage >= pageCount - 1}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Next page (→)"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => goToPage(pageCount - 1)}
                        disabled={safeCurrentPage >= pageCount - 1}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Last page (End)"
                    >
                        <ChevronsRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Right: view mode, zoom, actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* View mode toggle */}
                    <div className="flex items-center bg-slate-100 dark:bg-zinc-700 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('fit')}
                            className={`p-1.5 rounded-md transition-all ${
                                viewMode === 'fit'
                                    ? 'bg-white dark:bg-zinc-800 shadow text-primary-600'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'
                            }`}
                            title="Single page (centered)"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setViewMode('continuous')}
                            className={`p-1.5 rounded-md transition-all ${
                                viewMode === 'continuous'
                                    ? 'bg-white dark:bg-zinc-800 shadow text-primary-600'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'
                            }`}
                            title="Continuous scroll"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setViewMode('reading')}
                            className={`p-1.5 rounded-md transition-all ${
                                viewMode === 'reading'
                                    ? 'bg-white dark:bg-zinc-800 shadow text-primary-600'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'
                            }`}
                            title="Reading mode (R)"
                        >
                            <Eye className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Zoom controls */}
                    <button
                        onClick={zoomOut}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center"
                        title="Zoom out (Ctrl -)"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                        onClick={zoomReset}
                        className={`text-2xs font-bold w-12 text-center px-1 py-1 rounded-lg bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 ${
                            isDark ? 'text-zinc-300' : 'text-slate-600 dark:text-zinc-300'
                        }`}
                        title="Fit to page (Ctrl 0)"
                    >
                        {displayPercent}%
                    </button>
                    <button
                        onClick={zoomIn}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center"
                        title="Zoom in (Ctrl +)"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>

                    {/* Thumbnails toggle */}
                    <button
                        onClick={() => setShowThumbnails(v => !v)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            showThumbnails
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600'
                        }`}
                        title="Thumbnails (F)"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>

                    {/* Print */}
                    <button
                        onClick={handlePrint}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center"
                        title="Print"
                    >
                        <Printer className="w-4 h-4" />
                    </button>

                    {/* Download as HTML */}
                    <button
                        onClick={handleDownloadHtml}
                        className="w-7 h-7 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors flex items-center justify-center"
                        title="Download as HTML"
                    >
                        <Download className="w-4 h-4" />
                    </button>

                    {/* Full-screen toggle (only when not already full-screen) */}
                    {!isFullScreen && onRequestFullScreen && (
                        <button
                            onClick={onRequestFullScreen}
                            className="w-7 h-7 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors flex items-center justify-center"
                            title="Open in full screen"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Page area ─── */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {viewMode === 'continuous' ? (
                    <div
                        ref={scrollAreaRef}
                        className={`flex-1 overflow-auto custom-scrollbar ${isDark ? 'bg-zinc-950' : 'bg-slate-300/40 dark:bg-zinc-900/30'}`}
                    >
                        <div className="flex flex-col items-center gap-4 py-4 px-4">
                            {pages.map((pageHtml, idx) => (
                                <div
                                    key={idx}
                                    ref={(el) => {
                                        pageRefs.current[idx] = el;
                                    }}
                                    className="flex-shrink-0"
                                >
                                    <PageSheet
                                        html={pageHtml}
                                        zoomPercent={Math.round(actualScale * 100)}
                                        pageLabel={String(idx + 1)}
                                        totalPages={pageCount}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    // Outer overflow-auto + inner min-h-full w-full flex items-center justify-center
                    // so align-items: center works even when content overflows vertically.
                    <div
                        className={`flex-1 overflow-auto custom-scrollbar ${
                            isDark ? 'bg-zinc-950' : 'bg-slate-300/40 dark:bg-zinc-900/30'
                        }`}
                    >
                        <div className="min-h-full w-full flex items-center justify-center p-4">
                            <PageSheet
                                html={pages[safeCurrentPage] || ''}
                                zoomPercent={Math.round(actualScale * 100)}
                                pageLabel={String(safeCurrentPage + 1)}
                                totalPages={pageCount}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Bottom thumbnail strip ─── */}
            {showThumbnails && (
                <div
                    className={`flex-shrink-0 border-t overflow-x-auto custom-scrollbar px-3 py-2 ${
                        isDark
                            ? 'bg-zinc-900 border-zinc-800'
                            : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'
                    }`}
                    style={{ maxHeight: '200px' }}
                >
                    <div className="flex items-end gap-2 h-[170px]">
                        {pages.map((pageHtml, idx) => (
                            <button
                                key={`thumb-${idx}`}
                                onClick={() => goToPage(idx)}
                                className={`flex-shrink-0 flex flex-col items-center gap-1 px-1 py-1 rounded-lg transition-all ${
                                    idx === safeCurrentPage
                                        ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-600'
                                        : isDark
                                        ? 'hover:bg-zinc-800'
                                        : 'hover:bg-slate-100 dark:hover:bg-zinc-700'
                                }`}
                                style={{ height: '180px' }}
                                title={`Page ${idx + 1}`}
                            >
                                <div
                                    className="bg-white dark:bg-zinc-900 shadow-md overflow-hidden relative"
                                    style={{
                                        width: `${210 * 0.18}mm`,
                                        height: `${297 * 0.18}mm`,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '210mm',
                                            height: '297mm',
                                            transform: 'scale(0.18)',
                                            transformOrigin: 'top left',
                                        }}
                                    >
                                        <div
                                            className="html-page-sheet"
                                            style={{ pointerEvents: 'none' }}
                                            dangerouslySetInnerHTML={{ __html: pageHtml }}
                                        />
                                    </div>
                                </div>
                                <span
                                    className={`text-3xs font-bold ${
                                        idx === safeCurrentPage
                                            ? 'text-primary-700 dark:text-primary-300'
                                            : isDark
                                            ? 'text-zinc-400'
                                            : 'text-slate-500'
                                    }`}
                                >
                                    {idx + 1}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Bottom hint ─── */}
            <div
                className={`flex-shrink-0 px-4 py-1.5 border-t text-center ${
                    isDark
                        ? 'bg-zinc-900 border-zinc-800'
                        : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'
                }`}
            >
                <p className={`text-3xs ${isDark ? 'text-zinc-500' : 'text-slate-400 dark:text-zinc-500'}`}>
                    ← → navigate • Ctrl +/− zoom • Ctrl 0 fit • F thumbnails • R reading • ESC exit
                </p>
            </div>
        </div>
    );
};

export default HtmlPagePreview;

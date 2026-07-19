
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DocumentIcon, DownloadIcon, ArrowsExpandIcon } from '../../constants';
import { sanitize } from '../../utils/sanitization';

// ─── HTML Page Preview (for DraftPro-created documents) ────────────
//
// ANTI-GRAVITY spec compliance:
//   1. Zoom state is a discriminated union — either fit-mode OR custom percent,
//      never both. Toolbar shows "Fit" OR "75%", never "Fit / 75%".
//   2. Page is centered both H and V. Uses inner wrapper with min-height: 100%
//      so align-items: center works even when content overflows.
//   3. Bottom thumbnail strip is a real docked horizontal strip, not overlay.
//
// NOTE: This is a stopgap for HTML-content documents. The proper solution is
// server-side HTML→PDF rendering (ANTI-GRAVITY pipeline) so these docs also
// flow through PdfViewer. For now, this component matches PdfViewer's UX.

export interface HtmlPagePreviewProps {
    html: string;
    title: string;
    isFullScreen?: boolean;
    onRequestFullScreen?: () => void;
    onRequestClose?: () => void;
}

type ViewMode = 'fit' | 'continuous';

// ─── Discriminated zoom state ──────────────────────────────────────
type ZoomState =
    | { mode: 'fit-page' }
    | { mode: 'fit-width' }
    | { mode: 'custom'; percent: number };

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const PX_PER_MM = 3.7795;
const ZOOM_STEP = 25;
const MIN_ZOOM = 25;
const MAX_ZOOM = 300;

const HtmlPagePreview: React.FC<HtmlPagePreviewProps> = ({
    html,
    title,
    isFullScreen = false,
    onRequestFullScreen,
    onRequestClose,
}) => {
    const [zoomState, setZoomState] = useState<ZoomState>({ mode: 'fit-page' });
    const [currentPage, setCurrentPage] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>('fit');
    const [showThumbnails, setShowThumbnails] = useState(false);
    const [readingMode, setReadingMode] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const pageAreaRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const thumbnailStripRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    // Track actual rendered zoom (for zoom in/out from any mode)
    const currentZoomRef = useRef(100);

    // ─── Auto-paginate ──────────────────────────────────────────────
    const pages = useMemo(() => {
        const cleanHtml = sanitize(html);
        const explicitPages = cleanHtml.split(/<div[^>]*data-type="page-break"[^>]*><\/div>|<div[^>]*class="[^"]*page-break[^"]*"[^>]*><\/div>|<div[^>]*style="[^"]*page-break[^"]*"[^>]*><\/div>/i);
        const filtered = explicitPages.filter(p => p.trim());

        if (filtered.length <= 1 && cleanHtml.length > 4000) {
            const paragraphs = cleanHtml.split(/(<\/p>)/i);
            const autoPages: string[] = [];
            let currentChunk = '';
            let charCount = 0;
            const CHARS_PER_PAGE = 3000;

            for (let i = 0; i < paragraphs.length; i++) {
                currentChunk += paragraphs[i];
                if (paragraphs[i] === '</p>') {
                    charCount += currentChunk.length;
                    if (charCount >= CHARS_PER_PAGE) {
                        autoPages.push(currentChunk);
                        currentChunk = '';
                        charCount = 0;
                    }
                }
            }
            if (currentChunk.trim()) autoPages.push(currentChunk);
            return autoPages.length > 0 ? autoPages : filtered;
        }

        return filtered;
    }, [html]);

    const pageCount = pages.length || 1;
    const safeCurrentPage = Math.min(currentPage, pageCount - 1);

    // ─── Compute zoom from ZoomState ────────────────────────────────
    const computeZoom = useCallback(() => {
        if (!pageAreaRef.current) return 100;
        const areaW = pageAreaRef.current.clientWidth;
        const areaH = pageAreaRef.current.clientHeight;
        if (areaW <= 0 || areaH <= 0) return 100;

        if (zoomState.mode === 'fit-page') {
            const pageW = PAGE_W_MM * PX_PER_MM;
            const pageH = PAGE_H_MM * PX_PER_MM;
            const zoomW = areaW / pageW;
            const zoomH = areaH / pageH;
            const fitZoom = Math.min(zoomW, zoomH) * 0.98;
            return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(fitZoom * 100)));
        }
        if (zoomState.mode === 'fit-width') {
            const pageW = PAGE_W_MM * PX_PER_MM;
            const fitZoom = (areaW / pageW) * 0.98;
            return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(fitZoom * 100)));
        }
        return zoomState.percent;
    }, [zoomState]);

    // Apply computed zoom and track it
    useEffect(() => {
        const newZoom = computeZoom();
        currentZoomRef.current = newZoom;
        // Force re-render by updating a state (zoomState is the source of truth,
        // but we need to apply the computed value. Use a separate render trigger.)
        setRenderTrigger(t => t + 1);
    }, [computeZoom, showThumbnails, readingMode, viewMode]);

    // Render trigger (so computeZoom runs and PageSheet picks up new value)
    const [, setRenderTrigger] = useState(0);
    const effectiveZoom = computeZoom();

    // ─── ResizeObserver: re-fit on container resize ─────────────────
    useEffect(() => {
        const el = pageAreaRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            // Trigger re-render to recompute zoom
            setRenderTrigger(t => t + 1);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Reset current page when document changes
    useEffect(() => {
        setCurrentPage(0);
    }, [html]);

    // ─── Zoom handlers (discriminated state) ────────────────────────
    const handleZoomIn = useCallback(() => {
        const newPercent = Math.min(MAX_ZOOM, currentZoomRef.current + ZOOM_STEP);
        setZoomState({ mode: 'custom', percent: newPercent });
    }, []);

    const handleZoomOut = useCallback(() => {
        const newPercent = Math.max(MIN_ZOOM, currentZoomRef.current - ZOOM_STEP);
        setZoomState({ mode: 'custom', percent: newPercent });
    }, []);

    const handleFit = useCallback(() => {
        setZoomState({ mode: 'fit-page' });
    }, []);

    // ─── Keyboard navigation ────────────────────────────────────────
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            // P1 a11y: Guard against firing shortcuts while typing in any input
            const target = e.target as HTMLElement;
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
            if (e.key === 'Escape') {
                if (readingMode) {
                    e.preventDefault();
                    setReadingMode(false);
                    return;
                }
                if (isFullScreen && onRequestClose) {
                    e.preventDefault();
                    onRequestClose();
                }
                return;
            }
            if (readingMode) {
                if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                    e.preventDefault();
                    setCurrentPage(p => Math.max(0, p - 1));
                } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
                    e.preventDefault();
                    setCurrentPage(p => Math.min(pageCount - 1, p + 1));
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    setCurrentPage(0);
                } else if (e.key === 'End') {
                    e.preventDefault();
                    setCurrentPage(pageCount - 1);
                }
                return;
            }
            if (viewMode !== 'fit') return;
            if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                setCurrentPage(p => Math.max(0, p - 1));
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
                e.preventDefault();
                setCurrentPage(p => Math.min(pageCount - 1, p + 1));
            } else if (e.key === 'Home') {
                e.preventDefault();
                setCurrentPage(0);
            } else if (e.key === 'End') {
                e.preventDefault();
                setCurrentPage(pageCount - 1);
            } else if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                handleZoomIn();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                handleZoomOut();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                handleFit();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                setShowThumbnails(s => !s);
            } else if ((e.key === 'r' || e.key === 'R') && isFullScreen) {
                e.preventDefault();
                setReadingMode(r => !r);
            }
        };
        const el = containerRef.current;
        el?.addEventListener('keydown', handleKey);
        return () => el?.removeEventListener('keydown', handleKey);
    }, [pageCount, viewMode, isFullScreen, onRequestClose, readingMode, handleZoomIn, handleZoomOut, handleFit]);

    // ─── Touch swipe (only horizontal) ──────────────────────────────
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (viewMode !== 'fit') return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            if (deltaX > 0) setCurrentPage(p => Math.max(0, p - 1));
            else setCurrentPage(p => Math.min(pageCount - 1, p + 1));
        }
    };

    const goToPage = (page: number) => {
        const target = Math.max(0, Math.min(pageCount - 1, page));
        setCurrentPage(target);
        if (scrollRef.current && viewMode === 'continuous') {
            const pageHeight = PAGE_H_MM * PX_PER_MM * (effectiveZoom / 100) + 40;
            scrollRef.current.scrollTo({ top: target * pageHeight, behavior: 'smooth' });
        }
        if (thumbnailStripRef.current) {
            const thumb = thumbnailStripRef.current.children[target] as HTMLElement;
            if (thumb) {
                thumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }
    };

    const handleScroll = () => {
        if (viewMode !== 'continuous' || !scrollRef.current) return;
        const scrollTop = scrollRef.current.scrollTop;
        const pageHeight = PAGE_H_MM * PX_PER_MM * (effectiveZoom / 100) + 40;
        const pageNum = Math.floor(scrollTop / pageHeight);
        const newPage = Math.max(0, Math.min(pageCount - 1, pageNum));
        if (newPage !== currentPage) {
            setCurrentPage(newPage);
            if (thumbnailStripRef.current) {
                const thumb = thumbnailStripRef.current.children[newPage] as HTMLElement;
                if (thumb) {
                    thumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            }
        }
    };

    const handleDownload = () => {
        const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;color:#1a1a1a;max-width:210mm;margin:0 auto;padding:25mm;}h1{font-size:16pt;font-weight:bold;margin:16pt 0 8pt;}h2{font-size:14pt;font-weight:bold;margin:14pt 0 6pt;}h3{font-size:12pt;font-weight:bold;margin:12pt 0 4pt;}p{margin:0 0 8pt;text-align:justify;}</style></head><body>${sanitize(html)}</body></html>`;
        const blob = new Blob([fullDoc], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9-_]/g, '_')}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => {
        const printWin = window.open('', '_blank');
        if (!printWin) return;
        const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:25mm;}body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;color:#1a1a1a;}h1{font-size:16pt;font-weight:bold;margin:16pt 0 8pt;break-after:avoid;}h2{font-size:14pt;font-weight:bold;margin:14pt 0 6pt;break-after:avoid;}h3{font-size:12pt;font-weight:bold;margin:12pt 0 4pt;break-after:avoid;}p{margin:0 0 8pt;text-align:justify;orphans:2;widows:2;}</style></head><body>${sanitize(html)}</body></html>`;
        printWin.document.write(fullDoc);
        printWin.document.close();
        setTimeout(() => { printWin.print(); }, 500);
    };

    const pageCss = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .page-sheet {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #1a1a1a;
        }
        .page-sheet h1 { font-size: 16pt; font-weight: bold; margin: 16pt 0 8pt; }
        .page-sheet h2 { font-size: 14pt; font-weight: bold; margin: 14pt 0 6pt; }
        .page-sheet h3 { font-size: 12pt; font-weight: bold; margin: 12pt 0 4pt; }
        .page-sheet p { margin: 0 0 8pt; text-align: justify; }
        .page-sheet ul, .page-sheet ol { margin: 0 0 8pt; padding-left: 20pt; }
        .page-sheet li { margin-bottom: 4pt; }
        .page-sheet table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
        .page-sheet td, .page-sheet th { border: 1px solid #ccc; padding: 4pt 8pt; }
        .page-sheet th { background: #f5f5f5; font-weight: bold; }
        .page-sheet strong { font-weight: bold; }
        .page-sheet em { font-style: italic; }
        .page-sheet u { text-decoration: underline; }
        .page-sheet sup { font-size: 0.7em; vertical-align: super; }
    `;

    // ─── Page sheet — outer wrapper has SCALED dimensions so flex centering works ───
    const PageSheet = ({ pageIndex }: { pageIndex: number }) => {
        const scaledW = PAGE_W_MM * (effectiveZoom / 100);
        const scaledH = PAGE_H_MM * (effectiveZoom / 100);
        return (
            <div
                className="flex-shrink-0"
                style={{
                    width: `${scaledW}mm`,
                    height: `${scaledH}mm`,
                    position: 'relative',
                }}
            >
                <div
                    className="bg-white shadow-2xl border border-slate-300 absolute top-0 left-0"
                    style={{
                        width: `${PAGE_W_MM}mm`,
                        minHeight: `${PAGE_H_MM}mm`,
                        padding: '25mm',
                        transform: `scale(${effectiveZoom / 100})`,
                        transformOrigin: 'top left',
                        transition: 'transform 150ms ease-out',
                    }}
                >
                    <div
                        className="page-sheet"
                        dangerouslySetInnerHTML={{ __html: pages[pageIndex] || '<p style="color:#94a3b8;text-align:center;padding:40px;">No content on this page.</p>' }}
                    />
                    <div style={{ position: 'absolute', bottom: '10mm', right: '25mm', fontSize: '9pt', color: '#94a3b8', fontWeight: 600 }}>
                        Page {pageIndex + 1} of {pageCount}
                    </div>
                </div>
            </div>
        );
    };

    // ─── Thumbnail ───
    const Thumbnail = ({ pageIndex }: { pageIndex: number }) => (
        <button
            onClick={() => goToPage(pageIndex)}
            className={`group relative flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                safeCurrentPage === pageIndex
                    ? 'border-primary-600 shadow-md ring-2 ring-primary-200'
                    : 'border-slate-200 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500'
            }`}
            title={`Page ${pageIndex + 1}`}
            style={{ width: '72px', height: '94px' }}
        >
            <div
                className="bg-white relative overflow-hidden"
                style={{ width: '100%', height: '100%', fontFamily: "'Times New Roman', serif" }}
            >
                <div
                    className="page-sheet absolute top-0 left-0 origin-top-left pointer-events-none"
                    style={{
                        width: '210mm',
                        transform: 'scale(0.135)',
                        fontSize: '12pt',
                        lineHeight: '1.5',
                        color: '#1a1a1a',
                        padding: '8mm',
                        overflow: 'hidden',
                    }}
                    dangerouslySetInnerHTML={{
                        __html: (pages[pageIndex] || '').slice(0, 1200),
                    }}
                />
                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/70 text-white text-3xs font-bold text-center">
                    {pageIndex + 1}
                </div>
            </div>
        </button>
    );

    // ─── Zoom indicator: EITHER "Fit" OR percent, never both ────────
    const zoomLabel = zoomState.mode === 'fit-page'
        ? 'Fit'
        : zoomState.mode === 'fit-width'
            ? 'W-Fit'
            : `${zoomState.percent}%`;
    const isFitMode = zoomState.mode !== 'custom';

    // ═══ READING MODE ═══════════════════════════════════════════════
    if (readingMode && isFullScreen) {
        return (
            <div
                ref={containerRef}
                tabIndex={0}
                className="flex flex-col h-full w-full bg-zinc-900 outline-none relative"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => { if (e.target === e.currentTarget) setReadingMode(false); }}
            >
                <style>{pageCss}</style>
                <div
                    ref={pageAreaRef}
                    className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-2"
                >
                    <div className="min-h-full w-full flex items-center justify-center">
                        <PageSheet pageIndex={safeCurrentPage} />
                    </div>
                </div>
                <button
                    onClick={() => setReadingMode(false)}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
                    title="Exit reading mode (ESC)"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 text-white rounded-full text-xs font-bold backdrop-blur-sm pointer-events-none">
                    {safeCurrentPage + 1} / {pageCount}
                </div>
            </div>
        );
    }

    // ═══ STANDARD VIEW ═════════════════════════════════════════════
    return (
        <div ref={containerRef} tabIndex={0} className={`flex flex-col h-full bg-slate-200/50 dark:bg-zinc-900/50 overflow-hidden outline-none ${isFullScreen ? 'rounded-none' : ''}`}>
            <style>{pageCss}</style>

            {/* ─── SLIM TOOLBAR ─── */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 shadow-sm shrink-0 gap-1">
                {/* Left: page navigation */}
                <div className="flex items-center gap-0.5 min-w-0">
                    <button onClick={() => goToPage(0)} disabled={safeCurrentPage === 0} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="First page (Home)">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" /></svg>
                    </button>
                    <button onClick={() => goToPage(safeCurrentPage - 1)} disabled={safeCurrentPage === 0} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Previous (←)">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>
                    <input
                        type="number"
                        min={1}
                        max={pageCount}
                        value={safeCurrentPage + 1}
                        onChange={(e) => goToPage(parseInt(e.target.value) - 1)}
                        className="w-10 h-7 text-center text-2xs font-bold bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded border-none outline-none"
                    />
                    <span className="text-2xs font-bold text-slate-500 dark:text-zinc-400 whitespace-nowrap px-1">
                        / {pageCount}
                    </span>
                    <button onClick={() => goToPage(safeCurrentPage + 1)} disabled={safeCurrentPage >= pageCount - 1} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Next (→)">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                    <button onClick={() => goToPage(pageCount - 1)} disabled={safeCurrentPage >= pageCount - 1} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Last page (End)">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                </div>

                {/* Center: view mode toggle (hidden on small screens) */}
                <div className="hidden sm:flex bg-slate-100 dark:bg-zinc-700 rounded p-0.5">
                    <button
                        onClick={() => setViewMode('fit')}
                        className={`px-2 py-0.5 rounded transition-colors ${viewMode === 'fit' ? 'bg-white dark:bg-zinc-600 text-slate-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                        title="Single page view"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h9A2.25 2.25 0 0118.75 6v12a2.25 2.25 0 01-2.25 2.25h-9A2.25 2.25 0 015.25 18V6A2.25 2.25 0 017.5 3.75z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setViewMode('continuous')}
                        className={`px-2 py-0.5 rounded transition-colors ${viewMode === 'continuous' ? 'bg-white dark:bg-zinc-600 text-slate-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                        title="Continuous scroll view"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5v3.75h-7.5v-3.75zM8.25 13.5h7.5v3.75h-7.5v-3.75z" />
                        </svg>
                    </button>
                </div>

                {/* Right: zoom + actions */}
                <div className="flex items-center gap-0.5">
                    <button onClick={handleZoomOut} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center" title="Zoom out (Ctrl -)">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
                    </button>
                    <button
                        onClick={handleFit}
                        className={`px-2 h-7 rounded text-3xs font-bold transition-colors ${isFitMode ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'}`}
                        title="Fit to page (Ctrl 0)"
                    >
                        Fit
                    </button>
                    {/* Single zoom indicator: either "Fit" OR percent, never both */}
                    <span className="text-3xs font-bold text-slate-400 dark:text-zinc-500 w-10 text-center hidden sm:inline">{zoomLabel}</span>
                    <button onClick={handleZoomIn} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center" title="Zoom in (Ctrl +)">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    </button>

                    <div className="w-px h-5 bg-slate-200 dark:bg-zinc-700 mx-1" />

                    <button
                        onClick={() => setShowThumbnails(s => !s)}
                        className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${showThumbnails ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'}`}
                        title="Toggle thumbnails (F)"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                        </svg>
                    </button>

                    {isFullScreen && (
                        <button
                            onClick={() => setReadingMode(true)}
                            className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center"
                            title="Reading mode (R)"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    )}

                    {!isFullScreen && onRequestFullScreen && (
                        <button
                            onClick={onRequestFullScreen}
                            className="w-7 h-7 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-600 dark:text-zinc-300 hover:text-primary-600 dark:hover:text-primary-400 flex items-center justify-center"
                            title="Open in full screen (ESC to exit)"
                        >
                            <ArrowsExpandIcon className="w-3.5 h-3.5" />
                        </button>
                    )}

                    <button onClick={handleDownload} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center" title="Download as HTML">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                    </button>

                    <button onClick={handlePrint} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center" title="Print / Save as PDF">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621.504-1.125 1.125-1.125h.871c1.018 0 1.997.346 2.778.984M6.75 7.234V18" /></svg>
                    </button>

                    {isFullScreen && onRequestClose && (
                        <button
                            onClick={onRequestClose}
                            className="ml-1 w-8 h-8 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center"
                            title="Close (ESC)"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* ─── MAIN VIEWPORT ───
                BUG 1 fix: outer wrapper is overflow-auto, inner wrapper has
                min-h-full + flex centering. This makes align-items: center
                work even when the page is taller than the viewport. */}
            {viewMode === 'fit' ? (
                <div
                    ref={pageAreaRef}
                    className="flex-1 min-h-0 overflow-auto bg-slate-200/50 dark:bg-zinc-900/30"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="min-h-full w-full flex items-center justify-center p-3 sm:p-6">
                        <PageSheet pageIndex={safeCurrentPage} />
                    </div>
                </div>
            ) : (
                <div
                    ref={pageAreaRef}
                    className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-200/50 dark:bg-zinc-900/30"
                >
                    <div
                        ref={scrollRef}
                        onScroll={handleScroll}
                        className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-3 p-3 sm:p-6 custom-scrollbar"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        {Array.from({ length: pageCount }).map((_, i) => (
                            <PageSheet key={i} pageIndex={i} />
                        ))}
                    </div>
                </div>
            )}

            {/* ─── BOTTOM THUMBNAIL STRIP (BUG 3 fix) ───
                Real docked horizontal strip, not overlay. Fixed height.
                Toggling off re-runs fit (flex layout reclaims space). */}
            {showThumbnails && (
                <div className="shrink-0 bg-white dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700" style={{ height: '110px' }}>
                    <div
                        ref={thumbnailStripRef}
                        className="flex items-center gap-1.5 px-2 py-2 overflow-x-auto overflow-y-hidden custom-scrollbar h-full"
                        style={{ scrollbarWidth: 'thin' }}
                    >
                        {Array.from({ length: pageCount }).map((_, i) => (
                            <Thumbnail key={i} pageIndex={i} />
                        ))}
                        {pageCount === 0 && (
                            <p className="text-2xs text-slate-400 italic px-2">No pages</p>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Footer hint (full-screen only) ─── */}
            {isFullScreen && (
                <div className="shrink-0 px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700 text-3xs text-slate-400 dark:text-zinc-500 flex items-center justify-between">
                    <span className="hidden sm:inline">← → navigate • Ctrl +/− zoom • F thumbnails • R reading • Ctrl 0 fit</span>
                    <span className="sm:hidden">Swipe to navigate • Pinch to zoom</span>
                    {onRequestClose && (
                        <button onClick={onRequestClose} className="font-bold text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400">
                            ESC to close
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default HtmlPagePreview;

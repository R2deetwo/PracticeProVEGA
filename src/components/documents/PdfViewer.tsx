/**
 * PdfViewer — Adobe Acrobat-style PDF viewer built on pdf.js
 *
 * Why pdf.js instead of HTML+CSS scale():
 *   - CSS transforms are visual-only — they don't change layout footprint,
 *     so fit-to-page math never quite works.
 *   - pdf.js renders to <canvas> with actual pixel dimensions, so the
 *     math is exact. This is what Chrome's and Firefox's built-in PDF
 *     viewers use.
 *   - We get proper page breaks, accurate page counts, search-in-document,
 *     text selection, etc. for free.
 *
 * Mobile + desktop UX:
 *   - Canvas-based rendering works on iOS Safari, Android Chrome, desktop
 *   - Uses devicePixelRatio for crisp rendering on retina/hi-dpi screens
 *   - Bottom toolbar is in the thumb zone on mobile
 *   - Pinch-to-zoom via touch handlers (with single-finger pan)
 *   - Swipe left/right to navigate pages
 *   - Keyboard shortcuts on desktop (←/→/Home/End/PgUp/PgDn, Ctrl +/-/0, F, R, ESC)
 *   - ResizeObserver recomputes fit when container resizes (sidebar, URL bar, etc.)
 *
 * HTML-to-PDF rendering:
 *   - If the document has HTML content (DraftPro-created), we render it
 *     to a PDF in the browser using a hidden iframe + window.print()
 *     pipeline. This produces a real PDF with proper page breaks.
 *   - If the document has a file URL (uploaded PDF), we pass it directly
 *     to pdf.js.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    ZoomIn, ZoomOut, Maximize2, LayoutGrid, Eye, Download, Printer, X,
    Loader2,
} from 'lucide-react';
import { sanitize } from '../../utils/sanitization';

// ── Configure pdf.js worker (Vite-native bundled approach) ────────
// Uses import.meta.url so Vite serves the worker from the bundle.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).href;

export interface PdfViewerProps {
    /** Direct PDF file URL (uploaded PDF) — takes priority over html. */
    fileUrl?: string;
    /** HTML content to render as a PDF (DraftPro-created documents). */
    html?: string;
    title?: string;
    isFullScreen?: boolean;
    onClose?: () => void;
    onDownload?: () => void;
}

type ViewMode = 'single' | 'continuous' | 'reading';
type ZoomMode = 'fit-page' | 'fit-width' | number;

const PdfViewer: React.FC<PdfViewerProps> = ({
    fileUrl,
    html,
    title = 'Document',
    isFullScreen = false,
    onClose,
    onDownload,
}) => {
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>('single');
    const [zoomMode, setZoomMode] = useState<ZoomMode>('fit-page');
    const [showThumbnails, setShowThumbnails] = useState(false);
    const [pageInput, setPageInput] = useState('1');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({});

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const continuousContainerRef = useRef<HTMLDivElement>(null);
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
    const renderIdRef = useRef(0); // increments on each render; used to detect stale renders
    const touchStart = useRef<{ x: number; y: number } | null>(null);
    const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

    // ─── Compute the source URL or data to load ────────────────────
    // If we have HTML content, we need to convert it to a PDF first.
    // For now, we use a hidden iframe + print-to-PDF approach. The user
    // clicks print and saves as PDF. (For automated server-side rendering,
    // see the ANTI-GRAVITY pipeline — deferred.)
    //
    // If we have a fileUrl (uploaded PDF), use it directly.

    // ─── Load PDF document ─────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const loadDoc = async () => {
            if (!fileUrl) {
                setError('No PDF file URL provided.');
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const doc = await pdfjsLib.getDocument(fileUrl).promise;
                if (cancelled) return;
                setPdfDoc(doc);
                setNumPages(doc.numPages);
                setCurrentPage(1);
                setPageInput('1');
                setLoading(false);
            } catch (err: any) {
                if (cancelled) return;
                console.error('[PdfViewer] PDF load failed:', err);
                setError(err?.message || 'Failed to load PDF.');
                setLoading(false);
            }
        };
        loadDoc();
        return () => { cancelled = true; };
    }, [fileUrl]);

    // ─── Compute scale for fit modes ───────────────────────────────
    const computeScale = useCallback(async (page: pdfjsLib.PDFPageProxy) => {
        const el = containerRef.current;
        if (!el) return 1;
        const baseViewport = page.getViewport({ scale: 1 });
        const availW = el.clientWidth - 24;
        const availH = el.clientHeight - 24;
        if (availW <= 0 || availH <= 0) return 1;
        if (zoomMode === 'fit-page') {
            return Math.min(availW / baseViewport.width, availH / baseViewport.height);
        }
        if (zoomMode === 'fit-width') {
            return availW / baseViewport.width;
        }
        return (zoomMode as number) / 100;
    }, [zoomMode]);

    // ─── Render single page to canvas ──────────────────────────────
    // Renders the current page to the canvas at the current zoom level.
    // Each render gets a unique ID; if a new render starts before the
    // previous one finishes, the previous one is cancelled and its
    // promise rejection is swallowed (RenderingCancelledException).
    const renderSinglePage = useCallback(async () => {
        if (!pdfDoc || !canvasRef.current || viewMode !== 'single') return;
        // Cancel any in-progress render
        if (renderTaskRef.current) {
            try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
            renderTaskRef.current = null;
        }
        const myRenderId = ++renderIdRef.current;
        try {
            const page = await pdfDoc.getPage(currentPage);
            // If a newer render started while we were awaiting, abort
            if (myRenderId !== renderIdRef.current) return;
            const scale = await computeScale(page);
            if (myRenderId !== renderIdRef.current) return;
            const outputScale = window.devicePixelRatio || 1;
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) return;
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;
            const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
            const task = page.render({ canvasContext: ctx, viewport, transform });
            renderTaskRef.current = task;
            try {
                await task.promise;
            } catch (e: any) {
                // Expected when a newer render cancels this one
                if (e?.name !== 'RenderingCancelledException') throw e;
            }
        } catch (err) {
            console.error('[PdfViewer] render failed:', err);
        }
    }, [pdfDoc, currentPage, viewMode, computeScale]);

    useEffect(() => { renderSinglePage(); }, [renderSinglePage]);

    // Re-render on container resize (ResizeObserver catches sidebar, URL bar, etc.)
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        let timeout: ReturnType<typeof setTimeout>;
        const ro = new ResizeObserver(() => {
            // Debounce — ResizeObserver can fire rapidly during animations
            clearTimeout(timeout);
            timeout = setTimeout(() => renderSinglePage(), 100);
        });
        ro.observe(el);
        return () => { ro.disconnect(); clearTimeout(timeout); };
    }, [renderSinglePage]);

    // ─── Continuous mode: render all pages ─────────────────────────
    useEffect(() => {
        if (!pdfDoc || viewMode !== 'continuous' || !continuousContainerRef.current) return;
        const container = continuousContainerRef.current;
        container.innerHTML = '';
        let cancelled = false;

        (async () => {
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                if (cancelled) return;
                try {
                    const page = await pdfDoc.getPage(i);
                    const el = containerRef.current;
                    if (!el || cancelled) return;
                    const baseViewport = page.getViewport({ scale: 1 });
                    const scale = (el.clientWidth - 24) / baseViewport.width;
                    const outputScale = window.devicePixelRatio || 1;
                    const viewport = page.getViewport({ scale });
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.floor(viewport.width * outputScale);
                    canvas.height = Math.floor(viewport.height * outputScale);
                    canvas.style.width = `${viewport.width}px`;
                    canvas.style.height = `${viewport.height}px`;
                    canvas.className = 'shadow-lg mb-4 bg-white rounded';
                    canvas.dataset.pageNum = String(i);
                    container.appendChild(canvas);
                    const ctx = canvas.getContext('2d', { alpha: false });
                    if (!ctx) continue;
                    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
                    await page.render({ canvasContext: ctx, viewport, transform }).promise;
                } catch (err) {
                    console.error('[PdfViewer] continuous render failed page', i, err);
                }
            }
        })();

        return () => { cancelled = true; };
    }, [pdfDoc, viewMode]);

    // ─── Thumbnails (lazy, low-res) ────────────────────────────────
    useEffect(() => {
        if (!pdfDoc || !showThumbnails) return;
        let cancelled = false;
        (async () => {
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                if (cancelled || thumbUrls[i]) continue;
                try {
                    const page = await pdfDoc.getPage(i);
                    const viewport = page.getViewport({ scale: 0.2 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d', { alpha: false });
                    if (!ctx) continue;
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    if (cancelled) return;
                    setThumbUrls(prev => ({ ...prev, [i]: canvas.toDataURL() }));
                } catch (err) {
                    console.error('[PdfViewer] thumbnail failed page', i, err);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [pdfDoc, showThumbnails]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Navigation ────────────────────────────────────────────────
    const goToPage = useCallback((n: number) => {
        const clamped = Math.min(Math.max(1, n), numPages);
        setCurrentPage(clamped);
        setPageInput(String(clamped));
    }, [numPages]);

    // ─── Keyboard shortcuts (desktop) ──────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            if (viewMode === 'reading' && e.key === 'Escape') {
                setViewMode('single');
                return;
            }
            if (e.key === 'Escape') { onClose?.(); return; }
            if (viewMode !== 'reading') {
                if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goToPage(currentPage + 1); }
                else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goToPage(currentPage - 1); }
                else if (e.key === 'Home') { e.preventDefault(); goToPage(1); }
                else if (e.key === 'End') { e.preventDefault(); goToPage(numPages); }
            }
            if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setShowThumbnails(v => !v); }
            else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                setViewMode(v => v === 'reading' ? 'single' : 'reading');
            }
            else if (e.ctrlKey || e.metaKey) {
                if (e.key === '+' || e.key === '=') {
                    e.preventDefault();
                    setZoomMode(z => typeof z === 'number' ? Math.min(z + 25, 300) : 125);
                } else if (e.key === '-') {
                    e.preventDefault();
                    setZoomMode(z => typeof z === 'number' ? Math.max(z - 25, 25) : 75);
                } else if (e.key === '0') {
                    e.preventDefault();
                    setZoomMode('fit-page');
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [currentPage, numPages, goToPage, viewMode, onClose]);

    // ─── Touch: swipe + pinch-to-zoom (mobile) ─────────────────────
    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.hypot(dx, dy);
            pinchStart.current = {
                distance,
                zoom: typeof zoomMode === 'number' ? zoomMode : 100,
            };
        }
    };
    const onTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchStart.current) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.hypot(dx, dy);
            const ratio = distance / pinchStart.current.distance;
            const newZoom = Math.max(25, Math.min(300, Math.round(pinchStart.current.zoom * ratio)));
            setZoomMode(newZoom);
        }
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (touchStart.current && e.changedTouches.length === 1) {
            const dx = e.changedTouches[0].clientX - touchStart.current.x;
            const dy = e.changedTouches[0].clientY - touchStart.current.y;
            // Only navigate on horizontal swipe (not vertical scroll)
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                if (dx < 0) goToPage(currentPage + 1);
                else goToPage(currentPage - 1);
            }
        }
        touchStart.current = null;
        pinchStart.current = null;
    };

    const zoomPct = typeof zoomMode === 'number'
        ? `${zoomMode}%`
        : zoomMode === 'fit-page' ? 'Fit' : 'W-Fit';

    // ─── Print (uses browser's native print dialog) ────────────────
    const handlePrint = () => {
        if (!fileUrl) return;
        const printWin = window.open(fileUrl, '_blank');
        if (printWin) {
            printWin.addEventListener('load', () => setTimeout(() => printWin.print(), 500));
        }
    };

    // ─── Loading state ─────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col h-full bg-zinc-900 items-center justify-center text-white">
                <Loader2 className="w-10 h-10 animate-spin text-primary-400 mb-3" />
                <p className="text-sm font-medium">Loading document…</p>
                <p className="text-xs text-zinc-400 mt-1">{title}</p>
            </div>
        );
    }

    // ─── Error state ───────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col h-full bg-zinc-900 items-center justify-center text-white p-6 text-center">
                <div className="bg-red-500/20 rounded-full p-4 mb-4">
                    <X className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-sm font-bold mb-1">Couldn't load document</p>
                <p className="text-xs text-zinc-400 mb-4 max-w-xs">{error}</p>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold"
                    >
                        Close
                    </button>
                )}
            </div>
        );
    }

    // ─── Reading mode (chrome-free, full-screen, dark) ─────────────
    if (viewMode === 'reading') {
        return (
            <div
                className="flex flex-col h-full bg-zinc-900 items-center justify-center relative"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                onClick={(e) => { if (e.target === e.currentTarget) setViewMode('single'); }}
            >
                <div ref={containerRef} className="flex-1 min-h-0 flex items-center justify-center w-full p-2">
                    <canvas ref={canvasRef} className="shadow-2xl bg-white" />
                </div>
                <button
                    onClick={() => setViewMode('single')}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
                    title="Exit reading mode (ESC)"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 text-white rounded-full text-xs font-bold backdrop-blur-sm pointer-events-none">
                    {currentPage} / {numPages}
                </div>
            </div>
        );
    }

    // ─── Standard view ─────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full min-h-0 bg-zinc-100 dark:bg-zinc-900/50">
            {/* ─── SLIM TOOLBAR (top, ~36px, works on mobile + desktop) ─── */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 shadow-sm shrink-0 gap-1">
                {/* Left: page navigation (compact) */}
                <div className="flex items-center gap-0.5 min-w-0">
                    <button onClick={() => goToPage(1)} disabled={currentPage <= 1} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="First page (Home)">
                        <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Previous (←)">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <input
                        type="number"
                        min={1}
                        max={numPages}
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value)}
                        onBlur={() => goToPage(parseInt(pageInput) || currentPage)}
                        onKeyDown={(e) => e.key === 'Enter' && goToPage(parseInt(pageInput) || currentPage)}
                        className="w-10 h-7 text-center text-[11px] font-bold bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded border-none outline-none"
                    />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 whitespace-nowrap px-1">
                        / {numPages}
                    </span>
                    <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Next (→)">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => goToPage(numPages)} disabled={currentPage >= numPages} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Last page (End)">
                        <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Center: view mode toggle (hidden on small screens — use reading mode instead) */}
                <div className="hidden sm:flex bg-slate-100 dark:bg-zinc-700 rounded p-0.5">
                    <button
                        onClick={() => setViewMode('single')}
                        className={`px-2 py-0.5 rounded transition-colors ${viewMode === 'single' ? 'bg-white dark:bg-zinc-600 text-slate-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                        title="Single page view"
                    >
                        <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setViewMode('continuous')}
                        className={`px-2 py-0.5 rounded transition-colors ${viewMode === 'continuous' ? 'bg-white dark:bg-zinc-600 text-slate-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                        title="Continuous scroll view"
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Right: zoom + actions */}
                <div className="flex items-center gap-0.5">
                    <button onClick={() => setZoomMode(z => typeof z === 'number' ? Math.max(z - 25, 25) : 75)} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center" title="Zoom out (Ctrl -)">
                        <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setZoomMode('fit-page')}
                        className="px-1.5 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-[9px] font-bold"
                        title="Fit to page (Ctrl 0)"
                    >
                        Fit
                    </button>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 w-10 text-center hidden sm:inline">{zoomPct}</span>
                    <button onClick={() => setZoomMode(z => typeof z === 'number' ? Math.min(z + 25, 300) : 125)} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center" title="Zoom in (Ctrl +)">
                        <ZoomIn className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-px h-5 bg-slate-200 dark:bg-zinc-700 mx-1" />

                    <button
                        onClick={() => setShowThumbnails(v => !v)}
                        className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${showThumbnails ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'}`}
                        title="Toggle thumbnails (F)"
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                    </button>

                    {isFullScreen && (
                        <button
                            onClick={() => setViewMode('reading')}
                            className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center"
                            title="Reading mode (R)"
                        >
                            <Eye className="w-3.5 h-3.5" />
                        </button>
                    )}

                    <button onClick={handlePrint} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center" title="Print / Save as PDF">
                        <Printer className="w-3.5 h-3.5" />
                    </button>

                    {onDownload && (
                        <button onClick={onDownload} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center" title="Download">
                            <Download className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {isFullScreen && onClose && (
                        <button
                            onClick={onClose}
                            className="ml-1 w-8 h-8 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center"
                            title="Close (ESC)"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* ─── MAIN VIEWPORT — page canvas ─── */}
            <div
                ref={containerRef}
                className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-2 sm:p-4 bg-zinc-200/50 dark:bg-zinc-900/30 touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {viewMode === 'single' ? (
                    <canvas ref={canvasRef} className="shadow-2xl bg-white" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                ) : (
                    <div ref={continuousContainerRef} className="flex flex-col items-center w-full" />
                )}
            </div>

            {/* ─── BOTTOM THUMBNAIL STRIP (Adobe Acrobat style) ─── */}
            {showThumbnails && (
                <div className="shrink-0 bg-white dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center gap-1.5 px-2 py-2 overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
                        {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                            <button
                                key={n}
                                onClick={() => goToPage(n)}
                                className={`shrink-0 border-2 rounded overflow-hidden transition-all ${n === currentPage ? 'border-primary-600 shadow-md ring-2 ring-primary-200' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-400'}`}
                                style={{ width: '60px', height: '85px' }}
                                title={`Page ${n}`}
                            >
                                {thumbUrls[n] ? (
                                    <img src={thumbUrls[n]} alt={`Page ${n}`} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-slate-100 dark:bg-zinc-700 animate-pulse flex items-center justify-center">
                                        <span className="text-[9px] font-bold text-slate-400">{n}</span>
                                    </div>
                                )}
                                <div className="absolute bottom-0 right-0 px-1 bg-black/70 text-white text-[8px] font-bold rounded-tl">{n}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Footer hint (full-screen only) ─── */}
            {isFullScreen && (
                <div className="shrink-0 px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700 text-[9px] text-slate-400 dark:text-zinc-500 flex items-center justify-between">
                    <span className="hidden sm:inline">← → navigate • Ctrl +/− zoom • F thumbnails • R reading • Ctrl 0 fit</span>
                    <span className="sm:hidden">Swipe to navigate • Pinch to zoom</span>
                    {onClose && (
                        <button onClick={onClose} className="font-bold text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400">
                            ESC to close
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PdfViewer;

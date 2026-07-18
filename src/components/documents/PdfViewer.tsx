/**
 * PdfViewer — Professional PDF viewer built on pdf.js
 *
 * ANTI-GRAVITY spec compliance:
 *   1. Zoom state is a discriminated union — either fit-mode OR custom percent,
 *      never both. Toolbar shows "Fit" OR "75%", never "Fit / 75%".
 *   2. Page is centered both H and V. Uses inner wrapper with min-height: 100%
 *      so align-items: center works even when content overflows (browsers
 *      ignore align-items on overflowing flex containers).
 *   3. Bottom thumbnail strip is a real docked horizontal strip, not an overlay.
 *      Toggling it re-runs fit calculation (no stale empty space).
 *
 * Why pdf.js instead of HTML+CSS scale():
 *   - CSS transforms are visual-only — they don't change layout footprint,
 *     so fit-to-page math never quite works.
 *   - pdf.js renders to <canvas> with actual pixel dimensions, so the
 *     math is exact. This is what Chrome's and Firefox's built-in PDF
 *     viewers use.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    ZoomIn, ZoomOut, Maximize2, LayoutGrid, Eye, Download, Printer, X,
    Loader2,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).href;

export interface PdfViewerProps {
    fileUrl?: string;
    title?: string;
    isFullScreen?: boolean;
    onClose?: () => void;
    onDownload?: () => void;
}

type ViewMode = 'single' | 'continuous' | 'reading';

// ─── Discriminated zoom state (BUG 2 fix) ───────────────────────────
// Either we're in a fit mode (no percent shown) OR we're at a custom
// percent (no "Fit" label shown). Never both.
type ZoomState =
    | { mode: 'fit-page' }
    | { mode: 'fit-width' }
    | { mode: 'custom'; percent: number };

const ZOOM_STEP = 25;
const MIN_ZOOM = 25;
const MAX_ZOOM = 300;

const PdfViewer: React.FC<PdfViewerProps> = ({
    fileUrl,
    title = 'Document',
    isFullScreen = false,
    onClose,
    onDownload,
}) => {
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>('single');
    const [zoomState, setZoomState] = useState<ZoomState>({ mode: 'fit-page' });
    const [showThumbnails, setShowThumbnails] = useState(false);
    const [pageInput, setPageInput] = useState('1');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({});

    // Track the ACTUAL current rendered scale (for zoom in/out from any mode)
    const currentScaleRef = useRef(1);

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const continuousContainerRef = useRef<HTMLDivElement>(null);
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
    const renderIdRef = useRef(0);
    const touchStart = useRef<{ x: number; y: number } | null>(null);
    const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

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

    // ─── Compute scale from ZoomState ──────────────────────────────
    // Reads the container dimensions and the page's base viewport (scale=1)
    // to determine the actual pixel scale to render at.
    const computeScale = useCallback(async (page: pdfjsLib.PDFPageProxy): Promise<number> => {
        const el = containerRef.current;
        if (!el) return 1;
        const baseViewport = page.getViewport({ scale: 1 });
        const availW = el.clientWidth - 24;
        const availH = el.clientHeight - 24;
        if (availW <= 0 || availH <= 0) return 1;
        if (zoomState.mode === 'fit-page') {
            return Math.min(availW / baseViewport.width, availH / baseViewport.height);
        }
        if (zoomState.mode === 'fit-width') {
            return availW / baseViewport.width;
        }
        return zoomState.percent / 100;
    }, [zoomState]);

    // ─── Render single page to canvas ──────────────────────────────
    // Renders in BOTH 'single' and 'reading' modes (the canvas exists in both).
    // Only skips in 'continuous' mode (which has its own render path).
    const renderSinglePage = useCallback(async () => {
        if (!pdfDoc || !canvasRef.current || viewMode === 'continuous') return;
        if (renderTaskRef.current) {
            try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
            renderTaskRef.current = null;
        }
        const myRenderId = ++renderIdRef.current;
        try {
            const page = await pdfDoc.getPage(currentPage);
            if (myRenderId !== renderIdRef.current) return;
            const scale = await computeScale(page);
            if (myRenderId !== renderIdRef.current) return;
            // Track actual rendered scale for zoom-in/out from any mode
            currentScaleRef.current = scale;
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
                if (e?.name !== 'RenderingCancelledException') throw e;
            }
        } catch (err) {
            console.error('[PdfViewer] render failed:', err);
        }
    }, [pdfDoc, currentPage, viewMode, computeScale]);

    useEffect(() => {
        // When entering reading mode, the canvas DOM node changes.
        // Wait one frame so the new canvas is mounted before rendering.
        if (viewMode === 'reading') {
            const raf = requestAnimationFrame(() => renderSinglePage());
            return () => cancelAnimationFrame(raf);
        }
        renderSinglePage();
    }, [renderSinglePage, viewMode]);

    // ─── ResizeObserver: re-render on container resize ─────────────
    // Catches sidebar toggle, thumbnail strip toggle, URL bar show/hide,
    // window resize — all the cases window.resize misses.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        let timeout: ReturnType<typeof setTimeout>;
        const ro = new ResizeObserver(() => {
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

    // ─── Zoom handlers (BUG 2 fix: discriminated state) ────────────
    // Zoom in/out reads the ACTUAL current rendered scale (currentScaleRef),
    // not a stale percent. Switches to { mode: 'custom', percent }.
    const handleZoomIn = useCallback(() => {
        const currentPercent = Math.round(currentScaleRef.current * 100);
        const newPercent = Math.min(MAX_ZOOM, currentPercent + ZOOM_STEP);
        setZoomState({ mode: 'custom', percent: newPercent });
    }, []);

    const handleZoomOut = useCallback(() => {
        const currentPercent = Math.round(currentScaleRef.current * 100);
        const newPercent = Math.max(MIN_ZOOM, currentPercent - ZOOM_STEP);
        setZoomState({ mode: 'custom', percent: newPercent });
    }, []);

    const handleFit = useCallback(() => {
        setZoomState({ mode: 'fit-page' });
    }, []);

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
                if (e.key === '+' || e.key === '=') { e.preventDefault(); handleZoomIn(); }
                else if (e.key === '-') { e.preventDefault(); handleZoomOut(); }
                else if (e.key === '0') { e.preventDefault(); handleFit(); }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [currentPage, numPages, goToPage, viewMode, onClose, handleZoomIn, handleZoomOut, handleFit]);

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
                zoom: Math.round(currentScaleRef.current * 100),
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
            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(pinchStart.current.zoom * ratio)));
            setZoomState({ mode: 'custom', percent: newZoom });
        }
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (touchStart.current && e.changedTouches.length === 1) {
            const dx = e.changedTouches[0].clientX - touchStart.current.x;
            const dy = e.changedTouches[0].clientY - touchStart.current.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                if (dx < 0) goToPage(currentPage + 1);
                else goToPage(currentPage - 1);
            }
        }
        touchStart.current = null;
        pinchStart.current = null;
    };

    // ─── Zoom indicator: EITHER "Fit" OR percent, never both ───────
    const zoomLabel = zoomState.mode === 'fit-page'
        ? 'Fit'
        : zoomState.mode === 'fit-width'
            ? 'W-Fit'
            : `${zoomState.percent}%`;
    const isFitMode = zoomState.mode !== 'custom';

    // ─── Print ─────────────────────────────────────────────────────
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
                    <button onClick={onClose} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold">
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
                <div ref={containerRef} className="flex-1 min-h-0 flex items-center justify-center w-full p-2 overflow-auto">
                    <div className="min-h-full flex items-center justify-center w-full">
                        <canvas ref={canvasRef} className="shadow-2xl bg-white" />
                    </div>
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
            {/* ─── SLIM TOOLBAR ─── */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 shadow-sm shrink-0 gap-1">
                {/* Left: page navigation */}
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

                {/* Center: view mode toggle (hidden on small screens) */}
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
                    <button onClick={handleZoomOut} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center" title="Zoom out (Ctrl -)">
                        <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={handleFit}
                        className={`px-2 h-7 rounded text-[9px] font-bold transition-colors ${isFitMode ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'}`}
                        title="Fit to page (Ctrl 0)"
                    >
                        Fit
                    </button>
                    {/* Single zoom indicator: either "Fit" OR percent, never both */}
                    <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 w-10 text-center hidden sm:inline">{zoomLabel}</span>
                    <button onClick={handleZoomIn} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center" title="Zoom in (Ctrl +)">
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

            {/* ─── MAIN VIEWPORT ───
                BUG 1 fix: outer wrapper is overflow-auto, inner wrapper has
                min-h-full + flex centering. This makes align-items: center
                work even when the page is taller than the viewport (browsers
                ignore align-items on overflowing flex containers, but the
                min-h-full inner wrapper restores centering). */}
            <div
                ref={containerRef}
                className="flex-1 min-h-0 overflow-auto bg-zinc-200/50 dark:bg-zinc-900/30 touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {viewMode === 'single' ? (
                    <div className="min-h-full w-full flex items-center justify-center p-3 sm:p-6">
                        <canvas ref={canvasRef} className="shadow-2xl bg-white" style={{ flexShrink: 0 }} />
                    </div>
                ) : (
                    <div ref={continuousContainerRef} className="flex flex-col items-center w-full p-3 sm:p-6" />
                )}
            </div>

            {/* ─── BOTTOM THUMBNAIL STRIP (BUG 3 fix) ───
                Real docked horizontal strip, not overlay. Fixed height ~96px.
                When toggled off, the main viewport reclaims the space
                (flex layout handles this automatically). */}
            {showThumbnails && (
                <div className="shrink-0 bg-white dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700" style={{ height: '110px' }}>
                    <div className="flex items-center gap-1.5 px-2 py-2 overflow-x-auto overflow-y-hidden custom-scrollbar h-full" style={{ scrollbarWidth: 'thin' }}>
                        {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                            <button
                                key={n}
                                onClick={() => goToPage(n)}
                                className={`relative shrink-0 rounded-md overflow-hidden border-2 transition-all ${n === currentPage ? 'border-primary-600 shadow-md ring-2 ring-primary-200' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-400'}`}
                                style={{ width: '72px', height: '94px' }}
                                title={`Page ${n}`}
                            >
                                {thumbUrls[n] ? (
                                    <img src={thumbUrls[n]} alt={`Page ${n}`} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-slate-100 dark:bg-zinc-700 animate-pulse flex items-center justify-center">
                                        <span className="text-[10px] font-bold text-slate-400">{n}</span>
                                    </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/70 text-white text-[9px] font-bold text-center">
                                    {n}
                                </div>
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

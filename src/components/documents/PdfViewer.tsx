import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
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

// Configure pdf.js worker. Using the URL constructor ensures Vite bundles
// the worker file correctly during build.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).href;

type ViewMode = 'single' | 'continuous' | 'reading';

type ZoomState =
    | { mode: 'fit-page' }
    | { mode: 'fit-width' }
    | { mode: 'custom'; percent: number };

export interface PdfViewerProps {
    fileUrl?: string;
    title?: string;
    isFullScreen?: boolean;
    onClose?: () => void;
    onDownload?: () => void;
}

const MIN_ZOOM = 25;
const MAX_ZOOM = 400;
const ZOOM_STEP = 25;

const PdfViewer: React.FC<PdfViewerProps> = ({
    fileUrl,
    title,
    isFullScreen,
    onClose,
    onDownload,
}) => {
    // ─── Core PDF state ───────────────────────────────────────────────
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ─── UI state ─────────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<ViewMode>('single');
    const [zoom, setZoom] = useState<ZoomState>({ mode: 'fit-page' });
    const [showThumbnails, setShowThumbnails] = useState(false);

    // ─── Refs ─────────────────────────────────────────────────────────
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const currentRenderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
    const renderIdRef = useRef(0);
    // Actual rendered scale on the canvas — read by zoom in/out buttons so
    // they always operate on the live value rather than the stale `percent`.
    const actualScaleRef = useRef(1);
    const [actualScale, setActualScale] = useState(1);
    const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
    // For touch pinch-zoom tracking
    const touchStateRef = useRef<{
        initialDistance: number;
        initialScale: number;
    } | null>(null);
    // For touch swipe navigation
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    // ─── Load the PDF document ────────────────────────────────────────
    useEffect(() => {
        if (!fileUrl) {
            setError('No file URL provided.');
            setLoading(false);
            return;
        }

        let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
        let cancelled = false;

        const loadPdf = async () => {
            setLoading(true);
            setError(null);
            try {
                loadingTask = pdfjsLib.getDocument(fileUrl);
                const doc = await loadingTask.promise;
                if (cancelled) return;
                setPdfDoc(doc);
                setNumPages(doc.numPages);
                setCurrentPage(1);
                setLoading(false);
            } catch (e: any) {
                if (cancelled) return;
                console.error('[PdfViewer] Failed to load PDF:', e);
                setError(e?.message || 'Could not open this PDF file.');
                setLoading(false);
            }
        };

        loadPdf();

        return () => {
            cancelled = true;
            if (loadingTask) {
                try {
                    loadingTask.destroy();
                } catch {
                    /* noop */
                }
            }
            if (currentRenderTaskRef.current) {
                try {
                    currentRenderTaskRef.current.cancel();
                } catch {
                    /* noop */
                }
            }
        };
    }, [fileUrl]);

    // ─── Compute the target scale for a given page based on zoom state ─
    const computeScale = useCallback(
        (page: pdfjsLib.PDFPageProxy): number => {
            const container = containerRef.current;
            if (!container) return 1;

            const containerWidth = container.clientWidth - 32; // padding
            const containerHeight = container.clientHeight - 32;

            if (zoom.mode === 'fit-page') {
                const scaleW = containerWidth / page.getViewport({ scale: 1 }).width;
                const scaleH = containerHeight / page.getViewport({ scale: 1 }).height;
                return Math.max(0.1, Math.min(scaleW, scaleH));
            }
            if (zoom.mode === 'fit-width') {
                return Math.max(0.1, containerWidth / page.getViewport({ scale: 1 }).width);
            }
            // custom percent
            return zoom.percent / 100;
        },
        [zoom]
    );

    // ─── Render a single page to the canvas (single/reading modes) ────
    const renderPage = useCallback(
        async (pageNum: number) => {
            if (!pdfDoc) return;
            const myRenderId = ++renderIdRef.current;

            // Cancel any in-flight render
            if (currentRenderTaskRef.current) {
                try {
                    currentRenderTaskRef.current.cancel();
                } catch {
                    /* noop */
                }
                currentRenderTaskRef.current = null;
            }

            try {
                const page = await pdfDoc.getPage(pageNum);
                if (myRenderId !== renderIdRef.current) return; // superseded

                const container = containerRef.current;
                const canvas = canvasRef.current;
                if (!container || !canvas) return;

                const scale = computeScale(page);
                const viewport = page.getViewport({ scale });
                const dpr = window.devicePixelRatio || 1;

                // Crisp rendering: canvas backing store multiplied by DPR
                canvas.width = Math.floor(viewport.width * dpr);
                canvas.height = Math.floor(viewport.height * dpr);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                const renderTask = page.render({
                    canvasContext: ctx,
                    viewport,
                });
                currentRenderTaskRef.current = renderTask;

                await renderTask.promise;
                if (myRenderId !== renderIdRef.current) return; // superseded

                actualScaleRef.current = scale;
                setActualScale(scale);
            } catch (e: any) {
                if (e?.name === 'RenderingCancelledException') return;
                // Don't surface a UI error for cancellation noise
                if (myRenderId !== renderIdRef.current) return;
                console.error('[PdfViewer] renderPage failed:', e);
            }
        },
        [pdfDoc, computeScale]
    );

    // ─── Render the current page whenever inputs change ───────────────
    useEffect(() => {
        if (!pdfDoc || loading || viewMode === 'continuous') return;
        renderPage(currentPage);
    }, [pdfDoc, currentPage, viewMode, loading, renderPage]);

    // ─── Continuous mode: render ALL pages into their own canvases ────
    // Each page is rendered lazily by an inner <PdfPageCanvas> component
    // so that we don't fight the browser by rendering hundreds of pages at once.
    useEffect(() => {
        // Reset page refs whenever the document or view mode changes
        pageRefs.current = {};
    }, [pdfDoc, viewMode]);

    // ─── ResizeObserver: recompute fit when container resizes ─────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const ro = new ResizeObserver(() => {
            // Only auto-recompute fit modes; custom zoom is user-controlled
            if (zoom.mode !== 'custom') {
                if (viewMode === 'continuous') {
                    // Force a re-render of all page canvases by bumping their key
                    pageRefs.current = {};
                    // Trigger re-render via state tick
                    setActualScale(s => (s === 0 ? 0.0001 : 0));
                } else if (pdfDoc) {
                    renderPage(currentPage);
                }
            }
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, [zoom.mode, viewMode, pdfDoc, currentPage, renderPage]);

    // ─── Navigation helpers ───────────────────────────────────────────
    const goToPage = useCallback(
        (page: number) => {
            if (!numPages) return;
            const target = Math.max(1, Math.min(numPages, page));
            setCurrentPage(target);
            if (viewMode === 'continuous') {
                const el = pageRefs.current[target];
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        },
        [numPages, viewMode]
    );

    const nextPage = useCallback(() => {
        if (viewMode === 'continuous') {
            // Find the page whose top is closest to the scroll container top
            const scroller = scrollAreaRef.current;
            if (!scroller) return;
            const scrollTop = scroller.scrollTop;
            let bestPage = currentPage;
            let bestDist = Infinity;
            for (let p = 1; p <= numPages; p++) {
                const el = pageRefs.current[p];
                if (!el) continue;
                const dist = Math.abs(el.offsetTop - scroller.offsetTop - scrollTop);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestPage = p;
                }
            }
            const target = Math.min(numPages, bestPage + 1);
            setCurrentPage(target);
            pageRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            setCurrentPage(p => Math.min(numPages, p + 1));
        }
    }, [numPages, viewMode, currentPage]);

    const prevPage = useCallback(() => {
        if (viewMode === 'continuous') {
            const scroller = scrollAreaRef.current;
            if (!scroller) return;
            const scrollTop = scroller.scrollTop;
            let bestPage = currentPage;
            let bestDist = Infinity;
            for (let p = 1; p <= numPages; p++) {
                const el = pageRefs.current[p];
                if (!el) continue;
                const dist = Math.abs(el.offsetTop - scroller.offsetTop - scrollTop);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestPage = p;
                }
            }
            const target = Math.max(1, bestPage - 1);
            setCurrentPage(target);
            pageRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            setCurrentPage(p => Math.max(1, p - 1));
        }
    }, [numPages, viewMode, currentPage]);

    // ─── Zoom helpers (read actual scale from ref, not stale percent) ─
    const zoomIn = useCallback(() => {
        const currentPercent = Math.round(actualScaleRef.current * 100);
        const next = Math.min(MAX_ZOOM, currentPercent + ZOOM_STEP);
        setZoom({ mode: 'custom', percent: next });
    }, []);

    const zoomOut = useCallback(() => {
        const currentPercent = Math.round(actualScaleRef.current * 100);
        const next = Math.max(MIN_ZOOM, currentPercent - ZOOM_STEP);
        setZoom({ mode: 'custom', percent: next });
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

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
                e.preventDefault();
                nextPage();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
                e.preventDefault();
                prevPage();
            } else if (e.key === 'Home') {
                e.preventDefault();
                goToPage(1);
            } else if (e.key === 'End') {
                e.preventDefault();
                goToPage(numPages);
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
                    setViewMode('single');
                } else if (isFullScreen && onClose) {
                    e.preventDefault();
                    onClose();
                }
            }
        };

        const el = containerRef.current;
        el?.addEventListener('keydown', handleKey);
        return () => el?.removeEventListener('keydown', handleKey);
    }, [nextPage, prevPage, goToPage, numPages, zoomIn, zoomOut, zoomReset, viewMode, isFullScreen, onClose]);

    // ─── Touch handlers: swipe (horizontal) + pinch-to-zoom ───────────
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
            // Single-finger swipe that ended quickly
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

    // ─── Print + download ─────────────────────────────────────────────
    const handlePrint = useCallback(() => {
        if (fileUrl) window.open(fileUrl, '_blank', 'noopener');
    }, [fileUrl]);

    // ─── Derived display values ───────────────────────────────────────
    const isDark = viewMode === 'reading';
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
                    {isFullScreen && onClose && (
                        <button
                            onClick={onClose}
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
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <p
                            className={`text-xs font-bold truncate ${
                                isDark ? 'text-zinc-200' : 'text-slate-700 dark:text-zinc-200'
                            }`}
                        >
                            {title || 'PDF Document'}
                        </p>
                    </div>
                </div>

                {/* Center: page navigation */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={() => goToPage(1)}
                        disabled={currentPage <= 1}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        title="First page (Home)"
                    >
                        <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={prevPage}
                        disabled={currentPage <= 1}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Previous page (←)"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span
                        className={`text-2xs font-bold w-16 text-center ${
                            isDark ? 'text-zinc-400' : 'text-slate-500 dark:text-zinc-400'
                        }`}
                    >
                        {currentPage} / {numPages || '–'}
                    </span>
                    <button
                        onClick={nextPage}
                        disabled={currentPage >= numPages}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Next page (→)"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => goToPage(numPages)}
                        disabled={currentPage >= numPages}
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
                            onClick={() => setViewMode('single')}
                            className={`p-1.5 rounded-md transition-all ${
                                viewMode === 'single'
                                    ? 'bg-white dark:bg-zinc-800 shadow text-primary-600'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'
                            }`}
                            title="Single page (default)"
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

                    {/* Download */}
                    {onDownload && (
                        <button
                            onClick={onDownload}
                            className="w-7 h-7 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors flex items-center justify-center"
                            title="Download"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Page area ─── */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <Loader2 className="w-10 h-10 text-primary-600 animate-spin mb-3" />
                        <p className={`text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                            Loading PDF…
                        </p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full mb-4">
                            <X className="w-8 h-8 text-red-500" />
                        </div>
                        <p className={`font-bold mb-1 ${isDark ? 'text-zinc-200' : 'text-slate-700 dark:text-zinc-200'}`}>
                            Couldn't open PDF
                        </p>
                        <p className={`text-sm mb-4 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>{error}</p>
                        {fileUrl && (
                            <a
                                href={fileUrl}
                                download={title || 'document.pdf'}
                                className="px-5 py-2 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 transition-colors"
                            >
                                Download instead
                            </a>
                        )}
                    </div>
                ) : !pdfDoc ? null : viewMode === 'continuous' ? (
                    <div
                        ref={scrollAreaRef}
                        className={`flex-1 overflow-auto custom-scrollbar ${isDark ? 'bg-zinc-950' : 'bg-slate-300/40 dark:bg-zinc-900/30'}`}
                    >
                        <div className="flex flex-col items-center gap-4 py-4 px-4">
                            {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
                                <PdfPageCanvas
                                    key={`${pdfDoc?.docId || 'doc'}-${pageNum}`}
                                    pdfDoc={pdfDoc}
                                    pageNum={pageNum}
                                    zoom={zoom}
                                    container={containerRef.current}
                                    isDark={isDark}
                                    onRefChange={(el) => {
                                        pageRefs.current[pageNum] = el;
                                    }}
                                    onVisible={(p) => {
                                        // Update currentPage as user scrolls
                                        setCurrentPage(prev => (prev !== p ? p : prev));
                                    }}
                                />
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
                            <canvas
                                ref={canvasRef}
                                className="bg-white dark:bg-zinc-900 shadow-2xl border border-slate-300 dark:border-zinc-700"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Bottom thumbnail strip ─── */}
            {showThumbnails && pdfDoc && !loading && !error && (
                <div
                    className={`flex-shrink-0 border-t overflow-x-auto custom-scrollbar px-3 py-2 ${
                        isDark
                            ? 'bg-zinc-900 border-zinc-800'
                            : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'
                    }`}
                    style={{ maxHeight: '180px' }}
                >
                    <div className="flex items-end gap-2 h-[150px]">
                        {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
                            <PdfThumbnail
                                key={`thumb-${pageNum}`}
                                pdfDoc={pdfDoc}
                                pageNum={pageNum}
                                isActive={pageNum === currentPage}
                                onClick={() => goToPage(pageNum)}
                                isDark={isDark}
                            />
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

// ─── Inner component: renders a single PDF page to its own canvas.
// Used in continuous mode so each page is rendered independently.
const PdfPageCanvas: React.FC<{
    pdfDoc: pdfjsLib.PDFDocumentProxy;
    pageNum: number;
    zoom: ZoomState;
    container: HTMLDivElement | null;
    isDark: boolean;
    onRefChange: (el: HTMLDivElement | null) => void;
    onVisible: (pageNum: number) => void;
}> = ({ pdfDoc, pageNum, zoom, container, onRefChange, onVisible }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
    const renderIdRef = useRef(0);

    const computeScale = useCallback(
        (page: pdfjsLib.PDFPageProxy): number => {
            if (!container) return 1;
            const containerWidth = container.clientWidth - 32;
            if (zoom.mode === 'fit-page') {
                // In continuous mode, fit-width is the natural fit
                return Math.max(0.1, containerWidth / page.getViewport({ scale: 1 }).width);
            }
            if (zoom.mode === 'fit-width') {
                return Math.max(0.1, containerWidth / page.getViewport({ scale: 1 }).width);
            }
            return zoom.percent / 100;
        },
        [container, zoom]
    );

    useEffect(() => {
        let mounted = true;
        const myRenderId = ++renderIdRef.current;

        const render = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
                if (!mounted || myRenderId !== renderIdRef.current) return;
                const canvas = canvasRef.current;
                if (!canvas) return;

                if (renderTaskRef.current) {
                    try {
                        renderTaskRef.current.cancel();
                    } catch {
                        /* noop */
                    }
                }

                const scale = computeScale(page);
                const viewport = page.getViewport({ scale });
                const dpr = window.devicePixelRatio || 1;

                canvas.width = Math.floor(viewport.width * dpr);
                canvas.height = Math.floor(viewport.height * dpr);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                const task = page.render({ canvasContext: ctx, viewport });
                renderTaskRef.current = task;
                await task.promise;
            } catch (e: any) {
                if (e?.name === 'RenderingCancelledException') return;
                if (myRenderId !== renderIdRef.current) return;
                console.error('[PdfPageCanvas] render failed:', e);
            }
        };

        render();

        return () => {
            mounted = false;
            if (renderTaskRef.current) {
                try {
                    renderTaskRef.current.cancel();
                } catch {
                    /* noop */
                }
            }
        };
    }, [pdfDoc, pageNum, computeScale]);

    // Observe visibility to update the current page indicator
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                        onVisible(pageNum);
                    }
                });
            },
            { threshold: [0.5] }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [pageNum, onVisible]);

    return (
        <div
            ref={(el) => {
                wrapRef.current = el;
                onRefChange(el);
            }}
            className="flex-shrink-0 relative"
        >
            <canvas
                ref={canvasRef}
                className="bg-white dark:bg-zinc-900 shadow-2xl border border-slate-300 dark:border-zinc-700"
            />
            <div className="absolute bottom-2 right-2 text-2xs font-bold text-slate-600 bg-white/80 px-2 py-0.5 rounded">
                {pageNum}
            </div>
        </div>
    );
};

// ─── Lazy-loaded thumbnail (renders at low resolution) ───────────────
const PdfThumbnail: React.FC<{
    pdfDoc: pdfjsLib.PDFDocumentProxy;
    pageNum: number;
    isActive: boolean;
    onClick: () => void;
    isDark: boolean;
}> = ({ pdfDoc, pageNum, isActive, onClick, isDark }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
    const [loaded, setLoaded] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        let cancelled = false;

        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !loaded) {
                        observer.disconnect();
                        renderThumb();
                    }
                });
            },
            { root: wrap.parentElement, rootMargin: '50px' }
        );
        observer.observe(wrap);

        const renderThumb = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
                if (cancelled) return;
                const canvas = canvasRef.current;
                if (!canvas) return;
                const baseViewport = page.getViewport({ scale: 1 });
                const targetHeight = 130;
                const scale = targetHeight / baseViewport.height;
                const viewport = page.getViewport({ scale });
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                if (renderTaskRef.current) {
                    try {
                        renderTaskRef.current.cancel();
                    } catch {
                        /* noop */
                    }
                }
                const task = page.render({ canvasContext: ctx, viewport });
                renderTaskRef.current = task;
                await task.promise;
                if (!cancelled) setLoaded(true);
            } catch (e: any) {
                if (e?.name === 'RenderingCancelledException') return;
                // swallow
            }
        };

        return () => {
            cancelled = true;
            observer.disconnect();
            if (renderTaskRef.current) {
                try {
                    renderTaskRef.current.cancel();
                } catch {
                    /* noop */
                }
            }
        };
    }, [pdfDoc, pageNum, loaded]);

    return (
        <button
            ref={wrapRef}
            onClick={onClick}
            className={`flex-shrink-0 flex flex-col items-center gap-1 px-1 py-1 rounded-lg transition-all ${
                isActive
                    ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-600'
                    : isDark
                    ? 'hover:bg-zinc-800'
                    : 'hover:bg-slate-100 dark:hover:bg-zinc-700'
            }`}
            style={{ height: '160px' }}
            title={`Page ${pageNum}`}
        >
            <div
                className={`flex-1 flex items-center justify-center bg-white dark:bg-zinc-900 ${
                    loaded ? '' : 'w-[100px]'
                }`}
                style={{ minHeight: '130px' }}
            >
                {!loaded && (
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                )}
                <canvas
                    ref={canvasRef}
                    className={loaded ? 'block' : 'hidden'}
                    style={{ maxHeight: '130px', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
                />
            </div>
            <span
                className={`text-3xs font-bold ${
                    isActive ? 'text-primary-700 dark:text-primary-300' : isDark ? 'text-zinc-400' : 'text-slate-500'
                }`}
            >
                {pageNum}
            </span>
        </button>
    );
};

export default PdfViewer;

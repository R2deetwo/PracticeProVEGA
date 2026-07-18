
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DocumentIcon, DownloadIcon, ArrowsExpandIcon } from '../../constants';
import { sanitize } from '../../utils/sanitization';

// ─── Adobe Acrobat-style HTML Page Preview ────────────────────────────
//
// Design references:
//   - Adobe Acrobat Reader default view: single page, fit-to-page (entire
//     page visible in viewport, centered both horizontally and vertically).
//   - Adobe Acrobat page navigator: horizontal thumbnail strip at the
//     BOTTOM (not the left sidebar), main page on top.
//   - Adobe Acrobat reading mode: hides all chrome, just the page.
//
// CRITICAL IMPLEMENTATION DETAIL — Page sizing:
//   Using `transform: scale()` alone does NOT change the element's layout
//   footprint. The browser still allocates 210mm × 297mm for the page
//   even when scaled to 50%. This breaks centering AND causes overflow.
//
//   Fix: Wrap the page in a container with the SCALED dimensions, then
//   apply transform: scale to the inner page. The outer container takes
//   the scaled size in layout, so flex centering works correctly.

export interface HtmlPagePreviewProps {
    html: string;
    title: string;
    isFullScreen?: boolean;
    onRequestFullScreen?: () => void;
    onRequestClose?: () => void;
}

type ViewMode = 'fit' | 'continuous';

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const PX_PER_MM = 3.7795;

const HtmlPagePreview: React.FC<HtmlPagePreviewProps> = ({
    html,
    title,
    isFullScreen = false,
    onRequestFullScreen,
    onRequestClose,
}) => {
    const [zoom, setZoom] = useState(100);
    const [currentPage, setCurrentPage] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>('fit');
    const [showThumbnails, setShowThumbnails] = useState(isFullScreen);
    const [readingMode, setReadingMode] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const pageAreaRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const thumbnailStripRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);

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

    // ─── Fit-to-page: zoom to fit ENTIRE page (width AND height) ────
    // Uses ResizeObserver (not window.resize) so it fires when the
    // container's size changes due to thumbnail strip toggle, sidebar
    // collapse, etc. — not just when the window resizes.
    const fitToPage = useCallback(() => {
        if (!pageAreaRef.current) return;
        const areaW = pageAreaRef.current.clientWidth;
        const areaH = pageAreaRef.current.clientHeight;
        if (areaW <= 0 || areaH <= 0) return;
        const pageW = PAGE_W_MM * PX_PER_MM;
        const pageH = PAGE_H_MM * PX_PER_MM;
        const zoomW = areaW / pageW;
        const zoomH = areaH / pageH;
        const fitZoom = Math.min(zoomW, zoomH) * 0.98; // 2% padding
        setZoom(Math.max(25, Math.min(300, Math.round(fitZoom * 100))));
    }, []);

    // ─── Fit-to-width: zoom to fit page width (used in continuous mode)
    const fitToWidth = useCallback(() => {
        if (!pageAreaRef.current) return;
        const areaW = pageAreaRef.current.clientWidth;
        if (areaW <= 0) return;
        const pageW = PAGE_W_MM * PX_PER_MM;
        const fitZoom = (areaW / pageW) * 0.98;
        setZoom(Math.max(25, Math.min(300, Math.round(fitZoom * 100))));
    }, []);

    // Auto-fit on mount, on view mode change, on thumbnail toggle, on reading mode toggle
    useEffect(() => {
        const timer = setTimeout(() => {
            if (viewMode === 'fit') fitToPage();
            else fitToWidth();
        }, 60);
        return () => clearTimeout(timer);
    }, [viewMode, fitToPage, fitToWidth, showThumbnails, readingMode]);

    // ─── ResizeObserver: re-fit when container resizes ─────────────
    // This is the KEY fix — window.resize doesn't fire when:
    //   - Thumbnail strip toggles open/closed (changes container height)
    //   - Sidebar collapses (changes container width)
    //   - Mobile browser URL bar shows/hides (changes container height)
    // ResizeObserver fires for ALL of these.
    useEffect(() => {
        const el = pageAreaRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            if (viewMode === 'fit') fitToPage();
            else fitToWidth();
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [viewMode, fitToPage, fitToWidth]);

    // Reset current page when document changes
    useEffect(() => {
        setCurrentPage(0);
    }, [html]);

    // ─── Keyboard navigation ────────────────────────────────────────
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
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
                setZoom(z => Math.min(300, z + 25));
            } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                setZoom(z => Math.max(25, z - 25));
            } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                if (viewMode === 'fit') fitToPage();
                else fitToWidth();
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
    }, [pageCount, viewMode, isFullScreen, onRequestClose, readingMode, fitToPage, fitToWidth]);

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
            const pageHeight = PAGE_H_MM * PX_PER_MM * (zoom / 100) + 40;
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
        const pageHeight = PAGE_H_MM * PX_PER_MM * (zoom / 100) + 40;
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

    // ─── Page sheet — wrapped so layout uses SCALED dimensions ──────
    // Outer div: scaled width/height (so flex centering works correctly)
    // Inner div: original 210×297mm + transform: scale (visual only)
    const PageSheet = ({ pageIndex }: { pageIndex: number }) => {
        const scaledW = PAGE_W_MM * (zoom / 100);
        const scaledH = PAGE_H_MM * (zoom / 100);
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
                        transform: `scale(${zoom / 100})`,
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

    // ─── Thumbnail (miniature page preview for the bottom strip) ────
    const Thumbnail = ({ pageIndex }: { pageIndex: number }) => (
        <button
            onClick={() => goToPage(pageIndex)}
            className={`group relative flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                safeCurrentPage === pageIndex
                    ? 'border-primary-600 shadow-md ring-2 ring-primary-200'
                    : 'border-slate-200 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500'
            }`}
            title={`Page ${pageIndex + 1}`}
            style={{ width: '60px', height: '85px' }}
        >
            <div
                className="bg-white relative overflow-hidden"
                style={{ width: '100%', height: '100%', fontFamily: "'Times New Roman', serif" }}
            >
                <div
                    className="page-sheet absolute top-0 left-0 origin-top-left pointer-events-none"
                    style={{
                        width: '210mm',
                        transform: 'scale(0.113)',
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
                <div className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black/70 text-white text-[8px] font-bold rounded">
                    {pageIndex + 1}
                </div>
            </div>
        </button>
    );

    // ═══ READING MODE (pure page view, no chrome) ═══════════════════
    if (readingMode && isFullScreen) {
        return (
            <div
                ref={containerRef}
                tabIndex={0}
                className="flex flex-col h-full w-full bg-zinc-900 outline-none relative"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => {
                    if (e.target === e.currentTarget) setReadingMode(false);
                }}
            >
                <style>{pageCss}</style>
                <div
                    ref={pageAreaRef}
                    className="flex-1 min-h-0 flex items-center justify-center p-2 overflow-hidden"
                >
                    <PageSheet pageIndex={safeCurrentPage} />
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

    // ═══ STANDARD VIEW (slim toolbar + optional thumbnail strip) ════
    return (
        <div ref={containerRef} tabIndex={0} className={`flex flex-col h-full bg-slate-200/50 dark:bg-zinc-900/50 overflow-hidden outline-none ${isFullScreen ? 'rounded-none' : ''}`}>
            <style>{pageCss}</style>

            {/* ─── SLIM toolbar (single row, ~32px tall) ─── */}
            <div className="flex items-center justify-between px-2 py-1 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 flex-shrink-0 gap-1">
                {/* Left: page navigation (compact) */}
                <div className="flex items-center gap-0.5">
                    <button onClick={() => goToPage(0)} disabled={safeCurrentPage === 0} className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="First (Home)">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" /></svg>
                    </button>
                    <button onClick={() => goToPage(safeCurrentPage - 1)} disabled={safeCurrentPage === 0} className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Previous (←)">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>
                    <input
                        type="number"
                        min={1}
                        max={pageCount}
                        value={safeCurrentPage + 1}
                        onChange={(e) => goToPage(parseInt(e.target.value) - 1)}
                        className="w-9 h-6 text-center text-[10px] font-bold bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded border-none outline-none"
                    />
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 whitespace-nowrap px-1">
                        / {pageCount}
                    </span>
                    <button onClick={() => goToPage(safeCurrentPage + 1)} disabled={safeCurrentPage >= pageCount - 1} className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Next (→)">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                    <button onClick={() => goToPage(pageCount - 1)} disabled={safeCurrentPage >= pageCount - 1} className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Last (End)">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                </div>

                {/* Center: view mode toggle (compact) */}
                <div className="flex bg-slate-100 dark:bg-zinc-700 rounded p-0.5">
                    <button
                        onClick={() => setViewMode('fit')}
                        className={`px-1.5 py-0.5 rounded transition-colors ${viewMode === 'fit' ? 'bg-white dark:bg-zinc-600 text-slate-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                        title="Single page — fit to viewport"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h9A2.25 2.25 0 0118.75 6v12a2.25 2.25 0 01-2.25 2.25h-9A2.25 2.25 0 015.25 18V6A2.25 2.25 0 017.5 3.75z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setViewMode('continuous')}
                        className={`px-1.5 py-0.5 rounded transition-colors ${viewMode === 'continuous' ? 'bg-white dark:bg-zinc-600 text-slate-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                        title="Continuous scroll"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5v3.75h-7.5v-3.75zM8.25 13.5h7.5v3.75h-7.5v-3.75z" />
                        </svg>
                    </button>
                </div>

                {/* Right: zoom + actions (compact) */}
                <div className="flex items-center gap-0.5">
                    <button onClick={() => setZoom(z => Math.max(25, z - 25))} className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center" title="Zoom out (Ctrl -)">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
                    </button>
                    <button
                        onClick={() => viewMode === 'fit' ? fitToPage() : fitToWidth()}
                        className="px-1.5 h-6 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 text-[9px] font-bold"
                        title="Fit (Ctrl 0)"
                    >
                        Fit
                    </button>
                    <span className="text-[9px] font-bold text-slate-400 w-7 text-center">{zoom}%</span>
                    <button onClick={() => setZoom(z => Math.min(300, z + 25))} className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center" title="Zoom in (Ctrl +)">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    </button>

                    {/* Thumbnails toggle */}
                    <button
                        onClick={() => setShowThumbnails(s => !s)}
                        className={`ml-1 w-6 h-6 rounded flex items-center justify-center transition-colors ${
                            showThumbnails
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                                : 'hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400'
                        }`}
                        title="Toggle thumbnails (F)"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                        </svg>
                    </button>

                    {/* Reading mode (full-screen only) */}
                    {isFullScreen && (
                        <button
                            onClick={() => setReadingMode(true)}
                            className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center"
                            title="Reading mode (R)"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    )}

                    {/* Full-screen expand (inline only) */}
                    {!isFullScreen && onRequestFullScreen && (
                        <button
                            onClick={onRequestFullScreen}
                            className="w-6 h-6 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-500 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center justify-center"
                            title="Open in full screen (ESC to exit)"
                        >
                            <ArrowsExpandIcon className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* Download */}
                    <button onClick={handleDownload} className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center" title="Download as HTML">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                    </button>

                    {/* Print */}
                    <button onClick={handlePrint} className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center" title="Print / Save as PDF">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621.504-1.125 1.125-1.125h.871c1.018 0 1.997.346 2.778.984M6.75 7.234V18" /></svg>
                    </button>

                    {/* Close (full-screen only) */}
                    {isFullScreen && onRequestClose && (
                        <button
                            onClick={onRequestClose}
                            className="ml-1 w-7 h-7 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center"
                            title="Close (ESC)"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Main page area — fills ALL available space, centered ─── */}
            {viewMode === 'fit' ? (
                <div
                    ref={pageAreaRef}
                    className="flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-slate-200/50 dark:bg-zinc-900/30"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <PageSheet pageIndex={safeCurrentPage} />
                </div>
            ) : (
                <div
                    ref={pageAreaRef}
                    className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-200/50 dark:bg-zinc-900/30"
                >
                    <div
                        ref={scrollRef}
                        onScroll={handleScroll}
                        className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-3 p-3 custom-scrollbar"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        {Array.from({ length: pageCount }).map((_, i) => (
                            <PageSheet key={i} pageIndex={i} />
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Bottom thumbnail strip (Adobe Acrobat style) ─── */}
            {showThumbnails && (
                <div className="flex-shrink-0 bg-white dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700">
                    <div
                        ref={thumbnailStripRef}
                        className="flex items-center gap-1.5 px-2 py-1.5 overflow-x-auto custom-scrollbar"
                        style={{ scrollbarWidth: 'thin' }}
                    >
                        {Array.from({ length: pageCount }).map((_, i) => (
                            <Thumbnail key={i} pageIndex={i} />
                        ))}
                        {pageCount === 0 && (
                            <p className="text-[10px] text-slate-400 italic px-2">No pages</p>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Footer hint bar (only in full-screen mode) ─── */}
            {isFullScreen && (
                <div className="flex-shrink-0 px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700 text-[9px] text-slate-400 dark:text-zinc-500 flex items-center justify-between">
                    <span className="hidden sm:inline">← → navigate • Ctrl +/− zoom • F thumbnails • R reading • Ctrl 0 fit</span>
                    <span className="sm:hidden">Swipe to navigate</span>
                    <button onClick={onRequestClose} className="font-bold text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400">
                        ESC to close
                    </button>
                </div>
            )}
        </div>
    );
};

export default HtmlPagePreview;

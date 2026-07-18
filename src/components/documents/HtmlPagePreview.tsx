
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DocumentIcon, DownloadIcon, ArrowsExpandIcon as ArrowsPointingOutIcon } from '../../constants';
import { sanitize } from '../../utils/sanitization';

// ─── HTML Page Preview — full-featured document viewer ──
// Features: page-by-page + continuous scroll modes, auto-pagination,
// fit-to-width, zoom (50%–200%), swipe gestures, keyboard nav,
// page thumbnails sidebar, full-screen toggle, download, print.
//
// This component is intentionally self-contained so it can be embedded
// in BOTH the inline DocumentDetailView preview tab AND the standalone
// DocumentPreviewModal — they share the exact same UX.
export interface HtmlPagePreviewProps {
    html: string;
    title: string;
    /** When true, hides the "expand" button (used inside the modal). */
    isFullScreen?: boolean;
    /** Called when user clicks the expand/full-screen button. */
    onRequestFullScreen?: () => void;
    /** Called when user presses ESC inside the modal. */
    onRequestClose?: () => void;
}

const HtmlPagePreview: React.FC<HtmlPagePreviewProps> = ({
    html,
    title,
    isFullScreen = false,
    onRequestFullScreen,
    onRequestClose,
}) => {
    const [zoom, setZoom] = useState(100);
    const [currentPage, setCurrentPage] = useState(0);
    const [viewMode, setViewMode] = useState<'single' | 'continuous'>('single');
    const [showThumbnails, setShowThumbnails] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);

    // Auto-paginate: split on page-break markers, OR split long content at paragraph boundaries
    const pages = useMemo(() => {
        const cleanHtml = sanitize(html);
        // First try explicit page-break markers
        const explicitPages = cleanHtml.split(/<div[^>]*data-type="page-break"[^>]*><\/div>|<div[^>]*class="[^"]*page-break[^"]*"[^>]*><\/div>|<div[^>]*style="[^"]*page-break[^"]*"[^>]*><\/div>/i);
        const filtered = explicitPages.filter(p => p.trim());

        // If only 1 page and content is long (>4000 chars), auto-paginate at paragraph boundaries
        if (filtered.length <= 1 && cleanHtml.length > 4000) {
            const paragraphs = cleanHtml.split(/(<\/p>)/i);
            const autoPages: string[] = [];
            let currentChunk = '';
            let charCount = 0;
            const CHARS_PER_PAGE = 3000; // ~1 A4 page of 12pt Times New Roman

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

    // Fit-to-width: calculate zoom to fit 210mm page width into container
    const fitToWidth = () => {
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.clientWidth - 32; // padding
        const pageWidthPx = 210 * 3.779; // 210mm to px at 96dpi
        const calculatedZoom = Math.round((containerWidth / pageWidthPx) * 100);
        setZoom(Math.max(50, Math.min(200, calculatedZoom)));
    };

    // Auto fit on mount and when container resizes
    useEffect(() => {
        fitToWidth();
        const handleResize = () => fitToWidth();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Reset current page when document changes
    useEffect(() => {
        setCurrentPage(0);
    }, [html]);

    // Keyboard navigation
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            // ESC closes the modal (only when full-screen)
            if (e.key === 'Escape' && isFullScreen && onRequestClose) {
                e.preventDefault();
                onRequestClose();
                return;
            }
            if (viewMode !== 'single') return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                setCurrentPage(p => Math.max(0, p - 1));
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
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
                setZoom(z => Math.min(200, z + 25));
            } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                setZoom(z => Math.max(50, z - 25));
            } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                fitToWidth();
            } else if (e.key === 'f' || e.key === 'F') {
                // Toggle thumbnails with F
                e.preventDefault();
                setShowThumbnails(s => !s);
            }
        };
        const el = containerRef.current;
        el?.addEventListener('keydown', handleKey);
        return () => el?.removeEventListener('keydown', handleKey);
    }, [pageCount, viewMode, isFullScreen, onRequestClose]);

    // Touch swipe navigation (single page mode) — only horizontal swipes
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (viewMode !== 'single') return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        // Only treat as horizontal swipe if X delta > 50 AND > 1.5× vertical delta
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            if (deltaX > 0) setCurrentPage(p => Math.max(0, p - 1));
            else setCurrentPage(p => Math.min(pageCount - 1, p + 1));
        }
    };

    const goToPage = (page: number) => {
        setCurrentPage(Math.max(0, Math.min(pageCount - 1, page)));
        // Scroll to top of new page
        if (scrollRef.current && viewMode === 'continuous') {
            const pageHeight = 297 * 3.779 + 40;
            scrollRef.current.scrollTo({ top: page * pageHeight, behavior: 'smooth' });
        }
    };

    // Track current page in continuous scroll mode
    const handleScroll = () => {
        if (viewMode !== 'continuous' || !scrollRef.current) return;
        const scrollTop = scrollRef.current.scrollTop;
        const pageHeight = 297 * 3.779 + 40; // A4 height + gap
        const pageNum = Math.floor(scrollTop / pageHeight);
        setCurrentPage(Math.max(0, Math.min(pageCount - 1, pageNum)));
    };

    // Download as HTML
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

    // Print (also lets user save as PDF via browser print dialog)
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

    const PageSheet = ({ pageIndex }: { pageIndex: number }) => (
        <div
            className="bg-white shadow-2xl border border-slate-300 flex-shrink-0 relative"
            style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '25mm',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 200ms ease-out',
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
    );

    // Thumbnail component (miniature page preview)
    const Thumbnail = ({ pageIndex }: { pageIndex: number }) => (
        <button
            onClick={() => goToPage(pageIndex)}
            className={`group relative w-full rounded-md overflow-hidden border-2 transition-all ${
                safeCurrentPage === pageIndex
                    ? 'border-primary-600 shadow-md ring-2 ring-primary-200'
                    : 'border-slate-200 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500'
            }`}
            title={`Page ${pageIndex + 1}`}
        >
            <div
                className="bg-white aspect-[210/297] relative overflow-hidden"
                style={{ fontFamily: "'Times New Roman', serif" }}
            >
                <div
                    className="page-sheet absolute top-0 left-0 origin-top-left pointer-events-none"
                    style={{
                        width: '210mm',
                        transform: 'scale(0.18)', // thumbnail scale
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
                {/* Page number badge */}
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-bold rounded">
                    {pageIndex + 1}
                </div>
            </div>
        </button>
    );

    return (
        <div ref={containerRef} tabIndex={0} className={`flex flex-col h-full bg-slate-300/50 dark:bg-zinc-900/50 overflow-hidden outline-none ${isFullScreen ? 'rounded-none' : ''}`}>
            <style>{pageCss}</style>

            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 shadow-sm flex-shrink-0 gap-2">
                {/* Left: file info + page count */}
                <div className="flex items-center gap-2 min-w-0">
                    {/* Thumbnails toggle button */}
                    <button
                        onClick={() => setShowThumbnails(s => !s)}
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                            showThumbnails
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                                : 'hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400'
                        }`}
                        title="Toggle page thumbnails (F)"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                        </svg>
                    </button>

                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <DocumentIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 hidden sm:block">
                        <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate max-w-[150px]">{title}</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {safeCurrentPage + 1} / {pageCount}
                    </span>
                </div>

                {/* Center: page navigation (hidden in continuous mode) */}
                {viewMode === 'single' && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button onClick={() => goToPage(0)} disabled={safeCurrentPage === 0} className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-colors flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="First page (Home)">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" /></svg>
                        </button>
                        <button onClick={() => goToPage(safeCurrentPage - 1)} disabled={safeCurrentPage === 0} className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-colors flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Previous (←)">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                        </button>
                        <input
                            type="number"
                            min={1}
                            max={pageCount}
                            value={safeCurrentPage + 1}
                            onChange={(e) => goToPage(parseInt(e.target.value) - 1)}
                            className="w-9 h-7 text-center text-[10px] font-bold bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-md border-none outline-none"
                        />
                        <button onClick={() => goToPage(safeCurrentPage + 1)} disabled={safeCurrentPage >= pageCount - 1} className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-colors flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Next (→)">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                        </button>
                        <button onClick={() => goToPage(pageCount - 1)} disabled={safeCurrentPage >= pageCount - 1} className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-colors flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed" title="Last page (End)">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" /></svg>
                        </button>
                    </div>
                )}

                {/* Right: view mode toggle + zoom + actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    {/* View mode toggle: single page vs continuous scroll — DISTINCT icons */}
                    <div className="flex bg-slate-100 dark:bg-zinc-700 rounded-md p-0.5">
                        <button
                            onClick={() => setViewMode('single')}
                            className={`px-2 py-1 rounded transition-colors ${viewMode === 'single' ? 'bg-white dark:bg-zinc-600 text-slate-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                            title="Single page view"
                        >
                            {/* Single page icon: one filled square */}
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h9A2.25 2.25 0 0118.75 6v12a2.25 2.25 0 01-2.25 2.25h-9A2.25 2.25 0 015.25 18V6A2.25 2.25 0 017.5 3.75z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode('continuous')}
                            className={`px-2 py-1 rounded transition-colors ${viewMode === 'continuous' ? 'bg-white dark:bg-zinc-600 text-slate-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                            title="Continuous scroll view"
                        >
                            {/* Continuous icon: three stacked squares */}
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5v3.75h-7.5v-3.75zM8.25 13.5h7.5v3.75h-7.5v-3.75z" />
                            </svg>
                        </button>
                    </div>

                    {/* Zoom controls */}
                    <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-colors flex items-center justify-center" title="Zoom out (Ctrl -)">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
                    </button>
                    <button onClick={fitToWidth} className="px-1.5 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-colors text-[9px] font-bold" title="Fit to width (Ctrl 0)">
                        Fit
                    </button>
                    <span className="text-[9px] font-bold text-slate-400 w-8 text-center">{zoom}%</span>
                    <button onClick={() => setZoom(z => Math.min(200, z + 25))} className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-colors flex items-center justify-center" title="Zoom in (Ctrl +)">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    </button>

                    {/* Full-screen toggle button */}
                    {!isFullScreen && onRequestFullScreen && (
                        <button
                            onClick={onRequestFullScreen}
                            className="ml-1 w-7 h-7 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-500 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center justify-center"
                            title="Open in full screen (ESC to exit)"
                        >
                            <ArrowsPointingOutIcon className="w-4 h-4" />
                        </button>
                    )}

                    {/* Download */}
                    <button onClick={handleDownload} className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-colors flex items-center justify-center" title="Download as HTML">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                    </button>

                    {/* Print */}
                    <button onClick={handlePrint} className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-colors flex items-center justify-center" title="Print / Save as PDF">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621.504-1.125 1.125-1.125h.871c1.018 0 1.997.346 2.778.984M6.75 7.234V18" /></svg>
                    </button>

                    {/* Close (only in full-screen mode) */}
                    {isFullScreen && onRequestClose && (
                        <button
                            onClick={onRequestClose}
                            className="ml-1 w-8 h-8 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center justify-center"
                            title="Close full screen (ESC)"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Main display area: thumbnails sidebar + page area */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Thumbnails sidebar */}
                {showThumbnails && (
                    <div className="flex-shrink-0 w-28 sm:w-36 border-r border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900/50 overflow-y-auto p-2 custom-scrollbar">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2 px-1">Pages</p>
                        <div className="space-y-2">
                            {Array.from({ length: pageCount }).map((_, i) => (
                                <Thumbnail key={i} pageIndex={i} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Page display area */}
                {viewMode === 'single' ? (
                    <div
                        className="flex-1 min-h-0 overflow-auto flex items-start justify-center p-4"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        <PageSheet pageIndex={safeCurrentPage} />
                    </div>
                ) : (
                    <div
                        ref={scrollRef}
                        onScroll={handleScroll}
                        className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-3 p-4 custom-scrollbar"
                    >
                        {Array.from({ length: pageCount }).map((_, i) => (
                            <PageSheet key={i} pageIndex={i} />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer hint bar (only in full-screen mode) */}
            {isFullScreen && (
                <div className="flex-shrink-0 px-3 py-1 bg-slate-100 dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700 text-[10px] text-slate-400 dark:text-zinc-500 flex items-center justify-between">
                    <span className="hidden sm:inline">← → navigate • Ctrl +/− zoom • F thumbnails • Ctrl 0 fit</span>
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


import React, { useEffect } from 'react';
import HtmlPagePreview from './HtmlPagePreview';
import PdfViewer from './PdfViewer';

// ─── DocumentPreviewModal — full-screen overlay for document previews ──
// Renders either:
//   1. PdfViewer (if fileUrl is provided — for uploaded PDFs)
//   2. HtmlPagePreview (if html is provided — for DraftPro-created docs)
//
// Used both:
//   1. From the inline preview tab (user clicks the "expand" button)
//   2. From the document list (user clicks "Preview Document" → opens directly)
//
// Body scroll is locked while the modal is open. ESC key closes the modal.
export interface DocumentPreviewModalProps {
    /** HTML content to render (when the document is text-based) */
    html?: string;
    /** PDF file URL (when the document is an uploaded PDF) */
    fileUrl?: string;
    title: string;
    onClose: () => void;
    onDownload?: () => void;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
    html,
    fileUrl,
    title,
    onClose,
    onDownload,
}) => {
    // Lock body scroll while modal is open
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    // Focus the modal container so keyboard shortcuts work immediately
    const containerRef = React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        const timer = setTimeout(() => {
            containerRef.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-stretch justify-stretch animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                ref={containerRef}
                tabIndex={-1}
                className="relative w-full h-full bg-white dark:bg-zinc-900 shadow-2xl animate-in zoom-in-95 duration-200 outline-none"
                onClick={(e) => e.stopPropagation()}
            >
                {fileUrl ? (
                    <PdfViewer
                        fileUrl={fileUrl}
                        title={title}
                        isFullScreen
                        onClose={onClose}
                        onDownload={onDownload}
                    />
                ) : html ? (
                    <HtmlPagePreview
                        html={html}
                        title={title}
                        isFullScreen
                        onRequestClose={onClose}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        <p>No content to preview.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentPreviewModal;

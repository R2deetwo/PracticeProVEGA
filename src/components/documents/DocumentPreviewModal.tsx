
import React, { useEffect } from 'react';
import HtmlPagePreview from './HtmlPagePreview';

// ─── DocumentPreviewModal — full-screen overlay for document previews ──
// Renders the HtmlPagePreview inside a fixed, full-viewport overlay.
// Used both:
//   1. From the inline preview tab (user clicks the "expand" button)
//   2. From the document list (user clicks "Preview Document" → opens directly)
//
// Props:
//   - html: HTML content to render (when the document is text-based)
//   - title: Document title shown in the toolbar
//   - onClose: callback to dismiss the modal
//
// Body scroll is locked while the modal is open. ESC key closes the modal.
export interface DocumentPreviewModalProps {
    html: string;
    title: string;
    onClose: () => void;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ html, title, onClose }) => {
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
        // Slight delay to ensure DOM is ready
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
                <HtmlPagePreview
                    html={html}
                    title={title}
                    isFullScreen
                    onRequestClose={onClose}
                />
            </div>
        </div>
    );
};

export default DocumentPreviewModal;

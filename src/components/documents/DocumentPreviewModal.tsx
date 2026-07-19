import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import PdfViewer from './PdfViewer';
import HtmlPagePreview from './HtmlPagePreview';

export interface DocumentPreviewModalProps {
    html?: string;
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
    const containerRef = useRef<HTMLDivElement>(null);

    // Lock body scroll on mount, restore on unmount. Focus the container so
    // keyboard shortcuts work immediately without an extra click.
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        const prevPaddingRight = document.body.style.paddingRight;
        document.body.style.overflow = 'hidden';
        // Prevent layout shift when scrollbar disappears
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
        // Focus the container for keyboard nav
        const t = window.setTimeout(() => containerRef.current?.focus(), 50);

        return () => {
            document.body.style.overflow = prevOverflow;
            document.body.style.paddingRight = prevPaddingRight;
            window.clearTimeout(t);
        };
    }, []);

    return (
        <div
            className="fixed inset-0 z-[5000] flex flex-col bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            {/* Close affordance in the top-right corner for mouse users */}
            <button
                onClick={onClose}
                className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                aria-label="Close preview"
                title="Close (Esc)"
            >
                <X className="w-5 h-5" />
            </button>

            <div
                ref={containerRef}
                tabIndex={-1}
                className="flex-1 min-h-0 outline-none flex flex-col"
            >
                <div className="flex-1 min-h-0 p-3 sm:p-4">
                    {fileUrl ? (
                        <PdfViewer
                            fileUrl={fileUrl}
                            title={title}
                            isFullScreen
                            onClose={onClose}
                            onDownload={onDownload}
                        />
                    ) : (
                        <HtmlPagePreview
                            html={html || ''}
                            title={title}
                            isFullScreen
                            onRequestClose={onClose}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentPreviewModal;

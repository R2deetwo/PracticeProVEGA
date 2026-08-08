import React from 'react';
import { WarningIcon, DocumentIcon, PrinterIcon, DownloadIcon } from '../constants';
import { useUI } from '../contexts/UIContext';

interface DocumentPreviewProps {
    metadataId?: string;
    markdownContent: string;
    latexContent?: string;
    missingFields?: string[];
    onClose?: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ 
    metadataId, 
    markdownContent, 
    latexContent, 
    missingFields = [], 
    onClose 
}) => {
    const { addToast } = useUI();

    const handlePrint = () => {
        // Implement printing logic (could open a new window with formatted HTML)
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>Document Print</title>
                    <style>
                        body { font-family: 'Times New Roman', serif; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                        h1, h2, h3 { text-align: center; }
                        .content { white-space: pre-wrap; }
                    </style>
                </head>
                <body>
                    <div class="content">${markdownContent}</div>
                    <script>window.print();</script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    const handleCopyLatex = () => {
        if (latexContent) {
            navigator.clipboard.writeText(latexContent);
            addToast("LaTeX code copied to clipboard", { type: "success" });
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-900 overflow-hidden animate-fade-in">
            <header className="flex-shrink-0 p-4 sm:px-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center text-primary-600">
                        <DocumentIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Document Preview</h2>
                        <p className="text-xs text-slate-500">Trace ID: {metadataId || 'Draft'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handlePrint} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <PrinterIcon className="w-5 h-5" />
                    </button>
                    {latexContent && (
                        <button onClick={handleCopyLatex} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="Copy LaTeX">
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                    )}
                    {onClose && (
                        <button onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-sm hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                            Close
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-grow overflow-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
                
                {missingFields.length > 0 && (
                    <div className="w-full max-w-3xl mb-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
                        <WarningIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-amber-800 dark:text-amber-500 text-sm">Missing Information Detected</h4>
                            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                                The document was generated, but the following required fields were missing from the database:
                            </p>
                            <ul className="mt-2 list-disc list-inside text-sm text-amber-700 dark:text-amber-400 font-medium">
                                {missingFields.map(field => (
                                    <li key={field}>{field.replace('_', ' ').toUpperCase()}</li>
                                ))}
                            </ul>
                            <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                                Please review the placeholders in brackets (e.g., [TENANT NAME]) before serving this notice.
                            </p>
                        </div>
                    </div>
                )}

                <div className="w-full max-w-3xl bg-white dark:bg-zinc-950 shadow-sm border border-slate-200 dark:border-zinc-800 p-8 sm:p-12 min-h-[800px] font-serif text-slate-800 dark:text-slate-200">
                    <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
                        {markdownContent}
                    </div>
                </div>

            </div>
        </div>
    );
};

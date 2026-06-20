
import React from 'react';
import { Document, DocumentVersion } from '../../types';

interface DocumentComparisonModalProps {
    currentDocument: Document;
    versionToCompare: DocumentVersion;
    onClose: () => void;
}

export const DocumentComparisonModal: React.FC<DocumentComparisonModalProps> = ({ currentDocument, versionToCompare, onClose }) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            </div>
            <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Version Comparison</h4>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md leading-relaxed mb-3">
                Comparing <strong className="text-slate-700 dark:text-zinc-200">{currentDocument.title}</strong> — current version vs. version from <strong className="text-slate-700 dark:text-zinc-200">{new Date(versionToCompare.uploadedAt).toLocaleDateString('en-GB')}</strong>.
            </p>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl max-w-md">
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    Inline redline comparison is not yet available. For now, open both versions from the document history to compare them side by side.
                </p>
            </div>
            <div className="mt-6">
                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-zinc-600 transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

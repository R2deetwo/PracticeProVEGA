
import React, { useState } from 'react';
import { Document, DocumentVersion } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { formatBytes } from '../../utils/formatting';

interface DocumentComparisonModalProps {
    currentDocument: Document;
    versionToCompare: DocumentVersion;
    onClose: () => void;
}

// Simple diff simulation since we don't have a real backend diff engine
const DiffSimulator: React.FC<{ original: string, modified: string }> = ({ original, modified }) => {
    return (
        <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {/* Simulated diff output */}
            <span className="text-slate-400">...clause 12.4 regarding termination...</span><br/>
            <span className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 line-through decoration-red-500">The notice period shall be 30 days.</span>
            <span className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 px-1">The notice period shall be 60 days, provided that all outstanding invoices are settled.</span>
            <br/><br/>
            <span className="text-slate-400">...jurisdiction...</span><br/>
            Any disputes arising from this agreement shall be settled in the <span className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 px-1">Lagos Multi-Door Courthouse</span><span className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 line-through decoration-red-500">High Court of Lagos State</span>.
        </div>
    );
};

export const DocumentComparisonModal: React.FC<DocumentComparisonModalProps> = ({ currentDocument, versionToCompare, onClose }) => {
    const [viewMode, setViewMode] = useState<'side-by-side' | 'inline'>('inline');

    const renderSideBySide = () => (
        <div className="grid grid-cols-2 gap-4 h-full overflow-hidden">
            <div className="flex flex-col h-full">
                <div className="p-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900 mb-2 rounded-t-lg">
                    <p className="font-bold text-red-700 dark:text-red-300 text-sm">Version {new Date(versionToCompare.uploadedAt).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="flex-grow bg-slate-50 dark:bg-zinc-800 p-4 rounded-b-lg overflow-y-auto border border-slate-200 dark:border-zinc-700 text-sm">
                    <p className="text-slate-600 dark:text-zinc-400 italic">
                        [Content from old version...] The notice period shall be 30 days. Disputes settled in High Court of Lagos State.
                    </p>
                </div>
            </div>
            <div className="flex flex-col h-full">
                 <div className="p-2 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-900 mb-2 rounded-t-lg">
                    <p className="font-bold text-green-700 dark:text-green-300 text-sm">Current Version (Active)</p>
                </div>
                <div className="flex-grow bg-white dark:bg-zinc-900 p-4 rounded-b-lg overflow-y-auto border border-slate-200 dark:border-zinc-700 text-sm">
                    <p className="text-slate-800 dark:text-zinc-200">
                        [Content from current version...] The notice period shall be 60 days, provided that all outstanding invoices are settled. Disputes settled in Lagos Multi-Door Courthouse.
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-[80vh]">
             <div className="flex-shrink-0 mb-4">
                <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
                    Comparing <strong>Current Version</strong> against <strong>Version from {new Date(versionToCompare.uploadedAt).toLocaleDateString('en-GB')}</strong>.
                </p>
                <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg w-fit">
                    <button 
                        onClick={() => setViewMode('inline')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'inline' ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'}`}
                    >
                        Inline (Redline)
                    </button>
                    <button 
                        onClick={() => setViewMode('side-by-side')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'side-by-side' ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'}`}
                    >
                        Side-by-Side
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-hidden min-h-0">
                {viewMode === 'inline' ? (
                    <div className="h-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-6 overflow-y-auto shadow-inner">
                        <DiffSimulator 
                            original="The notice period shall be 30 days." 
                            modified="The notice period shall be 60 days." 
                        />
                    </div>
                ) : (
                    renderSideBySide()
                )}
            </div>
            
             <div className="pt-4 flex justify-end gap-2 border-t border-slate-200 dark:border-zinc-700 mt-4">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-white rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-zinc-600 transition-colors"
                >
                    Close Comparison
                </button>
            </div>
        </div>
    );
};

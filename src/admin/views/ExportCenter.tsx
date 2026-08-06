/**
 * ExportCenter — CSV export of firm list, MRR breakdown, churn list.
 */

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth, useFounderToast } from '../FounderContexts';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden';

function downloadCSV(filename: string, rows: any[]) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

type ExportType = 'firms' | 'mrr' | 'churn';

const EXPORT_OPTIONS: { type: ExportType; label: string; description: string }[] = [
    { type: 'firms', label: 'Firm List', description: 'All firms with plan, users, matters, billing' },
    { type: 'mrr', label: 'MRR Breakdown', description: 'Monthly recurring revenue by firm' },
    { type: 'churn', label: 'Churn List', description: 'Firms ranked by inactivity (days since active)' },
];

export const ExportCenter: React.FC = () => {
    const { currentUser } = useFounderAuth();
    const { addToast } = useFounderToast();
    const tokenIdentifier = currentUser?.email || '';
    const [exportType, setExportType] = useState<ExportType | null>(null);

    const data = useQuery(api.founderMetrics.getExportData,
        tokenIdentifier && exportType ? { tokenIdentifier, exportType } : "skip");

    const handleExport = (type: ExportType) => {
        setExportType(type);
    };

    React.useEffect(() => {
        if (data && exportType) {
            downloadCSV(`practicepro-${exportType}-${new Date().toISOString().split('T')[0]}.csv`, data as any[]);
            addToast(`Exported ${(data as any[]).length} rows.`, { type: 'success' });
            setExportType(null);
        }
    }, [data, exportType]);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Export</h2>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Download CSV reports</p>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 space-y-3">
                {EXPORT_OPTIONS.map(opt => (
                    <button
                        key={opt.type}
                        onClick={() => handleExport(opt.type)}
                        disabled={exportType !== null}
                        className={`${CARD} w-full text-left hover:border-primary-400 transition-colors disabled:opacity-50`}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{opt.label}</p>
                                <p className="text-xs text-slate-500 truncate">{opt.description}</p>
                            </div>
                            {exportType === opt.type && (
                                <div className="ml-auto flex-shrink-0">
                                    <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

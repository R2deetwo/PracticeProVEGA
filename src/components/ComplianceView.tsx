
import React from 'react';
import { AppState } from '../types';
import ComplianceReports from './reports/ComplianceReports';
import { ShieldCheckIcon } from '../constants';

interface ComplianceViewProps {}

const ComplianceView: React.FC<ComplianceViewProps> = () => {
    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-32">
            <header className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <ShieldCheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Compliance & Standards</h2>
                        <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-1">Track professional standing and certifications.</p>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <ComplianceReports />
            </div>
        </div>
    );
};

export default ComplianceView;

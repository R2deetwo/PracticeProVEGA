import React, { useState } from 'react';
import { Matter, Document, Task } from '../../types';
import { ComplianceEngine } from '../../utils/ComplianceEngine';
import { ShieldCheckIcon, SparklesIcon, ZapIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { TemplateService } from '../../utils/TemplateService';

interface ProceduralComplianceReportProps {
    matter: Matter;
    tasks: Task[];
    documents: Document[];
}

export const ProceduralComplianceReport: React.FC<ProceduralComplianceReportProps> = ({ matter, tasks, documents }) => {
    const { navigateTo } = useUI();
    const [expanded, setExpanded] = useState(false);
    const warnings = ComplianceEngine.checkMatter(matter, tasks as any[], documents);
    
    if (warnings.length === 0) return null;

    const criticalCount = warnings.filter(w => w.severity === 'CRITICAL').length;
    const pendingCount = warnings.filter(w => w.severity !== 'DONE').length;
    const satisfiedCount = warnings.filter(w => w.severity === 'DONE').length;

    return (
        <div className={`group overflow-hidden transition-all duration-500 border rounded-2xl mb-8 shadow-sm ${
            criticalCount > 0 
                ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' 
                : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
        }`}>
            <div className="flex items-center justify-between px-6 py-5">
                <div className="flex items-center gap-5">
                    <div className={`p-2.5 rounded-lg flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${
                        criticalCount > 0 ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-emerald-500 text-white shadow-emerald-500/20'
                    }`}>
                        <ZapIcon className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <p className="text-2xs font-black uppercase tracking-wide-label text-slate-500 dark:text-zinc-500 leading-none mb-2 flex items-center gap-2">
                             Legal Processes
                        </p>
                        <p className="text-sm font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                            {pendingCount > 0 
                                ? `${pendingCount} Procedure${pendingCount > 1 ? 's' : ''} Pending` 
                                : `All ${satisfiedCount} Procedures Satisfied`
                            }
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setExpanded(!expanded)}
                    className={`px-5 py-2.5 rounded-lg text-2xs font-black uppercase tracking-widest transition-all border shadow-sm ${
                        criticalCount > 0 
                            ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700 hover:shadow-rose-500/30' 
                            : 'bg-primary-600 text-white border-primary-700 hover:bg-primary-700 hover:shadow-primary-500/30'
                    }`}
                >
                    {expanded ? 'Collapse View' : 'Open Processes'}
                </button>
            </div>

            {expanded && (
                <div className="px-6 pb-6 animate-in slide-in-from-top-4 duration-500">
                    <div className="h-px bg-slate-200 dark:bg-zinc-700/50 mx-1 mb-6 opacity-50" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {warnings.map((w, i) => (
                            <div key={i} className={`flex flex-col gap-3 p-4 rounded-lg transition-all border group/card hover:shadow-md ${
                                w.severity === 'DONE'
                                    ? 'bg-emerald-600 dark:bg-emerald-600 border-emerald-500 shadow-emerald-500/20'
                                    : w.severity === 'CRITICAL'
                                        ? 'bg-white/90 dark:bg-zinc-800/90 border-rose-200 shadow-rose-100/50'
                                        : 'bg-white/80 dark:bg-zinc-800/80 border-emerald-200 shadow-emerald-100/50'
                            }`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 font-black shadow-sm ${
                                        w.severity === 'DONE' ? 'bg-white dark:bg-zinc-900 text-emerald-600' :
                                        w.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                                    }`}>
                                        {w.severity === 'DONE' ? <ShieldCheckIcon className="w-4 h-4" /> : i + 1}
                                    </div>
                                    <span className={`text-3xs font-black uppercase tracking-tight px-2 py-1 rounded-lg ${
                                        w.severity === 'DONE' ? 'bg-emerald-500 text-white' :
                                        w.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                                    }`}>
                                        {w.severity === 'DONE' ? 'COMPLETED' : w.type.replace('_', ' ')}
                                    </span>
                                </div>
                                
                                <div className="space-y-1">
                                    <p className={`text-xs font-bold leading-snug ${w.severity === 'DONE' ? 'text-white' : 'text-slate-800 dark:text-zinc-200'}`}>
                                        {w.message}
                                    </p>
                                    <p className={`text-2xs font-medium ${w.severity === 'DONE' ? 'text-emerald-100' : 'text-slate-500 dark:text-zinc-400'}`}>
                                        {w.severity === 'DONE' ? 'Compliant Process' : 'Procedural Action Required'}
                                    </p>
                                </div>

                                {w.severity !== 'DONE' && (
                                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-zinc-700 flex items-center justify-between">
                                        <button 
                                            onClick={() => {
                                                const draftTitle = w.message.split('"')[1] || w.message;
                                                const template = TemplateService.getTemplate(draftTitle, matter);
                                                // DRAFTPRO-NEW-TAB — secondary entry point (TODO: route through openDraftProNewTab)
                                        navigateTo("editor", null, { 
                                                    matterId: matter.id, 
                                                    draftTitle: draftTitle, 
                                                    draftContent: template,
                                                    autoStartDrafting: true
                                                });
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-2xs font-black uppercase tracking-widest hover:bg-primary-600 hover:text-white transition-all shadow-sm"
                                        >
                                            <SparklesIcon className="w-3 h-3" />
                                            Draft Now
                                        </button>
                                        <span className="text-2xs font-bold text-slate-400 group-hover/card:text-slate-600 transition-colors uppercase pr-1">
                                            {w.severity.toLowerCase()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

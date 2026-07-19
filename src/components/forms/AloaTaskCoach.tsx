
import React, { useMemo } from 'react';
import { SparklesIcon, DocumentPlusIcon, MagnifyingGlassIcon, ShieldCheckIcon } from '../../constants';
import { Matter, TaskStatus } from '../../types';
import { ComplianceEngine } from '../../utils/ComplianceEngine';

interface AloaTaskCoachProps {
    taskTitle: string;
    description: string;
    matter?: Matter;
    allTasks?: any[];
    allDocuments?: any[];
    onAction: (type: 'draft' | 'research' | 'template', context?: any) => void;
}

export const AloaTaskCoach: React.FC<AloaTaskCoachProps> = ({ 
    taskTitle, 
    description, 
    matter, 
    allTasks = [], 
    allDocuments = [],
    onAction 
}) => {
    
    // 1. Analyze for Drafting actions
    const isDraftingTask = useMemo(() => {
        const keywords = ['draft', 'prepare', 'file', 'writ', 'statement', 'brief', 'motion', 'affidavit', 'notice'];
        return keywords.some(k => taskTitle.toLowerCase().includes(k));
    }, [taskTitle]);

    // 2. Get Compliance Logic if matter exists
    const compliance = useMemo(() => {
        if (!matter) return [];
        return ComplianceEngine.checkMatter(matter, allTasks, allDocuments);
    }, [matter, allTasks, allDocuments]);

    // 3. Smart Tips based on keywords
    const smartTips = useMemo(() => {
        const tips = [];
        const titleLower = taskTitle.toLowerCase();
        
        if (titleLower.includes('writ')) {
            tips.push("High Court rules require 4 copies of originating processes for service.");
        }
        if (titleLower.includes('affidavit')) {
            tips.push("Ensure the deponent is physically present before the Commissioner for Oaths.");
        }
        if (titleLower.includes('brief') || titleLower.includes('claim')) {
            tips.push("Front-loading is mandatory: attaching all exhibits mentioned is required.");
        }
        
        // Add one from compliance if available
        if (compliance.length > 0) {
            const first = compliance[0];
            tips.push(first.message);
        }

        return tips.slice(0, 2); // Keep it compressed
    }, [taskTitle, compliance]);

    if (!taskTitle && !matter) return null;

    return (
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-primary-50 to-indigo-50 dark:from-primary-900/10 dark:to-indigo-900/10 border border-primary-100/50 dark:border-primary-500/20 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                        <SparklesIcon className="w-3.5 h-3.5 text-primary-600" />
                    </div>
                    <p className="text-2xs font-black uppercase tracking-[0.2em] text-primary-600">ARIA Smart Assistant</p>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 border border-primary-200/30">
                    <span className="text-3xs font-black uppercase tracking-tighter text-primary-700">Enterprise Intelligence</span>
                </div>
            </div>

            <div className="space-y-3">
                {smartTips.length > 0 && (
                    <div className="space-y-1.5">
                        {smartTips.map((tip, i) => (
                            <div key={i} className="flex gap-2 text-2xs leading-relaxed text-slate-600 dark:text-zinc-400">
                                <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{tip}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                    {isDraftingTask && (
                        <button 
                            type="button"
                            onClick={() => onAction('draft', { title: taskTitle })}
                            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-primary-100 dark:border-primary-500/20 rounded-xl transition-all group/btn shadow-sm"
                        >
                            <DocumentPlusIcon className="w-3.5 h-3.5 text-primary-600 group-hover/btn:scale-110 transition-transform" />
                            <span className="text-2xs font-bold text-slate-700 dark:text-zinc-200">Initialize Draft</span>
                        </button>
                    )}
                    
                    <button 
                        type="button"
                        onClick={() => onAction('research', { query: taskTitle })}
                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-primary-100 dark:border-primary-500/20 rounded-xl transition-all group/btn shadow-sm"
                    >
                        <MagnifyingGlassIcon className="w-3.5 h-3.5 text-primary-600 group-hover/btn:scale-110 transition-transform" />
                        <span className="text-2xs font-bold text-slate-700 dark:text-zinc-200">Legal Research</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

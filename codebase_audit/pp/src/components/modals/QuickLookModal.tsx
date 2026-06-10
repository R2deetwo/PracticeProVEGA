
import React from 'react';
import { useUI } from '../../contexts/UIContext';
import { MattersIcon, TasksIcon, ContactsIcon, CalendarIcon, ChevronRightIcon } from '../../constants';
import { formatDueDate } from '../../utils/colorUtils';

const QuickLookModal: React.FC = () => {
    const { closeModal, modalContext, navigateTo } = useUI();
    const item = modalContext?.item;
    const type = modalContext?.type as 'Matter' | 'Task' | 'Contact';

    if (!item) return null;

    const handleOpenFull = () => {
        closeModal();
        if (type === 'Matter') navigateTo('matterDetail', item.id);
        if (type === 'Contact') navigateTo('contactDetail', item.id);
    };

    const getIcon = () => {
        switch (type) {
            case 'Matter': return <MattersIcon className="w-10 h-10 text-primary-600" />;
            case 'Task': return <TasksIcon className="w-10 h-10 text-primary-600" />;
            case 'Contact': return <ContactsIcon className="w-10 h-10 text-primary-600" />;
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 border border-slate-200 dark:border-zinc-800">
            {/* Header / Brand Strip */}
            <div className="h-1.5 w-full bg-primary-600"></div>
            
            <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl shadow-sm">
                        {getIcon()}
                    </div>
                    <div className="text-right">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                            Quick Insight
                        </span>
                    </div>
                </div>

                <div className="mb-8">
                    <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1">{type} Overview</p>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">
                        {item.title || item.name}
                    </h3>
                </div>

                <div className="space-y-6">
                    {type === 'Matter' && (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-6 p-6 bg-slate-50/50 dark:bg-zinc-800/20 rounded-2xl border border-slate-100 dark:border-zinc-700/30">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">CLIENT</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.clientName || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">CURRENT STAGE</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.stage}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">PRACTICE AREA</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.type}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">FILE REFERENCE</p>
                                <p className="text-sm font-black font-mono text-primary-600">{item.referenceNumber || 'N/A'}</p>
                            </div>
                        </div>
                    )}

                    {type === 'Task' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${item.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                                    {item.status.replace('_', ' ')}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                                    Priority: {item.priority}
                                </span>
                            </div>
                            
                            <div className="p-6 bg-slate-50/50 dark:bg-zinc-800/20 rounded-2xl border border-slate-100 dark:border-zinc-700/30">
                                <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">DEADLINE</p>
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                    <CalendarIcon className="w-4 h-4 text-primary-500" />
                                    {item.dueDate ? formatDueDate(item.dueDate) : 'No due date'}
                                </div>
                            </div>

                            {item.description && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2 px-1">DESCRIPTION</p>
                                    <div className="p-4 bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-800 rounded-2xl text-sm text-slate-600 dark:text-slate-300 italic">
                                        {item.description}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-auto p-6 bg-slate-50 dark:bg-zinc-800/30 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center group">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                    Interaction Hint: Press <strong className="text-slate-600 dark:text-zinc-300">Enter</strong> for details
                </span>
                <button 
                    onClick={handleOpenFull}
                    className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-700 shadow-lg hover:shadow-primary-500/20 transition-all active:scale-[0.98]"
                >
                    Full View <ChevronRightIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default QuickLookModal;

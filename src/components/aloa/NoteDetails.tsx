
import React from 'react';
import { EditIcon } from '../../constants';
import { parseAloaMarkdown } from '../../utils/markdownUtils';
import { renderLinksAsHtml } from '../../utils/linkParser';

interface NoteDetailsProps {
    note: any;
    onEdit: () => void;
    onBack: () => void;
}

export const NoteDetails: React.FC<NoteDetailsProps> = ({ note, onEdit, onBack }) => {
    if (!note) return null;
    
    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden animate-in fade-in slide-in-from-right duration-500">
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 custom-scrollbar">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-2xs font-black uppercase tracking-[0.1em] ${note.type === 'endorsement' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400'}`}>
                            {note.type === 'endorsement' ? 'Endorsement' : 'Note'}
                        </span>
                        <span className="text-2xs text-slate-400 font-bold uppercase tracking-widest">
                            {new Date(note.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white leading-tight break-words tracking-tight">{note.title}</h1>
                </div>

                <div className="h-px bg-slate-100 dark:border-zinc-800 w-16" />

                <div
                    className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-zinc-300 leading-relaxed font-medium whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{ __html: renderLinksAsHtml(parseAloaMarkdown(note.content || '')) }}
                    onClick={(e) => {
                        // Handle clicks on bi-link elements
                        const target = e.target as HTMLElement;
                        if (target.classList.contains('bi-link')) {
                            const label = target.getAttribute('data-label');
                            if (label) {
                                // Navigate to the linked entity — the parent will handle this
                                const event = new CustomEvent('practicepro:navigate-to-link', { detail: { label } });
                                window.dispatchEvent(event);
                            }
                        }
                    }}
                />
            </div>

            <footer className="p-6 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex gap-3">
                <button 
                    onClick={onEdit}
                    className="flex-1 py-4 bg-primary-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-primary-500/20 hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
                >
                    <EditIcon className="w-4 h-4" /> Edit
                </button>
                <button 
                    onClick={onBack}
                    className="px-6 py-4 bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all"
                >
                    Close
                </button>
            </footer>
        </div>
    );
};

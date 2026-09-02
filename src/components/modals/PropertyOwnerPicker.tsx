import React from 'react';
import { Receipt as UsersIcon } from 'lucide-react';

/**
 * PropertyOwnerPicker — shared "select the property owner" step.
 *
 * Round-4 dedupe: this screen previously existed twice, nearly line-for-line
 * (ModalManager.tsx for center modals + DockedModal.tsx for docked modals),
 * with subtly different behavior. It now lives here once; both modal systems
 * render it and pass their own callbacks:
 *   - ModalManager:  onSelect → openModal('newProperty', contactId)
 *   - DockedModal:   onSelect → setSelectedContactId(contactId)
 *
 * Follows the audit's mobile-affordance rule: the hover arrow is always
 * visible on touch (opacity-100 md:opacity-0 pattern).
 */

interface PropertyOwnerPickerProps {
    contacts: { id: string; name: string; email?: string; category?: string }[];
    onSelect: (contactId: string) => void;
    /** Opens the New Contact form (with return-to-property context). */
    onCreateNew: () => void;
    isCompact?: boolean;
}

export const PropertyOwnerPicker: React.FC<PropertyOwnerPickerProps> = ({
    contacts,
    onSelect,
    onCreateNew,
    isCompact = false,
}) => {
    const sorted = React.useMemo(
        () => [...contacts].sort((a, b) => a.name.localeCompare(b.name)),
        [contacts]
    );

    return (
        <div className={isCompact ? 'p-4' : 'p-1 sm:p-4'}>
            <div className={`flex justify-between items-center ${isCompact ? 'mb-4' : 'mb-6'}`}>
                <div>
                    <h3 className={`${isCompact ? 'text-lg' : 'text-xl'} font-bold text-slate-900 dark:text-white mb-1`}>
                        Select Owner
                    </h3>
                    <p className={`${isCompact ? 'text-xs' : 'text-sm'} text-slate-500`}>
                        Choose a contact to add or manage their properties.
                    </p>
                </div>
                <button
                    onClick={onCreateNew}
                    className={`${isCompact ? 'px-3 py-1.5 text-2xs' : 'px-4 py-2 text-xs'} bg-primary-600 hover:bg-primary-700 text-white font-black uppercase tracking-widest rounded-lg shadow-lg shadow-primary-500/20 transition-all flex items-center gap-1.5`}
                >
                    <svg className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                    </svg>
                    New
                </button>
            </div>
            <div className={`space-y-1.5 ${isCompact ? 'max-h-[65vh]' : 'max-h-[60vh]'} overflow-y-auto custom-scrollbar pr-1`}>
                {sorted.length > 0 ? sorted.map(c => (
                    <button
                        key={c.id}
                        onClick={() => onSelect(c.id)}
                        className={`w-full text-left ${isCompact ? 'p-3' : 'p-4'} rounded-lg border border-slate-200 dark:border-zinc-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-all flex items-center justify-between group`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`${isCompact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-slate-100 dark:bg-zinc-800 flex-shrink-0 flex items-center justify-center text-slate-500 font-bold ${isCompact ? 'text-xs' : 'text-sm'} group-hover:bg-primary-100 group-hover:text-primary-600`}>
                                {c.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <p className={`font-bold ${isCompact ? 'text-sm' : 'text-base'} text-slate-700 dark:text-zinc-300 group-hover:text-primary-700 truncate`}>
                                    {c.name}
                                </p>
                                <p className={`${isCompact ? 'text-2xs' : 'text-xs'} text-slate-500 truncate`}>
                                    {c.category || 'Contact'} &bull; {c.email || 'No email'}
                                </p>
                            </div>
                        </div>
                        <svg
                            className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-primary-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </button>
                )) : (
                    <div className={`text-center ${isCompact ? 'py-12' : 'py-20'} bg-slate-50 dark:bg-zinc-900 ${isCompact ? 'rounded-lg' : 'rounded-2xl'} border-2 border-dashed border-slate-200 dark:border-zinc-700`}>
                        <div className={`${isCompact ? 'w-12 h-12' : 'w-16 h-16'} bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400`}>
                            <UsersIcon className={isCompact ? 'w-6 h-6' : 'w-8 h-8'} />
                        </div>
                        <p className="text-slate-500 font-medium text-sm mb-4">No contacts found.</p>
                        <button
                            onClick={onCreateNew}
                            className={`${isCompact ? 'px-6 py-2 text-2xs' : 'px-8 py-3 text-xs'} bg-primary-600 hover:bg-primary-700 text-white font-black uppercase tracking-widest rounded-lg shadow-lg shadow-primary-500/30 transition-all inline-flex items-center gap-2`}
                        >
                            <svg className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                            </svg>
                            Create First Contact
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

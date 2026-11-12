

import React, { useState, useEffect } from 'react';
import { Matter, User, UserRole, CalendarEvent } from '../../types';
import { useProduct } from '../../contexts/ProductContext';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import { useUI } from '../../contexts/UIContext';

interface AssignUsersFormProps {
    item: { id: string; assignedUsers?: string[] };
    itemType: 'Matter' | 'Event';
    itemTitle: string;
    users: User[];
    onUpdate: (itemId: string, assignedUserIds: string[]) => void;
    onClose: () => void;
    /** V3 (V-MATTER-15): when present, this is a BULK assignment across
     *  several matters — the titles are shown so the user can see exactly
     *  what their selection applies to (the old modal showed no context). */
    bulkMatterTitles?: string[];
}

const AssignUsersForm: React.FC<AssignUsersFormProps> = ({ item, itemType, itemTitle, users, onUpdate, onClose, bulkMatterTitles }) => {
    const { isProperty } = useProduct();
    const { addToast } = useUI();
    const [assigned, setAssigned] = useState(() => new Set(item.assignedUsers || []));
    // UX-04 (double-submit guard): a second click while the assignment
    // write is in flight re-fired the update — the button disables itself.
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleToggle = (userId: string) => {
        setAssigned(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) newSet.delete(userId);
            else newSet.add(userId);
            return newSet;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (assigned.size === 0) {
            addToast('At least one user must be assigned.', { type: 'info' });
            return;
        }
        setIsSubmitting(true);
        try {
            await onUpdate(item.id, Array.from(assigned));
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter to Lawyers + Paralegals, AND exclude deactivated members.
    // Deactivated members cannot be assigned new work (their existing
    // assignments remain intact for audit, but they're not selectable
    // for new task assignments).
    const assignableUsers = users.filter(u =>
        (u.role === UserRole.Lawyer || u.role === UserRole.Paralegal)
        && !(u as any).deactivatedAt
    );

    return (
        <form onSubmit={handleSave} className="space-y-3">
            {bulkMatterTitles && bulkMatterTitles.length > 0 && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40 rounded-md">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-1">
                        Assigning to {bulkMatterTitles.length} matter{bulkMatterTitles.length === 1 ? '' : 's'}
                    </p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 line-clamp-3">
                        {bulkMatterTitles.slice(0, 5).join(', ')}
                        {bulkMatterTitles.length > 5 ? ` … and ${bulkMatterTitles.length - 5} more` : ''}
                    </p>
                    <p className="text-2xs text-indigo-500 dark:text-indigo-400 mt-1">The selected team replaces the current assignment on each matter.</p>
                </div>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 border rounded-md p-2 border-slate-200 dark:border-zinc-700">
                {assignableUsers.map(user => (
                    <label key={user.id} className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 dark:hover:bg-zinc-700/50 cursor-pointer">
                        <input autoComplete="off" data-lpignore="true" 
                            type="checkbox"
                            checked={assigned.has(user.id)}
                            onChange={() => handleToggle(user.id)}
                            className="h-5 w-5 rounded border-slate-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500"
                        />
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs ${getUserColor(user.name)}`}>
                           {getInitials(user.name)}
                        </div>
                        <div>
                            <span className="text-sm font-semibold text-slate-900 dark:text-dim-200">{user.name}</span>
                            <span className="text-xs text-slate-500 dark:text-dim-400 ml-2">
                                {user.role === UserRole.Lawyer ? (isProperty ? 'Manager' : 'Lawyer') : (isProperty ? 'Staff' : 'Paralegal')}
                            </span>
                        </div>
                    </label>
                ))}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
                <button type="button" onClick={onClose} className="px-6 py-2 text-sm bg-slate-200 dark:bg-dim-600 rounded-lg font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2 text-sm bg-primary-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Saving…' : 'Save'}</button>
            </div>
        </form>
    );
};

export default AssignUsersForm;

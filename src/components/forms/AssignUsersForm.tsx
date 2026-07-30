

import React, { useState, useEffect } from 'react';
import { Matter, User, UserRole, CalendarEvent } from '../../types';
import { useProduct } from '../../contexts/ProductContext';
import { getInitials, getUserColor } from '../../utils/colorUtils';

interface AssignUsersFormProps {
    item: { id: string; assignedUsers?: string[] };
    itemType: 'Matter' | 'Event';
    itemTitle: string;
    users: User[];
    onUpdate: (itemId: string, assignedUserIds: string[]) => void;
    onClose: () => void;
}

const AssignUsersForm: React.FC<AssignUsersFormProps> = ({ item, itemType, itemTitle, users, onUpdate, onClose }) => {
    const { isProperty } = useProduct();
    const [assigned, setAssigned] = useState(() => new Set(item.assignedUsers || []));

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
        await onUpdate(item.id, Array.from(assigned));
        onClose();
    };

    const assignableUsers = users.filter(u => u.role === UserRole.Lawyer || u.role === UserRole.Paralegal);

    return (
        <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 border rounded-md p-2 border-slate-200 dark:border-zinc-700">
                {assignableUsers.map(user => (
                    <label key={user.id} className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 dark:hover:bg-zinc-700/50 cursor-pointer">
                        <input autoComplete="off" data-lpignore="true" 
                            type="checkbox"
                            checked={assigned.has(user.id)}
                            onChange={() => handleToggle(user.id)}
                            className="h-5 w-5 rounded border-gray-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500"
                        />
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs ${getUserColor(user.name)}`}>
                           {getInitials(user.name)}
                        </div>
                        <div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">{user.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                {user.role === UserRole.Lawyer ? (isProperty ? 'Manager' : 'Lawyer') : (isProperty ? 'Staff' : 'Paralegal')}
                            </span>
                        </div>
                    </label>
                ))}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
                <button type="button" onClick={onClose} className="px-6 py-2 text-sm bg-gray-200 dark:bg-zinc-800 dark:bg-gray-600 rounded-lg font-semibold">Cancel</button>
                <button type="submit" className="px-6 py-2 text-sm bg-primary-600 text-white rounded-lg font-semibold">Save</button>
            </div>
        </form>
    );
};

export default AssignUsersForm;

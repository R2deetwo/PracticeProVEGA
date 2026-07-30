
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCoreState } from '../../contexts/CoreContext';
import { useAuth } from '../../contexts/AuthContext';

interface NotePageFormProps {
    onAdd: (page: any) => void;
    onClose: () => void;
    initialContext?: {
        notebookId?: string;
        parentId?: string | null;
        matterId?: string;
    };
}

const NotePageForm: React.FC<NotePageFormProps> = ({ onAdd, onClose, initialContext }) => {
    const [title, setTitle] = useState('');
    const { coreState, isDataLoaded } = useCoreState();
    const { currentUser } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        const now = new Date().toISOString();
        const newPage = {
            id: uuidv4(),
            firmId: coreState.firmDetails?.id || currentUser?.firmId,
            title: title.trim(),
            content: '',
            notebookId: initialContext?.notebookId || '',
            parentId: initialContext?.parentId || null,
            matterId: initialContext?.matterId,
            authorId: currentUser?.id || 'system',
            createdAt: now,
            updatedAt: now,
            order: 0,
            type: 'user' as const
        };

        await onAdd(newPage);
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Page Title</label>
                <input autoComplete="off" data-lpignore="true" 
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                    placeholder="Enter page title..."
                    autoFocus
                    required
                />
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm"
                >
                    Create Page
                </button>
            </div>
        </form>
    );
};

export default NotePageForm;

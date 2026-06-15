import React, { useState, useMemo } from 'react';
import { Matter, Contact } from '../../types';
import { SearchIcon } from '../../constants';

interface LinkContactModalProps {
    matter: Matter;
    allContacts: Contact[];
    onSave: (matterId: string, contactIds: string[]) => void;
    onClose: () => void;
}

const LinkContactModal: React.FC<LinkContactModalProps> = ({ matter, allContacts, onSave, onClose }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(matter.associatedContactIds || []));
    const [searchTerm, setSearchTerm] = useState('');

    const availableContacts = useMemo(() => {
        return allContacts.filter(c => c.id !== matter.clientId); // Exclude the primary client
    }, [allContacts, matter.clientId]);

    const filteredContacts = useMemo(() => {
        if (!searchTerm) return availableContacts;
        const lowercasedTerm = searchTerm.toLowerCase();
        return availableContacts.filter(c => c.name.toLowerCase().includes(lowercasedTerm));
    }, [availableContacts, searchTerm]);

    const handleToggle = (contactId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(contactId)) {
                newSet.delete(contactId);
            } else {
                newSet.add(contactId);
            }
            return newSet;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(matter.id, Array.from(selectedIds));
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input autoComplete="off" data-lpignore="true" 
                    type="search"
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
            </div>
            <div className="max-h-60 overflow-y-auto pr-2 space-y-2 border-t border-b border-slate-200 dark:border-zinc-700 py-2">
                {filteredContacts.length > 0 ? filteredContacts.map(contact => (
                    <label key={contact.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 cursor-pointer">
                        <input autoComplete="off" data-lpignore="true" 
                            type="checkbox"
                            checked={selectedIds.has(contact.id)}
                            onChange={() => handleToggle(contact.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div>
                            <p className="font-semibold">{contact.name}</p>
                            <p className="text-xs text-slate-500">{contact.category}</p>
                        </div>
                    </label>
                )) : <p className="text-sm text-center text-slate-500 py-4">No contacts found.</p>}
            </div>
            <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl font-bold text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors shadow-md">Save Links</button>
            </div>
        </form>
    );
};

export default LinkContactModal;
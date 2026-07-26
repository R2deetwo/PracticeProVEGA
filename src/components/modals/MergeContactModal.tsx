import React, { useState, useMemo } from 'react';
import { Contact } from '../../types';
import { SearchIcon, UserCircleIcon } from '../../constants';

interface MergeContactModalProps {
  sourceContact: Contact;
  allContacts: Contact[];
  onConfirm: (sourceId: string, targetId: string) => void;
  onClose: () => void;
}

const MergeContactModal: React.FC<MergeContactModalProps> = ({ sourceContact, allContacts, onConfirm, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const availableContacts = useMemo(() => {
    return allContacts.filter(c => c.id !== sourceContact.id);
  }, [allContacts, sourceContact.id]);

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return availableContacts;
    const term = searchTerm.toLowerCase();
    return availableContacts.filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.email.toLowerCase().includes(term)
    );
  }, [availableContacts, searchTerm]);

  const handleMerge = () => {
    if (selectedTargetId) {
      onConfirm(sourceContact.id, selectedTargetId);
      onClose();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <div className="mb-6">
        <p className="text-sm text-slate-500">
          You are merging <span className="font-bold text-slate-900 dark:text-white">{sourceContact.name}</span> into another contact. 
          All matters, properties, and notes will be transferred to the target contact, and {sourceContact.name} will be deleted.
        </p>
      </div>

      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input autoComplete="off" data-lpignore="true" 
          type="text"
          placeholder="Search target contact..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        />
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-[300px]">
        {filteredContacts.length > 0 ? (
          filteredContacts.map(contact => (
            <button
              key={contact.id}
              onClick={() => setSelectedTargetId(contact.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                selectedTargetId === contact.id 
                ? 'border-primary-500 bg-primary-50/50' 
                : 'border-slate-100 hover:border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  selectedTargetId === contact.id ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                }`}>
                  {contact.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{contact.name}</p>
                  <p className="text-xs text-slate-500">{contact.email}</p>
                </div>
              </div>
              {selectedTargetId === contact.id && (
                <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center text-white">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))
        ) : (
          <div className="text-center py-12">
            <UserCircleIcon className="w-12 h-12 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No contacts found.</p>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
        <button 
          onClick={onClose}
          className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-zinc-300"
        >
          Cancel
        </button>
        <button 
          onClick={handleMerge}
          disabled={!selectedTargetId}
          className="px-8 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-700 disabled:opacity-50 disabled:shadow-none transition-all"
        >
          Merge & Delete Source
        </button>
      </div>
    </div>
  );
};

export default MergeContactModal;

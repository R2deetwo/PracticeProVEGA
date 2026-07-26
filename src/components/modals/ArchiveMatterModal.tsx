import React from 'react';
import { Matter } from '../../types';

interface ArchiveMatterModalProps {
 matter: Matter;
 onConfirm: (matterId: string) => void;
 onClose: () => void;
}

const ArchiveMatterModal: React.FC<ArchiveMatterModalProps> = ({ matter, onConfirm, onClose }) => {
 const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  onConfirm(matter.id);
 };

 return (
  <form onSubmit={handleSubmit} className="space-y-4">
    <p className="text-gray-600 dark:text-zinc-400">
      Are you sure you want to archive the matter "<strong>{matter.title}</strong>"?
    </p>
    <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
      <p className="font-bold">Important:</p>
      <ul className="text-sm list-disc list-inside mt-1">
        <li>This will remove the matter and all its associated documents and tasks from active lists.</li>
        <li>The items will be moved to the Archive, where they can be restored later.</li>
      </ul>
    </div>
    <div className="pt-4 flex justify-end space-x-2">
      <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">Cancel</button>
      <button type="submit" className="px-5 py-2 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition-colors shadow-md">Confirm & Archive</button>
    </div>
  </form>
 );
};

export default ArchiveMatterModal;
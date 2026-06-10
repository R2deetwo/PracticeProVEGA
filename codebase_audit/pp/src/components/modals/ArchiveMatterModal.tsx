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
        <p className="text-gray-600 dark:text-gray-300">
            Are you sure you want to archive the matter "<strong>{matter.title}</strong>"?
        </p>
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 text-yellow-800 dark:text-yellow-200">
            <p className="font-bold">Important:</p>
            <ul className="text-sm list-disc list-inside mt-1">
                <li>This will remove the matter and all its associated documents and tasks from active lists.</li>
                <li>The items will be moved to the Archive, where they can be restored later.</li>
            </ul>
        </div>
        <div className="pt-4 flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors shadow-sm">Confirm & Archive</button>
        </div>
    </form>
  );
};

export default ArchiveMatterModal;
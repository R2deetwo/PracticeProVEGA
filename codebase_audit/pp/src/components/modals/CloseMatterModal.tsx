
import React, { useState } from 'react';
import { Matter, TimeEntry, Expense } from '../../types';

interface CloseMatterModalProps {
  matter: Matter;
  unbilledTime: TimeEntry[];
  unbilledExpenses: Expense[];
  onConfirm: (matterId: string, closingNote: string) => void;
  onClose: () => void;
}

const CloseMatterModal: React.FC<CloseMatterModalProps> = ({ matter, unbilledTime, unbilledExpenses, onConfirm, onClose }) => {
  const [closingNote, setClosingNote] = useState('');

  const totalUnbilledHours = unbilledTime.reduce((sum, entry) => sum + entry.duration, 0);
  const totalUnbilledExpenses = unbilledExpenses.reduce((sum, entry) => sum + entry.amount, 0);
  const hasUnbilledItems = unbilledTime.length > 0 || unbilledExpenses.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(matter.id, closingNote);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-gray-600 dark:text-gray-300">
            You are about to close the matter "<strong>{matter.title}</strong>". This action will change its status to 'Closed' and it will no longer appear in the main active matters list.
        </p>
        {hasUnbilledItems && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 text-yellow-800 dark:text-yellow-200">
                <p className="font-bold">Warning: Unbilled Items Found</p>
                <ul className="text-sm list-disc list-inside mt-1">
                    {unbilledTime.length > 0 && <li>{unbilledTime.length} unbilled time entries ({totalUnbilledHours.toFixed(1)} hours).</li>}
                    {unbilledExpenses.length > 0 && <li>{unbilledExpenses.length} unbilled expenses (₦{totalUnbilledExpenses.toLocaleString()}).</li>}
                </ul>
                <p className="text-xs mt-2">These items will NOT be automatically invoiced. Proceed with closing only if this is intended.</p>
            </div>
        )}
        <div>
            <label htmlFor="closingNote" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Closing Summary (Optional)</label>
            <textarea
                id="closingNote"
                rows={4}
                value={closingNote}
                onChange={e => setClosingNote(e.target.value)}
                placeholder="Enter any final notes about the matter's resolution..."
                className="text-gray-900 dark:text-gray-300 w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 focus:ring-primary-500 focus:border-primary-500"
            />
        </div>
        <div className="pt-4 flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">Confirm & Close Matter</button>
        </div>
    </form>
  );
};

export default CloseMatterModal;
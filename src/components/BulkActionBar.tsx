
import React, { useState } from 'react';
import { TaskStatus, TaskStatusValues } from '../types';
import { ArchiveIcon, TrashIcon } from '../constants';

interface BulkActionBarProps {
  selectedCount: number;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onBulkUpdateStatus: (status: TaskStatus) => void;
  onClearSelection: () => void;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onBulkArchive,
  onBulkDelete,
  onBulkUpdateStatus,
  onClearSelection,
}) => {
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  const handleStatusUpdate = (status: TaskStatus) => {
    onBulkUpdateStatus(status);
    setIsStatusOpen(false);
  };

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl z-40 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-3 flex items-center justify-between animate-fade-in-up border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
                <span className="text-sm font-semibold text-gray-800 dark:text-white whitespace-nowrap px-2">{selectedCount} selected</span>
                
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                
                <button onClick={onBulkArchive} className="px-3 py-1.5 text-sm bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-md font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50 flex items-center gap-1.5 transition-colors">
                    <ArchiveIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Archive</span>
                </button>
                
                 <button onClick={onBulkDelete} className="px-3 py-1.5 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md font-semibold hover:bg-red-100 dark:hover:bg-red-900/50 flex items-center gap-1.5 transition-colors">
                    <TrashIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                </button>

                <div className="relative">
                    <button onClick={() => setIsStatusOpen(prev => !prev)} className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-md font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap">
                        Update Status
                    </button>
                    {isStatusOpen && (
                        <div className="absolute bottom-full mb-2 left-0 w-40 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-md shadow-lg z-50">
                            {TaskStatusValues.map(status => (
                                <button
                                    key={status}
                                    onClick={() => handleStatusUpdate(status)}
                                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 first:rounded-t-md last:rounded-b-md"
                                >
                                    {status.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <button onClick={onClearSelection} className="text-sm font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 ml-4 px-2">
                Clear
            </button>
        </div>
    </div>
  );
};

export default BulkActionBar;

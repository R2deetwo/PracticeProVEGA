
import React, { useState, useMemo } from 'react';
import { ArchivedItem } from '../types';
import { ArchiveIcon } from '../constants';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import Fuse from 'fuse.js';

const ArchiveView: React.FC = () => {
  const { coreState } = useCoreState();
  const { handleRestoreItem, handlePermanentDeleteFromArchive } = useDataActions();
  const archive = coreState.archive;

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const onRestore = handleRestoreItem;
  const onPermanentDelete = handlePermanentDeleteFromArchive;
  const onEmptyArchive = () => {}; // Not implemented in actions yet


    const filteredArchive = useMemo(() => {
    let items = [...archive];

    if (dateFilter !== 'all') {
        const now = new Date();
        let cutoffDate: Date | null = null;
        if (dateFilter === '7') cutoffDate = new Date(new Date().setDate(now.getDate() - 7));
        else if (dateFilter === '30') cutoffDate = new Date(new Date().setMonth(now.getMonth() - 1));
        else if (dateFilter === '90') cutoffDate = new Date(new Date().setMonth(now.getMonth() - 3));

        if (cutoffDate) {
            items = items.filter(item => new Date(item.archivedAt) >= cutoffDate!);
        }
    }

    if (searchTerm.trim()) {
        const fuse = new Fuse(items, {
            keys: ['itemName', 'itemType', 'archiverName', 'originalData.title'],
            threshold: 0.3,
            includeScore: true,
        });
        return fuse.search(searchTerm.trim()).map((result: any) => result.item);
    }

    return items.sort((a,b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());
  }, [archive, searchTerm, dateFilter]);

  const groupedArchive = useMemo(() => {
    // Group by itemType (Matter, Task, Document, Contact) instead of by matter
    const grouped = new Map<string, { matterTitle: string; items: ArchivedItem[] }>();
    const noMatterItems: ArchivedItem[] = [];

    filteredArchive.forEach((item: ArchivedItem) => {
        const typeKey = item.itemType || 'Other';
        if (!grouped.has(typeKey)) {
            grouped.set(typeKey, { matterTitle: typeKey.charAt(0).toUpperCase() + typeKey.slice(1) + 's', items: [] });
        }
        grouped.get(typeKey)!.items.push(item);
    });

    const sortedGroups = Array.from(grouped.values()).sort((a, b) => a.matterTitle.localeCompare(b.matterTitle));

    return { sortedGroups, noMatterItems };
  }, [filteredArchive]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-32">
        <header className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-6">
            <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Archive</h2>
            {archive.length > 0 && (
                <button
                    onClick={onEmptyArchive}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm flex items-center gap-2 text-xs uppercase"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Empty Archive
                </button>
            )}
        </header>

        <div className="px-4 sm:px-6 lg:px-8">
      
      {archive.length > 0 ? (
        <>
        <div className="mb-4 flex flex-col sm:flex-row gap-4">
            <input autoComplete="off" data-lpignore="true" 
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, type, matter..."
                className="w-full sm:w-2/3 px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
             <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full sm:w-1/3 px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500"
             >
                <option value="all">All Time</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
             </select>
        </div>
        <div className="space-y-6">
            {groupedArchive.sortedGroups.map(({ matterTitle, items }) => (
                <div key={matterTitle} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 px-6 py-3 border-b border-gray-200 dark:border-gray-700">{matterTitle}</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {items.map(item => <ArchiveRow key={item.id} item={item} onRestore={onRestore} onPermanentDelete={onPermanentDelete} />)}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
             {groupedArchive.noMatterItems.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 px-6 py-3 border-b border-gray-200 dark:border-gray-700">Unassociated Items</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {groupedArchive.noMatterItems.map(item => <ArchiveRow key={item.id} item={item} onRestore={onRestore} onPermanentDelete={onPermanentDelete} />)}
                            </tbody>
                        </table>
                    </div>
                </div>
             )}
        </div>
        </>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <ArchiveIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">The Archive is Empty</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">When you archive matters, contacts, or other items, they will appear here.</p>
        </div>
      )}
            </div>
        </div>
    );
};

interface ArchiveRowProps {
    item: ArchivedItem;
    onRestore: (item: ArchivedItem) => void;
    onPermanentDelete: (archiveId: string) => void;
}

const ArchiveRow: React.FC<ArchiveRowProps> = ({ item, onRestore, onPermanentDelete }) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-transform duration-200 hover:-translate-y-px">
        <td className="px-6 py-4 whitespace-nowrap">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{item.itemName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.itemType}</p>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{item.archiverName}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{new Date(item.archivedAt).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
            <button onClick={() => onRestore(item)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-semibold">Restore</button>
            <button onClick={() => onPermanentDelete(item.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-semibold">Delete</button>
        </td>
    </tr>
);

export default ArchiveView;

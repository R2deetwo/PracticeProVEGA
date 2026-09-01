
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ArchivedItem } from '../types';
import { ArchiveIcon } from '../constants';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import Fuse from 'fuse.js';

const ArchiveView: React.FC = () => {
  const { coreState } = useCoreState();
  const { handleRestoreItem, handlePermanentDeleteFromArchive } = useDataActions();
  const { openModal, closeModal, addToast } = useUI();
  const { currentUser } = useAuth();
  const archive = coreState.archive;
  const firmId = (coreState.firmDetails as any)?.id || currentUser?.firmId || '';

  // ── SOFT-ARCHIVED CONTACTS ───────────────────────────────────────────────
  // FIX: ContactDetailView's "Archive Contact" modal promises "restore any
  // time from the archive", but soft-archived contacts never appeared here
  // and restoreContact was never called anywhere. This section lists them
  // and wires the restore.
  const archivedContacts = useQuery(
    api.myFunctions.getArchivedContacts,
    firmId ? { firmId, userEmail: currentUser?.email } : 'skip'
  );
  const restoreContactMutation = useMutation(api.myFunctions.restoreContact);
  const handleRestoreContact = async (contactId: string, contactName: string) => {
    try {
      await restoreContactMutation({ contactId, userEmail: currentUser?.email });
      addToast(`${contactName} restored to your active contacts.`, { type: 'success' });
    } catch (e: any) {
      addToast(e?.message || 'Failed to restore contact.', { type: 'error' });
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const onRestore = handleRestoreItem;
  const onPermanentDelete = handlePermanentDeleteFromArchive;
  const onEmptyArchive = async () => {
    // Confirm before permanently deleting ALL archived items
    openModal('deleteConfirmation', null, {
      title: 'Empty Entire Archive?',
      message: 'This will PERMANENTLY DELETE all archived items. This action cannot be undone. Are you absolutely sure?',
      onConfirm: async () => {
        try {
          // Delete each archived item permanently
          for (const item of filteredArchive) {
            await handlePermanentDeleteFromArchive(item.id);
          }
          addToast(`Permanently deleted ${filteredArchive.length} archived items.`, { type: 'success' });
        } catch (e: any) {
          addToast(e?.message || 'Failed to empty archive.', { type: 'error' });
        }
        closeModal();
      },
      confirmText: 'Delete All',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });
  };


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
        <header className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-6">
            <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Archive</h2>
            {/* SIMPLIFY FIX: destructive bulk-delete demoted from a red header
                button to a quiet text link — it sat above restore actions on a
                page that's usually empty, begging for accidental clicks. */}
            {archive.length > 0 && (
                <button
                    onClick={onEmptyArchive}
                    className="px-2 py-1 text-slate-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 text-xs font-bold underline-offset-2 hover:underline transition-colors"
                    title="Permanently delete everything in the archive"
                >
                    Empty Archive…
                </button>
            )}
        </header>

        <div className="px-4 sm:px-6 lg:px-8">

      {/* Soft-archived contacts — restorable */}
      {(archivedContacts || []).length > 0 && (
        <div className="mb-8">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">
                Archived Contacts <span className="text-slate-300">({archivedContacts!.length})</span>
            </h3>
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 divide-y divide-slate-100 dark:divide-zinc-700/50">
                {(archivedContacts || []).map((c: any) => (
                    <div key={String(c._id || c.id)} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">{c.name || 'Unnamed contact'}</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                {[c.category, c.company, c.email, c.phone].filter(Boolean).join(' · ') || 'No details'}
                            </p>
                        </div>
                        <button
                            onClick={() => handleRestoreContact(String(c._id || c.id), c.name || 'Contact')}
                            className="px-3 py-1.5 bg-primary-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0"
                        >
                            Restore
                        </button>
                    </div>
                ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">
                Archived contacts keep working with their existing matters and properties — restoring re-shows them in Contacts.
            </p>
        </div>
      )}

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
                                {items.map(item => <ArchiveRow key={item.id} item={item} onRestore={onRestore} onPermanentDelete={onPermanentDelete} openModal={openModal} />)}
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
                                {groupedArchive.noMatterItems.map(item => <ArchiveRow key={item.id} item={item} onRestore={onRestore} onPermanentDelete={onPermanentDelete} openModal={openModal} />)}
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
    openModal: (type: string, id: string | null, context?: any) => void;
}

const ArchiveRow: React.FC<ArchiveRowProps> = ({ item, onRestore, onPermanentDelete, openModal }) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-transform duration-200 hover:-translate-y-px">
        <td className="px-6 py-4 whitespace-nowrap">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{item.itemName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.itemType}</p>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{item.archiverName}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{new Date(item.archivedAt).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
            <button onClick={() => onRestore(item)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-semibold">Restore</button>
            <button onClick={() => openModal('deleteConfirmation', item.id, {
                title: `Permanently delete "${item.itemName}"?`,
                message: 'This action cannot be undone. The item will be permanently removed from the archive.',
                onConfirm: () => { onPermanentDelete(item.id); },
                confirmText: 'Delete Permanently',
                confirmButtonClass: 'bg-red-600 hover:bg-red-700',
            })} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-semibold">Delete</button>
        </td>
    </tr>
);

export default ArchiveView;

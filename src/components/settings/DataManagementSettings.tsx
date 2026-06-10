
import React, { useState } from 'react';
import { useMatterState } from '../../contexts/MatterContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { DownloadIcon, TrashIcon, SearchIcon, ShieldCheckIcon, ComputerDesktopIcon, LockClosedIcon } from '../../constants';
import { useProduct } from '../../contexts/ProductContext';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; className?: string; onTitleClick?: () => void }> = ({ title, children, className, onTitleClick }) => (
    <div className={`relative overflow-hidden bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl shadow-md p-6 ${className || ''}`}>
        <div className="relative z-10">
            <h3
                className={`text-xl font-bold text-gray-900 dark:text-white mb-4 ${onTitleClick ? 'cursor-pointer select-none active:text-primary-500' : ''}`}
                onClick={onTitleClick}
            >
                {title}
            </h3>
            {children}
        </div>
    </div>
);

interface DataManagementSettingsProps {
    onEnableDevMode?: () => void;
}

const DataManagementSettings: React.FC<DataManagementSettingsProps> = ({ onEnableDevMode }) => {
    const { matterState } = useMatterState();
    const { documentState } = useDocumentState();
    const { coreState, isDataLoaded } = useCoreState();
    const { deleteItem, handleExportData, handleResetPracticeData, handleRestoreItem, handlePermanentDeleteFromArchive } = useDataActions();
    const { openModal, closeModal, addToast } = useUI();
    const { deleteAccount, currentUser, login, switchFirm, leaveFirm, deleteFirm } = useAuth();
    
    const joinedFirms = useQuery(api.myFunctions.getJoinedFirms, { 
        firmIds: Array.from(new Set([currentUser?.firmId, ...(currentUser?.joinedFirmIds || [])])).filter(Boolean) as string[] 
    });

    const handleSwitchFirm = async (id: string) => {
        if (id === currentUser?.firmId) return;
        addToast("Switching firm...", { type: 'info' });
        await switchFirm(id);
        window.location.reload();
    };

    const handleLeaveFirm = (id: string, name: string) => {
        openModal('deleteConfirmation', id, {
            title: `Leave Firm: ${name}?`,
            message: "You will no longer have access to this firm's data. You can be re-invited by an admin later.",
            onConfirm: async () => {
                const result = await leaveFirm(id);
                if (result.success) {
                    addToast(`Left ${name}`, { type: 'success' });
                    window.location.reload();
                } else {
                    addToast(`Failed: ${result.message}`, { type: 'error' });
                }
            },
            confirmText: "Leave Firm"
        });
    };

    const handleDeleteFirm = (id: string, name: string) => {
        openModal('deleteConfirmation', id, {
            title: `DELETE FIRM: ${name}?`,
            message: "CRITICAL: This will permanently purge ALL matters, contacts, documents, and data for this firm. This action is irreversible.",
            onConfirm: async () => {
                const result = await deleteFirm(id);
                if (result.success) {
                    addToast(`Firm ${name} deleted.`, { type: 'success' });
                    window.location.reload();
                } else {
                    addToast(`Failed: ${result.message}`, { type: 'error' });
                }
            },
            confirmText: "Delete Firm & All Data",
            confirmButtonClass: "bg-red-700 hover:bg-red-800",
            verificationText: name.toUpperCase().replace(/\s/g, '_')
        });
    };
    const [reAuthPassword, setReAuthPassword] = useState('');
    const [reAuthError, setReAuthError] = useState<string | null>(null);
    const [reAuthLoading, setReAuthLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const { isProperty, isLegal } = useProduct();
    const [dangerClickCount, setDangerClickCount] = useState(0);

    // Manual ID Deletion State
    const [manualDeleteId, setManualDeleteId] = useState('');
    const [manualDeleteType, setManualDeleteType] = useState<'matters' | 'contacts' | 'documents' | 'properties'>('matters');

    const handleDangerTitleClick = () => {
        if (!onEnableDevMode) return;

        const newCount = dangerClickCount + 1;
        setDangerClickCount(newCount);

        if (newCount === 4) {
            onEnableDevMode();
            addToast("Developer Toolkit Activated!", { type: 'success' });
            setDangerClickCount(0);
        }
    };

    const [activeRepairTab, setActiveRepairTab] = useState<'matters' | 'contacts' | 'documents' | 'properties'>(isProperty && !isLegal ? 'properties' : 'matters');

    const handleFactoryReset = () => {
        setReAuthError(null);

        openModal('deleteConfirmation', null, {
            title: 'Confirm Identity to Delete Account',
            message: (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                        <LockClosedIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <div>
                            <p className="text-red-700 dark:text-red-400 font-bold text-sm">Security Verification Required</p>
                            <p className="text-red-600 dark:text-red-500 text-xs mt-0.5">This action is irreversible. Enter your password to confirm your identity.</p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-500 border-t border-slate-200 dark:border-zinc-700 pt-3">
                        This will permanently delete your account, all profile data, and firm access. This cannot be undone.
                    </p>
                </div>
            ),
            requiresPassword: true,
            onConfirm: async (password: string) => {
                if (!password) {
                    addToast('Password is required.', { type: 'error' });
                    return;
                }
                setReAuthLoading(true);
                try {
                    // Re-authenticate before allowing deletion
                    const verifyResult = await login(currentUser?.email || '', password);
                    if (!verifyResult.success) {
                        addToast('Incorrect password. Account deletion cancelled.', { type: 'error' });
                        setReAuthLoading(false);
                        return;
                    }
                    const result = await deleteAccount();
                    if (result.success) {
                        addToast("Account deleted successfully.", { type: 'success' });
                        window.location.reload();
                    } else {
                        addToast(`Error: ${result.message}`, { type: 'error' });
                        closeModal();
                    }
                } finally {
                    setReAuthLoading(false);
                }
            },
            confirmText: 'Delete Account',
            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
        });
    };

    const handleResetPractice = () => {
        openModal('deleteConfirmation', null, {
            title: 'Reset Practice Data?',
            message: (
                <div className="space-y-2">
                    <p>This will delete all <strong>{isLegal ? 'Matters, ' : ''}Contacts, Tasks, and {isProperty ? 'Properties' : 'Documents'}</strong>.</p>
                    <p className="text-sm">Your Firm Settings and User Accounts will be preserved.</p>
                    <p className="text-green-600 font-bold text-xs mt-2">
                        <ShieldCheckIcon className="w-3 h-3 inline mr-1" />
                        Safe Reset: A safety backup will be automatically created before data is cleared.
                    </p>
                </div>
            ),
            onConfirm: async () => {
                try {
                    await handleResetPracticeData();
                    addToast("Practice data reset successfully. Safety backup created.", { type: 'success' });
                } catch (error) {
                    console.error("Reset Failed:", error);
                    addToast("Failed to reset data. Please try again.", { type: 'error' });
                } finally {
                    closeModal();
                }
            },
            confirmText: 'Clear Data Only',
            confirmButtonClass: 'bg-red-600 hover:bg-red-700',
            verificationText: 'CLEAR'
        });
    }

    const forceDeleteItemMutation = useMutation(api.myFunctions.forceDeleteItem);
    
    const handleForceDelete = (id: string, collectionName: string, name: string) => {
        openModal('deleteConfirmation', id, {
            title: `Repair: Force Delete ${name}?`,
            message: `You are about to PERMANENTLY remove this item from the database using an administrative override. This will bypass all standard business logic and checks.`,
            onConfirm: async () => {
                try {
                    const result = await forceDeleteItemMutation({ id, userEmail: currentUser?.email });
                    if (result.success) {
                        addToast(`Administrative Delete Successful (${result.method})`, { type: 'success' });
                    } else {
                        addToast(`Repair failed: ${result.message}`, { type: 'error' });
                    }
                } catch (e: any) {
                    addToast(`Operation failed: ${e.message}`, { type: 'error' });
                }
                closeModal();
            },
            confirmText: 'Execute Nuclear Delete',
            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
        });
    };

    const handleManualDelete = () => {
        if (!manualDeleteId.trim()) return;
        
        openModal('deleteConfirmation', manualDeleteId.trim(), {
            title: 'Nuclear Option: Force Delete by ID?',
            message: (
                <div className="space-y-2">
                    <p>You are about to delete ID <strong>{manualDeleteId}</strong> from the database.</p>
                    <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded">
                        WARNING: This bypasses all safety checks and cascade logic. 
                        Only use this if standard deletion fails.
                    </p>
                </div>
            ),
            onConfirm: async () => {
                try {
                    const result = await forceDeleteItemMutation({ id: manualDeleteId.trim(), userEmail: currentUser?.email });
                    if (result.success) {
                        addToast("Item deleted from server.", { type: 'success' });
                        // Clear locally just in case it's in any state
                        setManualDeleteId('');
                    } else {
                        addToast(`Force delete failed: ${result.message}`, { type: 'error' });
                    }
                } catch (e: any) {
                    addToast(`Error: ${e.message}`, { type: 'error' });
                } finally {
                    closeModal();
                }
            },
            confirmText: 'Execute Nuclear Option',
            confirmButtonClass: 'bg-red-700 hover:bg-red-800'
        });
    };

    const handleExtractItem = (item: any) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(item, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${item.title || item.name || 'item'}_export.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        addToast("Item extracted as JSON.", { type: 'success' });
    };

    const getItems = () => {
        let list: any[] = [];
        if (activeRepairTab === 'matters') list = matterState.matters || [];
        if (activeRepairTab === 'contacts') list = matterState.contacts || [];
        if (activeRepairTab === 'documents') list = documentState.documents || [];
        if (activeRepairTab === 'properties') list = coreState.properties || [];

        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            return list.filter(i => (i?.title || i?.name || 'Untitled').toLowerCase().includes(lower));
        }
        return list;
    };

    const itemsToDisplay = getItems();

    const archiveItems = coreState.archive || [];

    return (
        <div className="space-y-8">
            {/* Firm Management Section */}
            <SettingsCard title="Manage Your Firms" className="border-primary-100 dark:border-primary-900/30">
                <div className="text-sm text-slate-600 dark:text-zinc-400 mb-6">
                    <p className="font-semibold text-slate-900 dark:text-white mb-1">Your Firm Identities</p>
                    <p>You are a member of multiple firms. You can switch between them or manage your membership here.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {joinedFirms ? (
                        joinedFirms.map((f: any) => (
                            <div key={f.id} className={`p-4 rounded-xl border transition-all ${f.id === currentUser?.firmId ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-300 dark:border-primary-800 ring-1 ring-primary-500' : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white">{f.name}</p>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Product: {f.product || 'Vega'}</p>
                                    </div>
                                    {f.id === currentUser?.firmId && (
                                        <span className="px-2 py-0.5 bg-primary-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">Active</span>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-700/50">
                                    <button 
                                        onClick={() => handleSwitchFirm(f.id)}
                                        disabled={f.id === currentUser?.firmId}
                                        className="flex-1 py-2 text-xs font-bold rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-50"
                                    >
                                        Switch
                                    </button>
                                    <button 
                                        onClick={() => handleLeaveFirm(f.id, f.name)}
                                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-600 transition-colors"
                                    >
                                        Leave
                                    </button>
                                    {currentUser?.role === 'Admin' && (
                                        <button 
                                            onClick={() => handleDeleteFirm(f.id, f.name)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Delete Firm & All Data"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-2 py-8 text-center animate-pulse">
                            <p className="text-slate-400 text-sm">Loading your firms...</p>
                        </div>
                    )}
                </div>
            </SettingsCard>

            {/* 0. Archives & Trash */}
            <SettingsCard title="Archives & Bin" className="border-emerald-200 dark:border-emerald-900/50">
                <div className="text-sm text-slate-600 dark:text-zinc-400 mb-6">
                    <p className="font-semibold text-slate-900 dark:text-white mb-1">Recover Deleted Items</p>
                    <p>Items deleted from your practice are kept here for 30 days before being permanently purged.</p>
                </div>

                <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-900 custom-scrollbar">
                    {archiveItems.length > 0 ? (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-zinc-800 text-xs text-slate-500 uppercase sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-700">
                                <tr>
                                    <th className="px-4 py-3">Item</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Archived On</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                                {archiveItems.map((item: any) => (
                                    <tr key={item.id} className="hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-zinc-200">{item.itemName}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-zinc-700 rounded text-slate-600 dark:text-zinc-400 font-black uppercase tracking-widest">{item.itemType}</span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-zinc-500 text-xs">{new Date(item.archivedAt).toLocaleDateString('en-GB')}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleRestoreItem(item)}
                                                    className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 shadow-sm"
                                                >
                                                    Restore
                                                </button>
                                                <button
                                                    onClick={() => handlePermanentDeleteFromArchive(item.id)}
                                                    className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-red-500 rounded text-xs font-bold hover:bg-red-50 transition-colors"
                                                >
                                                    Purge
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-12 text-center text-slate-400 italic">
                            <TrashIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p>Archive is empty. Your deleted items will appear here.</p>
                        </div>
                    )}
                </div>
            </SettingsCard>

            {/* 1. Data Portability */}
            <SettingsCard title="Data Portability">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-slate-600 dark:text-zinc-400">
                        <p className="font-semibold text-slate-900 dark:text-white mb-1">Backup Your Practice</p>
                        <p>Download a complete archive (.zip) containing CSV spreadsheets for Excel and a JSON backup file.</p>
                    </div>
                    <button
                        onClick={handleExportData}
                        className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                    >
                        <DownloadIcon className="w-5 h-5 text-primary-600" /> Download Archive
                    </button>
                </div>
            </SettingsCard>

            {/* 1.5. Secure Local Access */}
            <SettingsCard title="Secure Local Access" className="border-blue-200 dark:border-blue-900/50">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <ComputerDesktopIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">Local Folder Integration</h4>
                        <div className="text-sm text-slate-600 dark:text-zinc-400 space-y-2 max-w-2xl">
                            <p>
                                PracticePro allows you to securely access files directly from a local folder on your computer.
                                <strong> Files remain on your device</strong> and are not uploaded to the cloud unless you explicitly choose to "Cache" them.
                            </p>
                            <p className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg text-blue-800 dark:text-blue-200 font-medium text-xs">
                                To select your folder: Go to <strong>Documents</strong> in the sidebar → click <strong>Secure Local Storage</strong>.
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Local Only:</strong> Files are accessible only when this computer is online and the folder is permitted.</li>
                                <li><strong>Cached Mode:</strong> "Cached" files are temporarily stored on the secure server for remote access.</li>
                            </ul>
                            <p className="text-xs italic text-slate-500 mt-2">
                                Note: Browser security requires you to re-confirm access to the local folder after each browser restart.
                            </p>
                        </div>
                    </div>
                </div>
            </SettingsCard>

            {/* 2. Repair Tools (Renamed) */}
            <SettingsCard title="Database Repair Mode" className="border-yellow-200 dark:border-yellow-900/50">
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-900 flex gap-3 items-start">
                    <ShieldCheckIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-200">Correction Tools</h4>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                            Use this tool to extract data from individual items or force-delete corrupted records that crash the main interface.
                        </p>
                    </div>
                </div>

                {/* MANUAL OVERRIDE SECTION */}
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <h4 className="text-sm font-bold text-red-700 dark:text-red-300 mb-2">Manual Override (Nuclear Option)</h4>
                    <p className="text-xs text-slate-500 mb-3">If an item is so corrupted it doesn't appear in lists but throws errors, paste its ID here to delete it blindly.</p>
                    <div className="flex gap-2">
                        <select
                            value={manualDeleteType}
                            onChange={e => setManualDeleteType(e.target.value as any)}
                            className="p-2 text-sm border rounded dark:bg-zinc-800 dark:border-zinc-600"
                        >
                            <option value="matters">Matter</option>
                            <option value="contacts">Contact</option>
                            <option value="documents">Document</option>
                            <option value="properties">Property</option>
                        </select>
                        <input autoComplete="off" data-lpignore="true" 
                            type="text"
                            value={manualDeleteId}
                            onChange={e => setManualDeleteId(e.target.value)}
                            placeholder="Paste Item ID (e.g. 550e8400...)"
                            className="flex-grow p-2 text-sm border rounded dark:bg-zinc-800 dark:border-zinc-600"
                        />
                        <button
                            onClick={handleManualDelete}
                            disabled={!manualDeleteId}
                            className="px-4 py-2 bg-red-600 text-white rounded text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                        >
                            Force Delete
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-zinc-700 pb-1">
                    {(['matters', 'contacts', 'documents', 'properties'] as const).filter(t => t !== 'matters' || isLegal).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveRepairTab(tab); setSearchTerm(''); }}
                            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors capitalize ${activeRepairTab === tab ? 'bg-slate-100 dark:bg-zinc-700 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'}`}
                        >
                            {tab} ({tab === 'matters' ? matterState.matters?.length || 0 : tab === 'contacts' ? matterState.contacts?.length || 0 : tab === 'documents' ? documentState.documents?.length || 0 : coreState.properties?.length || 0})
                        </button>
                    ))}
                </div>

                <div className="mb-3 relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input autoComplete="off" data-lpignore="true" 
                        type="text"
                        placeholder={`Search ${activeRepairTab} by name...`}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-primary-500"
                    />
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-900 custom-scrollbar">
                    {itemsToDisplay.length > 0 ? (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-zinc-800 text-xs text-slate-500 uppercase sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2 w-24">ID</th>
                                    <th className="px-4 py-2">Name/Title</th>
                                    <th className="px-4 py-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                                {itemsToDisplay.map((item: any) => {
                                    // Handle ghost/undefined items
                                    const itemId = item?.id || 'MISSING';
                                    const itemName = item?.title || item?.name || 'Corrupted Item';

                                    return (
                                        <tr key={itemId !== 'MISSING' ? itemId : Math.random()} className="hover:bg-slate-100 dark:hover:bg-zinc-800/50">
                                            <td className="px-4 py-2 font-mono text-[10px] text-slate-400 select-all" title={itemId}>{itemId}</td>
                                            <td className="px-4 py-2 font-medium text-slate-700 dark:text-zinc-300 truncate max-w-[300px]">
                                                {itemName === 'Corrupted Item' && item?.address ? (
                                                    item.address
                                                ) : itemName === 'Corrupted Item' ? (
                                                    <span className="text-red-500 italic">{itemName}</span>
                                                ) : (
                                                    itemName
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleForceDelete(itemId, activeRepairTab, itemName)}
                                                        className="text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 px-3 py-1 rounded text-xs font-bold transition-colors"
                                                    >
                                                        Force Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-8 text-center text-slate-400 text-sm italic">
                            No items found.
                        </div>
                    )}
                </div>
            </SettingsCard>

            {/* 4. Danger Zone */}
            <SettingsCard title="Danger Zone" className="border-red-200 dark:border-red-900/50" onTitleClick={handleDangerTitleClick}>
                <div className="space-y-6">
                    {/* Clear Operational Data */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-6 border-b border-red-100 dark:border-red-900/30">
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-white">Reset {isProperty ? 'Portfolio' : 'Practice'} Data</h4>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-lg">
                                Deletes all {isLegal ? 'Matters, ' : ''}Contacts, Documents, and Tasks. <br />
                                <span className="font-semibold text-green-600 dark:text-green-400">Safe:</span> Keeps your Firm Profile, Settings, and User Accounts intact.
                            </p>
                        </div>
                        <button
                            onClick={handleResetPractice}
                            className="flex-shrink-0 px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                            Reset Data Only
                        </button>
                    </div>

                    {/* Factory Reset */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div>
                            <h4 className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                                <TrashIcon className="w-4 h-4" /> Delete Account
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-lg">
                                Permanently delete your user account. This will remove your access to the firm. If you are the only admin, the firm data will remain but be unowned.
                            </p>
                        </div>
                        <button
                            onClick={handleFactoryReset}
                            className="flex-shrink-0 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition-colors"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>
            </SettingsCard>
        </div>
    );
};

export default DataManagementSettings;

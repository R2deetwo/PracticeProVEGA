import React, { useState, useEffect } from 'react';
import { useFirmLocalFileSystem, LocalFile } from '../hooks/useLocalFileSystem';
import { LargeFolderIcon, DocumentIcon, CloudIcon, ComputerDesktopIcon, ArrowPathIcon, ImageIcon, ChartBarIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '../constants';
import { formatBytes } from '../utils/formatting';
import Tooltip from './Tooltip';
import { useUI } from '../contexts/UIContext';
import { useAloa } from '../contexts/AloaProvider';
import { Document, AppMode, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useMatterState } from '../contexts/MatterContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { Modal } from './modals/Modal';
import { v4 as uuidv4 } from 'uuid';
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface LocalDocumentManagerProps {
    onPreviewLocalFile?: (doc: Document) => void;
}

const getFileIcon = (fileName: string, mimeType?: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    if (extension === 'pdf' || mimeType === 'application/pdf') {
        return <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 font-bold text-[10px] flex items-center justify-center w-9 h-9">PDF</div>;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension) || mimeType?.startsWith('image/')) {
        return <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400 flex items-center justify-center w-9 h-9"><ImageIcon className="w-5 h-5" /></div>;
    }
    if (['xls', 'xlsx', 'csv'].includes(extension) || mimeType?.includes('sheet') || mimeType?.includes('excel')) {
        return <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400 flex items-center justify-center w-9 h-9"><ChartBarIcon className="w-5 h-5" /></div>;
    }
    if (['doc', 'docx'].includes(extension) || mimeType?.includes('word')) {
        return <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 font-bold text-[10px] flex items-center justify-center w-9 h-9">DOC</div>;
    }

    return <div className="p-2 bg-slate-100 dark:bg-zinc-700 rounded-lg text-slate-500 dark:text-zinc-400 flex items-center justify-center w-9 h-9"><DocumentIcon className="w-5 h-5" /></div>;
};

export const LocalDocumentManager: React.FC<LocalDocumentManagerProps> = ({ onPreviewLocalFile }) => {
    const { currentUser } = useAuth();
    const { matterState } = useMatterState();
    const { documentState } = useDocumentState();
    const { coreState, isDataLoaded } = useCoreState();
    const { addToast } = useUI();

    // Firm Settings
    const firmFolderPath = coreState.firmDetails?.localFolderPath || null;
    const isAdmin = currentUser?.role === 'Admin';
    const updateFirmSettings = useMutation(api.myFunctions.updateFirmSettings);

    const {
        folderName,
        files,
        isLoading,
        error: fsError,
        selectFolder: baseSelectFolder,
        refreshFiles,
        getFileContent,
        isMatchingFirm
    } = useFirmLocalFileSystem(firmFolderPath);

    // Initialize cachedFiles from localStorage
    const [cachedFiles, setCachedFiles] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('local_cached_files');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

    // Preview state
    const [openingFileId, setOpeningFileId] = useState<string | null>(null);

    const { setLocalFiles } = useAloa();
    const { handleAddDocumentAndAnalyze } = useDataActions();

    // Matter selection state
    const [isMatterModalOpen, setIsMatterModalOpen] = useState(false);
    const [selectedFileForMatter, setSelectedFileForMatter] = useState<LocalFile | null>(null);
    const [matterSearchQuery, setMatterSearchQuery] = useState('');
    const [processingFileIds, setProcessingFileIds] = useState<Set<string>>(new Set());

    // Sort files to prevent jumping
    const sortedFiles = React.useMemo(() => {
        return [...files].sort((a, b) => a.name.localeCompare(b.name));
    }, [files]);

    const activeMatters = React.useMemo(() => {
        return matterState.matters
            .filter(m => m.status === 'Active')
            .filter(m => m.title.toLowerCase().includes(matterSearchQuery.toLowerCase()) ||
                (m.referenceNumber && m.referenceNumber.toLowerCase().includes(matterSearchQuery.toLowerCase())));
    }, [matterState.matters, matterSearchQuery]);

    // Update localStorage when cachedFiles changes
    useEffect(() => {
        localStorage.setItem('local_cached_files', JSON.stringify(Array.from(cachedFiles)));
    }, [cachedFiles]);

    // Sync files to ALOA context for AI awareness
    useEffect(() => {
        setLocalFiles(files);
        return () => setLocalFiles([]); // Cleanup on unmount
    }, [files, setLocalFiles]);

    // --- Actions ---

    const handleSelectFolder = async () => {
        await baseSelectFolder();
        // If Admin and no firm folder set OR Admin and mismatch, ask to update firm setting?
        // Actually, we can just update it implicitly if they mean to.
        // Let's rely on a separate specific "Set as Firm Standard" action to be safe, 
        // OR if it's the first time setting it.
    };

    // Effect to auto-update firm setting if Admin selects a folder and none was set
    useEffect(() => {
        if (isAdmin && folderName && !firmFolderPath && coreState.firmDetails?.id) {
            // Auto-set as standard if empty
            updateFirmSettings({
                firmId: coreState.firmDetails.id,
                settings: { localFolderPath: folderName }
            }).then(() => addToast(`Firm folder set to "${folderName}"`, { type: 'success' }));
        }
    }, [isAdmin, folderName, firmFolderPath, coreState.firmDetails]);

    const handleUpdateFirmFolder = async () => {
        if (!isAdmin || !coreState.firmDetails?.id || !folderName) return;
        await updateFirmSettings({
            firmId: coreState.firmDetails.id,
            settings: { localFolderPath: folderName }
        });
        addToast("Firm standard folder updated.", { type: 'success' });
    };

    const handleDisconnectFirmFolder = async () => {
        if (!isAdmin || !coreState.firmDetails?.id) return;

        if (confirm("Are you sure you want to disconnect the firm folder? This will require re-selecting a folder for all users.")) {
            await updateFirmSettings({
                firmId: coreState.firmDetails.id,
                settings: { localFolderPath: "" } // Clear it
            });
            addToast("Firm folder disconnected.", { type: 'success' });
        }
    };

    const handleCacheFile = async (file: LocalFile, e: React.MouseEvent) => {
        e.stopPropagation();
        if (cachedFiles.has(file.id)) {
            const next = new Set(cachedFiles);
            next.delete(file.id);
            setCachedFiles(next);
            addToast("Removed from temporary server cache.", { type: 'success' });
            return;
        }

        setUploadingFiles(prev => new Set(prev).add(file.id));
        try {
            const rawFile = await getFileContent(file);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Sim
            setCachedFiles(prev => new Set(prev).add(file.id));
            addToast("File cached on server temporarily.", { type: 'success' });
        } catch (err) {
            console.error(err);
            addToast("Failed to cache file.", { type: 'error' });
        } finally {
            setUploadingFiles(prev => {
                const next = new Set(prev);
                next.delete(file.id);
                return next;
            });
        }
    };

    const handlePreviewFile = async (file: LocalFile) => {
        setOpeningFileId(file.id);
        try {
            const rawFile = await getFileContent(file);
            if (!rawFile) throw new Error("Could not read file");
            const blobUrl = URL.createObjectURL(rawFile);
            const mockDoc: Document = {
                id: file.id,
                firmId: 'local',
                title: file.name,
                categoryId: 'local',
                dateFiled: new Date(file.lastModified || Date.now()).toISOString(),
                assignedUsers: [currentUser?.id || ''],
                file: {
                    name: rawFile.name,
                    type: rawFile.type,
                    size: rawFile.size,
                    filePath: file.id,
                    dataUrl: blobUrl
                },
                analysisState: undefined,
                summary: "Local file preview.",
                uploadedBy: currentUser?.id
            };
            if (onPreviewLocalFile) onPreviewLocalFile(mockDoc);
        } catch (err) {
            addToast("Failed to preview file.", { type: 'error' });
        } finally {
            setOpeningFileId(null);
        }
    };

    const handleCopyToMatter = async (matterId: string) => {
        if (!selectedFileForMatter) return;
        const file = selectedFileForMatter;
        setProcessingFileIds(prev => new Set(prev).add(file.id));
        setIsMatterModalOpen(false);
        setSelectedFileForMatter(null);

        try {
            const rawFile = await getFileContent(file);
            if (!rawFile) throw new Error("No content");
            const blobUrl = URL.createObjectURL(rawFile);
            const matter = matterState.matters.find(m => m.id === matterId);
            const newDoc: Document = {
                id: uuidv4(),
                firmId: currentUser?.firmId || 'local',
                title: file.name,
                matterId: matterId,
                matter: matter ? { id: matter.id, title: matter.title } : undefined,
                categoryId: 'uncategorized',
                dateFiled: new Date().toISOString(),
                assignedUsers: [currentUser?.id || ''],
                uploadedBy: currentUser?.id,
                file: {
                    name: rawFile.name,
                    type: rawFile.type,
                    size: rawFile.size,
                    filePath: `matters/${matterId}/${file.name}`,
                    dataUrl: blobUrl
                },
                analysisState: 'pending',
                content: "Pending analysis..."
            };
            await handleAddDocumentAndAnalyze(newDoc);
            addToast(`File copied to matter "${matter?.title}" successfully.`, { type: 'success' });
        } catch (err) {
            addToast("Failed to copy file to matter.", { type: 'error' });
        } finally {
            setProcessingFileIds(prev => {
                const next = new Set(prev);
                next.delete(file.id);
                return next;
            });
        }
    };

    // --- Render Logic for Connection State ---

    if (!folderName) {
        // No folder connected locally
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full bg-slate-50/50 dark:bg-zinc-900/50">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400">
                    {firmFolderPath ? <ShieldCheckIcon className="w-8 h-8" /> : <LargeFolderIcon className="w-8 h-8" />}
                </div>

                {firmFolderPath ? (
                    <>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Connect to Firm Folder</h3>
                        <p className="text-slate-500 dark:text-zinc-400 max-w-sm mb-4 text-sm leading-relaxed">
                            Your firm uses <strong>"{firmFolderPath}"</strong> for local storage.
                            Please select this folder to access shared files.
                        </p>
                    </>
                ) : (
                    <>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Connect Local Folder</h3>
                        <p className="text-slate-500 dark:text-zinc-400 max-w-sm mb-8 text-sm leading-relaxed">
                            {isAdmin ? "Select the folder that your firm uses for document storage." : "Please ask an Admin to configure the Firm Folder."}
                        </p>
                    </>
                )}

                <button
                    onClick={handleSelectFolder}
                    disabled={!isAdmin && !firmFolderPath}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <LargeFolderIcon className="w-5 h-5" />
                    {firmFolderPath ? `Select "${firmFolderPath}"` : "Select Secure Folder"}
                </button>

                {!firmFolderPath && !isAdmin && (
                    <p className="mt-4 text-sm text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 rounded-lg">
                        Waiting for Admin to set standard folder.
                    </p>
                )}
            </div>
        );
    }

    // Connected, but check mismatch
    const shouldWarnMismatch = firmFolderPath && folderName !== firmFolderPath;

    if (shouldWarnMismatch) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full bg-yellow-50/50 dark:bg-yellow-900/10">
                <ExclamationTriangleIcon className="w-16 h-16 text-yellow-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Folder Mismatch</h3>
                <p className="text-slate-600 dark:text-zinc-400 max-w-md mb-6">
                    You connected <strong>"{folderName}"</strong>, but the firm standard is <strong>"{firmFolderPath}"</strong>.
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={handleSelectFolder}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                    >
                        Switch to "{firmFolderPath}"
                    </button>
                    {isAdmin && (
                        <button
                            onClick={handleUpdateFirmFolder}
                            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50"
                        >
                            Update Firm Standard to "{folderName}"
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
            {/* Matter Selection Modal */}
            <Modal
                isOpen={isMatterModalOpen}
                onClose={() => {
                    setIsMatterModalOpen(false);
                    setSelectedFileForMatter(null);
                    setMatterSearchQuery('');
                }}
                title="Select Matter to Copy File"
            >
                <div>
                    <div className="mb-4">
                        <div className="relative">
                            <input autoComplete="off" data-lpignore="true" 
                                type="text"
                                placeholder="Search matters..."
                                value={matterSearchQuery}
                                onChange={(e) => setMatterSearchQuery(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {activeMatters.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 dark:text-zinc-400">
                                No matching active matters found.
                            </div>
                        ) : (
                            activeMatters.map(matter => (
                                <button
                                    key={matter.id}
                                    onClick={() => handleCopyToMatter(matter.id)}
                                    className="w-full text-left p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 border border-transparent hover:border-slate-200 dark:hover:border-zinc-700 transition-colors flex items-center justify-between group"
                                >
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white text-sm">{matter.title}</p>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                                            {matter.referenceNumber && <span className="mr-2">{matter.referenceNumber}</span>}
                                        </p>
                                    </div>
                                    <ArrowPathIcon className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 -rotate-90" />
                                </button>
                            ))
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-700 flex justify-end">
                        <button
                            onClick={() => setIsMatterModalOpen(false)}
                            className="px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>

            <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                        {isAdmin ? <ShieldCheckIcon className="w-5 h-5" /> : <ComputerDesktopIcon className="w-5 h-5" />}
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {folderName}
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-xs font-normal text-slate-500 border border-slate-200 dark:border-zinc-700">
                                {firmFolderPath === folderName ? 'Firm Standard' : 'Local'}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                            {files.length} files • {isLoading ? 'Scanning...' : 'Ready'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => refreshFiles()}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                        title="Rescan Folder"
                    >
                        <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>

                    {isAdmin && (
                        <>
                            <button
                                onClick={handleDisconnectFirmFolder}
                                className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Disconnect Firm Folder"
                            >
                                Disconnect
                            </button>
                            <button
                                onClick={handleSelectFolder}
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 transition-colors"
                            >
                                Change Folder
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-grow overflow-y-auto p-2">
                {isLoading && files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <ArrowPathIcon className="w-6 h-6 text-slate-300 animate-spin mb-2" />
                        <p className="text-xs text-slate-400">Scanning local files...</p>
                    </div>
                ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <DocumentIcon className="w-12 h-12 mb-2 opacity-20" />
                        <p className="text-sm">Folder is empty</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {sortedFiles.map(file => {
                            const isCached = cachedFiles.has(file.id);
                            const isUploading = uploadingFiles.has(file.id);
                            const isOpening = openingFileId === file.id;

                            return (
                                <div
                                    key={file.id}
                                    onClick={() => handlePreviewFile(file)}
                                    className="group flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50 border border-transparent hover:border-slate-100 dark:hover:border-zinc-800 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="relative">
                                            {getFileIcon(file.name)}
                                            {isCached && (
                                                <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border-2 border-white dark:border-zinc-900" title="Cached on Server">
                                                    <CloudIcon className="w-2.5 h-2.5" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-sm font-medium truncate transition-colors ${isOpening ? 'text-primary-600 animate-pulse' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {file.name}
                                                {isOpening && " (Opening...)"}
                                            </p>
                                            <p className="text-xs text-slate-400 flex items-center gap-2">
                                                {formatBytes(file.size || 0)}
                                                {file.lastModified && <span>• {new Date(file.lastModified).toLocaleDateString('en-GB')}</span>}
                                            </p>
                                        </div>
                                    </div>


                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {documentState.documents.some(d => d.title === file.name && d.matterId) && (
                                            <Tooltip text="Already in Matter">
                                                <div className="p-1.5 rounded-lg bg-green-50 text-green-600 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900 cursor-help">
                                                    <span className="text-[10px] font-bold px-1">SAVED</span>
                                                </div>
                                            </Tooltip>
                                        )}

                                        <Tooltip text="Copy to Matter">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedFileForMatter(file);
                                                    setIsMatterModalOpen(true);
                                                }}
                                                disabled={processingFileIds.has(file.id)}
                                                className="p-1.5 rounded-lg bg-white text-slate-400 border border-slate-200 hover:text-blue-600 hover:border-blue-200 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:text-blue-400 transition-colors"
                                            >
                                                {processingFileIds.has(file.id) ? (
                                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <LargeFolderIcon className="w-4 h-4" />
                                                )}
                                            </button>
                                        </Tooltip>

                                        <Tooltip text={isCached ? "Remove from Cache" : "Cache to Server"}>

                                            <button
                                                onClick={(e) => handleCacheFile(file, e)}
                                                disabled={isUploading}
                                                className={`p-1.5 rounded-lg transition-colors border ${isCached
                                                    ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900'
                                                    : 'bg-white text-slate-400 border-slate-200 hover:text-blue-600 hover:border-blue-200 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:text-blue-400'
                                                    }`}
                                            >
                                                {isUploading ? (
                                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <CloudIcon className="w-4 h-4" />
                                                )}
                                            </button>
                                        </Tooltip>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div >
    );
};

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Document, Matter, Contact, DocumentCategory, User, UserRole, ModalType } from '../types';
import { DocumentIcon, PlusIcon, SearchIcon, LargeFolderIcon, EditIcon, TrashIcon, DownloadIcon, EyeIcon, ShareIcon, UserUploadIcon, ChevronDownIcon, UploadIcon, ChartBarIcon, ImageIcon, SparklesIcon, ComputerDesktopIcon, UserCircleIcon, OfficeBuildingIcon, ArrowsExpandIcon } from '../constants';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { useMatterState } from '../contexts/MatterContext';
import EmptyState from './EmptyState';
import { formatBytes } from '../utils/formatting';
import Tooltip from './Tooltip';
import { LocalDocumentManager } from './LocalDocumentManager';
import { useProduct, useTerminology } from '../contexts/ProductContext';
import DocumentPreviewModal from './documents/DocumentPreviewModal';

interface DocumentListProps {
    documents: Document[];
    matters: Matter[];
    contacts: Contact[];
    documentCategories: DocumentCategory[];
    folderPermissions: Record<string, UserRole[]>;
    currentUser: User;
    openModal: (modalType: ModalType, id?: string | null, context?: any) => void;
    onViewDetails: (id: string) => void;
    isCompact?: boolean;
    onPreviewLocalFile?: (doc: Document) => void;
}

const getFileIcon = (fileName: string, mimeType?: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    if (extension === 'pdf' || mimeType === 'application/pdf') {
        return <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 font-bold text-2xs flex items-center justify-center w-9 h-9">PDF</div>;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension) || mimeType?.startsWith('image/')) {
        return <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400 flex items-center justify-center w-9 h-9"><ImageIcon className="w-5 h-5" /></div>;
    }
    if (['xls', 'xlsx', 'csv'].includes(extension) || mimeType?.includes('sheet') || mimeType?.includes('excel')) {
        return <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400 flex items-center justify-center w-9 h-9"><ChartBarIcon className="w-5 h-5" /></div>;
    }
    if (['doc', 'docx'].includes(extension) || mimeType?.includes('word')) {
        return <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 font-bold text-2xs flex items-center justify-center w-9 h-9">DOC</div>;
    }

    return <div className="p-2 bg-slate-100 dark:bg-zinc-700 rounded-lg text-slate-500 dark:text-zinc-400 flex items-center justify-center w-9 h-9"><DocumentIcon className="w-5 h-5" /></div>;
};

const DocumentRow: React.FC<{
    doc: Document;
    onViewDetails: (id: string) => void;
    onDownload: (doc: Document) => void;
    onEdit: (doc: Document) => void;
    onShare: (doc: Document) => void;
    onDelete: (doc: Document) => void;
    onQuickFullScreenPreview?: (doc: Document) => void;
    users: User[];
    selected?: boolean;
    selectionMode?: boolean;
    onToggleSelect?: (id: string) => void;
}> = ({ doc, onViewDetails, onDownload, onEdit, onShare, onDelete, onQuickFullScreenPreview, users, selected, selectionMode, onToggleSelect }) => {
    const uploader = doc.uploadedBy ? users.find(u => u.id === doc.uploadedBy) : null;
    const uploadedByClient = uploader?.role === UserRole.Client;
    const fileName = doc.file?.name || doc.title;
    const fileType = doc.file?.type;
    const [showBottomSheet, setShowBottomSheet] = useState(false);

    return (
        <>
            <div
                onClick={() => {
                    if (selectionMode && onToggleSelect) {
                        onToggleSelect(doc.id);
                    } else {
                        onViewDetails(doc.id);
                    }
                }}
                className={`flex items-start gap-2 p-3.5 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer group transition-all border min-h-[48px] ${selected ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700' : 'border-transparent hover:border-slate-200 dark:hover:border-zinc-700'}`}
            >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Checkbox — visible in selection mode */}
                    {selectionMode && (
                        <div className="flex-shrink-0 mt-0.5">
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selected ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}>
                                {selected && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="relative flex-shrink-0 mt-0.5">
                        {getFileIcon(fileName, fileType)}
                        {uploadedByClient && (
                            <div className="absolute -top-1 -right-1 bg-white dark:bg-zinc-800 rounded-full p-0.5 shadow-sm">
                                <UserUploadIcon className="w-3 h-3 text-primary-500" />
                            </div>
                        )}
                        {doc.analysisState === 'complete' && (
                            <div className="absolute -bottom-1 -right-1 bg-purple-600 rounded-full p-1 shadow-sm animate-pulse border-2 border-white dark:border-zinc-900" title="Analysis Complete">
                                <SparklesIcon className="w-2.5 h-2.5 text-white" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <Tooltip text={doc.title}>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{doc.title}</p>
                        </Tooltip>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                            <span>{new Date(doc.dateFiled).toLocaleDateString('en-GB')}</span>
                            {doc.file && <span>• {formatBytes(doc.file.size)}</span>}
                            {doc.isCourtProcess && (
                                <span className={`px-1.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-tight border ${doc.litigationStatus === 'acknowledged' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30' :
                                    doc.litigationStatus === 'served' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30' :
                                        doc.litigationStatus === 'filed' ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30' :
                                            'bg-slate-50 text-slate-700 border-slate-200 dark:bg-zinc-800'
                                    }`}>
                                    {doc.litigationStatus === 'acknowledged' ? 'Confirmed' :
                                        doc.litigationStatus === 'served' ? 'Served' :
                                            doc.litigationStatus === 'filed' ? 'Filed' : 'Drafting'}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Quick full-screen preview — icon-only, always visible, sits LEFT of the kebab menu */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onQuickFullScreenPreview) onQuickFullScreenPreview(doc);
                    }}
                    className="flex items-center justify-center w-7 h-7 my-auto rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
                    aria-label="Open in immersive reader"
                    title="Open in immersive reader mode"
                >
                    <EyeIcon className="w-4 h-4" />
                </button>

                {/* Kebab menu — shown on ALL screen sizes (not just mobile) */}
                <button
                    onClick={(e) => { e.stopPropagation(); setShowBottomSheet(true); }}
                    className="flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
                    aria-label="More options"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6h.01M12 12h.01M12 18h.01" />
                    </svg>
                </button>
            </div>

            {/* Bottom Sheet — shown on ALL screen sizes */}
            {showBottomSheet && (
                <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center animate-in fade-in duration-200">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowBottomSheet(false)}
                    />
                    <div className="relative z-10 w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200 dark:border-zinc-700 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600" />
                        </div>

                        {/* File info header */}
                        <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{doc.title}</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                {new Date(doc.dateFiled).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                {doc.file && <span> • {formatBytes(doc.file.size)}</span>}
                            </p>
                        </div>

                        {/* Action items */}
                        <div className="py-2">
                            <button
                                onClick={() => { setShowBottomSheet(false); if (onQuickFullScreenPreview) onQuickFullScreenPreview(doc); }}
                                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                    <ArrowsExpandIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="text-left">
                                    <span className="block text-sm font-semibold text-slate-700 dark:text-zinc-200">Full Screen Preview</span>
                                    <span className="block text-3xs text-slate-400">Opens document in immersive reader mode</span>
                                </div>
                            </button>

                            <button
                                onClick={() => { setShowBottomSheet(false); onViewDetails(doc.id); }}
                                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                    <EyeIcon className="w-5 h-5 text-slate-600 dark:text-zinc-300" />
                                </div>
                                <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Preview Document</span>
                            </button>

                            <button
                                onClick={() => { setShowBottomSheet(false); onEdit(doc); }}
                                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                                    <EditIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                </div>
                                <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Edit in DraftPro</span>
                            </button>

                            {doc.file && (
                                <button
                                    onClick={() => { setShowBottomSheet(false); onDownload(doc); }}
                                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                        <DownloadIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Download File</span>
                                </button>
                            )}

                            <button
                                onClick={() => { setShowBottomSheet(false); onShare(doc); }}
                                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                    <ShareIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Share Link</span>
                            </button>

                            <button
                                onClick={() => { setShowBottomSheet(false); onDelete(doc); }}
                                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                    <TrashIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                                <span className="text-sm font-semibold text-red-600 dark:text-red-400">Delete Document</span>
                            </button>
                        </div>

                        {/* Cancel button */}
                        <div className="p-3 border-t border-slate-100 dark:border-zinc-800">
                            <button
                                onClick={() => setShowBottomSheet(false)}
                                className="w-full py-3 text-sm font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const MatterGroup: React.FC<{
    matterTitle: string,
    matterId?: string,
    documents: Document[],
    onViewDetails: any,
    onDownload: any,
    onEdit: any,
    onShare: any,
    onDelete: any,
    onQuickFullScreenPreview?: (doc: Document) => void,
    onUpload: (matterId: string) => void,
    selectedIds?: Set<string>,
    selectionMode?: boolean,
    onToggleSelect?: (id: string) => void,
}> = ({ matterTitle, matterId, documents, onViewDetails, onDownload, onEdit, onShare, onDelete, onQuickFullScreenPreview, onUpload, selectedIds, selectionMode, onToggleSelect }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="mb-3">
            <div className="flex items-center justify-between w-full p-3 rounded-lg border bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-colors group">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 flex-grow text-left"
                >
                    <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                    <span className="font-bold text-sm text-slate-700 dark:text-zinc-200 truncate">{matterTitle}</span>
                    <span className="text-2xs text-slate-400 bg-slate-100 dark:bg-zinc-700 px-2 py-0.5 rounded-full font-bold">
                        {documents.length}
                    </span>
                </button>

                {matterId && (
                    <Tooltip text="Upload to this Matter">
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpload(matterId); }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <PlusIcon className="w-4 h-4" />
                        </button>
                    </Tooltip>
                )}
            </div>

            {isOpen && (
                <div className="mt-1 space-y-1 pl-1 animate-fade-in">
                    {documents.map(doc => (
                        <DocumentRow
                            key={doc.id}
                            doc={doc}
                            users={[]}
                            onViewDetails={onViewDetails}
                            onDownload={onDownload}
                            onEdit={onEdit}
                            onShare={onShare}
                            onDelete={onDelete}
                            onQuickFullScreenPreview={onQuickFullScreenPreview}
                            selected={selectedIds?.has(doc.id)}
                            selectionMode={selectionMode}
                            onToggleSelect={onToggleSelect}
                        />
                    ))} 
                </div>
            )}
        </div>
    );
};

export const DocumentList: React.FC<{ isCompact?: boolean; onPreviewLocalFile?: (doc: Document) => void }> = ({ isCompact, onPreviewLocalFile }) => {
    const { documentState } = useDocumentState();
    const { matterState } = useMatterState();
    const { coreState } = useCoreState();
    const { currentUser } = useAuth();
    const { openModal, navigateTo, addToast, closeModal, openEditor } = useUI();
    const { product } = useProduct();
    const terminology = useTerminology();
    const { deleteItem } = useDataActions();

    const documents = documentState.documents;
    const matters = matterState.matters;
    const documentCategories = coreState.documentCategories;
    const navigate = useNavigate();
    const onViewDetails = (id: string) => navigate(`/documents/${id}`);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'documents' | 'local'>('documents');
    const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'my'>(
        currentUser?.role === UserRole.Admin ? 'all' : 'my'
    );

    // ─── Quick full-screen preview ───────────────────────────────────
    // Renders the document in the immersive DocumentPreviewModal without
    // requiring a full route navigation. Falls back to the detail view if
    // the document has neither inline content nor an attached file.
    const [quickPreviewDoc, setQuickPreviewDoc] = useState<Document | null>(null);
    const onQuickFullScreenPreview = useCallback((doc: Document) => {
        if (!doc?.content && !doc?.file) {
            onViewDetails(doc.id);
            return;
        }
        setQuickPreviewDoc(doc);
    }, []);

    // ─── Multi-select state ─────────────────────────────────────────
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(filteredDocuments.map(d => d.id)));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
        setSelectionMode(false);
    };

    const handleBatchDelete = () => {
        openModal('deleteConfirmation', null, {
            title: `Delete ${selectedIds.size} document${selectedIds.size !== 1 ? 's' : ''}?`,
            message: `Are you sure you want to delete ${selectedIds.size} document${selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.`,
            onConfirm: async () => {
                for (const id of selectedIds) {
                    try { await deleteItem('documents', id, ''); } catch {}
                }
                addToast(`${selectedIds.size} document${selectedIds.size !== 1 ? 's' : ''} deleted.`, { type: 'success' });
                clearSelection();
                closeModal();
            },
        });
    };

    const filteredDocuments = useMemo(() => {
        let docs = documents;
        if (selectedCategory) {
            docs = docs.filter(d => d.categoryId === selectedCategory);
        }
        if (assignmentFilter === 'my') {
            docs = docs.filter(d => {
                const isUploadedByMe = d.uploadedBy === currentUser?.id;
                const isAssignedToMe = d.assignedUsers?.includes(currentUser?.id || '');
                const isMatterAssignedToMe = (d.matterId || d.matter?.id) && matters.find(m => m.id === (d.matterId || d.matter?.id))?.assignedUsers?.includes(currentUser?.id || '');
                return isUploadedByMe || isAssignedToMe || isMatterAssignedToMe;
            });
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            docs = docs.filter(d => d.title.toLowerCase().includes(lower));
        }
        return docs.sort((a, b) => new Date(b.dateFiled).getTime() - new Date(a.dateFiled).getTime());
    }, [documents, selectedCategory, searchTerm, assignmentFilter, currentUser?.id, matters]);

    const groupedDocuments = useMemo(() => {
        if (selectedCategory) return null; // Or if viewMode === 'local'

        const groups: Record<string, { docs: Document[], id?: string }> = {};
        const unassigned: Document[] = [];

        filteredDocuments.forEach(doc => {
            if (doc.matterId || (doc.matter && doc.matter.id)) {
                const mId = doc.matterId || doc.matter?.id;
                const matterObj = matters.find(m => m.id === mId);
                const matterName = matterObj?.title || `Unknown ${terminology.matter}`;

                if (!groups[matterName]) groups[matterName] = { docs: [], id: mId };
                groups[matterName].docs.push(doc);
            } else {
                unassigned.push(doc);
            }
        });

        return { groups, unassigned };
    }, [filteredDocuments, selectedCategory, matters]);

    const handleDownload = async (doc: Document) => {
        if (!doc.file) return;

        // If the file has a storageId, download from Convex storage
        if (doc.file.storageId) {
            try {
                const { downloadFromConvex } = await import('../utils/convexUpload');
                await downloadFromConvex(doc.file.storageId, doc.file.name);
                return;
            } catch (err) {
                console.error('Download from Convex failed:', err);
                // Fall through to dataUrl if available
            }
        }

        // Fall back to dataUrl (base64 — used by older documents)
        if (doc.file.dataUrl) {
            const link = document.createElement('a');
            link.href = doc.file.dataUrl;
            link.download = doc.file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // Part 3: Edit in DraftPro — DOCX files open in DraftPro editor,
    // other files open the edit metadata modal
    const handleEditDoc = (doc: Document) => {
        const isDocx = doc.file?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                       doc.file?.name?.toLowerCase().endsWith('.docx');
        if (isDocx && doc.file?.storageId) {
            // Open DraftPro in a new tab with the DOCX file ID
            const draftKey = `draft:docx:${doc.id}`;
            const url = `/editor?draftKey=${encodeURIComponent(draftKey)}&title=${encodeURIComponent(doc.title)}&fileId=${encodeURIComponent(doc.file.storageId)}&type=docx`;
            if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                window.open(url, '_blank', 'noopener');
            } else {
                navigateTo('editor', null, {
                    draftTitle: doc.title,
                    draftContent: doc.content || '',
                    disableAutoDraft: true,
                    openedByAloa: false,
                });
            }
        } else {
            // Non-DOCX files: open the edit metadata modal (existing behavior)
            openModal('editDocument', doc.id);
        }
    };

    const handleDelete = (doc: Document) => {
        openModal('deleteConfirmation', doc.id, {
            title: `Delete Document "${doc.title}"?`,
            message: "Are you sure you want to delete this document? This action cannot be undone.",
            onConfirm: async () => {
                try {
                    await deleteItem('documents', doc.id, doc.title);
                    // Only show ONE toast — deleteItem already shows a toast
                    // on error ("Document removed."), so we only show a toast
                    // on success here. No duplicate error toast.
                    addToast("Document deleted successfully.", { type: 'success' });
                } catch (err: any) {
                    // deleteItem already handled the error and showed a toast.
                    // Don't show a duplicate — just log for debugging.
                    console.error('Delete document error:', err);
                } finally {
                    closeModal();
                }
            },
            confirmText: "Delete Permanently",
            confirmButtonClass: "bg-red-600 hover:bg-red-700"
        });
    };

    const handleUploadFiles = () => {
        openModal('batchUpload', null);
    };

    const renderCategory = (cat: DocumentCategory, level = 0, visited = new Set<string>()) => {
        if (visited.has(cat.id) || level > 8) return null; // Guard against circular refs
        visited.add(cat.id);
        const isActive = selectedCategory === cat.id && viewMode === 'documents';
        const subCats = documentCategories.filter(c => c.parentId === cat.id);

        return (
            <div key={cat.id}>
                <button
                    onClick={() => { setSelectedCategory(isActive ? null : cat.id); setViewMode('documents'); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                    style={{ paddingLeft: `${level * 12 + 8}px` }}
                >
                    <LargeFolderIcon className={`w-4 h-4 ${isActive ? 'text-primary-500' : 'text-slate-400'}`} />
                    <span className="truncate flex-grow text-left">{cat.name}</span>
                </button>
                {subCats.map(sub => renderCategory(sub, level + 1, new Set(visited)))}
            </div>
        );
    };

    const rootCategories = useMemo(() => {
        return documentCategories.filter(c => 
            !c.parentId && (!c.product || c.product === product || product === 'unified')
        );
    }, [documentCategories, product]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const matterId = e.target.getAttribute('data-matter-id');
        openModal('batchUpload', null, {
            files: Array.from(files),
            matterId: matterId
        });

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const triggerUpload = (mId: string) => {
        if (fileInputRef.current) {
            fileInputRef.current.setAttribute('data-matter-id', mId);
            fileInputRef.current.click();
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800">
            <input autoComplete="off" data-lpignore="true" 
                type="file"
                ref={fileInputRef}
                onChange={handleFilesSelected}
                className="hidden"
                multiple
                accept=".pdf,.docx,.doc,.txt"
            />

            <div className="sticky top-0 pt-safe z-30 flex-shrink-0 py-2.5 px-4 glass border-b border-slate-100 dark:border-zinc-800 shadow-sm space-y-3">
                {/* Title row — title on left, buttons on right, with flex-wrap to prevent cutoff */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Documents</h2>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Cloud/Local toggle — icon only */}
                        <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5">
                            <button
                                onClick={() => { setViewMode('documents'); setSelectedCategory(null); }}
                                title="Cloud Documents"
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'documents' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <DocumentIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('local')}
                                title="Local Storage"
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'local' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <ComputerDesktopIcon className="w-4 h-4" />
                            </button>
                        </div>
                        {/* DraftPro — icon only on small screens, full label on larger screens */}
                        {/* DraftPro — opens in new tab on desktop, same tab on mobile */}
                        <button
                            onClick={() => {
                                if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                                    // Desktop: open in new tab
                                    window.open('/editor?draftKey=new&title=New%20Document', 'draftpro-new');
                                } else {
                                    // Mobile: navigate in-place
                                    openEditor();
                                }
                            }}
                            title="Open DraftPro Editor"
                            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-opacity shadow-sm flex items-center gap-1.5 text-xs font-bold shrink-0"
                        >
                            <SparklesIcon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">DraftPro</span> <span className="opacity-60 font-normal text-3xs hidden sm:inline">β</span>
                        </button>
                        {/* Upload — icon only on small screens, full label on larger screens */}
                        <button
                            onClick={() => openModal('newDocument')}
                            className="p-2 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-sm flex items-center gap-1.5 text-xs font-bold shrink-0"
                        >
                            <PlusIcon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Upload</span>
                        </button>
                    </div>
                </div>

                {/* Search row + selection toolbar — only when in documents mode */}
                {viewMode === 'documents' && (
                    <div className="space-y-2">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                            <input autoComplete="off" data-lpignore="true"
                                type="text"
                                placeholder="Search documents..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                            />
                        </div>
                        {/* Selection toolbar */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {!selectionMode ? (
                                <button
                                    onClick={() => setSelectionMode(true)}
                                    className="text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Select
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 w-full">
                                    <button
                                        onClick={clearSelection}
                                        className="p-1 rounded hover:bg-white/20 text-primary-600 dark:text-primary-400 transition-colors"
                                        title="Exit selection"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                    <button
                                        onClick={selectAll}
                                        className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                                    >
                                        Select All ({filteredDocuments.length})
                                    </button>
                                    <span className="text-xs text-slate-400">
                                        {selectedIds.size} selected
                                    </span>
                                    {selectedIds.size > 0 && (
                                        <button
                                            onClick={handleBatchDelete}
                                            className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                            Delete ({selectedIds.size})
                                        </button>
                                    )}
                                    <button
                                        onClick={clearSelection}
                                        className="text-xs font-bold text-slate-500 dark:text-zinc-400 hover:underline ml-auto"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-grow overflow-hidden">
                {!isCompact && (
                    <div className="hidden md:block w-56 flex-shrink-0 border-r border-slate-200 dark:border-zinc-800 overflow-y-auto p-3 bg-slate-50/50 dark:bg-zinc-900/50">
                        <h4 className="px-2 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Folders</h4>
                        <div className="space-y-0.5">
                            <button
                                onClick={() => { setSelectedCategory(null); setViewMode('documents'); }}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${selectedCategory === null && viewMode === 'documents' ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                            >
                                <LargeFolderIcon className={`w-4 h-4 ${selectedCategory === null && viewMode === 'documents' ? 'text-primary-500' : 'text-slate-400'}`} />
                                <span className="truncate flex-grow text-left">All Documents</span>
                            </button>
                            {rootCategories.map(cat => (
                                <React.Fragment key={cat.id}>
                                    {renderCategory(cat)}
                                </React.Fragment>
                            ))}

                            <div className="my-2 border-t border-slate-100 dark:border-zinc-800 mx-2" />

                            <h4 className="px-2 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 mt-2">Filter</h4>
                            <div className="space-y-0.5">
                                <button
                                    onClick={() => setAssignmentFilter('all')}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${assignmentFilter === 'all' ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                                >
                                    <OfficeBuildingIcon className={`w-4 h-4 ${assignmentFilter === 'all' ? 'text-primary-500' : 'text-slate-400'}`} />
                                    <span className="truncate flex-grow text-left">Firm-wide Files</span>
                                </button>
                                <button
                                    onClick={() => setAssignmentFilter('my')}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${assignmentFilter === 'my' ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                                >
                                    <UserCircleIcon className={`w-4 h-4 ${assignmentFilter === 'my' ? 'text-primary-500' : 'text-slate-400'}`} />
                                    <span className="truncate flex-grow text-left">My Files</span>
                                </button>
                            </div>

                            <div className="my-2 border-t border-slate-100 dark:border-zinc-800 mx-2" />

                            <button
                                onClick={() => setViewMode('local')}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'local' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                            >
                                <ComputerDesktopIcon className={`w-4 h-4 ${viewMode === 'local' ? 'text-blue-500' : 'text-slate-400'}`} />
                                <span className="truncate flex-grow text-left">Secure Local Storage</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-grow overflow-y-auto custom-scrollbar p-0">
                    {viewMode === 'local' ? (
                        <LocalDocumentManager onPreviewLocalFile={onPreviewLocalFile} />
                    ) : (
                        <div className="p-3 sm:p-4">
                            {filteredDocuments.length > 0 ? (
                                <div className="space-y-2 pb-20">
                                    {groupedDocuments ? (
                                        <>
                                            {Object.keys(groupedDocuments.groups).sort().map(matterName => (
                                                <MatterGroup
                                                    key={matterName}
                                                    matterTitle={matterName}
                                                    matterId={groupedDocuments.groups[matterName].id}
                                                    documents={groupedDocuments.groups[matterName].docs}
                                                    onViewDetails={onViewDetails}
                                                    onDownload={handleDownload}
                                                    onEdit={handleEditDoc}
                                                    onShare={(d: any) => openModal('shareDocument', d.id)}
                                                    onDelete={handleDelete}
                                                    onQuickFullScreenPreview={onQuickFullScreenPreview}
                                                    onUpload={triggerUpload}
                                                    selectedIds={selectedIds}
                                                    selectionMode={selectionMode}
                                                    onToggleSelect={toggleSelect}
                                                />
                                            ))}

                                            {groupedDocuments.unassigned.length > 0 && (
                                                <div className="mt-4">
                                                    <h4 className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2 px-1">Unassigned {terminology.matters}</h4>
                                                    <div className="space-y-1">
                                                        {groupedDocuments.unassigned.map(doc => (
                                                            <DocumentRow
                                                                key={doc.id}
                                                                doc={doc}
                                                                users={[]}
                                                                onViewDetails={onViewDetails}
                                                                onDownload={handleDownload}
                                                                onEdit={handleEditDoc}
                                                                onShare={(d) => openModal('shareDocument', d.id)}
                                                                onDelete={handleDelete}
                                                                onQuickFullScreenPreview={onQuickFullScreenPreview}
                                                                selected={selectedIds.has(doc.id)}
                                                                selectionMode={selectionMode}
                                                                onToggleSelect={toggleSelect}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="space-y-1">
                                            {filteredDocuments.map(doc => (
                                                <DocumentRow
                                                    key={doc.id}
                                                    doc={doc}
                                                    users={[]}
                                                    onViewDetails={onViewDetails}
                                                    onDownload={handleDownload}
                                                    onEdit={handleEditDoc}
                                                    onShare={(d) => openModal('shareDocument', d.id)}
                                                    onDelete={handleDelete}
                                                    onQuickFullScreenPreview={onQuickFullScreenPreview}
                                                    selected={selectedIds.has(doc.id)}
                                                    selectionMode={selectionMode}
                                                    onToggleSelect={toggleSelect}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <EmptyState
                                    title="No Documents Yet"
                                    description={searchTerm ? "No matches found for your search." : (selectedCategory ? "This folder is empty. Upload a document to get started." : "Upload your first document to get started. You can organize files by matter, category, or keep them firm-wide.")}
                                    icon={<DocumentIcon />}
                                    actionLabel={searchTerm ? undefined : "Upload Document"}
                                    onAction={searchTerm ? undefined : () => openModal('newDocument')}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Quick full-screen preview modal ─── */}
            {quickPreviewDoc && (
                <DocumentPreviewModal
                    html={quickPreviewDoc.content}
                    fileUrl={quickPreviewDoc.file?.dataUrl || undefined}
                    title={quickPreviewDoc.title || 'Untitled Document'}
                    onClose={() => setQuickPreviewDoc(null)}
                />
            )}
        </div>
    );
};

import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Document, Matter, Contact, DocumentCategory, User, UserRole, ModalType } from '../types';
import { DocumentIcon, PlusIcon, SearchIcon, LargeFolderIcon, EditIcon, TrashIcon, DownloadIcon, EyeIcon, ShareIcon, UserUploadIcon, ChevronDownIcon, UploadIcon, ChartBarIcon, ImageIcon, SparklesIcon, ComputerDesktopIcon, UserCircleIcon, OfficeBuildingIcon } from '../constants';
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

const DocumentRow: React.FC<{
    doc: Document;
    onViewDetails: (id: string) => void;
    onDownload: (doc: Document) => void;
    onEdit: (doc: Document) => void;
    onShare: (doc: Document) => void;
    onDelete: (doc: Document) => void;
    users: User[];
}> = ({ doc, onViewDetails, onDownload, onEdit, onShare, onDelete, users }) => {
    const uploader = doc.uploadedBy ? users.find(u => u.id === doc.uploadedBy) : null;
    const uploadedByClient = uploader?.role === UserRole.Client;
    const fileName = doc.file?.name || doc.title;
    const fileType = doc.file?.type;

    return (
        <div
            onClick={() => onViewDetails(doc.id)}
            className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800 cursor-pointer group transition-colors ml-4"
        >
            <div className="flex items-center gap-3 min-w-0 flex-grow pr-4">
                <div className="relative flex-shrink-0">
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
                <div className="min-w-0 flex-grow">
                    <Tooltip text={doc.title}>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{doc.title}</p>
                    </Tooltip>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                        <span>{new Date(doc.dateFiled).toLocaleDateString('en-GB')}</span>
                        {doc.file && <span>• {formatBytes(doc.file.size)}</span>}
                        {doc.isCourtProcess && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border ${doc.litigationStatus === 'acknowledged' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30' :
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

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 bg-white dark:bg-zinc-900 shadow-sm rounded-lg p-1 border border-slate-100 dark:border-zinc-800 -ml-24 z-10">
                <Tooltip text="View">
                    <button onClick={(e) => { e.stopPropagation(); onViewDetails(doc.id); }} className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                        <EyeIcon className="w-4 h-4" />
                    </button>
                </Tooltip>
                {doc.file && (
                    <Tooltip text="Download">
                        <button onClick={(e) => { e.stopPropagation(); onDownload(doc); }} className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded text-slate-400 hover:text-green-600">
                            <DownloadIcon className="w-4 h-4" />
                        </button>
                    </Tooltip>
                )}
                <Tooltip text="Share">
                    <button onClick={(e) => { e.stopPropagation(); onShare(doc); }} className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded text-slate-400 hover:text-blue-500">
                        <ShareIcon className="w-4 h-4" />
                    </button>
                </Tooltip>
                <Tooltip text="Edit">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(doc); }} className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded text-slate-400 hover:text-primary-600">
                        <EditIcon className="w-4 h-4" />
                    </button>
                </Tooltip>
                <Tooltip text="Delete">
                    <button onClick={(e) => { e.stopPropagation(); onDelete(doc); }} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-slate-400 hover:text-red-600">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </Tooltip>
            </div>
        </div>
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
    onUpload: (matterId: string) => void
}> = ({ matterTitle, matterId, documents, onViewDetails, onDownload, onEdit, onShare, onDelete, onUpload }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between w-full p-2 bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors group mb-1">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 flex-grow text-left"
                >
                    <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                    <span className="font-bold text-sm text-slate-700 dark:text-zinc-200 truncate">{matterTitle}</span>
                    <span className="text-xs text-slate-400 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700">
                        {documents.length}
                    </span>
                </button>

                {matterId && (
                    <Tooltip text="Upload to this Matter">
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpload(matterId); }}
                            className="p-1.5 bg-white dark:bg-zinc-700 rounded-md border border-slate-200 dark:border-zinc-600 text-slate-400 hover:text-primary-600 hover:border-primary-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <PlusIcon className="w-4 h-4" />
                        </button>
                    </Tooltip>
                )}
            </div>

            {isOpen && (
                <div className="border-l-2 border-slate-200 dark:border-zinc-700 ml-3 pl-1 animate-fade-in">
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

    const handleDownload = (doc: Document) => {
        if (!doc.file?.dataUrl) return;
        const link = document.createElement('a');
        link.href = doc.file.dataUrl;
        link.download = doc.file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = (doc: Document) => {
        openModal('deleteConfirmation', doc.id, {
            title: `Delete Document "${doc.title}"?`,
            message: "Are you sure you want to delete this document? This action cannot be undone.",
            onConfirm: async () => {
                await deleteItem('documents', doc.id, doc.title);
                addToast("Document deleted successfully.", { type: 'success' });
                closeModal();
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

            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <DocumentIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Documents</h2>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Manage firm documents and files</p>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={() => openEditor()}
                            className="h-8 px-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all shadow-sm flex items-center gap-1.5 text-[10px] font-bold whitespace-nowrap shrink-0"
                            title="Open DraftPro Editor"
                        >
                            <SparklesIcon className="w-3 h-3" /> DraftPro <span className="opacity-60 font-normal text-[9px]">β</span>
                        </button>
                        <button
                            onClick={() => openModal('newDocument')}
                            className="p-2 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-sm flex items-center gap-2 text-xs font-bold"
                        >
                            <PlusIcon className="w-4 h-4" /> Upload
                        </button>
                    </div>
                </div>

                <div className={`w-full mb-4 ${!isCompact ? 'md:hidden' : ''}`}>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                        <button
                            onClick={() => { setViewMode('documents'); setSelectedCategory(null); }}
                            className={`py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'documents' ? 'bg-white dark:bg-zinc-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'}`}
                        >
                            Cloud Docs
                        </button>
                        <button
                            onClick={() => setViewMode('local')}
                            className={`py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${viewMode === 'local' ? 'bg-white dark:bg-zinc-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'}`}
                        >
                            <ComputerDesktopIcon className="w-3.5 h-3.5" /> Local
                        </button>
                    </div>
                </div>

                {viewMode === 'documents' && (
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100/50 dark:bg-zinc-800/50 rounded-xl mb-4 border border-slate-200 dark:border-zinc-700/50">
                        <button
                            onClick={() => setAssignmentFilter('all')}
                            className={`flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold rounded-lg transition-all ${assignmentFilter === 'all' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'}`}
                        >
                            <OfficeBuildingIcon className="w-3 h-3" />
                            Firm-wide
                        </button>
                        <button
                            onClick={() => setAssignmentFilter('my')}
                            className={`flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold rounded-lg transition-all ${assignmentFilter === 'my' ? 'bg-white dark:bg-zinc-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'}`}
                        >
                            <UserCircleIcon className="w-3 h-3" />
                            My Files
                        </button>
                    </div>
                )}

                {viewMode === 'documents' && (
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input autoComplete="off" data-lpignore="true" 
                            type="text"
                            placeholder="Search documents..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
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
                        <div className="p-2">
                            {filteredDocuments.length > 0 ? (
                                <div className="bg-white dark:bg-zinc-900 pb-20">
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
                                                    onEdit={(d: any) => openModal('editDocument', d.id)}
                                                    onShare={(d: any) => openModal('shareDocument', d.id)}
                                                    onDelete={handleDelete}
                                                    onUpload={triggerUpload}
                                                />
                                            ))}

                                            {groupedDocuments.unassigned.length > 0 && (
                                                <div className="mt-6">
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Unassigned {terminology.matters}</h4>
                                                    {groupedDocuments.unassigned.map(doc => (
                                                        <DocumentRow
                                                            key={doc.id}
                                                            doc={doc}
                                                            users={[]}
                                                            onViewDetails={onViewDetails}
                                                            onDownload={handleDownload}
                                                            onEdit={(d) => openModal('editDocument', d.id)}
                                                            onShare={(d) => openModal('shareDocument', d.id)}
                                                            onDelete={handleDelete}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        filteredDocuments.map(doc => (
                                            <DocumentRow
                                                key={doc.id}
                                                doc={doc}
                                                users={[]}
                                                onViewDetails={onViewDetails}
                                                onDownload={handleDownload}
                                                onEdit={(d) => openModal('editDocument', d.id)}
                                                onShare={(d) => openModal('shareDocument', d.id)}
                                                onDelete={handleDelete}
                                            />
                                        ))
                                    )}
                                </div>
                            ) : (
                                <EmptyState
                                    title="No Documents Yet"
                                    description={searchTerm ? "No matches found for your search." : (selectedCategory ? "This folder is empty. Upload a document to get started." : "Upload your first document to get started. You can organize files by matter, category, or keep them firm-wide.")}
                                    icon={<DocumentIcon className="w-full h-full" />}
                                    actionLabel={searchTerm ? undefined : "Upload Document"}
                                    onAction={searchTerm ? undefined : () => openModal('newDocument')}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

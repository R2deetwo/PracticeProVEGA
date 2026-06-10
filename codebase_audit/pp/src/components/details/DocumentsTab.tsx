
import React, { useState, DragEvent } from 'react';
import { Document, Matter, FileDetails, User, ModalType, UserRole } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { formatBytes } from '../../utils/formatting';
import { UploadIcon, UserUploadIcon, ShareIcon, DocumentIcon, EyeIcon, EditIcon, TrashIcon, DownloadIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import Tooltip from '../Tooltip';

interface DocumentsTabProps {
    documents: Document[];
    matterId: string;
    openModal: (type: ModalType, id: string | null, context?: any) => void;
    onViewDocumentDetails: (docId: string) => void;
    users: User[];
    onDraftDocument?: () => void;
    hideUploadButton?: boolean;
    variant?: 'default' | 'embedded';
    lastViewedAt?: number;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({
    documents,
    matterId,
    openModal,
    onViewDocumentDetails,
    users,
    onDraftDocument,
    hideUploadButton = false,
    variant = 'default',
    lastViewedAt = 0
}) => {
    const { deleteItem } = useDataActions();
    const { currentUser } = useAuth();
    const { closeModal, addToast } = useUI();
    const [isDragging, setIsDragging] = useState(false);
    const [editorChoiceDoc, setEditorChoiceDoc] = useState<Document | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        openModal('newDocument', null, { matterId, droppedFile: file });
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files || []);
        if (droppedFiles.length === 1) {
            handleFile(droppedFiles[0]);
        } else if (droppedFiles.length > 1) {
            openModal('batchUpload', null, { matterId, files: droppedFiles });
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 1) {
            handleFile(selectedFiles[0]);
        } else if (selectedFiles.length > 1) {
            openModal('batchUpload', null, { matterId, files: selectedFiles });
        }
    };

    const handleDownload = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        if (!doc.file?.dataUrl) return;
        const link = document.createElement('a');
        link.href = doc.file.dataUrl;
        link.download = doc.file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        openModal('deleteConfirmation', doc.id, {
            title: `Delete Document "${doc.title}"?`,
            message: "Are you sure you want to delete this document? This action cannot be undone.",
            onConfirm: () => {
                // Optimistic Close: Close modal immediately for better perceived performance
                closeModal();
                deleteItem('documents', doc.id, doc.title);
                addToast("Document deleted successfully.", { type: 'success' });
            },
            confirmText: "Delete Permanently",
            confirmButtonClass: "bg-red-600 hover:bg-red-700"
        });
    };

    const handleShare = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        openModal('shareDocument', doc.id);
    };

    const handleEdit = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        // Ask user for their preferred editing method
        setEditorChoiceDoc(doc);
    };

    const handleInternalEdit = () => {
        if (editorChoiceDoc) {
            openModal('editDocument', editorChoiceDoc.id);
            setEditorChoiceDoc(null);
        }
    };

    const handleExternalEdit = (e: React.MouseEvent) => {
        if (editorChoiceDoc) {
            handleDownload(e, editorChoiceDoc);
            setEditorChoiceDoc(null);
            addToast("File downloaded for external editing.", { type: 'success' });
        }
    };

    // Show all documents, ensuring no filtering hides items from teammates
    const sharedDocuments = documents
        .sort((a, b) => new Date(b.dateFiled).getTime() - new Date(a.dateFiled).getTime());

    const isEmbedded = variant === 'embedded';
    const containerClasses = isEmbedded
        ? "bg-transparent"
        : "bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6";

    // --- RENDER GRID ITEM (Embedded View) ---
    const renderGridItem = (doc: Document) => {
        const isNew = new Date(doc.dateFiled).getTime() > lastViewedAt && doc.uploadedBy !== currentUser?.id;
        const extension = doc.file?.name.split('.').pop() || 'doc';

        return (
            <div
                key={doc.id}
                onClick={() => onViewDocumentDetails(doc.id)}
                className={`
                    group relative flex flex-col items-center justify-between p-3 rounded-xl border transition-all cursor-pointer min-h-[140px]
                    bg-white dark:bg-zinc-800 hover:shadow-xl hover:-translate-y-1
                    ${isNew ? 'border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-500/20' : 'border-slate-200 dark:border-zinc-700 hover:border-primary-400 dark:hover:border-primary-500'}
                `}
            >
                {/* New Indicator */}
                {isNew && (
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                        <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">New</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                    </div>
                )}

                {/* Icon Area */}
                <div className="flex-grow flex items-center justify-center py-4">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-zinc-700 rounded-2xl flex items-center justify-center text-slate-400 dark:text-zinc-400 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-600 transition-all duration-300 shadow-sm group-hover:shadow-md">
                        <DocumentIcon className="w-6 h-6" />
                    </div>
                </div>

                {/* Text Area with Tooltip */}
                <div className="w-full text-center px-1 pb-1">
                    <Tooltip text={doc.title}>
                        <p className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 leading-tight break-all">
                            {doc.title}
                        </p>
                    </Tooltip>
                    <div className="flex items-center justify-center gap-2 mt-1.5">
                        <span className="text-[8px] text-slate-400 dark:text-zinc-500 font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{extension}</span>
                        {doc.file?.size && <span className="text-[8px] text-slate-400 dark:text-zinc-500 font-medium">{formatBytes(doc.file.size)}</span>}
                    </div>
                </div>

                {/* Hover Actions Overlay */}
                <div className="absolute inset-0 bg-black/5 dark:bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-[1px]">
                    <button onClick={(e) => { e.stopPropagation(); onViewDocumentDetails(doc.id); }} className="p-1.5 bg-white dark:bg-zinc-700 rounded-full text-slate-600 dark:text-slate-200 shadow-sm hover:scale-110 transition-transform">
                        <EyeIcon className="w-3 h-3" />
                    </button>
                    {doc.file && (
                        <button onClick={(e) => handleDownload(e, doc)} className="p-1.5 bg-white dark:bg-zinc-700 rounded-full text-slate-600 dark:text-slate-200 shadow-sm hover:scale-110 transition-transform">
                            <DownloadIcon className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div
            className={`${containerClasses} relative`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 bg-primary-500/20 border-4 border-dashed border-primary-500 rounded-xl flex items-center justify-center z-50 pointer-events-none">
                    <div className="text-center text-primary-600 font-bold text-xl"><UploadIcon className="w-12 h-12 mx-auto" /><p>Drop to Upload</p></div>
                </div>
            )}

            {/* Editor Choice Modal */}
            {editorChoiceDoc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setEditorChoiceDoc(null)}>
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-slate-200 dark:border-zinc-700" onClick={e => e.stopPropagation()}>
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-900 dark:text-white">
                                <EditIcon className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Edit Document</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                How would you like to edit <strong>"{editorChoiceDoc.title}"</strong>?
                            </p>

                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={handleInternalEdit}
                                    className="flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-slate-100 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/10 hover:border-slate-900 dark:hover:border-white hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all group"
                                >
                                    <div className="bg-slate-900 dark:bg-zinc-700 p-2 rounded-lg shadow-sm text-white">
                                        <EditIcon className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600">DraftPro Editor</div>
                                        <div className="text-[10px] text-slate-500">Edit directly in browser</div>
                                    </div>
                                </button>

                                <button
                                    onClick={handleExternalEdit}
                                    className="flex items-center justify-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-all group"
                                >
                                    <div className="bg-slate-100 dark:bg-zinc-600 p-2 rounded-lg text-slate-600 dark:text-slate-300">
                                        <DownloadIcon className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-slate-700 dark:text-slate-300">External App</div>
                                        <div className="text-[10px] text-slate-500">Download to edit locally</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-700 flex justify-center">
                            <button onClick={() => setEditorChoiceDoc(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={`flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 ${isEmbedded ? 'px-0 pt-0' : ''}`}>
                {!isEmbedded && <h3 className="text-xl font-bold text-slate-800 dark:text-white">Documents</h3>}
                <div className={`flex items-center gap-2 ${isEmbedded ? 'w-full justify-between' : ''}`}>
                    {isEmbedded && <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">All Folders & Files</h4>}

                    <div className="flex gap-2">
                        <input autoComplete="off" data-lpignore="true"  type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />

                        {onDraftDocument && (
                            <button
                                onClick={onDraftDocument}
                                className="px-3 py-1.5 bg-slate-900 text-white border border-slate-900 rounded-lg font-semibold text-xs hover:bg-slate-800 flex items-center transition-colors shadow-sm"
                            >
                                <DocumentIcon className="w-3.5 h-3.5 mr-1.5" />
                                Draft
                            </button>
                        )}

                        {!hideUploadButton && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-600 rounded-lg font-semibold text-xs hover:bg-slate-200 dark:hover:bg-zinc-600 flex items-center transition-colors"
                            >
                                <UploadIcon className="w-3.5 h-3.5 mr-1.5" />
                                Upload Files
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div>
                {sharedDocuments.length > 0 ? (
                    isEmbedded ? (
                        // Embedded Grid View
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {sharedDocuments.map(renderGridItem)}
                        </div>
                    ) : (
                        // Standard List View
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 dark:text-zinc-400 uppercase">
                                    <tr>
                                        <th className="py-2 px-4">Title</th>
                                        <th className="py-2 px-4">Date Uploaded</th>
                                        <th className="py-2 px-4">Uploaded By</th>
                                        <th className="py-2 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
                                    {sharedDocuments.map(doc => {
                                        const uploader = doc.uploadedBy ? users.find(u => u.id === doc.uploadedBy) : null;
                                        const uploadedByClient = uploader && uploader.role === UserRole.Client;
                                        const isNew = new Date(doc.dateFiled).getTime() > lastViewedAt && doc.uploadedBy !== currentUser?.id;

                                        return (
                                            <tr
                                                key={doc.id}
                                                className={`group hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors ${isNew ? 'animate-flash-highlight' : ''}`}
                                            >
                                                <td onClick={() => onViewDocumentDetails(doc.id)} className="py-3 px-4 font-semibold cursor-pointer">
                                                    <div className="flex items-center gap-2">
                                                        {isNew && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="New Document"></div>}
                                                        {uploadedByClient && (
                                                            <Tooltip text={`Uploaded by Client (${uploader?.name})`}>
                                                                <div className="flex-shrink-0">
                                                                    <UserUploadIcon className="text-primary-500 w-4 h-4" />
                                                                </div>
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip text={doc.title}>
                                                            <span className="text-slate-700 dark:text-zinc-200 truncate max-w-xs">{doc.title}</span>
                                                        </Tooltip>
                                                    </div>
                                                </td>
                                                <td onClick={() => onViewDocumentDetails(doc.id)} className="py-3 px-4 text-slate-500 dark:text-zinc-400 cursor-pointer">{new Date(doc.dateFiled).toLocaleDateString('en-GB')}</td>
                                                <td className="py-3 px-4 text-slate-500 dark:text-zinc-400">
                                                    {uploader ? uploader.name : 'Unknown'}
                                                </td>
                                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Tooltip text="View Details">
                                                            <button onClick={() => onViewDocumentDetails(doc.id)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                                                                <EyeIcon className="w-4 h-4" />
                                                            </button>
                                                        </Tooltip>
                                                        <Tooltip text="Rename/Edit">
                                                            <button onClick={(e) => handleEdit(e, doc)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded text-slate-400 hover:text-primary-600">
                                                                <EditIcon className="w-4 h-4" />
                                                            </button>
                                                        </Tooltip>
                                                        <Tooltip text="Share">
                                                            <button onClick={(e) => handleShare(e, doc)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded text-slate-400 hover:text-blue-500">
                                                                <ShareIcon className="w-4 h-4" />
                                                            </button>
                                                        </Tooltip>
                                                        {doc.file && (
                                                            <Tooltip text="Download">
                                                                <button onClick={(e) => handleDownload(e, doc)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded text-slate-400 hover:text-green-600">
                                                                    <DownloadIcon className="w-4 h-4" />
                                                                </button>
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip text="Delete">
                                                            <button onClick={(e) => handleDelete(e, doc)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-slate-400 hover:text-red-600">
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </Tooltip>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    <div className={`text-center py-8 text-slate-500 dark:text-zinc-400 ${isEmbedded ? 'border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl' : 'bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-dashed border-slate-200 dark:border-zinc-700'}`}>
                        <p className="text-xs">No documents found.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


import React, { useState, DragEvent } from 'react';
import { Document, Matter, FileDetails, User } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { formatBytes } from '../../utils/formatting';
import { UploadIcon, UserUploadIcon, DownloadIcon, CheckBadgeIcon, SignatureIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';

interface ClientDocumentsTabProps {
    documents: Document[];
    matter: Matter;
    currentUser: User;
    handleClientUploadDocument: (matterId: string, fileDetails: FileDetails) => void;
    handleClientMarkDocumentAsReviewed: (documentId: string) => void;
    isNew: (date: string) => boolean;
}

export const ClientDocumentsTab: React.FC<ClientDocumentsTabProps> = ({ documents, matter, currentUser, handleClientUploadDocument, handleClientMarkDocumentAsReviewed, isNew }) => {
    const { coreState, isDataLoaded } = useCoreState();
    const { openModal } = useUI();
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const fileDetails: FileDetails = {
                name: file.name,
                type: file.type,
                size: file.size,
                filePath: `client_upload/${matter.id}/${file.name}`,
                dataUrl: reader.result as string,
            };
            handleClientUploadDocument(matter.id, fileDetails);
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };
    
    const handleDownload = (doc: Document) => {
        if (!doc.file?.dataUrl) return;
        const link = document.createElement('a');
        link.href = doc.file.dataUrl;
        link.download = doc.file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const sharedDocuments = documents
        .filter(d => d.isSharedWithClient || d.uploadedBy === currentUser.id)
        .sort((a,b) => new Date(b.dateFiled).getTime() - new Date(a.dateFiled).getTime());

    return (
        <div 
            className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 relative"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 bg-primary-500/20 border-4 border-dashed border-primary-500 rounded-lg flex items-center justify-center z-10 pointer-events-none">
                    <div className="text-center text-primary-600 font-bold text-xl"><UploadIcon className="w-12 h-12 mx-auto" /><p>Drop to Upload</p></div>
                </div>
            )}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Shared Documents</h3>
                <input autoComplete="off" data-lpignore="true"  type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-primary-500 text-white rounded-lg font-semibold text-sm hover:bg-primary-600 flex items-center">
                    <UploadIcon className="mr-2 w-4 h-4" /> Upload Document
                </button>
            </div>
            {sharedDocuments.length > 0 ? (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {sharedDocuments.map(doc => {
                        const uploadedByClient = doc.uploadedBy === currentUser.id;
                        const requiresReview = doc.clientReviewStatus === 'review_requested';
                        const isReviewed = doc.clientReviewStatus === 'reviewed';
                        const requiresSignature = doc.isSignatureRequested && !doc.signatureData;
                        const isSigned = doc.isSignatureRequested && doc.signatureData;

                        return (
                            <div key={doc.id} className="p-3 rounded-lg border border-slate-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-slate-800 dark:text-white truncate">{doc.title}</p>
                                        {isNew(doc.dateFiled) && !uploadedByClient && <span className="px-1.5 py-0.5 text-2xs font-bold rounded-full bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-200 flex-shrink-0">NEW</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                        {uploadedByClient ? `Uploaded by you` : `Shared by ${coreState.firmDetails?.name || 'your firm'}`} on {new Date(doc.dateFiled).toLocaleDateString('en-GB')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {requiresReview && <button onClick={() => handleClientMarkDocumentAsReviewed(doc.id)} className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-full font-semibold">Mark as Reviewed</button>}
                                    {isReviewed && <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full font-semibold flex items-center gap-1"><CheckBadgeIcon className="w-4 h-4" /> Reviewed</span>}
                                    {requiresSignature && <button onClick={() => openModal('signDocument', doc.id)} className="px-3 py-1 text-sm bg-blue-500 text-white rounded-full font-semibold flex items-center gap-1"><SignatureIcon className="w-4 h-4" /> Sign Document</button>}
                                    {isSigned && <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full font-semibold flex items-center gap-1"><CheckBadgeIcon className="w-4 h-4" /> Signed</span>}
                                    {doc.file && <button onClick={() => handleDownload(doc)} className="p-2 rounded-full bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600"><DownloadIcon className="w-4 h-4" /></button>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 text-slate-500 dark:text-zinc-400">
                    <p>No documents have been shared for this matter yet.</p>
                    <p className="text-sm mt-1">You can upload relevant files here for your legal team to review.</p>
                </div>
            )}
        </div>
    );
};

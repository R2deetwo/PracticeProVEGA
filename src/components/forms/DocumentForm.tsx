
import React, { useState, useEffect, DragEvent, useCallback, useMemo } from 'react';
import { Document, Matter, DocumentCategory, View, User, FileDetails, DocumentTemplate, FirmDetails, DocumentTemplateCategory, Contact, AloaHint } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useProduct } from '../../contexts/ProductContext';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatBytes } from '../../utils/formatting';
import { DocumentsIcon, CloudArrowUpIcon, GavelIconLarge, SaveIcon, XIcon, OfficeBuildingIcon, FolderIcon, CalendarIcon, TrashIcon, InfoIcon, CheckBadgeIcon, SparklesIcon, ZapIcon, WarningIcon } from '../../constants';
import { TemplateService } from '../../utils/TemplateService';
import * as aiService from '../../services/aiService';
import { analyzePartyName, analyzeMatterIntelligence } from '../../utils/defenseUtils';
import { inputModern } from '../../utils/formStyles';


interface DocumentFormProps {
    documents: Document[];
    matters: Matter[];
    contacts: Contact[];
    documentCategories: DocumentCategory[];
    documentTemplates: DocumentTemplate[];
    documentTemplateCategories: DocumentTemplateCategory[];
    firmDetails: FirmDetails;
    onAddDocument: (newDocumentData: any) => Promise<void>;
    onUpdateDocument?: (updatedDocument: Document) => void;
    onClose: () => void;
    onNavigate?: (view: View, targetId?: string | null, context?: any) => void;
    currentUser: User;
    documentToEdit?: Document;
    initialContext?: { matterId?: string | null; categoryId?: string; draftTitle?: string; draftContent?: string; droppedFile?: File; fields?: any; context?: any };
    isCompact?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
// P1 FIX: File-type whitelist — prevents uploading executable/script files
// that could be used for XSS or malware distribution via the document store.
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];

export const DocumentForm: React.FC<DocumentFormProps> = ({
    documents,
    matters,
    contacts,
    documentCategories,
    documentTemplates,
    documentTemplateCategories,
    firmDetails,
    onAddDocument,
    onUpdateDocument,
    onClose,
    onNavigate,
    currentUser,
    documentToEdit,
    initialContext,
    isCompact,
}) => {
    const { coreState } = useCoreState();
    const { view, selectedId, navigateTo } = useUI();
    const { openModal, addToast } = useUI();
    // Use the canonical product-aware flags from ProductContext.
    // Previously this component checked `product === 'legal' || product === 'vega'`
    // which MISSED 'unified' (Komplete) — so Komplete firms wrongly saw "Property"
    // labels instead of "Matter" labels. useProduct().isLegal correctly returns
    // true for both Vega AND Komplete (unified).
    const { isLegal, isProperty: isPropertyFirm, isUnified, hasPropertyFeatures, hasLegalFeatures, terminology } = useProduct();
    const [title, setTitle] = useState('');
    const [file, setFile] = useState<FileDetails | null>(null);
    const [matterId, setMatterId] = useState<string | undefined>(undefined);
    const [propertyId, setPropertyId] = useState<string | undefined>(undefined);
    const [categoryId, setCategoryId] = useState<string>('');
    const [dateFiled, setDateFiled] = useState(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDraftingAI, setIsDraftingAI] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [content, setContent] = useState<string | undefined>(undefined);
    const [isCourtProcess, setIsCourtProcess] = useState(false);
    const [litigationStatus, setLitigationStatus] = useState<'draft' | 'filed' | 'served' | 'acknowledged'>('draft');

    const isEditing = !!documentToEdit;
    const gridClass = isCompact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";
    // isLegal is now sourced from useProduct() above (line ~62) so it correctly
    // includes 'unified' (Komplete). Do NOT re-declare it here.

    // Litigation Intelligence Hints
    const hints = useMemo(() => {
        const results: AloaHint[] = [];
        if (title) {
            // Split title if it contains 'v.' or 'vs.' to check party names
            const parties = title.split(/\s+v\.?\s+|\s+vs\.?\s+/i);
            if (parties.length > 1) {
                results.push(...analyzePartyName(parties[0], 'claimant', [], parties.slice(1)));
                results.push(...analyzePartyName(parties[1], 'defendant', [parties[0]], []));
            }
        }

        const selectedMatter = matters.find(m => m.id === matterId);
        if (selectedMatter) {
            results.push(...analyzeMatterIntelligence(title, selectedMatter.court));
        }

        return results;
    }, [title, matterId, matters]);

    const fullDoc = useQuery(api.myFunctions.getDocumentContent,
        (isEditing && documentToEdit) ? { documentId: documentToEdit.id, firmId: currentUser?.firmId || '' } : "skip"
    );

    useEffect(() => {
        if (isEditing && documentToEdit) {
            setTitle(documentToEdit.title);
            setFile(documentToEdit.file ? { ...documentToEdit.file } : null);
            setMatterId(documentToEdit.matter?.id);
            setPropertyId(documentToEdit.propertyId || documentToEdit.property?.id);
            setCategoryId(documentToEdit.categoryId);
            setDateFiled(documentToEdit.dateFiled);
            setContent((fullDoc as any)?.content || documentToEdit.content);
            setIsCourtProcess(documentToEdit.isCourtProcess || false);
            setLitigationStatus(documentToEdit.litigationStatus || 'draft');
        } else {
            const context = initialContext?.fields || initialContext?.context || initialContext;

            if (context?.matterId) {
                setMatterId(context.matterId);
                const matterCat = documentCategories.find(c => c.name.toLowerCase().includes('matter') || c.name.toLowerCase().includes('client'))?.id;
                if (matterCat) setCategoryId(matterCat);
            } else if (context?.categoryId) {
                setCategoryId(context.categoryId);
            } else {
                const defaultCat = documentCategories.find(c => c.name === 'Correspondence' || c.isCore)?.id;
                if (defaultCat) setCategoryId(defaultCat);
            }

            if (context?.propertyId) {
                setPropertyId(context.propertyId);
            }

            if (context?.draftTitle || context?.title) {
                setTitle(context.draftTitle || context.title);
            }
            if (context?.draftContent !== undefined) {
                setContent(context.draftContent);
            } else if (context?.matterId && (context?.draftTitle || context?.title)) {
                const matter = matters.find(m => m.id === context.matterId);
                if (matter) {
                    const generated = TemplateService.getTemplate(context?.draftTitle || context?.title, matter);
                    setContent(generated);
                }
            }
            if (context?.isCourtProcess) {
                setIsCourtProcess(true);
                setLitigationStatus('draft');
            }
            if (context?.droppedFile) {
                handleFile(context.droppedFile);
            }
        }
    }, [isEditing, documentToEdit, initialContext, documentCategories]);

    const handleFile = useCallback((selectedFile: File) => {
        if (selectedFile.size > MAX_FILE_SIZE) {
            setError(`File exceeds limit (${formatBytes(MAX_FILE_SIZE)}). Please compress or split the file.`);
            return;
        }

        // P1 FIX: Validate file type — reject executables, scripts, and unknown types
        const fileExtension = '.' + (selectedFile.name.split('.').pop() || '').toLowerCase();
        const isAllowedMime = ALLOWED_MIME_TYPES.includes(selectedFile.type);
        const isAllowedExt = ALLOWED_EXTENSIONS.includes(fileExtension);
        if (!isAllowedMime && !isAllowedExt) {
            setError(`File type not allowed. Allowed: PDF, Word, Excel, PowerPoint, Text, CSV, Images (JPG, PNG, GIF, WebP, HEIC).`);
            return;
        }

        setError(null);
        const reader = new FileReader();
        reader.onerror = () => setError("Failed to read file.");
        reader.onload = () => {
            setTitle(prev => (!prev || prev === 'New Document') ? selectedFile.name.replace(/\.[^/.]+$/, "") : prev);
            setFile({
                name: selectedFile.name,
                type: selectedFile.type,
                size: selectedFile.size,
                filePath: `uploads/${Date.now()}_${selectedFile.name}`,
                dataUrl: reader.result as string,
            });
        };
        reader.readAsDataURL(selectedFile);
    }, []);

    const handleDraftPro = async () => {
        if (!title || !matterId) {
            addToast("Please provide a title and select a matter for context.", { type: 'info' });
            return;
        }

        setIsDraftingAI(true);
        const matter = matters.find(m => m.id === matterId);

        try {
            const history = [
                { role: 'user', content: `Draft a professional Nigerian legal document titled "${title}" for the matter "${matter?.title}". Use formal court language if applicable. Include appropriate placeholders.` }
            ];

            let fullText = '';
            await aiService.streamDraft(history, { appState: { matters, tasks: documents } as any, currentUser }, (chunk) => {
                fullText += chunk;
                setContent(fullText);
            });
            addToast("Draft generated successfully.", { type: 'success' });
        } catch (err) {
            console.error("Draft Pro Error:", err);
            addToast("AI Drafting failed. Please try again.", { type: 'error' });
        } finally {
            setIsDraftingAI(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title) {
            setError("Please provide a title.");
            return;
        }
        if (!categoryId) {
            setError("Please select a folder category.");
            return;
        }
        // P1 FIX: Check for empty/whitespace-only content (was allowing empty documents to be saved)
        if (!file && (!content || !content.trim()) && !isEditing) {
            setError("Please upload a file or save draft content.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const selectedMatter = matterId ? matters.find(m => m.id === matterId) : undefined;
        const selectedProperty = propertyId ? (coreState.properties || []).find(p => p.id === propertyId) : undefined;

        try {
            if (isEditing && onUpdateDocument && documentToEdit) {
                const updatedDoc: Document = {
                    ...documentToEdit,
                    title,
                    matter: selectedMatter ? { id: selectedMatter.id, title: selectedMatter.title } : undefined,
                    property: selectedProperty ? { id: selectedProperty.id, title: selectedProperty.address || selectedProperty.id } : undefined,
                    propertyId: propertyId,
                    categoryId,
                    dateFiled,
                    file: file || undefined,
                    content: content,
                    isCourtProcess,
                    litigationStatus: isCourtProcess ? litigationStatus : undefined,
                };
                await onUpdateDocument(updatedDoc);
                addToast("Document updated.", { type: 'success' });
            } else {
                const newDocData = {
                    title,
                    firmId: firmDetails.id,
                    matter: selectedMatter ? { id: selectedMatter.id, title: selectedMatter.title } : undefined,
                    property: selectedProperty ? { id: selectedProperty.id, title: selectedProperty.address || selectedProperty.id } : undefined,
                    propertyId: propertyId,
                    categoryId,
                    dateFiled,
                    file: file ? { ...file } : undefined,
                    content: content,
                    assignedUsers: [],
                    source: content ? 'generated' : 'upload',
                    uploadedBy: currentUser.id,
                    isCourtProcess,
                    litigationStatus: isCourtProcess ? litigationStatus : undefined,
                };

                await onAddDocument(newDocData);
                addToast("Document saved.", { type: 'success' });
            }

            setFile(null);
            setContent(undefined);

            setTimeout(() => {
                onClose();
            }, 100);

        } catch (err: any) {
            console.error("Save Error:", err);
            setError(`Failed to save document. ${err.message || "Please try again."}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const commonInputClass = inputModern;
    // Simpler labels — sentence case, smaller tracking, less micro-uppercase
    const labelClass = "block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 ml-0.5";

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 -m-2">
            <div className="space-y-3">
                {isEditing && !fullDoc && (
                    <div className="absolute inset-x-0 top-0 -bottom-10 z-[60] bg-white/60 dark:bg-zinc-800/60 backdrop-blur-[2px] flex items-center justify-center rounded-xl">
                        <div className="flex flex-col items-center gap-3 text-slate-600 dark:text-zinc-300">
                            <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-semibold">Loading…</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded-lg">
                        <div className="flex items-center gap-2">
                            <InfoIcon className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    </div>
                )}

                {/* Litigation Intelligence Warnings */}
                {hints.length > 0 && (
                    <div className="space-y-2">
                        {hints.map((hint, idx) => (
                            <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border text-xs ${
                                hint.type === 'error' ? 'bg-rose-50/50 border-rose-200 text-rose-700 dark:bg-rose-900/10 dark:border-rose-900/40' :
                                hint.type === 'warning' ? 'bg-amber-50/50 border-amber-200 text-amber-700 dark:bg-amber-900/10 dark:border-amber-900/40' :
                                'bg-blue-50/50 border-blue-200 text-blue-700 dark:bg-blue-900/10 dark:border-blue-900/40'
                            }`}>
                                <div className="text-base flex-shrink-0">{hint.icon}</div>
                                <p className="font-medium leading-relaxed">{hint.text}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Title */}
                <div>
                    <label htmlFor="title" className={labelClass}>{isLegal ? 'Draft name' : 'Title'}</label>
                    <input autoComplete="off" data-lpignore="true" type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className={commonInputClass} placeholder={isLegal ? "e.g. Originating Summons" : "Enter document name"} required />
                </div>

                {/* Link to Matter and/or Property — product-aware.
                    Vega (legal-only): Matter dropdown only.
                    Atrium (property-only): Property dropdown only.
                    Komplete (unified): BOTH dropdowns, clearly separated.
                    Previously this was a single dropdown that showed 'Matter' for
                    isLegal firms (which includes Komplete) and 'Property' for Atrium —
                    so Komplete users could only link to matters, never properties. */}
                {hasLegalFeatures && (
                    <div>
                        <label className={labelClass}>Matter</label>
                        <div className="relative">
                            <GavelIconLarge className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select value={matterId || ''} onChange={e => setMatterId(e.target.value || undefined)} className={`${commonInputClass} pl-10 appearance-none`}>
                                <option value="">None</option>
                                {matters.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                            </select>
                        </div>
                    </div>
                )}
                {hasPropertyFeatures && (
                    <div>
                        <label className={labelClass}>Property</label>
                        <div className="relative">
                            <OfficeBuildingIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select value={propertyId || ''} onChange={e => setPropertyId(e.target.value || undefined)} className={`${commonInputClass} pl-10 appearance-none`}>
                                <option value="">None</option>
                                {(coreState.properties || []).map(p => <option key={p.id} value={p.id}>{p.address || p.id}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {/* Folder */}
                <div>
                    <label className={labelClass}>Folder</label>
                    <div className="relative">
                        <FolderIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={`${commonInputClass} pl-10 appearance-none`} required>
                            <option value="" disabled>Select…</option>
                            {documentCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Upload area */}
                <div>
                    {content !== undefined ? (
                        <div className="space-y-2">
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                className="w-full h-32 bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 outline-none resize-y custom-scrollbar"
                                placeholder="Paste or type content…"
                            />
                            <button type="button" onClick={() => setContent(undefined)} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300">← Back to upload</button>
                        </div>
                    ) : (
                        <div
                            className={`relative border-2 border-dashed p-5 rounded-lg text-center transition-colors ${isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                        >
                            {file ? (
                                <div className="flex items-center justify-center gap-2">
                                    <CheckBadgeIcon className="w-5 h-5 text-emerald-500" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{file.name}</p>
                                        <p className="text-2xs text-slate-400">{formatBytes(file.size)}</p>
                                    </div>
                                    <button type="button" onClick={() => setFile(null)} className="text-xs text-rose-500 hover:underline ml-2">Remove</button>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <CloudArrowUpIcon className="w-6 h-6 text-slate-300 mx-auto" />
                                    <input autoComplete="off" data-lpignore="true" type="file" id="file-upload" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                                    <div className="text-sm">
                                        <label htmlFor="file-upload" className="cursor-pointer font-semibold text-primary-600 hover:underline">Upload a file</label>
                                        <span className="text-slate-400"> or </span>
                                        <button type="button" onClick={() => setContent('')} className="text-primary-600 hover:underline font-medium">type content</button>
                                    </div>
                                    <p className="text-2xs text-slate-400">PDF, DOCX, PNG, JPG · 10 MB max</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Court process toggle */}
                <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2">
                        <GavelIconLarge className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">Court process</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsCourtProcess(!isCourtProcess)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isCourtProcess ? 'bg-amber-600' : 'bg-slate-200 dark:bg-zinc-700'}`}
                    >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${isCourtProcess ? 'translate-x-4.5' : 'translate-x-1'}`} />
                    </button>
                </div>

                {isCourtProcess && (
                    <div className="pt-3 border-t border-slate-100 dark:border-zinc-700">
                        <label className={labelClass}>Stage</label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-1.5 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800">
                            {[
                                { id: 'draft', label: 'Drafting' },
                                { id: 'filed', label: 'Filed' },
                                { id: 'served', label: 'Served' },
                                { id: 'acknowledged', label: 'Confirmed' }
                            ].map((step) => (
                                <button
                                    key={step.id}
                                    type="button"
                                    //@ts-ignore
                                    onClick={() => setLitigationStatus(step.id)}
                                    className={`py-2 text-xs font-semibold rounded-md transition-colors ${litigationStatus === step.id ? 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-zinc-700' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-400'}`}
                                >
                                    {step.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer — full-width stacked on mobile, right-aligned on desktop */}
            <div className="sticky bottom-0 left-0 right-0 pt-3 pb-safe-extra bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 z-50">
                <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-5 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-sm font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors" disabled={isSubmitting}>
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <SaveIcon className="w-3.5 h-3.5" />
                    )}
                    {isSubmitting ? 'Saving…' : (isEditing ? 'Update' : 'Save')}
                </button>
            </div>
        </form>
    );
};

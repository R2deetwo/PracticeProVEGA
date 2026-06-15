
import React, { useState, useEffect, DragEvent, useCallback, useMemo } from 'react';
import { Document, Matter, DocumentCategory, View, User, FileDetails, DocumentTemplate, FirmDetails, DocumentTemplateCategory, Contact, AloaHint } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
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
    const [title, setTitle] = useState('');
    const [file, setFile] = useState<FileDetails | null>(null);
    const [matterId, setMatterId] = useState<string | undefined>(undefined);
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
        if (!file && !content && !isEditing) {
            setError("Please upload a file or save draft content.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const selectedMatter = matterId ? matters.find(m => m.id === matterId) : undefined;

        try {
            if (isEditing && onUpdateDocument && documentToEdit) {
                const updatedDoc: Document = {
                    ...documentToEdit,
                    title,
                    matter: selectedMatter ? { id: selectedMatter.id, title: selectedMatter.title } : undefined,
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
    const labelClass = "block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-1.5 ml-1";

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 -m-2">
            <div className="space-y-2 sm:space-y-3 pb-6">
                {isEditing && !fullDoc && (
                    <div className="absolute inset-x-0 top-0 -bottom-10 z-[60] bg-white/60 dark:bg-zinc-800/60 backdrop-blur-[2px] flex items-center justify-center rounded-xl">
                        <div className="flex flex-col items-center gap-4 text-slate-600 dark:text-zinc-300">
                            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin shadow-sm" />
                            <p className="text-xs font-black uppercase tracking-widest">Synchronizing Document...</p>
                        </div>
                    </div>
                )}
                
                {error && (
                    <div className="p-3 sm:p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2">
                            <InfoIcon className="w-4 h-4" />
                            {error}
                        </div>
                    </div>
                )}

                {/* Litigation Intelligence Warnings */}
                {hints.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {hints.map((hint, idx) => (
                            <div key={idx} className={`flex items-start gap-4 p-4 rounded-2xl border ${
                                hint.type === 'error' ? 'bg-rose-50/50 border-rose-200 text-rose-700 dark:bg-rose-900/10 dark:border-rose-900/40' : 
                                hint.type === 'warning' ? 'bg-amber-50/50 border-amber-200 text-amber-700 dark:bg-amber-900/10 dark:border-amber-900/40' : 
                                'bg-blue-50/50 border-blue-200 text-blue-700 dark:bg-blue-900/10 dark:border-blue-900/40'
                            } transition-all animate-in slide-in-from-left-4`}>
                                <div className="text-lg mt-0.5">{hint.icon}</div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                        Procedural Intelligence Detected
                                    </p>
                                    <p className="text-[13px] font-medium leading-relaxed">{hint.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Core Document Definitions */}
                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-4 mb-2 px-1">
                        <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm ring-2 ring-primary-500/10">
                            <DocumentsIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-primary-600/70 uppercase tracking-widest leading-none mb-0.5">{coreState.firmDetails?.product === 'legal' || coreState.firmDetails?.product === 'vega' ? 'Draft Definition' : 'Document Details'}</p>
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">{coreState.firmDetails?.product === 'legal' || coreState.firmDetails?.product === 'vega' ? 'Instrument Specification' : 'File Information'}</h3>
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label htmlFor="title" className={labelClass}>{coreState.firmDetails?.product === 'legal' || coreState.firmDetails?.product === 'vega' ? 'Draft / File Name' : 'Document Title'}</label>
                        <input autoComplete="off" data-lpignore="true"  type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className={commonInputClass} placeholder={coreState.firmDetails?.product === 'legal' || coreState.firmDetails?.product === 'vega' ? "Enter name of the legal instrument..." : "Enter document name..."} required />
                    </div>

                    <div className={`grid ${gridClass} gap-3 sm:gap-4`}>
                        <div className="space-y-2 group">
                            <label className={labelClass}>{coreState.firmDetails?.product === 'legal' || coreState.firmDetails?.product === 'vega' ? 'Matter / Client Link' : 'Property / Tenant Link'}</label>
                            <div className="relative">
                                <OfficeBuildingIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select value={matterId || ''} onChange={e => setMatterId(e.target.value || undefined)} className={`${commonInputClass} pl-11 appearance-none`}>
                                    <option value="">-- {coreState.firmDetails?.product === 'legal' || coreState.firmDetails?.product === 'vega' ? 'No Matter (General File)' : 'General Document'} --</option>
                                    {matters.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2 group">
                            <label className={labelClass}>Storage Folder</label>
                            <div className="relative">
                                <FolderIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={`${commonInputClass} pl-11 appearance-none`} required>
                                    <option value="" disabled>-- Select --</option>
                                    {documentCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Document Creation Method */}
                <div className="p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-800/30 rounded-xl border border-slate-100 dark:border-zinc-700/50 shadow-sm space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-4 px-1">
                        <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm ring-2 ring-indigo-500/10">
                            <CloudArrowUpIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-widest leading-none mb-0.5">Content Source</p>
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Method of Ingestion</h3>
                        </div>
                    </div>

                    {content !== undefined ? (
                        <div className="space-y-2 sm:space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                            <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 flex justify-between items-center px-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                    <p className="text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest">Intelligent Draft Mode</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button 
                                        type="button" 
                                        onClick={handleDraftPro}
                                        disabled={isDraftingAI}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-zinc-800 text-primary-600 text-[9px] font-black uppercase tracking-widest rounded-lg border border-primary-200 dark:border-primary-900/40 hover:bg-primary-50 transition-all shadow-sm"
                                    >
                                        <SparklesIcon className={`w-2.5 h-2.5 ${isDraftingAI ? 'animate-spin' : ''}`} />
                                        {isDraftingAI ? 'Generating...' : 'Draft Pro AI'}
                                    </button>
                                    <button type="button" onClick={() => setContent(undefined)} className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline">Switch to upload</button>
                                </div>
                            </div>
                            <div className="relative group">
                                <textarea 
                                    value={content} 
                                    onChange={e => setContent(e.target.value)} 
                                    className="w-full h-80 bg-white dark:bg-zinc-900/50 border-none ring-1 ring-slate-200 dark:ring-zinc-700/50 rounded-2xl p-6 text-[13px] font-serif leading-relaxed text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 outline-none shadow-inner transition-all resize-none custom-scrollbar"
                                    placeholder="Draft text content here. Use Draft Pro to assist with Nigerian legal formatting..."
                                />
                                <div className="absolute bottom-4 right-4 text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    {content.length.toLocaleString()} Characters
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            className={`relative group border-2 border-dashed p-6 sm:p-10 rounded-xl text-center transition-all duration-300 ${isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10 scale-[1.01]' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'}`}
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                        >
                            {file ? (
                                <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
                                    <div className="p-3 sm:p-4 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl mb-4">
                                        <CheckBadgeIcon className="w-8 h-8" />
                                    </div>
                                    <p className="text-sm font-black text-slate-800 dark:text-white mb-1 truncate max-w-xs">{file.name}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatBytes(file.size)}</p>
                                    <button type="button" onClick={() => setFile(null)} className="mt-6 px-4 py-2 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">Remove File</button>
                                </div>
                            ) : (
                                <div className="space-y-2 sm:space-y-3">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-all">
                                        <CloudArrowUpIcon className="w-8 h-8 text-slate-400 group-hover:text-primary-600" />
                                    </div>
                                    <div>
                                        <input autoComplete="off" data-lpignore="true"  type="file" id="file-upload" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                                        <div className="flex flex-col items-center gap-2">
                                            <label htmlFor="file-upload" className="cursor-pointer text-sm font-black text-primary-600 hover:text-primary-700 transition-colors uppercase tracking-widest underline decoration-2 underline-offset-4">Upload Document</label>
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">OR</span>
                                            <button type="button" onClick={() => setContent('')} className="flex items-center gap-2 mx-auto px-6 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:text-primary-600 hover:border-primary-500 transition-all shadow-sm">
                                                <ZapIcon className="w-3.5 h-3.5 text-amber-500" /> Start Empty Draft
                                            </button>
                                        </div>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-3 uppercase tracking-widest">PDF, DOCX, PNG, JPG (10MB Limit)</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Litigation Logic */}
                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 px-1">
                            <div className={`p-2.5 rounded-2xl shadow-sm ring-4 transition-all ${isCourtProcess ? 'bg-amber-600 text-white ring-amber-500/10' : 'bg-slate-100 text-slate-400 dark:bg-zinc-900 dark:text-zinc-600 ring-slate-100 dark:ring-zinc-900/20'}`}>
                                <GavelIconLarge className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">{coreState.firmDetails?.product === 'legal' || coreState.firmDetails?.product === 'vega' ? 'Legal Logic' : 'Process Type'}</p>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight">{coreState.firmDetails?.product === 'legal' || coreState.firmDetails?.product === 'vega' ? 'Court Process Designation' : 'Formal Procedure Flag'}</h3>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsCourtProcess(!isCourtProcess)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none ring-4 ${isCourtProcess ? 'bg-amber-600 ring-amber-500/10' : 'bg-slate-200 dark:bg-zinc-700 ring-transparent'}`}
                        >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isCourtProcess ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {isCourtProcess && (
                        <div className="pt-8 border-t border-slate-100 dark:border-zinc-700 animate-in fade-in slide-in-from-top-4 duration-500">
                            <label className={labelClass}>{coreState.firmDetails?.product === 'legal' || coreState.firmDetails?.product === 'vega' ? 'Litigation Stage' : 'Workflow Stage'}</label>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-2 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800">
                                {[
                                    { id: 'draft', label: 'Drafting', color: 'primary' },
                                    { id: 'filed', label: 'Filed', color: 'orange' },
                                    { id: 'served', label: 'Served', color: 'blue' },
                                    { id: 'acknowledged', label: 'Confirmed', color: 'emerald' }
                                ].map((step) => (
                                    <button
                                        key={step.id}
                                        type="button"
                                        //@ts-ignore
                                        onClick={() => setLitigationStatus(step.id)}
                                        className={`py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${litigationStatus === step.id ? 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-zinc-700 scale-[1.02]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-400'}`}
                                    >
                                        {step.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="sticky bottom-0 left-0 right-0 pt-4 sm:pt-8 pb-safe-extra bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 z-50">
                <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2" disabled={isSubmitting}>
                    <XIcon className="w-4 h-4" /> Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-8 sm:px-12 py-3 bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl sm:rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <SaveIcon className="w-4 h-4" />
                    )}
                    {isSubmitting ? 'Saving...' : (isEditing ? 'Commit Changes' : 'Initialize Document')}
                </button>
            </div>
        </form>
    );
};

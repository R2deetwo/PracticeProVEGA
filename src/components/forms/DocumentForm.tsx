
import React, { useState, useEffect, useRef, DragEvent, useCallback, useMemo } from 'react';
import { Document, Matter, DocumentCategory, View, User, FileDetails, DocumentTemplate, FirmDetails, DocumentTemplateCategory, Contact, AloaHint } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useProduct } from '../../contexts/ProductContext';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatBytes } from '../../utils/formatting';
import { uploadBlobToConvex, surfaceUploadError } from '../../utils/convexUpload';
import { buildVersionSnapshot, capVersions } from '../../utils/documentVersions';
import { resolvePersistedContent } from '../../utils/draftContentPersistence';
import { DocumentsIcon, CloudArrowUpIcon, GavelIconLarge, SaveIcon, XIcon, OfficeBuildingIcon, FolderIcon, CalendarIcon, TrashIcon, InfoIcon, CheckBadgeIcon, SparklesIcon, ZapIcon, WarningIcon } from '../../constants';
import { TemplateService } from '../../utils/TemplateService';
import * as aiService from '../../services/aiService';
import { analyzePartyName, analyzeMatterIntelligence } from '../../utils/defenseUtils';
import { inputModern } from '../../utils/formStyles';


import { Z_CLASS } from '../../overlays/constants';
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
    // V1-A (SEC-3): the bearer for the session-scoped getDocumentContent read.
    const { bearerToken } = useAuth();
    // V4 (V-DOC-5): uploads go to Convex STORAGE via the established
    // generateUploadUrl pattern (same as chat attachments and DraftPro's
    // vault saves) — the record carries a storageId, NOT a base64 data URL.
    const generateUploadUrl = useMutation(api.myFunctions.generateUploadUrl);
    // V4 (V-DOC-4): reliable-commit protocol state. The DraftPro host
    // (WordProcessor) passes onDraftCommitted / onDraftCancelled /
    // onDraftSaveError through initialContext; the form resolves them the
    // only honest way — after the vault write settles.
    const committedRef = useRef(false);
    const erroredRef = useRef(false);
    // V4 (V-DOC-4): the DraftPro HTML for this save. Persisted as the
    // document's content (instead of the plain-text textarea value) when
    // the user has not edited the text themselves — formatting survives
    // the save (the pre-V4 form dropped it on the floor).
    const draftHtmlRef = useRef<string | null>(null);
    const initialCtxRef = useRef<any>(null);
    useEffect(() => {
        initialCtxRef.current = initialContext as any;
        // V4 (V-DOC-4): capture the DraftPro HTML for this save.
        draftHtmlRef.current = (initialContext as any)?.draftHtml ?? null;
        return () => {
            // V4 (V-DOC-4): unmount without a successful submit = CANCELLED.
            // This covers the X button, backdrop click and ESC identically —
            // the draft session in the host stays intact for recovery.
            if (!committedRef.current && !erroredRef.current) {
                initialCtxRef.current?.onDraftCancelled?.();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Use the canonical product-aware flags from ProductContext.
    // Previously this component checked `product === 'legal' || product === 'vega'`
    // which MISSED 'unified' (Komplete) — so Komplete firms wrongly saw "Property"
    // labels instead of "Matter" labels. useProduct().isLegal correctly returns
    // true for both Vega AND Komplete (unified).
    const { isLegal, isProperty: isPropertyFirm, isUnified, hasPropertyFeatures, hasLegalFeatures, terminology, signerContext } = useProduct();
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
        (isEditing && documentToEdit) ? { documentId: documentToEdit.id, firmId: currentUser?.firmId || '', sessionToken: (bearerToken ?? undefined) } : "skip"
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
            // V4 (V-DOC-4): DraftPro round-trip — when this edit was opened BY
            // DraftPro (ctx.documentId + ctx.draftHtml), the editor's current
            // content is NEWER than the stored row. Show the fresh plain text
            // in the textarea; the formatted HTML rides along (draftHtmlRef)
            // and is persisted on submit unless the user edits the text.
            const draftCtxAny = (initialContext as any) || {};
            if (draftCtxAny.draftHtml && draftCtxAny.draftContent !== undefined) {
                setContent(draftCtxAny.draftContent);
            }
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

    // V4 (V-DOC-5): file uploads go to Convex storage (generateUploadUrl
    // pattern). The pre-V4 path read the file as a base64 data URL and
    // stored it INSIDE the document record — megabytes of base64 in every
    // row, unvalidated server-side, and a download path that could never
    // fetch real stored bytes. Now the record carries { storageId } and
    // nothing else; downloads resolve it via getFileUrl.
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const handleFile = useCallback(async (selectedFile: File) => {
        if (selectedFile.size > MAX_FILE_SIZE) {
            setError(`File exceeds limit (${formatBytes(MAX_FILE_SIZE)}). Please compress or split the file.`);
            return;
        }

        const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
        const fileName = selectedFile.name.toLowerCase();
        const ext = fileName.substring(fileName.lastIndexOf('.'));
        if (!allowedExtensions.includes(ext)) {
            setError(`File type "${ext}" is not allowed. Supported: ${allowedExtensions.join(', ')}`);
            return;
        }

        setError(null);
        setIsUploadingFile(true);
        try {
            const storageId = await uploadBlobToConvex(selectedFile, () =>
                generateUploadUrl({ sessionToken: bearerToken ?? undefined })
            );
            setTitle(prev => (!prev || prev === 'New Document') ? selectedFile.name.replace(/\.[^/.]+$/, "") : prev);
            setFile({
                name: selectedFile.name,
                type: selectedFile.type,
                size: selectedFile.size,
                filePath: '',
                storageId,
            });
        } catch (uploadErr: any) {
            surfaceUploadError(addToast, selectedFile, uploadErr, MAX_FILE_SIZE / (1024 * 1024));
            setError(`"${selectedFile.name}" was not uploaded. Try again.`);
        } finally {
            setIsUploadingFile(false);
        }
    }, [generateUploadUrl, bearerToken, addToast]);

    const handleDraftPro = async () => {
        if (!title || !matterId) {
            addToast("Please provide a title and select a matter for context.", { type: 'info' });
            return;
        }

        setIsDraftingAI(true);
        const matter = matters.find(m => m.id === matterId);

        try {
            // Draft prompt: include the matter's real context (type, client,
            // court) so the AI produces a matter-specific draft instead of a
            // generic one. Previously the prompt only carried title + matter
            // name, and the appState passed to streamDraft was fabricated
            // ({ matters, tasks: documents }) with NO firmDetails — so the
            // drafting engine lost the firm's jurisdiction, product mode,
            // and practice profile, falling back to Lagos + legal-mode for
            // every document generated from this form.
            const matterContextParts: string[] = [];
            if (matter?.type) matterContextParts.push(`Matter type: ${matter.type}`);
            if ((matter as any)?.court) matterContextParts.push(`Court: ${(matter as any).court}`);
            const clientContact = contacts.find(c => c.id === (matter as any)?.clientId);
            if (clientContact?.name) matterContextParts.push(`Client: ${clientContact.name}`);
            const history = [
                {
                    role: 'user',
                    content: `Draft a professional Nigerian ${isPropertyFirm ? 'property' : 'legal'} document titled "${title}" for the matter "${matter?.title}".${matterContextParts.length > 0 ? ` Context: ${matterContextParts.join('; ')}.` : ''} Use formal ${isPropertyFirm ? 'property management' : 'court'} language where applicable. Apply the firm's state of practice and procedural rules. Include appropriate bracketed placeholders for any unknown facts.`
                }
            ];

            let fullText = '';
            await aiService.streamDraft(history, {
                // REAL firm context (firmDetails prop carries product,
                // defaultStateOfPractice, statesOfPractice, practiceProfile)
                // + the user's signer profile for Komplete mode.
                appState: {
                    matters,
                    documents,
                    properties: coreState.properties,
                    firmDetails,
                } as any,
                currentUser,
                signerContext,
            }, (chunk) => {
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
        if (!file && (!content || !content.trim()) && !isEditing) {
            setError("Please upload a file or save draft content.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const selectedMatter = matterId ? matters.find(m => m.id === matterId) : undefined;
        const selectedProperty = propertyId ? (coreState.properties || []).find(p => p.id === propertyId) : undefined;

        // V4 (V-DOC-4): pick what actually gets persisted as `content`.
        // If DraftPro supplied HTML and the user did not edit the textarea
        // (its value still equals the pre-filled plain text), persist the
        // HTML — formatting survives the round trip. A user who edited the
        // text gets their own words, honestly. (Rule extracted to
        // utils/draftContentPersistence.ts — testable, one implementation.)
        const draftCtx = (initialContext as any) || {};
        const finalContent = resolvePersistedContent({
            content,
            plainPrefill: draftCtx.draftContent,
            draftHtml: draftHtmlRef.current,
        });

        try {
            if (isEditing && onUpdateDocument && documentToEdit) {
                // V4 (V-DOC-13): snapshot the PRIOR state before this commit
                // overwrites it — every committed edit now preserves what the
                // document said before (title/content/file), who changed it,
                // and when.
                const nowIso = new Date().toISOString();
                const priorVersions = Array.isArray(documentToEdit.versions) ? documentToEdit.versions : [];
                const nextShape = {
                    title,
                    content: finalContent,
                    file: file || undefined,
                    categoryId,
                    matter: selectedMatter ? { id: selectedMatter.id, title: selectedMatter.title } : undefined,
                };
                const snapshot = buildVersionSnapshot(documentToEdit, nextShape, currentUser.id, nowIso);
                const versions = capVersions([snapshot, ...priorVersions]);

                const updatedDoc: Document = {
                    ...documentToEdit,
                    title,
                    // V3 (V-MATTER-13): every write now sets the declarative
                    // `matterId` ALONGSIDE the legacy snapshot — the snapshot
                    // stays for display, the column makes the row joinable.
                    matterId: selectedMatter ? selectedMatter.id : undefined,
                    matter: selectedMatter ? { id: selectedMatter.id, title: selectedMatter.title } : undefined,
                    property: selectedProperty ? { id: selectedProperty.id, title: selectedProperty.address || selectedProperty.id } : undefined,
                    propertyId: propertyId,
                    categoryId,
                    dateFiled,
                    file: file || undefined,
                    content: finalContent,
                    versions,
                    isCourtProcess,
                    litigationStatus: isCourtProcess ? litigationStatus : undefined,
                };
                await onUpdateDocument(updatedDoc);
                // V4 (V-DOC-4): resolve the reliable-commit protocol — the
                // vault write succeeded, so (and only so) we report success.
                committedRef.current = true;
                (initialContext as any)?.onDraftCommitted?.();
                addToast("Document updated.", { type: 'success' });
            } else {
                const newDocData = {
                    title,
                    firmId: firmDetails.id,
                    // V3 (V-MATTER-13): the main upload form was the primary
                    // snapshot-only writer — most documents carried no
                    // matterId and were invisible to every by_matter query.
                    matterId: selectedMatter ? selectedMatter.id : undefined,
                    matter: selectedMatter ? { id: selectedMatter.id, title: selectedMatter.title } : undefined,
                    property: selectedProperty ? { id: selectedProperty.id, title: selectedProperty.address || selectedProperty.id } : undefined,
                    propertyId: propertyId,
                    categoryId,
                    dateFiled,
                    file: file ? { ...file } : undefined,
                    content: finalContent,
                    assignedUsers: [],
                    source: finalContent ? 'generated' : 'upload',
                    uploadedBy: currentUser.id,
                    isCourtProcess,
                    litigationStatus: isCourtProcess ? litigationStatus : undefined,
                };

                await onAddDocument(newDocData);
                // V4 (V-DOC-4): resolve the reliable-commit protocol.
                committedRef.current = true;
                (initialContext as any)?.onDraftCommitted?.();
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
            // V4 (V-DOC-4): resolve the protocol on the failure side — the
            // host keeps the draft session (recovery intact) and the editor
            // un-claims "saved".
            erroredRef.current = true;
            (initialContext as any)?.onDraftSaveError?.();
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
                    <div className={`absolute inset-x-0 top-0 -bottom-10 ${Z_CLASS.panelRaise} bg-white/60 dark:bg-zinc-800/60 backdrop-blur-[2px] flex items-center justify-center rounded-lg`}>
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
                                hint.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/40/50 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 dark:bg-amber-900/10 dark:border-amber-900/40' :
                                'bg-blue-50 dark:bg-blue-950/40/50 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 dark:bg-blue-900/10 dark:border-blue-900/40'
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
                            <button type="button" onClick={() => setContent(undefined)} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-200 dark:hover:text-zinc-300">← Back to upload</button>
                        </div>
                    ) : (
                        <div
                            className={`relative border-2 border-dashed p-5 rounded-lg text-center transition-colors ${isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 dark:bg-primary-900/10' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}
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
                                        <label htmlFor="file-upload" className="cursor-pointer font-semibold text-primary-600 dark:text-primary-300 hover:underline">Upload a file</label>
                                        <span className="text-slate-400"> or </span>
                                        <button type="button" onClick={() => setContent('')} className="text-primary-600 dark:text-primary-300 hover:underline font-medium">type content</button>
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
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-zinc-900 shadow-sm transition-transform ${isCourtProcess ? 'translate-x-4.5' : 'translate-x-1'}`} />
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
                                    className={`py-2 text-xs font-semibold rounded-md transition-colors ${litigationStatus === step.id ? 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-zinc-700' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 dark:hover:text-zinc-400'}`}
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

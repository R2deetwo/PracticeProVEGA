
import React, { useState, useEffect } from 'react';
import { AppMode } from '../../types';
import type { Document, User, FirmDetails, ModalType, View } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useProduct } from '../../contexts/ProductContext';
import { useDataActions } from '../../contexts/DataContext';
import { DownloadIcon, DocumentIcon, EditIcon, ShieldCheckIcon, GavelIconLarge, LockClosedIcon, CheckCircleIcon, SparklesIcon, InfoIcon, CheckBadgeIcon, ClockIcon, ScalesIcon, ChevronRightIcon } from '../../constants'; // Fixed path
import { Breadcrumbs } from '../Breadcrumbs';
import Tooltip from '../Tooltip';
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { sanitize } from '../../utils/sanitization';
import ErrorBoundary from '../ErrorBoundary';
import BacklinksPanel from '../BacklinksPanel';

const FileViewer: React.FC<{ file: any }> = ({ file }) => {
    const storageUrl = useQuery(api.myFunctions.getFileUrl, file?.storageId ? { storageId: file.storageId } : "skip");
    const lastUrlRef = React.useRef<string | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'fit' | 'portrait'>('fit');

    const activeUrl = file?.dataUrl || (storageUrl as string) || lastUrlRef.current;

    // Persist last valid URL to prevent query flicker/blank screen
    useEffect(() => {
        if (file?.dataUrl || (storageUrl as string)) {
            lastUrlRef.current = file?.dataUrl || (storageUrl as string);
        }
    }, [file?.dataUrl, storageUrl]);

    useEffect(() => {
        if (activeUrl && file?.type === 'application/pdf') {
            // Only update if current blobUrl is missing or invalid for this activeUrl
            if (activeUrl.startsWith('blob:')) {
                setBlobUrl(activeUrl);
            } else if (activeUrl.startsWith('data:')) {
                fetch(activeUrl)
                    .then(res => res.blob())
                    .then(blob => {
                        const url = URL.createObjectURL(blob);
                        setBlobUrl(url);
                    })
                    .catch(e => console.error("Error creating blob from data URL", e));
            } else if (activeUrl.startsWith('http')) {
                fetch(activeUrl)
                    .then(res => res.blob())
                    .then(blob => {
                        const url = URL.createObjectURL(blob);
                        setBlobUrl(url);
                    })
                    .catch(e => {
                        console.error("Error creating blob from remote URL", e);
                        setBlobUrl(activeUrl);
                    });
            }
        }
        return () => {
            // We don't revoke here to prevent flickering on quick re-renders
            // Browser will clean up when the page/session ends or we can add manual cleanup if memory becomes an issue
        };
    }, [activeUrl, file?.type]);

    if (!file) return <div className="p-8 text-center text-slate-400 italic">No file attached.</div>;

    const isImage = file.type?.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                   file.type === 'application/msword' ||
                   file.name?.toLowerCase().endsWith('.docx') ||
                   file.name?.toLowerCase().endsWith('.doc');

    // Loading state for PDFs while preparation is happening
    if (isPdf && !blobUrl) {
        return (
            <div className="w-full h-[80vh] min-h-[600px] bg-white dark:bg-zinc-800 rounded-xl shadow-lg flex flex-col items-center justify-center border border-slate-200">
                <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 border-4 border-slate-100 dark:border-zinc-700 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="text-slate-500 font-medium">Preparing document preview...</p>
            </div>
        );
    }

    if (activeUrl && isImage) {
        return (
            <div className="flex justify-center bg-white dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 shadow-lg">
                <img src={activeUrl} alt={file.name} className="max-w-full max-h-[75vh] object-contain rounded" />
            </div>
        );
    }

    if (isPdf && blobUrl) {
        return (
            <div className="w-full flex flex-col items-center bg-slate-100 dark:bg-zinc-900/50 rounded-2xl p-2 sm:p-4 border border-slate-200 dark:border-zinc-800 shadow-inner group">
                <div className="w-full flex justify-end gap-2 mb-3">
                    <button 
                        onClick={() => setViewMode(viewMode === 'fit' ? 'portrait' : 'fit')}
                        className="px-4 py-1.5 bg-white dark:bg-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:border-primary-500 transition-all shadow-sm"
                    >
                        {viewMode === 'fit' ? 'Switch to Portrait' : 'Back to Fit Width'}
                    </button>
                </div>
                <div className={`w-full transition-all duration-500 ease-in-out ${viewMode === 'portrait' ? 'max-w-[550px]' : 'max-w-5xl'} h-[85vh] min-h-[500px] bg-white dark:bg-zinc-800 rounded-xl shadow-2xl overflow-hidden border border-slate-300 dark:border-zinc-700 relative`}>
                    <object
                        data={`${blobUrl}#navpanes=0&toolbar=0&view=${viewMode === 'portrait' ? 'Fit' : 'FitH'}`}
                        type="application/pdf"
                        className="w-full h-full"
                    >
                        <iframe src={`${blobUrl}#navpanes=0&toolbar=0&view=${viewMode === 'portrait' ? 'Fit' : 'FitH'}`} className="w-full h-full border-none" title="PDF Preview"></iframe>
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center bg-white dark:bg-zinc-800">
                            <DocumentIcon className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-bold mb-2">Browser Preview Unavailable</p>
                            <p className="text-sm mb-4">Your browser doesn't support direct PDF embedding.</p>
                            <a href={blobUrl} download={file.name} className="px-5 py-2 bg-primary-600 text-white rounded-lg font-bold shadow-md hover:bg-primary-700 transition-all">
                                Download to view
                            </a>
                        </div>
                    </object>
                </div>
            </div>
        );
    }

    // ─── DOCX Preview (Part 2: High-fidelity DOCX rendering via mammoth.js) ──
    if (isDocx) {
        return <DocxPreview file={file} activeUrl={activeUrl} />;
    }

    return (
        <div className="text-center p-12 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-dashed border-slate-200 shadow-sm w-full flex flex-col items-center justify-center min-h-[400px]">
            <div className="p-5 bg-slate-50 dark:bg-zinc-900 rounded-full mb-4"><DocumentIcon className="w-10 h-10 text-slate-400" /></div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{file.name}</h3>
            <p className="text-sm text-slate-500 mb-6">Preview unavailable for this format.</p>
            <a href={activeUrl} download={file.name} className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all">
                <DownloadIcon className="w-5 h-5" /> Download for Full Access
            </a>
        </div>
    );
};

// ─── DOCX Preview Component (Part 2) ─────────────────────────────────
// Uses mammoth.js to convert .docx → HTML for in-app preview.
// Renders with professional document CSS: Times New Roman, proper
// margins, page-like white sheet, and responsive width.
const DocxPreview: React.FC<{ file: any; activeUrl: string }> = ({ file, activeUrl }) => {
    const [html, setHtml] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const loadDocx = async () => {
            try {
                setLoading(true);
                setError(null);
                // Fetch the file as ArrayBuffer
                const response = await fetch(activeUrl);
                const arrayBuffer = await response.arrayBuffer();
                // Use mammoth to convert to HTML
                const mammoth = await import('mammoth');
                const result = await mammoth.convertToHtml({ arrayBuffer });
                if (!cancelled && result.value) {
                    setHtml(result.value);
                }
            } catch (e: any) {
                if (!cancelled) {
                    console.error('[DocxPreview] mammoth conversion failed:', e);
                    setError(e.message || 'Could not preview this document.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        if (activeUrl) loadDocx();
        return () => { cancelled = true; };
    }, [activeUrl]);

    if (loading) {
        return (
            <div className="w-full min-h-[400px] bg-white dark:bg-zinc-800 rounded-xl shadow-lg flex flex-col items-center justify-center border border-slate-200">
                <div className="relative w-12 h-12 mb-4">
                    <div className="absolute inset-0 border-4 border-slate-100 dark:border-zinc-700 rounded-full" />
                    <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin" />
                </div>
                <p className="text-slate-500 font-medium text-sm">Converting document for preview…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-12 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-dashed border-slate-200 shadow-sm w-full flex flex-col items-center justify-center min-h-[400px]">
                <div className="p-5 bg-slate-50 dark:bg-zinc-900 rounded-full mb-4"><DocumentIcon className="w-10 h-10 text-slate-400" /></div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{file.name}</h3>
                <p className="text-sm text-slate-500 mb-6">Preview unavailable: {error}</p>
                <a href={activeUrl} download={file.name} className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all">
                    <DownloadIcon className="w-5 h-5" /> Download for Full Access
                </a>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div
                className="bg-white dark:bg-white rounded-xl shadow-lg border border-slate-200 overflow-x-auto mx-auto"
                style={{ maxWidth: '210mm', minHeight: '297mm', padding: '25mm 25mm 20mm 25mm' }}
            >
                <div
                    className="prose prose-sm max-w-none text-slate-900"
                    style={{
                        fontFamily: "'Times New Roman', serif",
                        fontSize: '12pt',
                        lineHeight: '1.5',
                    }}
                    dangerouslySetInnerHTML={{ __html: html || '<p>No content.</p>' }}
                />
            </div>
        </div>
    );
};

const DocumentDetailViewContent: React.FC = () => {
    const { selectedId, openModal, navigateTo, currentHistoryEntry } = useUI();
    const { documentState, documentActions } = useDocumentState();
    const { coreState } = useCoreState();
    const { currentUser } = useAuth();
    const { handleRunDocumentAnalysis } = useDataActions();
    const { isProperty } = useProduct();

    const document = React.useMemo(() => documentState.documents.find(d => d.id === selectedId), [documentState.documents, selectedId]);

    // ─── ALL HOOKS MUST RUN BEFORE ANY EARLY RETURN ──────────────────
    // Previously, useState was called AFTER the `if (!document) return`
    // guard, which caused a React Hooks violation ("Rendered more hooks
    // than during the previous render") when the document went from
    // undefined → defined. This crashed the /documents page on refresh
    // with a stale/deleted ID. Now all hooks run first, then the guard.
    const [activeTab, setActiveTab] = useState<'details' | 'analysis' | 'litigation'>(isProperty ? 'details' : 'details');

    // ─── Null-state guard ─────────────────────────────────────────────
    // If no document is selected or the ID is stale/deleted, show a safe
    // empty state instead of crashing. This handles:
    //   - Direct navigation to /documents with no id
    //   - Refresh with no id
    //   - Refresh with a stale/deleted id
    if (!document || !selectedId) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-600 p-8 text-center">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg font-medium text-slate-500 dark:text-zinc-400 mb-1">No Document Selected</p>
                <p className="text-sm text-slate-400 dark:text-zinc-500">Select a document from the list to preview its contents or open it in DraftPro.</p>
            </div>
        );
    }

    const previousViewName = (currentHistoryEntry?.previousView as string) || 'documents';
    const onGoBack = () => navigateTo((previousViewName as any) || 'documents');

    const handleRunAnalysis = async () => {
        if (currentUser?.email === 'demo@practicepro.ng') {
            openModal('demoUpsell', null, { context: 'aldia' });
            return;
        }
        await handleRunDocumentAnalysis(document.id);
        setActiveTab('analysis');
    };

    const isLocal = document.firmId === 'local';

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-900 overflow-hidden">
            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex justify-between items-center z-10 shadow-sm">
                <div className="min-w-0 flex-1 mr-4">
                    <Breadcrumbs items={[{ label: previousViewName === 'matters' ? 'Matter' : 'Documents', onClick: onGoBack }, { label: document.title || 'Untitled Document' }]} />
                    {document.isCourtProcess && (
                        <div className="mt-1 flex items-center gap-2">
                            <Tooltip text="This document is part of a formal court process.">
                                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest border border-indigo-200 dark:border-indigo-800 rounded-md">Court Process</span>
                            </Tooltip>
                        </div>
                    )}
                </div>
                {!isLocal && (
                    <div className="flex flex-col items-end gap-2">
                        {document.isCourtProcess && (
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">Update Status</span>
                                <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-xl p-1 border border-slate-200 dark:border-zinc-700 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary-500/20">
                                    <Tooltip text="Document is still being drafted">
                                        <button
                                            onClick={() => documentActions.updateDocument({ ...document, litigationStatus: 'draft' })}
                                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${document.litigationStatus === 'draft' || !document.litigationStatus ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                                        >
                                            Draft
                                        </button>
                                    </Tooltip>
                                    <Tooltip text="Formally filed with the court">
                                        <button
                                            onClick={() => documentActions.updateDocument({ ...document, litigationStatus: 'filed' })}
                                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${document.litigationStatus === 'filed' ? 'bg-white dark:bg-zinc-700 text-orange-600 shadow-sm border border-orange-100 dark:border-orange-900/50' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                                        >
                                            Filed
                                        </button>
                                    </Tooltip>
                                    <Tooltip text="Served on the opposing party">
                                        <button
                                            onClick={() => documentActions.updateDocument({ ...document, litigationStatus: 'served' })}
                                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${document.litigationStatus === 'served' ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm border border-blue-100 dark:border-blue-900/50' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                                        >
                                            Served
                                        </button>
                                    </Tooltip>
                                    <Tooltip text="Proof of Service Filed">
                                        <button
                                            onClick={() => documentActions.updateDocument({ ...document, litigationStatus: 'acknowledged' })}
                                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${document.litigationStatus === 'acknowledged' ? 'bg-white dark:bg-zinc-700 text-green-600 shadow-sm border border-green-100 dark:border-green-900/50' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                                        >
                                            Proof of Service
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <Tooltip text="Edit Document Metadata">
                                <button onClick={() => openModal('editDocument', document.id)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 transition-colors"><EditIcon className="w-5 h-5" /></button>
                            </Tooltip>
                            <button onClick={() => openModal('shareDocument', document.id)} className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-black shadow-lg shadow-primary-500/20 transition-all active:scale-95">Share</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-grow overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex gap-4 border-b border-slate-200 dark:border-zinc-700">
                        <button onClick={() => setActiveTab('details')} className={`pb-3 border-b-2 font-bold text-sm ${activeTab === 'details' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}>Preview</button>
                        {document.isCourtProcess && (
                            <button onClick={() => setActiveTab('litigation')} className={`pb-3 border-b-2 font-bold text-sm flex items-center gap-2 ${activeTab === 'litigation' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}>
                                {isProperty ? 'Operational Pipeline' : 'Litigation Pipeline'}
                            </button>
                        )}
                        <button onClick={() => setActiveTab('analysis')} className={`pb-3 border-b-2 font-bold text-sm flex items-center gap-2 ${activeTab === 'analysis' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}>
                            {isProperty ? 'Document' : 'ALDIA'} Analysis {document.analysisState === 'pending' && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
                        </button>
                    </div>

                    {activeTab === 'details' ? (
                        document.content ? (
                            <div className="bg-white dark:bg-zinc-800 rounded-xl p-8 border border-slate-200 shadow-lg prose dark:prose-invert max-w-none custom-scrollbar overflow-y-auto max-h-[80vh]">
                                <div dangerouslySetInnerHTML={{ __html: sanitize(document.content) }} />
                            </div>
                        ) : (
                            <FileViewer file={document.file} />
                        )
                    ) : activeTab === 'litigation' ? (
                        <div className="space-y-8 animate-fade-in py-6">
                            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-8 border border-slate-200 dark:border-zinc-700 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-primary-600"></div>
                                <div className="mb-6">
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <ScalesIcon className="w-6 h-6 text-primary-600" /> {isProperty ? 'Operational Progress Tracker' : 'Litigation Progress Tracker'}
                                    </h3>
                                    <p className="text-sm text-slate-500">{isProperty ? 'Track and manage the official lifecycle for this document.' : 'Track and manage the official filing and service lifecycle for this process.'}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                    {[
                                        { id: 'draft', label: '1. Preparation', desc: isProperty ? 'Drafting & review' : 'Drafting & internal review', color: 'slate' },
                                        { id: 'filed', label: isProperty ? '2. Execution' : '2. Filing', desc: isProperty ? 'Signed by parties' : 'E-filing or Court Registry', color: 'orange' },
                                        { id: 'served', label: isProperty ? '3. Exchange' : '3. Service', desc: isProperty ? 'Delivered to parties' : 'Served on Respondents', color: 'blue' },
                                        { id: 'acknowledged', label: isProperty ? '4. Finalized' : '4. Proof', desc: isProperty ? 'Record archived' : 'Proof of Service Filed', color: 'green' }
                                    ].map((step, idx) => {
                                        const isCurrent = (document.litigationStatus || 'draft') === step.id;
                                        const isPast = (() => {
                                            const order = ['draft', 'filed', 'served', 'acknowledged'];
                                            return order.indexOf(document.litigationStatus || 'draft') > idx;
                                        })();

                                        return (
                                            <div key={step.id} className="relative">
                                                <div className={`p-4 rounded-xl border-2 transition-all ${isCurrent ? `bg-${step.color}-50 dark:bg-${step.color}-900/20 border-${step.color}-500 shadow-md` :
                                                    isPast ? `bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-700 opacity-60` :
                                                        `bg-white dark:bg-zinc-800 border-dashed border-slate-200 dark:border-zinc-700`
                                                    }`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? `text-${step.color}-600 dark:text-${step.color}-400` : 'text-slate-400'}`}>Step {idx + 1}</span>
                                                        {isPast && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
                                                    </div>
                                                    <h5 className={`font-bold text-sm mb-1 ${isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{step.label}</h5>
                                                    <p className="text-[10px] leading-tight text-slate-500">{step.desc}</p>
                                                    <button
                                                        onClick={() => documentActions.updateDocument({ ...document, litigationStatus: step.id as any })}
                                                        className={`mt-3 w-full py-1.5 text-[10px] font-bold rounded-lg transition-all ${isCurrent ? `bg-${step.color}-600 text-white` : `bg-slate-100 dark:bg-zinc-700 text-slate-600 hover:bg-slate-200 dark:hover:bg-zinc-600`}`}
                                                    >
                                                        {isCurrent ? 'Current Stage' : isPast ? 'Revert to Stage' : 'Mark as Done'}
                                                    </button>
                                                </div>
                                                {idx < 3 && (
                                                    <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                                                        <ChevronRightIcon className={`w-6 h-6 ${isPast ? 'text-primary-500' : 'text-slate-200 dark:text-zinc-700'}`} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800/50 flex items-start gap-3">
                                    <SparklesIcon className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h6 className="text-xs font-bold text-primary-900 dark:text-primary-100 mb-1">{isProperty ? 'Manager Tip' : 'Litigation Lawyer Tip'}</h6>
                                        <p className="text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
                                            {isProperty 
                                                ? 'Marking a document as Finalized helps PracticePro track the next steps in your portfolio workflow automatically.'
                                                : 'Marking a document as Served helps PracticePro track deadlines for the respondent\'s Memorandum of Appearance and Statement of Defence automatically in your calendar.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-fade-in pb-20">
                            {/* Analysis Header State */}
                            {!document.analysisState || document.analysisState === 'failed' ? (
                                <div className="bg-white dark:bg-zinc-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-zinc-700 shadow-sm">
                                    <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <SparklesIcon className="w-8 h-8 text-primary-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{isProperty ? 'Advanced Property Document Intelligence' : 'Advanced Legal Document Intelligence'}</h3>
                                    <p className="text-slate-500 dark:text-zinc-400 max-w-md mx-auto mb-8">
                                        Let {isProperty ? 'ARIA' : 'ALDIA'} analyze this document for risks, extract key dates, and ensure compliance with {isProperty ? 'industry' : 'Nigerian'} regulations.
                                    </p>
                                    <button
                                        onClick={handleRunAnalysis}
                                        className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-500/20 transition-all flex items-center gap-2 mx-auto"
                                    >
                                        <SparklesIcon className="w-5 h-5" />
                                        {document.analysisState === 'failed' ? (isProperty ? 'Retry Analysis' : 'Retry ALDIA Analysis') : (isProperty ? 'Run Analysis' : 'Run ALDIA Analysis')}
                                    </button>
                                </div>
                            ) : document.analysisState === 'pending' ? (
                                <div className="bg-white dark:bg-zinc-800 rounded-2xl p-16 text-center border border-slate-200 dark:border-zinc-700 shadow-sm">
                                    <div className="relative w-20 h-20 mx-auto mb-8">
                                        <div className="absolute inset-0 border-4 border-primary-100 dark:border-zinc-700 rounded-full"></div>
                                        <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <SparklesIcon className="w-8 h-8 text-primary-600 animate-pulse" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{isProperty ? 'AI is Analyzing...' : 'ALDIA is Analyzing...'}</h3>
                                    <p className="text-slate-500 dark:text-zinc-400">This usually takes 15-30 seconds depending on document length.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Left Column: Summary & Metadata */}
                                        <div className="lg:col-span-2 space-y-6">
                                            {/* Executive Summary */}
                                            <section className="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-slate-200 dark:border-zinc-700 shadow-sm">
                                                <div className="flex items-center gap-2 mb-4 text-primary-600">
                                                    <DocumentIcon className="w-5 h-5" />
                                                    <h4 className="font-bold">Executive Summary</h4>
                                                </div>
                                                <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                                                    {document.summary}
                                                </p>
                                            </section>

                                            {/* Extracted Metadata */}
                                            <section className="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-slate-200 dark:border-zinc-700 shadow-sm">
                                                <div className="flex items-center gap-2 mb-6 text-primary-600">
                                                    <ClockIcon className="w-5 h-5" />
                                                    <h4 className="font-bold">Key Intelligence & Metadata</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-700">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Contract Type</span>
                                                        <span className="text-slate-900 dark:text-white font-medium">{document.extractedMetadata?.contractType || 'Unspecified'}</span>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-700">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Governing Law</span>
                                                        <span className="text-slate-900 dark:text-white font-medium">{document.extractedMetadata?.governingLaw || 'Unspecified'}</span>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-700">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Effective Date</span>
                                                        <span className="text-slate-900 dark:text-white font-medium">{document.extractedMetadata?.effectiveDate || 'N/A'}</span>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-700">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Expiration Date</span>
                                                        <span className="text-slate-900 dark:text-white font-medium">{document.extractedMetadata?.expirationDate || 'N/A'}</span>
                                                    </div>
                                                </div>

                                                <div className="mt-6">
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Parties Involved</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {document.extractedMetadata?.partiesInvolved?.map((party, idx) => (
                                                            <span key={idx} className="px-3 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-full text-sm font-medium text-slate-700 dark:text-zinc-300">
                                                                {party}
                                                            </span>
                                                        )) || <span className="text-xs text-slate-400 italic">None detected</span>}
                                                    </div>
                                                </div>
                                            </section>

                                            {/* High Risk Clauses */}
                                            {document.riskAnalysis?.highRiskClauses && document.riskAnalysis.highRiskClauses.length > 0 && (
                                                <section className="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-slate-200 dark:border-zinc-700 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-4 text-red-600">
                                                        <InfoIcon className="w-5 h-5" />
                                                        <h4 className="font-bold">Alert: High Risk Clauses Identified</h4>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {document.riskAnalysis.highRiskClauses.map((clause, idx) => (
                                                            <div key={idx} className="p-4 bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 rounded-r-xl">
                                                                <p className="text-sm font-bold text-red-900 dark:text-red-400 mb-1">Clause Segment:</p>
                                                                <p className="text-sm text-red-800 dark:text-red-300 italic mb-2">"{clause.clause}"</p>
                                                                <p className="text-sm font-bold text-red-900 dark:text-red-400 mb-1">Issue:</p>
                                                                <p className="text-sm text-red-800 dark:text-red-300">{clause.summary}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            )}
                                        </div>

                                        {/* Right Column: Score & Compliance */}
                                        <div className="space-y-6">
                                            {/* Overall Risk Score */}
                                            <section className="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-slate-200 dark:border-zinc-700 shadow-sm text-center">
                                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Risk Profile Score</h4>
                                                <div className="inline-flex items-center justify-center p-6 rounded-full bg-slate-50 dark:bg-zinc-900 mb-4 border-4 border-slate-100 dark:border-zinc-800 relative">
                                                    <span className={`text-4xl font-black ${(document.riskAnalysis?.overallRiskScore || 0) > 7 ? 'text-red-600' :
                                                        (document.riskAnalysis?.overallRiskScore || 0) > 4 ? 'text-orange-500' : 'text-green-500'
                                                        }`}>
                                                        {document.riskAnalysis?.overallRiskScore || 0}
                                                    </span>
                                                    <span className="text-slate-400 font-bold text-xl ml-1">/10</span>
                                                </div>
                                                <p className="text-sm text-slate-500 dark:text-zinc-400 px-4">
                                                    {document.riskAnalysis?.justification}
                                                </p>
                                            </section>

                                            {/* RPC Compliance Shield */}
                                            <section className={`rounded-2xl p-6 border shadow-sm ${document.rpcReview?.status === 'approved'
                                                ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                                                : 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                                                }`}>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <ShieldCheckIcon className={`w-5 h-5 ${document.rpcReview?.status === 'approved' ? 'text-green-600' : 'text-orange-600'}`} />
                                                    <h4 className={`font-bold ${document.rpcReview?.status === 'approved' ? 'text-green-800 dark:text-green-400' : 'text-orange-800 dark:text-orange-400'}`}>{isProperty ? 'Compliance Shield' : 'RPC Compliance'}</h4>
                                                </div>
                                                <p className="text-sm text-slate-700 dark:text-zinc-300 mb-2">
                                                    {document.rpcReview?.commentary || (isProperty ? 'Analysis pending verified compliance check.' : 'Analysis pending verified RPC check.')}
                                                </p>
                                                <div className="flex items-center gap-1.5 py-1 px-3 bg-white dark:bg-zinc-800 rounded-full w-fit border border-green-100 dark:border-green-900">
                                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                                    <span className="text-[10px] font-black uppercase text-green-600 tracking-tighter">Verified Agent</span>
                                                </div>
                                            </section>

                                            {/* Data Protection */}
                                            <section className="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-slate-200 dark:border-zinc-700 shadow-sm">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <CheckBadgeIcon className="w-5 h-5 text-primary-600" />
                                                    <h4 className="font-bold">NDPA Privacy Shield</h4>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-500">Privacy Risk Level:</span>
                                                        <span className={`font-bold ${document.dataProtectionAnalysis?.overallRiskLevel === 'High' ? 'text-red-500' :
                                                            document.dataProtectionAnalysis?.overallRiskLevel === 'Medium' ? 'text-orange-500' : 'text-green-500'
                                                            }`}>
                                                            {document.dataProtectionAnalysis?.overallRiskLevel || 'Pending'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-400 uppercase block mb-2">Detected Nigerian PII</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {document.dataProtectionAnalysis?.identifiedPii?.map((pii, idx) => (
                                                                <span key={idx} className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-900 rounded text-[10px] text-slate-600 dark:text-zinc-400 font-bold border border-slate-200 dark:border-zinc-700">
                                                                    {pii}
                                                                </span>
                                                            )) || <span className="text-xs text-slate-400 italic">None detected</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bidirectional backlinks — notes that mention this document */}
                    {document && (
                        <BacklinksPanel
                            entityId={document.id}
                            entityType="document"
                            entityLabel={document.title}
                            notes={documentState.notePages || []}
                            navigateTo={navigateTo}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export const DocumentDetailView: React.FC = () => (
    <ErrorBoundary>
        <DocumentDetailViewContent />
    </ErrorBoundary>
);

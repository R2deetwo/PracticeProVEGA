
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppMode } from '../../types';
import type { Document, User, FirmDetails, ModalType, View, ServiceEvent, ServiceMethod, ComputedDeadlineRef } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useProduct } from '../../contexts/ProductContext';
import { useDataActions } from '../../contexts/DataContext';
import { useMatterState } from '../../contexts/MatterContext';
import { computeServiceDeadlines, courtJurisdictionProfile } from '../../legal/cprWindows';
import { v4 as uuidv4 } from 'uuid';
import { DownloadIcon, DocumentIcon, EditIcon, ShieldCheckIcon, GavelIconLarge, LockClosedIcon, CheckCircleIcon, SparklesIcon, InfoIcon, CheckBadgeIcon, ClockIcon, ScalesIcon, ChevronRightIcon, ArrowsExpandIcon } from '../../constants'; // Fixed path
import { Breadcrumbs } from '../Breadcrumbs';
import Tooltip from '../Tooltip';
import { Button, Input, Select } from '../ui';
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { sanitize } from "../../utils/sanitization";
import { buildVersionSnapshot, capVersions, chronologicalVersions } from "../../utils/documentVersions";
import { useConfirm } from "../ui/ConfirmDialog";
import ErrorBoundary from '../ErrorBoundary';
import PdfViewer from '../documents/PdfViewer';
import HtmlPagePreview from '../documents/HtmlPagePreview';
import DocumentPreviewModal from '../documents/DocumentPreviewModal';

import { Skeleton } from '../ui/Skeleton';
const FileViewer: React.FC<{ file: any }> = ({ file }) => {
    // V1-A (SEC-5): forward the verified bearer — getFileUrl is
    // session-scoped server-side now.
    const { bearerToken } = useAuth();
    const storageUrl = useQuery(api.myFunctions.getFileUrl, file?.storageId ? { storageId: file.storageId, sessionToken: (bearerToken ?? undefined) } : "skip");
    const lastUrlRef = React.useRef<string | null>(null);
    const blobUrlRef = React.useRef<string | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    const activeUrl = file?.dataUrl || (storageUrl as string) || lastUrlRef.current;

    // Persist last valid URL to prevent query flicker/blank screen
    useEffect(() => {
        if (file?.dataUrl || (storageUrl as string)) {
            lastUrlRef.current = file?.dataUrl || (storageUrl as string);
        }
    }, [file?.dataUrl, storageUrl]);

    useEffect(() => {
        if (!activeUrl || file?.type !== 'application/pdf') return;

        let cancelled = false;
        const abortController = new AbortController();

        // Revoke the previous blob URL so we don't leak memory when the
        // underlying file changes (rapid tab switches, file replacements, etc.)
        if (blobUrlRef.current) {
            try {
                URL.revokeObjectURL(blobUrlRef.current);
            } catch {
                /* noop */
            }
            blobUrlRef.current = null;
        }

        if (activeUrl.startsWith('blob:')) {
            // Already a blob URL — no fetch needed
            if (!cancelled) setBlobUrl(activeUrl);
        } else if (activeUrl.startsWith('data:') || activeUrl.startsWith('http')) {
            fetch(activeUrl, { signal: abortController.signal })
                .then(res => res.blob())
                .then(blob => {
                    if (cancelled) return; // race: a newer fetch was triggered
                    const url = URL.createObjectURL(blob);
                    blobUrlRef.current = url;
                    setBlobUrl(url);
                })
                .catch(e => {
                    if (cancelled || abortController.signal.aborted) return;
                    console.error("Error creating blob from URL", e);
                    // Fall back to the raw URL — let the PdfViewer try to load it
                    setBlobUrl(activeUrl);
                });
        }

        return () => {
            cancelled = true;
            abortController.abort();
        };
    }, [activeUrl, file?.type]);

    // Cleanup blob URL on unmount
    useEffect(() => {
        return () => {
            if (blobUrlRef.current) {
                try {
                    URL.revokeObjectURL(blobUrlRef.current);
                } catch {
                    /* noop */
                }
                blobUrlRef.current = null;
            }
        };
    }, []);

    const handleDownload = () => {
        if (!file) return;
        const link = document.createElement('a');
        link.href = blobUrl || activeUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
            <div className="w-full h-[80vh] min-h-[600px] bg-white dark:bg-zinc-800 rounded-lg shadow-lg flex flex-col items-center justify-center border border-slate-200">
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
            <div className="flex justify-center bg-white dark:bg-zinc-800 rounded-lg p-4 border border-slate-200 shadow-lg">
                <img src={activeUrl} alt={file.name} className="max-w-full max-h-[75vh] object-contain rounded" />
            </div>
        );
    }

    if (isPdf && blobUrl) {
        return (
            <div className="flex-1 flex flex-col bg-slate-100 dark:bg-zinc-900/50 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800 h-[80vh] min-h-[600px]">
                <PdfViewer
                    fileUrl={blobUrl}
                    title={file.name}
                    onDownload={handleDownload}
                />
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
            <a href={activeUrl} download={file.name} className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all">
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
            <div className="w-full min-h-[400px] bg-white dark:bg-zinc-800 rounded-lg shadow-lg flex flex-col items-center justify-center border border-slate-200">
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
                <a href={activeUrl} download={file.name} className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all">
                    <DownloadIcon className="w-5 h-5" /> Download for Full Access
                </a>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-zinc-900/50 rounded-lg p-2 sm:p-4 custom-scrollbar">
            {/* MOBILE AUDIT (2026-11-28): the sheet REFLOWS on phones
                (max-width, not a fixed A4) — but its padding stayed at a
                hardcoded 25mm (~95px) per side, which crushed a 360px
                viewport's readable column to ~140px. Inside mammoth-converted
                DOCX layouts (court letterheads, nested tables) that squeezed
                cells to a couple of characters — titles rendered one letter
                per line. padding is now min(25mm, 5vw): full A4 margins on
                desktop, phone-appropriate margins (~18px) on narrow screens,
                and table cells keep readable multi-word lines. */}
            <div
                className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl border border-slate-200 mx-auto"
                style={{ maxWidth: '210mm', minHeight: '297mm', padding: 'min(25mm, 5vw)' }}
            >
                <style>{`
                    .docx-preview h1 { font-size: 16pt; font-weight: bold; margin: 16pt 0 8pt; }
                    .docx-preview h2 { font-size: 14pt; font-weight: bold; margin: 14pt 0 6pt; }
                    .docx-preview h3 { font-size: 12pt; font-weight: bold; margin: 12pt 0 4pt; }
                    .docx-preview p { margin: 0 0 8pt; text-align: justify; }
                    .docx-preview ul, .docx-preview ol { margin: 0 0 8pt; padding-left: 20pt; }
                    .docx-preview li { margin-bottom: 4pt; }
                    .docx-preview table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
                    .docx-preview td, .docx-preview th { border: 1px solid #ccc; padding: 4pt 8pt; overflow-wrap: break-word; }
                    .docx-preview th { background: #f5f5f5; font-weight: bold; }
                    .docx-preview strong { font-weight: bold; }
                    .docx-preview em { font-style: italic; }
                    .docx-preview sup { font-size: 0.7em; vertical-align: super; }
                `}</style>
                <div
                    className="docx-preview"
                    style={{
                        fontFamily: "'Times New Roman', serif",
                        fontSize: '12pt',
                        lineHeight: '1.5',
                        color: '#1a1a1a',
                    }}
                    dangerouslySetInnerHTML={{ __html: sanitize(html) || '<p>No content.</p>' }}
                />
            </div>
        </div>
    );
};

const DocumentDetailViewContent: React.FC = () => {
    const { selectedId, openModal, navigateTo, currentHistoryEntry, goBack } = useUI();
    const { documentState, documentActions } = useDocumentState();
    const { coreState } = useCoreState();
    const { currentUser } = useAuth();
    const { handleRunDocumentAnalysis, addItem } = useDataActions();
    const { matterState } = useMatterState();
    const { addToast } = useUI();
    const { isProperty } = useProduct();
    const { confirm: confirmDialog } = useConfirm();

    const document = React.useMemo(() => documentState.documents.find(d => d.id === selectedId), [documentState.documents, selectedId]);

    // ─── ALL HOOKS MUST RUN BEFORE ANY EARLY RETURN ──────────────────
    // Previously, useState was called AFTER the `if (!document) return`
    // guard, which caused a React Hooks violation ("Rendered more hooks
    // than during the previous render") when the document went from
    // undefined → defined. This crashed the /documents page on refresh
    // with a stale/deleted ID. Now all hooks run first, then the guard.
    const [activeTab, setActiveTab] = useState<'details' | 'analysis' | 'litigation' | 'history'>('details');
    const [showFullScreenPreview, setShowFullScreenPreview] = useState(false);

    // ─── Litigation lifecycle capture (2026-11-22 — "how does the app know
    //     when a document was served?"): marking a court process FILED or
    //     SERVED opens a small event-capture form (date, method, proof); the
    //     recorded SERVICE date then drives the Civil Procedure Rules
    //     deadline engine (src/legal/cprWindows.ts) — computed windows with
    //     the governing rule cited on every entry, tracked as a task + a
    //     calendar event (idempotent via document.computedDeadlines). ────
    const [captureStep, setCaptureStep] = useState<'filed' | 'served' | null>(null);
    const [savingEvent, setSavingEvent] = useState(false);
    const todayIso = () => new Date().toISOString().slice(0, 10);
    const [filingForm, setFilingForm] = useState({ date: todayIso(), receiptNumber: '' });
    const [serviceForm, setServiceForm] = useState<{ date: string; method: ServiceMethod; servedOn: string; proofNote: string }>({ date: todayIso(), method: 'personal', servedOn: '', proofNote: '' });
    const [manualDeadline, setManualDeadline] = useState({ label: '', date: '' });

    // The matter this process belongs to — its COURT selects the CPR windows.
    const matter = React.useMemo(
        () => (document?.matterId ? matterState.matters.find(m => m.id === document.matterId) : undefined),
        [matterState.matters, document?.matterId]
    );
    const court = matter?.court || '';

    // Reset tab to 'details' and close full-screen preview whenever the
    // selected document changes. Also resets activeTab if the litigation
    // tab is active but the new document isn't a court process.
    useEffect(() => {
        setShowFullScreenPreview(false);
        setActiveTab('details');
    }, [selectedId]);

    // ─── Null-state guard ─────────────────────────────────────────────
    // If no document is selected or the ID is stale/deleted, show a safe
    // empty state instead of crashing. This handles:
    //   - Direct navigation to /documents with no id
    //   - Refresh with no id
    //   - Refresh with a stale/deleted id
    if (!document || !selectedId) {
        // CRO AUDIT FIX — show loading skeleton if selectedId exists but document
        // hasn't loaded yet. Only show "No Document Selected" if there's truly no ID.
        if (selectedId) {
            return (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                    <div className="w-full max-w-3xl space-y-4">
                        <Skeleton variant="text" className="h-8 w-1/4" />
                        <Skeleton variant="text" className="h-64" />
                    </div>
                    <p className="text-sm text-slate-400 mt-4">Loading document…</p>
                </div>
            );
        }
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
    const onGoBack = () => goBack();

    const handleRunAnalysis = async () => {
        if (currentUser?.email === 'demo@practicepro.ng') {
            openModal('demoUpsell', null, { context: 'aldia' });
            return;
        }
        await handleRunDocumentAnalysis(document.id);
        setActiveTab('analysis');
    };

    const isLocal = document.firmId === 'local';

    // ─── Litigation lifecycle: FILED / SERVED event capture + CPR deadlines ──

    const handleStepClick = (stepId: string) => {
        if (isLocal) {
            // Local (unsynced) documents keep the plain status flip — the
            // event capture + deadline engine is a firm-data flow.
            documentActions.updateDocument({ ...document, litigationStatus: stepId as any });
            return;
        }
        if (stepId === 'filed') { setCaptureStep('filed'); setFilingForm(f => ({ ...f, date: f.date || todayIso() })); return; }
        if (stepId === 'served') { setCaptureStep('served'); setServiceForm(f => ({ ...f, date: f.date || todayIso() })); return; }
        documentActions.updateDocument({ ...document, litigationStatus: stepId as any });
    };

    const saveFilingEvent = async () => {
        if (!filingForm.date) { addToast('Enter the filing date.', { type: 'error' }); return; }
        try {
            setSavingEvent(true);
            await documentActions.updateDocument({
                ...document,
                litigationStatus: 'filed',
                dateFiled: filingForm.date,
                filing: { date: filingForm.date, receiptNumber: filingForm.receiptNumber.trim() || undefined, recordedAt: new Date().toISOString() },
            });
            setCaptureStep(null);
            addToast(`Filed ${new Date(filingForm.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}${filingForm.receiptNumber.trim() ? ` — receipt ${filingForm.receiptNumber.trim()}` : ''}.`, { type: 'success' });
        } catch (e) {
            addToast('Could not save the filing event.', { type: 'error' });
        } finally {
            setSavingEvent(false);
        }
    };

    const saveServiceEvent = async () => {
        if (!serviceForm.date) { addToast('Enter the service date.', { type: 'error' }); return; }
        try {
            setSavingEvent(true);
            const event: ServiceEvent = {
                id: uuidv4(),
                date: serviceForm.date,
                method: serviceForm.method,
                servedOn: serviceForm.servedOn.trim() || undefined,
                proofNote: serviceForm.proofNote.trim() || undefined,
                recordedAt: new Date().toISOString(),
                recordedBy: currentUser?.email,
            };
            const serviceEvents = [...(document.serviceEvents || []), event];

            // Compute the CPR windows from the service date under the
            // matter's court — verified windows only, citation on each.
            const computed = computeServiceDeadlines({ court, fromDate: serviceForm.date });
            const existing = document.computedDeadlines || [];
            const newWindows = computed.filter(c => !existing.some(x => x.windowId === c.window.id));
            const freshRefs: ComputedDeadlineRef[] = [];
            for (const c of newWindows) {
                // Track each NEW window as a task + a Filing Deadline calendar
                // event (idempotent: refs are stored on the document).
                let taskRef: string | undefined;
                let eventRef: string | undefined;
                try {
                    const task = await addItem('tasks', {
                        id: uuidv4(),
                        title: `${c.window.action} — ${document.title || 'court process'}`,
                        description: `${c.note} Governing rule: ${c.window.citation}. Recorded from the service of this process on ${new Date(serviceForm.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}${serviceForm.servedOn.trim() ? ` on ${serviceForm.servedOn.trim()}` : ''}. Verify before relying.`,
                        status: 'todo',
                        priority: 'High',
                        dueDate: c.dueDate,
                        assignedUsers: document.assignedUsers || matter?.assignedUsers || [],
                        matterId: document.matterId || undefined,
                        createdAt: new Date().toISOString(),
                        creatorId: currentUser?.id || currentUser?.email || 'system',
                    }, 'Deadline task');
                    taskRef = task?.id;
                    const calEvent = await addItem('events', {
                        id: uuidv4(),
                        title: `${c.window.action} (${matter?.suitNumber || matter?.title || document.title || 'matter'})`,
                        type: 'Filing Deadline',
                        status: 'Active',
                        date: c.dueDate,
                        matterId: document.matterId || undefined,
                        matterTitle: matter?.title,
                        description: `${c.note} Governing rule: ${c.window.citation}.`,
                        assignedUsers: document.assignedUsers || [],
                        reminder: { value: 7, unit: 'days' },
                    }, 'Deadline event');
                    eventRef = calEvent?.id;
                } catch (e) {
                    // The deadline entry still records even if tracking fails.
                    console.warn('[cprWindows] deadline tracking failed', e);
                }
                freshRefs.push({ windowId: c.window.id, fromDate: serviceForm.date, dueDate: c.dueDate, citation: c.window.citation, taskRef, eventRef });
            }

            const computedDeadlines = [
                ...existing.map(x => {
                    const live = computed.find(c => c.window.id === x.windowId);
                    return live && live.dueDate !== x.dueDate ? { ...x, dueDate: live.dueDate } : x;
                }),
                ...freshRefs,
            ];
            await documentActions.updateDocument({
                ...document,
                litigationStatus: 'served',
                serviceEvents,
                computedDeadlines,
            });
            setCaptureStep(null);
            if (newWindows.length > 0) {
                addToast(`Service recorded. ${newWindows.length} deadline${newWindows.length > 1 ? 's' : ''} computed under the ${courtJurisdictionProfile(court).label} rules and added to your calendar.`, { type: 'success' });
            } else if (computed.length === 0 && existing.length === 0) {
                addToast('Service recorded. No built-in rule window for this court yet — add the deadline manually below.', { type: 'info' });
            } else {
                addToast('Service recorded.', { type: 'success' });
            }
        } catch (e) {
            addToast('Could not save the service event.', { type: 'error' });
        } finally {
            setSavingEvent(false);
        }
    };

    const addManualDeadline = async () => {
        if (!manualDeadline.label.trim() || !manualDeadline.date) { addToast('Give the deadline a label and a date.', { type: 'error' }); return; }
        try {
            setSavingEvent(true);
            await addItem('tasks', {
                id: uuidv4(),
                title: `${manualDeadline.label.trim()} — ${document.title || 'court process'}`,
                status: 'todo',
                priority: 'High',
                dueDate: new Date(manualDeadline.date).toISOString(),
                assignedUsers: document.assignedUsers || matter?.assignedUsers || [],
                matterId: document.matterId || undefined,
                createdAt: new Date().toISOString(),
                creatorId: currentUser?.id || currentUser?.email || 'system',
            }, 'Deadline task');
            await addItem('events', {
                id: uuidv4(),
                title: `${manualDeadline.label.trim()} (${matter?.suitNumber || matter?.title || document.title || 'matter'})`,
                type: 'Filing Deadline',
                status: 'Active',
                date: new Date(manualDeadline.date).toISOString(),
                matterId: document.matterId || undefined,
                matterTitle: matter?.title,
                assignedUsers: document.assignedUsers || [],
            }, 'Deadline event');
            setManualDeadline({ label: '', date: '' });
            addToast('Deadline added to your tasks and calendar.', { type: 'success' });
        } catch (e) {
            addToast('Could not add the deadline.', { type: 'error' });
        } finally {
            setSavingEvent(false);
        }
    };

    // The live deadline read-out: recomputed from the latest recorded event
    // so the panel always matches the document's stored data.
    const latestServiceEvent = document.serviceEvents?.length
        ? document.serviceEvents[document.serviceEvents.length - 1]
        : null;
    const liveDeadlines = useMemo(() => {
        if (!latestServiceEvent) return [];
        return computeServiceDeadlines({ court, fromDate: latestServiceEvent.date });
    }, [latestServiceEvent?.date, court]);
    const trackedWindowIds = new Set((document.computedDeadlines || []).map(d => d.windowId));
    const hasVerifiedCoverage = liveDeadlines.length > 0;

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-900 overflow-hidden">
            {/* MOBILE AUDIT (2026-11-28): the header row is wrap-friendly on
                phones — the edit/fullscreen/Share cluster keeps shrink-0 so
                it never clips, the title column stays min-w-0 (single-line
                breadcrumb), and the row collapses to a comfortable two-line
                stack instead of squeezing anything off the right edge. */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex flex-wrap justify-between items-center gap-y-2 z-10 shadow-sm">
                <div className="min-w-0 flex-1 mr-4 basis-full sm:basis-auto">
                    <Breadcrumbs items={[{ label: previousViewName === 'matters' ? 'Matter' : 'Documents', onClick: onGoBack }, { label: document.title || 'Untitled Document' }]} />
                    {document.isCourtProcess && (
                        <div className="mt-1 flex items-center gap-2">
                            <Tooltip text="This document is part of a formal court process.">
                                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-2xs font-black uppercase tracking-widest border border-indigo-200 dark:border-indigo-800 rounded-md">Court Process</span>
                            </Tooltip>
                        </div>
                    )}
                </div>
                {!isLocal && (
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        {document.isCourtProcess && (
                            <Tooltip text="View / update in the Pipeline tab">
                                <button
                                    onClick={() => setActiveTab('litigation')}
                                    className={`px-3 py-1.5 text-2xs font-black uppercase tracking-widest rounded-lg border transition-all ${
                                        document.litigationStatus === 'acknowledged' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                                        : document.litigationStatus === 'served' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                        : document.litigationStatus === 'filed' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                                    }`}
                                >
                                    {document.litigationStatus === 'acknowledged' ? 'Proof of Service' : document.litigationStatus === 'served' ? 'Served' : document.litigationStatus === 'filed' ? 'Filed' : 'Draft'} &rarr;
                                </button>
                            </Tooltip>
                        )}
                        <div className="flex items-center gap-2">
                            <Tooltip text="Edit Document Metadata">
                                <button onClick={() => openModal('editDocument', document.id)} className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 transition-colors"><EditIcon className="w-5 h-5" /></button>
                            </Tooltip>
                            {(document.content || document.file) && (
                                <Tooltip text="Open in immersive full-screen reader">
                                    <button
                                        onClick={() => {
                                            setActiveTab('details');
                                            setShowFullScreenPreview(true);
                                        }}
                                        className="p-2.5 rounded-lg bg-slate-900 dark:bg-zinc-900 hover:bg-slate-700 dark:hover:bg-zinc-700 text-white transition-colors flex items-center justify-center"
                                        aria-label="Full screen preview"
                                    >
                                        <ArrowsExpandIcon className="w-5 h-5" />
                                    </button>
                                </Tooltip>
                            )}
                            <button onClick={() => openModal('shareDocument', document.id)} className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-black shadow-lg shadow-primary-500/20 transition-all active:scale-95">Share</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-grow flex flex-col overflow-hidden">
                {/* Tab bar */}
                <div className="flex-shrink-0 flex gap-4 px-4 sm:px-8 pt-4 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-x-auto no-scrollbar whitespace-nowrap">
                    <button onClick={() => setActiveTab('details')} className={`flex-shrink-0 pb-3 border-b-2 font-bold text-sm ${activeTab === 'details' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}>Preview</button>
                    {document.isCourtProcess && (
                        <button onClick={() => setActiveTab('litigation')} className={`flex-shrink-0 pb-3 border-b-2 font-bold text-sm flex items-center gap-2 ${activeTab === 'litigation' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}>
                            {isProperty ? 'Operational Pipeline' : 'Litigation Pipeline'}
                        </button>
                    )}
                    <button onClick={() => setActiveTab('analysis')} className={`flex-shrink-0 pb-3 border-b-2 font-bold text-sm flex items-center gap-2 ${activeTab === 'analysis' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}>
                        {isProperty ? 'Document' : 'ALDIA'} Analysis {document.analysisState === 'pending' && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`flex-shrink-0 pb-3 border-b-2 font-bold text-sm flex items-center gap-2 ${activeTab === 'history' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}>
                        History {(() => { const n = (document.versions || []).length; return n > 0 ? <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-700 text-2xs font-bold">{n}</span> : null; })()}
                    </button>
                    {/* Mentions tab REMOVED: it rendered a permanently empty
                        placeholder ("No mentions tab content.") — a dead tab.
                        BacklinksPanel was already removed per user request. */}
                </div>

                {/* Preview tab — fills ALL available space */}
                {activeTab === 'details' && (
                    <div className="flex-1 overflow-hidden p-4">
                        {document.content ? (
                            <HtmlPagePreview
                                html={document.content}
                                title={document.title}
                                onRequestFullScreen={() => setShowFullScreenPreview(true)}
                            />
                        ) : (
                            <FileViewer file={document.file} />
                        )}
                    </div>
                )}

                {/* Litigation tab */}
                {activeTab === 'litigation' && (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in py-6">
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

                                        // Static Tailwind class maps — Tailwind JIT never
                                        // emits `bg-${color}-50`-style interpolated classes,
                                        // so the "current stage" styling silently didn't apply.
                                        const STAGE_STYLES: Record<string, { card: string; label: string; button: string }> = {
                                            slate: { card: 'bg-slate-50 dark:bg-zinc-900/50 border-slate-500 shadow-md', label: 'text-slate-600 dark:text-slate-400', button: 'bg-slate-600 text-white' },
                                            orange: { card: 'bg-orange-50 dark:bg-orange-900/20 border-orange-500 shadow-md', label: 'text-orange-600 dark:text-orange-400', button: 'bg-orange-600 text-white' },
                                            blue: { card: 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-md', label: 'text-blue-600 dark:text-blue-400', button: 'bg-blue-600 text-white' },
                                            green: { card: 'bg-green-50 dark:bg-green-900/20 border-green-500 shadow-md', label: 'text-green-600 dark:text-green-400', button: 'bg-green-600 text-white' },
                                        };
                                        const stageStyle = STAGE_STYLES[step.color] || STAGE_STYLES.slate;
                                        return (
                                            <div key={step.id} className="relative">
                                                <div className={`p-4 rounded-lg border-2 transition-all ${isCurrent ? stageStyle.card :
                                                    isPast ? `bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-700 opacity-60` :
                                                        `bg-white dark:bg-zinc-800 border-dashed border-slate-200 dark:border-zinc-700`
                                                    }`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`text-2xs font-black uppercase tracking-widest ${isCurrent ? stageStyle.label : 'text-slate-400'}`}>Step {idx + 1}</span>
                                                        {isPast && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
                                                    </div>
                                                    <h5 className={`font-bold text-sm mb-1 ${isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{step.label}</h5>
                                                    <p className="text-2xs leading-tight text-slate-500">{step.desc}</p>
                                                    <button
                                                        onClick={() => handleStepClick(step.id)}
                                                        className={`mt-3 w-full py-1.5 text-2xs font-bold rounded-lg transition-all ${isCurrent ? stageStyle.button : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 hover:bg-slate-200 dark:hover:bg-zinc-600'}`}
                                                    >
                                                        {isCurrent ? 'Current Stage' : isPast ? 'Revert to Stage' : (step.id === 'filed' ? 'Record Filing' : step.id === 'served' ? 'Record Service' : 'Mark as Done')}
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

                                {/* ── Event capture forms (filed / served) ──
                                    The app can never KNOW a document was
                                    served — a human records the event; the
                                    recorded date then drives the CPR
                                    deadline engine below. */}
                                {!isProperty && captureStep === 'filed' && (
                                    <div className="mb-8 p-5 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-orange-200 dark:border-orange-900/50 shadow-sm animate-fade-in">
                                        <h6 className="text-sm font-black text-slate-900 dark:text-white mb-1">Record the registry filing</h6>
                                        <p className="text-2xs text-slate-500 mb-4">When was this process filed? The date is kept with the process record.</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                            <label className="block">
                                                <span className="block text-2xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Filing date</span>
                                                <Input type="date" value={filingForm.date} onChange={e => setFilingForm({ ...filingForm, date: e.target.value })} inputClassName="w-full text-sm" aria-label="Filing date" />
                                            </label>
                                            <label className="block">
                                                <span className="block text-2xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Registry receipt no. (optional)</span>
                                                <Input type="text" value={filingForm.receiptNumber} onChange={e => setFilingForm({ ...filingForm, receiptNumber: e.target.value })} placeholder="e.g. F/2026/0142" inputClassName="w-full text-sm" aria-label="Registry receipt number" />
                                            </label>
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="ghost" size="sm" onClick={() => setCaptureStep(null)} className="text-xs font-bold">Cancel</Button>
                                            <Button variant="primary" size="sm" disabled={savingEvent} onClick={saveFilingEvent} className="text-xs font-black">{savingEvent ? 'Saving…' : 'Save Filing'}</Button>
                                        </div>
                                    </div>
                                )}
                                {!isProperty && captureStep === 'served' && (
                                    <div className="mb-8 p-5 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-blue-200 dark:border-blue-900/50 shadow-sm animate-fade-in">
                                        <h6 className="text-sm font-black text-slate-900 dark:text-white mb-1">Record the service</h6>
                                        <p className="text-2xs text-slate-500 mb-4">
                                            The service date is what the response windows run from — record it as the affidavit of service / proof states.
                                            {court ? <span className="block mt-1">Deadlines will be computed under the <strong>{courtJurisdictionProfile(court).label}</strong> rules, with the governing rule cited on every entry.</span> : null}
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                            <label className="block">
                                                <span className="block text-2xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Date served</span>
                                                <Input type="date" value={serviceForm.date} onChange={e => setServiceForm({ ...serviceForm, date: e.target.value })} inputClassName="w-full text-sm" aria-label="Date served" />
                                            </label>
                                            <label className="block">
                                                <span className="block text-2xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Method of service</span>
                                                <Select value={serviceForm.method} onChange={e => setServiceForm({ ...serviceForm, method: e.target.value as ServiceMethod })} selectClassName="w-full text-sm" aria-label="Method of service">
                                                    <option value="personal">Personal service</option>
                                                    <option value="substituted">Substituted service</option>
                                                    <option value="registered_post">Registered post / courier</option>
                                                    <option value="electronic">Electronic (as agreed under the rules)</option>
                                                    <option value="by_counsel">Service on counsel</option>
                                                    <option value="acknowledged">Acknowledged by party</option>
                                                    <option value="other">Other</option>
                                                </Select>
                                            </label>
                                            <label className="block">
                                                <span className="block text-2xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Served on (party / counsel)</span>
                                                <Input type="text" value={serviceForm.servedOn} onChange={e => setServiceForm({ ...serviceForm, servedOn: e.target.value })} placeholder="e.g. Savannah Haulage Ltd." inputClassName="w-full text-sm" aria-label="Served on" />
                                            </label>
                                            <label className="block">
                                                <span className="block text-2xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Proof / note (optional)</span>
                                                <Input type="text" value={serviceForm.proofNote} onChange={e => setServiceForm({ ...serviceForm, proofNote: e.target.value })} placeholder="e.g. Affidavit of personal service, filed 14 Nov" inputClassName="w-full text-sm" aria-label="Proof note" />
                                            </label>
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="ghost" size="sm" onClick={() => setCaptureStep(null)} className="text-xs font-bold">Cancel</Button>
                                            <Button variant="primary" size="sm" disabled={savingEvent} onClick={saveServiceEvent} className="text-xs font-black">{savingEvent ? 'Saving…' : 'Save Service & Compute Deadlines'}</Button>
                                        </div>
                                    </div>
                                )}

                                {/* ── The CPR deadlines read-out ──
                                    Every entry carries the governing rule
                                    citation; only VERIFIED windows appear
                                    (nothing is guessed for uncovered
                                    courts — a manual deadline can be set
                                    instead). */}
                                {!isProperty && (
                                    <div className="mb-8 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-700 flex items-center gap-2">
                                            <ClockIcon className="w-4 h-4 text-primary-600" />
                                            <h6 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Deadlines under the matter's rules</h6>
                                        </div>
                                        <div className="p-6">
                                            {latestServiceEvent ? (
                                                <>
                                                    <p className="text-2xs text-slate-500 mb-4">
                                                        Computed from the recorded service on <strong>{new Date(latestServiceEvent.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                                                        {latestServiceEvent.servedOn ? <> on <strong>{latestServiceEvent.servedOn}</strong></> : null}
                                                        {court ? <> — windows under the <strong>{courtJurisdictionProfile(court).label}</strong> rules</> : null}.
                                                    </p>
                                                    {liveDeadlines.map(d => (
                                                        <div key={d.window.id} className="mb-3 last:mb-0 p-4 rounded-lg bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800">
                                                            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{d.window.action}</span>
                                                                <span className="font-mono text-sm font-black text-primary-700 dark:text-primary-300">
                                                                    {new Date(d.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-2xs text-slate-500 leading-relaxed mb-1.5">{d.note}</p>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-2xs font-bold border border-indigo-100 dark:border-indigo-800/50">
                                                                    <ScalesIcon className="w-3 h-3" /> {d.window.citation}
                                                                </span>
                                                                {trackedWindowIds.has(d.window.id) && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-2xs font-bold border border-green-100 dark:border-green-800/50">
                                                                        <CheckCircleIcon className="w-3 h-3" /> Tracked — task & calendar
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {!hasVerifiedCoverage && (
                                                        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40">
                                                            <p className="text-2xs text-amber-800 dark:text-amber-200 leading-relaxed">
                                                                No built-in rule window for this court yet — the built-in windows cover the High Courts of Lagos and the FCT, the Federal High Court and the appellate periods. Set this court's deadline manually below (and verify it against your division's rules).
                                                            </p>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <p className="text-2xs text-slate-500 leading-relaxed">
                                                    Record the service of this process and the response windows are computed automatically — the governing Civil Procedure Rules citation rides every entry. Built-in windows: High Court of Lagos State (Order 17 Rule 1(2), 2019 Rules), FCT High Court (2025 Rules), Federal High Court (Order 7 Rule 1, 2019 Rules) and the Court of Appeal periods.
                                                </p>
                                            )}
                                            {/* The manual row — works for ANY court */}
                                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
                                                <label className="block">
                                                    <span className="block text-2xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Add a deadline manually (any court)</span>
                                                    <Input type="text" value={manualDeadline.label} onChange={e => setManualDeadline({ ...manualDeadline, label: e.target.value })} placeholder="e.g. File Notice of Intention to Defend" inputClassName="w-full text-sm" aria-label="Deadline label" />
                                                </label>
                                                <Input type="date" value={manualDeadline.date} onChange={e => setManualDeadline({ ...manualDeadline, date: e.target.value })} inputClassName="text-sm h-[38px]" aria-label="Deadline date" />
                                                <Button variant="dark" size="sm" disabled={savingEvent || !manualDeadline.label.trim() || !manualDeadline.date} onClick={addManualDeadline} className="text-xs font-black whitespace-nowrap">Add</Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-800/50 flex items-start gap-3">
                                    <SparklesIcon className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h6 className="text-xs font-bold text-primary-900 dark:text-primary-100 mb-1">{isProperty ? 'Manager Tip' : 'Litigation Lawyer Tip'}</h6>
                                        <p className="text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
                                            {isProperty
                                                ? 'Marking a document as Finalized helps PracticePro track the next steps in your portfolio workflow automatically.'
                                                : 'Record the service of an originating process and the respondent\u2019s Memorandum of Appearance and Statement of Defence windows are computed under the matter\u2019s Civil Procedure Rules — the rule cited on every entry — and tracked in your tasks and calendar automatically.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* History tab (V4, V-DOC-13): the real version history —
                    what changed, who changed it, when; comparison and a
                    reversible restore that snapshots the current state
                    first. Pre-V4 the versions field was written by nothing. */}
                {activeTab === 'history' && (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                        <div className="max-w-3xl mx-auto space-y-4 animate-fade-in pb-20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Version History</h3>
                                    <p className="text-xs text-slate-500">Every committed edit preserves the prior state of this document.</p>
                                </div>
                            </div>
                            {(document.versions || []).length === 0 ? (
                                <div className="bg-white dark:bg-zinc-800 rounded-2xl p-10 text-center border border-slate-200 dark:border-zinc-700">
                                    <p className="text-sm text-slate-500">No versions yet. The first committed edit to this document's title, content or file will snapshot the prior state here.</p>
                                </div>
                            ) : (
                                chronologicalVersions(document.versions || []).slice().reverse().map((version, idx) => {
                                    const actor = (coreState.users || []).find((u: any) => u.id === version.uploadedBy || u._id === version.uploadedBy);
                                    const isLatest = idx === 0;
                                    return (
                                        <div key={version.id || idx} className={`rounded-lg border p-4 ${isLatest ? 'border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10' : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">{version.title || document.title}</p>
                                                    <p className="text-2xs text-slate-500 mt-0.5">
                                                        {new Date(version.uploadedAt).toLocaleString('en-GB')} · {actor?.name || 'Team member'} · {version.changesSummary || 'Prior state'}
                                                    </p>
                                                    <p className="text-2xs text-slate-400 mt-0.5">
                                                        {version.file?.name ? `File: ${version.file.name}` : 'Content-only version'}
                                                    </p>
                                                </div>
                                                <div className="flex flex-shrink-0 gap-2">
                                                    <button onClick={() => openModal('compareDocuments', document.id, { document, version })} className="px-3 py-1.5 text-2xs font-bold rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors">Compare</button>
                                                    <button onClick={async () => {
                                                        const ok = await confirmDialog({
                                                            title: 'Restore this version?',
                                                            message: `The current state will be snapshotted first, so this restore is itself reversible.`,
                                                            confirmLabel: 'Restore',
                                                        });
                                                        if (!ok) return;
                                                        const nowIso = new Date().toISOString();
                                                        const snapshot = buildVersionSnapshot(document, {
                                                            title: version.title ?? document.title,
                                                            content: version.content,
                                                            file: version.file,
                                                            categoryId: document.categoryId,
                                                            matter: document.matter,
                                                        }, currentUser?.id || 'unknown', nowIso);
                                                        documentActions.updateDocument({
                                                            ...document,
                                                            title: version.title ?? document.title,
                                                            content: version.content ?? document.content,
                                                            file: version.file ?? document.file,
                                                            versions: capVersions([snapshot, ...(document.versions || [])]),
                                                        });
                                                    }} className="px-3 py-1.5 text-2xs font-bold rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors">Restore</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* Analysis tab */}
                {activeTab === 'analysis' && (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20">
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
                                        className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-lg shadow-primary-500/20 transition-all flex items-center gap-2 mx-auto"
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
                                                <div className="flex items-center gap-2 mb-2 text-primary-600">
                                                    <ClockIcon className="w-5 h-5" />
                                                    <h4 className="font-bold">Key Intelligence & Metadata</h4>
                                                </div>
                                                {/* V5 (evidence integrity): these fields are AI-extracted by
                                                    ALDIA and persisted unverified — they must never read as
                                                    established facts. Invented dates/parties/events must not
                                                    silently enter the verified record. */}
                                                <p className="text-2xs mb-4 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 leading-relaxed">
                                                    AI-extracted by ALDIA — <b>unverified</b>. Every date, party and field below was inferred by the model from the document text; confirm each against the underlying document before relying on it.
                                                </p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-700">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Contract Type</span>
                                                        <span className="text-slate-900 dark:text-white font-medium">{document.extractedMetadata?.contractType || 'Unspecified'}</span>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-700">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Governing Law</span>
                                                        <span className="text-slate-900 dark:text-white font-medium">{document.extractedMetadata?.governingLaw || 'Unspecified'}</span>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-700">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Effective Date</span>
                                                        <span className="text-slate-900 dark:text-white font-medium">{document.extractedMetadata?.effectiveDate || 'N/A'}</span>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-700">
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
                                                    {document.rpcReview?.commentary || (isProperty ? 'Compliance self-review pending — no verified check has run.' : 'RPC self-review pending — no verified check has run.')}
                                                </p>
                                                {/* V5: the old badge claimed a verified agent
                                                    unconditionally, with a parse fallback that literally
                                                    passed the review. The badge now states what actually
                                                    happened: an AI self-review, and whether it passed. */}
                                                <div className={`flex items-center gap-1.5 py-1 px-3 rounded-full w-fit border ${document.rpcReview?.status === 'approved'
                                                    ? 'bg-white dark:bg-zinc-800 border-green-100 dark:border-green-900'
                                                    : 'bg-white dark:bg-zinc-800 border-orange-100 dark:border-orange-900'}`}>
                                                    <div className={`w-2 h-2 rounded-full ${document.rpcReview?.status === 'approved' ? 'bg-green-500' : 'bg-orange-400'}`} />
                                                    <span className={`text-2xs font-black uppercase tracking-tight ${document.rpcReview?.status === 'approved' ? 'text-green-600' : 'text-orange-600'}`}>
                                                        {document.rpcReview?.status === 'approved' ? 'AI self-review: passed (not externally verified)' : 'AI self-review: pending'}
                                                    </span>
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
                                                                <span key={idx} className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-900 rounded text-2xs text-slate-600 dark:text-zinc-400 font-bold border border-slate-200 dark:border-zinc-700">
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
                    </div>
                )}

                {/* Mentions tab removed — see tab bar note above. */}
            </div>

            {/* ─── Full-screen immersive preview overlay ─── */}
            {showFullScreenPreview && (document.content || document.file) && (
                <DocumentPreviewModal
                    html={document.content}
                    fileUrl={document.file?.dataUrl || undefined}
                    title={document.title}
                    onClose={() => setShowFullScreenPreview(false)}
                />
            )}
        </div>
    );
};

export const DocumentDetailView: React.FC = () => (
    <ErrorBoundary>
        <DocumentDetailViewContent />
    </ErrorBoundary>
);

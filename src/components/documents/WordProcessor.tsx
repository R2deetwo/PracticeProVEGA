import React, { useState, useEffect, useRef } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useLocation } from 'react-router-dom';
import { DraftProEditor } from './tiptap/DraftProEditor';
import { ChevronLeftIcon as BackIcon, CheckIcon as SaveIcon } from '../../constants';
import { useCoreState } from '../../contexts/CoreContext';
import { draftSessionKey, loadDraftSession, saveDraftSession, clearDraftSession } from '../../utils/draftSession';
import { registerDraftTab } from '../../utils/draftTabs';
import { readHashContext } from '../../utils/tabNavigation';
import { getAndClearPendingDraft } from '../../utils/draftContentStore';
import { isTrivialDraftPrompt } from '../../utils/intentGate';

/** Helper: extract context from ContextResult */
function extractCtx(result: ReturnType<typeof readHashContext>): Record<string, any> {
    if (result.status === 'ok') return result.context;
    if (result.status === 'error') console.warn('[WordProcessor] Hash context error:', result.reason);
    return {};
}

export const WordProcessor: React.FC = () => {
    const { currentHistoryEntry, openModal, goBack, modal: activeModal } = useUI();
    const location = useLocation();
    const { coreState } = useCoreState();

    const [documentTitle, setDocumentTitle] = useState('Untitled Draft');
    const [initialContent, setInitialContent] = useState('');
    const [draftPrompt, setDraftPrompt] = useState<string | undefined>(undefined);
    const [disableAutoDraft, setDisableAutoDraft] = useState(false);
    const [promptWasTrivial, setPromptWasTrivial] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [sessionKey, setSessionKey] = useState('');
    const [resolvedCitations, setResolvedCitations] = useState<any[] | undefined>(undefined);
    const [resolvedMatterId, setResolvedMatterId] = useState<string | undefined>(undefined);
    // "Save & Close" (2026-09-23): armed by handleSaveForClose, consumed when
    // the save-to-vault modal (newDocument) finishes — by SAVE or CANCEL — so
    // the editor closes right after the user completes the save flow instead
    // of stranding them on the editor with only the browser back button.
    const [closeAfterSave, setCloseAfterSave] = useState(false);
    const prevModalRef = useRef<string | null>(activeModal ?? null);

    const firmId = coreState.firmDetails?.id || '';

    useEffect(() => {
        // FIX 4: Canonical carrier read order:
        // 1. URL query params (scalar values: draftKey, title, prompt)
        // 2. Hash context / ctxRef (structured payloads: citations, matterId, etc.)
        // 3. currentHistoryEntry.context (in-memory — same-tab fast path)
        // 4. localStorage draft session (recovery path)

        // 1. URL params
        const searchParams = new URLSearchParams(location.search);
        const urlDraftKey = searchParams.get('draftKey');
        const urlTitle = searchParams.get('title');
        const urlPrompt = searchParams.get('prompt');

        // 2. Hash context (new-tab path for structured data)
        const hashCtx = extractCtx(readHashContext());

        // 3. In-memory context (in-place path)
        // In Capacitor's webview, location.state can be null even when
        // navigate() was called with state. As a fallback, check the
        // module-level pending draft store (set by ALOA's "Draft in
        // DraftPro" handler before navigating).
        const pendingDraft = getAndClearPendingDraft();
        const memCtx = (location.state as any) || currentHistoryEntry?.context || pendingDraft || {};

        // Merge: URL params > hash > memory (memory is fallback for same-tab)
        const ctx = { ...memCtx, ...hashCtx };

        // Determine the draft key
        const key = urlDraftKey || draftSessionKey({
            matterId: ctx.matterId,
            title: ctx.draftTitle || urlTitle,
            documentId: ctx.documentId,
        });
        setSessionKey(key);

        // 4. localStorage draft session (recovery path)
        const stored = firmId ? loadDraftSession(firmId, key) : null;
        const content = ctx.draftContent || stored?.content || '';
        if (content) {
            setInitialContent(content);
            setIsSaved(false);
        }

        // Auto-draft suppression logic:
        // - If ctx explicitly says disableAutoDraft, suppress.
        // - If stored session has non-empty content, suppress (don't re-draft over existing work).
        // - Otherwise: ALLOW auto-drafting (this is the ALOA → DraftPro path where
        //   ALOA saves an empty-content session with a draftPrompt, and DraftPro
        //   should auto-generate the document on open).
        // - 2026-09-23 phantom-document fix: a TRIVIAL draftPrompt (empty,
        //   "hello", a lone document-type word) must NEVER auto-draft — that
        //   is how a greeting once produced a phantom court-captioned
        //   "advisory". The editor opens blank instead, and the user is
        //   prompted to say what they actually need.
        const resolvedPromptForGate = urlPrompt || ctx.draftPrompt || stored?.draftPrompt || '';
        const promptIsTrivial = isTrivialDraftPrompt(resolvedPromptForGate);
        const shouldSuppress = ctx.disableAutoDraft || (!!stored?.content && stored.content.trim().length > 0) || promptIsTrivial;
        setDisableAutoDraft(shouldSuppress);
        setPromptWasTrivial(promptIsTrivial);

        const resolvedPrompt = urlPrompt || ctx.draftPrompt || stored?.draftPrompt || undefined;
        setDraftPrompt(resolvedPrompt || undefined);

        const resolvedTitle = urlTitle || ctx.draftTitle || stored?.title || 'Untitled Draft';
        setDocumentTitle(resolvedTitle);

        // FIX 5a: matterId — read from hash context → memory → localStorage
        const mId = ctx.matterId || hashCtx.matterId || stored?.matterId || undefined;
        setResolvedMatterId(mId);

        // FIX 5b: citations — read from hash context → memory → localStorage
        const cites = ctx.citations || hashCtx.citations || stored?.citations || undefined;
        setResolvedCitations(cites);
    }, [location.state, location.search, currentHistoryEntry, firmId]);

    // ─── Register with the tab manager (desktop only) ────────────────────
    // This lets ALOA's "Open Item" button focus this tab instead of spawning
    // a duplicate. On mobile it's a no-op.
    useEffect(() => {
        if (!sessionKey) return;
        const cleanup = registerDraftTab({
            key: sessionKey,
            title: documentTitle,
        });
        return cleanup;
    }, [sessionKey, documentTitle]);

    const persistDraft = (content: string, title: string, prompt?: string) => {
        if (!firmId || !sessionKey) return;
        saveDraftSession(firmId, sessionKey, {
            title,
            content,
            draftPrompt: prompt,
            matterId: resolvedMatterId,  // FIX 5a: now always available
            citations: resolvedCitations, // FIX 5b: now persisted
            updatedAt: new Date().toISOString(),
        });
    };

    // ─── Dynamic tab title ──────────────────────────────────────────────
    // Sets the browser tab title to "DraftPro — <draft name>" so users can
    // identify their draft tabs at a glance. Restores the original title
    // when the component unmounts.
    useEffect(() => {
        const previousTitle = document.title;
        // Derive a short draft name from the title:
        // "Tenancy Agreement - Lagos Property" → "Tenancy Agreement"
        const shortName = documentTitle
            .replace(/^Draft\s+/i, '')
            .replace(/\s*[-–—]\s*.*$/, '') // strip anything after a dash
            .trim()
            || 'Untitled';
        document.title = `DraftPro — ${shortName}`;
        return () => { document.title = previousTitle; };
    }, [documentTitle]);

    const handleSave = (content: string) => {
        const litigationKeywords = [
            'suit', 'motion', 'affidavit', 'brief', 'pleading',
            'origination', 'summons', 'petition', 'notice of appeal',
        ];
        const isPotentialCourtProcess = litigationKeywords.some(kw =>
            documentTitle.toLowerCase().includes(kw)
        );

        // ─── Convert HTML to clean plain text ────────────────────────
        // The DocumentForm shows content in a <textarea>. If we pass raw
        // HTML, the user sees <p>, <strong>, <span> tags — "weird text".
        // Convert to clean plain text that preserves line breaks and
        // structure but strips all HTML tags.
        const cleanText = htmlToPlainText(content);

        openModal('newDocument', null, {
            draftTitle: documentTitle,
            draftContent: cleanText,
            matterId: resolvedMatterId,
            openedByAloa: false,
            isCourtProcess: isPotentialCourtProcess,
            // Also pass the original HTML so the document is stored with
            // full formatting (the form can use this for the actual save)
            draftHtml: content,
        });
        if (firmId && sessionKey) clearDraftSession(firmId, sessionKey);
        setIsSaved(true);
    };

    /**
     * Close the DraftPro surface.
     * - In a DEDICATED tab (opened via window.open): close the tab. The
     *   draft session is already persisted to localStorage on every edit,
     *   so nothing is lost even without an explicit save.
     * - In-place (same tab as the app): go back to the previous view.
     */
    const handleClose = () => {
        try {
            // A tab opened by script can close itself; a user-created tab
            // cannot. Try window.close() first and fall back to navigation.
            const urlParams = new URLSearchParams(window.location.search);
            const inDedicatedTab =
                !!urlParams.get('draftKey') &&
                ((window.opener !== null && window.opener !== undefined) ||
                    !!(window.name && window.name.startsWith('draftpro-')));
            if (inDedicatedTab) {
                window.close();
                // window.close() is asynchronous and silently fails for
                // non-script tabs — if we're still here shortly after,
                // navigate to the app home instead of leaving the user
                // stranded on a dead editor.
                window.setTimeout(() => {
                    if (!document.hidden) window.location.href = '/';
                }, 180);
                return;
            }
        } catch { /* fall through to goBack */ }
        goBack();
    };

    /** "Save & Close" — trigger the vault save flow (opens the newDocument
     * modal) and arm the auto-close. The effect below closes the editor as
     * soon as that modal is dismissed, so the user lands back in the app
     * (or the tab closes) exactly when the save flow is finished. */
    const handleSaveForClose = (content: string) => {
        setCloseAfterSave(true);
        handleSave(content);
    };

    // Consume the armed close when the save-to-vault modal finishes. We
    // track the PREVIOUS modal value so we only fire on a genuine
    // newDocument → null transition (not on unrelated renders).
    useEffect(() => {
        const wasNewDocumentModal = prevModalRef.current === 'newDocument';
        prevModalRef.current = activeModal ?? null;
        if (closeAfterSave && wasNewDocumentModal && activeModal == null) {
            setCloseAfterSave(false);
            // Slight delay lets the modal's own close animation/toasts settle.
            window.setTimeout(() => handleClose(), 120);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeModal, closeAfterSave]);

    /**
     * Convert HTML to clean plain text — preserves line breaks, lists,
     * and headings, but strips all HTML tags. The result is readable
     * text (not "<p>Hello</p>" but "Hello").
     */
    const htmlToPlainText = (html: string): string => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        // Replace block elements with newlines
        temp.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, tr, br').forEach(el => {
            el.appendChild(document.createTextNode('\n'));
        });
        // Get text content
        let text = temp.textContent || '';
        // Clean up extra whitespace
        text = text.replace(/\n{3,}/g, '\n\n').trim();
        return text;
    };

    return (
        // h-full: fills App shell without creating its own h-screen overflow
        <div className="flex flex-col h-full overflow-hidden">

            {/* ── Editor (takes all remaining height) ── */}
            <div className="flex-1 overflow-hidden">
                <DraftProEditor
                    initialContent={initialContent}
                    draftPrompt={draftPrompt}
                    autoStartDrafting={!disableAutoDraft}
                    onSave={handleSave}
                    title={documentTitle}
                    promptWasTrivial={promptWasTrivial}
                    onTitleChange={(t) => {
                        setDocumentTitle(t);
                        persistDraft(initialContent, t, draftPrompt);
                    }}
                    onContentChange={(html) => persistDraft(html, documentTitle, draftPrompt)}
                    disableAloaAutoOpen={disableAutoDraft || !currentHistoryEntry?.context?.autoStartDrafting}
                    onBack={goBack}
                    onClose={handleClose}
                    onSaveAndClose={handleSaveForClose}
                    linkedMatterId={resolvedMatterId}
                    citations={resolvedCitations}
                />
            </div>
        </div>
    );
};

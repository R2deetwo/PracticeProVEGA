import React, { useState, useEffect } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useLocation } from 'react-router-dom';
import { DraftProEditor } from './tiptap/DraftProEditor';
import { ChevronLeftIcon as BackIcon, CheckIcon as SaveIcon } from '../../constants';
import { useCoreState } from '../../contexts/CoreContext';
import { draftSessionKey, loadDraftSession, saveDraftSession, clearDraftSession } from '../../utils/draftSession';
import { registerDraftTab } from '../../utils/draftTabs';

export const WordProcessor: React.FC = () => {
    const { currentHistoryEntry, openModal, goBack } = useUI();
    const location = useLocation();
    const { coreState } = useCoreState();

    const [documentTitle, setDocumentTitle] = useState('Untitled Draft');
    const [initialContent, setInitialContent] = useState('');
    const [draftPrompt, setDraftPrompt] = useState<string | undefined>(undefined);
    const [disableAutoDraft, setDisableAutoDraft] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [sessionKey, setSessionKey] = useState('');

    const linkedMatterId = currentHistoryEntry?.context?.matterId;
    const firmId = coreState.firmDetails?.id || '';

    useEffect(() => {
        // Parse URL query params (when opened in a new tab via draftTabs)
        const searchParams = new URLSearchParams(location.search);
        const urlDraftKey = searchParams.get('draftKey');
        const urlTitle = searchParams.get('title');
        const urlPrompt = searchParams.get('prompt');

        const ctx = (location.state as any) || currentHistoryEntry?.context || {};

        // Determine the draft key: URL param takes priority (tab-driven),
        // then context-based (in-app navigation)
        const key = urlDraftKey || draftSessionKey({
            matterId: ctx.matterId,
            title: ctx.draftTitle || urlTitle,
            documentId: ctx.documentId,
        });
        setSessionKey(key);

        const stored = firmId ? loadDraftSession(firmId, key) : null;
        const content = ctx.draftContent || stored?.content || '';
        if (content) {
            setInitialContent(content);
            setIsSaved(false);
        }

        // Determine whether auto-drafting should be suppressed
        const shouldSuppress = ctx.disableAutoDraft || !!stored?.content;
        setDisableAutoDraft(shouldSuppress);

        // Resolve the prompt: URL param, context, or stored
        const resolvedPrompt = urlPrompt || ctx.draftPrompt || stored?.draftPrompt || undefined;
        // URL-decode the prompt if it came from query params
        setDraftPrompt(resolvedPrompt ? decodeURIComponent(resolvedPrompt) : undefined);

        // Resolve the title: URL param, context, or stored
        const resolvedTitle = urlTitle ? decodeURIComponent(urlTitle) : ctx.draftTitle || stored?.title || 'Untitled Draft';
        setDocumentTitle(resolvedTitle);
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
            matterId: linkedMatterId,
            updatedAt: new Date().toISOString(),
        });
    };

    const handleSave = (content: string) => {
        const litigationKeywords = [
            'suit', 'motion', 'affidavit', 'brief', 'pleading',
            'origination', 'summons', 'petition', 'notice of appeal',
        ];
        const isPotentialCourtProcess = litigationKeywords.some(kw =>
            documentTitle.toLowerCase().includes(kw)
        );

        openModal('newDocument', null, {
            draftTitle: documentTitle,
            draftContent: content,
            matterId: linkedMatterId,
            openedByAloa: false,
            isCourtProcess: isPotentialCourtProcess,
        });
        if (firmId && sessionKey) clearDraftSession(firmId, sessionKey);
        setIsSaved(true);
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
                    onTitleChange={(t) => {
                        setDocumentTitle(t);
                        persistDraft(initialContent, t, draftPrompt);
                    }}
                    onContentChange={(html) => persistDraft(html, documentTitle, draftPrompt)}
                    disableAloaAutoOpen={disableAutoDraft || !currentHistoryEntry?.context?.autoStartDrafting}
                    onBack={goBack}
                    linkedMatterId={linkedMatterId}
                />
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useLocation } from 'react-router-dom';
import { DraftProEditor } from './tiptap/DraftProEditor';
import { ChevronLeftIcon as BackIcon, CheckIcon as SaveIcon } from '../../constants';
import { useCoreState } from '../../contexts/CoreContext';
import { draftSessionKey, loadDraftSession, saveDraftSession, clearDraftSession } from '../../utils/draftSession';

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
        const ctx = (location.state as any) || currentHistoryEntry?.context || {};
        const key = draftSessionKey({
            matterId: ctx.matterId,
            title: ctx.draftTitle,
            documentId: ctx.documentId,
        });
        setSessionKey(key);

        const stored = firmId ? loadDraftSession(firmId, key) : null;
        const content = ctx.draftContent || stored?.content || '';
        if (content) {
            setInitialContent(content);
            setIsSaved(false);
        }
        if (ctx.disableAutoDraft || stored?.content) {
            setDisableAutoDraft(true);
            setDraftPrompt(undefined);
        } else if (ctx.draftPrompt) {
            setDraftPrompt(ctx.draftPrompt);
        } else if (stored?.draftPrompt) {
            setDraftPrompt(stored.draftPrompt);
        }
        if (ctx.draftTitle || stored?.title) {
            setDocumentTitle(ctx.draftTitle || stored?.title || 'Untitled Draft');
        }
    }, [location.state, currentHistoryEntry, firmId]);

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
                    draftPrompt={disableAutoDraft ? undefined : draftPrompt}
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

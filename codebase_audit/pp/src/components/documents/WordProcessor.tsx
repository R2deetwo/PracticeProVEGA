import React, { useState, useEffect } from 'react';
import { useUI } from '../../contexts/UIContext';
import { DraftProEditor } from './tiptap/DraftProEditor';
import { ChevronLeftIcon as BackIcon, CheckIcon as SaveIcon } from '../../constants';

export const WordProcessor: React.FC = () => {
    const { currentHistoryEntry, openModal, goBack } = useUI();

    const [documentTitle, setDocumentTitle] = useState('Untitled Draft');
    const [initialContent, setInitialContent] = useState('');
    const [draftPrompt, setDraftPrompt] = useState<string | undefined>(undefined);
    const [isSaved, setIsSaved] = useState(false);

    const linkedMatterId = currentHistoryEntry?.context?.matterId;

    useEffect(() => {
        if (currentHistoryEntry?.context?.draftContent) {
            setInitialContent(currentHistoryEntry.context.draftContent);
            setIsSaved(false);
        }
        if (currentHistoryEntry?.context?.draftPrompt) {
            setDraftPrompt(currentHistoryEntry.context.draftPrompt);
        }
        if (currentHistoryEntry?.context?.draftTitle) {
            setDocumentTitle(currentHistoryEntry.context.draftTitle);
        }
    }, [currentHistoryEntry]);

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
                    onSave={handleSave}
                    title={documentTitle}
                    onTitleChange={setDocumentTitle}
                    disableAloaAutoOpen={!currentHistoryEntry?.context?.autoStartDrafting}
                    onBack={goBack}
                    linkedMatterId={linkedMatterId}
                />
            </div>
        </div>
    );
};

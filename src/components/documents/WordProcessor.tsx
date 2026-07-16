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
        // NOTE: URLSearchParams.get() already URL-decodes the value.
        // Calling decodeURIComponent() again would double-decode and crash
        // on strings containing literal '%' (e.g., "100% ownership").
        const resolvedPrompt = urlPrompt || ctx.draftPrompt || stored?.draftPrompt || undefined;
        setDraftPrompt(resolvedPrompt || undefined);

        // Resolve the title: URL param, context, or stored
        const resolvedTitle = urlTitle || ctx.draftTitle || stored?.title || 'Untitled Draft';
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
            matterId: linkedMatterId,
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
                    onTitleChange={(t) => {
                        setDocumentTitle(t);
                        persistDraft(initialContent, t, draftPrompt);
                    }}
                    onContentChange={(html) => persistDraft(html, documentTitle, draftPrompt)}
                    disableAloaAutoOpen={disableAutoDraft || !currentHistoryEntry?.context?.autoStartDrafting}
                    onBack={goBack}
                    linkedMatterId={linkedMatterId}
                    citations={currentHistoryEntry?.context?.citations}
                />
            </div>
        </div>
    );
};

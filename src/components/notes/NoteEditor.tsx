import React, { useEffect, useRef, useCallback, useState } from 'react';
import { NotePage, Matter } from '../../types';
import { timeAgo } from '../../utils/colorUtils';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useProduct } from '../../contexts/ProductContext';
import { searchEntities, EntitySearchResult } from '../../utils/linkParser';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

// ─── Web Speech API types ─────────────────────────────────────────────
// The Web Speech API (SpeechRecognition) is available in Chrome/Edge and
// Android WebView. Not available in Safari/Firefox — the dictation button
// is hidden when unsupported.
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}
interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
}
interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}
interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
}
declare global {
    interface Window {
        SpeechRecognition?: new () => SpeechRecognition;
        webkitSpeechRecognition?: new () => SpeechRecognition;
    }
}

const BackIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

interface BreadcrumbItem {
    name: string;
    path: string[];
}

interface NoteEditorProps {
    page: NotePage;
    matter: Matter | undefined;
    onSave: (pageId: string, title: string, content: string) => void;
    onDelete: (pageId: string) => void;
    onCopy: (pageId: string) => void;
    onNavigateToMatter: (matterId: string) => void;
    onBack: () => void;
    showBackButton?: boolean;
    breadcrumbItems?: BreadcrumbItem[];
    onBreadcrumbNav?: (path: string[]) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ page, matter, onSave, onDelete, onCopy, onNavigateToMatter, onBack, showBackButton = true, breadcrumbItems = [], onBreadcrumbNav }) => {
    const { addToast } = useUI();
    const saveTimeoutRef = useRef<number | null>(null);
    const isProgrammaticChange = useRef(false);
    const currentPageId = useRef<string | null>(null);

    // ─── PRODUCT-AWARE DICTATION (Aug 2026 rebuild) ──────────────────────
    // Vega (legal) mode: dual-output architecture
    //   - RAW transcript preserved verbatim (liability protection)
    //   - CLEANED pass via Gemini (filler removal, structure)
    //   - User can toggle between raw/cleaned in the editor
    // Atrium (property) mode: single-pass, lighter-weight
    //   - No raw preservation (property notes don't carry liability weight)
    //   - Optional light cleanup via Gemini (controlled by user preference)
    // Komplete firms: mode follows the note's contextType — a note attached
    // to a matter uses Vega mode, a note attached to a property uses Atrium.
    const { isProperty, isLegal, isUnified } = useProduct();
    const { currentUser, bearerToken } = useAuth();

    // Determine dictation mode based on product + note context
    const dictationMode: 'vega_dual' | 'atrium_single' | null = (() => {
        if (isUnified) {
            // Komplete: mode follows the note's context
            if (page.matterId) return 'vega_dual';
            if (page.propertyId) return 'atrium_single';
            // Default for unattached Komplete notes: Vega (safer default)
            return 'vega_dual';
        }
        if (isLegal) return 'vega_dual';
        if (isProperty) return 'atrium_single';
        return null;
    })();

    const isDualMode = dictationMode === 'vega_dual';

    // ─── Bidirectional Linking ──────────────────────────────────────────
    const { matterState } = useMatterState();
    const { documentState } = useDocumentState();
    const { coreState } = useCoreState();
    const [linkQuery, setLinkQuery] = useState('');
    const [linkResults, setLinkResults] = useState<EntitySearchResult[]>([]);
    const [linkVisible, setLinkVisible] = useState(false);
    const [linkSelectedIndex, setLinkSelectedIndex] = useState(0);
    const [linkPosition, setLinkPosition] = useState({ top: 0, left: 0 });
    const linkStartPos = useRef<number>(-1);

    // Entities for autocomplete search
    const linkEntities = {
        matters: matterState.matters,
        contacts: matterState.contacts,
        properties: coreState.properties,
        documents: documentState.documents,
        notes: documentState.notePages,
    };

    // ─── Dictation (Voice-to-Text Transcription) ─────────────────────
    // Uses the Web Speech API (available in Chrome/Edge + Android WebView).
    // The user taps the mic button, speaks, and their words are transcribed
    // in real-time — interim results show as greyed text, final results are
    // inserted into the note. Works continuously until stopped.
    // Supports punctuation commands ("period", "comma", "new line").
    const [isDictating, setIsDictating] = useState(false);
    const [dictationSupported, setDictationSupported] = useState(false);
    const [interimText, setInterimText] = useState('');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    // ─── DICTATION REPAIR REFS ──────────────────────────────────────────
    // userStoppedRef: user explicitly tapped stop → don't auto-restart
    // insertPosRef: saved editor position so transcript always lands at the
    //   cursor the user had when dictation started, even if they tap elsewhere
    //   mid-dictation. Without this, transcripts went to wherever the cursor
    //   happened to be (often the wrong place after the user scrolled).
    // restartCountRef: caps auto-restart attempts to prevent infinite loops
    //   if the engine keeps crashing.
    const userStoppedRef = useRef(false);
    const insertPosRef = useRef<number | null>(null);
    const restartCountRef = useRef(0);
    const MAX_RESTARTS = 5;

    // ─── VEGA DUAL-OUTPUT STATE (Aug 2026) ───────────────────────────────
    // rawTranscriptRef: accumulates the verbatim transcript during dictation.
    //   On stop, this is persisted to notePages.rawTranscript via the
    //   saveTranscripts mutation. Never edited — the source of truth for
    //   dispute resolution if the cleaned version is ever challenged.
    // isCleaning: shows a spinner during the Gemini cleanup pass (Vega mode)
    // showRawTranscript: UI toggle to switch the editor between raw/cleaned
    //   views. Default = cleaned (more readable), but the user can flip to
    //   raw to verify or copy verbatim text.
    const rawTranscriptRef = useRef<string>('');
    const [isCleaning, setIsCleaning] = useState(false);
    const [showRawTranscript, setShowRawTranscript] = useState(false);
    const [hasExistingTranscript, setHasExistingTranscript] = useState(false);
    const cleanTranscriptAction = useAction(api.noteDictation.cleanTranscript) as any;
    const saveTranscripts = useMutation(api.noteDictation.saveTranscripts);

    // Check if the current note already has transcripts (from a prior dictation)
    useEffect(() => {
        setHasExistingTranscript(!!(page.rawTranscript || page.cleanedTranscript));
    }, [page.rawTranscript, page.cleanedTranscript, page.id]);

    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        setDictationSupported(!!SR);
    }, []);

    // Process transcript — convert spoken punctuation commands to actual punctuation
    const processTranscript = (text: string): string => {
        return text
            .replace(/\bperiod\b/gi, '.')
            .replace(/\bcomma\b/gi, ',')
            .replace(/\bquestion mark\b/gi, '?')
            .replace(/\bexclamation (mark|point)\b/gi, '!')
            .replace(/\bnew line\b/gi, '\n')
            .replace(/\bnew paragraph\b/gi, '\n\n')
            .replace(/\bcolon\b/gi, ':')
            .replace(/\bsemicolon\b/gi, ';')
            .replace(/\bopen quote\b/gi, '"')
            .replace(/\bclose quote\b/gi, '"')
            .replace(/\bhyphen\b/gi, '-');
    };

    // ─── Insert transcript at the saved cursor position ─────────────────
    // Avoids editor.chain().focus() which steals focus from the mic indicator
    // and (worse) scrolls the page. Inserts at insertPosRef if set, else at
    // the current cursor.
    const insertTranscript = (text: string) => {
        if (!editor) return;
        try {
            const pos = insertPosRef.current;
            if (pos !== null && pos >= 0 && pos <= editor.state.doc.content.size) {
                // Restore the saved cursor and insert there
                editor.chain().setTextSelection(pos).insertContent(text).run();
                // Advance the saved position past what we just inserted
                insertPosRef.current = pos + text.length;
            } else {
                // Fallback: insert at current cursor (no focus stealing)
                editor.chain().insertContent(text).run();
            }
        } catch (err) {
            console.warn('[Dictation] insertContent failed:', err);
        }
    };

    const toggleDictation = async () => {
        if (isDictating) {
            userStoppedRef.current = true;
            try { recognitionRef.current?.stop(); } catch (e) { /* already stopped */ }
            setIsDictating(false);
            setInterimText('');

            // ─── VEGA DUAL-OUTPUT: clean the accumulated raw transcript ────
            // After the user stops dictating, send the raw transcript to Gemini
            // for cleanup. Both versions are persisted to notePages so the
            // user can toggle between them. The raw is preserved verbatim
            // (liability protection); the cleaned is what they'll normally view.
            //
            // Atrium mode skips this entirely — property notes are lighter-weight
            // and don't need the dual-output ceremony.
            if (isDualMode && rawTranscriptRef.current.trim() && page.id) {
                const rawToClean = rawTranscriptRef.current.trim();
                setIsCleaning(true);
                // Build a context hint for better cleanup decisions
                const contextHint = page.matterId
                    ? 'legal matter note'
                    : page.propertyId
                        ? 'property note'
                        : 'legal practice note';
                // Fire-and-forget — the cleanup runs in the background while
                // the user keeps editing. Toasts update them on success/failure.
                (async () => {
                    try {
                        const cleaned = await cleanTranscriptAction({
                            rawTranscript: rawToClean,
                            contextHint,
                            firmGeminiApiKey: (coreState.firmDetails as any)?.aiSettings?.geminiApiKey,
                        });
                        // Persist both versions to the backend
                        await saveTranscripts({
                            noteId: page.id as any,
                            rawTranscript: rawToClean,
                            cleanedTranscript: cleaned || undefined,
                            dictationMode: 'vega_dual',
                            userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
                        });
                        addToast(
                            'AI cleaned your dictation. Raw transcript preserved — toggle to view it.',
                            { type: 'success', duration: 5000 }
                        );
                        setHasExistingTranscript(true);
                    } catch (e: any) {
                        console.error('[Dictation] Cleanup failed:', e);
                        // Still save the raw transcript so it's not lost
                        try {
                            await saveTranscripts({
                                noteId: page.id as any,
                                rawTranscript: rawToClean,
                                cleanedTranscript: undefined,
                                dictationMode: 'vega_dual',
                                userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
                            });
                        } catch {}
                        addToast(
                            `AI cleanup failed: ${e?.message || 'unknown error'}. Raw transcript saved — you can edit manually or retry from the toolbar.`,
                            { type: 'warning', duration: 7000 }
                        );
                    } finally {
                        setIsCleaning(false);
                    }
                })();
                // Reset for next session
                rawTranscriptRef.current = '';
            } else if (dictationMode === 'atrium_single') {
                // Atrium: optionally run a light cleanup pass
                // For now, just persist the raw + dictationMode so the backend
                // knows this note was dictated. The light cleanup is a future
                // enhancement — current behavior matches the old single-pass flow.
                if (page.id) {
                    try {
                        await saveTranscripts({
                            noteId: page.id as any,
                            rawTranscript: rawTranscriptRef.current.trim(),
                            cleanedTranscript: undefined,
                            dictationMode: 'atrium_single',
                            userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
                        });
                    } catch (e) {
                        console.warn('[Dictation] Atrium save failed:', e);
                    }
                }
                rawTranscriptRef.current = '';
            }
            return;
        }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR || !editor) return;

        // Reset state for a fresh session
        userStoppedRef.current = false;
        restartCountRef.current = 0;
        // Reset raw transcript accumulator (Vega mode)
        rawTranscriptRef.current = '';
        // Save the current cursor position so transcripts land here regardless
        // of where the user taps during dictation.
        try {
            insertPosRef.current = editor.state.selection.from;
        } catch {
            insertPosRef.current = null;
        }

        const recognition = new SR();
        // Use en-NG for Nigerian English when available (better accent match),
        // fall back to en-US. Some Android WebView builds only support en-US
        // and will throw on unsupported locales — wrapped in try/catch below.
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }

            if (finalTranscript) {
                // ─── ACCUMULATE RAW TRANSCRIPT (Vega dual-output) ────────
                // Store the verbatim transcript BEFORE punctuation-command
                // processing. This is the source of truth for any later
                // dispute about what was actually said — never edited.
                // Atrium mode skips this (no liability weight on property notes).
                if (isDualMode) {
                    rawTranscriptRef.current += finalTranscript + ' ';
                }

                // Process punctuation commands and insert at saved cursor
                const processed = processTranscript(finalTranscript);
                insertTranscript(processed + ' ');
                setInterimText('');
            } else if (interim) {
                // Show interim text as a live preview
                setInterimText(processTranscript(interim));
            }
        };

        recognition.onerror = (event: Event) => {
            const errType = (event as any).error;
            console.warn('[Dictation] Error:', errType);
            // 'no-speech' and 'network' are transient — don't kill the session,
            // the onend handler will auto-restart up to MAX_RESTARTS times.
            // 'not-allowed' / 'service-not-allowed' are permanent — stop now.
            if (errType === 'not-allowed' || errType === 'service-not-allowed') {
                userStoppedRef.current = true;
                setIsDictating(false);
                setInterimText('');
            } else if (errType === 'aborted') {
                // User-initiated or our own stop() — don't show error
            }
            // For 'no-speech', 'network', 'audio-capture' — leave isDictating true
            // and let onend handle the restart.
        };

        recognition.onend = () => {
            // ─── AUTO-RESTART on transient end ──────────────────────────
            // Web Speech API ends the session after ~30-60s of silence or on
            // network blips. If the user didn't explicitly stop, restart so
            // long-form dictation isn't interrupted.
            if (userStoppedRef.current) {
                setIsDictating(false);
                setInterimText('');
                return;
            }
            if (restartCountRef.current >= MAX_RESTARTS) {
                console.warn('[Dictation] Max restarts reached, stopping.');
                setIsDictating(false);
                setInterimText('');
                return;
            }
            restartCountRef.current += 1;
            try {
                recognition.start();
                // Keep isDictating true — UI stays in recording state
            } catch (restartErr: any) {
                // InvalidStateError: recognition already started (rare race)
                // Just absorb and let the next onend retry.
                console.warn('[Dictation] restart failed:', restartErr?.error || restartErr);
            }
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
            setIsDictating(true);
            // Focus the editor ONCE at start so the cursor has a valid position,
            // but do NOT re-focus during dictation (would scroll / steal focus).
            editor.commands.focus();
        } catch (startErr: any) {
            if (startErr?.error === 'already-started' || startErr?.name === 'InvalidStateError') {
                // Recognition already running — flip UI to dictating
                setIsDictating(true);
            } else {
                console.warn('[Dictation] start failed:', startErr);
                setIsDictating(false);
            }
        }
    };

    const savePendingChanges = useCallback((html?: string) => {
        if (currentPageId.current) {
            const titleInput = document.getElementById(`note-title-input-${currentPageId.current}`) as HTMLInputElement;
            const title = titleInput ? titleInput.value : page.title;
            const content = html !== undefined ? html : (page.content || ''); // We inject html explicitly
            onSave(currentPageId.current, title, content);
        }
    }, [page, onSave]);

    const debouncedSave = useCallback((html: string) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = window.setTimeout(() => {
            savePendingChanges(html);
        }, 1500);
    }, [savePendingChanges]);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({ openOnClick: false }),
            Placeholder.configure({ placeholder: 'Start writing your note... Type [[ to link to a matter, contact, or document.' }),
        ],
        content: page.content || '',
        onUpdate: ({ editor }) => {
            if (!isProgrammaticChange.current) {
                debouncedSave(editor.getHTML());

                // ─── Bidirectional Link Autocomplete ────────────────────
                // Check if the user just typed [[ and show autocomplete
                const cursorPos = editor.state.selection.from;
                // TipTap v3: editor.getText() takes 0-1 args. Use the ProseMirror
                // doc API directly to get text between two positions.
                const textBefore = editor.state.doc.textBetween(0, cursorPos, '\n', '\n');
                const lastOpen = textBefore.lastIndexOf('[[');
                if (lastOpen !== -1) {
                    const textBetween = textBefore.substring(lastOpen + 2);
                    // No closing ]] yet, no newline, and less than 50 chars
                    if (!textBetween.includes(']]') && !textBetween.includes('\n') && textBetween.length < 50) {
                        setLinkQuery(textBetween);
                        setLinkVisible(true);
                        linkStartPos.current = lastOpen;
                        const results = searchEntities(textBetween, linkEntities, 8);
                        setLinkResults(results);
                        setLinkSelectedIndex(0);

                        // Position the dropdown near the cursor
                        const coords = editor.view.coordsAtPos(cursorPos);
                        setLinkPosition({ top: coords.bottom + 4, left: coords.left });
                    } else {
                        setLinkVisible(false);
                    }
                } else {
                    setLinkVisible(false);
                }
            }
        },
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert prose-sm sm:prose-base focus:outline-none min-h-[500px] w-full max-w-none px-4 sm:px-6 py-4 custom-scrollbar',
            },
            handleKeyDown: (view, event) => {
                // Handle autocomplete keyboard navigation
                if (linkVisible && linkResults.length > 0) {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setLinkSelectedIndex(prev => Math.min(prev + 1, linkResults.length - 1));
                        return true;
                    }
                    if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setLinkSelectedIndex(prev => Math.max(prev - 1, 0));
                        return true;
                    }
                    if (event.key === 'Enter' && linkResults[linkSelectedIndex]) {
                        event.preventDefault();
                        insertLink(linkResults[linkSelectedIndex]);
                        return true;
                    }
                    if (event.key === 'Escape') {
                        setLinkVisible(false);
                        return true;
                    }
                }
                return false;
            },
        },
    });

    // Insert a [[Link]] into the editor at the cursor position
    const insertLink = (result: EntitySearchResult) => {
        if (!editor) return;
        const startPos = linkStartPos.current;
        if (startPos === -1) return;

        const cursorPos = editor.state.selection.from;
        // Delete the [[partial text and insert [[Full Label]]
        editor.chain()
            .focus()
            .deleteRange({ from: startPos + 1, to: cursorPos }) // delete from [ to cursor
            .insertContent(`[${result.label}]]`)
            .run();

        setLinkVisible(false);
        setLinkQuery('');
    };

    // Cleanup effect to save on unmount/re-render
    useEffect(() => {
        const pageIdToSave = currentPageId.current;
        const currentHtml = editor?.getHTML();

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (pageIdToSave && currentHtml !== undefined) {
                const titleInput = document.getElementById(`note-title-input-${pageIdToSave}`) as HTMLInputElement;
                const title = titleInput ? titleInput.value : page.title;
                onSave(pageIdToSave, title, currentHtml);
            }
        };
    }, [onSave, page.title, editor]);


    useEffect(() => {
        if (editor && page) {
            if (currentPageId.current !== page.id) {
                isProgrammaticChange.current = true;
                editor.commands.setContent(page.content || '');
                isProgrammaticChange.current = false;
            }
        }
        currentPageId.current = page ? page.id : null;
    }, [page, editor]);

    // ─── VEGA DUAL-OUTPUT: swap editor content when toggling raw/cleaned ──
    // When the user clicks the "Raw ⇄ Cleaned" toggle, swap the editor's
    // content between the cleaned version (page.content, the default view)
    // and the verbatim raw transcript (page.rawTranscript, wrapped in <pre>
    // to preserve whitespace and visually distinguish it).
    useEffect(() => {
        if (!editor || !hasExistingTranscript || !isDualMode) return;
        isProgrammaticChange.current = true;
        if (showRawTranscript && page.rawTranscript) {
            // Show raw transcript — preserve as plain text in a <pre> block
            // so the user can see exactly what was recognized, including
            // any recognition errors the AI cleanup would have fixed.
            editor.commands.setContent(`<pre>${page.rawTranscript.replace(/</g, '&lt;')}</pre>`);
        } else {
            // Show cleaned/content version
            editor.commands.setContent(page.content || '');
        }
        isProgrammaticChange.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showRawTranscript, hasExistingTranscript]);

    const isDemo = currentUser?.email === 'demo@practicepro.ng';

    // PHASE 1: Fetch full content on-demand if missing
    const fullPage = useQuery(
        api.myFunctions.getNotePage,
        isDemo ? 'skip' : { pageId: page.id, firmId: currentUser?.firmId || '' }
    ) as any;

    useEffect(() => {
        if (fullPage && fullPage.content !== undefined && editor) {
            const currentContent = editor.getHTML();
            if (!currentContent || currentContent === '<p></p>' || (page.content === undefined && fullPage.content)) {
                isProgrammaticChange.current = true;
                editor.commands.setContent(fullPage.content || '');
                isProgrammaticChange.current = false;
            }
        }
    }, [fullPage, editor, page.content]);

    return (
        <div className="flex-grow flex flex-col min-w-0 h-full">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2">
                {showBackButton && (
                    <button onClick={onBack} className="flex md:hidden items-center text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:text-primary-600 mb-2">
                        <BackIcon /> Back
                    </button>
                )}
                {breadcrumbItems.length > 0 && onBreadcrumbNav && (
                    <div className="hidden md:flex items-center gap-1 text-sm text-slate-500 dark:text-zinc-400 truncate">
                        {breadcrumbItems.map((item, index) => (
                            <React.Fragment key={index}>
                                {index < breadcrumbItems.length - 1 ? (
                                    <>
                                        <button onClick={() => onBreadcrumbNav(item.path)} className="hover:underline truncate max-w-[120px]">{item.name}</button>
                                        <span>/</span>
                                    </>
                                ) : (
                                    <span className="font-semibold text-slate-700 dark:text-zinc-200 truncate">{item.name}</span>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                )}
                <div className="flex items-start gap-2">
                    <div className="flex-grow">
                        <input autoComplete="off" data-lpignore="true" 
                            id={`note-title-input-${page.id}`}
                            type="text"
                            key={page.id}
                            defaultValue={page.title}
                            onChange={(e) => {
                                if (editor) debouncedSave(editor.getHTML());
                            }}
                            className="text-3xl font-bold bg-transparent focus:outline-none w-full text-gray-900 dark:text-white"
                            placeholder="Untitled Page"
                        />
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Last updated: {timeAgo(page.updatedAt)}
                            <button onClick={() => onCopy(page.id)} className="ml-4 font-semibold text-primary-600 hover:underline">Copy</button>
                            <button onClick={() => onDelete(page.id)} className="ml-4 font-semibold text-red-500 hover:underline">Delete</button>
                        </div>
                    </div>
                    <div className="flex-shrink-0 ml-4 flex items-center gap-2 mt-2">
                        {matter && (
                            <button onClick={() => onNavigateToMatter(matter.id)} className="flex-shrink-0 px-3 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 rounded-full text-xs font-semibold hover:bg-primary-200 dark:hover:bg-primary-900/60">
                                {matter.title}
                            </button>
                        )}
                    </div>
                </div>
                
                {/* Minimal Tiptap Toolbar + Dictation */}
                {editor && (
                    <div className="flex items-center gap-1 pt-2 flex-wrap">
                        <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('bold') ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'}`}><b className="font-serif">B</b></button>
                        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('italic') ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'}`}><i className="font-serif">I</i></button>
                        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('underline') ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'}`}><u className="font-serif">U</u></button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-1"></div>
                        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 1 }) ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'} text-xs font-bold leading-none`}>H1</button>
                        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 2 }) ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'} text-xs font-bold leading-none`}>H2</button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-1"></div>
                        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('bulletList') ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'} text-xs leading-none`}>• List</button>
                        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('orderedList') ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'} text-xs leading-none`}>1. List</button>
                        {/* Dictation (Voice-to-Text) — uses Web Speech API.
                            Only shown on browsers/webviews that support it
                            (Chrome, Edge, Android WebView). Hidden on Safari
                            with an explicit tooltip explaining why. */}
                        {dictationSupported ? (
                            <>
                                <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-1"></div>
                                <button
                                    onClick={toggleDictation}
                                    disabled={isCleaning}
                                    className={`p-1.5 rounded transition-all flex items-center gap-1 ${
                                        isDictating
                                            ? 'bg-red-500 text-white animate-pulse'
                                            : isCleaning
                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                                : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500'
                                    }`}
                                    title={
                                        isDictating ? 'Stop dictation'
                                        : isCleaning ? 'AI cleaning transcript…'
                                        : isDualMode
                                            ? 'Start voice dictation (Vega mode — preserves raw + cleaned transcript)'
                                            : 'Start voice dictation (Atrium mode — single-pass)'
                                    }
                                >
                                    {isCleaning ? (
                                        <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                            <line x1="12" y1="19" x2="12" y2="23"/>
                                            <line x1="8" y1="23" x2="16" y2="23"/>
                                        </svg>
                                    )}
                                    {isDictating && <span className="text-3xs font-bold">Listening...</span>}
                                    {isCleaning && <span className="text-3xs font-bold">Cleaning...</span>}
                                </button>
                                {/* VEGA DUAL-OUTPUT: raw/cleaned toggle + AI-disclosure marker.
                                    Only shown after dictation completes (hasExistingTranscript).
                                    Atrium mode doesn't get the toggle — single-pass only. */}
                                {hasExistingTranscript && isDualMode && (
                                    <button
                                        onClick={() => setShowRawTranscript(!showRawTranscript)}
                                        className="px-2 py-1 rounded text-3xs font-bold uppercase tracking-wider bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors flex items-center gap-1"
                                        title="Toggle between AI-cleaned and verbatim raw transcript. Raw is preserved for dispute resolution — never edited automatically."
                                    >
                                        {showRawTranscript ? '📄 Raw' : '✨ Cleaned'}
                                        <span className="opacity-60">⇄</span>
                                    </button>
                                )}
                                {hasExistingTranscript && isDualMode && !showRawTranscript && (
                                    <span className="text-3xs text-violet-500 dark:text-violet-400 italic">
                                        AI-cleaned from dictation
                                    </span>
                                )}
                            </>
                        ) : (
                            // Unsupported-browser state — explicit, not a broken button.
                            // Shows a disabled mic icon with tooltip explaining why.
                            <>
                                <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-1"></div>
                                <button
                                    disabled
                                    className="p-1.5 rounded text-slate-300 dark:text-zinc-600 cursor-not-allowed flex items-center gap-1"
                                    title="Voice dictation requires Chrome, Edge, or Android WebView. Not supported in this browser (Safari/Firefox)."
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                        <line x1="12" y1="19" x2="12" y2="23"/>
                                        <line x1="8" y1="23" x2="16" y2="23"/>
                                        <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2}/>
                                    </svg>
                                </button>
                            </>
                        )}
                        {/* Note Templates — quick-start templates for common note types */}
                        <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-1"></div>
                        <select
                            onChange={(e) => {
                                if (!editor || !e.target.value) return;
                                const templates: Record<string, string> = {
                                    meeting: '<h2>Meeting Notes</h2><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><p><strong>Agenda:</strong></p><ul><li> </li></ul><p><strong>Discussion:</strong></p><p></p><p><strong>Action Items:</strong></p><ul><li> </li></ul><p><strong>Next Meeting:</strong> </p>',
                                    matter_summary: '<h2>Matter Summary</h2><p><strong>Matter:</strong> </p><p><strong>Client:</strong> </p><p><strong>Stage:</strong> </p><p><strong>Key Facts:</strong></p><ul><li> </li></ul><p><strong>Legal Issues:</strong></p><ul><li> </li></ul><p><strong>Strategy:</strong></p><p></p><p><strong>Next Steps:</strong></p><ul><li> </li></ul>',
                                    property_inspection: '<h2>Property Inspection Report</h2><p><strong>Property:</strong> </p><p><strong>Unit:</strong> </p><p><strong>Date:</strong> </p><p><strong>Inspector:</strong> </p><p><strong>Condition:</strong></p><ul><li>Exterior: </li><li>Interior: </li><li>Plumbing: </li><li>Electrical: </li><li>Structural: </li></ul><p><strong>Issues Found:</strong></p><ul><li> </li></ul><p><strong>Recommendations:</strong></p><ul><li> </li></ul>',
                                    deposition: '<h2>Deposition Notes</h2><p><strong>Witness:</strong> </p><p><strong>Date:</strong> </p><p><strong>Matter:</strong> </p><p><strong>Key Testimony:</strong></p><ul><li> </li></ul><p><strong>Contradictions:</strong></p><ul><li> </li></ul><p><strong>Follow-up Questions:</strong></p><ul><li> </li></ul>',
                                    call_log: '<h2>Call Log</h2><p><strong>Date/Time:</strong> </p><p><strong>Caller:</strong> </p><p><strong>Recipient:</strong> </p><p><strong>Duration:</strong> </p><p><strong>Summary:</strong></p><p></p><p><strong>Action Items:</strong></p><ul><li> </li></ul>',
                                };
                                const template = templates[e.target.value];
                                if (template) {
                                    editor.chain().focus().setContent(template).run();
                                    addToast('Template inserted', { type: 'success' });
                                }
                                e.target.value = '';
                            }}
                            className="text-2xs font-bold px-1.5 py-1 rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-700"
                            defaultValue=""
                            title="Insert a template"
                        >
                            <option value="">Template</option>
                            <option value="meeting">Meeting Notes</option>
                            <option value="matter_summary">Matter Summary</option>
                            <option value="property_inspection">Property Inspection</option>
                            <option value="deposition">Deposition Notes</option>
                            <option value="call_log">Call Log</option>
                        </select>
                    </div>
                )}
            </div>
            <div className="flex-grow min-h-0 relative overflow-y-auto custom-scrollbar">
                {!isDemo && !fullPage && !page.content && (
                    <div className="absolute inset-0 z-10 bg-white/50 dark:bg-zinc-900/50 flex items-center justify-center backdrop-blur-[1px]">
                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            Loading content...
                        </div>
                    </div>
                )}
                <EditorContent editor={editor} />

                {/* Bidirectional Link Autocomplete Dropdown */}
                {linkVisible && linkResults.length > 0 && (
                    <div
                        className="fixed z-[3000] bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden min-w-[280px] max-w-[360px] animate-in zoom-in-95 duration-150"
                        style={{ top: linkPosition.top, left: linkPosition.left }}
                    >
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-700">
                            <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Link to</p>
                        </div>
                        <div className="max-h-[240px] overflow-y-auto py-1">
                            {linkResults.map((result, index) => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onMouseDown={(e) => { e.preventDefault(); insertLink(result); }}
                                    onMouseEnter={() => setLinkSelectedIndex(index)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${index === linkSelectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-700/50'}`}
                                >
                                    <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-3xs font-black uppercase ${
                                        result.type === 'matter' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                        result.type === 'contact' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        result.type === 'property' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                        result.type === 'document' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                                        'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                                    }`}>
                                        {result.type.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-semibold truncate ${index === linkSelectedIndex ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-zinc-300'}`}>
                                            {result.label}
                                        </p>
                                        <p className="text-2xs text-slate-400 dark:text-zinc-500 capitalize">{result.subtitle}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="px-3 py-1 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-700 flex items-center gap-3 text-3xs text-slate-400">
                            <span>↑↓ Navigate</span>
                            <span>↵ Select</span>
                            <span>Esc Close</span>
                        </div>
                    </div>
                )}
                {/* Interim dictation text — shows words as they're being spoken
                    but not yet finalized. Appears as greyed text at the bottom
                    of the editor so the user sees real-time transcription. */}
                {isDictating && interimText && (
                    <div className="px-4 sm:px-6 pb-2 text-sm text-slate-400 dark:text-zinc-500 italic">
                        {interimText}…
                    </div>
                )}
            </div>

            {/* Dictation status bar — floating at the bottom while listening */}
            {isDictating && (
                <div className="flex-shrink-0 bg-red-500/10 border-t border-red-200 dark:border-red-900/30 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">Listening…</span>
                        <span className="text-2xs text-slate-400">Say "period", "comma", "new line" for punctuation</span>
                    </div>
                    <button
                        onClick={toggleDictation}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors"
                    >
                        Stop
                    </button>
                </div>
            )}

            {/* Footer — word count + markdown export */}
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-1.5 flex items-center justify-between text-2xs text-slate-400 dark:text-zinc-500">
                <span>
                    {(() => {
                        const text = editor?.getText() || '';
                        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
                        return `${words} word${words !== 1 ? 's' : ''}`;
                    })()}
                </span>
                <button
                    onClick={() => {
                        if (!editor) return;
                        const text = editor.getText();
                        const title = (document.getElementById(`note-title-input-${page.id}`) as HTMLInputElement)?.value || page.title || 'Note';
                        const blob = new Blob([`# ${title}\n\n${text}`], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.md`;
                        a.click();
                        URL.revokeObjectURL(url);
                    }}
                    className="hover:text-primary-600 dark:hover:text-primary-400 font-semibold transition-colors"
                    title="Export as Markdown"
                >
                    ⬇ Export .md
                </button>
            </div>
        </div>
    );
};
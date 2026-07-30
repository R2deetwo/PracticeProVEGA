import React, { useEffect, useRef, useCallback, useState } from 'react';
import { NotePage, Matter } from '../../types';
import { timeAgo } from '../../utils/colorUtils';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
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

    const toggleDictation = () => {
        if (isDictating) {
            recognitionRef.current?.stop();
            setIsDictating(false);
            setInterimText('');
            return;
        }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR || !editor) return;

        const recognition = new SR();
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
                // Process punctuation commands and insert
                const processed = processTranscript(finalTranscript);
                editor.chain().focus().insertContent(processed + ' ').run();
                setInterimText('');
            } else if (interim) {
                // Show interim text as a live preview
                setInterimText(processTranscript(interim));
            }
        };

        recognition.onerror = (event: Event) => {
            console.warn('[Dictation] Error:', (event as any).error);
            setIsDictating(false);
            setInterimText('');
        };

        recognition.onend = () => {
            setIsDictating(false);
            setInterimText('');
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsDictating(true);
        editor.commands.focus();
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

    const { currentUser } = useAuth();
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
                            (Chrome, Edge, Android WebView). Hidden on Safari. */}
                        {dictationSupported && (
                            <>
                                <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-1"></div>
                                <button
                                    onClick={toggleDictation}
                                    className={`p-1.5 rounded transition-all flex items-center gap-1 ${
                                        isDictating
                                            ? 'bg-red-500 text-white animate-pulse'
                                            : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500'
                                    }`}
                                    title={isDictating ? 'Stop dictation' : 'Start voice dictation'}
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                        <line x1="12" y1="19" x2="12" y2="23"/>
                                        <line x1="8" y1="23" x2="16" y2="23"/>
                                    </svg>
                                    {isDictating && <span className="text-3xs font-bold">Listening...</span>}
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
                            <option value="">📋 Template</option>
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
                        className="fixed z-[3000] bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden min-w-[280px] max-w-[360px] animate-in zoom-in-95 duration-150"
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
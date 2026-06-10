import React, { useEffect, useRef, useCallback } from 'react';
import { NotePage, Matter } from '../../types';
import { timeAgo } from '../../utils/colorUtils';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

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
    const saveTimeoutRef = useRef<number | null>(null);
    const isProgrammaticChange = useRef(false);
    const currentPageId = useRef<string | null>(null);

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
            Placeholder.configure({ placeholder: 'Start writing your note...' }),
        ],
        content: page.content || '',
        onUpdate: ({ editor }) => {
            if (!isProgrammaticChange.current) {
                debouncedSave(editor.getHTML());
            }
        },
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert prose-sm sm:prose-base focus:outline-none min-h-[500px] w-full max-w-none px-4 sm:px-6 py-4 custom-scrollbar',
            },
        },
    });

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
                
                {/* Minimal Tiptap Toolbar */}
                {editor && (
                    <div className="flex items-center gap-1 pt-2">
                        <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('bold') ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'}`}><b className="font-serif">B</b></button>
                        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('italic') ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'}`}><i className="font-serif">I</i></button>
                        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('underline') ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'}`}><u className="font-serif">U</u></button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-1"></div>
                        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 1 }) ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'} text-xs font-bold leading-none`}>H1</button>
                        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 2 }) ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'} text-xs font-bold leading-none`}>H2</button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-1"></div>
                        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('bulletList') ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'} text-xs leading-none`}>• List</button>
                        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 ${editor.isActive('orderedList') ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500'} text-xs leading-none`}>1. List</button>
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
            </div>
        </div>
    );
};
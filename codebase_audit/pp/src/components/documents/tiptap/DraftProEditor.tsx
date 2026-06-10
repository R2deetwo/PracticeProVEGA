/**
 * DraftPro 2.0 — Production-Grade Legal Word Processor
 * 
 * Features:
 *  - High-fidelity Ribbon Toolbar (Microsoft Word style)
 *  - TipTap editor with full extension suite (Tables, Images, Links, etc.)
 *  - Multi-page pagination (visual page breaks + sheet layout)
 *  - Letterhead support (Integrated HeaderRenderer)
 *  - In-app modals for all complex insertion tools
 *  - Responsive design with manual zooming/scaling for mobile
 *  - Auto-save and status indicators
 *  - Word/Character tracking
 */

import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    useMemo,
} from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { CharacterCount } from '@tiptap/extension-character-count';
import { Image as TiptapImage } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

import LegalPlaceholder from './extensions/LegalPlaceholder';
import { LegalPartiesGroup } from './extensions/LegalPartiesGroup';
import { FontSize } from './extensions/FontSize';
import { useProduct } from '../../../contexts/ProductContext';
import { useUI } from '../../../contexts/UIContext';
import { useDataState, useDataActions } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { HeaderRenderer } from '../HeaderRenderer';
import { HeaderDesigner } from '../HeaderDesigner';
import { HeaderConfiguration } from '../../../types';

// ─── Inline SVG Toolbar Icons (Heroicons 1.5px stroke — unified with constants.tsx) ───
const Bold: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.744h-.753v8.25h7.125a4.125 4.125 0 000-8.25H6.75zm0 0H6v8.25h.75m0-8.25h.75M6.75 12H5.25v8.25H14a4.25 4.25 0 000-8.25H6.75zm0 0v8.25" /></svg>;
const Italic: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 5.25h3m-6 13.5h3m1.5-13.5l-3 13.5" /></svg>;
const UnderlineIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 6v6a4.5 4.5 0 009 0V6M5.25 19.5h13.5" /></svg>;
const AlignLeft: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5M3.75 17.25h16.5" /></svg>;
const AlignCenter: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M6.75 12h10.5M3.75 17.25h16.5" /></svg>;
const AlignRight: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M9.75 12h10.5M3.75 17.25h16.5" /></svg>;
const AlignJustify: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" /></svg>;
const List: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.008v.008H3.75V12zm0 5.25h.008v.008H3.75v-.008z" /></svg>;
const ListOrdered: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M4.125 8.25h-.75m.75 0a.375.375 0 11-.75 0m.75 0h.75m-.75 4.5h-.75m.75 0a.375.375 0 11-.75 0m.75 0h.75" /></svg>;
const Indent: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h7.5m-7.5 5.25h16.5M10.5 9l3 3-3 3" /></svg>;
const Outdent: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h7.5m-7.5 5.25h16.5M13.5 9l-3 3 3 3" /></svg>;
const LinkIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>;
const ImageIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const TableIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125m18.375 1.125a1.125 1.125 0 001.125-1.125M3.375 4.5h17.25m-17.25 0a1.125 1.125 0 00-1.125 1.125m18.375-1.125a1.125 1.125 0 011.125 1.125m-18.375 0v13.5m18.375-13.5v13.5" /></svg>;
const Plus: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const Undo: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>;
const Redo: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg>;
const Printer: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
const Save: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;
const Type: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v12M11 11L7 15M13 11l4 4m0-10h5m-2.5-2.5v5" /></svg>;
const Scissors: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" /></svg>;
const Eraser: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const Minus: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>;
const Settings: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const Maximize2: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>;
const Minimize2: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>;
const ChevronDown: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>;



const PAGE_WIDTH_PX = 794;   // A4 Width at 96dpi (210mm)
const PAGE_HEIGHT_PX = 1123; // A4 Height at 96dpi (297mm)
const PAGE_MARGIN_PX = 96;   // ~25.4mm (1 inch) margins
const PAGE_GAP_PX = 40;      // Visible gap between physical sheets

const FONTS = [
    { label: 'Times New Roman', value: "'Times New Roman', serif" },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Calibri', value: 'Calibri, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Courier New', value: "'Courier New', monospace" },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72];

const COLORS = [
    '#000000', '#374151', '#6B7280', '#D1D5DB', '#EF4444', '#F97316',
    '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'
];

const HIGHLIGHTS = [
    '#FEF08A', '#BBF7D0', '#BAE6FD', '#FBCFE8', '#FED7AA', '#E9D5FF', '#F1F5F9'
];

// ─── Shared Components ────────────────────────────────────────────────────────

const ToolbarGroup: React.FC<{ label?: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
    <div className={`flex flex-col items-center border-r border-slate-200 dark:border-zinc-800 px-2 last:border-r-0 ${className}`}>
        <div className="flex items-center gap-0.5 mb-1">
            {children}
        </div>
        {label && <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500 tracking-tighter">{label}</span>}
    </div>
);

const ToolbarBtn: React.FC<{
    icon: any;
    label?: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}> = ({ icon: Icon, label, onClick, active, disabled, size = 'md', className = '' }) => {
    const sizeClasses = {
        sm: 'p-0.5',
        md: 'p-1',
        lg: 'p-1 flex-col gap-0.5 min-w-[42px]'
    };

    return (
        <button
            type="button"
            onMouseDown={e => { e.preventDefault(); onClick(); }}
            disabled={disabled}
            title={label}
            className={`
        flex items-center justify-center rounded transition-all
        ${sizeClasses[size]}
        ${active
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
        >
            <Icon className="w-4 h-4" />
            {size === 'lg' && label && <span className="text-[9px] font-medium leading-none">{label}</span>}
        </button>
    );
};

// ─── Main Editor Component ───────────────────────────────────────────────────

import * as aiService from '../../../services/aiService';

export interface DraftProEditorProps {
    initialContent?: string;
    draftPrompt?: string;
    onSave?: (html: string) => void;
    title?: string;
    onTitleChange?: (title: string) => void;
    disableAloaAutoOpen?: boolean;
    onBack?: () => void;
    linkedMatterId?: string;
}

export type DocumentEditorProps = DraftProEditorProps;

export const DraftProEditor: React.FC<DraftProEditorProps> = ({
    initialContent,
    draftPrompt,
    onSave,
    title,
    onTitleChange,
    onBack,
}) => {
    const { addToast } = useUI();
    const { appState } = useDataState();
    const { handleUpdateFirmDetails } = useDataActions();
    const { currentUser } = useAuth();
    const { isProperty } = useProduct();

    // States
    const [contentHeight, setContentHeight] = useState(PAGE_HEIGHT_PX);
    const [zoom, setZoom] = useState(1);
    const [isDrafting, setIsDrafting] = useState(false);
    const draftingPromptRef = useRef<string | null>(null);

    const [isHeaderDesignerOpen, setIsHeaderDesignerOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(true);
    const [placeholderCount, setPlaceholderCount] = useState(0);

    // Modals
    const [activeModal, setActiveModal] = useState<'placeholder' | 'link' | 'image' | 'table' | 'fill_placeholders' | 'save_template' | null>(null);
    const [modalInput, setModalInput] = useState('');
    const modalRef = useRef<HTMLInputElement>(null);

    const editorWrapRef = useRef<HTMLDivElement>(null);
    const contentLoadedRef = useRef(false);

    // Global placeholder fill modal trigger
    useEffect(() => {
        const handleOpenTarget = (e: any) => {
            setActiveModal('fill_placeholders');
        };
        window.addEventListener('open-placeholder-modal', handleOpenTarget);
        return () => window.removeEventListener('open-placeholder-modal', handleOpenTarget);
    }, []);

    // Editor Implementation
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
            }),
            Placeholder.configure({
                placeholder: 'Enter text here...',
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
                alignments: ['left', 'center', 'right', 'justify'],
            }),
            Underline,
            TextStyle,
            FontSize,
            FontFamily.configure({ types: ['textStyle'] }),
            Color,
            Highlight.configure({ multicolor: true }),
            Subscript,
            Superscript,
            CharacterCount,
            TiptapImage.configure({ inline: false, allowBase64: true }),
            Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline cursor-pointer' } }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Table.configure({ resizable: true }),
            TableRow,
            TableCell,
            TableHeader,
            LegalPlaceholder,
            LegalPartiesGroup,
        ],
        content: initialContent || '',
        editorProps: {
            attributes: {
                class: 'draftpro-editor-content focus:outline-none min-h-full w-full',
                style: 'font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; color: #111827; background: transparent;',
            },
            handleKeyDown: (view, event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                    event.preventDefault();
                    handleManualSave();
                    return true;
                }
                return false;
            }
        },
        onUpdate: ({ editor: e }) => {
            setIsSaved(false);

            // Measure height for pagination
            const el = editorWrapRef.current?.querySelector('.ProseMirror');
            if (el) setContentHeight(Math.max(PAGE_HEIGHT_PX, (el as HTMLElement).scrollHeight + (PAGE_MARGIN_PX * 2)));

            // Count Placeholders
            let count = 0;
            e.state.doc.descendants(node => {
                if (node.type.name === 'legalPlaceholder') count++;
            });
            setPlaceholderCount(count);
        },
    });

    // Run placeholder count on init as well
    useEffect(() => {
        if (!editor) return;
        let count = 0;
        editor.state.doc.descendants(node => {
            if (node.type.name === 'legalPlaceholder') count++;
        });
        setPlaceholderCount(count);
    }, [editor]);

    // AI Drafting Engine
    useEffect(() => {
        if (editor && draftPrompt && draftingPromptRef.current !== draftPrompt) {
            draftingPromptRef.current = draftPrompt;
            setIsDrafting(true);
            setIsSaved(false);

            // Buffer for the AI draft to prevent partial HTML injection
            let draftBuffer = '';

            // Clear editor with a temporary loading state (text content, not HTML to avoid parsing issues)
            editor.commands.setContent('<p><i>Drafting in progress...</i></p>');

            aiService.streamDraft(
                [{ role: 'user', content: draftPrompt }],
                { appState, currentUser: currentUser! }, // Fix: Pass real currentUser
                (chunk) => {
                    // Accumulate chunks ONLY
                    draftBuffer += chunk;
                }
            ).then(() => {
                setIsDrafting(false);
                if (editor && draftBuffer) {
                    const cleanDraft = draftBuffer.replace(/```html/g, '').replace(/```/g, '');
                    // parse placeholders like [TENANT NAME] into exact TipTap node format
                    const processedDraft = cleanDraft.replace(/\[([^\]]+)\]/g, '<span data-type="legal-placeholder" data-label="$1"></span>');
                    editor.commands.setContent(processedDraft);
                }
                addToast('Drafting complete', { type: 'success' });
            }).catch(e => {
                console.error("Drafting failed", e);
                setIsDrafting(false);
                addToast('Drafting failed. Please try again.', { type: 'error' });
            });
        }
    }, [editor, draftPrompt, appState]);

    // Load/Sync content when it changes (especially from AI Drafting)
    useEffect(() => {
        if (editor && initialContent !== undefined) {
            const currentHTML = editor.getHTML();
            if (currentHTML !== initialContent && (currentHTML === '<p></p>' || initialContent.length > currentHTML.length || !contentLoadedRef.current)) {
                editor.commands.setContent(initialContent);
                contentLoadedRef.current = true;
                setIsSaved(true);
            }
        }
    }, [editor, initialContent]);

    // Auto-zoom for mobile / Fit to width
    useEffect(() => {
        const fitToWidth = () => {
            const scrollArea = document.getElementById('draftpro-scroll-area');
            if (scrollArea) {
                const availableWidth = scrollArea.clientWidth - 40;
                if (availableWidth > 0) {
                    if (availableWidth < PAGE_WIDTH_PX) {
                        setZoom(Math.max(0.1, availableWidth / PAGE_WIDTH_PX));
                    } else {
                        setZoom(1);
                    }
                }
            }
        };

        const timer = setTimeout(fitToWidth, 100);
        window.addEventListener('resize', fitToWidth);
        return () => {
            window.removeEventListener('resize', fitToWidth);
            clearTimeout(timer);
        };
    }, [editor]); // Re-run when editor is ready

    const handleManualSave = useCallback(() => {
        if (editor) {
            onSave?.(editor.getHTML());
            setIsSaved(true);
            addToast('Document saved successfully', { type: 'success' });
        }
    }, [editor, onSave, addToast]);

    const handlePrint = useCallback(() => {
        if (!editor) return;
        let hasPlaceholders = false;
        editor.state.doc.descendants((node) => {
            if (node.type.name === 'legalPlaceholder') hasPlaceholders = true;
        });

        if (hasPlaceholders) {
            addToast('Cannot Print: Please fill all outstanding placeholders first.', { type: 'error' });
            setActiveModal('fill_placeholders');
            return;
        }
        window.print();
    }, [editor, addToast]);

    // Page Calculations
    // Content height includes margins; page height is fixed
    const pageCount = Math.max(1, Math.ceil(contentHeight / PAGE_HEIGHT_PX));

    // Insertion Handlers
    const insertPlaceholder = () => {
        const val = modalInput.trim().toUpperCase();
        if (val && editor) {
            editor.chain().focus().insertContent([{
                type: 'legalPlaceholder',
                attrs: { label: val }
            }]).run();
            setActiveModal(null);
            setModalInput('');
        }
    };

    const insertLink = () => {
        if (editor) {
            if (modalInput === '') {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
            } else {
                editor.chain().focus().extendMarkRange('link').setLink({ href: modalInput }).run();
            }
            setActiveModal(null);
            setModalInput('');
        }
    };

    const handleSaveAsTemplate = () => {
        if (!editor) return;
        const name = modalInput.trim();
        if (!name) {
            addToast('Please enter a template name', { type: 'error' });
            return;
        }

        const placeholders: string[] = [];
        editor.state.doc.descendants(node => {
            if (node.type.name === 'legalPlaceholder') {
                placeholders.push(node.attrs.label);
            }
        });

        const newTemplate: any = {
            id: `temp-${Date.now()}`,
            firmId: appState.firmDetails.id,
            name,
            content: editor.getHTML(),
            createdAt: new Date().toISOString(),
            placeholders: Array.from(new Set(placeholders))
        };

        const actions: any = (window as any).dataActions;
        if (actions?.addItem) {
            actions.addItem('documentTemplates', newTemplate, 'Document Template');
            addToast('Template saved successfully', { type: 'success' });
            setActiveModal(null);
            setModalInput('');
        } else {
            addToast('Storage service unavailable', { type: 'error' });
        }
    };

    const insertTable = () => {
        if (editor) {
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            setActiveModal(null);
        }
    };

    // if (!editor) return null; // Removed to prevent "black screen" during init

    return (
        <div className="flex flex-col h-full bg-slate-100 dark:bg-zinc-950 overflow-hidden font-sans">

            {/* ── Top bar (Title + Meta) ── */}
            <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 h-12 flex items-center justify-between z-[60] no-print">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={() => onBack ? onBack() : window.history.back()}
                        className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white text-xs font-bold transition-colors"
                    >
                        <ChevronDown className="w-4 h-4 rotate-90" />
                        <span className="hidden sm:inline">Back</span>
                    </button>

                    <div className="w-px h-4 bg-slate-200 dark:bg-zinc-800" />

                    <input autoComplete="off" data-lpignore="true" 
                        value={title || ''}
                        onChange={e => onTitleChange?.(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm font-bold text-slate-900 dark:text-white focus:ring-0 min-w-0 truncate max-w-[300px]"
                        placeholder="Untitled Document"
                    />

                    {!isSaved && (
                        <div className="flex items-center gap-1 text-[9px] text-amber-500 font-bold uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                            <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                            Unsaved
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all shadow-sm active:scale-95"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        Print/PDF
                    </button>
                    <button
                        onClick={handleManualSave}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
                    >
                        <Save className="w-3.5 h-3.5" />
                        Save
                    </button>
                </div>
            </div>

            {/* ── Ribbon Toolbar ── */}
            <div className="flex-shrink-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 shadow-sm z-50">
                <div className="flex items-stretch gap-0 px-1 py-1 overflow-x-auto custom-scrollbar no-scrollbar">

                    <ToolbarGroup label="File">
                        <ToolbarBtn icon={Save} label="Save" onClick={handleManualSave} size="lg" disabled={isSaved || !editor} />
                        <div className="flex flex-col gap-0.5">
                            <ToolbarBtn icon={Undo} onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} size="sm" label="Undo" />
                            <ToolbarBtn icon={Redo} onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} size="sm" label="Redo" />
                        </div>
                        <ToolbarBtn icon={Printer} onClick={handlePrint} size="sm" label="Print" />
                    </ToolbarGroup>

                    <ToolbarGroup label="Font">
                        <div className="flex flex-col gap-1 min-w-[140px]">
                            {/* Font Family Selector */}
                            <div className="relative group">
                                <select
                                    className="w-full text-[11px] h-6 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1 outline-none appearance-none pr-4"
                                    onChange={(e) => editor?.chain().focus().setFontFamily(e.target.value).run()}
                                    value={editor?.getAttributes('textStyle').fontFamily || "'Times New Roman', serif"}
                                    disabled={!editor}
                                >
                                    {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                                <ChevronDown className="absolute right-1 top-1.5 w-3 h-3 text-slate-400 pointer-events-none" />
                            </div>

                            <div className="flex items-center gap-1">
                                {/* Font Size Selector */}
                                <div className="relative">
                                    <select
                                        className="w-14 text-[11px] h-6 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1 outline-none appearance-none pr-4"
                                        onChange={(e) => (editor?.chain().focus() as any).setFontSize(`${e.target.value}pt`).run()}
                                        value={(editor?.getAttributes('textStyle').fontSize || '12pt').replace('pt', '')}
                                        disabled={!editor}
                                    >
                                        {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-1 top-1.5 w-3 h-3 text-slate-400 pointer-events-none" />
                                </div>

                                <ToolbarBtn icon={Eraser} onClick={() => editor?.chain().focus().unsetAllMarks().run()} size="sm" label="Clear Format" disabled={!editor} />

                                {/* Color Picker (Simplified) */}
                                <input autoComplete="off" data-lpignore="true" 
                                    type="color"
                                    className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer rounded overflow-hidden"
                                    onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
                                    title="Text Color"
                                    disabled={!editor}
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-0.5 w-[84px] ml-1">
                            <ToolbarBtn icon={Bold} onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={Italic} onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={UnderlineIcon} onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={Minus} onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} size="sm" disabled={!editor} />
                        </div>
                    </ToolbarGroup>

                    <ToolbarGroup label="Paragraph">
                        <div className="grid grid-cols-4 gap-0.5">
                            <ToolbarBtn icon={AlignLeft} onClick={() => editor?.chain().focus().setTextAlign('left').run()} active={editor?.isActive({ textAlign: 'left' })} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={AlignCenter} onClick={() => editor?.chain().focus().setTextAlign('center').run()} active={editor?.isActive({ textAlign: 'center' })} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={AlignRight} onClick={() => editor?.chain().focus().setTextAlign('right').run()} active={editor?.isActive({ textAlign: 'right' })} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={AlignJustify} onClick={() => editor?.chain().focus().setTextAlign('justify').run()} active={editor?.isActive({ textAlign: 'justify' })} size="sm" disabled={!editor} />

                            <ToolbarBtn icon={List} onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={ListOrdered} onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={Outdent} onClick={() => editor?.chain().focus().liftListItem('listItem').run()} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={Indent} onClick={() => editor?.chain().focus().sinkListItem('listItem').run()} size="sm" disabled={!editor} />
                        </div>

                        <div className="flex flex-col gap-1 ml-1 h-full">
                            <div className="flex gap-1">
                                <ToolbarBtn
                                    icon={Minus}
                                    onClick={() => editor?.chain().focus().selectAll().updateAttributes('paragraph', { lineHeight: '1.0' }).run()}
                                    size="sm"
                                    label="Single Space"
                                    disabled={!editor}
                                />
                                <ToolbarBtn
                                    icon={Plus}
                                    onClick={() => editor?.chain().focus().selectAll().updateAttributes('paragraph', { lineHeight: '2.0' }).run()}
                                    size="sm"
                                    label="Double Space"
                                    disabled={!editor}
                                />
                            </div>
                            <div className="relative group mt-auto">
                                <select
                                    className="w-24 text-[10px] h-6 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1 outline-none"
                                    onChange={(e) => {
                                        const level = parseInt(e.target.value);
                                        if (level === 0) editor?.chain().focus().setParagraph().run();
                                        else editor?.chain().focus().toggleHeading({ level: level as any }).run();
                                    }}
                                    value={
                                        editor?.isActive('heading', { level: 1 }) ? 1 :
                                            editor?.isActive('heading', { level: 2 }) ? 2 :
                                                editor?.isActive('heading', { level: 3 }) ? 3 : 0
                                    }
                                    disabled={!editor}
                                >
                                    <option value="0">Normal Text</option>
                                    <option value="1">Heading 1</option>
                                    <option value="2">Heading 2</option>
                                    <option value="3">Heading 3</option>
                                </select>
                            </div>
                        </div>
                    </ToolbarGroup>

                    <ToolbarGroup label={isProperty ? 'Portfolio' : 'Insert'}>
                        <ToolbarBtn icon={LinkIcon} label="Link" onClick={() => { setModalInput(editor?.getAttributes('link').href || ''); setActiveModal('link'); setTimeout(() => modalRef.current?.focus(), 50); }} size="lg" active={editor?.isActive('link')} disabled={!editor} />
                        <ToolbarBtn icon={ImageIcon} label="Image" onClick={() => setActiveModal('image')} size="lg" disabled={!editor} />
                        <ToolbarBtn icon={TableIcon} label="Table" onClick={() => setActiveModal('table')} size="lg" disabled={!editor} />
                        <ToolbarBtn icon={Type} label="Placeholder" onClick={() => setActiveModal('placeholder')} size="lg" className="text-amber-600 dark:text-amber-400" disabled={!editor} />
                    </ToolbarGroup>

                    <ToolbarGroup label={isProperty ? 'Drafting' : 'Legal Tools'}>
                        <ToolbarBtn icon={Settings} label="Header" onClick={() => setIsHeaderDesignerOpen(true)} size="lg" />
                        <ToolbarBtn icon={Scissors} label={`Fill Blanks (${placeholderCount})`} onClick={() => setActiveModal('fill_placeholders')} size="lg" className="text-amber-600 dark:text-amber-400" />
                        <ToolbarBtn icon={Plus} label="Group Parties" onClick={() => editor?.chain().focus().insertContent('<div data-type="legal-parties-group"><p>Party Name</p></div>').run()} size="lg" className="text-indigo-600" />
                        <ToolbarBtn icon={Save} label="Save Template" onClick={() => { setModalInput(title || ''); setActiveModal('save_template'); }} size="lg" className="text-primary-600" />
                        <div className="flex flex-col gap-0.5 justify-center ml-2">
                            <div className="text-[10px] font-bold text-slate-400">Words: {editor?.storage.characterCount.words() || 0}</div>
                            <div className="text-[10px] font-bold text-slate-400">Chars: {editor?.storage.characterCount.characters() || 0}</div>
                        </div>
                    </ToolbarGroup>

                    <div className="flex-1" />

                    <ToolbarGroup className="items-end">
                        <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700">
                            <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="p-1 text-slate-400 hover:text-slate-600" title="Zoom Out"><Minimize2 className="w-3 h-3" /></button>
                            <button onClick={() => {
                                const scrollArea = document.getElementById('draftpro-scroll-area');
                                if (scrollArea) setZoom((scrollArea.clientWidth - 40) / PAGE_WIDTH_PX);
                            }} className="text-[10px] font-bold w-12 text-center hover:text-blue-600" title="Fit to Width">{Math.round(zoom * 100)}%</button>
                            <button onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} className="p-1 text-slate-400 hover:text-slate-600" title="Zoom In"><Maximize2 className="w-3 h-3" /></button>
                        </div>
                    </ToolbarGroup>

                </div>
            </div>

            {/* ── Editor Canvas ── */}
            <div
                className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-10 flex justify-center custom-scrollbar"
                style={{ background: '#e2e8f0' }}
                id="draftpro-scroll-area"
            >
                {/* 
                   Wrap in a div that controls the layout space. 
                   The scale() transform doesn't change the layout flow.
                */}
                <div
                    style={{
                        width: `${PAGE_WIDTH_PX * zoom}px`,
                        height: `${(PAGE_HEIGHT_PX * pageCount + (PAGE_GAP_PX * (pageCount - 1))) * zoom}px`,
                        transition: 'all 0.2s ease-out',
                        position: 'relative'
                    }}
                    className="flex justify-center mb-20 shrink-0"
                >
                    <div
                        className="relative origin-top shrink-0"
                        style={{
                            width: `${PAGE_WIDTH_PX}px`,
                            transform: `scale(${zoom})`,
                        }}
                    >
                        {/* --- Background Page Simulations --- */}
                        <div className="absolute inset-0 pointer-events-none z-0 flex flex-col gap-[40px]">
                            {Array.from({ length: pageCount }).map((_, i) => (
                                <div 
                                    key={i}
                                    className="bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.4)] border border-slate-200 dark:border-zinc-800 relative shrink-0"
                                    style={{
                                        width: '100%',
                                        height: `${PAGE_HEIGHT_PX}px`
                                    }}
                                >
                                    {/* The Letterhead */}
                                    {(i === 0 || appState.firmDetails.settings?.headerConfig?.showOnAllPages) && (
                                        <div className="absolute left-0 right-0 z-10 top-0">
                                            <HeaderRenderer config={appState.firmDetails.settings?.headerConfig} />
                                        </div>
                                    )}

                                    {/* Page Number / Footer */}
                                    <div className="absolute left-0 right-0 bottom-8 text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] z-10 print:hidden">
                                        Page {i + 1}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* --- Editor Content --- */}
                        <div
                            ref={editorWrapRef}
                            className="relative z-20 min-h-screen"
                            style={{
                                padding: `${PAGE_MARGIN_PX}px`,
                                paddingTop: '100px', // Adjusted to start closer to header
                            }}
                        >
                            {!editor && (
                                <div className="flex items-center justify-center h-40">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                                </div>
                            )}
                            <EditorContent editor={editor} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── In-App Modals ── */}
            {
                activeModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
                        <div className={`relative z-10 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 w-full ${activeModal === 'fill_placeholders' ? 'max-w-md' : 'max-w-sm'} mx-4 animate-in zoom-in-95 duration-200`}>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                {activeModal === 'placeholder' && <><Type className="w-5 h-5 text-amber-500" /> Insert Placeholder</>}
                                {activeModal === 'fill_placeholders' && <><Scissors className="w-5 h-5 text-amber-500" /> Smart Fill Placeholders</>}
                                {activeModal === 'link' && <><LinkIcon className="w-5 h-5 text-blue-500" /> Insert Link</>}
                                {activeModal === 'image' && <><ImageIcon className="w-5 h-5 text-emerald-500" /> Insert Image</>}
                                {activeModal === 'table' && <><TableIcon className="w-5 h-5 text-slate-500" /> Create Table</>}
                            </h3>

                            {activeModal === 'placeholder' && (
                                <div className="space-y-4">
                                    <input autoComplete="off" data-lpignore="true" 
                                        ref={modalRef}
                                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                                        placeholder="e.g. TENANT NAME"
                                        value={modalInput}
                                        onChange={e => setModalInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && insertPlaceholder()}
                                    />
                                    <button onClick={insertPlaceholder} className="w-full bg-amber-500 text-white font-bold py-2 rounded-lg hover:bg-amber-600 transition-colors">Insert</button>
                                </div>
                            )}

                            {activeModal === 'fill_placeholders' && (() => {
                                const nodesToFill: { pos: number, size: number, label: string }[] = [];
                                editor?.state.doc.descendants((node, pos) => {
                                    if (node.type.name === 'legalPlaceholder') {
                                        nodesToFill.push({ pos, size: node.nodeSize, label: node.attrs.label });
                                    }
                                });

                                // Get unique labels to list in the UI
                                const uniqueLabels = Array.from(new Set(nodesToFill.map(n => n.label)));

                                const processFill = () => {
                                    const form = document.getElementById('fill-placeholders-form') as HTMLFormElement;
                                    if (!form) return;
                                    const formData = new FormData(form);
                                    const values: Record<string, string> = {};
                                    formData.forEach((val, key) => { values[key] = val as string; });

                                    // Apply from bottom up to avoid pos shifts
                                    nodesToFill.sort((a, b) => b.pos - a.pos).forEach(n => {
                                        if (values[n.label]) {
                                            editor?.chain().deleteRange({ from: n.pos, to: n.pos + n.size }).insertContentAt(n.pos, values[n.label]).run();
                                        }
                                    });
                                    setActiveModal(null);
                                    addToast('Placeholders filled.', { type: 'success' });
                                };

                                if (uniqueLabels.length === 0) {
                                    return (
                                        <div className="space-y-4">
                                            <p className="text-sm text-slate-500">No placeholders found in this document.</p>
                                            <button onClick={() => setActiveModal(null)} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">Close</button>
                                        </div>
                                    );
                                }

                                return (
                                    <form id="fill-placeholders-form" className="space-y-4" onSubmit={e => { e.preventDefault(); processFill(); }}>
                                        <div className="max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar pr-2">
                                            {uniqueLabels.map(label => (
                                                <div key={label} className="flex flex-col gap-1">
                                                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 capitalize">{label.toLowerCase()}</label>
                                                    <input autoComplete="off" data-lpignore="true" 
                                                        name={label}
                                                        required
                                                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                                                        placeholder={`Enter ${label.toLowerCase()}...`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                                            <button type="button" onClick={() => setActiveModal(null)} className="flex-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 font-bold py-2 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
                                            <button type="submit" className="flex-1 bg-amber-500 text-white font-bold py-2 rounded-lg hover:bg-amber-600 transition-colors">Apply All</button>
                                        </div>
                                    </form>
                                );
                            })()}

                            {activeModal === 'save_template' && (
                                <div className="space-y-4">
                                    <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg border border-primary-100 dark:border-primary-800 mb-2">
                                        <p className="text-[11px] text-primary-700 dark:text-primary-300">
                                            Saving this document as a template will preserve all placeholders for future automated filling.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Template Name</label>
                                        <input autoComplete="off" data-lpignore="true" 
                                            ref={modalRef}
                                            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                            placeholder="e.g. Standard Tenancy Agreement"
                                            value={modalInput}
                                            onChange={e => setModalInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSaveAsTemplate()}
                                        />
                                    </div>
                                    <button onClick={handleSaveAsTemplate} className="w-full bg-primary-600 text-white font-bold py-2 rounded-lg hover:bg-primary-700 transition-colors shadow-lg">Save Template</button>
                                </div>
                            )}

                            {activeModal === 'link' && (
                                <div className="space-y-4">
                                    <input autoComplete="off" data-lpignore="true" 
                                        ref={modalRef}
                                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="https://..."
                                        value={modalInput}
                                        onChange={e => setModalInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && insertLink()}
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => { setModalInput(''); insertLink(); }} className="flex-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 font-bold py-2 rounded-lg hover:bg-slate-200 transition-colors">Clear Link</button>
                                        <button onClick={insertLink} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors">Apply</button>
                                    </div>
                                </div>
                            )}

                            {activeModal === 'image' && (
                                <div className="space-y-4 text-center">
                                    <p className="text-sm text-slate-500">Pick an image from your computer to insert.</p>
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        id="editor-image-upload"
                                        onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = () => {
                                                    editor.chain().focus().setImage({ src: reader.result as string }).run();
                                                    setActiveModal(null);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                    <label htmlFor="editor-image-upload" className="block w-full bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-700 cursor-pointer transition-colors">Choose File</label>
                                </div>
                            )}

                            {activeModal === 'table' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-500">This will insert a 3x3 table with a header row.</p>
                                    <button onClick={insertTable} className="w-full bg-slate-800 text-white font-bold py-2 rounded-lg hover:bg-black transition-colors">Insert Table</button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* ── Letterhead Designer Modal ── */}
            {
                isHeaderDesignerOpen && (
                    <HeaderDesigner
                        config={appState.firmDetails.settings?.headerConfig || {
                            firmName: { text: appState.firmDetails.name, fontSize: 32, fontWeight: 'bold', color: '#000000', alignment: 'center', x: 250, y: 40 },
                            address: { text: appState.firmDetails.address, fontSize: 14, alignment: 'center', x: 250, y: 90 },
                            showOnAllPages: true
                        }}
                        onChange={(newConfig) => handleUpdateFirmDetails({
                            ...appState.firmDetails,
                            settings: { ...appState.firmDetails.settings, headerConfig: newConfig }
                        })}
                        onClose={() => setIsHeaderDesignerOpen(false)}
                    />
                )
            }

            {/* ── Styles ── */}
            <style>{`
        .draftpro-editor-content { padding-bottom: 200px; }
        .draftpro-editor-content h1 { font-size: 16pt; font-weight: bold; text-transform: uppercase; text-align: center; margin: 1em 0; }
        .draftpro-editor-content h2 { font-size: 14pt; font-weight: bold; margin: 1em 0; }
        .draftpro-editor-content h3 { font-size: 12pt; font-weight: bold; text-decoration: underline; margin: 1em 0; }
        .draftpro-editor-content p  { margin: 0 0 1em 0; }
        .draftpro-editor-content ul, .draftpro-editor-content ol { padding-left: 1.5em; margin-bottom: 1em; }
        .draftpro-editor-content li { margin-bottom: 0.25em; }
        .draftpro-editor-content table { border-collapse: collapse; width: 100%; margin-bottom: 1.5em; }
        .draftpro-editor-content th, .draftpro-editor-content td { border: 1px solid #cbd5e1; padding: 8px 12px; min-width: 1em; position: relative; }
        .draftpro-editor-content th { background: #f8fafc; font-weight: bold; text-align: left; }
        .draftpro-editor-content img { max-width: 100%; height: auto; border-radius: 4px; margin: 1em 0; }
        
        /* Force line breaks and page break avoidance */
        .draftpro-editor-content p, .draftpro-editor-content li, .draftpro-editor-content h1, .draftpro-editor-content h2 {
            break-inside: avoid-page;
            page-break-inside: avoid;
        }

        .draftpro-editor-content .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        /* Custom scrollbar for toolbar */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @page { size: A4; margin: 0mm; }
        @media print {
          body * { visibility: hidden; }
          #draftpro-scroll-area, #draftpro-scroll-area * { visibility: visible; }
          #draftpro-scroll-area { 
            position: absolute; left: 0; top: 0; width: 100%; 
            padding: 0 !important; margin: 0 !important; 
            background: white !important; overflow: visible !important; 
            transform: none !important;
          }
          /* Hide the page gaps and desk in print */
          .absolute.left-\[-100px\].right-\[-100px\] { display: none !important; }
          .shadow-2xl { box-shadow: none !important; border: none !important; }
          /* Ensure explicit page breaks at height */
          .relative.z-0.bg-white { padding: 0 !important; }
          .draftpro-editor-content { padding-bottom: 0 !important; }
        }
      `}</style>
        </div >
    );
};

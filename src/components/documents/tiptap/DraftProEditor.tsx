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
import { DOMSerializer } from 'prosemirror-model';
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
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import LegalPlaceholder, { resolveCategory } from './extensions/LegalPlaceholder';
import { getPlaceholderDef, resolveAutoFill, PlaceholderCategory, PLACEHOLDER_REGISTRY } from '../../../constants/placeholderRegistry';
import GenerationOverlay from './GenerationOverlay';
import { LegalPartiesGroup } from './extensions/LegalPartiesGroup';
import { PageBreak } from './extensions/PageBreak';
import { FontSize } from './extensions/FontSize';
import { useProduct, useSignerContext } from '../../../contexts/ProductContext';
import { useUI } from '../../../contexts/UIContext';
import { useDataState, useDataActions } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useAloa } from '../../../contexts/AloaProvider';
import { HeaderRenderer } from '../HeaderRenderer';
import { HeaderDesigner } from '../HeaderDesigner';
import { HeaderConfiguration } from '../../../types';

// ─── Inline SVG Toolbar Icons (Heroicons 1.5px stroke — unified with constants.tsx) ───
const Sparkles: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>;
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
const Wand: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>;
const SubscriptIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25L9.75 12l-6 6.75m9-13.5L12.75 12l6 6.75" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 18.75h-3v-1.5l1.5-1.5c.75-.75 1.5-1.125 1.5-1.875 0-.75-.375-1.125-1.125-1.125S17.25 13.5 17.25 14.25" strokeWidth={1.2} /></svg>;
const SuperscriptIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25L9.75 12l-6 6.75m9-13.5L12.75 12l6 6.75" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.5h-3V6l1.5-1.5c.75-.75 1.5-1.125 1.5-1.875 0-.75-.375-1.125-1.125-1.125S17.25 2.25 17.25 3" strokeWidth={1.2} /></svg>;
const StrikethroughIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M6.75 6.75c0-1.257.933-2.25 2.25-2.25 1.257 0 2.25.933 2.25 2.25 0 1.257-.933 2.25-2.25 2.25M17.25 6.75c0-1.257-.933-2.25-2.25-2.25-1.257 0-2.25.933-2.25 2.25 0 1.257.933 2.25 2.25 2.25M6.75 17.25c0 1.257.933 2.25 2.25 2.25 1.257 0 2.25-.933 2.25-2.25 0-1.257-.933-2.25-2.25-2.25M17.25 17.25c0 1.257-.933 2.25-2.25 2.25-1.257 0-2.25-.933-2.25-2.25 0-1.257.933-2.25 2.25-2.25" /></svg>;
const PageBreakIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.2} /><line x1="3" y1="12" x2="21" y2="12" strokeDasharray="3 3" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-2 3 2 3M16 9l2 3-2 3" /></svg>;

// Document Header icon — a page with a highlighted top section (represents
// letterhead / page header, NOT a settings gear)
const DocumentHeaderIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 9.75v4.5m15 0v3a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 17.25v-3m15 0H4.5" /><rect x="6.5" y="6" width="11" height="3.5" rx="0.5" fill="currentColor" fillOpacity="0.18" stroke="none" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 16h8M8 18.5h5" strokeWidth={1} /></svg>;

// New Document icon — a page with a plus sign
const NewDocumentIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 9.75v4.5m15 0v3a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 17.25v-3m15 0H4.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 11v4m-2-2h4" strokeWidth={2} /></svg>;


// ─── A4 Page Dimensions at 96 dpi ────────────────────────────────────────────
const PAGE_WIDTH_PX  = 794;   // 210 mm
const PAGE_HEIGHT_PX = 1123;  // 297 mm
const PAGE_MARGIN_PX = 96;    // ~25.4 mm (1 inch)
const PAGE_GAP_PX    = 40;    // Gap between page sheets in the canvas
const HEADER_HEIGHT_PX = 80;  // Space reserved for letterhead below top margin
const FOOTER_HEIGHT_PX = 40;  // Space reserved for page number above bottom margin
// Usable body height per page (content area between header and footer)
const USABLE_CONTENT_HEIGHT = PAGE_HEIGHT_PX - (PAGE_MARGIN_PX * 2) - HEADER_HEIGHT_PX - FOOTER_HEIGHT_PX;

const FONTS = [
    { label: 'Times New Roman', value: "'Times New Roman', serif" },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Calibri', value: 'Calibri, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Courier New', value: "'Courier New', monospace" },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
];

// ─── Clipboard HTML Cleaner ──────────────────────────────────────────────────
// Strips background colours, dark-mode artifacts, and DraftPro-specific
// attributes from copied HTML so that pasting into Word / Google Docs
// produces clean text with bold / italic / underline preserved and
// NO dark-rectangle background.
const CLEAN_PRESERVE_STYLES = new Set([
    'font-weight', 'font-style', 'font-family', 'font-size',
    'text-decoration', 'text-decoration-line', 'text-align',
    'text-indent', 'line-height', 'list-style-type',
    'margin-left', 'margin-right', 'text-transform',
]);

function cleanForClipboard(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 1. Convert DraftPro placeholder / context atoms to readable plain text
    doc.querySelectorAll('span[data-type="legal-placeholder"]').forEach(el => {
        const label = el.getAttribute('data-label') || 'PLACEHOLDER';
        el.replaceWith(doc.createTextNode(`[${label}]`));
    });
    doc.querySelectorAll('span[data-type="legal-context"]').forEach(el => {
        const label = el.getAttribute('data-label') || '';
        el.replaceWith(doc.createTextNode(label));
    });

    // 2. Walk every element — strip classes, data-attrs, and non-essential styles
    doc.body.querySelectorAll('*').forEach(el => {
        // Remove Tailwind class attrs (meaningless outside the app)
        el.removeAttribute('class');

        // Remove DraftPro data-* attributes
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) el.removeAttribute(attr.name);
        });

        // Keep only formatting styles; drop background-color, background, color: white, etc.
        if (el.hasAttribute('style')) {
            const raw = el.getAttribute('style') || '';
            const kept: string[] = [];

            raw.split(';').forEach(decl => {
                const trimmed = decl.trim();
                if (!trimmed) return;
                const colonIdx = trimmed.indexOf(':');
                if (colonIdx === -1) return;
                const prop = trimmed.substring(0, colonIdx).trim().toLowerCase();
                const val   = trimmed.substring(colonIdx + 1).trim().toLowerCase();

                // Always drop background and background-color
                if (prop === 'background' || prop === 'background-color') return;

                // Drop colour styles that would be invisible on a white page
                if (prop === 'color') {
                    const invisible = ['#fff', '#ffffff', 'white', 'rgb(255, 255, 255)', 'rgba(255,255,255'];
                    if (invisible.some(c => val.includes(c))) return;
                }

                if (CLEAN_PRESERVE_STYLES.has(prop)) kept.push(trimmed);
            });

            if (kept.length > 0) {
                el.setAttribute('style', kept.join('; ') + ';');
            } else {
                el.removeAttribute('style');
            }
        }
    });

    // 3. Remove empty <span> wrappers left after attribute stripping
    doc.body.querySelectorAll('span').forEach(el => {
        if (!el.attributes.length && !el.children.length && el.textContent === '') {
            el.remove();
        }
    });

    return doc.body.innerHTML;
}

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72];

const COLORS = [
    '#000000', '#374151', '#6B7280', '#D1D5DB', '#EF4444', '#F97316',
    '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'
];

const HIGHLIGHTS = [
    '#FEF08A', '#BBF7D0', '#BAE6FD', '#FBCFE8', '#FED7AA', '#E9D5FF', '#F1F5F9'
];

// ─── Shared Components ────────────────────────────────────────────────────────

// Slimmer toolbar: items top-aligned, single uniform label baseline at the bottom.
const ToolbarGroup: React.FC<{ label?: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
    <div className={`flex flex-col items-stretch border-r border-slate-200 dark:border-zinc-800 px-2 last:border-r-0 ${className}`}>
        {/* Buttons row — items-top so variable-height groups still align */}
        <div className="flex items-start gap-0.5 py-1">
            {children}
        </div>
        {/* Uniform baseline label — same vertical position for every group */}
        {label && <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500 tracking-tighter leading-none pb-0.5 h-[12px] flex items-center justify-center">{label}</span>}
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

// ─── Auto Pagination Extension ───────────────────────────────────────────────
const AutoPagination = Extension.create({
    name: 'autoPagination',

    addProseMirrorPlugins() {
        const pluginKey = new PluginKey('autoPagination');

        return [
            new Plugin({
                key: pluginKey,
                state: {
                    init() {
                        return DecorationSet.empty;
                    },
                    apply(tr, set) {
                        const meta = tr.getMeta(pluginKey);
                        if (meta) {
                            return meta;
                        }
                        return set.map(tr.mapping, tr.doc);
                    },
                },
                props: {
                    decorations(state) {
                        return pluginKey.getState(state);
                    },
                },
                view() {
                    return {
                        update(view, prevState) {
                            if (prevState.doc.eq(view.state.doc) && !view.state.tr.getMeta('forcePagination')) return;

                            requestAnimationFrame(() => {
                                const TOP_RESERVED = PAGE_MARGIN_PX + HEADER_HEIGHT_PX; // 176
                                const BOTTOM_RESERVED = PAGE_MARGIN_PX + FOOTER_HEIGHT_PX; // 136

                                let spaceUsed = 0;
                                const decos: Decoration[] = [];

                                view.state.doc.descendants((node, pos) => {
                                    if (node.isBlock && view.state.doc.resolve(pos).depth === 0) {
                                        const dom = view.nodeDOM(pos) as HTMLElement;
                                        if (dom) {
                                            const style = window.getComputedStyle(dom);
                                            const marginBottom = parseFloat(style.marginBottom) || 0;
                                            const childHeight = dom.offsetHeight + marginBottom;

                                            if (spaceUsed + childHeight > USABLE_CONTENT_HEIGHT) {
                                                const spaceLeft = USABLE_CONTENT_HEIGHT - spaceUsed;
                                                const jumpMargin = spaceLeft + BOTTOM_RESERVED + PAGE_GAP_PX + TOP_RESERVED;

                                                decos.push(
                                                    Decoration.node(pos, pos + node.nodeSize, {
                                                        style: `margin-top: ${jumpMargin}px !important;`,
                                                        class: 'auto-paginated-node'
                                                    })
                                                );

                                                spaceUsed = childHeight;
                                            } else {
                                                spaceUsed += childHeight;
                                            }
                                        }
                                    }
                                    return false; // Don't descend
                                });

                                const currentSet = pluginKey.getState(view.state) as DecorationSet;
                                const currentArray = currentSet.find();

                                let isDifferent = decos.length !== currentArray.length;
                                if (!isDifferent) {
                                    for (let i = 0; i < decos.length; i++) {
                                        const d1 = decos[i] as any;
                                        const d2 = currentArray[i] as any;
                                        if (
                                            d1.from !== d2.from ||
                                            d1.to !== d2.to ||
                                            d1.type.attrs.style !== d2.type.attrs.style
                                        ) {
                                            isDifferent = true;
                                            break;
                                        }
                                    }
                                }

                                if (isDifferent) {
                                    const newSet = DecorationSet.create(view.state.doc, decos);
                                    view.dispatch(view.state.tr.setMeta(pluginKey, newSet));
                                }
                            });
                        },
                    };
                },
            }),
        ];
    },
});

// ─── Main Editor Component ───────────────────────────────────────────────────

import * as aiService from '../../../services/aiService';

export interface DraftProEditorProps {
    initialContent?: string;
    /** The original prompt used to generate (or last redraft of) this document.
     *  Always passed by WordProcessor so the Redraft button has access even when
     *  auto-drafting is disabled. */
    draftPrompt?: string;
    /** When false, opening the editor will NOT auto-start drafting even if
     *  draftPrompt is set. Used when reopening a persisted draft. */
    autoStartDrafting?: boolean;
    onSave?: (html: string) => void;
    title?: string;
    onTitleChange?: (title: string) => void;
    onContentChange?: (html: string) => void;
    disableAloaAutoOpen?: boolean;
    onBack?: () => void;
    linkedMatterId?: string;
}

export type DocumentEditorProps = DraftProEditorProps;

export const DraftProEditor: React.FC<DraftProEditorProps> = ({
    initialContent,
    draftPrompt,
    autoStartDrafting = true,
    onSave,
    title,
    onTitleChange,
    onContentChange,
    onBack,
}) => {
    const { addToast } = useUI();
    const { appState } = useDataState();
    const { handleUpdateFirmDetails } = useDataActions();
    const { currentUser } = useAuth();
    const { isProperty, isUnified } = useProduct();
    const signerContext = useSignerContext();
    const { openWithContext, openPanel } = useAloa();

    // States
    // Number of explicit pageBreak nodes currently in the document
    const [pageBreakCount, setPageBreakCount] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [isDrafting, setIsDrafting] = useState(false);
    const draftingPromptRef = useRef<string | null>(null);
    const persistDraftRef = useRef<((content: string, title: string, prompt?: string) => void) | null>(null);

    // The prompt currently being drafted against. Synced from the `draftPrompt`
    // prop ONLY when autoStartDrafting is true. Redraft updates this state to
    // trigger a new drafting cycle (with optional additional context).
    const [activeDraftPrompt, setActiveDraftPrompt] = useState<string | undefined>(undefined);
    // Persist the original prompt so the Redraft button can reuse it even
    // after the first draft completes (at which point draftPrompt may be
    // cleared by WordProcessor).
    const originalDraftPromptRef = useRef<string | undefined>(undefined);
    if (draftPrompt && !originalDraftPromptRef.current) {
        originalDraftPromptRef.current = draftPrompt;
    }

    // Sync prop → activeDraftPrompt, but only when auto-start is allowed.
    // This way reopening a persisted draft (autoStartDrafting=false) does NOT
    // re-trigger drafting, while Redraft can still set activeDraftPrompt itself.
    useEffect(() => {
        if (autoStartDrafting && draftPrompt && draftingPromptRef.current !== draftPrompt) {
            setActiveDraftPrompt(draftPrompt);
        }
    }, [draftPrompt, autoStartDrafting]);

    // Keep persistDraftRef updated with the latest onContentChange handler
    // so the AI drafting completion can persist content even if the user
    // hasn't triggered onUpdate yet.
    useEffect(() => {
        if (onContentChange) {
            persistDraftRef.current = (content: string, title: string, _prompt?: string) => {
                onContentChange(content);
            };
        }
    }, [onContentChange]);

    // ─── Pinch-to-Zoom Support ──────────────────────────────────────────
    // Tracks two-finger pinch gestures on the editor canvas so users can
    // zoom in/out with their fingers (like Google Docs mobile). The gesture
    // listener is attached to the scroll area div below.
    const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchRef.current = {
                startDist: Math.hypot(dx, dy),
                startZoom: zoom,
            };
        }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchRef.current) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const ratio = dist / pinchRef.current.startDist;
            const newZoom = Math.max(0.3, Math.min(2.5, pinchRef.current.startZoom * ratio));
            setZoom(newZoom);
        }
    };
    const handleTouchEnd = () => { pinchRef.current = null; };

    const [isHeaderDesignerOpen, setIsHeaderDesignerOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(true);
    const [placeholderCount, setPlaceholderCount] = useState(0);

    // Modals
    const [activeModal, setActiveModal] = useState<'placeholder' | 'link' | 'image' | 'table' | 'fill_placeholders' | 'save_template' | 'auto_format_rules' | 'redraft' | null>(null);
    const [modalInput, setModalInput] = useState('');
    const [targetPlaceholderLabel, setTargetPlaceholderLabel] = useState<string | null>(null);
    const [aiHelpLabel, setAiHelpLabel] = useState<string | null>(null);
    const [aiHelpLoading, setAiHelpLoading] = useState(false);
    const [aiHelpResult, setAiHelpResult] = useState<Record<string, string>>({});
    const [redraftContext, setRedraftContext] = useState('');
    const isFillingRef = useRef(false);
    const [formatRules, setFormatRules] = useState({
        suitTitleFormat: true,
        doubleSpacing: false,
        justifyBody: true,
        numberParagraphs: false,
        uppercaseHeadings: true,
        nairaFormatting: true,
        dateFormatting: true,
        indentParagraphs: true,
    });
    const modalRef = useRef<HTMLInputElement>(null);

    const editorWrapRef = useRef<HTMLDivElement>(null);
    const contentLoadedRef = useRef(false);
    
    // Dynamic height tracking to automatically expand the page background
    const [contentHeight, setContentHeight] = useState(PAGE_HEIGHT_PX);

    // Global placeholder fill modal trigger
    useEffect(() => {
        const handleOpenTarget = (e: any) => {
            const label = e?.detail?.label || null;
            setTargetPlaceholderLabel(label);
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
            PageBreak,
            AutoPagination,
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
                    if (!isDrafting) handleManualSave();
                    return true;
                }
                return false;
            },
            // ── Clean Copy Handler ────────────────────────────────────────────
            // Intercepts copy to strip dark-mode backgrounds and DraftPro-specific
            // attributes from the clipboard HTML so that pasting into Word, Google
            // Docs, etc. produces clean text with bold/italic/underline preserved
            // and NO dark-rectangle background.
            handleDOMEvents: {
                copy: (view, event) => {
                    const { empty } = view.state.selection;
                    if (empty) return false; // let default handle empty selection

                    event.preventDefault();

                    const slice = view.state.selection.content();
                    const serializer = DOMSerializer.fromSchema(view.state.schema);
                    const fragment = serializer.serializeFragment(slice.content);

                    const tempDiv = document.createElement('div');
                    tempDiv.appendChild(fragment);

                    const html = cleanForClipboard(tempDiv.innerHTML);

                    // Derive plain text from the cleaned HTML
                    const textDiv = document.createElement('div');
                    textDiv.innerHTML = html;
                    const plainText = textDiv.textContent || '';

                    const clipboardData = event.clipboardData;
                    if (clipboardData) {
                        clipboardData.setData('text/html', html);
                        clipboardData.setData('text/plain', plainText);
                    }

                    return true;
                },
            },
        },
        onUpdate: ({ editor: e }) => {
            setIsSaved(false);
            onContentChange?.(e.getHTML());

            // Count pageBreak nodes for pagination (structural, not scroll-based)
            let breaks = 0;
            let placeholders = 0;
            e.state.doc.descendants(node => {
                if (node.type.name === 'pageBreak') breaks++;
                if (node.type.name === 'legalPlaceholder') placeholders++;
            });
            setPageBreakCount(breaks);
            setPlaceholderCount(placeholders);
        },
    });

    // Observe Editor height
    useEffect(() => {
        if (!editorWrapRef.current) return;
        const target = editorWrapRef.current.firstChild as Element;
        if (!target) return;
        
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                // Keep the background at least as tall as the content
                setContentHeight(entry.target.scrollHeight);
            }
        });
        resizeObserver.observe(target);
        return () => resizeObserver.disconnect();
    }, [editor]);

    // Run placeholder count on init as well
    useEffect(() => {
        if (!editor) return;
        let count = 0;
        editor.state.doc.descendants(node => {
            if (node.type.name === 'legalPlaceholder') count++;
        });
        setPlaceholderCount(count);
    }, [editor]);

    // AI Drafting Engine — triggers whenever activeDraftPrompt changes (initial draft OR redraft)
    // Streams text DIRECTLY onto the white page as it generates (no dark overlay).
    useEffect(() => {
        if (editor && activeDraftPrompt && draftingPromptRef.current !== activeDraftPrompt) {
            draftingPromptRef.current = activeDraftPrompt;
            setIsDrafting(true);
            setIsSaved(false);

            // Buffer for the final cleanup pass (placeholder conversion, etc.)
            // but we ALSO stream into the editor live so the user sees progress.
            let draftBuffer = '';
            let lastStreamUpdate = 0;

            // Setup AbortController to allow user to stop the draft
            const abortController = new AbortController();
            (window as any).stopDrafting = () => abortController.abort();

            // Clear editor content — canvas stays white, overlay indicator shows on top
            editor.commands.setContent('<p></p>');

            aiService.streamDraft(
                [{ role: 'user', content: activeDraftPrompt }],
                { appState, currentUser: currentUser!, signerContext },
                (chunk) => {
                    draftBuffer += chunk;
                    // Stream text directly into the editor so the user sees it
                    // appear in real-time on the white page. We throttle updates
                    // to ~4 per second to avoid ProseMirror thrashing.
                    const now = Date.now();
                    if (now - lastStreamUpdate > 250) {
                        lastStreamUpdate = now;
                        // Show the raw streaming text (no placeholder conversion yet —
                        // that happens in the final pass to avoid mid-stream flicker
                        // as partial [LABEL] tokens are completed).
                        let preview = draftBuffer
                            .replace(/```html/g, '')
                            .replace(/```/g, '')
                            .replace(/\\n/g, '\n')
                            .replace(/\r/g, '');
                        preview = preview.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                        if (preview.trim()) {
                            editor.commands.setContent(preview);
                        }
                    }
                },
                abortController.signal
            ).then(() => {
                setIsDrafting(false);
                const trimmedBuffer = draftBuffer.trim();
                if (editor && trimmedBuffer) {
                    // Final cleanup pass — convert [LABEL] tokens to color-coded placeholders
                    let cleanDraft = trimmedBuffer
                        .replace(/```html/g, '')
                        .replace(/```/g, '')
                        .replace(/\\n/g, '\n')
                        .replace(/\r/g, '');

                    cleanDraft = cleanDraft.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

                    const processedDraft = cleanDraft.replace(/\[([^\]]+)\]/g, (_, label) => {
                        const cat = resolveCategory(label);
                        return `<span data-type="legal-placeholder" data-label="${label.toUpperCase()}" data-category="${cat}"></span>`;
                    });

                    editor.commands.setContent(processedDraft);
                    addToast('Drafting complete', { type: 'success' });

                    persistDraftRef.current?.(processedDraft, documentTitle, activeDraftPrompt);
                } else {
                    const currentContent = editor?.getHTML() || '';
                    if (currentContent === '<p></p>' || !currentContent) {
                        editor?.commands.setContent('<p style="color:#94a3b8; text-align:center; padding:24px;"><i>The AI returned an empty response. Please try again with a more specific prompt.</i></p>');
                        addToast('Drafting returned empty. Try a more specific prompt.', { type: 'info' });
                    }
                }
            }).catch(e => {
                console.error("Drafting error:", e);
                setIsDrafting(false);
                if (e.name === 'AbortError') {
                    addToast('Drafting cancelled.', { type: 'info' });
                    // Keep whatever was streamed so far — don't wipe it
                } else {
                    const trimmedBuffer = draftBuffer.trim();
                    if (editor && trimmedBuffer) {
                        // We have content despite the error — finalize it
                        let cleanDraft = trimmedBuffer
                            .replace(/```html/g, '')
                            .replace(/```/g, '')
                            .replace(/\\n/g, '\n')
                            .replace(/\r/g, '');
                        cleanDraft = cleanDraft.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                        const processedDraft = cleanDraft.replace(/\[([^\]]+)\]/g, (_, label) => {
                            const cat = resolveCategory(label);
                            return `<span data-type="legal-placeholder" data-label="${label.toUpperCase()}" data-category="${cat}"></span>`;
                        });
                        editor.commands.setContent(processedDraft);
                        addToast('Draft completed (with minor stream error).', { type: 'success' });
                        persistDraftRef.current?.(processedDraft, documentTitle, activeDraftPrompt);
                    } else {
                        addToast(`Drafting failed: ${e.message}`, { type: 'error' });
                    }
                }
            });
        }
    }, [editor, activeDraftPrompt, appState]);

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

    // Clears the editor and resets the title for a fresh start.
    const handleNewDocument = useCallback(() => {
        if (!editor) return;
        // Confirm if there's unsaved content
        const hasContent = editor.getHTML().replace(/<[^>]*>/g, '').trim().length > 0;
        if (hasContent && !isSaved) {
            if (!window.confirm('Start a new document? Unsaved changes will be lost.')) return;
        }
        editor.commands.clearContent();
        editor.commands.setContent('<p></p>');
        onTitleChange?.('Untitled Document');
        setIsSaved(true);
        originalDraftPromptRef.current = undefined;
        setActiveDraftPrompt(undefined);
        addToast('New document created', { type: 'success' });
    }, [editor, isSaved, onTitleChange, addToast]);

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

    // ─── Redraft Handler ──────────────────────────────────────────────────
    // Re-triggers the AI drafting engine using the original prompt plus any
    // additional context the user supplies in the Redraft modal. The current
    // editor content is cleared and replaced with the new draft when it
    // completes. We force the trigger by resetting draftingPromptRef so the
    // useEffect detects a change even if the new prompt happens to match the
    // last one (e.g. user clicks Redraft with no extra context).
    const handleRedraft = useCallback(() => {
        const ctx = redraftContext.trim();
        const base = (originalDraftPromptRef.current || activeDraftPrompt || draftPrompt || `Draft a ${title || 'legal'} document.`).trim();
        const newPrompt = ctx
            ? `${base}\n\n---\nADDITIONAL CONTEXT FOR IMPROVEMENT:\n${ctx}\n\nPlease generate a complete, improved version of the document incorporating the above.`
            : `${base}\n\n---\nPlease generate a complete, improved version of the document. Refine the structure, tone, and clarity.`;

        setActiveModal(null);
        setRedraftContext('');
        // Force the drafting useEffect to fire even if newPrompt matches the
        // previously drafted one.
        draftingPromptRef.current = null;
        setActiveDraftPrompt(newPrompt);
        addToast('Redrafting your document...', { type: 'info' });
    }, [redraftContext, activeDraftPrompt, draftPrompt, title, addToast]);

    // Page count derived from structural pageBreak nodes OR dynamic content height
    const calculatedPages = Math.max(pageBreakCount + 1, Math.ceil(contentHeight / PAGE_HEIGHT_PX));
    const pageCount = calculatedPages;

    // Insertion Handlers
    const insertPlaceholder = () => {
        const val = modalInput.trim().toUpperCase();
        if (val && editor) {
            const cat = resolveCategory(val);
            editor.chain().focus().insertContent([{
                type: 'legalPlaceholder',
                attrs: { label: val, category: cat }
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

    // ── AI Help for Placeholders ────────────────────────────────────────────
    // Opens ALOA/ARIA with context about the current document and the
    // specific placeholder the user needs help with.
    const handleAiHelpForPlaceholder = (label: string) => {
        setAiHelpLabel(label);
        setAiHelpLoading(true);

        // Build a snippet of the document context (first 500 chars of plain text)
        let docContext = '';
        editor?.state.doc.descendants((node) => {
            if (node.isText && docContext.length < 500) {
                docContext += node.text || '';
            }
        });
        const truncatedContext = docContext.slice(0, 500);

        // Open ALOA/ARIA with context about this placeholder
        openWithContext({
            entityType: 'matter',
            entityId: 'draftpro-placeholder-help',
            entityName: title || 'Draft Document',
            payload: {
                placeholderLabel: label,
                documentContext: truncatedContext,
                signerContext: signerContext ? { signerName: signerContext.signerName, signerTitle: signerContext.signerTitle } : null,
            },
        });

        // Also try a quick inline AI suggestion
        (async () => {
            try {
                const { streamMessage } = await import('../../../services/aiService');
                const aiContext = {
                    appState,
                    currentUser: currentUser!,
                    currentHistoryEntry: null as any,
                    localFiles: [],
                    aloaXLibrary: [],
                    isFirmSearchEnabled: false,
                    searchBrain: undefined as any,
                };
                const prompt = `I'm drafting a document and need to fill the placeholder [${label}]. Based on the document context below, suggest a concise value for this placeholder. Reply with ONLY the suggested value, nothing else. If you can't determine a specific value, reply with a brief description of what should go there.\n\nDocument context: "${truncatedContext}"${signerContext ? `\nUser: ${signerContext.signerName}, ${signerContext.signerTitle}` : ''}`;

                let suggestion = '';
                await streamMessage(
                    [{ role: 'user' as const, content: prompt, id: 'ai-help' }],
                    aiContext,
                    (chunk) => { suggestion += chunk; },
                    'flash'
                );

                if (suggestion.trim()) {
                    setAiHelpResult(prev => ({ ...prev, [label]: suggestion.trim() }));
                    addToast(`AI suggestion for [${label}] ready`, { type: 'info' });
                }
            } catch (err: any) {
                console.warn('AI help failed for placeholder:', err.message);
            } finally {
                setAiHelpLoading(false);
                setAiHelpLabel(null);
            }
        })();
    };

    // if (!editor) return null; // Removed to prevent "black screen" during init

    return (
        <div className="flex flex-col h-full bg-slate-100 dark:bg-zinc-950 overflow-hidden font-sans">

            {/* ── Top bar (Title + Meta) ── */}
            <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 h-12 flex items-center justify-between z-[60] no-print">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={() => {
                            // If we have a custom onBack handler (in-app nav), use it.
                            if (onBack) { onBack(); return; }
                            // Otherwise: if there's history in this tab, go back.
                            // If not (e.g. opened in a new tab via draftTabs), go to
                            // the dashboard so the user isn't stuck on the editor.
                            if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.origin)) {
                                window.history.back();
                            } else {
                                window.location.href = '/';
                            }
                        }}
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

            {/* ── Ribbon Toolbar ──
                Organized into clear functional groups with visual dividers:
                File | Font | Paragraph | Insert | Tools | AI | Zoom
                Each group is separated by a thin vertical divider for
                better visual scannability. */}
            <div className="flex-shrink-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 shadow-sm z-50">
                <div className="flex items-stretch gap-0 px-1 py-1 overflow-x-auto custom-scrollbar no-scrollbar">

                    <ToolbarGroup label="File">
                        <ToolbarBtn icon={NewDocumentIcon} label="New" onClick={handleNewDocument} size="lg" disabled={!editor || isDrafting} />
                        <ToolbarBtn icon={Save} label="Save" onClick={handleManualSave} size="lg" disabled={isSaved || !editor || isDrafting} />
                        <div className="flex flex-col gap-0.5">
                            <ToolbarBtn icon={Undo} onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} size="sm" label="Undo" />
                            <ToolbarBtn icon={Redo} onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} size="sm" label="Redo" />
                        </div>
                        <ToolbarBtn icon={Printer} onClick={handlePrint} size="sm" label="Print" />
                        <ToolbarBtn
                            icon={PageBreakIcon}
                            label="Page Break"
                            onClick={() => editor?.chain().focus().setPageBreak().run()}
                            size="lg"
                            disabled={!editor}
                        />
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

                        <div className="flex flex-wrap gap-0.5 w-[126px] ml-1">
                            <ToolbarBtn icon={Bold} onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={Italic} onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={UnderlineIcon} onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={StrikethroughIcon} onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={SubscriptIcon} onClick={() => editor?.chain().focus().toggleSubscript().run()} active={editor?.isActive('subscript')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={SuperscriptIcon} onClick={() => editor?.chain().focus().toggleSuperscript().run()} active={editor?.isActive('superscript')} size="sm" disabled={!editor} />
                        </div>

                        {/* Highlight / Background Color Picker */}
                        <div className="flex flex-col items-center gap-0.5 ml-1">
                            <div className="relative group">
                                <input autoComplete="off" data-lpignore="true"
                                    type="color"
                                    className="w-6 h-6 p-0 border border-slate-200 dark:border-zinc-700 bg-transparent cursor-pointer rounded overflow-hidden"
                                    onChange={(e) => editor?.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                                    title="Highlight Color"
                                    disabled={!editor}
                                />
                            </div>
                            <button
                                onMouseDown={e => { e.preventDefault(); editor?.chain().focus().unsetHighlight().run(); }}
                                className="text-[8px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 font-medium"
                                title="Remove Highlight"
                                disabled={!editor}
                            >
                                Clear
                            </button>
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
                        <ToolbarBtn icon={DocumentHeaderIcon} label="Header" onClick={() => setIsHeaderDesignerOpen(true)} size="lg" />
                        <ToolbarBtn icon={Scissors} label={`Fill Blanks (${placeholderCount})`} onClick={() => setActiveModal('fill_placeholders')} size="lg" className="text-amber-600 dark:text-amber-400" />
                        <ToolbarBtn icon={Plus} label="Group Parties" onClick={() => editor?.chain().focus().insertContent('<div data-type="legal-parties-group"><p>Party Name</p></div>').run()} size="lg" className="text-indigo-600" />
                        <ToolbarBtn icon={Redo} label="Redraft" onClick={() => { setRedraftContext(''); setActiveModal('redraft'); }} size="lg" className="text-blue-600 dark:text-blue-400" disabled={!editor || isDrafting} />
                        <ToolbarBtn icon={Save} label="Save Template" onClick={() => { setModalInput(title || ''); setActiveModal('save_template'); }} size="lg" className="text-primary-600" />
                        <div className="flex flex-col gap-0.5 justify-center ml-2">
                            <div className="text-[10px] font-bold text-slate-400">Words: {editor?.storage.characterCount.words() || 0}</div>
                            <div className="text-[10px] font-bold text-slate-400">Chars: {editor?.storage.characterCount.characters() || 0}</div>
                        </div>
                    </ToolbarGroup>

                    {/* Agentic Ribbon — legal context only */}
                    {!isProperty && (
                    <ToolbarGroup label="DraftPro AI" className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10">
                        <ToolbarBtn icon={Wand} label="Auto-Format" onClick={() => setActiveModal('auto_format_rules')} size="lg" className="text-emerald-600 dark:text-emerald-400" />
                    </ToolbarGroup>
                    )}

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

            {/* ══ Editor Canvas — True Page Sheet Rendering ══ */}
            <div
                className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar"
                style={{ background: '#e2e8f0' }}
                id="draftpro-scroll-area"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/*
                 * Layout space holder: its size is the scaled total height of all pages.
                 * The scale() transform on the inner div doesn't affect layout flow,
                 * so we must manually reserve the correct scaled height here.
                 *
                 * The pt-12 (48px top padding) DETACHES the first page from the
                 * ribbon so it floats independently in "center stage" — like a
                 * real document on a desk, not glued to the toolbar.
                 */}
                <div
                    className="flex justify-center mb-20 shrink-0 pt-12"
                    style={{
                        width: `${PAGE_WIDTH_PX * zoom}px`,
                        minHeight: `${(PAGE_HEIGHT_PX * pageCount + PAGE_GAP_PX * Math.max(0, pageCount - 1)) * zoom}px`,
                        margin: '0 auto',
                        position: 'relative',
                        paddingBottom: `${40 * zoom}px`,
                    }}
                >
                    {/* Scale wrapper — everything inside scales uniformly */}
                    <div
                        className="origin-top shrink-0"
                        style={{
                            width: `${PAGE_WIDTH_PX}px`,
                            transform: `scale(${zoom})`,
                            transformOrigin: 'top center',
                            position: 'absolute',
                            top: 0,
                            left: '50%',
                            marginLeft: `${-(PAGE_WIDTH_PX / 2)}px`,
                        }}
                    >
                        {/* ── True Page Sheets (structural, not decorative) ── */}
                        <div className="flex flex-col" style={{ gap: `${PAGE_GAP_PX}px` }}>
                            {Array.from({ length: pageCount }).map((_, i) => (
                                <div
                                    key={i}
                                    className="draftpro-page-sheet bg-white dark:bg-white border border-slate-200 dark:border-zinc-700 relative shrink-0 overflow-hidden print:shadow-none"
                                    style={{
                                        width: `${PAGE_WIDTH_PX}px`,
                                        height: `${PAGE_HEIGHT_PX}px`,
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
                                    }}
                                >
                                    {/* ── Letterhead / Header ── */}
                                    {(i === 0 || appState.firmDetails.settings?.headerConfig?.showOnAllPages) && (
                                        <div
                                            className="absolute left-0 right-0 top-0 z-10 pointer-events-none"
                                            style={{ height: `${PAGE_MARGIN_PX + HEADER_HEIGHT_PX}px` }}
                                        >
                                            <HeaderRenderer config={appState.firmDetails.settings?.headerConfig} />
                                        </div>
                                    )}

                                    {/* ── Page Number Footer ── */}
                                    <div
                                        className="absolute left-0 right-0 z-10 text-center print:hidden"
                                        style={{
                                            bottom: `${PAGE_MARGIN_PX / 3}px`,
                                            fontSize: '10px',
                                            color: '#94a3b8',
                                            fontWeight: '700',
                                            letterSpacing: '0.15em',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        Page {i + 1} of {pageCount}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Editor Content Overlay ──
                         * The single TipTap editor flows over all page sheets.
                         * Padding pushes content into the correct margin zones.
                         * pageBreak nodes use CSS break-after so content visually
                         * respects page boundaries.
                         */}
                        <div
                            ref={editorWrapRef}
                            className="absolute inset-0 z-20 pointer-events-none"
                            style={{
                                top: 0,
                                left: 0,
                                right: 0,
                            }}
                        >
                            <div
                                className="pointer-events-auto"
                                style={{
                                    paddingLeft:  `${PAGE_MARGIN_PX}px`,
                                    paddingRight: `${PAGE_MARGIN_PX}px`,
                                    // First page: push content below letterhead
                                    paddingTop: `${PAGE_MARGIN_PX + HEADER_HEIGHT_PX}px`,
                                    // Bottom padding so last page has room
                                    paddingBottom: `${PAGE_MARGIN_PX + FOOTER_HEIGHT_PX}px`,
                                }}
                            >
                                {!editor && (
                                    <div className="flex items-center justify-center h-40">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                                    </div>
                                )}
                                <EditorContent editor={editor} />
                                {isDrafting && (
                                    <GenerationOverlay label="Preparing your document..." />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── In-App Modals ── */}
            {
                activeModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
                        <div className={`relative z-10 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 w-full ${activeModal === 'fill_placeholders' ? 'max-w-md' : activeModal === 'auto_format_rules' ? 'max-w-lg' : activeModal === 'redraft' ? 'max-w-lg' : 'max-w-sm'} mx-4 animate-in zoom-in-95 duration-200`}>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                {activeModal === 'placeholder' && <><Type className="w-5 h-5 text-amber-500" /> Insert Placeholder</>}
                                {activeModal === 'fill_placeholders' && <><Scissors className="w-5 h-5 text-amber-500" /> Smart Fill Placeholders</>}
                                {activeModal === 'link' && <><LinkIcon className="w-5 h-5 text-blue-500" /> Insert Link</>}
                                {activeModal === 'image' && <><ImageIcon className="w-5 h-5 text-emerald-500" /> Insert Image</>}
                                {activeModal === 'table' && <><TableIcon className="w-5 h-5 text-slate-500" /> Create Table</>}
                                {activeModal === 'auto_format_rules' && <><Wand className="w-5 h-5 text-emerald-500" /> Auto-Format Rules</>}
                                {activeModal === 'redraft' && <><Redo className="w-5 h-5 text-blue-500" /> Redraft with AI</>}
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
                                // Collect unique labels with category for the form UI
                                const nodesForUI: { label: string; category: PlaceholderCategory }[] = [];
                                editor?.state.doc.descendants((node) => {
                                    if (node.type.name === 'legalPlaceholder') {
                                        const def = getPlaceholderDef(node.attrs.label);
                                        const cat = resolveCategory(node.attrs.label, node.attrs.category);
                                        nodesForUI.push({ label: node.attrs.label, category: cat });
                                    }
                                });
                                const uniqueLabels = Array.from(new Map(nodesForUI.map(n => [n.label, n])).values());
                                // Group by category
                                const grouped = uniqueLabels.reduce((acc, item) => {
                                    if (!acc[item.category]) acc[item.category] = [];
                                    acc[item.category].push(item.label);
                                    return acc;
                                }, {} as Record<PlaceholderCategory, string[]>);
                                const categoryOrder: PlaceholderCategory[] = ['parties', 'dates', 'financial', 'location', 'court', 'firm', 'freetext'];
                                const categoryMeta: Record<PlaceholderCategory, { name: string; abbr: string; color: string }> = {
                                    parties:   { name: 'Parties',   abbr: 'P', color: 'text-blue-500' },
                                    dates:     { name: 'Dates',     abbr: 'D', color: 'text-purple-500' },
                                    financial: { name: 'Financial', abbr: '$', color: 'text-green-500' },
                                    location:  { name: 'Location',  abbr: 'A', color: 'text-teal-500' },
                                    court:     { name: 'Court',     abbr: 'C', color: 'text-rose-500' },
                                    firm:      { name: 'Firm',      abbr: 'F', color: 'text-indigo-500' },
                                    freetext:  { name: 'Free Text', abbr: 'T', color: 'text-amber-500' },
                                };

                                const handleAutoFill = () => {
                                    const linkedMatter = appState.matters?.find((m: any) => m.id === linkedMatterId);
                                    const firm = appState.firmDetails;
                                    uniqueLabels.forEach(({ label }) => {
                                        const val = resolveAutoFill(label, linkedMatter, undefined, undefined, firm);
                                        if (val) {
                                            const input = document.querySelector(`input[name="${label}"]`) as HTMLInputElement;
                                            if (input) { input.value = val; input.dispatchEvent(new Event('input')); }
                                        }
                                    });
                                    addToast('Auto-filled from matter/firm data.', { type: 'success' });
                                };

                                const processFill = () => {
                                    // Guard against duplicate submissions
                                    if (isFillingRef.current) return;
                                    if (!editor) return;

                                    const form = document.getElementById('fill-placeholders-form') as HTMLFormElement;
                                    if (!form) return;
                                    const formData = new FormData(form);
                                    const values: Record<string, string> = {};
                                    formData.forEach((val, key) => { values[key] = val as string; });

                                    // Check if there's anything to fill
                                    const hasValues = Object.values(values).some(v => v.trim().length > 0);
                                    if (!hasValues) {
                                        setActiveModal(null);
                                        setTargetPlaceholderLabel(null);
                                        return;
                                    }

                                    isFillingRef.current = true;

                                    try {
                                        // Re-fetch positions from the CURRENT document state (fresh, not stale)
                                        const { tr, schema } = editor.state;
                                        const currentNodes: { pos: number; size: number; label: string }[] = [];
                                        editor.state.doc.descendants((node, pos) => {
                                            if (node.type.name === 'legalPlaceholder') {
                                                currentNodes.push({ pos, size: node.nodeSize, label: node.attrs.label });
                                            }
                                        });

                                        // Sort bottom-up so that replacing higher positions doesn't shift lower ones
                                        currentNodes.sort((a, b) => b.pos - a.pos);

                                        // Apply all replacements in a single ProseMirror transaction
                                        for (const n of currentNodes) {
                                            const val = values[n.label];
                                            if (val !== undefined && val.trim().length > 0) {
                                                tr.replaceWith(n.pos, n.pos + n.size, schema.text(val));
                                            }
                                        }

                                        editor.view.dispatch(tr);
                                        addToast('Placeholders filled.', { type: 'success' });
                                    } catch (err) {
                                        console.error('Error filling placeholders:', err);
                                        addToast('Error filling placeholders. Please try again.', { type: 'error' });
                                    } finally {
                                        isFillingRef.current = false;
                                        setActiveModal(null);
                                        setTargetPlaceholderLabel(null);
                                    }
                                };

                                const closeFillModal = () => {
                                    setTargetPlaceholderLabel(null);
                                    setActiveModal(null);
                                };

                                if (uniqueLabels.length === 0) {
                                    return (
                                        <div className="space-y-4">
                                            <p className="text-sm text-slate-500">No placeholders found in this document.</p>
                                            <button onClick={closeFillModal} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">Close</button>
                                        </div>
                                    );
                                }

                                return (
                                    <form id="fill-placeholders-form" className="space-y-4" onSubmit={e => { e.preventDefault(); processFill(); }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] text-slate-400">{uniqueLabels.length} placeholder{uniqueLabels.length !== 1 ? 's' : ''}</span>
                                            <button type="button" onClick={handleAutoFill} className="text-[10px] font-bold px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
                                                ⚡ Auto-fill from matter
                                            </button>
                                        </div>
                                        <div className="max-h-[55vh] overflow-y-auto space-y-4 custom-scrollbar pr-2">
                                            {categoryOrder.map(cat => {
                                                const labels = grouped[cat];
                                                if (!labels || labels.length === 0) return null;
                                                const meta = categoryMeta[cat];
                                                return (
                                                    <div key={cat}>
                                                        <div className="flex items-center gap-1.5 mb-2">
                                                            <span className={`text-[10px] font-black ${meta.color}`}>{meta.abbr}</span>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{meta.name}</span>
                                                            <span className="text-[10px] text-slate-300">({labels.length})</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {labels.map(label => (
                                                                <div key={label} className="flex flex-col gap-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <label className="text-xs font-bold text-slate-600 dark:text-zinc-400">{label}</label>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleAiHelpForPlaceholder(label)}
                                                                            disabled={aiHelpLoading && aiHelpLabel === label}
                                                                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight rounded-md transition-all border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-50"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                                                            </svg>
                                                                            {aiHelpLoading && aiHelpLabel === label ? 'Asking...' : `Ask ${isProperty ? 'ARIA' : 'ALOA'}`}
                                                                        </button>
                                                                    </div>
                                                                    <input autoComplete="off" data-lpignore="true"
                                                                        name={label}
                                                                        autoFocus={targetPlaceholderLabel === label}
                                                                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                                                                        placeholder={aiHelpResult[label] || `Enter ${label.toLowerCase()}...`}
                                                                        defaultValue={aiHelpResult[label] || ''}
                                                                    />
                                                                    {aiHelpResult[label] && (
                                                                        <p className="text-[10px] text-violet-500 dark:text-violet-400">AI suggested — edit or accept</p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                                            <button type="button" onClick={closeFillModal} className="flex-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 font-bold py-2 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
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

                            {activeModal === 'redraft' && (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                        <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                                            The AI will regenerate the entire document from scratch using the original prompt. Your current content will be replaced. Add specific instructions below to guide the improvement — e.g. <em>"make it more formal", "add a termination clause", "shorten the recitals"</em>.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Additional context (optional)</label>
                                        <textarea
                                            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-y"
                                            placeholder="e.g. Make the tone more formal. Add a clause about late-payment penalties. Use Lagos State tenancy law formatting."
                                            value={redraftContext}
                                            onChange={e => setRedraftContext(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setActiveModal(null); setRedraftContext(''); }} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">Cancel</button>
                                        <button onClick={handleRedraft} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-lg flex items-center justify-center gap-2">
                                            <Redo className="w-4 h-4" />
                                            Redraft Document
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeModal === 'auto_format_rules' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">Select the Nigerian legal formatting rules you want to enforce across the entire document.</p>
                                    <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {Object.entries(formatRules).map(([key, value]) => (
                                            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 p-2 rounded">
                                                <input 
                                                    type="checkbox" 
                                                    checked={value}
                                                    onChange={(e) => setFormatRules(prev => ({ ...prev, [key]: e.target.checked }))}
                                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-zinc-800">
                                        <button onClick={() => setActiveModal(null)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                                        <button onClick={() => {
                                            if (!editor) return;
                                            
                                            // Apply uppercase headings logic
                                            if (formatRules.uppercaseHeadings) {
                                                const { from, to } = editor.state.selection;
                                                let tr = editor.state.tr;
                                                let modified = false;
                                                editor.state.doc.descendants((node, pos) => {
                                                    if (node.type.name === 'heading' && node.content.size > 0) {
                                                        node.content.forEach((inline, offset) => {
                                                            if (inline.type.name === 'text' && inline.text && inline.text !== inline.text.toUpperCase()) {
                                                                tr = tr.insertText(inline.text.toUpperCase(), pos + 1 + offset, pos + 1 + offset + inline.text.length);
                                                                modified = true;
                                                            }
                                                        });
                                                    }
                                                });
                                                if (modified) editor.view.dispatch(tr);
                                            }

                                            // Apply paragraph numbering logic
                                            if (formatRules.numberParagraphs) {
                                                let paraPositions: { pos: number; node: any }[] = [];
                                                editor.state.doc.descendants((node, pos) => {
                                                    if (node.type.name === 'paragraph' && node.content.size > 0) {
                                                        paraPositions.push({ pos, node });
                                                    }
                                                });
                                                for (let i = paraPositions.length - 1; i >= 0; i--) {
                                                    const { pos, node } = paraPositions[i];
                                                    editor.chain().focus().setNodeSelection(pos).toggleOrderedList().run();
                                                }
                                            }

                                            addToast('Auto-format rules applied successfully', { type: 'success' });
                                            setActiveModal(null);
                                        }} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg">Apply Rules</button>
                                    </div>
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
        /* ── DraftPro Content Typography ── */
        .draftpro-editor-content { padding-bottom: 120px; }
        .draftpro-editor-content h1 { font-size: 16pt; font-weight: bold; text-transform: uppercase; text-align: center; margin: 1em 0; break-after: avoid; }
        .draftpro-editor-content h2 { font-size: 14pt; font-weight: bold; margin: 1em 0; break-after: avoid; }
        .draftpro-editor-content h3 { font-size: 12pt; font-weight: bold; text-decoration: underline; margin: 1em 0; break-after: avoid; }
        .draftpro-editor-content p  { margin: 0 0 1em 0; orphans: 2; widows: 2; }
        .draftpro-editor-content ul, .draftpro-editor-content ol { padding-left: 1.5em; margin-bottom: 1em; }
        .draftpro-editor-content li { margin-bottom: 0.25em; break-inside: avoid; }
        .draftpro-editor-content table { border-collapse: collapse; width: 100%; margin-bottom: 1.5em; }
        .draftpro-editor-content th, .draftpro-editor-content td { border: 1px solid #cbd5e1; padding: 8px 12px; min-width: 1em; position: relative; }
        .draftpro-editor-content th { background: #f8fafc; font-weight: bold; text-align: left; }
        .draftpro-editor-content img { max-width: 100%; height: auto; border-radius: 4px; margin: 1em 0; }
        
        /* Nigerian Legal Structure — prevent bad splits */
        .draftpro-editor-content table { break-inside: avoid; border-collapse: collapse; width: 100%; }
        .draftpro-editor-content tr { break-inside: avoid; }
        .draftpro-editor-content [data-type="legal-parties-group"] { break-inside: avoid; }
        .draftpro-editor-content .signature-block { break-inside: avoid; }

        /* ── True Page Break Node ── */
        .page-break-node {
          break-after: page;
          page-break-after: always;
          display: block;
          width: 100%;
          height: 0 !important;
          margin: 16px 0 !important;
          padding: 0 !important;
          border: none;
          border-top: 2px dashed #cbd5e1;
          position: relative;
          pointer-events: none;
          user-select: none;
        }
        .page-break-node::after {
          content: '— Page Break —';
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: #f1f5f9;
          color: #64748b;
          font-size: 11px;
          padding: 0 8px;
          font-family: Inter, system-ui, sans-serif;
          pointer-events: none;
          white-space: nowrap;
        }
        /* Selected state for the page break node */
        .ProseMirror .page-break-node.ProseMirror-selectednode {
          outline: 2px solid #6366f1;
          outline-offset: 2px;
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

        /* ── Print Styles ── */
        @page { size: A4; margin: 25mm 25mm 20mm 25mm; }
        @media print {
          body * { visibility: hidden; }
          #draftpro-scroll-area, #draftpro-scroll-area * { visibility: visible; }
          #draftpro-scroll-area {
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 0 !important; margin: 0 !important;
            background: white !important; overflow: visible !important;
            transform: none !important;
          }
          /* Show only the editor overlay, hide page sheet decorations */
          .draftpro-page-sheet { box-shadow: none !important; border: none !important; }
          /* Real page breaks in print */
          .page-break-node {
            break-after: page !important;
            page-break-after: always !important;
            border: none !important;
            margin: 0 !important;
          }
          .page-break-node::after { display: none !important; }
          /* Hide visual-only chrome */
          .print\:hidden { display: none !important; }
          .draftpro-editor-content { padding-bottom: 0 !important; }
          table { break-inside: avoid; }
          tr { break-inside: avoid; }
          h1, h2, h3 { break-after: avoid; }
          p { orphans: 2; widows: 2; }
        }
      `}</style>
        </div >
    );
};

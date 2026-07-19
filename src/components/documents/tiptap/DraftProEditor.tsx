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
import { getAssistantName } from '../../../utils/assistantIdentity';
import GenerationOverlay from './GenerationOverlay';
import { LegalPartiesGroup } from './extensions/LegalPartiesGroup';
import { PageBreak } from './extensions/PageBreak';
import Citation from './extensions/Citation';
import { CitationRegistry } from '../../../utils/citationRegistry';
import { FontSize } from './extensions/FontSize';
import { LineHeight } from './extensions/LineHeight';
import { exportHtmlToDocx, exportHtmlToDocxBlob, exportHtmlToPdfBlob } from '../../../utils/docxExport';
import { uploadBlobToConvex } from '../../../utils/convexUpload';
import { useProduct, useSignerContext } from '../../../contexts/ProductContext';
import { useUI } from '../../../contexts/UIContext';
import { useDataState, useDataActions } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAloa } from '../../../contexts/AloaProvider';
import { HeaderRenderer } from '../HeaderRenderer';
import { HeaderDesigner } from '../HeaderDesigner';
import PrintPreviewDrawer from './PrintPreviewDrawer';
import { HeaderConfiguration } from '../../../types';
import Tooltip from '../../Tooltip';
import { classifyAndCheckCitation } from '../../../utils/citationClassifier';

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
const Shield: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>;
const HashIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" /></svg>;
const DownloadIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>;
const Eye: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const SubscriptIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25L9.75 12l-6 6.75m9-13.5L12.75 12l6 6.75" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 18.75h-3v-1.5l1.5-1.5c.75-.75 1.5-1.125 1.5-1.875 0-.75-.375-1.125-1.125-1.125S17.25 13.5 17.25 14.25" strokeWidth={1.2} /></svg>;
const SuperscriptIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25L9.75 12l-6 6.75m9-13.5L12.75 12l6 6.75" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.5h-3V6l1.5-1.5c.75-.75 1.5-1.125 1.5-1.875 0-.75-.375-1.125-1.125-1.125S17.25 2.25 17.25 3" strokeWidth={1.2} /></svg>;
const StrikethroughIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M6.75 6.75c0-1.257.933-2.25 2.25-2.25 1.257 0 2.25.933 2.25 2.25 0 1.257-.933 2.25-2.25 2.25M17.25 6.75c0-1.257-.933-2.25-2.25-2.25-1.257 0-2.25.933-2.25 2.25 0 1.257.933 2.25 2.25 2.25M6.75 17.25c0 1.257.933 2.25 2.25 2.25 1.257 0 2.25-.933 2.25-2.25 0-1.257-.933-2.25-2.25-2.25M17.25 17.25c0 1.257-.933 2.25-2.25 2.25-1.257 0-2.25-.933-2.25-2.25 0-1.257.933-2.25 2.25-2.25" /></svg>;
const PageBreakIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.2} /><line x1="3" y1="12" x2="21" y2="12" strokeDasharray="3 3" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-2 3 2 3M16 9l2 3-2 3" /></svg>;

// Document Header icon — a page with a highlighted top section (represents
// letterhead / page header, NOT a settings gear)
const DocumentHeaderIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 9.75v4.5m15 0v3a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 17.25v-3m15 0H4.5" /><rect x="6.5" y="6" width="11" height="3.5" rx="0.5" fill="currentColor" fillOpacity="0.18" stroke="none" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 16h8M8 18.5h5" strokeWidth={1} /></svg>;

// New Document icon — a clean blank page with a folded corner (standard
// "new document" affordance, like Word/Google Docs)
const NewDocumentIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" /><line x1="8" y1="13" x2="16" y2="13" strokeWidth={1} /><line x1="8" y1="17" x2="13" y2="17" strokeWidth={1} /></svg>;

// Redraft / AI Sparkle icon — stands out as an AI feature
const RedraftIcon: React.FC<{className?:string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.5 3.5L9 9l-3-1.5L3 10.5l3 1.5L9 18l6.5-6.5L21 9l-3-1.5L15.5 3.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l6.5 6.5" strokeWidth={1.2} /><circle cx="18" cy="6" r="1.5" fill="currentColor" stroke="none" /></svg>;



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

// Ultra-slim toolbar with STRICT label baseline alignment.
// Structure: [buttons area (flex-1, items-end)] + [fixed-height label row]
// This ensures every group's label sits on the exact same horizontal line
// regardless of how many buttons or rows the group has.
const ToolbarGroup: React.FC<{ label?: string; children: React.ReactNode; className?: string; variant?: 'default' | 'ai' }> = ({ label, children, className = '', variant = 'default' }) => {
    const variantClass = variant === 'ai'
        ? 'bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-l border-blue-200/50 dark:border-blue-800/30'
        : '';
    const labelClass = variant === 'ai'
        ? 'text-3xs uppercase font-bold text-blue-600 dark:text-blue-400 tracking-tight leading-none h-[11px] flex items-center justify-center pb-0.5'
        : 'text-3xs uppercase font-bold text-slate-400 dark:text-zinc-500 tracking-tight leading-none h-[11px] flex items-center justify-center pb-0.5';
    return (
    <div className={`flex flex-col border-r border-slate-200 dark:border-zinc-800 px-1 last:border-r-0 ${variantClass} ${className}`}>
        {/* Buttons area — items-end so all groups align at the bottom */}
        <div className="flex items-end gap-0 py-0.5 flex-1 min-h-[24px]">
            {children}
        </div>
        {/* Strict baseline label — fixed height, perfectly level across all groups */}
        {label && (
            <span className={labelClass}>
                {label}
            </span>
        )}
        {/* Spacer for groups without a label — keeps the baseline consistent */}
        {!label && <span className="h-[11px] block" />}
    </div>
    );
};

const ToolbarBtn: React.FC<{
    icon: any;
    label?: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}> = ({ icon: Icon, label, onClick, active, disabled, size = 'md', className = '' }) => {
    // Compact sizing — tight enough to fit all groups on one line.
    // Still tappable (28px+ on desktop, 32px on mobile via p-2).
    const sizeClasses = {
        sm: 'p-1.5 sm:p-1',
        md: 'p-1.5 sm:p-1',
        lg: 'p-1.5 sm:p-1 flex-col gap-0 min-w-[30px] sm:min-w-[34px]'
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
            <Icon className="w-3.5 h-3.5" />
            {size === 'lg' && label && <span className="text-3xs font-medium leading-none">{label}</span>}
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
import { installBeforeUnloadGuard, shouldBlockNavigation, openInNewTab, buildRouteUrlWithHashContext } from '../../../utils/tabNavigation';

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
    /** Citations from ALOA research mode. When present, the editor
     *  displays a Sources panel and passes the citations to the drafting
     *  AI so it can cite them inline. */
    citations?: { citations: any[] };
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
    linkedMatterId,
    citations,
}) => {
    const { addToast, navigateTo } = useUI();
    const { appState } = useDataState();
    const { handleUpdateFirmDetails, addItem, handleAddDocumentAndAnalyze } = useDataActions();
    const { currentUser } = useAuth();
    const { isProperty, isUnified } = useProduct();
    const signerContext = useSignerContext();
    const { openWithContext, openPanel } = useAloa();
    const generateUploadUrl = useMutation(api.myFunctions.generateUploadUrl);

    // ─── New-tab detection ──────────────────────────────────────────────
    // DraftPro can be opened in two ways:
    //   1. In a NEW browser tab via window.open() (from ALOA "start drafting"
    //      or from the DocumentList). In this case the parent app shell is
    //      still open in another tab, so the user doesn't need a Back button
    //      — closing the tab returns them to the app.
    //   2. In the SAME tab via in-app navigation (mobile, or desktop when
    //      pop-ups are blocked). Here the user DOES need a Back button to
    //      return to the app shell, because there's no other tab to fall
    //      back to.
    //
    // Detection signals:
    //   - URL contains ?draftKey= (always set when opened via draftTabs)
    //   - window.opener is non-null (set by window.open() in same-origin)
    //   - window.name starts with "draftpro-" (set by registerDraftTab)
    //
    // We compute this ONCE on mount — it doesn't change during the lifetime
    // of the component.
    const isInNewTab = useMemo(() => {
        if (typeof window === 'undefined') return false;
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const hasDraftKey = !!urlParams.get('draftKey');
            if (!hasDraftKey) return false; // in-app navigation, no draftKey
            // window.opener is null when the tab wasn't opened via window.open
            // (e.g. popup was blocked and we fell back to window.location.href).
            // It's also null on refresh, but a refresh preserves window.name,
            // so we check both signals.
            const hasOpener = window.opener !== null && window.opener !== undefined;
            const hasDraftTabName = !!(window.name && window.name.startsWith('draftpro-'));
            return hasOpener || hasDraftTabName;
        } catch {
            return false;
        }
    }, []);

    // States
    // Number of explicit pageBreak nodes currently in the document
    const [pageBreakCount, setPageBreakCount] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [focusMode, setFocusMode] = useState(false);
    const [watermark, setWatermark] = useState<string | null>(null);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    // Page numbering configuration — gives the user control over whether
    // page numbers appear, where, and in what format. Previously this was
    // hardcoded to "Page X of Y" at bottom-center with no toggle.
    const [pageNumberConfig, setPageNumberConfig] = useState<{
        enabled: boolean;
        position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'none';
        format: 'page-of' | 'page-only' | 'dash' | 'number-only';
        startFrom: number;
    }>({
        enabled: true,
        position: 'bottom-center',
        format: 'page-of',
        startFrom: 1,
    });
    const [isDrafting, setIsDrafting] = useState(false);
    const draftingPromptRef = useRef<string | null>(null);
    const persistDraftRef = useRef<((content: string, title: string, prompt?: string) => void) | null>(null);
    // P2 PERF: Debounce onContentChange to prevent localStorage writes on every keystroke.
    // Was: synchronous localStorage.setItem via saveDraftSession on EVERY character.
    // Now: waits 500ms after last keystroke before persisting. Flushes on unmount.
    const contentChangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestContentRef = useRef<string>('');

    // ─── Citation Registry ──────────────────────────────────────────────
    // Hydrated from the `citations` prop (passed from ALOA when sending
    // content from research mode to DraftPro). When the drafting AI runs,
    // the source list is prepended to the prompt so the AI can cite them
    // inline as [1], [2], etc.
    //
    // IMPORTANT: This is now a SETTABLE state so that citations parsed
    // from the AI's draft output (## Sources block) can update the
    // registry AFTER the draft completes. Previously it was a fixed
    // useState initializer — citations produced during drafting never
    // appeared in the floater.
    const [citationRegistry, setCitationRegistry] = useState<CitationRegistry>(() => {
        if (citations && citations.citations && citations.citations.length > 0) {
            return CitationRegistry.fromJSON(citations as any);
        }
        return new CitationRegistry();
    });
    // Force re-render trigger — the CitationRegistry mutates in place,
    // so React doesn't see the change. We bump this counter to trigger
    // a re-render after citations are added.
    const [citationVersion, setCitationVersion] = useState(0);
    const [showCitationPanel, setShowCitationPanel] = useState(false);
    // Prompt-First Research Pipeline: when the user clicks "Research" on a
    // citation, we generate a search query via AI and show a loading state
    // on the button. Once generated, we open Research in a new tab with the
    // query PRE-FILLED (not auto-sent) — the user reviews and presses Enter.
    const [generatingQueryForCite, setGeneratingQueryForCite] = useState<string | null>(null);

    // ─── AI Feature Pulse ────────────────────────────────────────────────
    // After a draft completes, briefly pulse the Redraft and Auto-Format
    // buttons to draw the user's attention to the fact that they can
    // continue editing with AI. The pulse is subtle (a gentle ring glow
    // that fades in/out 3 times over ~2.4s) and only triggers once per
    // draft completion — not on every edit.
    const [showAiPulse, setShowAiPulse] = useState(false);
    const aiPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggerAiPulse = useCallback(() => {
        // Clear any previous pulse timer so we don't overlap
        if (aiPulseTimeoutRef.current) clearTimeout(aiPulseTimeoutRef.current);
        setShowAiPulse(true);
        // Auto-clear after 3 pulse cycles (~2.5s)
        aiPulseTimeoutRef.current = setTimeout(() => {
            setShowAiPulse(false);
            aiPulseTimeoutRef.current = null;
        }, 2500);
    }, []);

    // Clean up the pulse timeout on unmount to prevent setState on
    // an unmounted component (React warning + potential memory leak).
    useEffect(() => {
        return () => {
            if (aiPulseTimeoutRef.current) {
                clearTimeout(aiPulseTimeoutRef.current);
                aiPulseTimeoutRef.current = null;
            }
        };
    }, []);

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

    // ─── Unsaved-changes Navigation Guardrail ──────────────────────────
    // When the user has unsaved edits (`!isSaved`) and tries to:
    //   (a) close the tab / refresh — `beforeunload` intercepts (browser native dialog)
    //   (b) click the Back button / navigate in-app — custom modal intercepts
    //       with [Save & Leave] [Leave Without Saving] [Stay on Page]
    //
    // `pendingNavTarget` is non-null while the modal is open. It holds the
    // original navigation callback so we can fire it after the user chooses.
    const [pendingNav, setPendingNav] = useState<{
        kind: 'back' | 'research' | 'custom';
        onConfirm: () => void;
    } | null>(null);

    // Install / uninstall the beforeunload listener based on dirty state.
    // Modern browsers ignore the custom message — they show a generic
    // "Changes you made may not be saved" dialog. We can't customise it.
    useEffect(() => {
        const cleanup = installBeforeUnloadGuard(!isSaved);
        return cleanup;
    }, [isSaved]);

    // P2 PERF: Flush pending debounced content change on unmount.
    // Without this, the last 500ms of typing would be lost if the component
    // unmounts before the debounce timer fires.
    useEffect(() => {
        return () => {
            if (contentChangeDebounceRef.current) {
                clearTimeout(contentChangeDebounceRef.current);
                // Flush the latest content immediately
                if (latestContentRef.current) {
                    onContentChange?.(latestContentRef.current);
                }
            }
        };
    }, [onContentChange]);

    // Modals
    const [activeModal, setActiveModal] = useState<'placeholder' | 'link' | 'image' | 'table' | 'fill_placeholders' | 'save_template' | 'auto_format_rules' | 'redraft' | null>(null);
    // Track which ribbon dropdown is open (click-to-toggle, not hover).
    // Fixes the "two tooltips" issue: hover dropdowns appeared as broken
    // in-app tooltips clipped by the ribbon's overflow-x-auto container.
    // Now dropdowns only open on click, and the native title attribute
    // provides the hover tooltip.
    const [openDropdown, setOpenDropdown] = useState<'watermark' | 'pageNumber' | 'zoom' | null>(null);
    const [modalInput, setModalInput] = useState('');
    const [targetPlaceholderLabel, setTargetPlaceholderLabel] = useState<string | null>(null);
    const [aiHelpLabel, setAiHelpLabel] = useState<string | null>(null);
    const [aiHelpLoading, setAiHelpLoading] = useState(false);
    const [aiHelpResult, setAiHelpResult] = useState<Record<string, string>>({});
    const [redraftContext, setRedraftContext] = useState('');
    const isFillingRef = useRef(false);
    // P1 FIX: Track AI help request ID to prevent stale responses overwriting newer ones.
    // When user clicks "AI help" on placeholder A then B, both streams run; without
    // this guard, whichever resolves last wins setAiHelpResult and the loading state
    // from the first call clears the second's prematurely.
    const aiHelpRequestIdRef = useRef(0);
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
    const pageSheetsContainerRef = useRef<HTMLDivElement>(null);
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
            LineHeight,
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
            Citation,
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
            // Wrap getHTML in try/catch — if any custom node extension has
            // a serialization issue (e.g., the content-hole-on-atom bug
            // that crashed DraftPro), we don't want it to take down the
            // entire editor. Fall back to empty string and log the error.
            try {
                const html = e.getHTML();
                latestContentRef.current = html;
                // P2 PERF: Debounce onContentChange — was firing on every keystroke,
                // causing synchronous localStorage.setItem via saveDraftSession.
                // Now waits 500ms after the last keystroke before persisting.
                if (contentChangeDebounceRef.current) {
                    clearTimeout(contentChangeDebounceRef.current);
                }
                contentChangeDebounceRef.current = setTimeout(() => {
                    onContentChange?.(latestContentRef.current);
                }, 500);
            } catch (htmlErr) {
                console.error('[DraftPro] getHTML failed in onUpdate:', htmlErr);
            }

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

            // SAFETY NET: If the editor is already destroyed or null, bail out.
            if (editor.isDestroyed) {
                setIsDrafting(false);
                return;
            }
            const preDraftTitle = title;

            // Disable the editor during drafting so the user can't type
            // mid-stream and lose edits when setContent fires every 250ms.
            editor.setEditable(false);

            // Buffer for the final cleanup pass (placeholder conversion, etc.)
            let draftBuffer = '';
            let lastStreamUpdate = 0;

            // Setup AbortController to allow user to stop the draft
            const abortController = new AbortController();
            (window as any).stopDrafting = () => abortController.abort();

            // ─── TIMEOUT STRATEGY (generous, not aggressive) ────────────────
            //
            // The user reported drafts failing because the timeouts were too
            // aggressive. Gemini 2.0 Flash with a large system prompt can
            // take 30-45 seconds before the FIRST chunk arrives (it's
            // "thinking" — processing the complex legal instructions). That
            // is NORMAL behavior, NOT a stall.
            //
            // New strategy:
            //   - Safety timeout: 180s (3 minutes) — outer bound for the
            //     entire draft. Most drafts complete in 20-60s, but complex
            //     legal documents with citations can take 90-120s.
            //   - Inactivity timeout: 90s — if NO chunks arrive for 90
            //     seconds, the stream is genuinely stalled (not just thinking).
            //     This is long enough to cover Gemini's "thinking" phase.
            //   - Force-clear: 185s — independent of abort, ensures the
            //     overlay never stays forever.
            //   - NO "stalled" warnings in the UI — the user finds them
            //     anxiety-inducing and premature.
            //   - Cancel button appears at 30s — quiet, no red warnings.
            //
            // Previously: safety=60s, inactivity=25s, force-clear=65s.
            // The 25s inactivity timer was killing legitimate drafts where
            // Gemini was still thinking but hadn't sent the first chunk yet.

            const safetyTimeout = setTimeout(() => {
                if (!abortController.signal.aborted) {
                    console.warn('[DraftPro] Drafting timed out after 180s — aborting');
                    abortController.abort();
                }
            }, 180000);

            const forceClearTimeout = setTimeout(() => {
                console.warn('[DraftPro] Force-clearing isDrafting after 185s (independent of abort)');
                setIsDrafting(false);
                if (editor && !editor.isDestroyed) {
                    try { editor.setEditable(true); } catch {}
                }
            }, 185000);

            // INACTIVITY TIMEOUT: 90s with no chunks = genuinely stalled.
            // Reset on every chunk. This is long enough to cover Gemini's
            // "thinking" phase (which can be 30-60s for complex prompts)
            // but short enough to catch a real network stall.
            let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
            const resetInactivityTimer = () => {
                if (inactivityTimer) clearTimeout(inactivityTimer);
                inactivityTimer = setTimeout(() => {
                    if (!abortController.signal.aborted) {
                        console.warn('[DraftPro] No chunks received for 90s — aborting (stream genuinely stalled)');
                        abortController.abort();
                    }
                }, 90000);
            };
            resetInactivityTimer();

            // Clear editor content — canvas stays white
            // PART 1 FIX: Explicit DOM-clearing phase. Before streaming new
            // content, completely purge the stale DOM nodes. This prevents
            // text-over-text overlap during Redraft where the old content
            // wasn't fully removed before new content started rendering.
            try {
                editor.commands.setContent('<p></p>');
                // Force a sync re-render of the ProseMirror view so the DOM
                // is fully cleared before the first chunk arrives.
                if (!editor.isDestroyed) {
                    editor.view.updateState(editor.view.state);
                }
            } catch (e) {
                console.error('[DraftPro] setContent failed on clear:', e);
            }

            // Track if this effect has been cleaned up — prevents calling
            // editor methods on a destroyed editor instance.
            let isCancelled = false;

            // ─── Build the drafting prompt with citations ───────────────
            // If we have citations from ALOA research mode, prepend the
            // source list to the prompt so the AI can cite them inline.
            let draftingPromptWithContext = activeDraftPrompt;
            const allCitations = citationRegistry.getAll();
            if (allCitations.length > 0) {
                const sourceList = citationRegistry.renderReferenceList('nigerian');
                draftingPromptWithContext = `${activeDraftPrompt}

--- CITATION INSTRUCTIONS ---
You have access to the following verified sources. Cite them inline as [n] where n matches the source number. Do NOT invent new citations — only use the sources listed below. If you need a citation that isn't listed, leave an uncited assertion instead.

${sourceList}
--- END CITATION INSTRUCTIONS ---`;
            }

            aiService.streamDraft(
                [{ role: 'user', content: draftingPromptWithContext }],
                { appState, currentUser: currentUser!, signerContext },
                (chunk) => {
                    if (isCancelled || !editor || editor.isDestroyed) return;
                    // Reset the inactivity timer on each chunk — the stream
                    // is alive. If no chunks arrive for 25s, the timer fires
                    // and aborts.
                    resetInactivityTimer();
                    draftBuffer += chunk;
                    const now = Date.now();
                    if (now - lastStreamUpdate > 250) {
                        lastStreamUpdate = now;
                        let preview = draftBuffer
                            .replace(/```html/g, '')
                            .replace(/```/g, '')
                            .replace(/\\n/g, '\n')
                            .replace(/\r/g, '');
                        preview = preview.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                        if (preview.trim()) {
                            try {
                                editor.commands.setContent(preview);
                            } catch (e) {
                                console.error('[DraftPro] setContent failed during stream:', e);
                            }
                        }
                    }
                },
                abortController.signal
            ).then(async () => {
                clearTimeout(safetyTimeout);
                clearTimeout(forceClearTimeout);
                if (inactivityTimer) clearTimeout(inactivityTimer);
                if (isCancelled || !editor || editor.isDestroyed) return;
                // Wrap the entire completion handler in try/catch so that
                // ANY error (e.g. a ReferenceError from a typo, a setContent
                // failure that escapes its inner catch, etc.) is caught and
                // logged instead of propagating as an unhandled promise
                // rejection that crashes the React app. The user has already
                // seen the draft stream in — we must NOT lose it to a crash
                // in post-processing.
                try {
                    setIsDrafting(false);
                    editor.setEditable(true);
                    const trimmedBuffer = draftBuffer.trim();
                    if (editor && trimmedBuffer) {
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

                        try {
                            editor.commands.setContent(processedDraft);
                        } catch (e) {
                            console.error('[DraftPro] setContent failed on final:', e);
                        }
                        addToast('Drafting complete', { type: 'success' });

                        persistDraftRef.current?.(processedDraft, title || 'Untitled Draft', activeDraftPrompt);

                        // ─── Parse citations from the draft output ──────
                        // The AI may include a "## Sources" block at the end
                        // of the draft with inline [1], [2] citation markers.
                        // Parse these and populate the citation registry so
                        // the Sources floater appears with the cited sources.
                        try {
                            const { parseAIResponseForCitations } = await import('../../../utils/citationParser');
                            const parsed = parseAIResponseForCitations(draftBuffer, citationRegistry);
                            if (parsed.hasSources && parsed.citations.length > 0) {
                                console.log(`[DraftPro] Parsed ${parsed.citations.length} citations from draft output`);
                                // Bump the version counter to trigger a re-render
                                // so the Sources floater appears.
                                setCitationVersion(v => v + 1);
                            }
                        } catch (citeErr) {
                            console.warn('[DraftPro] Citation parsing failed (non-fatal):', citeErr);
                        }

                        // ─── Pulse the AI feature buttons ──────────────────
                        // After the draft appears, briefly pulse the Redraft
                        // and Auto-Format buttons so the user notices they
                        // can continue editing with AI. Subtle and non-blocking.
                        triggerAiPulse();
                    } else {
                        const currentContent = editor?.getHTML() || '';
                        if (currentContent === '<p></p>' || !currentContent) {
                            try {
                                editor?.commands.setContent('<p style="color:#94a3b8; text-align:center; padding:24px;"><i>The AI returned an empty response. Please try again with a more specific prompt.</i></p>');
                            } catch (e) {
                                console.error('[DraftPro] setContent failed on empty:', e);
                            }
                            addToast('Drafting returned empty. Try a more specific prompt.', { type: 'info' });
                        }
                    }
                } catch (completionErr) {
                    // Safety net: any unexpected error in the completion
                    // handler must NOT crash the app or leave isDrafting
                    // stuck on. Force-clear the overlay and log the error.
                    console.error('[DraftPro] Completion handler error (recovered):', completionErr);
                    setIsDrafting(false);
                    if (editor && !editor.isDestroyed) {
                        try { editor.setEditable(true); } catch {}
                    }
                    addToast('Draft completed (post-processing issue — your content is preserved).', { type: 'info' });
                }
            }).catch(e => {
                clearTimeout(safetyTimeout);
                clearTimeout(forceClearTimeout);
                if (inactivityTimer) clearTimeout(inactivityTimer);
                if (isCancelled) return;
                console.error("Drafting error:", e);
                setIsDrafting(false);
                if (editor && !editor.isDestroyed) {
                    editor.setEditable(true);
                }
                if (e.name === 'AbortError') {
                    // If we got partial content before the abort, show it
                    // rather than leaving the page blank. This covers both
                    // user-cancelled drafts and inactivity-timeout aborts
                    // where the stream produced some content then stalled.
                    const trimmedBuffer = draftBuffer.trim();
                    if (editor && !editor.isDestroyed && trimmedBuffer) {
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
                        try {
                            editor.commands.setContent(processedDraft);
                        } catch (err) {
                            console.error('[DraftPro] setContent failed on abort recovery:', err);
                        }
                        addToast('Drafting stopped — partial content preserved. Click Redraft to try again.', { type: 'info' });
                        persistDraftRef.current?.(processedDraft, title || 'Untitled Draft', activeDraftPrompt);
                    } else {
                        addToast('Drafting cancelled. Click Redraft to try again.', { type: 'info' });
                    }
                } else {
                    try {
                        const trimmedBuffer = draftBuffer.trim();
                        if (editor && !editor.isDestroyed && trimmedBuffer) {
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
                            try {
                                editor.commands.setContent(processedDraft);
                            } catch (err) {
                                console.error('[DraftPro] setContent failed on error recovery:', err);
                            }
                            addToast('Draft completed (with minor stream error).', { type: 'success' });
                            persistDraftRef.current?.(processedDraft, title || 'Untitled Draft', activeDraftPrompt);
                        } else {
                            // Drafting failed with no content — show error message
                            // in the editor and a toast. The key fix: ensure
                            // isDrafting is ALWAYS set to false here so the
                            // "Preparing your document..." overlay disappears.
                            try {
                                editor?.commands.setContent(`<p style="color:#ef4444; text-align:center; padding:24px;"><i>Drafting failed: ${e.message || 'Unknown error'}. Check your AI API key in Settings → AI Settings.</i></p>`);
                            } catch (err) {
                                console.error('[DraftPro] setContent failed on error display:', err);
                            }
                            addToast(`Drafting failed: ${e.message}. Check your AI API key in Settings → AI Settings.`, { type: 'error' });
                        }
                    } catch (recoveryErr) {
                        // Even the error-recovery path failed. Make sure we
                        // still clear the overlay so the user isn't stuck.
                        console.error('[DraftPro] Error recovery failed:', recoveryErr);
                        setIsDrafting(false);
                        addToast('Drafting encountered an error. Please try again.', { type: 'error' });
                    }
                }
            });

            return () => {
                isCancelled = true;
                clearTimeout(safetyTimeout);
                clearTimeout(forceClearTimeout);
                abortController.abort();
                if (editor && !editor.isDestroyed) {
                    editor.setEditable(true);
                }
            };
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
            try {
                onSave?.(editor.getHTML());
                setIsSaved(true);
                addToast('Document saved successfully', { type: 'success' });
            } catch (e) {
                console.error('[DraftPro] getHTML failed on save:', e);
                addToast('Could not save — document has an internal error. Please try editing and saving again.', { type: 'error' });
            }
        }
    }, [editor, onSave, addToast]);

    // ─── Navigation guard helpers ──────────────────────────────────────
    // `attemptNavigation` checks the dirty state. If dirty, it opens the
    // custom guard modal and stashes the navigation callback. If clean,
    // it just fires the callback immediately.
    const attemptNavigation = useCallback((kind: 'back' | 'research' | 'custom', onConfirm: () => void) => {
        if (shouldBlockNavigation(!isSaved)) {
            setPendingNav({ kind, onConfirm });
        } else {
            onConfirm();
        }
    }, [isSaved]);

    // User clicked "Save & Leave" in the guard modal — save then navigate.
    const confirmNavWithSave = useCallback(() => {
        if (!editor) {
            // No editor — just navigate
            const cb = pendingNav?.onConfirm;
            setPendingNav(null);
            cb?.();
            return;
        }
        try {
            onSave?.(editor.getHTML());
            setIsSaved(true);
        } catch (e) {
            console.error('[DraftPro] save before leave failed:', e);
            // P1 FIX: Was silent — user had no idea their draft wasn't saved
            addToast('Could not save your draft before leaving. Please save manually.', { type: 'warning' });
        }
        const cb = pendingNav?.onConfirm;
        setPendingNav(null);
        cb?.();
    }, [editor, onSave, pendingNav]);

    // User clicked "Leave Without Saving" — just navigate.
    const confirmNavWithoutSave = useCallback(() => {
        const cb = pendingNav?.onConfirm;
        setPendingNav(null);
        cb?.();
    }, [pendingNav]);

    // User clicked "Stay on Page" — close modal, do nothing.
    const cancelPendingNav = useCallback(() => {
        setPendingNav(null);
    }, []);

    // ─── Prompt-First Research Pipeline ────────────────────────────────
    // When the user clicks "Research" on a citation (or "Verify All"),
    // we DON'T auto-start a research chat. Instead:
    //   1. Generate an optimal web search query via Gemini
    //   2. Open Research in a NEW tab with the query PRE-FILLED in the
    //      chat input box (NOT auto-sent)
    //   3. The user reviews, edits if needed, and presses Enter to run
    //
    // This keeps the lawyer in control — they curate the query before
    // burning tokens on a wrong search.
    const handleResearchCitation = useCallback(async (cite: any, allCitations?: any[]) => {
        // Show loading state on this specific citation
        setGeneratingQueryForCite(cite.id);
        try {
            // Persist draft before leaving (so user can come back)
            try {
                let html = '';
                if (editor) html = editor.getHTML();
                if (html && html !== '<p></p>' && persistDraftRef.current) {
                    persistDraftRef.current(html, title || 'Untitled Draft', draftPrompt);
                }
            } catch { /* ignore getHTML errors */ }

            // Build the context for the AI: the citation text + surrounding citations
            const contextCitations = allCitations && allCitations.length > 0 ? allCitations : [cite];
            const contextStr = contextCitations.map((c: any) =>
                `[${c.number}] ${c.text}${c.url ? ` (${c.url})` : ''}${c.jurisdiction ? ` [${c.jurisdiction}]` : ''}`
            ).join('\n');

            // Generate the search query via Gemini (firm API key)
            const { generateResearchQuery } = await import('../../../services/geminiService');
            const query = await generateResearchQuery(
                contextStr,
                {
                    hint: 'verify and find authoritative legal sources for this citation',
                    jurisdiction: cite.jurisdiction || 'Nigeria',
                    documentTitle: title || 'Untitled Document',
                },
                // firmDetails is in appState — pass it for the API key
                (appState as any)?.firmDetails,
            );

            // Open Research in a new tab with the query PRE-FILLED
            // (prefilledQuery flag tells ResearchChat to populate input
            //  but NOT auto-send — user must press Enter)
            const ctx = {
                autoStartResearch: false,             // ← key change: do NOT auto-send
                prefillQuery: query,                   // ← pre-fill the input
                prefillContext: contextStr,            // ← context shown to user
                documentTitle: title || 'Untitled Document',
                sources: contextCitations,             // ← still create the notebook + sources
                promptFirstMode: true,                 // ← enable the curated UI
            };

            const url = buildRouteUrlWithHashContext('research', ctx);
            const opened = openInNewTab(url);
            if (opened) {
                addToast(`Generated search query — review & press Enter in the new tab.`, { type: 'success' });
            } else {
                // Fall back to in-place nav (mobile / popup blocked)
                navigateTo('research', null, ctx);
                addToast(`Generated search query — review & press Enter.`, { type: 'success' });
            }
        } catch (e: any) {
            console.error('[Prompt-First Research] failed:', e);
            addToast('Could not generate search query. Please try again.', { type: 'error' });
        } finally {
            setGeneratingQueryForCite(null);
        }
    }, [editor, title, draftPrompt, appState, addToast, navigateTo]);

    // ─── Insert Citations into Document Footer ─────────────────────────
    // Appends a "TABLE OF AUTHORITIES / AUTHORITIES CITED" section at the
    // end of the document, listing all citations from the sidebar in a
    // professional legal format. The section uses a page break + bold
    // heading, matching the canvas's existing formatting.
    //
    // This is the "Insert into Canvas Footer" action from Part 3 spec.
    const handleInsertCitationsToFooter = useCallback(() => {
        if (!editor) {
            addToast('Editor not ready.', { type: 'error' });
            return;
        }
        const allCites = citationRegistry.getAll();
        if (allCites.length === 0) {
            addToast('No citations to insert.', { type: 'info' });
            return;
        }

        try {
            // ─── Nigerian footnote convention ──────────────────────────
            // Replace the old "TABLE OF AUTHORITIES" bottom table with:
            //   1. Inline superscript markers (¹, ², ³...) at the point of
            //      each [n] citation in the document body
            //   2. A standard footnote block at the bottom of the canvas
            //      (not a table) with the full citation text
            //
            // This matches Nigerian legal practice: numbered footnotes at
            // the page margin, not a separate table of authorities page.
            //
            // The superscript markers replace the inline [1], [2] etc.
            // citation markers that the AI inserts during drafting.

            // ─── Step 1: Replace inline [n] markers with superscript ──
            // Walk the document and replace [1], [2], etc. with <sup>¹</sup>
            const currentHtml = editor.getHTML();
            let updatedHtml = currentHtml;

            // Map citation numbers to Unicode superscripts
            const superscripts = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '¹⁰',
                                  '¹¹', '¹²', '¹³', '¹⁴', '¹⁵', '¹⁶', '¹⁷', '¹⁸', '¹⁹', '²⁰'];

            allCites.forEach((cite: any) => {
                const num = cite.number;
                const superscript = num < superscripts.length ? superscripts[num] : `<sup>${num}</sup>`;
                // Replace [n] with the superscript — but only if it looks
                // like a citation marker, not a placeholder
                const marker = `[${num}]`;
                // Don't replace if it's inside a legal-placeholder span
                updatedHtml = updatedHtml.split(marker).join(`<sup>${superscript}</sup>`);
            });

            // ─── Step 2: Build the footnote block ─────────────────────
            // Standard footnote block format (not a table):
            //   ____________________
            //   ¹ Citation text
            //   ² Citation text
            const footnoteBlock = `
<div style="page-break-before: always;"></div>
<div style="border-top: 1px solid #333; margin-top: 2rem; padding-top: 0.5rem;">
<p style="font-weight: bold; font-size: 0.9em; margin-bottom: 0.5rem;">Footnotes</p>
${allCites.map((c: any) => {
    const num = c.number;
    const superscript = num < superscripts.length ? superscripts[num] : `${num}`;
    const pinpoint = classifyAndCheckCitation(c.text)?.pinpoint;
    const citationText = `${c.text}${pinpoint ? ` (at ${pinpoint})` : ''}${c.url ? ` Available at ${c.url}` : ''}`;
    return `<p style="font-size: 0.85em; line-height: 1.6; margin-bottom: 0.4rem; padding-left: 1.5rem; text-indent: -1.5rem;"><sup>${superscript}</sup> ${citationText}</p>`;
}).join('\n')}
</div>
`;

            // Set the updated HTML (with superscripts) + append footnote block
            editor.chain().focus().setContent(updatedHtml).run();
            editor.chain().focus().insertContent(footnoteBlock).run();

            // Mark as unsaved (the user just added content)
            setIsSaved(false);
            addToast(`Inserted ${allCites.length} footnote${allCites.length > 1 ? 's' : ''} (Nigerian convention).`, { type: 'success' });
        } catch (e: any) {
            console.error('[Insert Citations to Footer] failed:', e);
            addToast('Could not insert citations — please try again.', { type: 'error' });
        }
    }, [editor, citationRegistry, addToast]);

    // ─── Save as DOCX/PDF and add to Documents section ──────────────────
    // Generates a DOCX or PDF file, uploads it to Convex storage, and
    // creates a Document record so it appears in the Documents section.
    // The user can then download, preview, or share the file from there.
    const [isSavingFile, setIsSavingFile] = useState(false);
    const saveAsFile = useCallback(async (format: 'docx' | 'pdf') => {
        if (!editor) return;

        // ─── PDF: Use iframe print pipeline (NOT html2canvas) ────────
        // The browser's native print engine produces a vector PDF with
        // proper page breaks, margins, and selectable text. html2canvas
        // produces a rasterized screenshot that has gaps, orphan headings,
        // and is affected by zoom level.
        //
        // For PDF: we open the print dialog — the user saves as PDF via
        // the browser. This is the most reliable approach and produces a
        // TRUE representation of what appears on the DraftPro canvas.
        if (format === 'pdf') {
            addToast('Opening print dialog — choose "Save as PDF" to save.', { type: 'info' });
            handlePrint();
            setIsSaved(true);
            return;
        }

        // ─── DOCX: Use the OOXML export pipeline ─────────────────────
        const startTime = Date.now();
        try {
            setIsSavingFile(true);
            const html = editor.getHTML();
            const safeTitle = (title || 'document').replace(/[^a-zA-Z0-9-_]/g, '_');
            const filename = `${safeTitle}.${format}`;
            const mimeType = format === 'docx'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'application/pdf';

            // ─── DIAGNOSTIC LOG ──────────────────────────────────────
            // Logs the payload size and format so we can diagnose failures.
            console.log(`[saveAsFile] Starting ${format.toUpperCase()} export`, {
                htmlLength: html.length,
                htmlSizeKB: Math.round(html.length / 1024),
            });

            addToast(`Generating ${format.toUpperCase()}…`, { type: 'info' });

            // Generate the Blob with a timeout
            let blob: Blob;
            const generateTimeout = format === 'pdf' ? 60000 : 30000; // PDF: 60s, DOCX: 30s
            const generatePromise = (async () => {
                if (format === 'docx') {
                    return exportHtmlToDocxBlob(html, {
                        title: title || 'Document',
                        author: currentUser?.name || 'PracticePro',
                        firmName: appState?.firmDetails?.name || '',
                    });
                } else {
                    return exportHtmlToPdfBlob(html, {
                        title: title || 'Document',
                        author: currentUser?.name || 'PracticePro',
                        firmName: appState?.firmDetails?.name || '',
                        // PART 3 FIX: Pass the actual editor canvas element so
                        // the PDF matches the editor's exact layout (margins,
                        // header/footer, page breaks). Falls back to a temp
                        // container if the ref isn't available.
                        canvasElement: pageSheetsContainerRef.current || undefined,
                    });
                }
            })();

            // Race the generation against a timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('timeout')), generateTimeout);
            });

            try {
                blob = await Promise.race([generatePromise, timeoutPromise]);
            } catch (genErr: any) {
                console.error(`[saveAsFile] ${format.toUpperCase()} generation failed:`, genErr);
                if (genErr.message === 'timeout') {
                    addToast(`${format.toUpperCase()} generation timed out after ${generateTimeout / 1000}s. The document may be too large — try splitting it.`, { type: 'error' });
                } else {
                    addToast(`${format.toUpperCase()} generation failed: ${genErr.message}. Try again or use Print/PDF instead.`, { type: 'error' });
                }
                return;
            }

            console.log(`[saveAsFile] ${format.toUpperCase()} blob generated`, {
                blobSizeKB: Math.round(blob.size / 1024),
                generateTimeMs: Date.now() - startTime,
            });

            // Upload to Convex storage with a timeout
            addToast(`Uploading ${format.toUpperCase()} to documents…`, { type: 'info' });
            const uploadStartTime = Date.now();

            try {
                const uploadTimeout = 120000; // 2 minutes for upload
                const storageId = await Promise.race([
                    uploadBlobToConvex(blob, generateUploadUrl),
                    new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error('upload-timeout')), uploadTimeout);
                    }),
                ]);

                console.log(`[saveAsFile] Upload complete`, {
                    storageId,
                    uploadTimeMs: Date.now() - uploadStartTime,
                });

                // Create a Document record so it appears in the Documents section
                await handleAddDocumentAndAnalyze({
                    title: title || 'Untitled Document',
                    firmId: appState?.firmDetails?.id || currentUser?.firmId || '',
                    categoryId: 'drafts',
                    dateFiled: new Date().toISOString(),
                    source: 'generated',
                    uploadedBy: currentUser?.id,
                    content: html, // Keep HTML for in-app editing
                    file: {
                        name: filename,
                        type: mimeType,
                        size: blob.size,
                        filePath: '',
                        storageId, // The Convex storage ID — this is the key
                    },
                });

                // Also trigger a browser download
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);

                addToast(`${format.toUpperCase()} saved to Documents and downloaded.`, { type: 'success' });
                setIsSaved(true);
            } catch (uploadErr: any) {
                console.error(`[saveAsFile] Upload failed:`, uploadErr);
                if (uploadErr.message === 'upload-timeout') {
                    addToast(`Upload timed out after 2 minutes. The file (${Math.round(blob.size / 1024)}KB) may be too large. Try a smaller document.`, { type: 'error' });
                } else if (uploadErr.message?.includes('Failed to fetch')) {
                    addToast(`Network error during upload. Check your internet connection and try again.`, { type: 'error' });
                } else {
                    addToast(`Upload failed: ${uploadErr.message}. The file was generated but could not be saved to Documents.`, { type: 'error' });
                }
            }
        } catch (err: any) {
            console.error(`[saveAsFile] Unexpected error:`, err);
            addToast(`Unexpected error saving ${format.toUpperCase()}: ${err.message}`, { type: 'error' });
        } finally {
            setIsSavingFile(false);
        }
    }, [editor, title, currentUser, appState, addToast, generateUploadUrl, handleAddDocumentAndAnalyze]);

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

        // ─── Iframe-based print pipeline ──────────────────────────────
        // Creates a hidden iframe with the document HTML, applies the exact
        // same print CSS (A4, margins, Times New Roman, page breaks),
        // and calls iframe.contentWindow.print().
        //
        // This produces a VECTOR PDF (text is selectable, sharp at any zoom)
        // via the browser's native print engine — NOT a rasterized screenshot
        // like html2canvas. The zoom level of the editor does NOT affect the
        // output because the iframe renders at 100% scale independently.
        //
        // The user gets the browser's "Save as PDF" dialog which is the most
        // reliable PDF generator available.
        try {
            const html = editor.getHTML();
            const letterheadHtml = appState.firmDetails?.settings?.headerConfig
                ? '<div class="letterhead"></div>'
                : '';

            const printDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title || 'Document'}</title>
<style>
  @page { size: A4; margin: 25mm 25mm 25mm 25mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1a1a1a;
  }
  .letterhead { margin-bottom: 16pt; text-align: center; }
  h1 { font-size: 16pt; font-weight: bold; margin: 16pt 0 8pt; break-after: avoid; break-inside: avoid; }
  h2 { font-size: 14pt; font-weight: bold; margin: 14pt 0 6pt; break-after: avoid; break-inside: avoid; }
  h3 { font-size: 12pt; font-weight: bold; margin: 12pt 0 4pt; break-after: avoid; break-inside: avoid; }
  h1 + p, h2 + p, h3 + p { break-before: avoid; }
  p { margin: 0 0 8pt; text-align: justify; orphans: 2; widows: 2; }
  ul, ol { margin: 0 0 8pt; padding-left: 20pt; }
  li { margin-bottom: 4pt; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0; break-inside: avoid; }
  td, th { border: 1px solid #ccc; padding: 4pt 8pt; text-align: left; }
  th { background: #f5f5f5; font-weight: bold; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  .page-break { page-break-after: always; break-after: page; }
  sup { font-size: 0.7em; vertical-align: super; }
  /* Prevent orphan headings at bottom of page */
  h1, h2, h3 { page-break-after: avoid; }
  /* Prevent large gaps — keep paragraphs with their following content */
  p { page-break-inside: avoid; }
  /* Watermark */
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 120px; font-weight: 900;
    color: rgba(220, 38, 38, 0.08);
    white-space: nowrap; pointer-events: none; z-index: 0;
  }
</style>
</head>
<body>
  ${watermark ? `<div class="watermark">${watermark}</div>` : ''}
  ${letterheadHtml}
  ${html}
</body>
</html>`;

            // Create hidden iframe
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            document.body.appendChild(iframe);

            // Write content and print
            const doc = iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(printDoc);
                doc.close();
                // Wait for content to render before printing
                setTimeout(() => {
                    try {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                    } catch (e) {
                        console.error('[DraftPro] Print failed:', e);
                        addToast('Could not open print dialog. Try the Print/PDF button instead.', { type: 'error' });
                    }
                    // Remove iframe after print dialog closes
                    setTimeout(() => {
                        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                    }, 1000);
                }, 500);
            }
        } catch (e) {
            console.error('[DraftPro] Print setup failed:', e);
            addToast('Could not prepare document for printing.', { type: 'error' });
        }
    }, [editor, addToast, title, appState.firmDetails, watermark]);

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

    // Track the current page based on the scroll position of the editor canvas.
    // Previously this was hardcoded to "Page 1 of N" — now it reflects where
    // the user's scroll position is.
    const [currentPage, setCurrentPage] = useState(1);
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = scrollAreaRef.current;
        if (!el) return;
        const onScroll = () => {
            const scrollTop = el.scrollTop;
            const pageHeightWithGap = (PAGE_HEIGHT_PX + PAGE_GAP_PX) * zoom;
            const page = Math.min(pageCount, Math.max(1, Math.floor(scrollTop / pageHeightWithGap) + 1));
            setCurrentPage(page);
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [zoom, pageCount]);

    // Global keyboard shortcuts for zoom (Ctrl+=, Ctrl+-, Ctrl+0)
    // and focus mode toggle (F11). These are window-level so they work
    // even when the editor isn't focused.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                setZoom(z => Math.min(3.0, z + 0.1));
            } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                setZoom(z => Math.max(0.3, z - 0.1));
            } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                setZoom(1);
            } else if (e.key === 'F11') {
                e.preventDefault();
                setFocusMode(f => !f);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

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

        // Use the React context action (not the non-existent window.dataActions)
        if (addItem) {
            addItem('documentTemplates', newTemplate, 'Document Template');
            addToast(`Template "${name}" saved — you can reuse it via ALOA/ARIA or the Templates section in Settings.`, { type: 'success' });
            setActiveModal(null);
            setModalInput('');
        } else {
            addToast('Storage service unavailable. Please try again.', { type: 'error' });
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

        // P1 FIX: Assign a unique ID to this request. After every await, check
        // if we're still the latest request — if not, abort silently.
        const myRequestId = ++aiHelpRequestIdRef.current;

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
                // Stale check after dynamic import
                if (myRequestId !== aiHelpRequestIdRef.current) return;

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
                    (chunk) => {
                        // Stale check during streaming — don't accumulate if a newer request started
                        if (myRequestId === aiHelpRequestIdRef.current) {
                            suggestion += chunk;
                        }
                    },
                    'flash'
                );

                // Final stale check before applying result
                if (myRequestId !== aiHelpRequestIdRef.current) return;

                if (suggestion.trim()) {
                    setAiHelpResult(prev => ({ ...prev, [label]: suggestion.trim() }));
                    addToast(`AI suggestion for [${label}] ready`, { type: 'info' });
                }
            } catch (err: any) {
                if (myRequestId !== aiHelpRequestIdRef.current) return;
                console.warn('AI help failed for placeholder:', err.message);
            } finally {
                // Only clear loading state if this is still the latest request
                if (myRequestId === aiHelpRequestIdRef.current) {
                    setAiHelpLoading(false);
                    setAiHelpLabel(null);
                }
            }
        })();
    };

    // if (!editor) return null; // Removed to prevent "black screen" during init

    return (
        <div className="flex flex-col h-full bg-slate-100 dark:bg-zinc-950 overflow-hidden font-sans">

            {/* ── Top bar (Title + Meta) ── */}
            <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 h-12 flex items-center justify-between z-[60] no-print">
                <div className="flex items-center gap-3 min-w-0">
                    {/* ── Back button ─────────────────────────────────────────
                        Only shown when DraftPro is NOT in a dedicated new tab.
                        When a draft opens via window.open() (detected via
                        ?draftKey= + window.opener / window.name="draftpro-*"),
                        the parent app shell is still alive in another tab, so
                        a Back button here is redundant — the user just closes
                        this tab to return. Showing one would imply in-app
                        navigation that doesn't exist (this tab has no history).
                        When popup-blocked or on mobile, DraftPro opens in-place
                        and the Back button is essential to return to the app. */}
                    {!isInNewTab && (
                        <>
                            <button
                                onClick={() => {
                                    // Wrap the back navigation in the dirty-state guard.
                                    // If unsaved changes exist, the guard modal opens with
                                    // [Save & Leave] [Leave Without Saving] [Stay on Page].
                                    attemptNavigation('back', () => {
                                        if (onBack) { onBack(); return; }
                                        if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.origin)) {
                                            window.history.back();
                                        } else {
                                            window.location.href = '/';
                                        }
                                    });
                                }}
                                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white text-xs font-bold transition-colors"
                            >
                                <ChevronDown className="w-4 h-4 rotate-90" />
                                <span className="hidden sm:inline">Back</span>
                            </button>

                            <div className="w-px h-4 bg-slate-200 dark:bg-zinc-800" />
                        </>
                    )}

                    <input autoComplete="off" data-lpignore="true" 
                        value={title || ''}
                        onChange={e => onTitleChange?.(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm font-bold text-slate-900 dark:text-white focus:ring-0 min-w-0 truncate max-w-[300px]"
                        placeholder="Untitled Document"
                    />

                    {!isSaved && (
                        <div className="flex items-center gap-1 text-3xs text-amber-500 font-bold uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                            <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                            Unsaved
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Open in new tab — only relevant when not already in a new tab.
                        When DraftPro is already in its own dedicated tab (via
                        draftTabs), this button is redundant and confusing —
                        clicking it would just open another copy of the same draft.

                        PERSISTENCE: Before opening the new tab, we save the
                        current draft content to localStorage so the new tab
                        can load it. Without this, the new tab opens with an
                        empty editor because the draft content only exists in
                        this tab's in-memory state. */}
                    {!isInNewTab && (
                        <button
                            onClick={() => {
                                // Save the current draft to localStorage so
                                // the new tab can pick it up.
                                let currentContent = '';
                                try { currentContent = editor?.getHTML() || ''; }
                                catch (e) { console.error('[DraftPro] getHTML failed on open-in-new-tab:', e); }
                                if (currentContent && currentContent !== '<p></p>' && persistDraftRef.current) {
                                    persistDraftRef.current(currentContent, title || 'Untitled Draft', draftPrompt);
                                }
                                // Build the URL with the draftKey so the new
                                // tab loads the saved draft (not a fresh one).
                                const url = new URL(window.location.href);
                                // If there's no draftKey in the URL yet, add one
                                // so the new tab knows to load from localStorage.
                                if (!url.searchParams.get('draftKey') && title) {
                                    // We need a stable key — use a hash of the title
                                    // + timestamp so it doesn't collide with other drafts.
                                    const key = `draft:general:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
                                    url.searchParams.set('draftKey', key);
                                    url.searchParams.set('title', encodeURIComponent(title));
                                }
                                window.open(url.toString(), '_blank');
                            }}
                            className="flex items-center justify-center p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Open in new tab"
                            aria-label="Open in new tab"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all shadow-sm active:scale-95"
                        title="Print / PDF"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Print/PDF</span>
                    </button>
                    <button
                        onClick={handleManualSave}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
                        title="Save"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Save</span>
                    </button>
                </div>
            </div>

            {/* ── Ribbon Toolbar (hidden in Focus Mode — press F11 to toggle) ──
                Organized into clear functional groups with visual dividers:
                File | Font | Paragraph | Insert | Tools | AI | Zoom
                Each group is separated by a thin vertical divider for
                better visual scannability. */}
            {!focusMode && (
            <div className="flex-shrink-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 shadow-sm z-50">
                {/* Ribbon — ONE LINE, compact. Uses overflow-x-auto as a
                    fallback for very narrow screens, but the compact
                    sizing should fit everything on one line on desktop. */}
                <div className="flex items-stretch gap-0 px-0.5 py-0.5 overflow-x-auto custom-scrollbar no-scrollbar">

                    <ToolbarGroup label="File">
                        <ToolbarBtn icon={NewDocumentIcon} label="New" onClick={handleNewDocument} size="lg" disabled={!editor || isDrafting} />
                        <ToolbarBtn icon={Save} label="Save" onClick={handleManualSave} size="lg" disabled={isSaved || !editor || isDrafting} />
                        <div className="flex flex-col gap-0.5">
                            <ToolbarBtn icon={Undo} onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} size="sm" label="Undo" />
                            <ToolbarBtn icon={Redo} onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} size="sm" label="Redo" />
                        </div>
                        <ToolbarBtn icon={Printer} onClick={handlePrint} size="sm" label="Print" />
                        {/* Print Preview — slide-in drawer with live A4 preview */}
                        <ToolbarBtn
                            icon={Eye}
                            label="Preview"
                            onClick={() => setShowPrintPreview(true)}
                            size="lg"
                            disabled={!editor}
                        />
                        {/* DOCX Export — saves to Documents section AND downloads */}
                        <ToolbarBtn
                            icon={DownloadIcon}
                            label={isSavingFile ? "…" : "DOCX"}
                            onClick={() => saveAsFile('docx')}
                            size="lg"
                            disabled={!editor || isDrafting || isSavingFile}
                        />
                        {/* PDF Export — saves to Documents section AND downloads */}
                        <ToolbarBtn
                            icon={DownloadIcon}
                            label={isSavingFile ? "…" : "PDF"}
                            onClick={() => saveAsFile('pdf')}
                            size="lg"
                            disabled={!editor || isDrafting || isSavingFile}
                        />
                        <ToolbarBtn
                            icon={PageBreakIcon}
                            label="Page Break"
                            onClick={() => editor?.chain().focus().setPageBreak().run()}
                            size="lg"
                            disabled={!editor}
                        />
                        {/* Watermark dropdown — click-to-toggle (not hover).
                            Uses fixed positioning via portal to escape the
                            ribbon's overflow-x-auto clipping. */}
                        <div className="relative">
                            <ToolbarBtn
                                icon={Shield}
                                label="Watermark"
                                onClick={() => setOpenDropdown(openDropdown === 'watermark' ? null : 'watermark')}
                                size="lg"
                                className={watermark ? 'text-red-500' : ''}
                                disabled={!editor}
                            />
                            {openDropdown === 'watermark' && (
                                <>
                                    {/* Click-outside overlay */}
                                    <div className="fixed inset-0 z-[60]" onClick={() => setOpenDropdown(null)} />
                                    <div className="absolute top-full mt-1 left-0 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-[61] min-w-[140px]">
                                        {['DRAFT', 'CONFIDENTIAL', 'WITHOUT PREJUDICE', 'PRIVATE & CONFIDENTIAL'].map(wm => (
                                            <button
                                                key={wm}
                                                onClick={() => { setWatermark(watermark === wm ? null : wm); setOpenDropdown(null); }}
                                                className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-zinc-700 ${watermark === wm ? 'font-bold text-red-500' : 'text-slate-600 dark:text-zinc-400'}`}
                                            >
                                                {wm}
                                            </button>
                                        ))}
                                        {watermark && (
                                            <>
                                                <div className="border-t border-slate-200 dark:border-zinc-700 my-1" />
                                                <button
                                                    onClick={() => { setWatermark(null); setOpenDropdown(null); }}
                                                    className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500"
                                                >
                                                    Remove Watermark
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Page Number dropdown — click-to-toggle (not hover). */}
                        <div className="relative">
                            <ToolbarBtn
                                icon={HashIcon}
                                label="Page #"
                                onClick={() => setOpenDropdown(openDropdown === 'pageNumber' ? null : 'pageNumber')}
                                size="lg"
                                className={pageNumberConfig.enabled ? 'text-blue-600 dark:text-blue-400' : ''}
                                disabled={!editor}
                            />
                            {openDropdown === 'pageNumber' && (
                                <>
                                    <div className="fixed inset-0 z-[60]" onClick={() => setOpenDropdown(null)} />
                                    <div className="absolute top-full mt-1 left-0 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl py-2 z-[61] min-w-[200px]">
                                        {/* Toggle on/off */}
                                        <label className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-zinc-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={pageNumberConfig.enabled}
                                                onChange={(e) => setPageNumberConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="font-semibold text-slate-700 dark:text-zinc-300">Show page numbers</span>
                                        </label>

                                        <div className="border-t border-slate-200 dark:border-zinc-700 my-1" />

                                        {/* Position */}
                                        <p className="px-3 py-1 text-2xs uppercase font-bold text-slate-400">Position</p>
                                        {([
                                            { val: 'bottom-center', label: 'Bottom Center' },
                                            { val: 'bottom-right', label: 'Bottom Right' },
                                            { val: 'bottom-left', label: 'Bottom Left' },
                                            { val: 'none', label: 'Hidden' },
                                        ] as const).map(pos => (
                                            <button
                                                key={pos.val}
                                                onClick={() => setPageNumberConfig(prev => ({ ...prev, position: pos.val, enabled: pos.val !== 'none' }))}
                                                className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-zinc-700 ${pageNumberConfig.position === pos.val ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-zinc-400'}`}
                                            >
                                                {pos.label}
                                            </button>
                                        ))}

                                        <div className="border-t border-slate-200 dark:border-zinc-700 my-1" />

                                        {/* Format */}
                                        <p className="px-3 py-1 text-2xs uppercase font-bold text-slate-400">Format</p>
                                        {([
                                            { val: 'page-of', label: 'Page 1 of 5' },
                                            { val: 'page-only', label: 'Page 1' },
                                            { val: 'dash', label: '- 1 -' },
                                            { val: 'number-only', label: '1' },
                                        ] as const).map(fmt => (
                                            <button
                                                key={fmt.val}
                                                onClick={() => setPageNumberConfig(prev => ({ ...prev, format: fmt.val }))}
                                                className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-zinc-700 ${pageNumberConfig.format === fmt.val ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-zinc-400'}`}
                                            >
                                                {fmt.label}
                                            </button>
                                        ))}

                                        <div className="border-t border-slate-200 dark:border-zinc-700 my-1" />

                                        {/* Start from */}
                                        <p className="px-3 py-1 text-2xs uppercase font-bold text-slate-400">Start from</p>
                                        <div className="flex items-center gap-2 px-3 py-1.5">
                                            <button
                                                onClick={() => setPageNumberConfig(prev => ({ ...prev, startFrom: Math.max(1, prev.startFrom - 1) }))}
                                                className="w-6 h-6 rounded bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 flex items-center justify-center text-xs font-bold"
                                            >
                                                −
                                            </button>
                                            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 w-6 text-center">{pageNumberConfig.startFrom}</span>
                                            <button
                                                onClick={() => setPageNumberConfig(prev => ({ ...prev, startFrom: prev.startFrom + 1 }))}
                                                className="w-6 h-6 rounded bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 flex items-center justify-center text-xs font-bold"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </ToolbarGroup>

                    <ToolbarGroup label="Font">
                        <div className="flex flex-col gap-1 min-w-[140px]">
                            {/* Font Family Selector */}
                            <div className="relative group">
                                <select
                                    className="w-full text-2xs h-6 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1 outline-none appearance-none pr-4"
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
                                        className="w-14 text-2xs h-6 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1 outline-none appearance-none pr-4"
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
                            <ToolbarBtn icon={Bold} label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={Italic} label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={UnderlineIcon} label="Underline" onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={StrikethroughIcon} label="Strikethrough" onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={SubscriptIcon} label="Subscript" onClick={() => editor?.chain().focus().toggleSubscript().run()} active={editor?.isActive('subscript')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={SuperscriptIcon} label="Superscript" onClick={() => editor?.chain().focus().toggleSuperscript().run()} active={editor?.isActive('superscript')} size="sm" disabled={!editor} />
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
                                className="text-3xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 font-medium"
                                title="Remove Highlight"
                                disabled={!editor}
                            >
                                Clear
                            </button>
                        </div>
                    </ToolbarGroup>

                    <ToolbarGroup label="Paragraph">
                        <div className="grid grid-cols-4 gap-0.5">
                            <ToolbarBtn icon={AlignLeft} label="Align Left" onClick={() => editor?.chain().focus().setTextAlign('left').run()} active={editor?.isActive({ textAlign: 'left' })} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={AlignCenter} label="Align Center" onClick={() => editor?.chain().focus().setTextAlign('center').run()} active={editor?.isActive({ textAlign: 'center' })} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={AlignRight} label="Align Right" onClick={() => editor?.chain().focus().setTextAlign('right').run()} active={editor?.isActive({ textAlign: 'right' })} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={AlignJustify} label="Align Justify" onClick={() => editor?.chain().focus().setTextAlign('justify').run()} active={editor?.isActive({ textAlign: 'justify' })} size="sm" disabled={!editor} />

                            <ToolbarBtn icon={List} label="Bullet List" onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={ListOrdered} label="Numbered List" onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={Outdent} label="Outdent" onClick={() => editor?.chain().focus().liftListItem('listItem').run()} size="sm" disabled={!editor} />
                            <ToolbarBtn icon={Indent} label="Indent" onClick={() => editor?.chain().focus().sinkListItem('listItem').run()} size="sm" disabled={!editor} />
                        </div>

                        <div className="flex flex-col gap-1 ml-1 h-full">
                            <div className="flex gap-1">
                                <ToolbarBtn
                                    icon={Minus}
                                    onClick={() => (editor?.chain().focus() as any).selectAll().setLineHeight('1.0').run()}
                                    size="sm"
                                    label="Single Space"
                                    disabled={!editor}
                                />
                                <ToolbarBtn
                                    icon={Plus}
                                    onClick={() => (editor?.chain().focus() as any).selectAll().setLineHeight('1.5').run()}
                                    size="sm"
                                    label="1.5 Space"
                                    disabled={!editor}
                                />
                                <ToolbarBtn
                                    icon={Plus}
                                    onClick={() => (editor?.chain().focus() as any).selectAll().setLineHeight('2.0').run()}
                                    size="sm"
                                    label="Double Space"
                                    disabled={!editor}
                                />
                            </div>
                            <div className="relative group mt-auto">
                                <select
                                    className="w-24 text-2xs h-6 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1 outline-none"
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
                        <ToolbarBtn icon={Scissors} label={`Fill (${placeholderCount})`} onClick={() => setActiveModal('fill_placeholders')} size="lg" className="text-amber-600 dark:text-amber-400" />
                        <ToolbarBtn
                            icon={Plus}
                            label="Parties"
                            onClick={() => {
                                if (!editor) return;
                                // Detect if this is a court process (litigation) or a letter/notice
                                const docTitle = (title || '').toLowerCase();
                                const html = editor.getHTML().toLowerCase();
                                const isCourtProcess = /suit|motion|affidavit|pleading|originating|summons|petition|court|in the high court|in the magistrate|in the federal high court/.test(docTitle + html);

                                if (isCourtProcess) {
                                    // For court processes: insert a parties group (CLAIMANTS/DEFENDANTS bracket)
                                    editor.chain().focus().insertContent('<div data-type="legal-parties-group"><p>Party Name</p></div>').run();
                                } else {
                                    // For letters/notices: insert a signature block
                                    editor.chain().focus().insertContent(
                                        '<p style="text-align: right;"><br></p>' +
                                        '<p style="text-align: right;"><strong>Yours faithfully,</strong></p>' +
                                        '<p style="text-align: right;"><br></p>' +
                                        '<p style="text-align: right;">_______________________________</p>' +
                                        '<p style="text-align: right;"><strong>[SIGNATORY NAME]</strong></p>' +
                                        '<p style="text-align: right;">[SIGNATORY TITLE]</p>' +
                                        '<p style="text-align: right;">[FIRM NAME]</p>'
                                    ).run();
                                }
                            }}
                            size="lg" className="text-indigo-600" />
                        <ToolbarBtn icon={Save} label="Template" onClick={() => { setModalInput(title || ''); setActiveModal('save_template'); }} size="lg" className="text-primary-600" />
                    </ToolbarGroup>

                    {/* ── DraftPro AI — Redraft + Auto-Format grouped together ──
                        Both AI features use the SAME ToolbarBtn component with
                        size="lg" so they have identical shape, size, and styling.
                        Only the icon color differs (blue for Redraft, emerald for
                        Auto-Format) — matching the pattern used in other groups
                        (e.g. amber for Placeholder/Fill in Insert/Legal Tools). */}
                    <ToolbarGroup label="DraftPro AI" variant="ai">
                        <div className={showAiPulse ? 'draftpro-ai-pulse' : ''}>
                            <ToolbarBtn
                                icon={RedraftIcon}
                                label="Redraft"
                                onClick={() => { setRedraftContext(''); setActiveModal('redraft'); }}
                                size="lg"
                                disabled={!editor || isDrafting}
                                className="text-blue-600 dark:text-blue-400"
                            />
                        </div>
                        {!isProperty && (
                            <div className={showAiPulse ? 'draftpro-ai-pulse' : ''}>
                                <ToolbarBtn
                                    icon={Wand}
                                    label="Auto-Format"
                                    onClick={() => setActiveModal('auto_format_rules')}
                                    size="lg"
                                    className="text-emerald-600 dark:text-emerald-400"
                                />
                            </div>
                        )}
                    </ToolbarGroup>

                    <div className="flex-1" />

                </div>
            </div>
            )}

            {/* ══ Editor Canvas — True Page Sheet Rendering ══
                The canvas has a darker gray background (#e2e8f0) so the white
                page sheets appear to float on it like a document on a desk.
                The page is detached from the ribbon via pt-32 (128px) — a
                generous gap that makes it clear the page is NOT glued to
                the toolbar but floats independently in center stage. */}
            <div
                className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar"
                style={{ background: '#e2e8f0' }}
                id="draftpro-scroll-area"
                ref={scrollAreaRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/*
                 * Layout space holder: its size is the scaled total height of all pages.
                 * The scale() transform on the inner div doesn't affect layout flow,
                 * so we must manually reserve the correct scaled height here.
                 *
                 * The pt-32 (128px top padding) DETACHES the first page from the
                 * ribbon so it floats independently in "center stage" — like a
                 * real document on a desk, not glued to the toolbar. The generous
                 * gap gives a premium, breathable layout with clear visual
                 * separation between the ribbon and the document.
                 */}
                <div
                    className="flex justify-center mb-20 shrink-0 pt-32"
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
                        <div ref={pageSheetsContainerRef} className="flex flex-col" style={{ gap: `${PAGE_GAP_PX}px` }}>
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

                                    {/* ── Watermark (DRAFT, CONFIDENTIAL, etc.) ──
                                        Renders a large, semi-transparent, rotated
                                        text overlay on every page. Jurisdiction-neutral. */}
                                    {watermark && (
                                        <div
                                            className="absolute inset-0 z-5 flex items-center justify-center pointer-events-none select-none"
                                            style={{ zIndex: 5 }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: '120px',
                                                    fontWeight: '900',
                                                    color: 'rgba(220, 38, 38, 0.12)',
                                                    transform: 'rotate(-35deg)',
                                                    whiteSpace: 'nowrap',
                                                    letterSpacing: '0.1em',
                                                }}
                                            >
                                                {watermark}
                                            </span>
                                        </div>
                                    )}

                                    {/* ── Page Number Footer ──
                                        Configurable via the Page Number dropdown
                                        in the File toolbar group. Can be toggled
                                        off, repositioned, reformatted, or set to
                                        start from a custom number. */}
                                    {pageNumberConfig.enabled && pageNumberConfig.position !== 'none' && (
                                        <div
                                            className={`absolute z-30 print:hidden ${
                                                pageNumberConfig.position === 'bottom-center' ? 'left-0 right-0 text-center' :
                                                pageNumberConfig.position === 'bottom-right' ? 'right-0 text-right pr-8' :
                                                pageNumberConfig.position === 'bottom-left' ? 'left-0 text-left pl-8' : ''
                                            }`}
                                            style={{
                                                bottom: `${PAGE_MARGIN_PX / 3}px`,
                                                fontSize: '10px',
                                                color: '#94a3b8',
                                                fontWeight: '700',
                                                letterSpacing: '0.15em',
                                                textTransform: 'uppercase',
                                                // Solid background to prevent text bleed-through
                                                backgroundColor: '#ffffff',
                                                padding: '2px 8px',
                                                borderRadius: '3px',
                                            }}
                                        >
                                            {(() => {
                                                const num = i + pageNumberConfig.startFrom;
                                                switch (pageNumberConfig.format) {
                                                    case 'page-of': return `Page ${num} of ${pageCount + pageNumberConfig.startFrom - 1}`;
                                                    case 'page-only': return `Page ${num}`;
                                                    case 'dash': return `- ${num} -`;
                                                    case 'number-only': return `${num}`;
                                                    default: return `Page ${num} of ${pageCount}`;
                                                }
                                            })()}
                                        </div>
                                    )}
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
                                    <GenerationOverlay
                                        label="Preparing your document..."
                                        onCancel={() => {
                                            // Just cancel — stop the draft.
                                            // The user can click Redraft in the toolbar
                                            // if they want to try again.
                                            (window as any).stopDrafting?.();
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Bottom Status Bar ──────────────────────────────────────────
                Slim status bar with word/char count + zoom controls.
                Keeps the ribbon thin by moving these readouts here. */}
            <div className="flex-shrink-0 h-7 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between px-4 text-2xs text-slate-500 dark:text-zinc-500 no-print">
                <div className="flex items-center gap-4">
                    <span className="font-medium">
                        {editor?.storage.characterCount.words() || 0} words
                    </span>
                    <span className="text-slate-300 dark:text-zinc-700">·</span>
                    <span className="font-medium">
                        {editor?.storage.characterCount.characters() || 0} chars
                    </span>
                    {placeholderCount > 0 && (
                        <>
                            <span className="text-slate-300 dark:text-zinc-700">·</span>
                            <span className="font-medium text-amber-600 dark:text-amber-400">
                                {placeholderCount} placeholder{placeholderCount !== 1 ? 's' : ''}
                            </span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-medium">Page {currentPage} of {pageCount}</span>
                    <span className="text-slate-300 dark:text-zinc-700">·</span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300" title="Zoom Out (Ctrl+-)">
                            <Minimize2 className="w-3 h-3" />
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setOpenDropdown(openDropdown === 'zoom' ? null : 'zoom')}
                                className="font-bold w-12 text-center hover:text-blue-600"
                                title="Zoom presets (click to open)"
                            >
                                {Math.round(zoom * 100)}%
                            </button>
                            {/* Zoom presets dropdown — click-to-toggle */}
                            {openDropdown === 'zoom' && (
                                <>
                                    <div className="fixed inset-0 z-[60]" onClick={() => setOpenDropdown(null)} />
                                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-[61] min-w-[100px]">
                                        {[
                                            { label: '50%', value: 0.5 },
                                            { label: '75%', value: 0.75 },
                                            { label: '100%', value: 1.0 },
                                            { label: '125%', value: 1.25 },
                                            { label: '150%', value: 1.5 },
                                            { label: '200%', value: 2.0 },
                                        ].map(preset => (
                                            <button
                                                key={preset.value}
                                                onClick={() => { setZoom(preset.value); setOpenDropdown(null); }}
                                                className={`block w-full text-left px-3 py-1 text-xs hover:bg-slate-100 dark:hover:bg-zinc-700 ${Math.abs(zoom - preset.value) < 0.01 ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-zinc-400'}`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                        <div className="border-t border-slate-200 dark:border-zinc-700 my-1" />
                                        <button
                                            onClick={() => {
                                                const scrollArea = document.getElementById('draftpro-scroll-area');
                                                if (scrollArea) setZoom((scrollArea.clientWidth - 40) / PAGE_WIDTH_PX);
                                                setOpenDropdown(null);
                                            }}
                                            className="block w-full text-left px-3 py-1 text-xs hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-400"
                                        >
                                    Fit Width
                                </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={() => setZoom(Math.min(3.0, zoom + 0.1))} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300" title="Zoom In (Ctrl+=)">
                            <Maximize2 className="w-3 h-3" />
                        </button>
                    </div>
                    <span className="text-slate-300 dark:text-zinc-700">·</span>
                    <button
                        onClick={() => setFocusMode(f => !f)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 text-xs font-medium"
                        title={focusMode ? "Exit Focus Mode (F11)" : "Focus Mode (F11)"}
                    >
                        {focusMode ? "Exit Focus" : "Focus"}
                    </button>
                </div>
            </div>

            {/* ── Print Preview Drawer ──
                Slide-in panel showing a live print-ready preview of the
                document. User can see margins, typography, page breaks,
                and headers before printing or exporting. */}
            <PrintPreviewDrawer
                isOpen={showPrintPreview}
                onClose={() => setShowPrintPreview(false)}
                html={(() => {
                    try { return editor?.getHTML() || ''; }
                    catch { return '<p style="color:#ef4444;text-align:center;padding:24px;"><i>Preview unavailable — document has an internal error.</i></p>'; }
                })()}
                title={title || 'Untitled Document'}
                letterheadHtml={undefined}
                authorName={currentUser?.name}
                firmName={appState?.firmDetails?.name}
                onPrint={handlePrint}
            />

            {/* ── Sources Panel (Citations) ──
                Shows when the document has citations (from ALOA research mode).
                Renders as a slide-in sidebar listing all sources.

                Each citation is CLICKABLE — clicking expands it to show:
                - Full citation text
                - Type, jurisdiction, URL
                - Fetched web content (if URL available) — real insight
                - "Open URL" button
                - "Send to Research" button — opens the Research Center
                  with this source pre-loaded for deeper analysis
                */}
            {/* citationVersion is referenced here so React re-renders when
                citations are parsed from the draft output after completion.
                Without this, the floater wouldn't appear until a full remount. */}
            {citationVersion >= 0 && citationRegistry.getAll().length > 0 && (
                <>
                    {/* Floating "Sources" button — always visible when citations exist */}
                    <button
                        onClick={() => setShowCitationPanel(!showCitationPanel)}
                        className="fixed bottom-20 right-4 z-[70] flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-colors text-xs font-bold no-print"
                        title="View sources"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                        Sources ({citationRegistry.getAll().length})
                    </button>

                    {/* Slide-in panel */}
                    {showCitationPanel && (
                        <div className="fixed top-0 right-0 h-full w-96 bg-white dark:bg-zinc-900 shadow-2xl z-[71] flex flex-col border-l border-slate-200 dark:border-zinc-800 no-print animate-in slide-in-from-right duration-200">
                            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                    </svg>
                                    Sources & Citations
                                </h3>
                                <button
                                    onClick={() => setShowCitationPanel(false)}
                                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* ─── Prompt-First Research Pipeline button ──────
                                Generates an AI search query from ALL citations,
                                opens Research in a new tab with the query
                                PRE-FILLED (not auto-sent). User reviews & Enter. */}
                            <div className="p-3 border-b border-slate-200 dark:border-zinc-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                                <button
                                    onClick={() => {
                                        const allCites = citationRegistry.getAll();
                                        if (allCites.length === 0) return;
                                        attemptNavigation('research', () => {
                                            // Use the first citation as the primary anchor,
                                            // but pass all citations as context.
                                            handleResearchCitation(allCites[0], allCites);
                                        });
                                    }}
                                    disabled={generatingQueryForCite !== null}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-wait"
                                >
                                    {generatingQueryForCite !== null ? (
                                        <>
                                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Generating search query…
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                            </svg>
                                            Research All Citations
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {citationRegistry.getAll().map((cite: any) => (
                                    <CitationCard
                                        key={cite.id}
                                        cite={cite}
                                        isGeneratingQuery={generatingQueryForCite === cite.id}
                                        onSendToResearch={(c) => {
                                            attemptNavigation('research', () => {
                                                handleResearchCitation(c);
                                            });
                                        }}
                                    />
                                ))}
                            </div>
                            <div className="p-3 border-t border-slate-200 dark:border-zinc-800 space-y-2">
                                {/* "Insert Citations into Document Footer" — polished footer button.
                                    Per Part 3 spec: highly polished, prominent placement. */}
                                <button
                                    onClick={handleInsertCitationsToFooter}
                                    disabled={!editor}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Insert all citations as a Table of Authorities at the end of your document"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                                    </svg>
                                    Insert Citations into Document Footer
                                </button>
                                <p className="text-2xs text-slate-500 dark:text-zinc-400 text-center">
                                    Hover a source for actions · Citations referenced as [{citationRegistry.getAll().map((c: any) => c.number).join('], [')}]
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── Unsaved-changes Navigation Guardrail Modal ──
                Opens when the user tries to leave DraftPro (Back button,
                navigation to Research, etc.) with unsaved edits.
                Three options: Save & Leave, Leave Without Saving, Stay on Page. */}
            {pendingNav && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => {
                            // RACE CONDITION FIX: Don't allow dismissal while a save is in-flight.
                            // Show a warning instead of silently navigating away.
                            if (isSavingFile) {
                                addToast('Save in progress — please wait for it to complete before leaving.', { type: 'info' });
                                return;
                            }
                            cancelPendingNav();
                        }}
                    />
                    <div className="relative z-10 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        {/* Warning icon */}
                        <div className="flex items-start gap-3 mb-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                                    Unsaved Changes
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                                    You have unsaved edits on this draft. Save your document before leaving to prevent data loss.
                                </p>
                            </div>
                        </div>

                        {/* ─── Race condition warning ──────────────────────────
                            If a save is in-flight, show a warning and disable
                            the leave buttons until the save completes. */}
                        {isSavingFile && (
                            <div className="mb-4 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg flex items-center gap-2">
                                <svg className="w-4 h-4 text-amber-600 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                    Save in progress — please wait for it to complete before leaving.
                                </p>
                            </div>
                        )}

                        {/* Action buttons — PDF/DOCX save are the primary CTAs */}
                        <div className="flex flex-col gap-2 mt-5">
                            {/* Save as PDF & Leave — PRIMARY (highlighted) */}
                            <button
                                onClick={async () => {
                                    if (isSavingFile) return; // Block during save
                                    // Save as PDF, then leave after the save completes
                                    await saveAsFile('pdf');
                                    confirmNavWithoutSave();
                                }}
                                disabled={isSavingFile}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.5a3 3 0 013-3h15a3 3 0 013 3M1.5 10.5V18a3 3 0 003 3h15a3 3 0 003-3v-7.5M1.5 10.5V6a3 3 0 013-3h15a3 3 0 013 3v4.5" />
                                </svg>
                                {isSavingFile ? 'Saving…' : 'Save as PDF & Leave'}
                            </button>
                            {/* Save as DOCX & Leave — SECONDARY */}
                            <button
                                onClick={async () => {
                                    if (isSavingFile) return; // Block during save
                                    await saveAsFile('docx');
                                    confirmNavWithoutSave();
                                }}
                                disabled={isSavingFile}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.5a3 3 0 013-3h15a3 3 0 013 3M1.5 10.5V18a3 3 0 003 3h15a3 3 0 003-3v-7.5M1.5 10.5V6a3 3 0 013-3h15a3 3 0 013 3v4.5" />
                                </svg>
                                {isSavingFile ? 'Saving…' : 'Save as DOCX & Leave'}
                            </button>
                            {/* Save text only & Leave — TERTIARY (visually subordinate) */}
                            <button
                                onClick={confirmNavWithSave}
                                disabled={isSavingFile}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save text only &amp; Leave
                            </button>
                            {/* Leave Without Saving */}
                            <button
                                onClick={confirmNavWithoutSave}
                                disabled={isSavingFile}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-sm font-bold border border-slate-200 dark:border-zinc-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Leave Without Saving
                            </button>
                            {/* Stay on Page */}
                            <button
                                onClick={cancelPendingNav}
                                disabled={isSavingFile}
                                className="w-full px-4 py-2 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                                Stay on Page
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── In-App Modals ── */}
            {
                activeModal && (
                    <div
                        className="fixed inset-0 z-[1000] flex items-center justify-center"
                        onKeyDown={(e) => { if (e.key === 'Escape') setActiveModal(null); }}
                        tabIndex={-1}
                    >
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
                        <div className={`relative z-10 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 w-full ${activeModal === 'fill_placeholders' ? 'max-w-lg' : activeModal === 'auto_format_rules' ? 'max-w-lg' : activeModal === 'redraft' ? 'max-w-lg' : activeModal === 'table' ? 'max-w-md' : 'max-w-md'} mx-4 animate-in zoom-in-95 duration-200`}>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                {activeModal === 'placeholder' && <><Type className="w-5 h-5 text-amber-500" /> Insert Placeholder</>}
                                {activeModal === 'fill_placeholders' && <><Scissors className="w-5 h-5 text-amber-500" /> Smart Fill Placeholders</>}
                                {activeModal === 'link' && <><LinkIcon className="w-5 h-5 text-blue-500" /> Insert Link</>}
                                {activeModal === 'image' && <><ImageIcon className="w-5 h-5 text-emerald-500" /> Insert Image</>}
                                {activeModal === 'table' && <><TableIcon className="w-5 h-5 text-slate-500" /> Create Table</>}
                                {activeModal === 'auto_format_rules' && <><Wand className="w-5 h-5 text-emerald-500" /> Auto-Format Rules</>}
                                {activeModal === 'redraft' && <><Redo className="w-5 h-5 text-blue-500" /> Redraft with {getAssistantName(isProperty)}</>}
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
                                const categoryMeta: Record<PlaceholderCategory, { name: string; color: string; border: string; bg: string; ring: string }> = {
                                    parties:   { name: 'Parties',   color: 'text-blue-500',   border: 'border-l-blue-500',   bg: 'bg-blue-50/30 dark:bg-blue-900/10',   ring: 'focus:ring-blue-500' },
                                    dates:     { name: 'Dates',     color: 'text-purple-500', border: 'border-l-purple-500', bg: 'bg-purple-50/30 dark:bg-purple-900/10', ring: 'focus:ring-purple-500' },
                                    financial: { name: 'Financial', color: 'text-green-500',  border: 'border-l-green-500',  bg: 'bg-green-50/30 dark:bg-green-900/10',  ring: 'focus:ring-green-500' },
                                    location:  { name: 'Location',  color: 'text-teal-500',   border: 'border-l-teal-500',   bg: 'bg-teal-50/30 dark:bg-teal-900/10',   ring: 'focus:ring-teal-500' },
                                    court:     { name: 'Court',     color: 'text-rose-500',   border: 'border-l-rose-500',   bg: 'bg-rose-50/30 dark:bg-rose-900/10',   ring: 'focus:ring-rose-500' },
                                    firm:      { name: 'Firm',      color: 'text-indigo-500', border: 'border-l-indigo-500', bg: 'bg-indigo-50/30 dark:bg-indigo-900/10', ring: 'focus:ring-indigo-500' },
                                    freetext:  { name: 'Free Text', color: 'text-amber-500',  border: 'border-l-amber-500',  bg: 'bg-amber-50/30 dark:bg-amber-900/10',  ring: 'focus:ring-amber-500' },
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
                                            <span className="text-2xs text-slate-400">{uniqueLabels.length} placeholder{uniqueLabels.length !== 1 ? 's' : ''}</span>
                                            <button type="button" onClick={handleAutoFill} className="text-2xs font-bold px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
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
                                                            <span className={`w-2 h-2 rounded-full ${meta.color.replace('text-', 'bg-')}`}></span>
                                                            <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider">{meta.name}</span>
                                                            <span className="text-2xs text-slate-300">({labels.length})</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {labels.map(label => {
                                                                // Only show date picker for actual calendar dates — NOT for
                                                                // durations like "number of days", "weeks", "lease term in years"
                                                                const n = label.toUpperCase();
                                                                const isDuration = /\b(NUMBER|COUNT|QUANTITY|DURATION|PERIOD|TERM|LENGTH)\b/.test(n)
                                                                    || /\b(DAYS|WEEKS|MONTHS|YEARS|HOURS|MINUTES)\b/.test(n);
                                                                const isDatePlaceholder = cat === 'dates' && !isDuration;
                                                                const todayStr = new Date().toISOString().split('T')[0];
                                                                const def = getPlaceholderDef(label);
                                                                const tooltip = def?.description || `${meta.name} — ${label.replace(/[\[\]]/g, '')}`;
                                                                return (
                                                                <div key={label} className={`flex flex-col gap-1 ${meta.bg} rounded-lg p-2 border-l-2 ${meta.border}`} title={tooltip}>
                                                                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                                                                        {label}
                                                                    </label>
                                                                    {isDatePlaceholder ? (
                                                                        <input
                                                                            type="date"
                                                                            autoComplete="off"
                                                                            data-lpignore="true"
                                                                            name={label}
                                                                            autoFocus={targetPlaceholderLabel === label}
                                                                            defaultValue={aiHelpResult[label] || todayStr}
                                                                            className={`w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${meta.ring}`}
                                                                        />
                                                                    ) : (
                                                                        <input autoComplete="off" data-lpignore="true"
                                                                            name={label}
                                                                            autoFocus={targetPlaceholderLabel === label}
                                                                            className={`w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${meta.ring}`}
                                                                            placeholder={aiHelpResult[label] || `Enter ${label.toLowerCase().replace(/[\[\]]/g, '')}...`}
                                                                            defaultValue={aiHelpResult[label] || ''}
                                                                        />
                                                                    )}
                                                                    {aiHelpResult[label] && (
                                                                        <p className="text-2xs text-violet-500 dark:text-violet-400">AI suggested — edit or accept</p>
                                                                    )}
                                                                </div>
                                                                );
                                                            })}
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
                                        <p className="text-2xs text-primary-700 dark:text-primary-300 leading-relaxed">
                                            Save this document as a reusable template. The content, formatting, and all <strong>[PLACEHOLDER]</strong> fields will be preserved. Next time you need a similar document, {getAssistantName(isProperty)} can start from this template instead of drafting from scratch — just ask "{getAssistantName(isProperty)}, draft a document using my [template name] template."
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
                                        <p className="text-2xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                            {getAssistantName(isProperty)} will regenerate the entire document from scratch using the original prompt. Your current content will be replaced. Add specific instructions below to guide the improvement — e.g. <em>"make it more formal", "add a termination clause", "shorten the recitals"</em>.
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
                                            Redraft with {getAssistantName(isProperty)}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeModal === 'auto_format_rules' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">Select the Nigerian legal formatting rules you want to enforce across the entire document.</p>
                                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 p-2 rounded">
                                            <input
                                                type="checkbox"
                                                checked={formatRules.uppercaseHeadings}
                                                onChange={(e) => setFormatRules(prev => ({ ...prev, uppercaseHeadings: e.target.checked }))}
                                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span>Uppercase Headings</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 p-2 rounded">
                                            <input
                                                type="checkbox"
                                                checked={formatRules.numberParagraphs}
                                                onChange={(e) => setFormatRules(prev => ({ ...prev, numberParagraphs: e.target.checked }))}
                                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span>Number Paragraphs</span>
                                        </label>
                                    </div>
                                    <p className="text-2xs text-slate-400 dark:text-zinc-500">More formatting rules (suit title format, double spacing, justification, naira formatting, date formatting, paragraph indentation) coming soon.</p>
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

        /* ── Print Styles (PART 4: High-fidelity PDF matching) ── */
        @page { size: A4; margin: 25mm 25mm 25mm 25mm; }
        @media print {
          body * { visibility: hidden; }
          #draftpro-scroll-area, #draftpro-scroll-area * { visibility: visible; }
          #draftpro-scroll-area {
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 0 !important; margin: 0 !important;
            background: white !important; overflow: visible !important;
            transform: none !important;
          }
          /* Enforce editor font and line-height in print output */
          .draftpro-editor-content, .ProseMirror {
            font-family: 'Times New Roman', serif !important;
            font-size: 12pt !important;
            line-height: 1.5 !important;
            color: #111827 !important;
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
          /* Anti-orphan headings: keep headings with following content */
          h1, h2, h3, h4 { break-after: avoid !important; page-break-after: avoid !important; break-inside: avoid !important; }
          /* Keep heading + first paragraph together */
          h1 + p, h2 + p, h3 + p, h4 + p { break-before: avoid !important; page-break-before: avoid !important; }
          /* Prevent large gaps: avoid breaking inside paragraphs */
          p { break-inside: avoid !important; page-break-inside: avoid !important; orphans: 2; widows: 2; }
          /* Keep tables together */
          table { break-inside: avoid !important; page-break-inside: avoid !important; }
          tr { break-inside: avoid !important; page-break-inside: avoid !important; }
          /* Keep list items together */
          li { break-inside: avoid !important; page-break-inside: avoid !important; }
          ul, ol { break-inside: avoid !important; page-break-inside: avoid !important; }
        }
      `}</style>
        </div >
    );
};

// ─── Citation Completeness Checker ─────────────────────────────────────
// Parses a citation string and checks for missing metadata that a
// professional legal citation should contain. Returns a list of
// missing fields with descriptions.
//
// Supports three citation styles:
//   1. Bluebook (US): <Party v. Party>, <Volume> <Reporter> <Page> (<Court> <Year>)
//   2. OSCOLA (UK): <Party v Party> [<Year>] <Volume> <Reporter> <Page>
//   3. Nigerian NWLR: <Party v. Party> (<Year>) <Volume> NWLR (Pt. <N>) <Page>
//   4. LPELR format: <Party v. Party> (<Year>) LPELR-<N> (<Court>)
//
// Returns [] if no issues, or an array of {field, message} objects.

interface CitationIssue {
    field: string;
    message: string;
}

// ─── Citation Completeness Checker (uses new 6-class taxonomy) ──────
// Replaced the old binary statute/case-law checker with the full
// citationClassifier that supports 6 classes: Statute, Case Law,
// Constitutional, Contract, Direct Quote, Secondary Source.
// Each class has its own completeness rules — no more flagging valid
// statute citations as incomplete for lacking a reporter/volume.
function checkCitationCompleteness(text: string): CitationIssue[] {
    const result = classifyAndCheckCitation(text);
    return result.issues;
}

// ─── CitationCard ──────────────────────────────────────────────────────────
// A clickable citation card that expands to show deeper insight.
// When clicked, it fetches the source URL (if available) and shows
// the actual web content — giving the user real insight into the source.
//
// Slimline design per Part 3 spec:
//   - Subtle borders, muted colours
//   - Hover-reveal action buttons (no persistent "Research" button)
//   - Citation completeness checker with muted orange dot warning
//   - Expanded view shows the insight + actions

interface CitationCardProps {
    cite: {
        id: string;
        number: number;
        type: string;
        text: string;
        url?: string;
        jurisdiction?: string;
    };
    onSendToResearch: (cite: any) => void;
    /** When true, shows a "Generating query…" spinner on the Research button. */
    isGeneratingQuery?: boolean;
}

const CitationCard: React.FC<CitationCardProps> = ({ cite, onSendToResearch, isGeneratingQuery }) => {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [insight, setInsight] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Run the completeness check ONCE on mount (memoised) — it doesn't
    // change unless the citation text changes.
    const classification = useMemo(() => classifyAndCheckCitation(cite.text), [cite.text]);
    const issues = classification.issues;

    const handleClick = async () => {
        if (!expanded && !insight && cite.url) {
            // Fetch the source URL for deeper insight
            setExpanded(true);
            setLoading(true);
            setError(null);
            try {
                const { fetchUrlContentClient } = await import('../../../utils/webFetchClient');
                const result = await fetchUrlContentClient(cite.url);
                if (result.success && result.content) {
                    // Show the first 1000 chars of the fetched content as insight
                    setInsight(result.content.substring(0, 1000) + (result.content.length > 1000 ? '...' : ''));
                } else {
                    setError(result.message || 'Could not fetch source content.');
                }
            } catch (err: any) {
                setError(err.message || 'Failed to fetch source.');
            } finally {
                setLoading(false);
            }
        } else {
            setExpanded(!expanded);
        }
    };

    return (
        <div
            className={`group relative rounded-md border transition-all cursor-pointer
                ${expanded
                    ? 'bg-white dark:bg-zinc-800 border-slate-300 dark:border-zinc-600 shadow-sm'
                    : 'bg-white dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/60 hover:border-slate-300 dark:hover:border-zinc-600 hover:shadow-sm'
                }`}
            onClick={handleClick}
        >
            <div className="p-2.5">
                <div className="flex items-start gap-2">
                    {/* Citation number badge — slimmer, more muted */}
                    <span className="flex-shrink-0 w-5 h-5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded text-2xs font-bold flex items-center justify-center mt-0.5">
                        {cite.number}
                    </span>

                    <div className="flex-1 min-w-0">
                        {/* Citation text — slightly smaller, more readable */}
                        <p className="text-2xs font-medium text-slate-800 dark:text-zinc-100 leading-relaxed pr-1">{cite.text}</p>

                        {/* Metadata row — compact */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {/* Classification badge — shows the citation class */}
                            <span className={`text-3xs font-bold uppercase tracking-wider px-1 py-0.5 rounded ${
                                classification.citationClass === 'statute' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' :
                                classification.citationClass === 'case_law' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300' :
                                classification.citationClass === 'constitutional' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300' :
                                classification.citationClass === 'unclassified' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300' :
                                'bg-slate-100 dark:bg-zinc-700/80 text-slate-500 dark:text-zinc-400'
                            }`}>
                                {classification.className}
                            </span>
                            {/* Pinpoint — shows the specific section/clause if extracted */}
                            {classification.pinpoint && (
                                <span className="text-3xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1 py-0.5 rounded">
                                    {classification.pinpoint}
                                </span>
                            )}
                            {cite.jurisdiction && (
                                <span className="text-3xs font-medium text-slate-400 dark:text-zinc-500">
                                    {cite.jurisdiction}
                                </span>
                            )}

                            {/* Citation Completeness Indicator — muted orange dot */}
                            {issues.length > 0 && (
                                <Tooltip text={issues.map(i => `⚠️ ${i.message}`).join('\n')}>
                                    <span
                                        className="inline-flex items-center justify-center w-3 h-3 cursor-help"
                                        title={issues.map(i => i.message).join('\n')}
                                        aria-label={`Citation has ${issues.length} completeness issue${issues.length > 1 ? 's' : ''}`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 animate-pulse" />
                                    </span>
                                </Tooltip>
                            )}

                            {/* Expand chevron — auto-pushed to right */}
                            <svg className={`w-3 h-3 text-slate-300 dark:text-zinc-600 transition-transform ml-auto ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                        </div>

                        {/* Hover-reveal action buttons — appear on hover OR when expanded.
                            Per Part 3 spec: no persistent buttons. */}
                        {(expanded) && (
                            <div className="flex gap-1.5 mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
                                {cite.url && (
                                    <a
                                        href={cite.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 bg-slate-50 dark:bg-zinc-700/50 text-slate-600 dark:text-zinc-300 rounded text-3xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors border border-slate-200 dark:border-zinc-700"
                                        title="Open source URL in a new tab"
                                    >
                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                        </svg>
                                        Open
                                    </a>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSendToResearch(cite); }}
                                    disabled={isGeneratingQuery}
                                    className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded text-3xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-200 dark:border-emerald-800/50 disabled:opacity-60 disabled:cursor-wait"
                                    title="Generate a research query and open Research in a new tab"
                                >
                                    {isGeneratingQuery ? (
                                        <>
                                            <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Generating…
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                            </svg>
                                            Research
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded insight panel — slimmer, more refined */}
            {expanded && (
                <div className="px-2.5 pb-2.5 pt-1 border-t border-slate-100 dark:border-zinc-700/60 space-y-2">
                    {/* Completeness warnings — show in expanded view */}
                    {issues.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded p-1.5">
                            <p className="text-3xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">Citation Completeness</p>
                            <ul className="space-y-0.5">
                                {issues.map((issue, i) => (
                                    <li key={i} className="text-3xs text-amber-700 dark:text-amber-300 flex items-start gap-1">
                                        <span className="text-amber-500 mt-0.5">⚠</span>
                                        <span className="flex-1">{issue.message}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {loading && (
                        <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-zinc-400 py-1">
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Fetching source content…
                        </div>
                    )}

                    {error && (
                        <p className="text-2xs text-amber-600 dark:text-amber-400 py-1">{error}</p>
                    )}

                    {insight && (
                        <div className="bg-slate-50 dark:bg-zinc-900/50 rounded p-2 max-h-40 overflow-y-auto custom-scrollbar">
                            <p className="text-3xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Source Content</p>
                            <p className="text-2xs text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{insight}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

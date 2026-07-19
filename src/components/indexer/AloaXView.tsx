import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Fuse from 'fuse.js';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { getGeminiApiKey, setCustomApiKey } from '../../utils/aiUtils';
import { Key } from 'lucide-react';
import { useProduct } from '../../contexts/ProductContext';

import { DocumentClassifier } from '../../services/indexer/DocumentClassifier';
import { LegalChunker } from '../../services/indexer/LegalChunker';
import { DocumentMerger } from '../../services/indexer/DocumentMerger';
import { CheckpointManager } from '../../services/indexer/CheckpointManager';
import type { CheckpointMeta } from '../../services/indexer/CheckpointManager';
import type {
  LegalDocType,
  ProcessingProgress,
  IndexedDocument,
  SearchableItem,
  ContentNode,
} from '../../services/indexer/indexerTypes';

// ── PDF.js Worker — Vite-native bundled approach ──────────────────
// Uses import.meta.url so Vite serves the worker from the bundle,
// NOT a CDN URL. This avoids the "Failed to fetch dynamically imported module" error.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

// ── LocalStorage Document Library ─────────────────────────────────
// Primary storage — no Convex dependency. Works offline.
export const ALOAX_LIBRARY_PREFIX = 'aloax_doc_';

export interface StoredDoc {
  documentId: string;
  fileName: string;
  documentType: LegalDocType;
  totalPages: number;
  totalChunks: number;
  processedAt: number;
  confidence: number;
  metadata?: any;
  stats: any;
  confidenceReasons?: string[];
  actIndex?: any;
  rulesIndex?: any;
  judgmentIndex?: any;
  // New schema fields (optional — present if indexed with new prompt)
  content_tree?: ContentNode[];
  index_entries?: any[];
  full_raw_text?: string;
}

export function saveDocToLibrary(doc: IndexedDocument): void {
  try {
    const payload: StoredDoc = {
      documentId: doc.documentId,
      fileName: doc.fileName,
      documentType: doc.documentType,
      totalPages: doc.totalPages,
      totalChunks: doc.totalChunks,
      processedAt: doc.processedAt,
      confidence: doc.confidence,
      metadata: doc.metadata,
      stats: doc.stats,
      confidenceReasons: doc.confidenceReasons,
      actIndex: doc.actIndex,
      rulesIndex: doc.rulesIndex,
      judgmentIndex: doc.judgmentIndex,
    };
    // Prune data if > 3MB to avoid quota errors
    const raw = JSON.stringify(payload);
    if (raw.length > 3_000_000) {
      // Cap sections/rules to first 500 to fit within localStorage quota
      if (payload.actIndex?.chapters) {
        payload.actIndex.chapters = payload.actIndex.chapters.map((ch: any) => ({
          ...ch,
          sections: (ch.sections ?? []).slice(0, 500),
        }));
      }
      if (payload.rulesIndex?.orders) {
        payload.rulesIndex.orders = payload.rulesIndex.orders.map((o: any) => ({
          ...o,
          rules: (o.rules ?? []).slice(0, 200),
        }));
      }
    }
    localStorage.setItem(`${ALOAX_LIBRARY_PREFIX}${doc.documentId}`, JSON.stringify(payload));
  } catch (e) {
    console.warn('Library save failed (localStorage full?):', e);
  }
}

export function loadAloaXLibrary(): StoredDoc[] {
  const docs: StoredDoc[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(ALOAX_LIBRARY_PREFIX)) {
      try {
        const doc = JSON.parse(localStorage.getItem(key)!);
        docs.push(doc);
      } catch {/* skip corrupted */ }
    }
  }
  return docs.sort((a, b) => b.processedAt - a.processedAt);
}

export function deleteDocFromLibrary(documentId: string): void {
  localStorage.removeItem(`${ALOAX_LIBRARY_PREFIX}${documentId}`);
}

// ── Helpers ───────────────────────────────────────────────────────
const generateDocId = (fileName: string) =>
  `aloax_${Date.now()}_${fileName.replace(/\W+/g, '_').slice(0, 30)}`;

type DisplayDocType = LegalDocType;

const DOC_TYPE_COLORS: Record<DisplayDocType, string> = {
  ACT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  RULES: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  JUDGMENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  LFN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  GAZETTE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const DOC_TYPE_ICONS: Record<DisplayDocType, React.ReactNode> = {
  ACT: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
  RULES: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  JUDGMENT: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  LFN: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  GAZETTE: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>,
};
const DefaultDocIcon = <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const formatDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

// ── Flatten document index for Fuse.js ───────────────────────────
function flattenForSearch(doc: IndexedDocument | StoredDoc): SearchableItem[] {
  const items: SearchableItem[] = [];
  const docId = doc.documentId;

  // ── PREFERENCE: New Master Prompt Index Entries ──────────
  if (doc.index_entries && doc.index_entries.length > 0) {
    for (const entry of doc.index_entries) {
      items.push({
        id: `idx-${entry.citation}`,
        type: entry.element_type,
        label: entry.citation,
        text: `${entry.citation} ${entry.full_text}`,
        citation: entry.citation,
        summary: entry.summary,
        parentLabel: entry.hierarchy_path,
        documentId: docId
      });
    }
    return items;
  }

  // ── FALLBACK: Legacy Mapping ────────────────────────────
  if (doc.actIndex) {
    for (const chapter of (doc.actIndex.chapters ?? [])) {
      items.push({ id: `chap-${chapter.number}`, type: 'chapter', label: `Chapter ${chapter.number}`, text: `Chapter ${chapter.number}${chapter.title ? ': ' + chapter.title : ''}`, number: String(chapter.number), documentId: docId });
      for (const section of (chapter.sections ?? [])) {
        items.push({ id: `sec-${chapter.number}-${section.number}`, type: 'section', label: `Section ${section.number}`, text: `Section ${section.number}${section.title ? ': ' + section.title : ''}`, number: section.number, parentLabel: `Chapter ${chapter.number}${chapter.title ? ' – ' + chapter.title : ''}`, repealed: section.repealed, documentId: docId });
      }
    }
  }

  if (doc.rulesIndex) {
    for (const order of (doc.rulesIndex.orders ?? [])) {
      items.push({ id: `ord-${order.number}`, type: 'order', label: `Order ${order.number}`, text: `Order ${order.number}${order.title ? ': ' + order.title : ''}`, number: String(order.number), documentId: docId });
      for (const rule of (order.rules ?? [])) {
        items.push({ id: `r-${order.number}-${rule.number}`, type: 'rule', label: `Rule ${rule.number}`, text: `Rule ${rule.number}${rule.title ? ': ' + rule.title : ''}`, number: rule.number, parentLabel: `Order ${order.number}${order.title ? ' – ' + order.title : ''}`, documentId: docId });
      }
    }
  }

  if (doc.judgmentIndex) {
    const j = doc.judgmentIndex;
    if (j.suitNumber) items.push({ id: 'suit', type: 'judgment-field', label: 'Suit Number', text: j.suitNumber, documentId: docId });
    if (j.court) items.push({ id: 'court', type: 'judgment-field', label: 'Court', text: j.court, documentId: docId });
    for (const p of (j.parties ?? [])) items.push({ id: `p-${p}`, type: 'judgment-field', label: 'Party', text: p, documentId: docId });
    for (const jj of (j.judges ?? [])) items.push({ id: `j-${jj}`, type: 'judgment-field', label: 'Judge', text: jj, documentId: docId });
    for (const [i, h] of (j.holdings ?? []).entries()) items.push({ id: `h-${i}`, type: 'judgment-field', label: `Holding ${i + 1}`, text: h, documentId: docId });
  }

  return items;
}

// ── Sub-components ────────────────────────────────────────────────

const DocTypeBadge: React.FC<{ type: DisplayDocType; size?: 'sm' | 'md' }> = ({ type, size = 'sm' }) => (
  <span className={`inline-flex items-center gap-1.5 font-bold rounded-md px-2 py-0.5 ${size === 'md' ? 'text-sm' : 'text-xs'} ${DOC_TYPE_COLORS[type] ?? DOC_TYPE_COLORS.ACT}`}>
    <span className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'}>{DOC_TYPE_ICONS[type] ?? DefaultDocIcon}</span> {type}
  </span>
);

const ConfidenceDot: React.FC<{ value: number }> = ({ value }) => {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-slate-500 dark:text-zinc-400">{value}% confidence</span>
    </span>
  );
};

const STEPS = ['Classify', 'Extract', 'Structure', 'Revise', 'Save'];
const stepFromStatus: Record<string, number> = {
  classifying: 0,
  resuming: 1,
  processing: 1,
  merging: 2,
  revising: 3,
  saving: 4,
  completed: 5,
};

const StepIndicator: React.FC<{ status: string; currentChunk?: number; totalChunks?: number }> = ({ status, currentChunk, totalChunks }) => {
  const currentStep = stepFromStatus[status] ?? -1;
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-200 dark:ring-indigo-900 animate-pulse' : 'bg-slate-200 dark:bg-zinc-700 text-slate-400 dark:text-zinc-500'}`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`mt-1 text-2xs font-medium whitespace-nowrap ${active ? 'text-indigo-600 dark:text-indigo-400' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-500'}`}>
                {step}
                {step === 'Extract' && active && currentChunk !== undefined && totalChunks !== undefined && (
                  <span className="block text-3xs">{currentChunk + 1}/{totalChunks}</span>
                )}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 transition-all duration-500 ${i < currentStep ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-zinc-700'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const TreeNode: React.FC<{ node: ContentNode; onCopy: (txt: string, id: string) => void; copied: string | null }> = ({ node, onCopy, copied }) => {
  const isLeaf = !node.children || node.children.length === 0;

  if (isLeaf) {
    return (
      <div className="flex flex-col p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 group/item transition-colors border border-transparent hover:border-slate-200 dark:hover:border-zinc-700">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-3">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mr-2">{node.identifier}</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{node.title}</span>
          </div>
          <button onClick={() => onCopy(node.full_text || node.title, node.identifier)} 
            className="text-2xs bg-slate-100 dark:bg-zinc-700 px-2 py-0.5 rounded text-slate-500 hover:text-indigo-600 opacity-0 group-hover/item:opacity-100 transition-opacity">
            {copied === node.identifier ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        {node.full_text && (
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed border-l-2 border-slate-200 dark:border-zinc-700 pl-3 ml-1">
            {node.full_text}
          </p>
        )}
      </div>
    );
  }

  return (
    <details className="group/tree" open={node.level === 1}>
      <summary className="flex items-center gap-2 p-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/50 rounded-lg select-none transition-colors">
        <div className="w-4 h-4 flex items-center justify-center text-slate-400 dark:text-zinc-500 group-open/tree:rotate-90 transition-transform">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
        </div>
        <span className="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{node.type} {node.identifier}</span>
        <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{node.title}</span>
      </summary>
      <div className="ml-4 pl-2 border-l border-slate-200 dark:border-zinc-700 space-y-1 mt-1 pb-1">
        {node.children?.map((child, i) => <TreeNode key={i} node={child} onCopy={onCopy} copied={copied} />)}
      </div>
    </details>
  );
};

// ── Document Viewer (Tabs + Tree) ─────────────────────────────────

const DocumentViewer: React.FC<{ doc: IndexedDocument | StoredDoc }> = ({ doc }) => {
  const [activeTab, setActiveTab] = useState<'structure' | 'search' | 'raw'>('structure');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchableItem[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const searchableItems = React.useMemo(() => flattenForSearch(doc), [doc]);
  const fuse = React.useMemo(() => new Fuse(searchableItems, { keys: ['text', 'label'], threshold: 0.35, includeScore: true }), [searchableItems]);

  useEffect(() => {
    setResults(query.trim() ? fuse.search(query).slice(0, 80).map(r => r.item) : searchableItems.slice(0, 30));
  }, [query, fuse, searchableItems]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const typeLabel: Record<string, string> = { section: 'SEC', rule: 'RULE', chapter: 'CHAP', order: 'ORDER', 'judgment-field': 'INFO', form: 'FORM' };
  const typeColor: Record<string, string> = {
    section: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    rule: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    chapter: 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300',
    order: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    'judgment-field': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    form: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-3 text-center border border-slate-100 dark:border-zinc-700"><div className="text-2xl font-black text-slate-700 dark:text-zinc-200">{doc.totalPages}</div><div className="text-xs text-slate-500 dark:text-zinc-400">Pages</div></div>
        <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-3 text-center border border-slate-100 dark:border-zinc-700"><div className="text-2xl font-black text-slate-700 dark:text-zinc-200">{searchableItems.length}</div><div className="text-xs text-slate-500 dark:text-zinc-400">Indexed Items</div></div>
        
        {doc.stats?.totalOrders !== undefined && <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 text-center border border-indigo-100 dark:border-indigo-800/30"><div className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{doc.stats.totalOrders}</div><div className="text-xs text-indigo-500 dark:text-indigo-400">Orders</div></div>}
        {doc.stats?.totalRules !== undefined && <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center border border-purple-100 dark:border-purple-800/30"><div className="text-2xl font-black text-purple-700 dark:text-purple-300">{doc.stats.totalRules}</div><div className="text-xs text-purple-500 dark:text-purple-400">Rules</div></div>}
        
        {doc.stats?.totalSections !== undefined && <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center border border-blue-100 dark:border-blue-800/30"><div className="text-2xl font-black text-blue-700 dark:text-blue-300">{doc.stats.totalSections}</div><div className="text-xs text-blue-500 dark:text-blue-400">Sections</div></div>}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center border border-emerald-100 dark:border-emerald-800/30"><div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{doc.confidence}%</div><div className="text-xs text-emerald-500 dark:text-emerald-400">Confidence</div></div>
      </div>

      {doc.confidenceReasons && doc.confidenceReasons.length > 0 && (
        <details className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-700">
          <summary className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-zinc-400 cursor-pointer">Confidence breakdown</summary>
          <ul className="px-4 pb-3 space-y-1">
            {doc.confidenceReasons.map((r, i) => <li key={i} className="text-xs text-slate-600 dark:text-zinc-300 flex gap-1.5"><span className="text-slate-400">•</span>{r}</li>)}
          </ul>
        </details>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
        <button onClick={() => setActiveTab('structure')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'structure' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          Structure
        </button>
        <button onClick={() => setActiveTab('raw')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'raw' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Raw Text
        </button>
        <button onClick={() => setActiveTab('search')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'search' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          Search
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[20rem] max-h-[35rem] overflow-y-auto pr-1 custom-scrollbar">
        
        {activeTab === 'structure' && (
          <div className="space-y-4">
            {/* New Recursive content_tree Rendering */}
            {doc.content_tree && doc.content_tree.length > 0 ? (
              <div className="space-y-2">
                {doc.content_tree.map((node: any, idx: number) => (
                  <div key={idx} className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden shadow-sm p-3">
                    <TreeNode node={node} onCopy={handleCopy} copied={copied} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Legacy RULES Struct fallback */}
                {doc.rulesIndex?.orders && (
                  <div className="space-y-2">
                    {doc.rulesIndex.orders.map((order: any, idx: number) => (
                      <details key={idx} className="group bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden shadow-sm">
                        <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-colors select-none">
                          <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 flex items-center justify-center flex-shrink-0 group-open:bg-indigo-500 group-open:text-white transition-colors">
                            <svg className="w-4 h-4 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">Order {order.number}</h4>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">{order.title}</p>
                          </div>
                          <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full">{order.rules?.length || 0} rules</span>
                        </summary>
                        <div className="p-2 pt-0 pb-3 pl-12 pr-4 bg-slate-50 dark:bg-zinc-800/30 border-t border-slate-100 dark:border-zinc-700/50">
                          <div className="space-y-1.5 mt-2">
                            {order.rules?.map((rule: any, ridx: number) => (
                              <div key={ridx} className="flex flex-col p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 group/rule transition-colors border border-transparent hover:border-slate-200 dark:hover:border-zinc-700">
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0 flex-1 pr-3">
                                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 mr-2">Rule {rule.number}</span>
                                    <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{rule.title}</span>
                                  </div>
                                  <button onClick={() => handleCopy(rule.content || `${order.number} Rule ${rule.number}: ${rule.title}`, `r-${order.number}-${rule.number}`)} 
                                    className="text-2xs bg-slate-100 dark:bg-zinc-700 px-2 py-0.5 rounded text-slate-500 hover:text-indigo-600 opacity-0 group-hover/rule:opacity-100 transition-opacity">
                                    {copied === `r-${order.number}-${rule.number}` ? '✓ Copied' : 'Copy'}
                                  </button>
                                </div>
                                {rule.content && (
                                  <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed border-l-2 border-slate-200 dark:border-zinc-700 pl-3 ml-1">
                                    {rule.content}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                )}

                {/* Legacy ACT Struct fallback */}
                {doc.actIndex?.chapters && (
                  <div className="space-y-2">
                    {doc.actIndex.chapters.map((chapter: any, idx: number) => (
                      <details key={idx} className="group bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden shadow-sm" open={idx === 0}>
                        <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-colors select-none">
                          <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300 flex items-center justify-center flex-shrink-0 group-open:bg-slate-800 group-open:text-white dark:group-open:bg-zinc-600 transition-colors">
                            <svg className="w-4 h-4 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">Chapter {chapter.number}</h4>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">{chapter.title}</p>
                          </div>
                          <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full">{chapter.sections?.length || 0} secs</span>
                        </summary>
                        <div className="p-2 pt-0 pb-3 pl-12 pr-4 bg-slate-50 dark:bg-zinc-800/30 border-t border-slate-100 dark:border-zinc-700/50">
                          <div className="space-y-1.5 mt-2">
                            {chapter.sections?.map((section: any, sidx: number) => (
                              <div key={sidx} className={`flex flex-col p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 group/sec transition-colors border border-transparent hover:border-slate-200 dark:hover:border-zinc-700 ${section.repealed ? 'opacity-50' : ''}`}>
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0 flex-1 pr-3">
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mr-2">Section {section.number}</span>
                                    <span className={`text-sm font-semibold text-slate-800 dark:text-zinc-200 ${section.repealed ? 'line-through' : ''}`}>{section.title}</span>
                                    {section.repealed && <span className="ml-2 text-2xs font-bold text-red-500 uppercase">Repealed</span>}
                                  </div>
                                  <button onClick={() => handleCopy(section.content || `Section ${section.number}: ${section.title}`, `s-${section.number}`)} 
                                    className="text-2xs bg-slate-100 dark:bg-zinc-700 px-2 py-0.5 rounded text-slate-500 hover:text-indigo-600 opacity-0 group-hover/sec:opacity-100 transition-opacity">
                                    {copied === `s-${section.number}` ? '✓ Copied' : 'Copy'}
                                  </button>
                                </div>
                                {section.content && (
                                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed border-l-2 border-slate-200 dark:border-zinc-700 pl-3 ml-1">
                                    {section.content}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-4">
            <textarea readOnly 
              value={doc.full_raw_text || (doc as any).fullText || ''} 
              className="w-full min-h-[500px] p-6 bg-slate-50 dark:bg-zinc-900 text-sm font-mono text-slate-700 dark:text-zinc-300 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none resize-none custom-scrollbar"
              placeholder="Source text not available for this document."
            />
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input autoComplete="off" data-lpignore="true"  id="aloa-x-search" type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${searchableItems.length} items…`}
                className="w-full pl-10 pr-10 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              {query && <button onClick={() => setQuery('')} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 text-sm">✕</button>}
            </div>

            <div className="space-y-1.5">
              {results.length === 0 && query ? (
                <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-sm">No results for "{query}"</div>
              ) : (
                results.map(item => (
                  <div key={item.id} className={`group flex flex-col p-3 rounded-lg border transition-all duration-150 ${item.repealed ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30 opacity-60' : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`flex-shrink-0 text-2xs font-black px-2 py-0.5 rounded-md ${typeColor[item.type] ?? ''}`}>{typeLabel[item.type] ?? item.type}</span>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold text-slate-800 dark:text-zinc-100 truncate ${item.repealed ? 'line-through text-slate-400' : ''}`}>{item.citation || item.label}</p>
                          <p className={`text-xs text-slate-900 dark:text-zinc-200 font-medium ${item.repealed ? 'line-through text-slate-400' : ''}`}>{item.text.replace(item.citation || '', '').trim()}</p>
                          {item.parentLabel && <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate mt-0.5 uppercase tracking-tighter">{item.parentLabel}</p>}
                        </div>
                      </div>
                      <button onClick={() => handleCopy(item.text, item.id)}
                        className="flex-shrink-0 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 text-2xs font-bold text-slate-600 dark:text-zinc-300 hover:border-indigo-500 hover:text-indigo-600 transition-all">
                        {copied === item.id ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    {item.summary && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400 leading-snug italic line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main AloaXView ────────────────────────────────────────────────
export const AloaXView: React.FC = () => {
  const { currentUser } = useAuth();
  const { isProperty } = useProduct();
  const firmId = (currentUser as any)?.firmId as string | undefined;

  // Convex save — purely optional background sync
  // Note: useMutation must be called unconditionally per React rules of hooks.
  // If Convex is unavailable at runtime, the mutation will simply fail when invoked.
  const saveAloaDocument = useMutation(api.indexer.saveAloaDocument);

  // ── Local library (localStorage-first) ────────────────────────
  const [library, setLibrary] = useState<StoredDoc[]>([]);

  useEffect(() => {
    setLibrary(loadAloaXLibrary());
  }, []);

  const refreshLibrary = useCallback(() => setLibrary(loadAloaXLibrary()), []);

  // ── Processing state ──────────────────────────────────────────
  const [progress, setProgress] = useState<ProcessingProgress>({ status: 'idle', currentPage: 0, totalPages: 0, percentComplete: 0 });
  const [selectedDoc, setSelectedDoc] = useState<IndexedDocument | StoredDoc | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [resumableSessions, setResumableSessions] = useState<CheckpointMeta[]>([]);
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [processingFileName, setProcessingFileName] = useState('');
  
  // Review Pipeline States
  const [pendingDoc, setPendingDoc] = useState<IndexedDocument | null>(null);
  const [editedJson, setEditedJson] = useState<string>('');
  const [reviewTab, setReviewTab] = useState<'text' | 'structure' | 'json'>('text');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingStartRef = useRef<number>(0);
  const checkpointManager = useRef(new CheckpointManager());

  const isProcessing = ['classifying', 'processing', 'merging', 'revising', 'reviewing', 'saving', 'resuming'].includes(progress.status);

  // Sync processing state globally for background badge pulsing
  useEffect(() => {
    if (isProcessing) {
      document.body.classList.add('aloax-is-processing');
    } else {
      document.body.classList.remove('aloax-is-processing');
    }
    return () => document.body.classList.remove('aloax-is-processing');
  }, [isProcessing]);

  const resolveApiKey = useCallback((): string | null => {
    const existing = getGeminiApiKey();
    if (existing) return existing;
    if (apiKeyInput.trim()) { setCustomApiKey(apiKeyInput.trim()); return apiKeyInput.trim(); }
    return null;
  }, [apiKeyInput]);

  useEffect(() => {
    setResumableSessions(checkpointManager.current.findResumableSessions());
    if (!getGeminiApiKey()) setShowApiKeyPrompt(true);
  }, []);

  // ── Core processing pipeline ──────────────────────────────────
  const processFile = useCallback(async (file: File, resumeDocId?: string) => {
    const apiKey = resolveApiKey();
    if (!apiKey) { setShowApiKeyPrompt(true); return; }

    setErrorMsg(null);
    setSelectedDoc(null);
    setProcessingFileName(file.name);
    processingStartRef.current = Date.now();
    const documentId = resumeDocId ?? generateDocId(file.name);

    try {
      // ─ 1. Load PDF ────────────────────────────────────────────
      setProgress({ status: 'classifying', currentPage: 0, totalPages: 0, percentComplete: 5, message: 'Loading PDF…' });
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer, disableRange: true, disableStream: true }).promise;
      const totalPages: number = pdfDoc.numPages;

      // ─ 2. Classify ───────────────────────────────────────────
      setProgress({ status: 'classifying', currentPage: 0, totalPages, percentComplete: 10, message: 'Analysing document type…' });
      const classifier = new DocumentClassifier();
      const classification = await classifier.classify(pdfDoc, apiKey);
      const { type: docType, confidence, metadata } = classification;

      // ─ 3. Setup checkpoint ────────────────────────────────────
      const totalChunks = CheckpointManager.getTotalChunks(totalPages);
      const existingMeta = checkpointManager.current.loadMetadata(documentId);
      const startChunk = resumeDocId ? (existingMeta?.lastCompletedChunk ?? -1) + 1 : 0;

      checkpointManager.current.saveMetadata({
        documentId, fileName: file.name, documentType: docType,
        totalPages, totalChunks, lastCompletedChunk: startChunk - 1,
        confidence, startedAt: existingMeta?.startedAt ?? Date.now(), updatedAt: Date.now(),
      });

      if (resumeDocId && startChunk > 0) {
        setProgress({ status: 'resuming', currentPage: startChunk * 15, totalPages, percentComplete: Math.round((startChunk / totalChunks) * 83), currentChunk: startChunk, totalChunks, message: `↩ Resuming from chunk ${startChunk + 1}/${totalChunks}` });
        await new Promise(r => setTimeout(r, 500));
      }

      // ─ 4. Process chunks ─────────────────────────────────────
      const chunker = new LegalChunker(apiKey);
      const allChunks = await chunker.processAllChunks(pdfDoc, documentId, docType, totalPages, (p) => {
        setProgress(p);
        setProcessingTime(Date.now() - processingStartRef.current);
      }, startChunk);

      // ─ 5. Merge ──────────────────────────────────────────────
      setProgress({ status: 'merging', currentPage: totalPages, totalPages, percentComplete: 87, message: 'Merging chunks…' });
      const merger = new DocumentMerger(apiKey);
      const mergePromise = merger.merge(
        allChunks, documentId,
        metadata?.title || file.name.replace(/\.pdf$/i, ''),
        totalPages, { type: docType, confidence, metadata }
      );

      // Show 'revising' status after brief delay
      await new Promise(r => setTimeout(r, 3000));
      setProgress({ status: 'revising' as any, currentPage: totalPages, totalPages, percentComplete: 92, message: 'AI reconstructing document structure…' });
      const finalDoc = await mergePromise;

      // ─ 6. Pause for Review ──────────────────────────────────
      setProgress({ status: 'reviewing', currentPage: totalPages, totalPages, percentComplete: 95, message: 'Ready for human review. Please verify structural accuracy.' });
      
      const payloadObj = {
          actIndex: finalDoc.actIndex,
          rulesIndex: finalDoc.rulesIndex,
          judgmentIndex: finalDoc.judgmentIndex,
          metadata: finalDoc.metadata
      };
      
      setPendingDoc(finalDoc);
      setEditedJson(JSON.stringify(payloadObj, null, 2));

    } catch (err: any) {
      console.error('ALOA-X error:', err);
      const msg = String(err?.message ?? err ?? 'Unknown error');
      setErrorMsg(msg);
      setProgress(prev => ({ ...prev, status: 'error', errorMessage: msg }));
    }
  }, [resolveApiKey, firmId, saveAloaDocument, refreshLibrary]);

  const handleConfirmReview = useCallback(() => {
    if (!pendingDoc) return;
    try {
      const parsedJson = JSON.parse(editedJson);
      pendingDoc.actIndex = parsedJson.actIndex;
      pendingDoc.rulesIndex = parsedJson.rulesIndex;
      pendingDoc.judgmentIndex = parsedJson.judgmentIndex;
      pendingDoc.metadata = parsedJson.metadata;

      // ─ Save locally (primary) ──────────────────────────────
      setProgress(prev => ({ ...prev, status: 'saving', percentComplete: 96, message: 'Saving to local library…' }));
      saveDocToLibrary(pendingDoc);
      refreshLibrary();

      // ─ Sync to Convex (optional, non-blocking) ─────────────
      if (saveAloaDocument) {
        saveAloaDocument({
          sessionId: pendingDoc.documentId, firmId,
          fileName: pendingDoc.metadata?.title || pendingDoc.fileName,
          documentType: pendingDoc.documentType, totalPages: pendingDoc.totalPages,
          totalChunks: pendingDoc.totalChunks,
          indexData: { actIndex: pendingDoc.actIndex, rulesIndex: pendingDoc.rulesIndex, judgmentIndex: pendingDoc.judgmentIndex, stats: pendingDoc.stats, metadata: pendingDoc.metadata, confidenceReasons: pendingDoc.confidenceReasons },
          processedAt: Date.now(), status: 'completed',
          confidence: pendingDoc.confidence, fullTextLength: pendingDoc.fullText.length,
        }).catch((e: any) => console.warn('Convex sync skipped (non-fatal):', e));
      }

      // ─ Done ───────────────────────────────────────────────
      checkpointManager.current.clearAll(pendingDoc.documentId);
      setResumableSessions(checkpointManager.current.findResumableSessions());
      setSelectedDoc(pendingDoc);
      setPendingDoc(null);
      setProcessingTime(Date.now() - processingStartRef.current);
      setProgress(prev => ({ ...prev, status: 'completed', percentComplete: 100, message: '✓ Indexing complete!' }));
    } catch (err: any) {
       setErrorMsg(`Invalid JSON format: ${err.message}`);
    }
  }, [pendingDoc, editedJson, firmId, saveAloaDocument, refreshLibrary]);

  const handleCancelReview = useCallback(() => {
    if (!pendingDoc) return;
    setPendingDoc(null);
    setProgress({ status: 'idle', currentPage: 0, totalPages: 0, percentComplete: 0 });
    checkpointManager.current.clearAll(pendingDoc.documentId);
    setResumableSessions(checkpointManager.current.findResumableSessions());
  }, [pendingDoc]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type === 'application/pdf') processFile(file);
    else if (file) setErrorMsg('Please drop a PDF file.');
  }, [processFile]);

  const handleResume = useCallback((session: CheckpointMeta) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.pdf';
    input.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) processFile(f, session.documentId); };
    input.click();
  }, [processFile]);

  const handleDeleteDoc = useCallback((documentId: string) => {
    deleteDocFromLibrary(documentId);
    if ((selectedDoc as any)?.documentId === documentId) setSelectedDoc(null);
    refreshLibrary();
    setDeleteConfirm(null);
  }, [selectedDoc, refreshLibrary]);

  const handleReset = useCallback(() => {
    setProgress({ status: 'idle', currentPage: 0, totalPages: 0, percentComplete: 0 });
    setSelectedDoc(null); setErrorMsg(null); setProcessingFileName('');
  }, []);

  const handleExport = useCallback((doc: IndexedDocument | StoredDoc) => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${doc.documentId}_aloa_index.json`; a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-zinc-900">

      {/* API Key Modal */}
      {showApiKeyPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-xl"><Key className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
              <div>
                <h2 className="font-black text-slate-900 dark:text-white">Gemini API Key Required</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Powers AI structure extraction</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-zinc-300 mb-4">
              Your key is stored only on this device. Get one free at{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">aistudio.google.com</a>
            </p>
            <input autoComplete="off" data-lpignore="true"  id="api-key-input" type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && apiKeyInput) { setCustomApiKey(apiKeyInput); setShowApiKeyPrompt(false); } }}
              placeholder="AIzaSy…" className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-600 rounded-xl bg-slate-50 dark:bg-zinc-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => { if (apiKeyInput) { setCustomApiKey(apiKeyInput); setShowApiKeyPrompt(false); } }} disabled={!apiKeyInput}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition-colors">
                Save & Continue
              </button>
              {getGeminiApiKey() && <button onClick={() => setShowApiKeyPrompt(false)} className="px-4 py-2.5 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold rounded-xl text-sm">Cancel</button>}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-lg shadow-indigo-500/20">⚖</div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{isProperty ? 'ARIA-X Document Indexer' : 'ALOA-X Legal Indexer'}</h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400">{isProperty ? 'Transform documents into searchable structured intelligence' : 'Transform legal PDFs into searchable structured intelligence'} · Stored on this device</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowApiKeyPrompt(true)} title="API Key Settings"
              className="p-2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            </button>
            {selectedDoc && !isProcessing && (
              <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold rounded-xl text-xs transition-colors hover:bg-slate-200 dark:hover:bg-zinc-600">← Back</button>
            )}
            {!isProcessing && (
              <button id="aloa-x-upload-btn" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-500/20 active:scale-95">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                Import PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">

        {/* Sidebar Library */}
        <div className="hidden lg:flex flex-col w-72 xl:w-80 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
              Local Library <span className="text-slate-400 dark:text-zinc-500">({library.length})</span>
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {library.length === 0 ? (
              <div className="px-4 py-8 text-center flex flex-col items-center">
                <div className="w-10 h-10 mb-3 text-slate-300 dark:text-zinc-600"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg></div>
                <p className="text-xs text-slate-400 dark:text-zinc-500">No indexed documents yet</p>
              </div>
            ) : (
              <div className="px-2 space-y-1">
                {library.map(doc => {
                  const docType = doc.documentType as DisplayDocType;
                  const isSelected = (selectedDoc as any)?.documentId === doc.documentId;
                  return (
                    <div key={doc.documentId} className={`group relative rounded-xl transition-all duration-150 cursor-pointer ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'}`}>
                      <button onClick={() => { setSelectedDoc(doc); setProgress({ status: 'idle', currentPage: 0, totalPages: 0, percentComplete: 0 }); setErrorMsg(null); }} className="w-full text-left p-3">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 flex-shrink-0 mt-0.5 text-slate-500">{DOC_TYPE_ICONS[docType] ?? DefaultDocIcon}</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-zinc-100'}`}>{doc.fileName.replace(/\.pdf$/i, '')}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <DocTypeBadge type={docType} />
                              <span className="text-2xs text-slate-400 dark:text-zinc-500">{doc.totalPages}pp</span>
                            </div>
                            <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5">{formatDate(doc.processedAt)}</p>
                          </div>
                        </div>
                      </button>
                      {deleteConfirm === doc.documentId ? (
                        <div className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center gap-2 p-2 z-10 border border-red-200 dark:border-red-900/50 shadow-sm">
                          <span className="text-xs text-red-600 dark:text-red-400 font-bold">Delete?</span>
                          <button onClick={() => handleDeleteDoc(doc.documentId)} className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg font-bold">Yes</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 px-2 py-1 rounded-lg">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(doc.documentId)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <input autoComplete="off" data-lpignore="true"  ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" id="aloa-x-file-input" />

          {/* Processing */}
          {isProcessing && progress.status !== 'reviewing' && (
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Processing</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate max-w-xs">{processingFileName} · {formatDuration(processingTime)}</p>
                </div>
                {progress.currentChunk !== undefined && progress.totalChunks !== undefined && (
                  <div className="text-right">
                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{progress.currentChunk + 1}<span className="text-sm font-medium text-slate-400">/{progress.totalChunks}</span></div>
                    <p className="text-2xs text-slate-400 dark:text-zinc-500">chunks</p>
                  </div>
                )}
              </div>
              <StepIndicator status={progress.status} currentChunk={progress.currentChunk} totalChunks={progress.totalChunks} />
              {progress.totalPages > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-500 dark:text-zinc-400 mb-1.5">
                    <span className="truncate max-w-sm">{progress.message}</span>
                    <span>{Math.round(progress.percentComplete)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress.percentComplete}%` }} />
                  </div>
                  <div className="flex justify-between text-2xs text-slate-400 dark:text-zinc-500 mt-1">
                    <span>Page {progress.currentPage} of {progress.totalPages}</span>
                  </div>
                </div>
              )}
              {progress.totalChunks !== undefined && progress.totalChunks > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-400 dark:text-zinc-500 mb-2">Chunk tracker</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: progress.totalChunks }).map((_, i) => {
                      const done = progress.currentChunk !== undefined && i < progress.currentChunk;
                      const active = i === progress.currentChunk;
                      return (
                        <div key={i} title={`Pages ${i * 15 + 1}–${Math.min((i + 1) * 15, progress.totalPages)}`}
                          className={`w-6 h-6 rounded-md text-3xs font-bold flex items-center justify-center transition-all ${done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white animate-pulse ring-2 ring-indigo-300' : 'bg-slate-100 dark:bg-zinc-700 text-slate-400'}`}>
                          {done ? '✓' : i + 1}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Review Module - Tabbed Toggle per User Feedback */}
          {progress.status === 'reviewing' && pendingDoc && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-xl flex flex-col min-h-[500px]">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 border-b border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-black text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    Human Review Required
                  </h2>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">Verify extracted structure. Edit JSON safely if needed.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCancelReview} className="px-4 py-2 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold rounded-xl text-sm border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 transition-colors">Discard</button>
                  <button onClick={handleConfirmReview} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-500/20 active:scale-95 transition-all">Confirm & Save</button>
                </div>
              </div>
              
              {/* Review Tabs */}
              <div className="flex bg-slate-100 dark:bg-zinc-950 p-2 border-b border-slate-200 dark:border-zinc-800">
                {['text', 'structure', 'json'].map((tab) => (
                  <button key={tab} 
                    onClick={() => {
                        if (reviewTab === 'json') {
                           try {
                             const parsed = JSON.parse(editedJson);
                             setPendingDoc({ ...pendingDoc, ...parsed });
                           } catch (e) { console.warn("Invalid JSON, cannot sync structure"); }
                        }
                        setReviewTab(tab as any);
                    }} 
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all capitalize ${reviewTab === tab ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`}>
                    {tab === 'text' ? 'Scanned Raw Text' : tab === 'structure' ? 'Generated Structure' : 'Edit Raw JSON'}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 flex flex-col overflow-hidden p-0 max-h-[800px] overflow-y-auto">
                {reviewTab === 'text' && (
                   <textarea readOnly value={pendingDoc.fullText} className="flex-1 w-full min-h-[500px] p-6 bg-slate-50 dark:bg-[#09090b] text-sm font-mono text-slate-700 dark:text-zinc-300 focus:outline-none resize-none custom-scrollbar" />
                )}
                
                {reviewTab === 'structure' && (
                   <div className="flex-1 p-6 bg-slate-50 dark:bg-[#09090b]">
                      <DocumentViewer doc={pendingDoc} />
                   </div>
                )}

                {reviewTab === 'json' && (
                   <textarea value={editedJson} onChange={e => setEditedJson(e.target.value)} className="flex-1 w-full min-h-[500px] p-6 bg-indigo-50/30 dark:bg-zinc-900 text-sm font-mono text-indigo-800 dark:text-indigo-300 focus:outline-none resize-none custom-scrollbar" />
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {progress.status === 'error' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 text-red-500 flex-shrink-0"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                <div className="flex-1">
                  <h3 className="font-bold text-red-700 dark:text-red-400 mb-1">Processing Failed</h3>
                  <p className="text-sm text-red-600 dark:text-red-300 mb-3 break-words">{errorMsg}</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleReset} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm">Try Again</button>
                    <button onClick={() => setShowApiKeyPrompt(true)} className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold rounded-xl text-sm">Check API Key</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search/Results Panel */}
          {selectedDoc && (
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-6 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 text-slate-700 dark:text-slate-300">{DOC_TYPE_ICONS[selectedDoc.documentType] ?? DefaultDocIcon}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <DocTypeBadge type={selectedDoc.documentType} size="md" />
                      {progress.status === 'completed' && <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-md">✓ Just Indexed</span>}
                    </div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">{selectedDoc.fileName}</h2>
                    {selectedDoc.metadata?.year && <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{selectedDoc.metadata.jurisdiction ?? ''} {selectedDoc.metadata.year}</p>}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <ConfidenceDot value={selectedDoc.confidence} />
                      <span className="text-xs text-slate-400 dark:text-zinc-500">{selectedDoc.totalChunks} chunks · {formatDate(selectedDoc.processedAt)}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => handleExport(selectedDoc)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 font-bold rounded-xl text-xs transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export JSON
                </button>
              </div>

              {selectedDoc.judgmentIndex && (
                <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800/30">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-3">Judgment Details</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedDoc.judgmentIndex.suitNumber && <div><span className="text-xs text-amber-600 dark:text-amber-400 block">Suit No.</span><span className="font-bold">{selectedDoc.judgmentIndex.suitNumber}</span></div>}
                    {selectedDoc.judgmentIndex.court && <div><span className="text-xs text-amber-600 dark:text-amber-400 block">Court</span><span className="font-medium">{selectedDoc.judgmentIndex.court}</span></div>}
                    {selectedDoc.judgmentIndex.dateDelivered && <div><span className="text-xs text-amber-600 dark:text-amber-400 block">Date</span><span className="font-medium">{selectedDoc.judgmentIndex.dateDelivered}</span></div>}
                    {(selectedDoc.judgmentIndex.parties ?? []).length > 0 && <div className="col-span-2"><span className="text-xs text-amber-600 dark:text-amber-400 block">Parties</span><span className="font-medium">{selectedDoc.judgmentIndex.parties.join(' v. ')}</span></div>}
                    {(selectedDoc.judgmentIndex.judges ?? []).length > 0 && <div className="col-span-2"><span className="text-xs text-amber-600 dark:text-amber-400 block">Coram</span><span className="font-medium">{selectedDoc.judgmentIndex.judges.join(', ')}</span></div>}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-zinc-700 pt-5">
                <DocumentViewer doc={selectedDoc} />
              </div>
            </div>
          )}

          {/* Idle: Upload + Resume */}
          {progress.status === 'idle' && !selectedDoc && (
            <>
              <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer ${isDragging ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.01]' : 'border-slate-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-zinc-800/50'}`}
                onClick={() => fileInputRef.current?.click()}>
                <div className={`w-14 h-14 mx-auto mb-4 text-slate-300 dark:text-zinc-600 transition-transform duration-200 ${isDragging ? 'scale-110 text-indigo-500' : ''}`}>
                  {isDragging ? 
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg> : 
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  }
                </div>
                <h3 className="text-lg font-black text-slate-700 dark:text-zinc-200 mb-2">{isDragging ? 'Drop to import' : 'Import a Legal PDF'}</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">Judgments, Acts, Rules of Court, LFN volumes, Gazettes — indexed and stored on this device</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {(['JUDGMENT', 'ACT', 'RULES', 'LFN', 'GAZETTE'] as DisplayDocType[]).map(t => <DocTypeBadge key={t} type={t} />)}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5">
                <h3 className="text-sm font-black text-slate-700 dark:text-zinc-200 mb-4">How ALOA-X Works</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>, step: '1. Classify', desc: 'Text heuristics + AI vision detect: Acts, Rules of Court, Judgments, LFN volumes, Gazettes' },
                    { icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"/></svg>, step: '2. Extract', desc: '15-page text chunks, 4-page vision chunks for scanned PDFs. Handles 400+ page documents' },
                    { icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>, step: '3. Structure + Revise', desc: 'Gemini extracts chapters/sections/rules then reconstructs a clean Table of Contents matching the actual document' },
                    { icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>, step: '4. Store Locally', desc: 'Indexes saved to your browser storage. No cloud required. Instant search across all your documents' },
                  ].map(({ icon, step, desc }) => (
                    <div key={step} className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl">
                      <div className="w-6 h-6 text-indigo-500 mb-2">{icon}</div>
                      <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 mb-1">{step}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl flex items-center gap-3">
                  <div className="w-5 h-5 flex-shrink-0 text-slate-400"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></div>
                  <p className="text-xs text-slate-600 dark:text-zinc-300"><strong className="text-slate-800 dark:text-zinc-100">Your data stays with you.</strong> Indexes are stored in your browser's local storage — not sent to any server. Your Gemini API key is only used for AI processing.</p>
                </div>
              </div>

              {resumableSessions.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3"><div className="w-5 h-5"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></div><h3 className="text-sm font-black text-amber-800 dark:text-amber-300">In-Progress Sessions ({resumableSessions.length})</h3></div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">Select the same PDF to resume from where processing stopped.</p>
                  <div className="space-y-2">
                    {resumableSessions.map(session => (
                      <div key={session.documentId} className="flex items-center justify-between bg-white dark:bg-zinc-800 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30">
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">{session.fileName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <DocTypeBadge type={session.documentType as DisplayDocType} />
                            <span className="text-xs text-slate-400 dark:text-zinc-500">{session.lastCompletedChunk + 1}/{session.totalChunks} chunks ({Math.round(((session.lastCompletedChunk + 1) / session.totalChunks) * 100)}%)</span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => handleResume(session)} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs">Resume →</button>
                          <button onClick={() => { checkpointManager.current.clearAll(session.documentId); setResumableSessions(prev => prev.filter(s => s.documentId !== session.documentId)); }}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-bold rounded-lg text-xs">Discard</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AloaXView;

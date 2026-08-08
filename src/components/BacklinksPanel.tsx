/**
 * BacklinksPanel — shows "Mentioned In" on matter/contact/document/property
 * detail pages. Displays all notes that reference the current entity via
 * [[...]] bidirectional links.
 *
 * HOW BIDIRECTIONAL BACKLINKS WORK (for users):
 * ----------------------------------------------
 * In any note (Endorsements, Notes view, or Save-to-Note form), type two
 * open brackets `[[` followed by the name of a matter, contact, property,
 * or document, then close with `]]`.
 *
 * Example: [[Adegbenro v. State Bank of Nigeria]] or [[John Doe]]
 *
 * The link becomes clickable in the note, AND the referenced entity's
 * detail page shows a "Mentioned In" panel listing every note that
 * references it. This is bidirectional — you don't need to link from
 * both sides, just one.
 *
 * Usage:
 *   <BacklinksPanel
 *     entityId={matter.id}
 *     entityType="matter"
 *     entityLabel={matter.title}
 *     notes={appState.notePages}
 *     navigateTo={navigateTo}
 *   />
 */
import React, { useState } from 'react';
import { findBacklinks, getEntityNavigation, BiLink } from '../utils/linkParser';

interface BacklinksPanelProps {
  entityId: string;
  entityType: BiLink['type'];
  notes: any[];
  navigateTo: (view: string, id?: string | null, context?: any) => void;
  /** The entity's display label (e.g. matter.title, contact.name, property.address).
   *  Used for real-time content-based backlink matching — scans all notes for
   *  [[Entity Label]] patterns. Without this, backlinks only work if notes have
   *  a stored `links` array (which is not yet implemented). */
  entityLabel?: string;
}

const EntityIcon: React.FC<{ type: BiLink['type']; className?: string }> = ({ type, className = 'w-3.5 h-3.5' }) => {
  switch (type) {
    case 'matter':
      return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>;
    case 'contact':
      return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>;
    case 'property':
      return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>;
    case 'document':
      return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 9.75v4.5m15 0v3a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 17.25v-3m15 0H4.5" /></svg>;
    case 'note':
      return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>;
    default:
      return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>;
  }
};

const LinkIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);

const BacklinksPanel: React.FC<BacklinksPanelProps> = ({ entityId, entityType, notes, navigateTo, entityLabel }) => {
  const backlinks = findBacklinks(entityId, entityType, notes, entityLabel);
  const [showHelp, setShowHelp] = useState(false);

  const entityNoun = entityType === 'matter' ? 'matter' : entityType === 'contact' ? 'contact' : entityType === 'property' ? 'property' : entityType === 'document' ? 'document' : 'item';
  const exampleLabel = entityLabel || `This ${entityNoun}`;

  return (
    <div className="mt-4 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
            Mentioned In ({backlinks.length})
          </h4>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="text-slate-400 hover:text-indigo-500 transition-colors p-1 rounded"
          title="How do backlinks work?"
          aria-label="How do backlinks work?"
        >
          <InfoIcon />
        </button>
      </div>

      {/* Help panel (collapsible) */}
      {showHelp && (
        <div className="px-4 py-3 bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-slate-200 dark:border-zinc-700 text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
          <p className="font-semibold text-slate-700 dark:text-zinc-200 mb-1.5">How bidirectional backlinks work</p>
          <p className="mb-2">
            In any note, type <code className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 font-mono text-2xs">[[</code> followed by a name, then close with <code className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 font-mono text-2xs">]]</code>. The note will appear here automatically.
          </p>
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-2.5 font-mono text-2xs text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
            Example: [[{exampleLabel}]]
          </div>
          <p className="mt-2 text-2xs text-slate-400 dark:text-zinc-500">
            You can link to matters, contacts, properties, or documents. The link works both ways — clicking it in the note takes you to the entity, and this panel shows every note that mentions this {entityNoun}.
          </p>
        </div>
      )}

      {/* Backlink items or empty state */}
      {backlinks.length > 0 ? (
        <div className="divide-y divide-slate-100 dark:divide-zinc-700/50">
          {backlinks.map(({ note, link }) => (
            <button
              key={`${note.id}-${link.id}`}
              onClick={() => {
                const nav = getEntityNavigation(link);
                if (link.type === 'note') {
                  navigateTo('notes', note.id);
                } else {
                  navigateTo(nav.view, link.id);
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-zinc-700/50 transition-colors text-left group"
            >
              <div className="flex-shrink-0 p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500">
                <EntityIcon type={link.type} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {note.title || 'Untitled Note'}
                </p>
                <p className="text-2xs text-slate-400 dark:text-zinc-500">
                  {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  {' · '}
                  <span className="capitalize">{link.type}</span>: {link.label}
                </p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-2">
            No notes mention this {entityNoun} yet.
          </p>
          <p className="text-2xs text-slate-400 dark:text-zinc-500">
            Type <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-mono">[[{exampleLabel}]]</code> in any note to create a link.
          </p>
        </div>
      )}
    </div>
  );
};

export default BacklinksPanel;

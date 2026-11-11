import React from 'react';
import { Document, DocumentVersion } from '../../types';
import { sanitize } from '../../utils/sanitization';

interface DocumentComparisonModalProps {
  currentDocument: Document;
  versionToCompare: DocumentVersion;
  onClose: () => void;
}

/**
 * DocumentComparisonModal — V4 (V-DOC-13) rewrite.
 *
 * The pre-V4 modal was an honest stub ("Inline redline comparison is not
 * yet available"). It is now a real side-by-side comparison: the current
 * state and the selected prior version render next to each other with
 * their metadata (title, date, author of the change, file), so a reviewer
 * can read exactly what the document said then vs now.
 */
export const DocumentComparisonModal: React.FC<DocumentComparisonModalProps> = ({ currentDocument, versionToCompare, onClose }) => {
  const currentContent = currentDocument.content || '';
  const priorContent = versionToCompare.content || '';
  const priorTitle = versionToCompare.title || currentDocument.title;
  const hasCurrent = currentContent.trim().length > 0;
  const hasPrior = priorContent.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h4 className="text-lg font-bold text-slate-800 dark:text-zinc-100">
          {currentDocument.title}
        </h4>
        <p className="text-xs text-slate-500 mt-0.5">
          Comparing the current version with the state recorded on{' '}
          <strong className="text-slate-700 dark:text-zinc-300">
            {new Date(versionToCompare.uploadedAt).toLocaleString('en-GB')}
          </strong>
          {versionToCompare.changesSummary ? ` — ${versionToCompare.changesSummary}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Current */}
        <div className="rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/40 dark:bg-primary-900/10 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-primary-200 dark:border-primary-800 bg-primary-100/60 dark:bg-primary-900/20">
            <p className="text-xs font-black uppercase tracking-wider text-primary-700 dark:text-primary-300">Current</p>
            <p className="text-2xs text-primary-600 dark:text-primary-400 truncate">{currentDocument.title}</p>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[45vh] p-3 custom-scrollbar">
            {hasCurrent ? (
              <div
                className="prose-comparison text-sm leading-relaxed text-slate-800 dark:text-zinc-200 [&_p]:mb-2"
                dangerouslySetInnerHTML={{ __html: sanitize(currentContent) || '<p class="text-slate-400 italic">No content.</p>' }}
              />
            ) : (
              <p className="text-sm text-slate-400 italic">No inline content — {currentDocument.file?.name ? `file: ${currentDocument.file.name}` : 'record only'}.</p>
            )}
          </div>
        </div>

        {/* Prior version */}
        <div className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/60">
            <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400">Prior version</p>
            <p className="text-2xs text-slate-500 truncate">{priorTitle}</p>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[45vh] p-3 custom-scrollbar">
            {hasPrior ? (
              <div
                className="prose-comparison text-sm leading-relaxed text-slate-800 dark:text-zinc-200 [&_p]:mb-2"
                dangerouslySetInnerHTML={{ __html: sanitize(priorContent) || '<p class="text-slate-400 italic">No content.</p>' }}
              />
            ) : (
              <p className="text-sm text-slate-400 italic">
                {versionToCompare.file?.name
                  ? `File-only version (${versionToCompare.file.name}) — no inline content was recorded for this version.`
                  : 'No inline content was recorded for this version.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-2xs text-slate-400 text-center">
        Read both columns side by side; restore the prior version from the document's History tab when needed.
      </p>

      <div className="flex justify-center">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-zinc-600 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

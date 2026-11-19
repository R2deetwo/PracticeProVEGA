/**
 * BundleMode.tsx — presentational components of the Voice → DraftPro
 * Litigation Drafting Pipeline inside the DraftPro editor (owner spec
 * 2026-11-19, §7 "PHASE 4: Editor and Export").
 *
 * Four pieces (all logic lives in DraftProEditor, which owns the TipTap
 * editor instance; these components are pure presentation):
 *   - BundleTabs — navigate between the bundle's documents (spec §5d)
 *   - PlaceholderNav — "Next missing field" / "Previous" + "N fields
 *     remaining" counter + keyboard shortcut hint (spec §7.3)
 *   - CounselReviewBanner — the NON-PRINTING banner every generated document
 *     carries. Rendered OUTSIDE the TipTap content tree so it can never
 *     reach editor.getHTML(), the DOCX export or the print pipeline (AC6.2).
 *   - VoiceEditPanel — the inline diff (Accept / Reject / Retry) behind
 *     Edit Selection by Voice (spec §7.4)
 *
 * Design-system compliance: ui/ primitives only, rounded-lg/rounded-2xl,
 * no gray-* utilities.
 */

import React from "react";
import { Button } from "../../ui";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "../../../constants";

export interface BundleTabInfo {
  id: string;
  label: string;
  placeholderCount: number;
}

export const BundleTabs: React.FC<{
  tabs: BundleTabInfo[];
  activeIndex: number;
  onSelect: (index: number) => void;
}> = ({ tabs, activeIndex, onSelect }) => (
  <div className="flex items-center gap-1.5 flex-wrap px-3 py-1.5 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
    {tabs.map((t, i) => (
      <Button
        key={t.id}
        variant={i === activeIndex ? "primary" : "outline"}
        size="sm"
        onClick={() => onSelect(i)}
        title={t.label}
        className={`!rounded-lg text-xs font-semibold ${i === activeIndex ? "" : "!text-slate-600 dark:!text-zinc-300"}`}
      >
        <span className="truncate max-w-[180px]">{t.label}</span>
        {t.placeholderCount > 0 ? (
          <span
            className={`text-2xs font-bold rounded-full px-1.5 py-0.5 ${
              i === activeIndex
                ? "bg-white/20 text-white"
                : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
            }`}
          >
            {t.placeholderCount}
          </span>
        ) : null}
      </Button>
    ))}
  </div>
);

export const PlaceholderNav: React.FC<{
  remaining: number;
  onPrev: () => void;
  onNext: () => void;
}> = ({ remaining, onPrev, onNext }) => (
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="sm" iconOnly icon={ChevronLeftIcon} aria-label="Previous missing field" onClick={onPrev} disabled={remaining === 0} />
    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
      {remaining === 0 ? "All fields filled" : `${remaining} field${remaining === 1 ? "" : "s"} remaining`}
    </span>
    <Button variant="ghost" size="sm" iconOnly icon={ChevronRightIcon} aria-label="Next missing field" onClick={onNext} disabled={remaining === 0} />
  </div>
);

/** NON-PRINTING: rendered outside the editor content tree so exports never
 *  contain it (AC6.2). */
export const CounselReviewBanner: React.FC<{ noticePeriodConflict: boolean }> = ({
  noticePeriodConflict,
}) => (
  <div className="mx-3 mt-2 flex flex-col gap-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
    <p className="text-2xs font-semibold text-amber-800 dark:text-amber-200">
      Draft generated for counsel review. Statutory references and authorities must be verified before filing.
    </p>
    {noticePeriodConflict ? (
      <p className="text-2xs font-bold text-rose-700 dark:text-rose-300">
        Notice-period warning: the dictated period is shorter than the statutory minimum for this tenancy type — verify before service.
      </p>
    ) : null}
  </div>
);

export interface VoiceEditProposal {
  instruction: string;
  before: string;
  after: string;
}

export const VoiceEditPanel: React.FC<{
  proposal: VoiceEditProposal | null;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onRetry: () => void;
}> = ({ proposal, busy, onAccept, onReject, onRetry }) => {
  if (!proposal) return null;
  return (
    <div className="mx-3 mt-2 flex flex-col gap-2 rounded-2xl border border-violet-300 dark:border-violet-700 bg-violet-50/70 dark:bg-violet-900/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Voice edit — “{proposal.instruction}”
        </p>
        <Button variant="ghost" size="sm" iconOnly icon={XMarkIcon} aria-label="Reject voice edit" onClick={onReject} className="!text-slate-400" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-2">
          <p className="text-2xs font-bold uppercase text-slate-400 mb-1">Before</p>
          <p className="text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed line-clamp-6">
            {proposal.before}
          </p>
        </div>
        <div className="rounded-lg bg-white dark:bg-zinc-800 border border-emerald-300 dark:border-emerald-700 p-2">
          <p className="text-2xs font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1">After</p>
          <p className="text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed line-clamp-6">
            {proposal.after || "(deleted)"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" icon={CheckIcon} loading={busy} onClick={onAccept}>
          Accept
        </Button>
        <Button variant="outline" size="sm" onClick={onRetry} disabled={busy}>
          Retry
        </Button>
        <Button variant="ghost" size="sm" onClick={onReject} disabled={busy}>
          Reject
        </Button>
      </div>
      <p className="text-2xs text-slate-400">Undo (Ctrl/Cmd+Z) restores the previous text.</p>
    </div>
  );
};

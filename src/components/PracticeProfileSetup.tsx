/**
 * PracticePro — PracticeProfileSetup wizard
 * ============================================================
 * A two-product setup wizard that lets a firm (Vega) or portfolio
 * (Atrium) pick what they practise / manage, preview everything that
 * will be pre-populated, and apply it — additive and idempotent.
 *
 * Props are deliberately narrow so it can be mounted:
 *   - inside the OnboardingWizard (after practice-area selection),
 *   - as a modal from Settings -> Firm Configuration,
 *   - from the Getting Started checklist ("Configure your practice").
 *
 * Styling follows the app's established palette (primary-600 actions,
 * slate/zinc neutrals, text-2xs labels, rounded-2xl cards).
 */

import React, { useMemo, useState } from "react";
import {
  PRACTICE_PROFILES,
  PRACTICE_PROFILE_ORDER,
  type PracticeProfile,
} from "../config/practiceProfileLibrary";
import {
  ATRIUM_PROFILES,
  ATRIUM_FOCUS_OVERLAYS,
} from "../config/atriumProfileLibrary";
import { usePracticeProfile, mergePlans, APPLY_STAGES, type ApplyPlan, type ApplyResult } from "../hooks/usePracticeProfile";

export interface PracticeProfileSetupProps {
  product: "vega" | "atrium" | "unified";
  /** pre-selected from firmDetails.practiceProfile */
  initialAreas?: string[];
  initialPortfolioTypes?: string[];
  initialFocusAreas?: string[];
  firmId: string;
  onClose?: () => void;
  /** fired after a successful apply — e.g. persist practiceAreas + toast */
  onApplied?: (ctx: {
    areas: string[];
    portfolioTypes: string[];
    focusAreas: string[];
    result: ApplyResult;
  }) => void;
  // Core state + actions (from useCoreState / CoreProvider)
  contactCategories: { id?: string; name: string }[];
  documentCategories: { id?: string; name: string; parentId?: string | null }[];
  eventTypes: { id?: string; name: string; color?: string }[];
  workflows: {
    id?: string;
    _id?: string;
    type: string;
    default?: { stages?: string[]; suggestions?: unknown };
    subCategories?: Record<string, unknown>;
  }[];
  checklistTemplates: { id?: string; name: string }[];
  addItem: (table: string, data: Record<string, unknown>, label?: string) => Promise<unknown>;
  updateItem: (table: string, data: Record<string, unknown>) => Promise<unknown>;
}

type Step = "select" | "preview" | "result";

const norm = (v: string) => (v || "").trim().toLowerCase();

const Chip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}> = ({ active, onClick, children, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`px-3.5 py-2 text-xs font-bold rounded-full border-2 transition-all ${
      active
        ? "border-primary-400 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
        : "border-slate-100 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-slate-200 dark:hover:border-zinc-600"
    }`}
  >
    {children}
  </button>
);

export const PracticeProfileSetup: React.FC<PracticeProfileSetupProps> = (props) => {
  const { product, initialAreas = [], initialPortfolioTypes = [], initialFocusAreas = [], firmId, onClose, onApplied } = props;
  const isLegal = product === "vega" || product === "unified";
  const isProperty = product === "atrium" || product === "unified";

  const [step, setStep] = useState<Step>("select");
  const [areas, setAreas] = useState<string[]>(initialAreas);
  const [portfolioTypes, setPortfolioTypes] = useState<string[]>(initialPortfolioTypes);
  const [focusAreas, setFocusAreas] = useState<string[]>(initialFocusAreas);
  const [result, setResult] = useState<ApplyResult | null>(null);

  const hook = usePracticeProfile({
    contactCategories: props.contactCategories,
    documentCategories: props.documentCategories,
    eventTypes: props.eventTypes,
    workflows: props.workflows,
    checklistTemplates: props.checklistTemplates,
    firmId,
    addItem: props.addItem,
    updateItem: props.updateItem,
  });

  const plan: ApplyPlan | null = useMemo(() => {
    if (step !== "preview" && step !== "result") return null;
    if (isLegal && isProperty) {
      // Komplete/unified: merge the legal blueprint AND the portfolio
      // blueprint into a single de-duplicated plan.
      return mergePlans(
        hook.buildPlan({ kind: "legal", areas }),
        hook.buildPlan({ kind: "atrium", portfolioTypes, focusAreas }),
      );
    }
    if (isLegal) {
      return hook.buildPlan({ kind: "legal", areas });
    }
    return hook.buildPlan({ kind: "atrium", portfolioTypes, focusAreas });
  }, [step, isLegal, isProperty, areas, portfolioTypes, focusAreas, hook]);

  const totalNew = plan
    ? plan.items.filter((i) => !i.duplicate).length + plan.workflowMerges.length
    : 0;

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const runApply = async () => {
    if (!plan) return;
    const res = await hook.applyPlan(plan, firmId);
    setResult(res);
    setStep("result");
    onApplied?.({ areas, portfolioTypes, focusAreas, result: res });
  };

  // ---------------------------------------------------------------------
  // ROUND 9 — staged setup progress
  // ---------------------------------------------------------------------
  // While the plan is being applied, replace the static greyed-out
  // "Setting up…" button with a live stage-by-stage progress panel so
  // the user can SEE where the setup is (workflows → contacts → folders
  // → event types → checklists → enrichment) instead of staring at a
  // frozen modal.
  const activeStages = useMemo<{ key: string; label: string; count: number }[]>(() => {
    if (!plan) return [];
    const stages: { key: string; label: string; count: number }[] = APPLY_STAGES.map((s) => ({
      key: s.table as string,
      label: s.label,
      count: plan.items.filter(
        (i) => i.table === s.table && !i.duplicate,
      ).length,
    }));
    if (plan.workflowMerges.length > 0) {
      stages.push({
        key: "merges",
        label: "Enriching existing matter types",
        count: plan.workflowMerges.length,
      });
    }
    return stages.filter((s) => s.count > 0);
  }, [plan]);

  const renderSetupProgress = () => {
    const p = hook.progress;
    const currentIdx = p
      ? activeStages.findIndex((s) => s.key === p.stage)
      : -1;
    return (
      <div className="space-y-5" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="relative flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-30 animate-ping" />
            <span className="relative inline-flex rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent animate-spin" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {p?.label || "Setting up your workspace…"}
            </p>
            {p && p.stage !== "done" && p.total > 0 && (
              <p className="text-2xs text-slate-400">
                {p.done} of {p.total}{" "}
                {p.stage === "merges" ? "matter types" : "items"}
              </p>
            )}
          </div>
        </div>

        <ul className="space-y-1.5">
          {activeStages.map((s, i) => {
            const state =
              p?.stage === "done" || (currentIdx > -1 && i < currentIdx)
                ? "done"
                : p?.stage === s.key
                  ? "active"
                  : "pending";
            return (
              <li
                key={s.key}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                  state === "active"
                    ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                    : state === "done"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-300 dark:text-zinc-600"
                }`}
              >
                {state === "done" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : state === "active" ? (
                  <span className="w-3.5 h-3.5 flex-shrink-0 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
                ) : (
                  <span className="w-3.5 h-3.5 flex-shrink-0 rounded-full border-2 border-current opacity-40" />
                )}
                <span className="flex-1">{s.label}</span>
                <span
                  className={`text-2xs tabular-nums ${
                    state === "pending" ? "" : "font-black"
                  }`}
                >
                  {state === "pending" ? `${s.count} queued` : s.count}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-2xs text-slate-400 leading-relaxed px-1">
          Keep this open — this usually takes under a minute. Nothing in your
          existing workspace is changed or deleted.
        </p>
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------

  const renderCount = (label: string, value: number) => (
    <div className="flex items-baseline justify-between px-1">
      <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">{label}</span>
      <span className="text-xs font-black text-primary-600 dark:text-primary-400">{value}</span>
    </div>
  );

  const groupedList = (table: string) =>
    (plan?.items || []).filter((i) => i.table === table);

  const legalProfiles: PracticeProfile[] = PRACTICE_PROFILE_ORDER
    .map((k) => PRACTICE_PROFILES[k])
    .filter((p): p is PracticeProfile => Boolean(p));

  // ---------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------

  if (step === "select") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <header className="text-center space-y-2">
          <p className="text-2xs font-black text-primary-500 uppercase tracking-widest">
            Practice Blueprint
          </p>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            What does your practice do?
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            Pick the areas you actually work in. We will set up matching matter
            types with sub-categories and stages, contact types, document
            folders, event types and starter checklists — you can edit
            everything afterwards.
          </p>
        </header>

        {isLegal && (
          <section className="space-y-3">
            <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest ml-1">
              Areas of Law (select all that apply)
            </label>
            <div className="flex flex-wrap gap-2">
              {legalProfiles.map((p) => (
                <Chip
                  key={p.key}
                  active={areas.includes(p.key)}
                  onClick={() => toggle(areas, setAreas, p.key)}
                  title={p.description}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
            {areas.length > 0 && (
              <p className="text-2xs text-slate-400 ml-1">
                {areas.length} selected — {legalProfiles.find((p) => p.key === areas[0])?.description}
              </p>
            )}
          </section>
        )}

        {isProperty && (
          <>
            <section className="space-y-3">
              <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Portfolio Composition (select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.values(ATRIUM_PROFILES).map((p) => (
                  <Chip
                    key={p.key}
                    active={portfolioTypes.includes(p.key)}
                    onClick={() => toggle(portfolioTypes, setPortfolioTypes, p.key)}
                    title={p.description}
                  >
                    {p.label}
                  </Chip>
                ))}
              </div>
            </section>
            <section className="space-y-3">
              <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Services You Provide (optional overlays)
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.values(ATRIUM_FOCUS_OVERLAYS).map((o) => (
                  <Chip
                    key={o.key}
                    active={focusAreas.includes(o.key)}
                    onClick={() => toggle(focusAreas, setFocusAreas, o.key)}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </section>
          </>
        )}

        <footer className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
            >
              Skip for now
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={
              isLegal && isProperty
                ? areas.length === 0 && portfolioTypes.length === 0
                : isLegal
                  ? areas.length === 0
                  : portfolioTypes.length === 0
            }
            onClick={() => setStep("preview")}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 disabled:opacity-40 shadow-sm"
          >
            Preview setup →
          </button>
        </footer>
      </div>
    );
  }

  if (step === "preview") {
    const groups: { title: string; table: string; hint: string }[] = [
      { title: "Matter Types & Workflows", table: "workflows", hint: "With sub-categories, stages and starter tasks" },
      { title: "Contact Types", table: "contactCategories", hint: "Roles you actually save in this practice" },
      { title: "Document Folders", table: "documentCategories", hint: "Filing categories for your documents" },
      { title: "Event Types", table: "eventTypes", hint: "Calendar categories with colours" },
      { title: "Checklists", table: "checklistTemplates", hint: "Procedure checklists attached to matter types" },
    ];
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <header className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Here is what we will set up
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Nothing is deleted. Items you already have are skipped
            automatically.
          </p>
        </header>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-4 bg-primary-50/60 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-900/40">
          {renderCount("Contact types", plan?.counts.contactTypes || 0)}
          {renderCount("Matter types", plan?.counts.matterTypes || 0)}
          {renderCount("Sub-categories", plan?.counts.subCategories || 0)}
          {renderCount("Doc folders", plan?.counts.documentCategories || 0)}
          {renderCount("Event types", plan?.counts.eventTypes || 0)}
          {renderCount("Checklists", plan?.counts.checklists || 0)}
        </div>

        {hook.running ? (
          <div className="p-4 bg-white dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
            {renderSetupProgress()}
          </div>
        ) : (
          <div className="space-y-4 max-h-[42vh] overflow-y-auto custom-scrollbar pr-1">
          {groups.map((g) => {
            const list = groupedList(g.table);
            if (list.length === 0) return null;
            return (
              <section
                key={g.table}
                className="p-4 bg-white dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{g.title}</h3>
                  <span className="text-2xs text-slate-400">
                    {list.filter((i) => !i.duplicate).length} new · {list.filter((i) => i.duplicate).length} existing
                  </span>
                </div>
                <p className="text-2xs text-slate-400">{g.hint}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {list.map((i) => (
                    <li
                      key={`${g.table}-${i.label}`}
                      className={`text-2xs font-semibold px-2 py-1 rounded-full border ${
                        i.duplicate
                          ? "border-slate-100 dark:border-zinc-700 text-slate-300 dark:text-zinc-600 line-through"
                          : "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {i.label}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {(plan?.workflowMerges || []).length > 0 && (
            <section className="p-4 bg-white dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Sub-categories added to existing matter types
              </h3>
              <ul className="space-y-1">
                {plan!.workflowMerges.map((m) => (
                  <li key={m.workflowId + m.workflowType} className="text-2xs text-slate-500 dark:text-zinc-400">
                    <span className="font-bold">{m.workflowType}</span> — {Object.keys(m.subCategories).join(", ")}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(plan?.automations || []).length > 0 && (
            <section className="p-4 bg-white dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Suggested automations (available after setup)
              </h3>
              <ul className="list-disc list-inside space-y-1">
                {plan!.automations.map((a) => (
                  <li key={a} className="text-2xs text-slate-500 dark:text-zinc-400">
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        )}

        <footer className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
          <button
            type="button"
            disabled={hook.running}
            onClick={() => setStep("select")}
            className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-700 disabled:opacity-40 disabled:cursor-default"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={hook.running || totalNew === 0}
            onClick={runApply}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 disabled:opacity-40 shadow-sm"
          >
            {hook.running
              ? hook.progress?.label || "Setting up…"
              : totalNew === 0
                ? "Everything already set up"
                : `Apply ${totalNew} additions`}
          </button>
        </footer>
      </div>
    );
  }

  // step === "result"
  const ok = (result?.errors.length || 0) === 0;
  return (
    <div className="max-w-lg mx-auto px-6 py-10 text-center space-y-6">
      <div
        className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
          ok
            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300"
            : "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {ok ? "Your workspace is configured" : "Mostly done — a few items need attention"}
        </h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
          {result?.created || 0} additions created · {result?.merged || 0} workflows
          enriched · {result?.skipped || 0} already existed and were skipped.
        </p>
      </div>
      {(result?.errors.length || 0) > 0 && (
        <ul className="text-left text-2xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3 space-y-1">
          {result!.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <p className="text-2xs font-black text-slate-400 uppercase tracking-widest">
          Next steps
        </p>
        <ul className="text-2xs text-slate-500 dark:text-zinc-400 space-y-1">
          <li>Open Settings → Firm Configuration → Workflows to fine-tune stages.</li>
          <li>Checklists live under Firm Configuration → Checklists.</li>
          <li>Contact and document folders are under Categories & Types.</li>
        </ul>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 shadow-sm"
      >
        Done
      </button>
    </div>
  );
};

export default PracticeProfileSetup;

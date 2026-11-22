/**
 * SessionDetailTabs — the tabbed workspace of a finished Vox session:
 * Transcript (speaker-attributed, editable labels, clickable timestamps),
 * File Note, Action Items, Issue Map and Ask Vox (cross-session recall).
 *
 * Part of SessionCaptureView (owner spec 2026-11-22, Mode B). All controls
 * are ui/ primitives (ADR-0004); light/dark parity; no raw form elements.
 */

import React, { useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import {
  ChatAltIcon,
  CheckIcon,
  ClipboardIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
  ArrowPathIcon,
} from "../../constants";
import { useUI } from "../../contexts/UIContext";
import {
  VOX_DRAFT_OPTIONS,
  formatVoxTimestamp,
  renameVoxSpeaker,
  toggleVoxActionItem,
  generateVoxFollowUpDraft,
  askAloaVox,
  type VoxSessionView,
  type VoxDraftType,
} from "../../services/voice/voxSessionService";

export type SessionTabKey = "transcript" | "file_note" | "actions" | "issue_map" | "ask_vox";

export const SESSION_TABS: { key: SessionTabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "transcript", label: "Transcript", icon: ChatAltIcon },
  { key: "file_note", label: "File Note", icon: DocumentTextIcon },
  { key: "actions", label: "Action Items", icon: ListBulletIcon },
  { key: "issue_map", label: "Issue Map", icon: MagnifyingGlassIcon },
  { key: "ask_vox", label: "Ask Vox", icon: SparklesIcon },
];

const ISSUE_CATEGORY_META: Record<string, { title: string; hint: string }> = {
  key_facts: { title: "Key Facts", hint: "The load-bearing facts, attributed." },
  admissions_contradictions: {
    title: "Admissions & Contradictions",
    hint: "Admissions, denials and conflicting statements.",
  },
  open_questions: { title: "Open Questions", hint: "What the firm still needs to confirm." },
  next_steps: { title: "Next Steps", hint: "The immediate practical moves." },
};

// ─── Transcript tab ─────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "counsel", label: "Counsel" },
  { value: "client", label: "Client" },
  { value: "witness", label: "Witness" },
  { value: "other", label: "Other" },
];

const RoleChip: React.FC<{
  label: string;
  count: number;
  onEdit: () => void;
}> = ({ label, count, onEdit }) => (
  <Button variant="outline" size="sm" onClick={onEdit} className="!rounded-full">
    {label}
    <span className="ml-1.5 text-2xs text-slate-400">{count} turns</span>
  </Button>
);

const TranscriptTab: React.FC<{
  session: VoxSessionView;
  onSeek: (ms: number) => void;
  onChanged: () => void;
}> = ({ session, onSeek, onChanged }) => {
  const { addToast } = useUI();
  const turns = session.turns || [];
  const speakers = useMemo(() => {
    const seen = new Map<string, { label: string; role: string; count: number }>();
    for (const t of turns) {
      const cur = seen.get(t.speakerLabel) || { label: t.speakerLabel, role: t.speakerRole, count: 0 };
      cur.count += 1;
      seen.set(t.speakerLabel, cur);
    }
    return Array.from(seen.values()).sort((a, b) => b.count - a.count);
  }, [turns]);

  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newRole, setNewRole] = useState("other");
  const [busy, setBusy] = useState(false);

  const applyRename = async () => {
    if (!editingLabel || !newLabel.trim() || newLabel.trim() === editingLabel) {
      setEditingLabel(null);
      return;
    }
    setBusy(true);
    try {
      const res = await renameVoxSpeaker({
        clientLocalId: session.clientLocalId,
        fromLabel: editingLabel,
        toLabel: newLabel.trim(),
        role: newRole as any,
      });
      addToast(`Renamed ${res.renamed} turn${res.renamed === 1 ? "" : "s"}.`, { type: "success" });
      setEditingLabel(null);
      onChanged();
    } catch (err: any) {
      addToast(err?.message || "Could not rename the speaker.", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (turns.length === 0) {
    return (
      <EmptyTab
        icon={ChatAltIcon}
        title="No transcript turns"
        body="This session finished without speaker-attributed turns. The raw audio may have been too quiet — try recording again closer to the speakers."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Speaker legend + rename */}
      <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
        <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
          Speakers — tap to relabel
        </p>
        <div className="flex flex-wrap gap-2">
          {speakers.map((s) => (
            <div key={s.label}>
              {editingLabel === s.label ? (
                <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/30 pl-3 pr-1.5 py-1">
                  <Input
                    aria-label={`New label for ${s.label}`}
                    styleVariant="bare"
                    value={newLabel}
                    onChange={(e) => setNewLabel((e.target as HTMLInputElement).value)}
                    inputClassName="!bg-transparent !border-0 !shadow-none !ring-0 !px-0 !py-0 w-32 text-sm font-semibold text-slate-900 dark:text-zinc-100 focus:!ring-0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void applyRename();
                      if (e.key === "Escape") setEditingLabel(null);
                    }}
                  />
                  <div className="w-28">
                    <Select
                      aria-label="Speaker role"
                      styleVariant="bare"
                      value={newRole}
                      onChange={(e) => setNewRole((e.target as HTMLSelectElement).value)}
                      options={ROLE_OPTIONS}
                      className="!text-xs !py-1 !px-2"
                    />
                  </div>
                  <Button variant="primary" size="sm" disabled={busy} onClick={() => void applyRename()}>
                    Apply
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingLabel(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <RoleChip
                  label={s.label}
                  count={s.count}
                  onEdit={() => {
                    setEditingLabel(s.label);
                    setNewLabel(s.label);
                    setNewRole("other");
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* The turns */}
      <div className="flex flex-col gap-2.5">
        {turns.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Button
                variant="bare"
                size="sm"
                onClick={() => onSeek(t.startMs)}
                title="Play from here"
                className="!px-1.5 !py-0.5 font-mono text-2xs text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-md"
              >
                [{formatVoxTimestamp(t.startMs)}]
              </Button>
              <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{t.speakerLabel}</span>
              {t.speakerRole !== "other" ? (
                <span className="text-2xs font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wide">
                  {t.speakerRole}
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-[1.7] text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">{t.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── File Note tab ─────────────────────────────────────────────────────────

/** Minimal markdown render for the file note (headers, bold, bullets). */
const FileNoteBody: React.FC<{ markdown: string }> = ({ markdown }) => {
  const blocks = markdown.split(/\n(?=##?\s)/g);
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const heading = lines[0] || "";
        const rest = lines.slice(1).filter((l) => l.trim());
        const isH1 = /^#\s/.test(heading);
        const isH2 = /^##\s/.test(heading);
        const title = heading.replace(/^#+\s*/, "");
        return (
          <div key={i}>
            {title ? (
              <h3
                className={
                  isH1
                    ? "font-display text-lg font-bold text-slate-900 dark:text-zinc-100 mb-2"
                    : isH2
                      ? "font-semibold text-sm uppercase tracking-wide text-slate-500 dark:text-zinc-400 mb-2 mt-1"
                      : "mb-1"
                }
              >
                {renderInline(title)}
              </h3>
            ) : null}
            <div className="flex flex-col gap-1.5">
              {rest.map((line, j) => {
                const bullet = line.match(/^[-*]\s+(.*)$/);
                if (bullet) {
                  return (
                    <div key={j} className="flex gap-2 text-sm leading-[1.7] text-slate-700 dark:text-zinc-300">
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden />
                      <span>{renderInline(bullet[1])}</span>
                    </div>
                  );
                }
                if (!line.trim()) return null;
                return (
                  <p key={j} className="text-sm leading-[1.75] text-slate-700 dark:text-zinc-300">
                    {renderInline(line)}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Bold (**…**) + [Unverified Fact]/[Missing Detail] flags, inline. */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[Unverified Fact\]|\[Missing Detail\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-slate-900 dark:text-zinc-100">
          {tok.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <span
          key={key++}
          className="inline-flex items-center rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-2xs font-semibold text-amber-800 dark:text-amber-300"
        >
          {tok.slice(1, -1)}
        </span>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const FileNoteTab: React.FC<{ session: VoxSessionView; onChanged: () => void }> = ({ session, onChanged }) => {
  const { addToast } = useUI();
  const [drafting, setDrafting] = useState<VoxDraftType | null>(null);
  const outputs = session.outputs;
  const drafts = outputs?.customDrafts || [];
  const [openDraft, setOpenDraft] = useState<number | null>(null);

  const handleCopy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast(`${what} copied.`, { type: "success" });
    } catch {
      addToast("Could not access the clipboard on this device.", { type: "error" });
    }
  };

  const generate = async (type: VoxDraftType) => {
    setDrafting(type);
    try {
      await generateVoxFollowUpDraft({ clientLocalId: session.clientLocalId, type });
      addToast("Draft ready below the file note.", { type: "success" });
      setOpenDraft(drafts.length);
      onChanged();
    } catch (err: any) {
      addToast(err?.message || "Could not generate the draft.", { type: "error" });
    } finally {
      setDrafting(null);
    }
  };

  if (!outputs?.fileNoteMarkdown) {
    return (
      <EmptyTab
        icon={DocumentTextIcon}
        title={session.synthesisError ? "File note not generated" : "File note"}
        body={
          session.synthesisError ||
          "The file note generates when the session finishes processing. Check back in a moment."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <FileNoteBody markdown={outputs.fileNoteMarkdown} />
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          icon={ClipboardIcon}
          onClick={() => void handleCopy(outputs.fileNoteMarkdown!, "File note")}
        >
          Copy file note
        </Button>
        <div className="flex gap-2 flex-wrap">
          {VOX_DRAFT_OPTIONS.map((d) => (
            <Button
              key={d.value}
              variant="ghost"
              size="sm"
              icon={PlusIcon}
              disabled={drafting !== null}
              onClick={() => void generate(d.value)}
            >
              {drafting === d.value ? "Drafting…" : d.label}
            </Button>
          ))}
        </div>
      </div>
      {drafts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Follow-up drafts
          </p>
          {drafts.map((d, i) => {
            const label = VOX_DRAFT_OPTIONS.find((o) => o.value === d.type)?.label || d.type;
            const open = openDraft === i || openDraft === null;
            return (
              <div key={d.createdAt} className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-zinc-800">
                  <Button
                    variant="bare"
                    size="sm"
                    className="!px-0 font-semibold text-sm text-slate-800 dark:text-zinc-200"
                    onClick={() => setOpenDraft(open === true && openDraft === i ? i : i)}
                  >
                    {label}
                  </Button>
                  <Button variant="ghost" size="sm" icon={ClipboardIcon} onClick={() => void handleCopy(d.content, label)}>
                    Copy
                  </Button>
                </div>
                <div className="p-3 text-sm leading-[1.75] text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {d.content}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

// ─── Action Items tab ──────────────────────────────────────────────────────

const ActionsTab: React.FC<{
  session: VoxSessionView;
  onChanged: () => void;
  onCreateTask: (task: { title: string; dueDateText: string; matterId: string | null }) => void;
}> = ({ session, onChanged, onCreateTask }) => {
  const { addToast } = useUI();
  const items = session.outputs?.actionItems || [];
  const [pendingTask, setPendingTask] = useState<string | null>(null);

  const toggle = async (id: string, completed: boolean) => {
    try {
      await toggleVoxActionItem({ clientLocalId: session.clientLocalId, itemId: id, completed });
      onChanged();
    } catch (err: any) {
      addToast(err?.message || "Could not update the item.", { type: "error" });
    }
  };

  if (items.length === 0) {
    return (
      <EmptyTab
        icon={ListBulletIcon}
        title="No action items"
        body={
          session.outputs?.generatedAt
            ? "No follow-ups, evidence requests or deadlines were stated in this session."
            : session.synthesisError || "The checklist generates when the session finishes processing."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((i) => (
        <div
          key={i.id}
          className={`rounded-lg border p-3 ${
            i.completed
              ? "border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60"
              : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          }`}
        >
          <div className="flex items-start gap-3">
            <Button
              variant={i.completed ? "primary" : "outline"}
              size="sm"
              iconOnly
              icon={CheckIcon}
              aria-label={i.completed ? `Mark incomplete: ${i.task}` : `Mark complete: ${i.task}`}
              className="!rounded-full !w-6 !min-w-0 !h-6 mt-0.5 shrink-0"
              onClick={() => void toggle(i.id, !i.completed)}
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm leading-[1.6] ${
                  i.completed ? "text-slate-400 dark:text-zinc-500 line-through" : "text-slate-800 dark:text-zinc-200"
                }`}
              >
                {i.task}
              </p>
              {(i.owner || i.dueDateText) && (
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {i.owner ? (
                    <span className="text-2xs font-semibold text-slate-500 dark:text-zinc-400">Owner: {i.owner}</span>
                  ) : null}
                  {i.dueDateText ? (
                    <span className="text-2xs font-semibold text-primary-700 dark:text-primary-300">
                      Due: {i.dueDateText}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            {!i.completed ? (
              <div className="shrink-0">
                {pendingTask === i.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xs text-slate-500">Create task?</span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        onCreateTask({
                          title: i.task,
                          dueDateText: i.dueDateText,
                          matterId: session.matterId,
                        });
                        setPendingTask(null);
                      }}
                    >
                      Confirm
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPendingTask(null)}>
                      No
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" icon={PlusIcon} onClick={() => setPendingTask(i.id)}>
                    Task
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ))}
      <p className="text-2xs text-slate-400 dark:text-zinc-500 leading-relaxed">
        Items convert to workspace tasks only when you confirm — nothing is created automatically.
      </p>
    </div>
  );
};

// ─── Issue Map tab ─────────────────────────────────────────────────────────

const IssueMapTab: React.FC<{ session: VoxSessionView }> = ({ session }) => {
  const map = session.outputs?.issueMap || [];
  const populated = map.filter((c) => c.nodes.length > 0);
  if (populated.length === 0) {
    return (
      <EmptyTab
        icon={MagnifyingGlassIcon}
        title="No issue map"
        body={
          session.outputs?.generatedAt
            ? "Nothing to map from this session — the transcript carried no extractable facts or issues."
            : session.synthesisError || "The issue map generates when the session finishes processing."
        }
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {map.map((cat) => {
        const meta = ISSUE_CATEGORY_META[cat.category] || { title: cat.category, hint: "" };
        return (
          <div
            key={cat.category}
            className={`rounded-lg border p-4 ${
              cat.nodes.length > 0
                ? "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                : "border-slate-100 dark:border-zinc-800/50 bg-slate-50/60 dark:bg-zinc-900/40 opacity-70"
            }`}
          >
            <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-0.5">{meta.title}</p>
            {meta.hint ? <p className="text-2xs text-slate-400 dark:text-zinc-500 mb-2.5">{meta.hint}</p> : null}
            {cat.nodes.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {cat.nodes.map((n, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-[1.6] text-slate-700 dark:text-zinc-300">
                    <span
                      className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"
                      aria-hidden="true"
                    />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 dark:text-zinc-500 italic">Nothing in this session.</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Ask Vox tab ───────────────────────────────────────────────────────────

interface AskVoxUiState {
  answer: string | null;
  loading: boolean;
  error: string | null;
  sources: { clientLocalId: string; title: string | null; timestampMs: number; kind: string; snippet: string }[];
}

const AskVoxTab: React.FC<{
  session: VoxSessionView;
  matterTitle: string | null;
  onOpenSource: (clientLocalId: string, timestampMs: number) => void;
}> = ({ session, matterTitle, onOpenSource }) => {
  const [question, setQuestion] = useState("");
  const [scopeToMatter, setScopeToMatter] = useState(true);
  const [state, setState] = useState<AskVoxUiState>({ answer: null, loading: false, error: null, sources: [] });
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  const ask = async () => {
    const q = question.trim();
    if (!q || state.loading) return;
    setState({ answer: null, loading: true, error: null, sources: [] });
    try {
      const res = await askAloaVox(q, {
        matterId: scopeToMatter && session.matterId ? session.matterId : undefined,
      });
      setState({ answer: res.answer, loading: false, error: null, sources: res.sources });
      setHistory((h) => [{ q, a: res.answer }, ...h].slice(0, 6));
      setQuestion("");
    } catch (err: any) {
      setState({ answer: null, loading: false, error: err?.message || "The lookup failed.", sources: [] });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5">
        <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-2">Ask across your recordings</p>
        <div className="flex gap-2">
          <Input
            aria-label="Ask Aloa Vox"
            placeholder="e.g. What did the client say about the payment schedule?"
            value={question}
            onChange={(e) => setQuestion((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void ask();
            }}
            styleVariant="bare"
            inputClassName="!py-2"
          />
          <Button variant="primary" icon={SendIcon} disabled={state.loading || !question.trim()} onClick={() => void ask()}>
            {state.loading ? "…" : "Ask"}
          </Button>
        </div>
        {session.matterId ? (
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <Button
              variant={scopeToMatter ? "segmented-active" : "segmented"}
              size="sm"
              onClick={() => setScopeToMatter(true)}
            >
              This matter{matterTitle ? ` (${matterTitle.slice(0, 24)}${matterTitle.length > 24 ? "…" : ""})` : ""}
            </Button>
            <Button
              variant={!scopeToMatter ? "segmented-active" : "segmented"}
              size="sm"
              onClick={() => setScopeToMatter(false)}
            >
              All my sessions
            </Button>
          </div>
        ) : null}
      </div>

      {state.loading ? (
        <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center gap-2.5">
          <ArrowPathIcon className="w-4 h-4 text-primary-600 animate-spin" aria-hidden="true" />
          <span className="text-sm text-slate-500 dark:text-zinc-400">Searching your recordings…</span>
        </div>
      ) : null}

      {state.error ? (
        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-3.5 flex gap-2.5">
          <ExclamationTriangleIcon className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm text-rose-700 dark:text-rose-300">{state.error}</p>
        </div>
      ) : null}

      {state.answer ? (
        <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm leading-[1.8] text-slate-800 dark:text-zinc-200 whitespace-pre-wrap">
            {state.answer}
          </p>
          {state.sources.length > 0 ? (
            <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                Sources — tap to open at that moment
              </p>
              <div className="flex flex-wrap gap-2">
                {state.sources.map((s, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="!rounded-full"
                    onClick={() => onOpenSource(s.clientLocalId, s.timestampMs)}
                  >
                    <span className="font-semibold">{s.title || "Untitled session"}</span>
                    <span className="ml-1.5 font-mono text-2xs text-primary-700 dark:text-primary-300">
                      {s.kind === "file_note" ? "note" : formatVoxTimestamp(s.timestampMs)}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 && !state.answer && !state.loading ? (
        <div className="flex flex-col gap-2">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Recent</p>
          {history.map((h, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-3"
            >
              <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">{h.q}</p>
              <p className="text-sm text-slate-700 dark:text-zinc-300 line-clamp-3">{h.a}</p>
            </div>
          ))}
        </div>
      ) : null}
      <p className="text-2xs text-slate-400 dark:text-zinc-500 leading-relaxed">
        Answers come only from your recorded sessions, each citing the session and the [MM:SS] moment it was said.
      </p>
    </div>
  );
};

// ─── Shared empty state ────────────────────────────────────────────────────

const EmptyTab: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}> = ({ icon: Icon, title, body }) => (
  <div className="flex flex-col items-center justify-center text-center gap-3 py-12 px-6">
    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
      <Icon className="w-6 h-6 text-slate-400 dark:text-zinc-500" aria-hidden="true" />
    </div>
    <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{title}</p>
    <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm leading-relaxed">{body}</p>
  </div>
);

// ─── The tabbed container ──────────────────────────────────────────────────

export const SessionDetailTabs: React.FC<{
  session: VoxSessionView;
  activeTab: SessionTabKey;
  onSeek: (ms: number) => void;
  onChanged: () => void;
  onCreateTask: (task: { title: string; dueDateText: string; matterId: string | null }) => void;
  onOpenSource: (clientLocalId: string, timestampMs: number) => void;
  matterTitle: string | null;
}> = ({ session, activeTab, onSeek, onChanged, onCreateTask, onOpenSource, matterTitle }) => {
  return (
    <div>
      {activeTab === "transcript" ? <TranscriptTab session={session} onSeek={onSeek} onChanged={onChanged} /> : null}
      {activeTab === "file_note" ? <FileNoteTab session={session} onChanged={onChanged} /> : null}
      {activeTab === "actions" ? (
        <ActionsTab session={session} onChanged={onChanged} onCreateTask={onCreateTask} />
      ) : null}
      {activeTab === "issue_map" ? <IssueMapTab session={session} /> : null}
      {activeTab === "ask_vox" ? (
        <AskVoxTab session={session} matterTitle={matterTitle} onOpenSource={onOpenSource} />
      ) : null}
    </div>
  );
};

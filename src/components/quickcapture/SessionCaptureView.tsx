/**
 * SessionCaptureView — Mode B of the dual-mode Aloa Vox (owner spec
 * 2026-11-22): the Plaud-style Legal Session Capture workspace.
 *
 * Lifecycle: SETUP (context tagging — matter link, session type, title,
 * retention + the consent reminder) → LIVE (mic recording or an uploaded
 * audio file, both sliced into 60 s offline-safe segments) → PROCESSING
 * (diarized transcription + speaker reconcile + the one-click synthesis)
 * → READY (the session detail: playback bar with speed control, Export
 * menu, and the tabbed workspace — Transcript · File Note · Action Items ·
 * Issue Map · Ask Vox).
 *
 * Mode A (Quick Dictation) is untouched in the Speak tab — this view only
 * ADDS the session capability beside it. All controls are ui/ primitives.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ClipboardIcon,
  DownloadIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  MicrophoneIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  UsersIcon,
} from "../../constants";
import { useUI } from "../../contexts/UIContext";
import { useMatterState } from "../../contexts/MatterContext";
import { useDataState, useDataActions } from "../../contexts/DataContext";
import { useTasks } from "../../hooks/useTasks";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useVoxSession } from "../../hooks/useVoxSession";
import { useVoxAudioPlayer } from "../../hooks/useVoxAudioPlayer";
import {
  VOX_SESSION_TYPE_OPTIONS,
  buildSessionMarkdown,
  downloadTextFile,
  exportSessionDocx,
  formatVoxTimestamp,
  listVoxSessions,
  updateVoxSessionMeta,
  deleteVoxSession,
  type VoxSessionView,
} from "../../services/voice/voxSessionService";
import { SessionDetailTabs, SESSION_TABS, type SessionTabKey } from "./SessionDetailTabs";

const RETENTION_OPTIONS = [
  { value: "0", label: "Keep audio until I delete it" },
  { value: "30", label: "Auto-delete audio after 30 days" },
  { value: "90", label: "Auto-delete audio after 90 days" },
  { value: "365", label: "Auto-delete audio after 1 year" },
];

/** Collapsible "Recent sessions" header row. */
const RecentSessionsHeader: React.FC<{ onClick: () => void; count: number }> = ({ onClick, count }) => (
  <Button variant="bare" size="sm" fullWidth className="!justify-between !px-3" onClick={onClick}>
    <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
      Recent sessions
    </span>
    <span className="text-2xs text-slate-400">{count}</span>
  </Button>
);

export const SessionCaptureView: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { addToast } = useUI();
  const { matterState } = useMatterState();
  // useTasks consumes the raw AppState + data actions (same wiring the
  // task views use) — task conversion from action items stays on the
  // firm's real task pipeline, offline queue included.
  const { appState } = useDataState();
  const dataActions = useDataActions();
  const { handleAddTask } = useTasks(appState, dataActions);
  const { light } = useHapticFeedback();
  const vox = useVoxSession();

  const [recent, setRecent] = useState<VoxSessionView[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [activeTab, setActiveTab] = useState<SessionTabKey>("transcript");
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const matters = matterState?.matters || [];
  const matterTitle = useMemo(
    () => matters.find((m) => m.id === vox.session?.matterId)?.title || null,
    [matters, vox.session?.matterId]
  );

  const loadRecent = React.useCallback(() => {
    listVoxSessions({ limit: 12 })
      .then(setRecent)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    loadRecent();
  }, [loadRecent, vox.phase]);

  // Click-outside for the export menu.
  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: PointerEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [exportOpen]);

  const player = useVoxAudioPlayer(vox.session?.clientLocalId || null, vox.session?.audioSegments || [], {
    onError: (msg) => addToast(msg, { type: "info" }),
  });

  // ─── Task conversion (explicit confirmation happens in the tab) ────────
  const handleCreateTask = async (task: { title: string; dueDateText: string; matterId: string | null }) => {
    try {
      await handleAddTask({
        title: task.title,
        description: task.dueDateText ? `Deadline mentioned in session: ${task.dueDateText}` : "",
        matterId: task.matterId || undefined,
        status: "todo",
      } as any);
    } catch {
      addToast("Could not create the task.", { type: "error" });
    }
  };

  const handleOpenSource = (clientLocalId: string, timestampMs: number) => {
    if (vox.session && clientLocalId === vox.session.clientLocalId) {
      player.seek(timestampMs);
      setActiveTab("transcript");
      return;
    }
    void vox.loadSession(clientLocalId).then(() => {
      setActiveTab("transcript");
      addToast("Opened the cited session.", { type: "info" });
    });
  };

  const handleExport = async (kind: "md" | "docx" | "copy") => {
    const session = vox.session;
    if (!session) return;
    setExportOpen(false);
    try {
      if (kind === "md") {
        downloadTextFile(
          `${(session.title || "vox-session").replace(/[^\w\-]+/g, "-").slice(0, 60)}.md`,
          buildSessionMarkdown(session)
        );
        addToast("Markdown downloaded.", { type: "success" });
      } else if (kind === "docx") {
        await exportSessionDocx(session);
        addToast("Word document downloaded.", { type: "success" });
      } else {
        await navigator.clipboard.writeText(buildSessionMarkdown(session));
        addToast("Session record copied.", { type: "success" });
      }
    } catch (err: any) {
      addToast(err?.message || "The export failed.", { type: "error" });
    }
  };

  const handleRetitle = async (title: string) => {
    const session = vox.session;
    if (!session || !title.trim() || title.trim() === session.title) return;
    try {
      await updateVoxSessionMeta({ clientLocalId: session.clientLocalId, title: title.trim() });
      await vox.refresh();
    } catch {
      addToast("Could not rename the session.", { type: "error" });
    }
  };

  // ═════════════════════════════ SETUP ═══════════════════════════════════
  if (vox.phase === "setup" || vox.phase === "error") {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-6">
          <div className="max-w-md mx-auto flex flex-col gap-5">
            <div className="text-center pt-2">
              <div className="w-14 h-14 rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 flex items-center justify-center mx-auto mb-3">
                <UsersIcon className="w-7 h-7 text-primary-600 dark:text-primary-400" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Session Capture</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Record or upload a consultation, interview, debrief or court note. You get a
                speaker-labelled transcript, a structured file note, an action checklist and an
                issue map.
              </p>
            </div>

            {vox.error ? (
              <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-3 flex gap-2.5">
                <ExclamationTriangleIcon className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-sm text-rose-700 dark:text-rose-300">{vox.error}</p>
              </div>
            ) : null}

            <Input
              label="Session title"
              placeholder="e.g. Intake — Okafor boundary dispute"
              value={vox.context.title}
              onChange={(e) => vox.setContext({ title: (e.target as HTMLInputElement).value })}
            />

            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200 mb-2">Session type</p>
              <div className="grid grid-cols-1 gap-1.5">
                {VOX_SESSION_TYPE_OPTIONS.map((o) => (
                  <Button
                    key={o.value}
                    variant={vox.context.sessionType === o.value ? "segmented-active" : "segmented"}
                    size="sm"
                    fullWidth
                    onClick={() => {
                      light();
                      vox.setContext({ sessionType: o.value });
                    }}
                    className="!justify-start text-left"
                  >
                    <span className="flex flex-col items-start">
                      <span>{o.label}</span>
                      <span
                        className={`text-2xs font-normal ${
                          vox.context.sessionType === o.value
                            ? "text-primary-100"
                            : "text-slate-400 dark:text-zinc-500"
                        }`}
                      >
                        {o.hint}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            <Select
              label="Link to a matter (optional)"
              placeholder="Standalone session"
              value={vox.context.matterId}
              onChange={(e) => vox.setContext({ matterId: (e.target as HTMLSelectElement).value })}
              options={matters.slice(0, 200).map((m) => ({ value: m.id, label: m.title }))}
            />

            <Select
              label="Audio retention"
              value={String(vox.context.retentionDays)}
              onChange={(e) =>
                vox.setContext({ retentionDays: Number((e.target as HTMLSelectElement).value) || 0 })
              }
              options={RETENTION_OPTIONS}
              hint="Transcripts and file notes are always kept — only the audio ages out."
            />

            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 flex gap-2.5">
              <ExclamationTriangleIcon
                className="w-4 h-4 text-amber-500 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                Record only with the participants' knowledge. Where the law or your professional
                conduct rules require it, tell everyone present that the session is being recorded
                before you start.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                minTouchTarget
                fullWidth
                icon={MicrophoneIcon}
                disabled={!vox.supported}
                onClick={() => {
                  light();
                  void vox.startRecording();
                }}
              >
                Start recording
              </Button>
              <Button
                variant="outline"
                size="lg"
                minTouchTarget
                fullWidth
                icon={DownloadIcon}
                disabled={!vox.supported}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload an audio file
              </Button>
              {/* The hidden file picker (ref-driven; ui/Input file type). */}
              <Input
                aria-label="Upload audio file"
                type="file"
                accept="audio/*"
                styleVariant="bare"
                containerClassName="hidden"
                inputClassName="hidden"
                onChange={(e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) void vox.uploadFile(file);
                  (e.target as HTMLInputElement).value = "";
                }}
                ref={fileInputRef as any}
              />
              <Button variant="ghost" size="sm" onClick={onExit}>
                Back to Vox
              </Button>
            </div>

            {/* Recent sessions */}
            {recent.length > 0 ? (
              <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                <RecentSessionsHeader onClick={() => setShowSessions((v) => !v)} count={recent.length} />
                {showSessions ? (
                  <div className="p-2 flex flex-col gap-1">
                    {recent.map((s) => (
                      <div
                        key={s.clientLocalId}
                        className="flex items-center gap-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 px-2 py-2"
                      >
                        <Button
                          variant="bare"
                          size="sm"
                          className="!justify-start flex-1 min-w-0 !px-1"
                          onClick={() => void vox.loadSession(s.clientLocalId)}
                        >
                          <span className="flex flex-col items-start min-w-0">
                            <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">
                              {s.title || s.sessionTypeLabel}
                            </span>
                            <span className="text-2xs text-slate-400">
                              {s.sessionTypeLabel} ·{" "}
                              {s.durationSeconds ? formatVoxTimestamp(s.durationSeconds * 1000) : "—"} ·{" "}
                              {s.status === "ready" ? "ready" : s.status}
                            </span>
                          </span>
                        </Button>
                        {confirmDelete === s.clientLocalId ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                void vox.remove(s.clientLocalId).then(() => {
                                  setConfirmDelete(null);
                                  loadRecent();
                                  addToast("Session deleted.", { type: "success" });
                                });
                              }}
                            >
                              Delete
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={TrashIcon}
                            aria-label={`Delete session: ${s.title || s.sessionTypeLabel}`}
                            className="!text-slate-400 hover:!text-rose-600 shrink-0"
                            onClick={() => setConfirmDelete(s.clientLocalId)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════ LIVE / UPLOADING / PROCESSING ═══════════════════
  if (vox.phase !== "ready") {
    const live = vox.phase === "recording" || vox.phase === "paused";
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="max-w-md mx-auto flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-center">
              <div
                className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  vox.phase === "recording"
                    ? "bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800"
                    : "bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700"
                }`}
              >
                <MicrophoneIcon
                  className={`w-8 h-8 ${
                    vox.phase === "recording" ? "text-rose-500 animate-pulse" : "text-slate-400"
                  }`}
                  aria-hidden="true"
                />
              </div>
              <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">
                {formatVoxTimestamp(vox.elapsedMs)}
              </p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                {vox.phase === "recording" && "Recording — audio saves continuously"}
                {vox.phase === "paused" && "Paused"}
                {vox.phase === "uploading" && `Slicing the file… ${vox.segmentCount} segments`}
                {vox.phase === "processing" && "Uploading + transcribing + preparing your file note…"}
                {vox.phase === "queued" && "Offline — saved on this device. It will process when the signal returns."}
              </p>
              <p className="text-2xs text-slate-400 mt-1">
                {vox.context.title || VOX_SESSION_TYPE_OPTIONS.find((o) => o.value === vox.context.sessionType)?.label}
              </p>
              {vox.error ? <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{vox.error}</p> : null}
            </div>

            {vox.transcriptSoFar ? (
              <details className="rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3">
                <summary className="text-xs font-semibold text-slate-500 dark:text-zinc-400 cursor-pointer">
                  Live transcript so far ({vox.segmentCount} segments uploaded)
                </summary>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 whitespace-pre-wrap leading-relaxed">
                  {vox.transcriptSoFar.slice(-1200)}
                </p>
              </details>
            ) : vox.segmentCount > 0 ? (
              <p className="text-xs text-slate-400 text-center">
                {vox.segmentCount} audio segment{vox.segmentCount > 1 ? "s" : ""} saved — the
                speaker-labelled transcript appears here as they upload.
              </p>
            ) : null}

            <div className="flex items-center justify-center gap-2">
              {live ? (
                <>
                  {vox.phase === "recording" ? (
                    <Button variant="outline" size="md" minTouchTarget icon={PauseIcon} onClick={vox.pause}>
                      Pause
                    </Button>
                  ) : (
                    <Button variant="outline" size="md" minTouchTarget icon={PlayIcon} onClick={vox.resume}>
                      Resume
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="md"
                    minTouchTarget
                    icon={StopIcon}
                    onClick={() => {
                      light();
                      void vox.stop();
                    }}
                  >
                    End & process
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={vox.discard}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════ READY (session detail) ═══════════════════════
  const session = vox.session!;
  const typeMeta = VOX_SESSION_TYPE_OPTIONS.find((o) => o.value === session.sessionType);
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 px-2.5 py-0.5 text-2xs font-bold text-primary-700 dark:text-primary-300">
                {session.sessionTypeLabel}
              </span>
              {session.matterId ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 text-2xs font-semibold text-slate-600 dark:text-zinc-300 max-w-[200px] truncate">
                  {matterTitle || "Linked matter"}
                </span>
              ) : null}
              {session.status !== "ready" ? (
                <span className="text-2xs text-amber-600 dark:text-amber-400">{session.status}…</span>
              ) : null}
            </div>
            <TitleEditor title={session.title || ""} onDone={handleRetitle} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative" ref={exportRef}>
              <Button
                variant="outline"
                size="sm"
                icon={DownloadIcon}
                onClick={() => setExportOpen((v) => !v)}
                aria-expanded={exportOpen}
              >
                Export
                <ChevronDownIcon className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
              </Button>
              {exportOpen ? (
                <div className="absolute right-0 top-full mt-1.5 w-44 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg shadow-slate-900/10 flex flex-col p-1">
                  <Button variant="ghost" size="sm" onClick={() => void handleExport("md")}>
                    Markdown (.md)
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void handleExport("docx")}>
                    Word (.docx)
                  </Button>
                  <Button variant="ghost" size="sm" icon={ClipboardIcon} onClick={() => void handleExport("copy")}>
                    Copy everything
                  </Button>
                </div>
              ) : null}
            </div>
            {confirmDelete === session.clientLocalId ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    void vox.remove(session.clientLocalId).then(() => {
                      setConfirmDelete(null);
                      loadRecent();
                      addToast("Session deleted.", { type: "success" });
                    });
                  }}
                >
                  Delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                  No
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={TrashIcon}
                aria-label="Delete session"
                className="!text-slate-400 hover:!text-rose-600"
                onClick={() => setConfirmDelete(session.clientLocalId)}
              />
            )}
          </div>
        </div>

        {/* Playback bar */}
        {player.hasAudio ? (
          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              iconOnly
              icon={player.playing ? PauseIcon : PlayIcon}
              aria-label={player.playing ? "Pause" : "Play"}
              className="!rounded-full !w-8 !min-w-0 !h-8"
              onClick={player.toggle}
            />
            <span className="font-mono text-2xs text-slate-500 dark:text-zinc-400 tabular-nums">
              {formatVoxTimestamp(player.positionMs)} / {formatVoxTimestamp(player.totalMs)}
            </span>
            <Input
              aria-label="Seek"
              type="range"
              min={0}
              max={Math.max(1, player.totalMs)}
              step={1000}
              value={Math.min(player.positionMs, player.totalMs)}
              onChange={(e) => player.seek(Number((e.target as HTMLInputElement).value))}
              styleVariant="bare"
              containerClassName="flex-1 min-w-[120px]"
              inputClassName="w-full accent-primary-600 h-1.5 cursor-pointer"
            />
            <div className="flex gap-1">
              {player.speeds.map((s) => (
                <Button
                  key={s}
                  variant={player.rate === s ? "segmented-active" : "segmented"}
                  size="sm"
                  className="!px-2 !text-2xs"
                  onClick={() => player.setRate(s)}
                >
                  {s}x
                </Button>
              ))}
            </div>
          </div>
        ) : session.hasAudio ? null : (
          <p className="text-2xs text-slate-400 mt-2 flex items-center gap-1.5">
            <LockClosedIcon className="w-3.5 h-3.5" aria-hidden="true" />
            Audio not retained for this session — the transcript is the record.
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 pb-1 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Session records">
        {SESSION_TABS.map((t) => (
          <Button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            variant={activeTab === t.key ? "segmented-active" : "segmented"}
            size="sm"
            minTouchTarget
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* The workspace */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SessionDetailTabs
          session={session}
          activeTab={activeTab}
          onSeek={(ms) => {
            player.seek(ms);
          }}
          onChanged={() => {
            void vox.refresh();
            loadRecent();
          }}
          onCreateTask={handleCreateTask}
          onOpenSource={handleOpenSource}
          matterTitle={matterTitle}
        />
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-2.5 flex items-center justify-between gap-2 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <Button variant="ghost" size="sm" onClick={vox.reset}>
          New session
        </Button>
        <div className="flex items-center gap-2">
          {session.synthesisError ? (
            <span className="text-2xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <ExclamationTriangleIcon className="w-3.5 h-3.5" aria-hidden="true" />
              File note pending
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowPathIcon}
            onClick={() => {
              void vox.refresh();
              loadRecent();
            }}
          >
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onExit}>
            Back to Vox
          </Button>
        </div>
      </div>
    </div>
  );
};

/** Inline-editable session title (Enter/blur commits). */
const TitleEditor: React.FC<{ title: string; onDone: (t: string) => void }> = ({ title, onDone }) => {
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);
  const commit = () => {
    if (value.trim() && value.trim() !== title) onDone(value.trim());
    else setValue(title);
  };
  return (
    <Input
      aria-label="Session title"
      value={value}
      onChange={(e) => setValue((e.target as HTMLInputElement).value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      styleVariant="bare"
      inputClassName="!bg-transparent !border-0 !shadow-none !ring-0 !px-0 !py-0 text-base font-bold text-slate-900 dark:text-zinc-100 focus:!ring-0"
    />
  );
};

/**
 * LegalPadView — the Hybrid Legal Pad (consultation & evidence mode).
 *
 * A clean, distraction-free notepad: the lawyer types brief shorthand
 * bullet points while background audio recording runs continuously
 * (pause/resume, auto-saving both the typed notes and the audio segments).
 * Two-tier storage keeps the original timestamped audio alongside the
 * word-for-word verbatim transcript; on session end the merged structured
 * summary weaves the shorthand with the spoken record.
 */

import React, { useMemo } from "react";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { CheckIcon, ClipboardIcon, MicrophoneIcon, PauseIcon, PlayIcon, StopIcon } from "../../constants";
import { useUI } from "../../contexts/UIContext";
import { useLegalPadSession } from "../../hooks/useLegalPadSession";

const formatMs = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

export const LegalPadView: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { addToast } = useUI();
  const pad = useLegalPadSession();

  const busy = pad.phase === "processing";
  const resultTabs = useMemo(
    () => [
      { key: "summary", label: "Summary" },
      { key: "verbatim", label: "Verbatim" },
      { key: "shorthand", label: "My notes" },
    ] as const,
    []
  );
  const [activeTab, setActiveTab] = React.useState<(typeof resultTabs)[number]["key"]>("summary");

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast("Copied.", { type: "success" });
    } catch {
      addToast("Could not access the clipboard on this device.", { type: "error" });
    }
  };

  // ─── Idle: start sheet ────────────────────────────────────────────────────
  if (pad.phase === "idle" || pad.phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 p-6 min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <MicrophoneIcon className="w-9 h-9 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Hybrid Legal Pad</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
            Type shorthand while the consultation records in the background. When you end the
            session you get a merged summary, the verbatim transcript, and the original
            timestamped audio.
          </p>
        </div>
        {pad.error ? (
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 max-w-sm">
            {pad.error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button
            variant="primary"
            size="lg"
            minTouchTarget
            icon={MicrophoneIcon}
            onClick={() => void pad.start()}
          >
            Start consultation
          </Button>
          <Button variant="ghost" size="sm" onClick={onExit}>
            Back to Quick Capture
          </Button>
        </div>
      </div>
    );
  }

  // ─── Result: merged summary + verbatim + shorthand tabs ───────────────────
  if (pad.phase === "result" && pad.capture) {
    const c = pad.capture;
    const summaryText = c.mergedSummary || "";
    return (
      <div className="flex flex-col gap-4 p-4 pb-24">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700">
              <CheckIcon className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-base leading-tight">Session saved</h3>
              <p className="text-xs text-slate-500">
                {Math.round((c.durationMs || 0) / 1000)}s of audio · {c.segmentCount} segments ·
                original audio archived
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={pad.reset}>
            New session
          </Button>
        </div>

        <div className="flex gap-1.5" role="tablist" aria-label="Session records">
          {resultTabs.map((t) => (
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

        <div className="rounded-2xl bg-white border border-slate-200 p-4 text-base leading-relaxed text-slate-800 whitespace-pre-wrap max-h-[55vh] overflow-y-auto">
          {activeTab === "summary" && (summaryText || "The merged summary is still processing — check back in a moment.")}
          {activeTab === "verbatim" && (c.verbatimText || "")}
          {activeTab === "shorthand" && (c.shorthandText || pad.shorthand || "")}
        </div>

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="lg"
            minTouchTarget
            fullWidth
            icon={ClipboardIcon}
            onClick={() =>
              void handleCopy(
                activeTab === "summary"
                  ? summaryText
                  : activeTab === "verbatim"
                    ? c.verbatimText || ""
                    : c.shorthandText || pad.shorthand || ""
              )
            }
          >
            Copy {activeTab === "summary" ? "summary" : activeTab === "verbatim" ? "verbatim" : "notes"}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Live session: notepad + background recorder ─────────────────────────
  const livePhase = pad.phase === "paused" ? "paused" : pad.phase === "recording" ? "recording" : busy ? "processing" : "queued";
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Recorder status bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
              livePhase === "recording" ? "bg-rose-500 animate-pulse" : livePhase === "paused" ? "bg-amber-500" : "bg-slate-300"
            }`}
            aria-hidden
          />
          <span className="text-sm font-semibold text-slate-900 tabular-nums">
            {formatMs(pad.elapsedMs)}
          </span>
          <span className="text-xs text-slate-500 truncate">
            {livePhase === "recording" && "Recording — audio saves continuously"}
            {livePhase === "paused" && "Paused"}
            {livePhase === "processing" && "Uploading + transcribing…"}
            {livePhase === "queued" && "Offline — saved on this device"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {livePhase === "recording" ? (
            <Button variant="outline" size="sm" minTouchTarget icon={PauseIcon} onClick={pad.pause}>
              Pause
            </Button>
          ) : livePhase === "paused" ? (
            <Button variant="outline" size="sm" minTouchTarget icon={PlayIcon} onClick={pad.resume}>
              Resume
            </Button>
          ) : null}
          {livePhase === "recording" || livePhase === "paused" ? (
            <Button variant="primary" size="sm" minTouchTarget icon={StopIcon} onClick={() => void pad.stop()}>
              End
            </Button>
          ) : null}
        </div>
      </div>

      {/* The pad */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="flex flex-col gap-3 h-full">
          <Textarea
            aria-label="Shorthand notes"
            placeholder={"Type shorthand while you listen…\n• client: Mr Okafor\n• dispute: boundary at Lekki plot\n• wants: demand letter this week"}
            value={pad.shorthand}
            onChange={(e) => pad.setShorthand((e.target as HTMLTextAreaElement).value)}
            style={{ minHeight: "50vh" }}
            className="text-base leading-relaxed"
          />
          {pad.verbatimSoFar ? (
            <details className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <summary className="text-xs font-semibold text-slate-500 cursor-pointer">
                Live transcript so far ({pad.segmentCount} segments uploaded)
              </summary>
              <p className="text-xs text-slate-500 mt-2 whitespace-pre-wrap leading-relaxed">
                {pad.verbatimSoFar.slice(-1200)}
              </p>
            </details>
          ) : (
            <p className="text-xs text-slate-400">
              {pad.segmentCount > 0
                ? `${pad.segmentCount} audio segment${pad.segmentCount > 1 ? "s" : ""} saved on device — the verbatim transcript appears here as segments upload.`
                : "Audio saves to this device every minute — a weak signal will not lose the recording."}
            </p>
          )}
          {pad.error ? <p className="text-xs text-amber-600">{pad.error}</p> : null}
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (pad.segmentCount > 0) {
              addToast(
                "Session kept on this device — return to finish it later.",
                { type: "info" }
              );
            }
            onExit();
          }}
        >
          Leave
        </Button>
        {livePhase === "recording" || livePhase === "paused" ? (
          <Button variant="danger-soft" size="sm" onClick={() => void pad.discard()}>
            Discard
          </Button>
        ) : null}
      </div>
    </div>
  );
};

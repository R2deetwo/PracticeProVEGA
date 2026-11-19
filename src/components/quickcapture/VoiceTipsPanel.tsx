/**
 * VoiceTipsPanel — the "Quick Capture & Voice Guide" (owner spec,
 * 2026-11-19, Part 3).
 *
 * Two homes, one component:
 *   1. In Quick Capture: a collapsible panel behind the "?" Voice Tips
 *      button — the tricks you need mid-capture, one tap away.
 *   2. In Help / Support: the full searchable section (id
 *      "quick-capture-voice") with the same content plus the Personal
 *      Dictionary and Spoken Snippets managers.
 *
 * Content covers the four required sections: what you can capture, smart
 * voice tricks (Add More, backtracking, snippets, edit-by-voice, quiet
 * mode), the Personal Dictionary loop, and the startup preference.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import {
  CheckIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from "../../constants";
import { useUI } from "../../contexts/UIContext";
import {
  addDictionaryTerms,
  deleteSnippet,
  listDictionary,
  listSnippets,
  removeDictionaryTerm,
  saveSnippet,
  type VoiceDictionaryEntry,
  type VoiceSnippet,
} from "../../services/voice/voiceCaptureService";

interface VoiceTipsPanelProps {
  /** In Quick Capture: the X button. In Help: hidden (the section is the page). */
  onClose?: () => void;
  /** Deep-link out to the full Help Center section. */
  onOpenFullGuide?: () => void;
  /** Render without the panel chrome (Help embeds the body directly). */
  bare?: boolean;
}

const EXAMPLES: { label: string; say: string; does: string }[] = [
  {
    label: "Ask a question (read-only)",
    say: "“What's my schedule today? Any hearings this week on the Sino Truck matter?”",
    does: "Answers from your Court Diary, matters and notes — strictly read-only. Nothing is created, staged or scheduled; a date word like “today” is never treated as an instruction.",
  },
  {
    label: "New matter",
    say: "“New instruction: Mrs. Tunde Adeyemi wants us to handle a commercial lease renewal for her warehouse in Lekki Phase 1. Remind me to send her our engagement letter tomorrow morning.”",
    does: "Proposes creating the matter with intake bullets, and queues the engagement-letter task for tomorrow 9:00 AM.",
  },
  {
    label: "Standalone task (no matter)",
    say: "“Remind me to renew our chambers Starlink subscription and pay annual NBA branch dues by next Monday.”",
    does: "Creates chambers diary items with no linked matter — clean bullets, zero meta-speech.",
  },
  {
    label: "Court endorsement",
    say: "“Court rose at 1 PM. Suit FHC/L/CS/45/2026, Chukwu v Zenith Bank, before Justice Ogundipe. Order: parties to file written addresses within 14 days. Adjourned to December 14 for hearing.”",
    does: "Extracts a structured endorsement (Court, Suit No, Parties, Coram, Orders, Next Adjourned Date) and offers to diary the adjourned date.",
  },
  {
    label: "Property / unit note",
    say: "“At Chevron Drive Terrace, Block B, Flat 3, tenant Mr. Bassey says the borehole pump tripped and he'll pay service charge on Friday.”",
    does: "Logs the note on that exact unit in your Properties, with an optional Friday follow-up reminder.",
  },
  {
    label: "Expense log",
    say: "“Log an expense on the Sino Truck matter — spent 14,500 naira today on CTC fees and transport at Ikeja.”",
    does: "Logs ₦14,500 as a disbursement on that matter, ready for billing.",
  },
  {
    label: "Draft kickoff",
    say: "“Draft a demand letter on the Chukwu file to Apex Logistics Limited for 4.5 million naira unpaid haulage, 14 days notice.”",
    does: "Creates a pre-filled starter draft you can open in the editor and finish.",
  },
  {
    label: "Mark a task done",
    say: "“Update Sino Truck — I've finished the registry check on the next court date, mark that reminder done; the matter is adjourned to December 14 for hearing.”",
    does: "Marks the open reminder Completed, saves the clean case note, and offers December 14 to the Court Diary.",
  },
];

const TRICKS: { title: string; body: string }[] = [
  {
    title: "Questions are read-only — asks never create entries",
    body: "Ask anything — “What's my schedule today?”, “Do I have anything tomorrow?”, “When is the Sino Truck matter coming up?” — and Quick Ask answers from your own records without creating anything. Diary entries, tasks and notes are only created from clear instructions like “Remind me…”, “Schedule…”, “Add a task…” or “Log an expense…”. Combine both in one breath (“What's my schedule tomorrow, and add a review task at 4 PM?”) and only the explicit instruction is acted on — the question part stays a question.",
  },
  {
    title: "Add More — incremental dictation",
    body: "Tap “Add More — continue dictating” any time before or after saving. Each new clip joins the same draft; dates, matters and events are re-checked across the whole note. Your manual edits are never overwritten.",
  },
  {
    title: "Backtracking — correct yourself out loud",
    body: "Say “actually…”, “scratch that”, “no, wait”, “I mean” or “make that” and the retracted words are discarded completely — only the final version survives. “Tuesday at 2 PM — actually scratch that, Wednesday at 4 PM” schedules Wednesday 4 PM, and the saved note never mentions Tuesday.",
  },
  {
    title: "Edit Selection by Voice",
    body: "Highlight any passage in the draft box, then tap “Edit Selection by Voice” and speak your instruction — “make this sound firmer and turn the demands into three numbered points.” Only the highlighted passage is rewritten; everything else stays untouched.",
  },
  {
    title: "Quiet Mode",
    body: "Turn on Quiet Mode from the ⚙ menu before recording in a court gallery, shared library or any quiet room. It relaxes noise suppression so faint, quiet speech is captured cleanly instead of being filtered out as background noise.",
  },
  {
    title: "Nigerian English & Pidgin — no language switching",
    body: "Dictate naturally — English, Pidgin, or a mix. Formatted outputs normalise casual phrasing into crisp professional English (“make I follow up with registrar for Ikeja” → “Follow up with the Registrar at Ikeja High Court”), while the Verbatim tier preserves your exact words.",
  },
  {
    title: "Smart formatting by destination",
    body: "Diary entries get one-line action summaries; case notes use clean paragraphs, switching to bullets when you dictate 3+ distinct items; courtroom dictations become formal endorsement blocks; client updates are drafted warm and plain — and the raw transcript always rides along, one toggle away.",
  },
];

export const VoiceTipsPanel: React.FC<VoiceTipsPanelProps> = ({
  onClose,
  onOpenFullGuide,
  bare,
}) => {
  const { addToast } = useUI();
  const [snippets, setSnippets] = useState<VoiceSnippet[]>([]);
  const [dictionary, setDictionary] = useState<VoiceDictionaryEntry[]>([]);
  const [newTerm, setNewTerm] = useState("");
  const [newSnippet, setNewSnippet] = useState({ trigger: "", content: "" });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    listSnippets()
      .then(setSnippets)
      .catch(() => undefined);
    listDictionary()
      .then(setDictionary)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addTerm = async () => {
    const term = newTerm.trim();
    if (!term) return;
    setBusy(true);
    try {
      await addDictionaryTerms([term], "manual");
      setNewTerm("");
      addToast(`Added “${term}” to your Voice Dictionary.`, { type: "success" });
      refresh();
    } catch (err: any) {
      addToast(err?.message || "Could not add the term.", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const removeTerm = async (id: string) => {
    try {
      await removeDictionaryTerm(id);
      refresh();
    } catch (err: any) {
      addToast(err?.message || "Could not remove the term.", { type: "error" });
    }
  };

  const addSnippet = async () => {
    const trigger = newSnippet.trigger.trim();
    const content = newSnippet.content.trim();
    if (!trigger || !content) {
      addToast("A snippet needs a spoken trigger and its text.", { type: "info" });
      return;
    }
    setBusy(true);
    try {
      await saveSnippet({ trigger, content });
      setNewSnippet({ trigger: "", content: "" });
      addToast(`Snippet saved — say “${trigger}” while dictating.`, { type: "success" });
      refresh();
    } catch (err: any) {
      addToast(err?.message || "Could not save the snippet.", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const removeSnippet = async (id: string) => {
    try {
      await deleteSnippet(id);
      refresh();
    } catch (err: any) {
      addToast(err?.message || "Could not delete the snippet.", { type: "error" });
    }
  };

  const body = (
    <div className="flex flex-col gap-5">
      {/* 1. What you can capture */}
      <section>
        <h3 className="text-sm font-bold text-slate-900 mb-2">
          What you can capture
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          One note can be several things at once — capture first, organize in one tap.
        </p>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((ex) => (
            <div
              key={ex.label}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <span className="text-2xs font-bold uppercase tracking-wide text-emerald-700">
                {ex.label}
              </span>
              <p className="text-xs text-slate-800 mt-1 leading-relaxed">{ex.say}</p>
              <p className="text-2xs text-slate-500 mt-1 leading-relaxed">
                <CheckIcon className="w-3 h-3 inline-block mr-1 -mt-0.5 text-emerald-600" />
                {ex.does}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Smart voice tricks */}
      <section>
        <h3 className="text-sm font-bold text-slate-900 mb-2">Smart voice tricks</h3>
        <div className="flex flex-col gap-2">
          {TRICKS.map((t) => (
            <div key={t.title} className="rounded-lg border border-slate-200 bg-white p-3">
              <span className="text-xs font-semibold text-slate-800">{t.title}</span>
              <p className="text-2xs text-slate-500 mt-1 leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Spoken snippets manager */}
      <section>
        <h3 className="text-sm font-bold text-slate-900 mb-1">Spoken snippets</h3>
        <p className="text-xs text-slate-500 mb-2">
          Say a trigger phrase mid-dictation and its full text expands into the
          formatted note — e.g. <em>“…and insert chambers signature.”</em>
        </p>
        <div className="flex flex-col gap-1.5 mb-2">
          {snippets.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  “{s.trigger}”{s.isDefault ? " · default" : ""}
                </p>
                <p className="text-2xs text-slate-500 line-clamp-2 whitespace-pre-wrap">
                  {s.content}
                </p>
              </div>
              {!s.isDefault && !String(s.id).startsWith("default-") ? (
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={TrashIcon}
                  aria-label={`Delete snippet ${s.trigger}`}
                  className="!text-slate-400 hover:!text-rose-600 shrink-0"
                  onClick={() => void removeSnippet(s.id)}
                />
              ) : null}
            </div>
          ))}
          {snippets.length === 0 ? (
            <p className="text-2xs text-slate-400">Loading snippets…</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 p-3">
          <Input
            aria-label="New snippet trigger"
            placeholder='Spoken trigger, e.g. "insert my standard directions"'
            value={newSnippet.trigger}
            onChange={(e) =>
              setNewSnippet((s) => ({ ...s, trigger: (e.target as HTMLInputElement).value }))
            }
            styleVariant="modern"
          />
          <Textarea
            aria-label="New snippet text"
            placeholder="The text that gets inserted…"
            value={newSnippet.content}
            onChange={(e) => setNewSnippet((s) => ({ ...s, content: e.target.value }))}
            rows={3}
            maxLength={2000}
            className="!text-xs !leading-relaxed"
          />
          <Button
            variant="outline"
            size="sm"
            minTouchTarget
            icon={PlusIcon}
            loading={busy}
            onClick={() => void addSnippet()}
            className="self-start"
          >
            Add Snippet
          </Button>
        </div>
      </section>

      {/* 4. Personal dictionary */}
      <section>
        <h3 className="text-sm font-bold text-slate-900 mb-1">
          Personal Dictionary — it learns your names
        </h3>
        <p className="text-xs text-slate-500 mb-2">
          Whenever you correct a word in the draft box before saving
          (“Chinedoo” → “Chinedu”), the correction is captured automatically and
          used as a spelling hint in every future dictation. Legal Latin
          (<em>certiorari</em>, <em>functus officio</em>, <em>locus standi</em>,{" "}
          <em>ex parte</em>) and Nigerian court names are already known.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {dictionary.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700"
            >
              {d.term}
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={XMarkIcon}
                aria-label={`Remove ${d.term}`}
                className="!text-slate-400 hover:!text-rose-600"
                onClick={() => void removeTerm(d.id)}
              />
            </span>
          ))}
          {dictionary.length === 0 ? (
            <p className="text-2xs text-slate-400">
              Nothing learned yet — corrections you make in the draft box appear here.
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Input
            aria-label="Add dictionary term"
            placeholder="Add a name, firm or term…"
            value={newTerm}
            onChange={(e) => setNewTerm((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addTerm();
              }
            }}
            styleVariant="modern"
            containerClassName="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            minTouchTarget
            icon={PlusIcon}
            loading={busy}
            onClick={() => void addTerm()}
          >
            Add
          </Button>
        </div>
      </section>

      {/* 5. Startup preference */}
      <section>
        <h3 className="text-sm font-bold text-slate-900 mb-1">Startup preference</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          By default the app opens the Full Office dashboard. On your phone you
          can flip <strong>“Start in Quick Capture on mobile”</strong> (in
          Quick Capture’s ⚙ menu) so launch lands straight on the mic — it is
          OFF by default and saved per device.
        </p>
      </section>
    </div>
  );

  if (bare) return body;

  return (
    <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
            <SparklesIcon className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 text-sm leading-tight">
              Voice Tips — Quick Capture & Voice Guide
            </h2>
            <p className="text-2xs text-slate-500">
              Tricks, snippets and your Voice Dictionary
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onOpenFullGuide ? (
            <Button variant="ghost" size="sm" onClick={onOpenFullGuide}>
              Full guide
            </Button>
          ) : null}
          {onClose ? (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={XMarkIcon}
              aria-label="Close voice tips"
              onClick={onClose}
            />
          ) : null}
        </div>
      </div>
      {body}
    </div>
  );
};

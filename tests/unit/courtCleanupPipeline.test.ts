/**
 * courtCleanupPipeline — ROUND 25 (ALOA Vox intelligence overhaul, owner bug
 * report 2026-11-28). Locks the TWO-LAYER audio + LLM pipeline and the shared
 * intelligence layer as source contracts and prompt contracts:
 *
 *   BUG 2 layer 1 — domain-tuned STT: the Nigerian litigation vocabulary
 *   biases BOTH Gemini transcription prompts and the Whisper `prompt` param,
 *   so "counsel" / "hearing of motion" are captured at the source.
 *
 *   BUG 2 layer 2 + BUG 3 — the LLM cleanup pass: the shared
 *   ENDORSEMENT_FORMAT_SYSTEM_PROMPT gains the legal-homophone repair rule
 *   ("hearing of emotion" → "hearing of motion", "council" → "counsel"),
 *   the stutter/false-start rule, and the STANDARD NIGERIAN COURTROOM
 *   ENDORSEMENT SEQUENCE (Appearance → Proceedings → Ruling/Orders → Next
 *   date & purpose); Court Mode runs it automatically when a dictated
 *   transcript lands, preserves the raw transcript, and exposes the
 *   Raw Transcript → Cleaned Draft → Save review workflow.
 *
 *   FEATURE 6 — ONE shared engine, context-aware ("court_hearing" |
 *   "client_consultation" | "process_drafting" | "general_note"), with the
 *   Court ↔ Vox cross-surface sync (capture linked to its matter on save,
 *   tagged in Vox → Recent voice notes).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildDiarizationTranscriptionPrompt,
  buildVerbatimPrompt,
  ENDORSEMENT_FORMAT_SYSTEM_PROMPT,
} from "../../convex/voiceCapture";

const root = (relative: string) => join(process.cwd(), relative);
const readSrc = (relative: string) => readFileSync(root(relative), "utf8");

// ─── BUG 2 layer 1 — domain-tuned STT ─────────────────────────────────────

describe("STT domain tuning (BUG 2, layer 1)", () => {
  it("the verbatim prompt carries the Nigerian litigation vocabulary", () => {
    const prompt = buildVerbatimPrompt();
    expect(prompt).toContain("hearing of motion");
    expect(prompt).toContain("never 'hearing of emotion'");
    expect(prompt).toContain("counsel");
    expect(prompt).toContain("written address");
    expect(prompt).toContain("notice of appeal");
    expect(prompt).toContain("adjourned");
    expect(prompt).toContain("ruling");
    expect(prompt).toContain("coram");
    expect(prompt).toContain("suit numbers");
  });

  it("the diarizing prompt carries the same vocabulary", () => {
    const prompt = buildDiarizationTranscriptionPrompt();
    expect(prompt).toContain("hearing of motion");
    expect(prompt).toContain("counsel");
  });

  it("the Whisper path biases its prompt param with the vocabulary (source contract)", () => {
    const source = readSrc("convex/voiceCapture.ts");
    expect(source).toContain("prompt: opts.continuationTail || LEGAL_STT_VOCABULARY_HINT");
  });

  it("the verbatim prompt still keeps its no-cleaning contract", () => {
    const prompt = buildVerbatimPrompt();
    expect(prompt).toContain("Transcribe EXACTLY what is spoken");
    expect(prompt).toContain("Do NOT clean up");
    // continuation context still rides along
    const withTail = buildVerbatimPrompt("adjourned to the fourth of");
    expect(withTail).toContain("This clip continues a recording");
    expect(withTail).toContain("adjourned to the fourth of");
  });
});

// ─── BUG 2 layer 2 + BUG 3 — the LLM cleanup pass ────────────────────────

describe("ENDORSEMENT_FORMAT_SYSTEM_PROMPT (BUG 2/3 rules)", () => {
  it("repairs the owner's exact legal homophone mis-hearings", () => {
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain('"hearing of emotion" → "hearing of motion"');
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain('"council" → "counsel"');
    // context-guarded: a legislative council stays a council
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("legislative or local-government council");
  });

  it("resolves stutters and immediate phrase repetitions", () => {
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("the judge the judge");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("they said they were going to they were opposed to");
  });

  it("enforces the STANDARD COURTROOM ENDORSEMENT SEQUENCE regardless of dictation order", () => {
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("STANDARD COURTROOM ENDORSEMENT SEQUENCE");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("(i) Appearance / counsel");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("(ii) Proceedings");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("(iii) Ruling / orders and party directives");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("(iv) Next date and its purpose");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("Omit any stage the lawyer did not speak about");
  });

  it("keeps every pinned no-invention guardrail from the earlier rounds", () => {
    // (Pinned by tests/unit/fieldDictationAndEndorsement.test.ts — restated
    // here so the new rules can never silently displace the old ones.)
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("NEVER add anything the note does not say");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("Keep every fact EXACTLY as dictated");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("reference only");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("never copy anything from it into the endorsement");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("Nigerian English spellings");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("Return ONLY the formatted endorsement text");
    expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain("If the note is already clean, return it unchanged");
  });
});

describe("Court Mode cleanup pass (BUG 2, layer 2 — source contract)", () => {
  const hook = readSrc("src/components/aloa/court/useCourtDictation.ts");

  it("runs the SHARED engine automatically when the transcript lands", () => {
    expect(hook).toContain('capture.phase !== "triage"');
    expect(hook).toContain("formatEndorsement(");
    expect(hook).toContain('context: "court_hearing"');
  });

  it("is one shared engine — the same formatEndorsement the endorsement composer uses", () => {
    expect(hook).toContain("from \"../../../services/voice/voiceCaptureService\"");
  });

  it("preserves the raw transcript alongside the cleaned draft", () => {
    expect(hook).toContain("rawTranscript");
  });

  it("never clobbers fresher manual edits mid-flight", () => {
    expect(hook).toContain("stillCurrent");
    expect(hook).toContain("skipped");
  });

  it("a failed pass never loses the lawyer's words", () => {
    expect(hook).toContain('setCleanupPhase("failed")');
  });
});

describe("The review workflow in the composer (BUG 2.3 — source contract)", () => {
  const composer = readSrc("src/components/aloa/court/OutcomeComposer.tsx");
  const reviewPanel = readSrc("src/components/aloa/court/DictationReviewPanel.tsx");
  const actionsList = readSrc("src/components/aloa/court/DetectedActionsList.tsx");
  const courtroomActions = readSrc("src/components/aloa/court/useCourtroomActions.ts");

  it("the composer wires the review panel, the actions list and the cleanup re-run", () => {
    expect(composer).toContain("<DictationReviewPanel");
    expect(composer).toContain("cleanupPhase={cleanupPhase}");
    expect(composer).toContain("rawTranscript={draft?.rawTranscript}");
    expect(composer).toContain("onRunCleanup={onRunCleanup}");
    expect(composer).toContain("<DetectedActionsList");
    expect(composer).toContain("useCourtroomActions({ matter, viewerId })");
  });

  it("shows the cleanup status (cleaning / failed / skipped)", () => {
    expect(reviewPanel).toContain("Cleaning up dictation");
    expect(reviewPanel).toContain("Cleanup could not run");
    expect(reviewPanel).toContain("Cleanup skipped");
  });

  it("keeps the raw transcript accessible alongside the cleaned, editable draft", () => {
    expect(reviewPanel).toContain("Raw transcript (as dictated)");
  });

  it("offers the on-demand re-run (Clean up with AI)", () => {
    expect(reviewPanel).toContain("Clean up with AI");
  });

  it("offers one-tap Create task / Create reminder from the extraction", () => {
    expect(actionsList).toContain("Create task");
    expect(actionsList).toContain("Create reminder");
    expect(actionsList).toContain("Detected actions");
  });

  it("creates the items auto-associated with the active matter", () => {
    expect(courtroomActions).toContain('"tasks"');
    expect(courtroomActions).toContain("matterId: matter.id");
    expect(courtroomActions).toContain("dueDate: action.dueDayKey");
  });

  it("reports confirmed dates up so the diary calendar jumps (BUG 4)", () => {
    expect(composer).toContain("onNextDateFocused");
    expect(composer).toContain("onNextDateFocused={onNextDateFocused}");
  });
});

// ─── BUG 4 — the detected-date banner + diary auto-jump ──────────────────

describe("Detected-date banner + diary auto-jump (BUG 4 — source contract)", () => {
  const section = readSrc("src/components/aloa/court/NextDateSection.tsx");
  const mini = readSrc("src/components/aloa/court/MiniCalendar.tsx");
  const container = readSrc("src/components/aloa/AloaCourtMode.tsx");

  it("the banner reads \"Detected next date: …\" with Set as next date / Dismiss", () => {
    expect(section).toContain("Detected next date:");
    expect(section).toContain("Set as next date");
    expect(section).toContain("Dismiss");
  });

  it("the mini-calendar jumps to the focused month and selects the day", () => {
    expect(mini).toContain("focusDayKey");
    expect(mini).toContain("setMonthOffset((year - todayDate.getFullYear()) * 12 + (month - 1 - todayDate.getMonth()))");
    expect(mini).toContain("setSelected(focusDayKey)");
  });

  it("the container owns the focus day and clears it when switching matters", () => {
    expect(container).toContain("calendarFocusDayKey");
    expect(container).toContain("setCalendarFocusDayKey(null)");
    expect(container).toContain("onNextDateFocused={setCalendarFocusDayKey}");
  });
});

// ─── FEATURE 6 — one shared, context-aware engine + Court ↔ Vox sync ─────

describe("Shared intelligence layer + Court ↔ Vox sync (FEATURE 6 — source contract)", () => {
  const backend = readSrc("convex/voiceCapture.ts");
  const service = readSrc("src/services/voice/voiceCaptureService.ts");
  const container = readSrc("src/components/aloa/AloaCourtMode.tsx");
  const vox = readSrc("src/components/quickcapture/QuickCaptureView.tsx");

  it("the backend engine is context-aware (one engine, many surfaces)", () => {
    expect(backend).toContain("ENDORSEMENT_CONTEXT_NOTES");
    expect(backend).toContain('"court_hearing"');
    expect(backend).toContain('"client_consultation"');
    expect(backend).toContain('"process_drafting"');
    expect(backend).toContain("context: v.optional(v.string())");
  });

  it("the client service passes the context through", () => {
    expect(service).toContain("context?: string");
  });

  it("a dictated-and-saved Court Mode endorsement links its capture to the matter", () => {
    expect(container).toContain("linkCaptureToMatter");
    expect(container).toContain("linkCapture({ clientLocalId, matterId })");
  });

  it("Vox → Recent voice notes shows the linked matter tag on the row", () => {
    expect(vox).toContain("linkedMatter");
    expect(vox).toContain("linkedMatter.title");
  });
});

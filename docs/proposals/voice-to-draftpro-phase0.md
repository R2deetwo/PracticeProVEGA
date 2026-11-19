# Phase 0 Diagnostic — Quick Capture → DraftPro Litigation Drafting Pipeline

Read-only audit of `origin/main` @ 26883ca2. No feature code was written for this report.
Spec: `vega-voice-to-draftpro-spec.md` (uploaded 2026-11-19).

## 1. Quick Capture: the "create_draft" intent

There is no literal `create_draft` intent. The feature is **`draftKickoff`** — a workspace
proposal that rides along with the triage intent (`case_note | schedule | question | share`):

- Interface `DraftKickoffProposal` — `convex/voiceCapture.ts:607-614`
  (`documentType: string` free text ≤120 chars, `recipient`, `keyFigures`, `noticePeriod`,
  `brief` ≤12,000 chars of free-form LLM prose).
- Extraction rule #14 in `buildAnalysisPrompt` — `convex/voiceCapture.ts:437`.
- Validation: `validateWorkspaceProposals` — `convex/voiceCapture.ts:725-740` (string caps only).
- **Accept handler is client-only**: `applyDraftKickoff` — `src/components/quickcapture/TriageCard.tsx:571-597`
  writes ONE `documents` row (`title`=`documentType — recipient`, `content`=`brief`,
  `summary`=`keyFigures`, `source`="Voice Draft", `matterId`=card's dropdown selection) via
  DataContext → `api.myFunctions.createItem`. DraftPro is never opened; no template/skeleton is
  selected; `linkCapture` is not called (the capture row has no `documentId` link field).
- Intent routing: `finalizeCapture` action (`convex/voiceCapture.ts:1177`, analysis call at
  1322-1340, `maxTokens: 4096`) → `triageMeta.proposals` → `useQuickCapture` 'ready' event →
  `TriageCard` renders one card per proposal kind (stack at `TriageCard.tsx:875-1254`;
  draft kickoff card at 1062-1111).
- **ALOA Quick Ask does NOT share the extractor.** It uses `QUICK_ASK_SYSTEM_PROMPT`
  (`voiceCapture.ts:1728`, handler 1799-1988) with only two validated actions
  (`create_event`, `save_note` — `validateQuickAskActions` at 539-577 whitelists exactly these).

## 2. Data models vs Section 4 requirements — gap table

| Required field | Exists? | Where | Notes |
|---|---|---|---|
| Matter.court name | yes | `convex/schema.ts:233` (`matters.court`) | free text, not linked to `institutions` |
| Matter.division | yes | `schema.ts:234` | free text |
| Matter.location (HOLDEN AT city) | **no** | — | prompt city comes from firm-level default today |
| Matter.caseNumber (suit/appeal/motion) | partial | `matters.suitNumber` (228) | suit only; appeal/motion ride in the same string or `originatingProcess` (261) |
| Matter.parties + capacity | partial | `matters.parties` any[] (275); client shape `LitigationParty` `src/types.ts:398` (`role`, `capacity?`, `isRepresentative?`) | no separate table; ordinals implicit by array order; no addresses |
| Matter.case notes | partial | `matters.attorneyNotes` (256) + `notePages` (675-713, matterId, type incl. 'endorsement') | two stores |
| Matter.endorsements | partial | `notePages.type='endorsement'`; structured fields only in `voiceCaptures.triageMeta` | flattened to text on save |
| Firm.counselName | partial | `users.name` (110) | no per-matter counsel-of-record |
| Firm.enrollmentNumber | partial | `users.barNumber` (114) | **no capture UI** (UserForm hardcodes 'N/A') |
| Firm.firmName / firmAddress | yes | `firms.name` (27), `firms.address` (28) | — |
| Firm.firmEmail / firmPhone | **no** | — | no fields on `firms` |
| Property.tenancy type/period | partial | `properties.rentalDetails` (939; `rentFrequency`, `tenancyPeriod`, `leaseStart/End` at `src/types.ts:324-358`), `tenancies` (1007-1061: `startDate`, `endDate`, `paymentFrequency`, `rentAmount`, arrears 1048-1050) | no explicit fixed-vs-periodic field |
| Property.landlord/tenant | partial | `landlordId/tenantId/currentTenantId` (927-929) ids → contacts; tenant snapshot on tenancy | no landlord snapshot |

`schemaValidation: false` (`schema.ts:3402-3407`) — additive optional fields persist safely.

## 3. DraftPro: current generation

- **Entry**: `WordProcessor.tsx` (carriers) → `DraftProEditor.tsx` (TipTap v3, 4,296 lines).
  Entrypoints: Documents "DraftPro β" button, ALOA `start_drafting` tool, Matter detail,
  Smart Matter wizard, Research, ProceduralComplianceReport.
- **Generation**: client-side `geminiService.streamDraft` — `src/services/geminiService.ts:975-1180`,
  system instruction at 1038-1069 (ALOA protocol + `DRAFTPRO_HTML_FORMATTING_RULES` +
  `DRAFT_QUALITY_BAR` + jurisdiction block from firm state, **not** the matter's court).
  **The LLM writes the entire document as streamed HTML. No template mechanism, no AST,
  no JSON intermediate.** Regeneration ("Redraft") rewrites the whole document.
- **Skeletons are prompt-level only**: `LITIGATION_SKELETONS` (8 keys) injected as instruction
  text (`src/constants/aloaPrompts.ts:9-27,142`). `TemplateService` has 4 string builders.
- **Storage**: `documents.content` = HTML (`schema.ts:386`); drafts-in-flight in localStorage
  (`src/utils/draftSession.ts`). No `documentType` field on `documents`.
- **Export**: DOCX = hand-rolled OOXML via JSZip (`src/utils/docxExport.ts:421-583`, Times New
  Roman 12pt, A4/25mm from `pageFormat.ts`); PDF = browser print engine (`PAGE_CSS_PRINT`).
  Both read `editor.getHTML()` at click time. Placeholder preflight already blocks print on
  unfilled placeholders.
- **`convex/drafting.ts` is a deletion stub** — a Convex-side generation entry point is greenfield.

## 4. Existing documentType values

No canonical registry. Seven disjoint vocabularies: (a) `LITIGATION_SKELETONS` keys (8),
(b) compliance-gate `originatingProcess` enum (4), (c) TemplateService substring matches (4),
(d) firm template library display names (~28), (e) voice `draftKickoff.documentType` free string,
(f) legal-KB `"judgment"|"instrument"|"index"`, (g) draft-session localStorage tokens.

## 5. Voice recorder reuse

`src/services/voice/micStream.ts` (shared mic singleton), `audioRecorder.ts` (`VoiceRecorder`,
segmented), `audioQueue.ts` (offline sync), `transcribeBatch` action (`voiceCapture.ts:1691`)
— all standalone, already reused by NoteEditor. **DraftProEditor has zero voice wiring today.**
Quick Capture draft tiers: `draftText`/`draftSource` held by parent `QuickCaptureView`;
`formattedTierText` = `triageMeta.caseNoteText || smartCleanText || verbatimText`.

## 6. Test setup

Vitest 4, node env, `tests/unit/*.test.ts` (154 files), no fixtures dir. **Pure-import
pattern**: tests import exported pure helpers from `convex/*.ts` (no `vi.mock` of Convex).
CI gate (`tests.yml:57-91`): `npx tsc -p convex --noEmit` → `npx tsc --noEmit` →
`python3 scripts/audit-identity.py` → `node scripts/check-design-tokens.mjs` →
`node scripts/check-ui-primitives.mjs` → `npx vitest run`. Both tsconfigs are `strict`.
Design ratchets: raw form elements 2218 (never grow), gray 0, rounded-xl ≤74, text-[Npx] ≤72,
z-[NNNN] 0, animate-pulse ≤80. New UI must use `src/components/ui/` primitives.

## 7. Root-cause confirmation

**Hypothesis CONFIRMED.** Evidence: `geminiService.streamDraft` (975-1180) issues
"TASK: Write a perfectly formatted, authoritative legal document" and streams
whole-document HTML into TipTap (`DraftProEditor.tsx:1218-1258`); the only structural
control is instruction text (`LITIGATION_SKELETON_INSTRUCTION` at `aloaPrompts.ts:142`,
`DRAFT_QUALITY_BAR` 384-428) — nothing enforces caption order, notice clauses, jurat or
franking blocks deterministically. The voice pipeline compounds it: `applyDraftKickoff`
dumps the LLM `brief` prose directly into `documents.content` without any template or
DraftPro handoff.

## PLAN (files, in order)

1. `src/legal/drafting/types.ts` — spec types verbatim (DocumentCategory, DocumentType,
   PartyCapacity, ConfidenceSource, FieldValue, DictatedContent, MissingField,
   DraftBlueprint, HydratedDraftContext, Block, Slot, DocumentAST, DraftBundle).
2. `src/legal/drafting/documentTypes.ts` — single DocumentType enum (53 values from
   Section 5c), category map, bundle dependency-order table, deterministic alias map.
3. `src/legal/drafting/blueprint.ts` — `validateDraftBlueprint`, reject+retry+fallback,
   `resolveSelfCorrections`, alias-first document-type resolution, bundle ordering,
   minimal-blueprint fallback preserving transcript.
4. `convex/voiceCapture.ts` — replace `draftKickoff` extraction with `draftBlueprint`
   (schema-shaped JSON), validator + one retry + fallback; matter-match gate at 0.85 with
   alternatives; missing fields NOT asked of the LLM.
5. `src/services/voice/voiceCaptureService.ts` — mirror types.
6. `src/components/quickcapture/TriageCard.tsx` — Drafting Blueprint card (types in order,
   linked matter / Link action, first 3 reliefs expandable, missing-field count,
   "Generate & Open in DraftPro →" CTA, Edit blueprint, Discard).
7. `src/legal/drafting/jurisdictionProfiles.ts` — Lagos HC, Court of Appeal, Supreme Court
   populated; FCT/FHC/NICN/default stubs (DEFERRED full population).
8. `src/legal/drafting/hydrate.ts` — pure hydrator + party-capacity mapping with ordinals.
9. `src/legal/drafting/authorityLibrary.ts` + Convex `authorityLibrary` table (seeded empty)
   + CRUD/CSV-import path; unverified-citation replacement filter.
10. `src/legal/drafting/templates/` — registry + family builders covering all 53 types;
    `validateAST` per category; affidavit prose-slot validator; notice-period computation.
11. `src/legal/drafting/assemble.ts` — blueprint+ctx → DraftBundle; per-document batched
    prose-slot LLM fill (strict JSON, validated); exhibit auto-numbering across bundles;
    `computeMissingFields` in code.
12. `src/legal/drafting/astToHtml.ts` — single AST→HTML renderer (court styling, placeholder
    pills, banner excluded).
13. `src/services/geminiService.ts` — `fillProseSlots` + `draftVoiceEdit` client calls;
    `convex/voiceCapture.ts` — `draftVoiceEdit` action.
14. `src/components/documents/tiptap/DraftProEditor.tsx` + `WordProcessor.tsx` — bundle
    carrier, tabs, placeholder navigation/fill/save-to-profile, counsel-review banner
    (non-printing), AST-first export, toolbar mic (Edit Selection by Voice with
    refuse-rules for structural/hydrated blocks), undo stack.
15. `convex/schema.ts` — additive: `documents.documentType`, `authorityLibrary` table,
    `voiceCaptures.triageMeta` already carries the blueprint (no new link field needed —
    DEFERRED documentId link).
16. Tests under `tests/unit/drafting/` (+ updates to `voiceCapture.test.ts`).

## RISKS

- **DraftProEditor is 4,296 lines** — integration must be surgical (new props + isolated
  blocks) to avoid destabilizing the existing free-form drafting path (non-bundle drafts
  keep working identically).
- **Design-token ratchets** — all new UI uses `ui/` primitives, `rounded-lg`/`rounded-2xl`,
  no `gray-*`; the routing ratchet (`scripts/draftpro-routing-check.ts`) governs how the
  editor is opened (new tab on desktop).
- **LLM JSON contract change** (`draftKickoff` → `draftBlueprint`) ships client + convex in
  one atomic commit; tests pinned to the new contract.
- **53 templates** is wide; family builders + snapshot tests keep each type's mandatory
  blocks enforced without 53 bespoke files.

## DECISIONS

- D1 Module home: `src/legal/drafting/` (pure, zero-React) — importable by client AND
  Convex (precedent: `convex/voiceCapture.ts:49` imports `../src/services/voice/draftUtils`).
- D2 Replace `draftKickoff` with `draftBlueprint` in the analysis JSON (our own contract,
  atomic deploy, tests updated). Legacy field not kept — no external consumers.
- D3 Rendering architecture: AST → HTML (one renderer, `astToHtml.ts`) → TipTap editor,
  DOCX (existing OOXML pipeline) and PDF (existing print engine). Programmatic edits
  (placeholder fill, voice edit) mutate the AST then re-render; the AST renderer is the
  only generation path.
- D4 Hydration is a pure client-side function over records already in DataContext — no new
  Convex round-trips; Convex is used only for LLM actions and the authority library.
- D5 "brief" alias maps to `appellants_brief` (Nigerian appellate usage; trial-side "brief"
  resolves to `final_written_address` via its own aliases).
- D6 Prose slots are batched per document into one strict-JSON LLM call, then validated
  individually (court furniture, markdown headers, unverified citations, affidavit
  argumentation are rejected/scrubbed).
- D7 Missing fields computed in code (template requiredFields diff) — never requested from
  the LLM (grep-verifiable).
- D8 Jurisdiction profiles ship Lagos HC / CA / SC populated with `verifyBy: "counsel"` and
  empty `lastReviewed`; FCT/FHC/NICN ship as stubs (DEFERRED).
- D9 `documents.documentType` added (additive optional); bundle JSON travels in the draft
  session + document metadata.
- D10 Quick Ask keeps its two-action vocabulary (it does not share the extractor; the
  blueprint flows through Quick Capture — spec's "if it shares it" clause is N/A).

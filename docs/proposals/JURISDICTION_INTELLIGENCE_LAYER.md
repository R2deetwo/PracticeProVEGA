# VEGA: Jurisdiction Intelligence Layer (ALOA X + DraftPro + ALDIA)

**Date:** 2026-11-20 · **Status:** Approved basis document — Phase 0 diagnostic complete (see
`docs/proposals/jurisdiction-intelligence-phase0.md`); feature build starts at Slice 0 (Appendix B).
**Extends:** `docs/proposals/AGENTIC_ENGINE_GAP_ANALYSIS.md` (Pillar 1 formalized and scaled).
**Consumers:** DraftPro (draft-time gates), ALOA (chat + voice triage), ALDIA (`AdvancedLegalDocumentIntelligenceAgent` — document review), Matter intake.

> **How to read this document.** Sections 0–10 + Appendix A are the owner's spec, preserved.
> Additions made after the Phase 0 diagnostic are marked **[ADD]** and are grounded in the
> codebase map (file paths + line refs in the Phase 0 report). Appendix B is the
> anti-overcomplication build order; Appendix C is the additions changelog.

---

## 0. Operating Rules

1. **Phased, diagnostic before build.** Complete Phase 0 and report before writing feature code. *(Done — 2026-11-20.)*
2. **No silent omissions.** Anything not built goes in a `DEFERRED` block: item, reason, unblock condition.
3. **No self-certification.** Every acceptance criterion needs pasted evidence (grep output, literal diffs, before/after test output). No evidence = FAIL.
4. **Decide, don't ask.** Where silent, choose the conventional option, log it in `DECISIONS` (decision, alternatives rejected, reason), continue.
5. **The model's memory is never a source of law.** Every legal proposition, rule, threshold, period or citation the system outputs must trace to an ingested source record or be explicitly marked `UNVERIFIED`. This is the central design constraint.

---

## 1. Objective and Design Principle

DraftPro must never produce a document with a jurisdiction defect, and must detect such defects in documents it did not draft (uploaded pleadings, opponent's processes, prior drafts). ALOA X ingests judgments, rules, statutes and practice directions and continuously improves the system's legal knowledge.

**Principle: "intelligence" = governed knowledge + deterministic rules + LLM reasoning over retrieved authority + verification gates + human approval. It is not fine-tuning and not prompt text.**

```
ALOA X ingest -> Source Store -> Extraction (LLM, proposals only)
  -> Human Review Queue -> Approved Rule/Authority Store (versioned, effective-dated)
  -> Jurisdiction Engine (deterministic rules + retrieval + LLM analysis, must cite)
  -> Consumers: DraftPro (draft-time gates), Document Reviewer (ALDIA lint), Matter intake, Voice pipeline
  -> Evals + feedback loop (corrections become test cases)
```

Nothing extracted by an LLM becomes an active rule without lawyer approval. Active rules drive behaviour; unapproved extractions are shown only as "candidate, unverified".

**[ADD] Grounding note.** The deterministic core this principle demands already exists as the
"ALOA LEGAL ENGINE (Pillar 1)" — `src/legal/jurisdictionMatrix.ts` (DMN-style forum routing),
`src/legal/limitationEngine.ts` (limitation + SAFE_STOP), `src/legal/frontloadingGate.ts`,
`src/legal/signatureCompliance.ts`, orchestrated by `src/legal/complianceGate.ts` (pure, cited,
exposed to ALOA as the `run_legal_compliance_check` tool), plus the citation honesty stack
(`src/legal/citations/lePhantomCite.ts`, `verificationHarness.ts`). This spec does not replace
that core — it **promotes the hardcoded tables inside it into a governed, effective-dated rule
store** and wraps the retrieval + reasoning + verification passes around it.

---

## 2. Jurisdiction Issue Taxonomy (the "unknown unknowns" checklist)

Implement as an enum plus a per-issue checker interface. This is the minimum coverage; each class is a checker module.

**[ADD] Column "Seed today"** = what already exists in code (Phase 0 evidence in the companion report). This is the migration backlog for Phase 1/2: every PARTIAL/BUILT item is migrated into rules with `sourceRefs`, not left in code.

| ID | Issue class | What must be determined | Seed today |
|---|---|---|---|
| J1 | Subject-matter jurisdiction | Which court class has authority over the cause of action (e.g. federal vs state high court vs National Industrial Court vs magistrate/district/customary/sharia courts, tribunals, statutory exclusive jurisdictions) | **BUILT** — `jurisdictionMatrix.ts` (3 forums × 22 subjects, CFRN citations, NEEDS_REVIEW default). Migrate rows → rules. |
| J2 | Exclusive vs concurrent jurisdiction | Whether more than one court may entertain the claim; effect on forum choice and objection risk | PARTIAL — matrix tags results `EXCLUSIVE \| RESIDUAL_DEFAULT`; no concurrent-venue rules. |
| J3 | Territorial jurisdiction / venue | Judicial division/state/FCT; where cause of action arose; where defendant resides; where land is situated; transfer rules | PARTIAL — `jurisdictionConfig.ts` divisions registry + venue prose; `matters.judicialDivision` free text; no rules. |
| J4 | Pecuniary jurisdiction | Monetary ceilings for lower courts; small-claims tracks | PARTIAL — advisory text only (`defenseUtils.tsx` magistrate ceiling note). |
| J5 | Originating process fit | Writ vs originating summons vs petition vs originating motion (incl. FREP) as required by the court's rules and the nature of the claim | PARTIAL — 52-type registry (`documentTypes.ts`) + `matters.originatingProcess`; no fit rules. |
| J6 | Limitation and time bars | Statutory limitation periods, special short periods for public officers/bodies, accrual date, tolling; appeal time limits | **BUILT** — `limitationEngine.ts` (Lagos + federal POPA only, SAFE_STOP). Migrate + extend per state as counsel approves rows. |
| J7 | Pre-action conditions | Mandatory notices, ADR/pre-action counselling, demand requirements, pre-action notices against public bodies, conditions precedent in contracts/arbitration clauses | PARTIAL — `frontloadingGate.ts` (bundle completeness), pre-action items as prose in `proceduralRules.ts` / `practiceProfileLibrary.ts`. |
| J8 | Parties, capacity and standing | Locus standi, juristic personality, proper/necessary parties, misjoinder/non-joinder, representative actions, capacity (estate, minor, company, government agency, Attorney-General as party), correct party description | PARTIAL — capacity label maps in `hydrate.ts` (drafting labels only, no standing rules). |
| J9 | Service | Service within state, outside state (inter-state process rules), outside Nigeria, on government/corporations; effect on validity | ABSENT. |
| J10 | Appellate jurisdiction and procedure | Which appellate court; right of appeal vs leave; interlocutory vs final; time limits; competent grounds; Supreme Court direct-appeal categories | PARTIAL — appeal windows exist only as unverified prose (`jurisdictionConfig.ts`, `practiceProfileLibrary.ts`). |
| J11 | Arbitration and ouster | Arbitration agreements, stay applications, statutory ouster clauses, exhaustion of internal remedies | PARTIAL — `contractAnalysis.ts` detects arbitration clauses; no stay/ouster rules. |
| J12 | Specialised regimes | Election petitions, fundamental rights (concurrent), admiralty, tax, banking/securities, intellectual property, company/insolvency, land, labour/industrial, tenancy/recovery of premises, probate, matrimonial, customary/sharia personal law, constitutional questions | PARTIAL — matrix subject rows + tribunal analyses in `jurisdictionConfig.ts` (prose). |
| J13 | Applicable law and temporal effect | Which version of statute/rules applies as at accrual, filing and judgment; repealed/amended provisions; transitional provisions; practice directions | ABSENT — no effective-dating anywhere in the system today. **Largest structural gap; Phase 1 exists to fix it.** |
| J14 | Court-specific formalities | Heading form, process numbering, filing requirements, front-loading, fees, e-filing, document bundle requirements that vary by court | PARTIAL — `frontloadingGate.ts`, `signatureCompliance.ts`, `court_forms` corpus (fees/fields per institution). |
| J15 | Relief competence | Whether a relief sought is within the court's powers (e.g. declaratory, injunctive, specific performance, constitutional relief, orders against particular parties) | PARTIAL — relief skeletons in `litigationSkeletons.ts` (hardcoded). |
| J16 | Enforcement jurisdiction | Where and how a judgment can be enforced; registration for enforcement in other states; garnishee against government funds; execution restrictions | ABSENT (garnishee *drafting* exists; enforcement-jurisdiction *rules* do not). |

Each checker returns the `JurisdictionFinding` shape in Section 4/5. A new issue class can be added by registering a checker; the taxonomy is data, not hard-coded branching.

**[ADD] Registry constant.** Ship `ISSUE_CLASSES` as a typed registry (id, title, checker id,
needsInfoFields) in `src/legal/jurisdiction/issueClasses.ts`. The coverage map (Phase 4),
eval harness (Phase 5) and gate UI all read this one constant — adding J17 is a data change.

---

## 3. PHASE 0: Diagnostic (read-only)

1. **ALOA X:** ingestion pipeline end to end: accepted formats, parsers, OCR, chunking, embedding model, vector/search store, metadata captured (court, date, citation, parties, judge, statute section), deduplication, how Quick Ask/other features query it. Output a gap table versus the Source Store fields in Section 4.
2. Existing legal data models: Matter, Court, Party, Statute/Rule/Case tables (if any), any existing jurisdiction logic, hardcoded court lists or rule text anywhere in prompts or code (`grep` for court names, "High Court", "Order ", "Section ", limitation periods).
3. DraftPro: where court/jurisdiction text is generated today; templates; prompts.
4. Retrieval quality: run 10 representative jurisdiction questions through the current ALOA X retrieval and paste what comes back (source, rank, whether the right authority surfaced). This establishes a baseline.
5. Where citations are currently produced and whether they are verified against ingested sources.
6. Test/eval infrastructure.

End with `PLAN`, `RISKS`, `DECISIONS`. Proceed to Phase 1 unless a risk is destructive.

**[ADD] Status:** completed 2026-11-20 → `docs/proposals/jurisdiction-intelligence-phase0.md`.
Item 4 (live 10-question retrieval baseline) is DEFERRED with evidence and a ready-to-run
protocol (see the report's DEFERRED block) because the operator token is not configured on any
reachable deployment; the ingester's offline selftest (22/22 checks) and the RRF/chunking unit
suites stand in as mechanics evidence.

---

## 4. PHASE 1: Source Store, Authority Graph, Rule Store

### 4a. Source and authority records (typed)

```ts
export type SourceKind =
  | "constitution" | "statute" | "subsidiary_legislation" | "court_rules"
  | "practice_direction" | "judgment" | "textbook_or_commentary" | "gazette" | "other";

export type LegalStatus =
  | "in_force" | "amended" | "repealed" | "superseded" | "overruled"
  | "distinguished" | "unknown";

export interface SourceDoc {
  id: string;
  kind: SourceKind;
  title: string;
  citation: string | null;               // e.g. neutral/law-report citation as published
  jurisdictionScope: JurisdictionScope;  // federal | state:<name> | fct | court:<name>
  court: string | null;                  // for judgments and court rules
  decisionDate: string | null;           // ISO, judgments
  enactmentDate: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;            // null = still operative as far as known
  status: LegalStatus;
  statusSourceIds: string[];             // what established the status (amending act, overruling case)
  rawFileRef: string;
  textHash: string;
  ingestedAt: string;
  ingestedBy: string;
  reviewStatus: "unreviewed" | "approved" | "rejected";
}

export interface SourceChunk {
  id: string; sourceId: string;
  locator: string;                       // "s.251(1)(p)", "Order 43 r.1", "para 14 of judgment"
  text: string;
  embedding?: number[];
}

export interface AuthorityEdge {         // the citator graph
  fromSourceId: string; toSourceId: string;
  relation: "applies" | "follows" | "distinguishes" | "overrules" | "amends" | "repeals" | "interprets" | "cites";
  establishedBy: "extracted_llm" | "human";
  confirmed: boolean;
}
```

Hierarchy awareness is mandatory: constitution > statute > subsidiary legislation/rules > practice directions; and for cases, Supreme Court > Court of Appeal > High Court, with binding vs persuasive tracked by court hierarchy and by whether the court's jurisdiction scope matches the matter's.

**[ADD] 4a.1 Implementation mapping — extend, do not duplicate.** Three legal-source systems
already exist (autonomous `legal_*` crawl tables; founder-curated `instruments` /
`instrument_provisions` / `court_forms`; client-side ALOA-X indexer). We do NOT create a fifth
store. Mapping:

| Spec type | Implementation | Change |
|---|---|---|
| `SourceDoc` | `legal_judgments` + `legal_instruments` (`convex/legal/schema.ts:118,157`), unified behind a `getSourceDoc(id)` resolver in a new `convex/legal/sourceStore.ts` | ADD optional fields: `kind` (full enum), `jurisdictionScope`, `citation` (instruments lack it), `title` (judgments lack it), `enactmentDate`, `effectiveFrom`, `effectiveTo`, `statusSourceIds`, `textHash` (sha256 of normalized extracted text), `ingestedBy`, `reviewStatus`. All optional → additive, no destructive push. |
| `SourceChunk` | `legal_chunks` (exists; `boundaryPath` = locator, search index + 768-dim vector index already present) | No structural change; sanitize text at write (Section 9). |
| `AuthorityEdge` | NEW table `legal_authority_edges` | Seed from `legal_judgments.casesCited[].treatment]` (already captured with applies/distinguishes/overrules… tags) as `establishedBy: "extracted_llm", confirmed: false`. |
| `JurisdictionScope` | Reuse the curated corpus's `jurisdictionKey` convention (`institutions.jurisdictionKey`, `JURISDICTION_REGISTRY` keys — 37 states + FCT + federal) | One canonical key set, referenced by rules, chunks and matters. |
| Curated layer | `instruments` / `instrument_provisions` / `court_forms` stay as the *founder-curated* view; a source doc row may reference its curated counterpart | No change; both layers expose the `SourceDoc` resolver interface. |

**[ADD] 4a.2 Backfill.** A one-shot `backfillSourceFields` internal mutation stamps
`kind`/`jurisdictionScope`/`reviewStatus:"unreviewed"` on existing rows (heuristics: issuing
body → scope; instrumentType → kind), and sets `status: "unknown"` where the current
always-`"in_force"` default cannot be justified. Never silently mark an unverified doc
`in_force`.

### 4b. Declarative rules (the deterministic layer)

Anything that can be a rule must be a rule, not LLM judgment.

```ts
export interface JurisdictionRule {
  id: string;
  issueClass: "J1"|"J2"|"J3"|"J4"|"J5"|"J6"|"J7"|"J8"|"J9"|"J10"|"J11"|"J12"|"J13"|"J14"|"J15"|"J16";
  title: string;
  appliesWhen: Condition;                // over MatterFacts, see Section 5
  effect:
    | { type: "requires"; requirement: string }
    | { type: "forbids"; prohibition: string }
    | { type: "assigns_forum"; courts: string[]; exclusivity: "exclusive" | "concurrent" }
    | { type: "computes_period"; periodSpec: PeriodSpec }
    | { type: "threshold"; field: string; operator: "<="|">="|"<"|">"; value: number; unit: string };
  severity: "blocking" | "warning" | "advisory";
  sourceRefs: Array<{ sourceId: string; locator: string }>;   // REQUIRED, non-empty
  effectiveFrom: string | null;
  effectiveTo: string | null;
  jurisdictionScope: JurisdictionScope;
  approvedBy: string | null;             // lawyer id; null = candidate, never active
  approvedAt: string | null;
  lastReviewedAt: string | null;
  confidence: "verified_by_counsel" | "extracted_unreviewed";
}
```

**Hard constraints:** a rule with empty `sourceRefs` is rejected by the database; a rule with `approvedBy === null` is never used by gates or reviewers except as a visibly labelled "candidate" hint; rules are effective-dated and queried by a `asAtDate`.

**[ADD] 4b.1 Convex constraint note (honest deviation).** Convex has no CHECK constraints.
AC1.2's "rejected by the database" is enforced as: (a) every write path is a single
`jurisdiction_rules` mutation that validates `sourceRefs.length > 0` and throws
`ConvexError("RULE_REQUIRES_SOURCE_REFS")`; (b) a CI unit test pins that the mutation rejects
an empty-refs rule and that no other writer exists (source-scan pattern already used by
`tests/unit/legalIngestionEngine.test.ts`).

**[ADD] 4b.2 Rule identity & versioning.** Rule edits never mutate history: approving an edit
creates a new row with `supersedesRuleId` pointing at the old one, which is flipped
`effectiveTo = now`. The audit trail (Section 9) records old→new. This keeps
"which rule version gated this export" answerable forever.

### 4c. Seeding

Do **not** hard-code legal content from the model's own knowledge. Provide a seeding mechanism: CSV/JSON import of rules, and a guided "create rule from source passage" UI (select chunk -> draft rule from it -> lawyer approves). Seed the **taxonomy** (Section 2) and **empty rule slots** per jurisdiction scope so gaps are visible (see coverage map, Phase 4).

**[ADD] 4c.1 Migration inventory (the de-hardcoding backlog).** These existing files bake legal
propositions into code/prompts and are migrated into `jurisdiction_rules` with `sourceRefs`
filled by counsel during review (Phase 1 delivers the store + migration tooling; the *content*
moves only as counsel approves each row — Operating Rule 5):

| File | Content to migrate |
|---|---|
| `src/legal/jurisdictionMatrix.ts:78-103` | 22 routing rows (forum + CFRN citation + keywords) → J1/J2 rules |
| `src/legal/limitationEngine.ts:60-91` | Lagos 6/6/12/12-yr + federal POPA 3-month table → J6 rules |
| `src/legal/drafting/jurisdictionProfiles.ts` | Court captions, enabling rules (e.g. `:39` "Order 29 … Rules 2019", `:47` garnishee, `:60` tenancy notice), notice-period table `:49-58` → J7/J14/J3 rules + template data |
| `src/utils/proceduralRules.ts` | Per-court deadlines/requirements → J7/J10/J14 rules |
| `src/utils/statuteLibrary.ts:63-106` | Statutory audit entries (CAMA, Labour Act, FCCPA, Lagos Tenancy) → J12/J7 rules |
| `src/utils/contractAnalysis.ts` | Nigerian standard-clause statutory refs → J11/J12 rules (analysis templates, not behaviour) |
| `src/utils/defenseUtils.tsx` | Jurisdiction/capacity heuristics incl. magistrate ceiling → J4/J8 candidate rules |
| `src/config/practiceProfileLibrary.ts` | Task blueprints citing POPA 3 months, appeal windows, FREP windows → J6/J7/J10 rules |
| `src/constants/aloaPrompts.ts:349-362` | The 36-state tenancy-law list in prompt text → removed from the prompt; replaced by rule-store retrieval output |
| `src/utils/jurisdictionConfig.ts` | `JURISDICTION_REGISTRY` stays as *presentation* registry (captions/divisions); tribunal + subject-matter analyses (`:976-1017`, `:1041-1142`) migrate to rules |

Until a file's rows are migrated and approved, that file keeps working (engines read the
bundled snapshot, 5c.9) — migration is row-by-row, never big-bang. AC1.5 completes only when
the last file in this table is empty of live legal propositions.

**Acceptance criteria (Phase 1):**
- AC1.1 Migrations create the tables above; paste schema and `tsc --noEmit` output.
- AC1.2 DB constraint test: inserting a `JurisdictionRule` with empty `sourceRefs` fails (output pasted). *(Per 4b.1: mutation-level rejection + CI pin.)*
- AC1.3 Query test: `getActiveRules({scope, issueClass, asAtDate})` excludes unapproved, repealed and not-yet-effective rules (three fixtures, output pasted).
- AC1.4 Authority edge test: an `overrules` edge flips the target's status to `overruled` only after human confirmation.
- AC1.5 `grep -rn` evidence that no court-rule text or limitation period remains hard-coded in prompts or templates outside the rule store.

### [ADD] 4d. Reuse map — what the engine is built FROM

| Spec component | Existing asset to reuse | Evidence |
|---|---|---|
| Retrieval pass | `legal/search.ts hybridSearch` (RRF fusion of BM25 + 768-dim vector legs, scope/status filtering to be added) — **currently zero product consumers; this engine becomes its first** | `LEGAL_KB.md:284` "the seam is ready" |
| Verifier pass | `src/legal/citations/verificationHarness.ts` `CorpusBackend` interface + `lePhantomCite.auditCitation` — implement `SourceStoreCorpus` over `legal_judgments`/`legal_instruments`; flips `verify_citation` from UNVERIFIABLE to real verification when the authority is ingested | `verificationHarness.ts:34-42`; wired with `null` backend at `AloaChat.tsx:1099-1107` |
| Deterministic pass host | `src/legal/complianceGate.ts` (pure, cited, already an ALOA tool) — evaluates rules from the snapshot instead of hardcoded imports | `complianceGate.ts:73` |
| Human review pattern | `instrument_changes` pending_review → confirmed/dismissed flow + `seedLegalKnowledge` verification stamps | `convex/legalKnowledge.ts:307-385` |
| Founder control surface | `legal_engine_state` + Ingestion console (`src/admin/views/IngestionEngine.tsx`) hosts the Review Queue tab | `convex/legal/engine.ts` |
| Embeddings | The existing client-side 768-dim Gemini path (pattern `writeLegalEmbeddings`) — chunks get embedded at **approval time**, so the dense leg works without the Python CLI | `convex/legalKnowledge.ts:265-300` |
| Dead code to retire | `src/agents/NigerianLegalJurisdictionAgent.ts` (generative jurisdiction, zero callers) — delete when J1 engine lands | `useMatters.ts:423-424` |

---

## 5. PHASE 2: Jurisdiction Engine

### 5a. Inputs

```ts
export interface MatterFacts {
  claimTypes: string[];                  // controlled vocabulary mapped to J12 regimes
  causeOfActionAccruedOn: string | null;
  causeOfActionLocation: { state?: string; division?: string; fct?: boolean } | null;
  partiesDetail: Array<{
    name: string; capacity: string;
    entityType: "individual" | "company" | "partnership" | "federal_agency" | "state_agency" | "local_government" | "public_officer" | "estate" | "minor" | "other";
    residence?: { state?: string; country?: string };
  }>;
  subjectProperty?: { state?: string; division?: string; landType?: string };
  amountClaimed: Array<{ amount: number; currency: string }>;
  reliefsSought: string[];
  contractualClauses: Array<{ type: "arbitration" | "jurisdiction" | "governing_law" | "notice" | "other"; text: string }>;
  priorProceedings: Array<{ court: string; stage: string; decisionDate?: string }>;
  targetCourt: { name: string; division?: string } | null;
  intendedProcess: DocumentType | null;
  proceduralStage: "pre_action" | "commencement" | "pleadings" | "interlocutory" | "trial" | "judgment" | "appeal" | "enforcement";
  asAtDate: string;                      // date law is evaluated; default today, overridable
}
```

`MatterFacts` is built from the Matter record, voice blueprint and any uploaded documents. Missing facts that a rule needs are returned as `needsInfo`, never guessed.

**[ADD] 5a.1 Builder sources (concrete):**
1. **Matter record** → `matters` table (`type`, `court` free text → normalized to a `JurisdictionScope` + registry key via `JURISDICTION_REGISTRY`, `judicialDivision`, `parties` any[], `originatingProcess`, `subCategory`). Normalization is explicit and shown to the user for confirmation — free text is never silently trusted.
2. **Voice blueprint** → `voiceCaptures.triageMeta.proposals.draftBlueprint` (reliefs, groundsOrFacts, amounts, periods, dates, namedPeople — already schema-validated by `validateDraftBlueprint`).
3. **Uploaded documents** → ALDIA extraction (Section 6b) with per-fact location + confidence.
4. **Intake form** → new MatterFacts fields prompted at matter creation (Section 6c).

### 5b. Output

```ts
export interface JurisdictionFinding {
  id: string;
  issueClass: IssueClass;
  verdict: "ok" | "defect" | "risk" | "indeterminate";
  severity: "blocking" | "warning" | "advisory";
  summary: string;                       // one sentence
  reasoning: string;                     // short, tied to cited sources
  citations: Array<{ sourceId: string; locator: string; quotedText?: string }>;   // REQUIRED for verdict != "indeterminate"
  ruleIds: string[];                     // deterministic rules applied
  recommendedFix: null | { kind: "change_court" | "change_process" | "add_party" | "remove_party" | "change_relief" | "add_pre_action_step" | "refile_by" | "other"; detail: string; autoApplicable: boolean };
  needsInfo: string[];                   // facts required to decide
  confidence: "rule_based" | "retrieval_supported" | "model_inference";
  authorityStatusChecked: { asAt: string; allSourcesInForce: boolean };
}
```

### 5c. Evaluation pipeline (per issue class checker)

1. **Deterministic pass:** evaluate active rules against `MatterFacts` at `asAtDate`. Rule results are authoritative.
2. **Retrieval pass:** retrieve top-k chunks from the Source Store scoped by `jurisdictionScope`, `asAtDate` and `status` (exclude repealed/overruled unless the question is historical). Include the authority graph neighbours (what overrules/amends the hit).
3. **Reasoning pass (LLM):** receives `MatterFacts`, rule results and retrieved chunks. Must answer in the `JurisdictionFinding` schema, may cite only the provided `sourceId + locator`, and must output `indeterminate` rather than speculate when the sources do not settle the point.
4. **Verifier pass:** deterministic code checks every citation exists, locator exists in the chunk, `quotedText` appears verbatim in the chunk, source status is `in_force` as at date, and source scope matches the matter. Any failure downgrades the finding to `indeterminate` with a `verification_failed` note.
5. **Hierarchy/conflict check:** if retrieved authorities conflict, surface both, state which is higher or later, and mark `risk` rather than choosing silently.
6. **Abstention policy:** `indeterminate` is a valid, preferred output over a confident guess. The UI labels `model_inference` findings distinctly from `rule_based`.

**[ADD] 5c.7 Batched reasoning (cost/latency guard).** Do NOT make 16 LLM calls per matter.
Reasoning calls are batched by related classes — at most four: (a) forum block J1–J4;
(b) process & formalities J5/J14/J15; (c) time & pre-action J6/J7/J13; (d) parties, service,
appeal & regimes J8–J12/J16 — and only for classes triggered by the facts (a class with zero
rules and zero retrieval hits returns `indeterminate` deterministically, no call). Each batch
returns a findings array; a schema-parse failure retries once, then falls back to per-class
calls for that batch only.

**[ADD] 5c.8 J6 dual-date semantics.** Limitation is evaluated at BOTH `asAtDate =
causeOfActionAccruedOn` (which limitation law was in force when the right accrued) and
`asAtDate = today/filing`. The two computations and any divergence are surfaced together;
transitional/amendment provisions are a retrieval question, never an assumption. A divergence
is `risk`, not a silently chosen winner.

**[ADD] 5c.9 Offline-first rule snapshot.** The APK must work offline. Approved rules compile
into a versioned JSON snapshot (`ruleSnapshotVersion`) bundled at build time and refreshed on
sync; the deterministic pass evaluates the snapshot client-side exactly as
`complianceGate.ts` runs pure client-side today. The database remains the source of truth;
every gate output stamps the snapshot version used (Section 9). Candidate rules never enter
the snapshot.

**Acceptance criteria (Phase 2):**
- AC2.1 Test: fabricated citation returned by a mocked LLM is caught by the verifier and downgraded (output pasted).
- AC2.2 Test: repealed provision in retrieval results is excluded when `asAtDate` is after repeal and included for an earlier `asAtDate`.
- AC2.3 Test: missing `causeOfActionAccruedOn` yields `needsInfo`, not a limitation verdict.
- AC2.4 Test: rule-based verdict wins over a contradicting LLM verdict (mock).
- AC2.5 Test: two conflicting authorities produce a `risk` with both cited.
- AC2.6 One test per issue class J1-J16 with fixtures (list of classes vs. passing tests pasted); classes without active rules must return `indeterminate`, not `ok`.

---

## 6. PHASE 3: Consumers

### 6a. DraftPro draft-time gates
Run the engine **before** generation and again before export.

- **Pre-generation gate:** build `MatterFacts` from Matter + voice blueprint, run J1-J16 relevant to the `intendedProcess`. Blocking defects open a pre-draft panel: finding, citation, recommended fix, and actions *Apply fix* (e.g. switch court or process, add pre-action step), *Proceed anyway* (requires typed reason, logged), *Edit facts*. Warnings and advisories appear as non-blocking chips beside the draft.
- **Template integration:** court headings, enabling rules, parties/capacity labels and notice periods come from the engine/rule store, not prompt text (extends the earlier deterministic-template spec).
- **Pre-export gate:** re-run; unresolved blocking findings require acknowledgement; summary appended to an internal (non-exported) review log.
- **Voice pipeline:** Quick Capture blueprint triggers the gate; the triage card shows a jurisdiction status chip (OK / N warnings / blocking defect) before "Generate & Open".

**[ADD] 6a.1 Concrete integration points.** Gate insert: `src/services/draftProBlueprintService.ts`
between `hydrate()` and `fillProseSlots()` (so no LLM token is spent on a blocked draft).
Chips: `TriageCard.tsx` blueprint card (before "Generate & Open") and `DraftProEditor` header.
Proceed-anyway: typed reason → row in new `jurisdiction_overrides` audit table (matterId,
findingIds, ruleSnapshotVersion, reason, userId, ts). Template data: `jurisdictionProfiles.ts`
reads court/notice/rule values from the approved snapshot; the `rule()` helper keeps its
counsel-verify contract.

### 6b. Document Reviewer (lint any document)
Upload or paste a document (pleading, motion, opponent's process, a prior draft, a client's proposed contract with a jurisdiction clause):
1. Parse into structure: court heading, parties and capacities, process type, reliefs, enabling provisions cited, dates, amounts, jurisdiction/arbitration clauses.
2. Build `MatterFacts` from the document (every extracted fact tagged with its location in the document and an extraction confidence; low-confidence extractions are shown to the user to confirm before analysis).
3. Run the engine; output a review report: findings grouped by severity, each with an in-document highlight anchored to the offending text, citation, and fix.
4. Also check: **mismatch checks** (heading court vs process type vs reliefs vs enabling rule cited vs party capacities), **stale-law check** (cited provisions repealed/amended as at the document date), **limitation check** against dates in the document, **opponent-facing mode** that lists possible preliminary-objection grounds with strength rating and authority.

**[ADD] 6b.1 Host decision: ALDIA.** The Reviewer is a new mode of the existing
`src/agents/AdvancedLegalDocumentIntelligenceAgent.ts` ("ALDIA" — the single structured-call
document-intelligence orchestrator), surfaced in the DraftPro workspace beside
`ContractAnalyzer`. Extraction reuses ALDIA's PII-stripped single-call pattern extended to
emit `DocumentFacts` (per-fact location + confidence); low-confidence facts route to the
confirm-facts step (AC3.5). Opponent-facing mode is the same engine run with
`perspective: "opponent"` — preliminary-objection grounds are findings of class J1/J2/J3/J5/J7
with `recommendedFix.kind: "other"` phrased as objections.

### 6c. Matter intake
On creating a Matter, prompt for the `MatterFacts` fields the engine needs, run a "Forum & Limitation Snapshot" (likely court(s), process, limitation deadline with computed date, pre-action steps) and create calendar deadlines for limitation and appeal periods (extends existing diary if present; otherwise list as `DEFERRED`).

**[ADD] 6c.1 Deadline write path.** The diary EXISTS (`tasks` with `dueDate`/`matterId`/
`idempotencyKey`, `events` with `court`/`judicialDivision`) — nothing is deferred. The snapshot
writes a limitation task via an idempotent key (`limitation:<matterId>:<ruleId>`) and shows the
computed date in the MatterForm confirmation step. Nothing is written without the user seeing
the snapshot first.

**Acceptance criteria (Phase 3):**
- AC3.1 Fixture: a claim assigned to a court lacking jurisdiction by an active rule is blocked at pre-generation with citation and fix (screenshots or UI test output).
- AC3.2 *Proceed anyway* requires a reason and writes an audit record (DB row pasted).
- AC3.3 Reviewer fixture: a document with heading court inconsistent with process type yields an anchored finding.
- AC3.4 Reviewer fixture: a document citing a repealed provision flagged with the superseding source.
- AC3.5 Low-confidence extraction triggers the confirm-facts step before analysis.
- AC3.6 Limitation deadline computed from rule store and written to the diary/deadline list for a fixture matter.
- AC3.7 Exported document contains no jurisdiction review chatter.

---

## 7. PHASE 4: Continuous Learning Loop (ALOA X -> better rules)

1. **Ingest-time extraction:** on ingesting a statute, rules or practice direction, the system proposes `JurisdictionRule` candidates (with `sourceRefs` auto-filled, `confidence: extracted_unreviewed`). On ingesting a judgment, it proposes: (a) the jurisdictional holding with ratio vs obiter marked, (b) authority edges (follows/overrules/distinguishes), (c) status updates for affected sources. All go to the **Review Queue**.
2. **Review Queue UI:** side-by-side source passage and proposed rule/edge, actions Approve / Edit & approve / Reject (with reason). Batch by source. Show proposed status changes (e.g. "this amending Act appears to repeal s.X") with diff of effect on active rules.
3. **Impact analysis on approval:** when a rule or status changes, list affected open Matters and recent drafts ("3 open matters touched by this change") and notify counsel. Never silently alter existing documents.
4. **Change-feed watcher:** ingestion events for new practice directions, rule amendments and apex-court judgments trigger a notification to counsel with the proposed changes.
5. **Feedback to learning:** every user correction, dismissed finding, and "proceed anyway" outcome is recorded. Counsel can mark a finding *correct / incorrect / missing*. Each marked case becomes an **eval case** automatically.
6. **Coverage map:** a dashboard matrix `jurisdiction scope x issue class` showing count of approved rules, last review date, and ingested source count. Empty or stale cells are shown as gaps; engine behaviour in a gap cell is `indeterminate` plus a prompt to ingest sources. This is how you see "what you don't know you don't know".
7. **Staleness:** rules carry `lastReviewedAt`; rules unreviewed past a configurable interval (default 12 months) show as stale warnings.

**[ADD] 7.1 Build-on-existing notes.** Review Queue lives in the founder app Ingestion console
(`src/admin/views/IngestionEngine.tsx`) as a new tab, reusing the `instrument_changes`
pending→confirmed interaction pattern. Change-feed notifications ride the ALOX watchdog's
existing founder push channel (`alox_alerts`, `convex/alox.ts`) as a new alert type.
Impact analysis requires `matters.court` normalized to registry keys — delivered by the J3
normalization in 5a.1, and until backfilled, impact lists carry a "court text not normalized"
confidence note instead of silently missing matters. Feedback records extend
`aiAudit` (existing immutable audit trail) with `finding_feedback` events; the eval-case
writer drops files into `eval/jurisdiction/corrections/` (Phase 5 harness picks them up
automatically).

**Acceptance criteria (Phase 4):**
- AC4.1 Ingesting a fixture amending Act produces a candidate status change in the queue; no active rule changes until approval (before/after DB state pasted).
- AC4.2 Approving a rule change produces an impact list of affected fixture matters.
- AC4.3 Correction marked "incorrect" generates an eval case file (path and content pasted).
- AC4.4 Coverage map renders counts matching the DB for a fixture dataset.

---

## 8. PHASE 5: Evaluation Harness (non-negotiable)

1. **Golden set:** directory of `eval/jurisdiction/*.json`: `MatterFacts` + expected findings (issue class, verdict, required citations). Start with 30 cases the builder drafts across J1-J16 *structure* only; counsel supplies/approves the legal expectations (cases flagged `expectationsApprovedByCounsel: false` are excluded from pass/fail metrics and listed).
2. **Metrics:** per-issue-class precision/recall of defects, citation validity rate (must be 100%), abstention rate, false-reassurance rate (said `ok` where a defect exists; the key safety metric), stale-law miss rate.
3. **Regression gate:** CI fails if citation validity < 100% or false-reassurance rate rises versus baseline.
4. **Adversarial cases:** repealed provision bait, conflicting-authority bait, wrong-court-same-name bait, missing-fact bait, instruction-injection inside an ingested judgment (the engine must treat ingested text as data, never instructions).
5. **Retrieval evals:** recall@k for the correct authority on the golden set; compare to Phase 0 baseline and paste both.

**[ADD] 8.1 Wiring.** Runner `scripts/eval-jurisdiction.mts` + `npm run eval:jurisdiction`
(single command, AC5.1). Golden files are data (not inline test code) so counsel can review
them in GitHub. CI: new `.github/workflows/jurisdiction-evals.yml` running the harness on
every PR touching `src/legal/**`, `convex/legal/**`, `convex/jurisdictionRules/**` or
`eval/jurisdiction/**` — non-blocking (advisory) for the first two weeks, then gating on the
two hard metrics (citation validity 100%, false-reassurance non-increasing). Live-LLM cases
run under `RUN_LIVE_JURISDICTION=1` exactly like the existing opt-in
`tests/unit/drafting/liveCalls.test.ts` pattern, so CI never spends tokens by default.
The Phase 0 baseline for retrieval recall@k is captured the moment the operator token exists
(DEFERRED item in the Phase 0 report); until then the retrieval metric reports against the
fixture corpus only, clearly labelled.

**Acceptance criteria (Phase 5):** AC5.1 harness runs with one command; AC5.2 baseline report committed; AC5.3 CI step exists (paste config); AC5.4 injection test passes.

---

## 9. Security and Audit

- Ingested documents are **untrusted data**; strip/neutralise instruction-like text, never let it alter prompts or rules.
- Immutable audit log: rule approvals, status changes, proceed-anyway overrides, finding outputs for each exported document (with rule versions and source hashes used).
- Per-firm data isolation; confidential client facts are never added to the shared knowledge base. Only public sources enter shared knowledge; firm-private precedents live in a firm-scoped store.
- Every engine output stamps `asAtDate` and rule-store version.

**[ADD] 9.1 `sanitizeIngestedText()` (currently NOTHING exists — verified gap).** Applied at
chunk-write time in `legal/ingest.ts` (and mirrored in the Python ingester) BEFORE text can
ever reach a prompt:
1. Strip zero-width/control characters and homoglyph-normalize lookalikes.
2. Neutralize instruction-like lines in a **tagged, reversible** way: lines matching
   `/(ignore|disregard|forget|override)\s+(all\s+)?(previous|prior|above|system)/i`,
   `^(system|assistant|developer|user)\s*:` role markers, and embedded "```\nYou are…"
   prompt-shaped blocks get prefixed `[INGESTED-DATA]` and their formatting broken.
3. The raw artifact keeps the original bytes (provenance, sha256) — sanitization only
   protects the prompt-facing `chunk.text`; a `sanitized: true` flag records that it ran.
4. The Phase 5 injection adversarial case (Section 8.4) is the regression test — an ingested
   judgment containing "IGNORE ALL PREVIOUS INSTRUCTIONS…" must surface as inert text in
   retrieval output.

**[ADD] 9.2 Firm isolation (existing asset).** The shared `legal_*` store is public-sources
only (crawl origin, auditable). Firm-private precedents already have their home: the
firm-scoped `authorityLibrary` table (`convex/schema.ts:3486`, "written addresses and briefs
may cite ONLY entries from this table"). The Reviewer and gates read both, but firm content is
never written into `legal_*` — enforced by the same source-scan CI pattern.

**[ADD] 9.3 Audit stamp.** Every gate/reviewer output row records: `ruleSnapshotVersion`,
`sourceIds + textHashes` used, `asAtDate`, model + prompt hash for the reasoning pass, and
verifier outcomes. The existing `system_audit_logs` + `aiAudit` tables are extended with these
event types rather than a new trail.

---

## 10. Final Report Format

Return in order: `DECISIONS`, `DEFERRED`, per-phase AC table (`ID | PASS/FAIL | evidence reference`), full test and eval run output, coverage-map snapshot, `git diff --stat`. Any criterion without pasted evidence is FAIL.

---

## Appendix A: Lawyer-Owned Work (the app cannot do this for you)

The system is only as good as the approved rules. Counsel must: (1) approve or correct candidate rules; (2) supply authoritative sources for each jurisdiction scope the firm practises in, starting with the courts and regimes it actually files in; (3) approve the golden-set expectations; (4) set review intervals. Prioritise by practice: ingest and approve in this order, then expand: the firm's most-used courts and processes first, then limitation and pre-action regimes, then specialised regimes (J12) the firm touches.

**[ADD] A.1 Where the sources come from (mechanics, not law).** The ingestion seeds already
point at public Nigerian sources (`tools/legal_ingester/legal_ingester/seeds.py`: NigeriaLII,
Supreme Court, NASS, SEC, INEC, CAC). Counsel's job is to (a) enable/extend seeds for the
firm's states, (b) upload the firm's own rule texts via the ALOA-X indexer or the Review Queue
"create rule from source passage" flow, and (c) approve. The coverage map shows exactly which
cells are empty — nobody has to remember what is missing.

**[ADD] A.2 Operator token action (blocker for the live corpus).** `LEGAL_INGEST_TOKEN` is
not configured on the staging deployment (verified 2026-11-20 — see Phase 0 report §4), so
the Python ingester and operator search are inert there. Setting it (and on production) is a
founder dashboard/env action that unblocks the live retrieval baseline and CLI ingestion.

---

## Appendix B [ADD]: Minimal Viable Slice & Build Order

The owner's constraint: "we don't want to overcomplicate things." Each slice ships value,
is independently testable, and nothing later is required for earlier slices to work.

| Slice | Contents | New tables | Why first |
|---|---|---|---|
| **S0 — Wire the seam** | `SourceStoreCorpus` implementing `CorpusBackend` over `legal_judgments`/`legal_instruments`; wire `verify_citation` and ALOA legal lookup to `hybridSearch`; `sanitizeIngestedText()` at chunk writes; backfill 4a.2 | none | Zero new law, zero new tables; flips citation verification from UNVERIFIABLE to real whenever the corpus has the authority; makes the existing crawl corpus reachable from the product for the first time |
| **S1 — Rule store** | `jurisdiction_rules` + `legal_authority_edges` + field extensions (4a.1) + review-queue tab + CSV import + "rule from passage" + migration of the three existing engines' rows (matrix, limitation, Lagos profile) with counsel approval | `jurisdiction_rules`, `legal_authority_edges` | The governed knowledge layer every later slice reads; AC1.x |
| **S2 — Engine core** | `MatterFacts` builder (5a.1), deterministic pass over the approved snapshot (complianceGate generalized), verifier pass, batched reasoning (5c.7), J1/J6/J14 checkers first (their engines already exist), then J3/J7/J5 | `jurisdiction_overrides` (audit) | AC2.x on the checker subset that has rules |
| **S3 — DraftPro + intake** | Pre-generation gate in `draftProBlueprintService`, TriageCard chip, pre-export gate, intake Forum & Limitation Snapshot + deadline write | — | AC3.1/3.2/3.6/3.7 — the "never draft into a jurisdiction defect" promise |
| **S4 — Reviewer (ALDIA mode)** | DocumentFacts extraction + engine run + anchored report + opponent mode | — | AC3.3/3.4/3.5 |
| **S5 — Learning loop + evals** | Ingest-time candidate extraction, impact analysis, coverage map, feedback→eval cases, `eval/jurisdiction` harness + CI | — | AC4.x, AC5.x |

**Explicitly NOT building now** (revisit with commercial triggers, per the gap analysis):
judicial analytics/outcome prediction, blockchain land registry, NJI case-flow tracks,
licensed law-report integration (LawPavilion/NWLR feed — a commercial decision that would
make `CorpusBackend` verification near-total), 37-state rule seeding (lawyer-owned, incremental).

---

## Appendix C [ADD]: Additions changelog (vs the owner's draft, 2026-11-20)

| # | Change | Reason |
|---|---|---|
| 1 | Taxonomy table gained a "Seed today" column; §1 gained a grounding note | Phase 0 found the deterministic core already built; the spec now states what is migration vs greenfield |
| 2 | 4a.1 mapping: extend `legal_judgments`/`legal_instruments` instead of a new SourceDoc table | Three legal-source systems already exist; a fifth parallel store would be the overcomplication the owner warned against |
| 3 | 4b.1: Convex cannot enforce DB-level constraints — AC1.2 realized as mutation-level rejection + CI pin | Honesty about the platform; "no self-certification" |
| 4 | 4b.2: rule versioning via `supersedesRuleId` | "Which rule version gated this export" must stay answerable |
| 5 | 4c.1 migration inventory with file:line refs | Makes AC1.5 a finite, reviewable backlog instead of an aspiration |
| 6 | 4d reuse map (hybridSearch, CorpusBackend, complianceGate, instrument_changes, engine console, embeddings, dead agent) | Builds FROM tested assets; kills duplicate-build risk |
| 7 | 5a.1 concrete MatterFacts sources; free-text court normalization made explicit + user-confirmed | `matters.court` is free text (Phase 0 §2); silent normalization would violate the no-guessing rule |
| 8 | 5c.7 batched reasoning; 5c.8 dual-date limitation; 5c.9 offline snapshot | Cost guard; temporal honesty; the APK is offline-first (existing offlineBoot contract) |
| 9 | 6a.1/6b.1/6c.1 concrete integration points; ALDIA named as the Reviewer host; diary write path (not deferred — tables exist) | Phase 0 verified all three surfaces exist; ALDIA is an existing component, not a new one |
| 10 | 7.1 review queue in founder Ingestion console; ALOX alert channel reuse; `aiAudit` feedback events | Reuse; the founder app already owns ingestion control |
| 11 | 8.1 eval harness wiring (runner, npm script, CI file, opt-in live cases) | Matches the repo's vitest/CI spine and the `liveCalls.test.ts` opt-in precedent |
| 12 | 9.1 `sanitizeIngestedText()` concrete algorithm | Phase 0 verified NOTHING sanitizes ingested text today while the design intends to feed it to prompts |
| 13 | Appendix B slice order + "not building now" list | The owner's explicit anti-overcomplication instruction |
| 14 | Appendix A.2 operator-token blocker surfaced | Phase 0 verified `LEGAL_INGEST_TOKEN` missing on staging; without it the corpus stays empty and S0's value is latent |

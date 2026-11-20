# Jurisdiction Intelligence Layer — PHASE 0 Diagnostic (read-only)

**Date:** 2026-11-20 · **Companion spec:** `docs/proposals/JURISDICTION_INTELLIGENCE_LAYER.md`
**Method:** read-only exploration (3 parallel code sweeps + direct verification of every load-bearing claim + live deployment probes). No feature code was written (Operating Rule 1).

---

## 1. ALOA X: ingestion pipeline end to end

There are **three parallel legal-source systems** that barely touch each other:

### 1a. Autonomous Legal KB (the crawl pipeline)

`tools/legal_ingester/` (Python, ~1,589 lines) + in-Convex engine port (`src/legal/ingestionEngine/*`, 843 lines) + `convex/legal/*` (2,881 lines).

| Stage | Where | Fact |
|---|---|---|
| Accepted formats | `tools/.../extract.py:87-91` | HTML + PDF only. **No OCR** — `pypdf` text extraction; scanned PDFs fail with "no extractable text" (`worker.py:109-113`). The in-Convex engine **defers PDFs entirely** (`pdf_deferred`, `convex/legal/worker.ts:50-51`). The only vision/OCR-ish path in the stack is the ALOA-X client indexer's Gemini vision fallback (`src/services/indexer/DocumentClassifier.ts:94-122`). |
| Chunking | `tools/.../chunker.py:20-32` | Legal-boundary aware: PART/Section/(n)/proviso/SCHEDULE for instruments; ISSUES/RATIO for judgments; 15–800 words; sentence-safe splits; per-chunk citation extraction (LPELR/NWR/`Section N of the X Act`, capped 10). |
| Embedding model | `tools/.../embedder.py:21,34-67` | OpenAI-compatible REST or Gemini endpoint, `dimensions: 768` (intended model: text-embedding-004 class), inputs truncated 8000 chars; **without a key, chunks ingest with no vectors** (`:12-13`). **The in-Convex engine generates NO embeddings at all** — verified `convex/legal/worker.ts:52-54`: "Embeddings are NOT generated here (keyword-only ingestion)… the dense vector leg stays dormant until embeddings run". |
| Vector/search store | `convex/legal/schema.ts:209-214` | `legal_chunks` has BOTH `searchIndex("search_text")` (BM25-style sparse) and `vectorIndex("by_embedding", {dimensions: 768})`. |
| Metadata captured | `tools/.../metadata.py:33-46,154-171` | Judgments: citation (LPELR-preferred), suitNumber, court, courtLevel, dateDelivered, parties, judges, counsel, ratioDecidendi, statutesConsidered, casesCited **with treatment tags** (applied/distinguished/overruled/affirmed/followed). Instruments: title, key, issuingBody (heuristic), instrumentType, commencementDate (heuristic, first 3000 chars), structure skeleton. Known honesty gaps: missing ratio → placeholder sentence (`worker.py:159-176`); missing date → `"1970-01-01"` (`worker.py:166`). |
| Dedup | `hashing.py:9-21`, `ingest.ts:293-324` | URL-hash queue idempotency; sha256-of-bytes content-addressed artifact store (`legal_raw_artifacts`, stored once, R2/convex/local); conditional GET (304 → zero transfer); document-level upsert by citation/key; chunk delete-and-replace per (documentType, documentKey). No text-hash uniqueness. |
| How features query it | — | **They don't.** `legal/search.ts hybridSearch` (RRF fusion, `shared.ts:84-110`, cache TTLs, coverage-gap detection that auto-enqueues crawl tasks `search.ts:249-257`) has **ZERO product callers**. Verified: `LEGAL_KB.md:284` lists "Wire in-app ALOA to hybridSearch (the seam is ready)" as future work; only the operator CLI (`searchAsOperator`, token-gated) touches it. |

### 1b. Curated Legal Knowledge Engine (what ALOA actually queries)

`convex/legalCorpus.ts` (1,291 lines of seed data — ~44 institutions, ~235 instruments, ~110 provisions, ~280 forms, `CORPUS_VERSION "2026-09-17.2"`) → tables `institutions` / `instruments` / `instrument_provisions` / `court_forms` / `instrument_changes` (`convex/schema.ts:1272-1367`). ALOA chat queries `api.legalKnowledge.searchKnowledge` (vector search over provisions/forms, jurisdiction-scoped) — verified call site `src/components/aloa/AloaChat.tsx:2147`, triggered by a `wantsLegalLookup` regex (`:2133`), empty results disclosed to the model (`:2154-2160`). Provisions/forms carry `verificationStatus` (founder_reviewed / needs_review); `instrument_changes` has a real pending_review → confirmed/dismissed human review flow (`legalKnowledge.ts:307-385`).

### 1c. ALOA-X client indexer (browser-side)

`src/components/indexer/AloaXView.tsx` (1,157 lines): PDF upload → classify (`DocumentClassifier`) → chunk (15-page text / 4-page vision) → Gemini structure/revise (`GeminiStructurer.ts`, model chain gemini-2.5-flash → 3.5-flash-lite → 3-flash-preview, "CULL HALLUCINATIONS" revision pass `:441-509`) → **human review gate** (`:684-695`) → save. Storage is localStorage-first (3 MB prune); Convex sync writes `aloa_documents` via `convex/indexer.ts:23-82` — **but nothing reads `aloa_documents`** (readers deleted in the Round 8 auth retrofit, `indexer.ts:9-17`). Only the library *names* reach ALOA's system prompt (`AloaChat.tsx:2017` → `AgencyHub.ts:74-82`).

### Gap table vs the spec's SourceDoc (Section 4)

| Target field | Status | Evidence |
|---|---|---|
| `kind` (full 9-value enum) | PARTIAL | ingested side: judgment/instrument + instrumentType + 6 domain categories (`legal/schema.ts:40-48`); ALOA-X has JUDGMENT/RULES/ACT/LFN/GAZETTE but client-only (`indexerTypes.ts:3`) |
| `citation` | PARTIAL | judgments fully (indexed `by_citation`); instruments have NO citation field |
| `title` | PARTIAL | instruments yes; judgments have no title field |
| `jurisdictionScope` | **MISSING** | no field on any ingested table; only proxies (issuingBody heuristic, courtLevel). The concept exists only in the curated layer (`institutions.jurisdictionKey`, `schema.ts:1277`) |
| `court` / `decisionDate` | CAPTURED (judgments) | `legal_judgments.court/dateDelivered`; placeholder 1970-01-01 honesty gap |
| `enactmentDate` / `effectiveFrom` / `effectiveTo` | **MISSING** | nowhere on ingested tables; curated `instruments.effectiveDate` only |
| `status` lifecycle | PARTIAL | `legal_instruments.status` enum exists but is **always initialized `"in_force"` with a clean amendmentTracker** (`metadata.py:167`; `LEGAL_KB.md:294-297` admits it); nothing ever flips it; judgments have no doc-level status |
| `statusSourceIds` | **MISSING** | amendmentTracker refs are free strings, never populated |
| `rawFileRef` | PARTIAL | strong machinery (`legal_raw_artifacts` sha256 + storage key) but not a single SourceDoc field |
| `textHash` | PARTIAL | `rawDocumentHash` = hash of raw bytes, not extracted text; no uniqueness |
| `ingestedAt` / `ingestedBy` | PARTIAL | audit log only (`system_audit_logs.actor`), not on the document row |
| `reviewStatus` | **MISSING** | chunks are born `warnings:["unverified"]` (`ingest.ts:254`) and stay that way; **no unreviewed→approved/rejected lifecycle anywhere in the ingested layer** |
| Instruction-injection sanitization | **MISSING** | ingested text stored verbatim; prompt-level honesty rules exist (`AgencyHub.ts:59-72`) but no sanitization of corpus text |

---

## 2. Existing legal data models + hardcoded-law audit

**Matter/court model:** `matters` (`convex/schema.ts:226`) — `court` (`:234`) and `judicialDivision` (`:235`) are **free text**, unlinked to `institutions`; `originatingProcess` (`:262`) free text; `parties` untyped any[] (`:276`); `jurisdictionalAnalysis` an untyped blob (`:258`) filled by a *generative* agent. Diary exists: `tasks` (`:348`, with `idempotencyKey` `:366`) and `events` (`:551`, with `court`/`judicialDivision`). `authorityLibrary` (`:3486`) = firm-scoped verified citations, ships empty.

**Four rule layers coexist (the fragmentation the spec must consolidate):**
1. Typed code tables (the "ALOA LEGAL ENGINE"): `src/legal/jurisdictionMatrix.ts` (207 lines; 3 forums × 22 subjects; verified rows e.g. `:81` taxation→FHC with `FHC_CITATION`), `src/legal/limitationEngine.ts` (Lagos 6/6/12/12-yr + federal POPA 3-month table, `:60-91`, citations `:47-49`), `src/legal/drafting/jurisdictionProfiles.ts` (Lagos HC/CA/SC populated — `:39` "Order 29 … Rules 2019", `:47` garnishee provisions, `:49-58` notice-period table, `:60` "Section 13 of the Tenancy Law of Lagos State 2011"; FCT/FHC/NICN are stubs `:186-189`), `frontloadingGate.ts`, `signatureCompliance.ts`, all orchestrated pure by `complianceGate.ts:73` (verified read).
2. `JURISDICTION_REGISTRY` — `src/utils/jurisdictionConfig.ts` (1,308 lines, all 37 captions/rules editions + tribunal and subject-matter analyses as prose, e.g. EPT time limits `:1000`, FHC s.251(1)(e) mapping `:1046`, "File Notice of Appeal within 90 days" `:1207`).
3. Convex Legal Knowledge Engine (1b above) — the only *reviewed* layer.
4. Autonomous `legal_*` tables (1a above) — provenance-strong, review-absent.

**Hardcoded-law inventory (17 files, full table in the spec §4c.1):** including `proceduralRules.ts` (per-court deadlines, e.g. `:42` "42 days under the Lagos HC CPR 2019"), `statuteLibrary.ts:63-106` (CAMA/Labour/FCCPA/Lagos Tenancy sections), `contractAnalysis.ts` (Nigerian standard-clause drafts citing statutes), `documentTemplateLibrary.ts` (seeded template bodies citing Evidence Act, LUA, NDPA, PIA…), `practiceProfileLibrary.ts` (":181 POPA 3 months", ":306-309 appeal within 3 months"), `aloaPrompts.ts:349-362` (36-state tenancy-law list baked into prompt text) and `:397` (permits model-memory citation "when confident"), `litigationSkeletons.ts`, `defenseUtils.tsx`, `JurisdictionCard.tsx:87,197-204` (s.251 recital + regulatory framework map), dead agents `NigerianLegalJurisdictionAgent.ts:9-11` and `ScaleOfChargesAgent.ts:26-27`.

**Dead/stub audit:** `mockData.ts` is "STRICTLY EMPTY STATE" (verified `:4`) and feeds only DataContext base state; `MOCK_CASE_LAW: []` feeds the unmounted LawReportsView; `demoData.ts` is demo-gated; `convex/drafting.ts` is a 24-line deletion record. No canned legal content reaches users (the three-times-burned failure mode is not present here).

---

## 3. DraftPro: where court/jurisdiction text is generated today

The voice→DraftPro chain is deterministic-by-design (`src/services/draftProBlueprintService.ts:1-20`): blueprint (LLM, schema-constrained, server-validated `convex/voiceCapture.ts:1239-1249`) → `hydrate()` (pure DB merge) → 52 registered templates (`templates/registry.ts`, 1,047 lines) → `fillProseSlots()` (the ONLY LLM calls) → `assembleBundle()` + validators → `bundleToHtml()`.

- Court headings: `templates/shared.ts:76-92` `courtHeadingBlock()` from `ctx.jurisdiction.headingTemplates` with `{{DIVISION}}/{{LOCATION}}` substitution; appellate fallback caption hardcoded `:84`.
- Enabling rules + notice periods: from `jurisdictionProfiles.ts` (hardcoded, counsel-verify contract `rule()`); notice periods **computed in code, never the LLM** (`computeNoticePeriodDays`, `:238-246`; conflict check `hydrate.ts:313-332`).
- Party/capacity labels: hardcoded maps `hydrate.ts:112-142`.
- Anti-fabrication: `authorityLibrary.ts:79-108` `scrubUnverifiedCitations` — citations not in the firm's (empty) library become `[CITATION TO BE VERIFIED]` pills; enforced pre-AST `assemble.ts:196`; counsel-review banner never exported (`tests/unit/drafting/authority.test.ts`).
- What is MISSING: no jurisdiction *gate* exists anywhere in this chain — nothing runs the compliance engine before drafting, and nothing re-checks before export. `matters.court` free text is trusted after keyword profile resolution (`jurisdictionProfiles.ts:194-208`).

---

## 4. Retrieval quality baseline (attempted live; mechanics verified offline)

**Live attempt — blocked, with evidence:**

1. ALOX deployment (founder app): `npx convex run legal/queue:stats` →
   ```
   Error: Could not find function for 'legal/queue:stats'. Did you forget to run `npx convex dev`? No functions found.
   ```
   (the founder deployment carries no `legal/*` functions).
2. STAGING (shiny-echidna-432): functions ARE deployed (args validated:
   `ArgumentValidationError: Object is missing the required field 'ingestToken'`), but
   `npx convex env list` shows the deployment's variables are only:
   `ALLOW_DEMO_SEED, GEMINI_DEMO_KEY, PracticePro_Vega_Mailer, SITE_URL` —
   **`LEGAL_INGEST_TOKEN` is not set**, so every token-gated surface (`queue:stats`,
   `search:searchAsOperator`, the Python ingester's writes) rejects with
   "Unauthorized: invalid ingest token" by construction (`queue.ts:331-334`).
   Production deploy key is not present in this sandbox (prod corpus state therefore unobservable from here).

**Mechanics verified offline (pasted):**

```
$ cd tools/legal_ingester && python3 -m legal_ingester selftest
legal_ingester selftest (offline)
  [PASS] sha256 FIPS 'abc' vector … [PASS] statute chunking produces chunks
  [PASS] PART boundaries detected … [PASS] proviso is its own chunk
  [PASS] statutory citation extracted … [PASS] judgment issue/ratio sections detected
  [PASS] suit number extracted … [PASS] court detected … [PASS] date normalized to ISO
  [PASS] LPELR citation normalized … [PASS] case-cited with treatment tag
  [PASS] parties parsed from title … [PASS] judgment URL classified …
ALL CHECKS PASSED — the ingester core is sound.        (22/22 checks)
$ python3 -m pytest tests/test_offline.py -q
1 passed in 0.21s
```

RRF fusion, cache TTLs, confidence/coverage-gap heuristics are additionally pinned by
`tests/unit/legalKbShared.test.ts` (130 lines). **Conclusion:** the retrieval machinery is
built and unit-sound, but (a) no product surface queries it, (b) the corpus population state
is unobservable without the operator token, and (c) even when populated by the in-Convex
engine, the dense leg stays dormant (no embeddings, `worker.ts:52-54`). The 10-question
baseline protocol is defined in the DEFERRED block and runs the moment the token exists.

---

## 5. Where citations are produced, and verification status

Produced: `geminiService.ts` research protocol (`:481-508`, "[1] markers + ## Sources", "Only cite REAL cases…"), `streamDraft` (`:1058`), `fillProseSlots` (`:1838`); parsed by `citationParser.ts` into the shared `citationRegistry` (call sites `AloaChat.tsx:2682`, `DraftProEditor.tsx:1621-1622`).

**Verification against ingested sources: NONE today — by design, honestly.** Three weaker internal layers run:
1. `deterministicReview` cross-checks draft citations against the citationRegistry — i.e. against what the model itself listed ("source_matched", not authority-verified) (`geminiService.ts:1430-1477`).
2. The voice→DraftPro scrub against the firm's authority library — which ships EMPTY (`authorityLibrary.ts:12-15`).
3. Syntactic classification only ("a well-formed citation is never treated as verified" — `citationClassifier.test.ts:10-13`).

The machinery for real verification EXISTS and is unwired: `verificationHarness.ts:34-42` defines the pluggable `CorpusBackend` (lookupByCitation / searchByName / fetchOpinion; verified read) and `AloaChat.tsx:1099-1107` already calls `verifyCitation` — **always with `null` backend**, returning UNVERIFIABLE with the standing disclosure "No law-report database is connected" (`citationVerification.ts:69-70`). `lePhantomCite.ts` provides the 5-mode hallucination audit. The standing UI disclosure is rendered on research surfaces. **This is exactly the seam the Jurisdiction Engine's verifier pass (spec 5c.4) plugs a `SourceStoreCorpus` into.**

---

## 6. Test/eval infrastructure

- **Framework:** Vitest 4.1.11 (`package.json:43-44` `vitest run`), node env, `include: tests/**/*.test.ts`. **161 test files under `tests/unit/` (156 root + 5 drafting), 3,046 `it()` occurrences** (verified by count; the full suite runs 3,303 tests green per worklog 2026-11-20 (d)). Playwright e2e (public smoke on every push; staging-auth when secret set).
- **CI gate:** `.github/workflows/tests.yml` on push+PR: convex `tsc --noEmit` → root `tsc --noEmit` → identity audit → design-token gate → ui-primitives ratchet → `npx vitest run`. "A red suite blocks every deploy."
- **Relevant pinned suites:** `jurisdictionMatrix.test.ts` (golden vectors incl. "no routing without authority"), `limitationEngine.test.ts` (exact deadlines, SAFE_STOP, "never guesses a period"), `lePhantomCite.test.ts` (UNVERIFIABLE-with-no-corpus contract), `citationClassifier.test.ts`, `legalIngestionEngine.test.ts` (540 lines: port parity + autonomy wiring source-scans), `legalKbShared.test.ts`, `roundV5LegalAIReliability.test.ts` ("no hard-coded Lagos assumptions", "sources are RESEARCHED, never verified"), `drafting/*` (5 files: templates/blueprint/authority/integration-mocked/liveCalls-opt-in), `aloxWatchdog.test.ts`.
- **What does NOT exist:** any `eval/` directory, golden datasets as data files, scored LLM-output evaluation, or a retrieval recall@k harness. Golden vectors are inline in test code only. This is what Phase 5 adds — on the existing vitest/CI spine.

---

## PLAN

Delivered in the companion spec, Appendix B (S0→S5). Summary:
- **S0 (wiring, no new tables):** `SourceStoreCorpus` over `legal_judgments`/`legal_instruments` behind `CorpusBackend`; wire `verify_citation` + ALOA legal lookup to `hybridSearch`; `sanitizeIngestedText()` at chunk writes; backfill `kind`/`jurisdictionScope`/`reviewStatus`.
- **S1 (rule store):** extend the two source tables with the missing SourceDoc fields (all optional, additive); new `jurisdiction_rules` + `legal_authority_edges`; review-queue tab in the founder Ingestion console; CSV import + "rule from source passage"; migrate matrix/limitation/profile rows behind counsel approval.
- **S2 (engine):** `MatterFacts` builder with explicit court normalization; deterministic pass over an approved-rules snapshot (generalized `complianceGate`); verifier pass; batched reasoning (≤4 calls); checkers in order J1→J6→J14→J3→J7→J5.
- **S3 (DraftPro + intake):** pre-generation gate inside `draftProBlueprintService` (before any LLM spend), TriageCard chip, pre-export gate, `jurisdiction_overrides` audit, intake snapshot + idempotent deadline writes to `tasks`.
- **S4 (Reviewer):** ALDIA `DocumentFacts` mode + anchored findings + opponent mode.
- **S5 (learning + evals):** ingest-time candidate rules/edges/status proposals → review queue; impact analysis; coverage map; feedback→eval cases; `eval/jurisdiction` harness + `npm run eval:jurisdiction` + CI workflow.

## RISKS

- **R1 Corpus emptiness:** population state unobservable (no operator token); engine could open all-`indeterminate`. Mitigation: S0 + coverage map make gaps visible and honest; founder enables engine/seeds; `indeterminate` is the designed safe output.
- **R2 Embeddings dormancy:** in-Convex engine ingests keyword-only (`worker.ts:52-54`); dense leg dead until approval-time embedding (S1) or the Python CLI runs with `EMBEDDINGS_API_KEY`.
- **R3 Free-text `matters.court`:** impact analysis (Phase 4) and scoping depend on normalization to registry keys; un-normalized matters must surface as "not normalized" rather than silently missing.
- **R4 PDF/OCR reality:** Nigerian sources are PDF-heavy; engine defers PDFs; scanned PDFs have no server OCR — initial judgment coverage will skew to HTML sources (NigeriaLII etc.).
- **R5 Cost:** 16-class reasoning per draft — mitigated by batching (5c.7) and only-triggered classes; deterministic passes are free.
- **R6 Lawyer bandwidth (the true bottleneck):** candidate rules can pile up unreviewed. Mitigation: candidates are never active; coverage map + staleness (12-month default) keep the state visible.
- **R7 Schema evolution on live prod:** additive optional fields only; no destructive push; convex `tsc` gate in CI.
- **R8 Overcomplication (the owner's explicit concern):** mitigated by slice order, reuse map (4d), the "not building now" list, and the rule that every slice works if all later slices are cancelled.

## DECISIONS

| # | Decision | Alternatives rejected | Reason |
|---|---|---|---|
| D1 | "ALDIA" = the existing `AdvancedLegalDocumentIntelligenceAgent` (its own header names it "ALDIA orchestrator"); the Document Reviewer is a new mode of it | building a separate Reviewer surface | reuse; single structured-call pattern already PII-stripped and battle-tested |
| D2 | Extend `legal_judgments`/`legal_instruments` with optional SourceDoc fields + a resolver; NO new parallel source table | new `source_docs` table | three source systems already exist; a fifth store is the overcomplication to avoid |
| D3 | AC1.2 "rejected by the database" implemented as mutation-level rejection + CI source-scan pin | waiting for a Convex CHECK-constraint feature that does not exist | honesty about the platform |
| D4 | Approved-rules JSON snapshot bundled + synced for offline-first evaluation; DB is source of truth | DB-only evaluation | the APK must gate drafts offline (existing offlineBoot contract) |
| D5 | Batched reasoning (≤4 calls), only-triggered classes; per-class fallback on parse failure | 16 per-class calls | cost/latency; determinism unaffected |
| D6 | Embed chunks at approval time via the existing client 768-dim path | engine-side embedding (needs a new runtime dep in Convex) | matches every existing vector index in the codebase (768-dim) |
| D7 | Review queue = candidates-in-`jurisdiction_rules` (`approvedBy: null`) + existing `instrument_changes` flow for source status | a new generic queue table | the pattern already ships and is tested |
| D8 | Live 10-question retrieval baseline DEFERRED with protocol (see below) | fabricating a baseline from unit fixtures | no token on staging, no prod key, ALOX deployment has no legal functions — any "baseline" would be invented (violates Rules 3 & 5) |
| D9 | `hybridSearch` becomes the engine's retrieval pass (first product consumer) | writing a new retriever | it is built, tested, cached, gap-aware — and currently unused |
| D10 | Firm-private precedents stay in firm-scoped `authorityLibrary`; `legal_*` remains public-sources-only | merging firm content into the shared corpus | per-firm isolation is a spec hard requirement; the split already exists |
| D11 | Spec doc + this report live in `docs/proposals/`; worklog entry follows repo convention; commit locally and attempt push | — | repo convention; push status reported honestly (see worklog: archived PAT returns 401) |

## DEFERRED

| Item | Reason | Unblock condition |
|---|---|---|
| Live 10-question retrieval baseline (spec §3.4) | `LEGAL_INGEST_TOKEN` absent on staging (env list evidence above); ALOX deployment has no `legal/*` functions; no prod deploy key in sandbox | Set `LEGAL_INGEST_TOKEN` on staging (or supply a prod key), then run: for each of the 10 questions in `eval/jurisdiction/baseline-questions.json` (to be committed with S0): `npx convex run legal/search:searchAsOperator '{ingestToken, query, limit: 10}'` and paste source/rank/hit per question |
| Production corpus counts | no prod deploy key | founder runs `legal/queue:stats` from the founder console (Ingestion dashboard already shows it) |
| Any feature code (S0–S5) | Operating Rule 1: diagnostic before build; this report is the gate | owner green-light (or next session proceeds at S0 per the spec's slice order) |
| 37-state rule seeding, licensed law-report integration, judicial analytics, blockchain title, NJI tracks | lawyer-owned / commercial triggers (spec Appendix B "not building now") | counsel capacity / commercial decision |

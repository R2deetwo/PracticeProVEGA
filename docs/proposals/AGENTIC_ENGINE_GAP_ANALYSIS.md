# Agentic Engine Gap Analysis — "ALOA/ARIA Co-Counsel Directive" vs. the Codebase

**Date:** 2026-11-16 · **Status:** living document — update per round
**Source directive:** owner-forwarded "MASTER ENGINEERING PROMPT" (7 pillars
+ 5 operational refinements). This analysis maps every requirement to what
exists, what is missing, and the recommended next step — so the directive
becomes a work plan instead of prose.

**Headline:** the deterministic core the directive demands — jurisdiction
routing, limitation SAFE_STOP, notice matrices, compliance gates, the
sequential citation harness, the LePhantomCite audit, model tiering, audit
logging — **is already built and tested**. The real gaps are: a licensed
corpus backend (the biggest single unlock), pointwise revision, temporal
tombstoning enforcement at retrieval time, a generalized
interrupt-and-resume state machine, and the ingestion bridge. Judicial
analytics and blockchain title work are deferred as premature.

## Legend

- **BUILT** — exists, tested, in production
- **PARTIAL** — exists but incomplete or not generalized
- **ABSENT** — not present
- **DEFER** — present in the directive but deliberately not recommended now

## Pillar 1 — Jurisdiction, limitation, procedure

| Requirement | Status | Where | Gap → next step |
| --- | --- | --- | --- |
| DMN jurisdiction matrix (FHC s.251(1), NICN s.254C, State residual) | **BUILT** | `src/legal/jurisdictionMatrix.ts` | Admiralty/PIA heads exist as subject rows; encode PIA 2021 upstream/midstream regulatory split (NUPRC vs NMDPRA) as typed rows when energy-sector matters arrive |
| Limitation calculator + SAFE_STOP | **BUILT** | `src/legal/limitationEngine.ts` (Lagos + federal POPA seeded) | State coverage grows as verified rows land; unseeded states already carry verify notes — keep that honesty |
| Frontloading bundle checklist | **BUILT** | `src/legal/frontloadingGate.ts` (aggregated by `complianceGate.ts`) | NJI case-flow tracks (summary vs complex) not encoded — low value until cause-list automation ships |
| Supreme Court 2026 e-filing practice directions | ABSENT | — | Encode as corpus entries + a gate check when e-filing integration is real |
| CAMA 2020 compliance gate | PARTIAL | `complianceGate.ts` advisory architecture | Add CAMA-specific checklist rows (incorporation, annual returns, secretary) as typed rules if corporate-secretarial workflows are built |
| RPC 2023 gatekeeper (seal/stamp, practicing fee) | **BUILT** (seal & stamp + practitioner details) | `src/legal/signatureCompliance.ts` | Annual-practicing-fee verification needs a data source; keep advisory until then |
| AML/CFT CDD + UBO (RPC 57-72) | ABSENT | — | P1 roadmap item if the firm module takes compliance clients; schema first, gate second |

## Pillar 2 — Rule synchronization & temporal metadata

| Requirement | Status | Where | Gap → next step |
| --- | --- | --- | --- |
| Zero-retraining tiered updates (contracts/rules/paths) | **BUILT** | this workspace (Layers A/B/C) + typed tables | — |
| Temporal metadata on corpus records | **PARTIAL** | `convex/legalCorpus.ts`: `status: in_force/repealed/superseded/monitor`, `effectiveDate` | Add `superseded_by` link + `enactment_date`; enforce **cause-of-action date filtering** at retrieval time (query the law as of the event) |
| Tombstoning + DEPRECATED_AUTHORITY_WARNING | PARTIAL | status fields exist | Wire the warning: drafting that cites a tombstoned record must halt + flag. This is a small, high-value rule |
| Stale-playbook detection from lawyer edits | ABSENT | — | Depends on DraftPro diff capture (see Pillar 4); then a simple frequency heuristic → `STALE_REFERENCE_ALERT` |

## Pillar 3 — Citation verification & anti-hallucination

| Requirement | Status | Where | Gap → next step |
| --- | --- | --- | --- |
| Sequential BOED belief-state harness (4 stages) | **BUILT** | `src/legal/citations/verificationHarness.ts` — PRIMARY_CITATION_LOOKUP → OPEN_CASE_SEARCH → FETCH_FULL_OPINION → PINCITE_STAR_PAGINATION | — |
| LePhantomCite 5-point audit | **BUILT** | `src/legal/citations/lePhantomCite.ts` + tests | — |
| Multi-reporter indexing (NWLR, LPELR, All FWLR) | PARTIAL | `src/utils/citationParser.ts`, `citationRegistry.ts` | Reporter grammar covers the formats; the registry has no licensed backend feeding it |
| **Licensed corpus backend** | **ABSENT — the single biggest unlock** | `CorpusBackend` seam awaits an implementation | Connect LawPavilion/NigeriaLII/licensed feed; flips `UNVERIFIABLE` → `VERIFIED` for every surface with zero caller changes |

## Pillar 4 — Pleading architecture & revision agent

| Requirement | Status | Where | Gap → next step |
| --- | --- | --- | --- |
| Plan-and-execute phased drafting | **BUILT** | DraftPro phases (issue spotting → retrieval → assembly) | — |
| **Pointwise section editing (Revision Agent)** | ABSENT | policy written: `stages/02_synthesis_and_draft/references/revision-policy.md` | Implement section-ID-addressable draft storage + targeted re-orchestration; largest LLM-quality win after the corpus |
| Draft diff capture (edit-source feedback loop) | ABSENT | — | Capture structural diffs on lawyer saves; feeds Pillar 2 stale detection and Pillar 6 features |

## Pillar 5 — ARIA tenancy & prop-tech

| Requirement | Status | Where | Gap → next step |
| --- | --- | --- | --- |
| Lagos tenancy notice matrix (s.13 periods) | **BUILT** | `src/utils/tenancyNoticePeriods.ts` (single source for drafting, countdowns, and — as of 3ac79a41 — the public Vega/Atrium assistant) | Extend `ENCODED_TENANCY_STATUTES` per state as corpus entries land |
| Court-order-only recovery; self-help prohibition | **BUILT** (encoded corpus note) | `convex/legalCorpus.ts` practice notes | — |
| E-signature validity handling | PARTIAL | evidence handling exists in document flows | Formalize an Evidence Act 2023 / Cybercrime Act 2015 compliance note in the corpus |
| Blockchain land registry / AI valuation | **DEFER** | — | Not recommended now: no production need, high complexity, unproven partner. Revisit when a land-registry integration is commercially real |

## Pillar 6 — Judicial analytics

| Requirement | Status | Where | Gap → next step |
| --- | --- | --- | --- |
| XGBoost + Legal-BERT outcome prediction, SHAP/LIME | **DEFER** | — | Needs an outcomes dataset first. Sequence: licensed corpus (P3) → matter outcome capture (exists in matter records) → then a model. Ship explanation layers with the model, not before |

## Pillar 7 — Guardrails, audit, HITL

| Requirement | Status | Where | Gap → next step |
| --- | --- | --- | --- |
| Immutable audit logging | **BUILT** | `convex/aiAudit.ts` + mutation-level audit trails | Keep extending coverage per round |
| Interrupt-and-resume HITL | PARTIAL | domain approvals exist (refunds, portals, visitor mgmt) | **Generalize**: a reusable `SUSPENDED_WAITING_FOR_APPROVAL → RESUMED_EXECUTING` wrapper + review-card component for filing/notices/ledger |
| Multi-tenant vector isolation | PARTIAL | firm scoping enforced in Convex (`assertSameFirm`); vector layer pending corpus | Mirror `allowed_principals`/firm keys into vector metadata when the index ships |

## The 5 operational refinements

| # | Refinement | Status | Where | Next step |
| --- | --- | --- | --- | --- |
| 1 | Model cost/latency tiering | **BUILT** | `src/services/aiProvider.ts` purpose ladder (fast→strong, pro-first drafts); `convex/aiModels.ts` `BACKGROUND_MODEL = gemini-3.8-flash` | Enforce rung selection in code review; flash for labels/JSON, frontier for synthesis + gates |
| 2 | Reflexion & self-correction loops | ABSENT (pattern) | policy written: `.agent/rules/rate-limits.md` §3 | Implement a `reflectAndRetry(fn, max=3)` helper with structured reflection logs in the ingestion + retrieval paths |
| 3 | Upstream 429 normalization | PARTIAL | policy written; ingestion bridge (`/ingest/legal-doc` in `convex/http.ts`) still to build per the corpus-ingestion spec | Build the bridge with normalized `ratelimit-*` handling from day one; fail-fast user path, backoff job path |
| 4 | Targeted revision agent | ABSENT | policy written (Stage 02 reference) | See Pillar 4 |
| 5 | Transactional burn-after-use | PARTIAL | `convex/conversationMemory.ts` compresses + cron; drafts persist per retention policy | Add a retryable burn mutation for ephemeral buffers on session end; document retention policy in `_config/` |

## Recommended sequence (impact-ordered)

1. **Licensed corpus backend** — unlocks VERIFIED citations end-to-end; everything in Pillar 3 lights up.
2. **Ingestion bridge + 429 normalization + reflexion helper** — the pipeline that keeps the corpus alive (spec already written).
3. **Tombstone enforcement + temporal retrieval filtering** — small code, big honesty win.
4. **Pointwise revision agent** — draft quality + the edit-diff feedback loop.
5. **Generalized HITL wrapper + review card** — one state machine, every irreversible action.
6. Defer: blockchain title, judicial analytics, NJI tracks — revisit with commercial triggers.

## Note on the workspace scaffold

PROMPT 1's filesystem architecture is now materialized in this repo:
`AGENTS.md` (L0) → `CONTEXT.md` (L1) → `stages/*/CONTEXT.md` (L2) →
`.agent/rules/` + `_config/` (L3) → `stages/*/output/` (L4). Rules that the
directive specified as prose now exist as scannable, hot-swappable files an
agent (or engineer) loads only when working in scope.

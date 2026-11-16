# LEGAL_KB.md — the Legal Knowledge Base & Retrieval Engine runbook

**What this is:** the autonomous, cryptographically-verified, bandwidth-optimised
pipeline that crawls, parses, structures, chunks, embeds, caches and audits
Nigerian court judgments, statutes, subsidiary legislation, rules of court, SEC
regulations and INEC electoral guidelines into Convex — powering ALOA and ARIA
with strictly-cited legal intelligence.

Built to the owner spec of 2026-11-16. This file is the OPERATOR MANUAL:
read it top to bottom once, then keep the commands section open.

---

## 1. Architecture — what exists and where

```
                    ┌────────────────────────────────────────────────┐
                    │  DISCOVERY                                     │
                    │  • legal_seed_sources  (authoritative roots)   │
                    │  • gap detection       (query-time, auto)      │
                    │  • weekly cron         (Mondays 06:10 UTC)     │
                    └───────────────┬────────────────────────────────┘
                                    ▼
                    legal_scrape_queue   (Convex — url_hash dedup,
                                          priority 0=gap 3=curated
                                          5=default 8=freshness)
                                    ▲  claim / complete / fail
                    ┌───────────────┴────────────────────────────────┐
                    │  PYTHON INGESTER  tools/legal_ingester         │
                    │  robots.txt ✓  jitter 3.0–6.0s ✓  per-domain   │
                    │  serialization ✓  conditional GET (304) ✓      │
                    │  SHA-256 immediately on fetch ✓                │
                    └───────┬───────────────────────┬────────────────┘
                            ▼                       ▼
              legal_raw_artifacts          parse → classify → chunk
              (R2 or local, stored         (Part→Section→Subsection→proviso;
               ONCE, content-addressed)     Issue→Reasoning→Ratio)
                            │                       │
                            │            (optional) 768-dim embeddings
                            ▼                       ▼
                    legal_judgments / legal_instruments
                            │                       │
                            └───────────┬───────────┘
                                        ▼
                    legal_chunks  (full-text search index + vector index)
                                        │
                    ┌───────────────────┴────────────────────────────┐
                    │  RETRIEVAL: legal/search/hybridSearch          │
                    │  cache hit? serve instantly                    │
                    │  else: dense leg (vector) + sparse leg (BM25-  │
                    │  style full-text) → Reciprocal Rank Fusion     │
                    │  (k=60) → warnings (amended/overruled/stale)   │
                    │  → low confidence? honest notice + auto-queue  │
                    │    a GAP_FILL ingestion task                   │
                    │  → cache result with TTL (6h search / 24h      │
                    │    synthesis)                                   │
                    └────────────────────────────────────────────────┘
                    Every step writes system_audit_logs.
```

### File map

| Layer | File | What it does |
|---|---|---|
| Schema | `convex/legal/schema.ts` | All 8 tables + priorities + politeness constants |
| Schema | `convex/schema.ts` | Registers the tables (bottom of file) |
| Queue | `convex/legal/queue.ts` | seed/enqueue/claim/complete/fail/stats + internal gap-fill + sweep requeue |
| Ingest | `convex/legal/ingest.ts` | `ingestDocument` (idempotent chunk replacement) + `dedupProbe` |
| Search | `convex/legal/search.ts` | `hybridSearch` action + cache + synthesis cache + operator search |
| Shared | `convex/legal/shared.ts` | Pure logic: RRF, normalization, TTLs, confidence (unit-tested) |
| Audit | `convex/legal/audit.ts` | `system_audit_logs` writers + operator `recent` view |
| Cron | `convex/crons.ts` | `legalKbFreshnessSweep` — Mondays 06:10 UTC |
| Tests | `tests/unit/legalKbShared.test.ts` | 14 vitest cases locking the fusion/cache/confidence core |
| Ingester | `tools/legal_ingester/legal_ingester/*.py` | Worker, polite fetcher, chunker, extractors, embedder, CLI |
| Selftest | `tools/legal_ingester/legal_ingester/selftest.py` | 22 offline checks (`python -m legal_ingester selftest`) |

---

## 2. One-time setup (10 minutes)

### Step 1 — set the shared secret in Convex

In the Convex dashboard (your production deployment,
`gregarious-malamute-537`): **Settings → Environment Variables → Add**:

```
Name:  LEGAL_INGEST_TOKEN
Value: <generate a long random string, e.g. `openssl rand -hex 32`>
```

This token is the ONLY way external callers (the Python ingester, your CLI)
can write to the queue/ingest endpoints. It lives in Convex's env vars and
your local `.env` — never in code, never in the client bundle. (spec §2)

### Step 2 — configure the ingester

```bash
cd tools/legal_ingester
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env:
#   CONVEX_URL=https://gregarious-malamute-537.convex.cloud
#   LEGAL_INGEST_TOKEN=<the same token from Step 1>
```

Optional in the same `.env`:
- `R2_*` vars → raw HTML/PDF artifacts cache in Cloudflare R2 (needs
  `pip install boto3`). Without them, artifacts cache in a local
  content-addressed `./artifacts/` directory.
- `EMBEDDINGS_API_KEY` (+ BASE_URL/MODEL) → 768-dim vectors on every
  chunk (OpenAI `text-embedding-3-small` with `dimensions=768`, or any
  OpenAI-compatible 768-dim endpoint such as Gemini
  `text-embedding-004`). **Without a key, ingestion is keyword-only —
  the sparse search leg works; the dense vector leg stays dormant.**

### Step 3 — prove the install

```bash
python -m legal_ingester selftest
# ALL CHECKS PASSED — 22 offline checks (hashing, chunking boundaries,
# judgment metadata, classification, config). No network. No writes.
```

### Step 4 — deploy the Convex functions

The `convex/legal/*` functions ship with the app's next `npx convex dev`
/ CI deploy (`npm run deploy` runs `convex deploy`). After deploy, the
cron (`legalKbFreshnessSweep`) registers itself automatically.

---

## 3. Running the pipeline

### Seed the authoritative sources (once, then re-runnable)

```bash
python -m legal_ingester seed            # registers + queues the seeds
python -m legal_ingester seed --dry-run  # just prints the list
```

Seeds (review + edit `legal_ingester/seeds.py` before large crawls;
each domain's robots.txt is respected automatically):

| Category | Source |
|---|---|
| index/judgments | NigeriaLII (AfricanLII) — nigerialii.org |
| judgments | Supreme Court of Nigeria — supremecourt.gov.ng |
| statutes | National Assembly — nass.gov.ng |
| sec_regulations | SEC Nigeria — sec.gov.ng |
| electoral | INEC — inecnigeria.org |
| subsidiary | CAC — cac.gov.ng |

### Run the worker (the polite crawler)

```bash
python -m legal_ingester worker                 # up to 10 tasks
python -m legal_ingester worker --tasks 50      # longer run
python -m legal_ingester worker --category sec_regulations
```

What each task does, in order:
1. `claim` from `legal_scrape_queue` (priority order, oldest first)
2. robots.txt check → skip politely if disallowed
3. jittered delay 3.0–6.0s (per-domain serialized)
4. conditional GET with stored ETag/Last-Modified → **304 = free, done**
5. SHA-256 the bytes immediately (provenance)
6. `dedupProbe` → identical artifact already parsed? **skip parse + storage**
7. store raw bytes ONCE (R2 or local, content-addressed)
8. extract text (HTML via BeautifulSoup / PDF via pypdf)
9. classify (judgment | instrument | index)
10. chunk along legal boundaries; extract citations + treatment tags
11. embed (optional, batched, 768-dim)
12. `ingestDocument` → upserts the judgment/instrument, REPLACES its
    chunks wholesale (idempotent), writes `system_audit_logs`
13. `complete` the queue row with hash + validators

Index pages additionally harvest same-domain child links into the queue
(conservative: max 25 per page).

### Freshness sweeps (spec §5)

Two ways, same effect:
- **Automatic:** the Convex cron `legalKbFreshnessSweep` runs Mondays
  06:10 UTC (07:10 WAT) and re-queues every enabled seed at priority 8.
  The next `worker` run you start processes them — unchanged documents
  cost a single 304; changed index pages surface new rulings/amendments.
- **On demand:**

```bash
python -m legal_ingester sweep
```

### Operate

```bash
python -m legal_ingester status                 # queue + corpus counts
python -m legal_ingester search "notice to quit lagos"   # keyword probe
python -m legal_ingester audit                  # recent audit events
python -m legal_ingester audit --event gap.detected
python -m legal_ingester verify                 # re-hash local artifact cache
```

### The gap-detection loop (spec §5, automatic)

When `hybridSearch` runs with low confidence it (a) tells the user
honestly that coverage is pending, and (b) pushes a **priority-0**
GAP_FILL task into `legal_scrape_queue` (rate-limited: one per source
per 15 min). The next `worker` run treats it as the most urgent work.
You watch it happen with `audit --event gap.detected`.

---

## 4. How ALOA / ARIA consume the engine

- **Landing-site assistant (Vega/Atrium pages):** stays on the scripted
  topic catalogue BY DESIGN — `/ai` actions require an authenticated
  session (the platform key must never fund anonymous traffic), and the
  anonymous surface must not fund retrieval compute. When you want a
  public Q&A, ship a rate-limited public action as its own decision.
- **In-app ALOA/ARIA (authenticated):** call the Convex action

  ```ts
  api.legal.search.hybridSearch({ query, sessionToken, queryEmbedding? })
  ```

  Returns `results[]` — each with `boundaryPath` (e.g.
  `["PART C","Section 18","(3)","proviso"]`), `text`, `citations`,
  `warnings`, `sourceUrl`, `sha256` — the strict-grounding unit: every
  assertion ALOA renders must map to one of these chunk IDs (spec §5).
  `confidence` is `high | medium | coverage_gap`; a gap carries an
  honest `notice` and the ingestion task has already been queued.
- **Synthesis caching:** when the AI-answer layer lands, store its
  strictly-cited answer via the internal `storeSynthesis` — identical
  questions then skip LLM compute for 24h (`token.expenditure` audited).

The 768-dim embedding dimension matches the platform's existing Gemini
pipeline (`statutes`, `instrument_provisions`, `court_forms`), so the
same client-side embedding path serves the whole ecosystem.

---

## 5. Security, compliance, bandwidth (spec §2)

- **Secret isolation:** `LEGAL_INGEST_TOKEN` only in Convex env vars +
  local `.env` (gitignored). TLS enforced (`https://` Convex URL
  required; localhost is the only plaintext exception for `convex dev`).
- **Provenance:** every artifact SHA-256'd on arrival; local cache
  re-verifiable via `verify`; `ingestDocument` refuses chunks without an
  artifact hash; audit rows record every fetch/parse/ingest/tokens.
- **NDPA alignment:** only public legal documents are ingested; no
  personal data beyond what public judgments contain (parties/counsel
  are public record); audit payloads carry no PII; crawl identity is a
  named User-Agent with a contact address; robots.txt respected.
- **Bandwidth savers:** (1) URL-hash queue dedup, (2) conditional GETs —
  unchanged documents transfer zero bytes, (3) raw artifacts stored once
  and re-parsed locally on parser upgrades, (4) query-result caching
  with TTLs, (5) jittered low-concurrency politeness.

---

## 6. Suggested first fortnight

1. `seed` + `worker --tasks 20` — watch the first real crawl
2. Review `status` + `audit` daily for the first week
3. Add an `EMBEDDINGS_API_KEY` when you're happy with the corpus shape
4. Add R2 credentials when the artifact cache outgrows the worker box
5. Wire in-app ALOA to `hybridSearch` (the seam is ready)
6. Decide the public rate-limited Q&A action as its own product decision

## 7. Known boundaries (honest)

- Judgment metadata extraction is heuristic (LII-style headers). Fields
  it cannot find are marked `UNKNOWN`/"unverified" rather than invented
  — matching the corpus philosophy (accuracy over bravado).
- The seed list is a starting point: review `seeds.py` + each domain's
  robots.txt before scaling up crawl depth.
- `legal_instruments.amendmentTracker` starts clean (`in_force`); change
  detection flows through the weekly sweep's hash diffs, and the
  founder-curated `instrument_changes` table remains the human review
  layer for licensed-firm surfaces.

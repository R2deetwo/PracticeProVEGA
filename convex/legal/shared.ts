/**
 * legal/shared — PURE logic for the Legal KB retrieval engine.
 *
 * No Convex imports in this file (only the pure sha256 helper) so it can
 * be unit-tested by vitest directly and run in every Convex runtime
 * (queries, mutations, actions) plus the browser bundle.
 */

import { sha256Hex } from "../sha256";

// ─────────────────────────────────────────────────────────────────────────────
// Query normalization & hashing
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize a user query for cache keying and sparse search: lowercase,
 *  strip punctuation, collapse whitespace. Keeps digits so citations
 *  like "Section 330 CAMA 2020" survive intact. */
export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cache/query hash: sha256(normalized query + "|" + mode). */
export function queryHash(normalized: string, mode: string): string {
  return sha256Hex(`${normalized}|${mode}`);
}

/** Normalize a URL for the scrape-queue dedup key (strip fragments,
 *  trailing slash, common tracking params). */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    const drop: string[] = [];
    u.searchParams.forEach((_v, k) => {
      if (/^(utm_|fbclid|gclid|ref$|source$)/i.test(k)) drop.push(k);
    });
    drop.forEach((k) => u.searchParams.delete(k));
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function urlHash(raw: string): string {
  return sha256Hex(normalizeUrl(raw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Reciprocal Rank Fusion (spec §4)
// ─────────────────────────────────────────────────────────────────────────────

export interface RrfOptions {
  /** Standard RRF constant (k=60 from Cormack et al.). Smaller = top
   *  ranks dominate; larger = flatter fusion. */
  k?: number;
  /** Per-list weights: dense (semantic) vs sparse (keyword/citation). */
  denseWeight?: number;
  sparseWeight?: number;
}

export interface RankedId<T extends string = string> {
  id: T;
  /** _score from the underlying engine (cosine similarity for dense,
   *  relevance for sparse) — informational only; RRF ranks by position. */
  score?: number;
}

/**
 * Reciprocal Rank Fusion: score(d) = Σ_lists weight / (k + rank).
 *
 * WHY position-based fusion (not raw scores): dense cosine similarities
 * and sparse relevance scores live on incomparable scales. RRF fuses
 * RANKS, which is scale-free and empirically the strongest cheap hybrid
 * baseline — exactly what "Section 330 CAMA 2020" needs: the sparse leg
 * nails the exact citation, the dense leg catches the concept, and a
 * document relevant in BOTH lists outranks one that tops a single list.
 */
export function rrfFuse<T extends string>(
  dense: RankedId<T>[],
  sparse: RankedId<T>[],
  options: RrfOptions = {},
): Array<{ id: T; fusedScore: number; denseRank?: number; sparseRank?: number }> {
  const k = options.k ?? 60;
  const dw = options.denseWeight ?? 1;
  const sw = options.sparseWeight ?? 1;

  const fused = new Map<T, { fusedScore: number; denseRank?: number; sparseRank?: number }>();
  const add = (list: RankedId<T>[], weight: number, key: "denseRank" | "sparseRank") => {
    list.forEach((item, idx) => {
      const rank = idx + 1;
      const contribution = weight / (k + rank);
      const cur = fused.get(item.id) ?? { fusedScore: 0 };
      cur.fusedScore += contribution;
      cur[key] = rank;
      fused.set(item.id, cur);
    });
  };
  add(dense, dw, "denseRank");
  add(sparse, sw, "sparseRank");

  return Array.from(fused.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.fusedScore - a.fusedScore);
}

// ─────────────────────────────────────────────────────────────────────────────
// Query / synthesis cache TTLs (spec §4: "intelligent TTLs")
// ─────────────────────────────────────────────────────────────────────────────

export const CACHE_TTL_S = {
  /** Fused retrieval results: legal text rarely changes intraday, and
   *  concurrent identical queries are the exact burst this absorbs. */
  hybrid_search: 6 * 60 * 60,
  /** Synthesized answers: stable prose, longer runway. */
  synthesis: 24 * 60 * 60,
} as const;

export function cacheTtlFor(mode: string): number {
  return (CACHE_TTL_S as Record<string, number>)[mode] ?? 6 * 60 * 60;
}

/** Is a cache row still fresh at `now` (epoch ms)? */
export function isCacheFresh(expiresAt: number, now: number): boolean {
  return expiresAt > now;
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence & gap detection (spec §5)
// ─────────────────────────────────────────────────────────────────────────────

export type Confidence = "high" | "medium" | "coverage_gap";

export interface ConfidenceInput {
  /** Number of fused results above the relevance floor. */
  resultCount: number;
  /** Top fused RRF score. */
  topFusedScore: number;
  /** Did BOTH legs return results for the query? */
  bothLegs: boolean;
}

/**
 * Coverage heuristic (documented, deterministic):
 *  - high: ≥ 3 fused results AND top score ≥ 0.02 (a k=60 single-list
 *    top hit is 1/61 ≈ 0.0164 — crossing 0.02 means corroboration
 *    across lists or multiple strong hits) AND both legs alive.
 *  - medium: at least one solid hit, but thin.
 *  - coverage_gap: nothing meaningful — notify the user AND auto-queue
 *    a high-priority ingestion task (spec §5).
 */
export function computeConfidence(input: ConfidenceInput): Confidence {
  const { resultCount, topFusedScore, bothLegs } = input;
  if (resultCount >= 3 && topFusedScore >= 0.02 && bothLegs) return "high";
  if (resultCount >= 1 && topFusedScore >= 0.016) return "medium";
  return "coverage_gap";
}

/** User-facing notice for a coverage gap — honest, no fake confidence. */
export const COVERAGE_GAP_NOTICE =
  "We don't have verified coverage of this area yet. Your question has been queued for our legal-knowledge ingester; general guidance follows meanwhile.";

// ─────────────────────────────────────────────────────────────────────────────
// Ingest-token guard (spec §2: strict secret isolation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared-secret check for the Python ingester calling over the Convex
 * HTTP API. The token lives ONLY in the Convex deployment's environment
 * variables (LEGAL_INGEST_TOKEN) and in the ingester's .env — never in
 * code, never in the client bundle. Returns the token when configured.
 */
export function requireIngestToken(presented: string | undefined): string {
  const expected = process.env.LEGAL_INGEST_TOKEN;
  if (!expected) {
    throw new Error(
      "LEGAL_INGEST_TOKEN is not configured in this Convex deployment. Set it in Settings → Environment Variables before running the ingester.",
    );
  }
  if (!presented || presented !== expected) {
    throw new Error("Unauthorized: invalid ingest token.");
  }
  return expected;
}

/** Rough token estimate (~4 chars/token) for audit token-expenditure rows. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

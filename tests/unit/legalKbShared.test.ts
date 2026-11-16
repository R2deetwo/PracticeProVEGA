/**
 * Legal KB shared-logic tests (spec §1, §4, §5):
 *  - Reciprocal Rank Fusion behaviour (both-legs corroboration, k constant,
 *    weights, empty legs)
 *  - Query normalization + hashing (cache keying)
 *  - URL normalization (dedup keying)
 *  - Cache TTL policy + freshness
 *  - Confidence / coverage-gap heuristic
 *
 * These lock the retrieval engine's deterministic core — the part that
 * must behave identically in Convex actions, the browser and the CLI.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeQuery,
  queryHash,
  normalizeUrl,
  urlHash,
  rrfFuse,
  cacheTtlFor,
  isCacheFresh,
  computeConfidence,
  COVERAGE_GAP_NOTICE,
} from "../../convex/legal/shared";

describe("normalizeQuery", () => {
  it("lowercases, strips punctuation, collapses whitespace but keeps digits", () => {
    expect(normalizeQuery("Section 330 CAMA 2020!")).toBe("section 330 cama 2020");
    expect(normalizeQuery("  What   is   a   writ?  ")).toBe("what is a writ");
  });

  it("produces a stable cache key for equivalent phrasings", () => {
    expect(normalizeQuery("Landlord-Tenant: notice to quit?")).toBe(
      normalizeQuery("landlord tenant notice to quit"),
    );
  });
});

describe("queryHash", () => {
  it("differs by mode and query", () => {
    const a = queryHash("section 330 cama 2020", "hybrid_search");
    const b = queryHash("section 330 cama 2020", "synthesis");
    const c = queryHash("something else", "hybrid_search");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("normalizeUrl", () => {
  it("strips fragments, trailing slashes and tracking params", () => {
    expect(normalizeUrl("https://example.com/judgments/123/#head")).toBe(
      "https://example.com/judgments/123",
    );
    expect(normalizeUrl("https://example.com/x?utm_source=twitter&id=9")).toBe(
      "https://example.com/x?id=9",
    );
  });

  it("yields a stable dedup hash for cosmetic variants", () => {
    expect(urlHash("https://example.com/a/?utm_source=x#top")).toBe(
      urlHash("https://example.com/a"),
    );
  });
});

describe("rrfFuse", () => {
  it("ranks documents corroborated by BOTH legs above single-list winners", () => {
    const dense = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const sparse = [{ id: "c" }, { id: "d" }, { id: "e" }];
    const fused = rrfFuse(dense, sparse);
    // c is rank 3 dense + rank 1 sparse → beats a (dense rank 1 only).
    expect(fused[0].id).toBe("c");
    expect(fused[0].denseRank).toBe(3);
    expect(fused[0].sparseRank).toBe(1);
    // Corroboration score: 1/63 + 1/61 vs a's 1/61.
    expect(fused[0].fusedScore).toBeCloseTo(1 / 63 + 1 / 61, 8);
    expect(fused[1].id).toBe("a");
  });

  it("uses the k=60 constant so top ranks do not utterly dominate", () => {
    const fused = rrfFuse([{ id: "only" }], []);
    expect(fused.length).toBe(1);
    expect(fused[0].fusedScore).toBeCloseTo(1 / 61, 8);
  });

  it("applies leg weights", () => {
    const fused = rrfFuse([{ id: "d" }], [{ id: "s" }], { denseWeight: 2 });
    expect(fused.find((f) => f.id === "d")!.fusedScore).toBeCloseTo(2 / 61, 8);
    expect(fused.find((f) => f.id === "s")!.fusedScore).toBeCloseTo(1 / 61, 8);
  });

  it("handles empty legs gracefully", () => {
    expect(rrfFuse([], [])).toEqual([]);
    expect(rrfFuse([], [{ id: "x" }])[0].id).toBe("x");
  });
});

describe("cache TTLs", () => {
  it("synthesis outlives raw retrieval", () => {
    expect(cacheTtlFor("synthesis")).toBeGreaterThan(cacheTtlFor("hybrid_search"));
  });
  it("freshness boundary is exclusive", () => {
    const now = 1_000_000;
    expect(isCacheFresh(now + 1, now)).toBe(true);
    expect(isCacheFresh(now, now)).toBe(false);
    expect(isCacheFresh(now - 1, now)).toBe(false);
  });
});

describe("computeConfidence (gap detection)", () => {
  it("high only with corroboration: ≥3 results, strong top score, both legs", () => {
    expect(
      computeConfidence({ resultCount: 3, topFusedScore: 0.025, bothLegs: true }),
    ).toBe("high");
  });

  it("medium for a solid single hit", () => {
    expect(
      computeConfidence({ resultCount: 1, topFusedScore: 0.0164, bothLegs: false }),
    ).toBe("medium");
  });

  it("coverage_gap triggers the honest notice + auto-queue path", () => {
    expect(
      computeConfidence({ resultCount: 0, topFusedScore: 0, bothLegs: false }),
    ).toBe("coverage_gap");
    expect(COVERAGE_GAP_NOTICE).toContain("queued");
  });
});

/**
 * SERVER-SIDE EMBEDDINGS FOR THE LEGAL KB ENGINE (2026-11-22)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * WHY THIS EXISTS: the engine previously ingested keyword-only and left
 * the dense vector leg to the Python ingester (`python -m legal_ingester
 * worker` with EMBEDDINGS_API_KEY). That has two operational problems:
 *   1. it needs a laptop/CI run — the whole point of the in-Convex engine
 *      (2026-11-19) was "the Founder APK toggles it and it runs by
 *      itself";
 *   2. the Python tool must reach the embedding provider from wherever
 *      it runs — geo-restricted networks block Google's embedding
 *      endpoints even when the SAME key works from Convex's runtime.
 *
 * The Convex runtime CAN reach Gemini (it already serves ALOA/ARIA chat
 * and ai:embedContent with the platform GEMINI_API_KEY), so the engine
 * now embeds chunks itself whenever that key is present in the
 * environment. No key → keyword-only, exactly the old documented
 * boundary, and the inspector says so honestly.
 *
 * CONTRACT (matches convex/legal/schema.ts + tools/legal_ingester):
 *   - exactly 768 dimensions (the legal_chunks.by_embedding vectorIndex
 *     and the statutes/instrument_provisions pipeline are all 768);
 *   - model preference: text-embedding-004 (the platform pin, 768
 *     native), falling back to gemini-embedding-001 with
 *     outputDimensionality=768 when the pinned model is unavailable for
 *     the project (404). LEGAL_EMBEDDING_MODEL overrides both — for
 *     pinning an org's own choice without a code change;
 *   - batching: batchEmbedContents, at most EMBED_BATCH texts per call;
 *   - failure is NEVER fatal: any error returns [] and the caller
 *     ingests keyword-only (audited as embeddings.skipped).
 *
 * SECURITY: the key travels in the x-goog-api-key HEADER (S2 rule —
 * never in a URL query param), same as ai.ts.
 */

/** The vector dimension the legal_chunks vector index requires. */
export const EMBEDDING_DIMS = 768;

/** Max texts per batchEmbedContents call (provider-friendly batching). */
export const EMBED_BATCH = 32;

/** Max characters per text (mirrors the Python ingester's 8000 cap). */
export const EMBED_MAX_CHARS = 8000;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Model candidates, in order. text-embedding-004 is the platform pin
 *  (768-dim native, dimension-compatible with statutes); gemini-embedding-001
 *  is the current replacement when the pin is unavailable for the key's
 *  project (it produces 3072-dim vectors natively, so the request slices
 *  to 768 via outputDimensionality — a supported MRL cut). */
const MODEL_CANDIDATES = ["text-embedding-004", "gemini-embedding-001"];

/** Per-isolate cache of the model that last worked (avoids re-probing the
 *  404 fallback on every batch). Reset if it starts failing. */
let resolvedModel: string | null = null;

/** Is the embedding leg configured? (GEMINI_API_KEY present in the
 *  Convex environment — the same platform key ALOA chat uses.) */
export function embeddingConfigured(): boolean {
  return Boolean(embeddingApiKey());
}

function embeddingApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY || process.env.GEMINI_DEMO_KEY;
  return key && key.length > 0 ? key : undefined;
}

interface GeminiEmbedResponse {
  embeddings?: Array<{ values?: number[] }>;
}

async function callBatchEmbedContents(
  model: string,
  texts: string[],
  apiKey: string,
): Promise<number[][]> {
  const url = `${GEMINI_BASE}/models/${model}:batchEmbedContents`;
  // gemini-embedding-001 emits 3072-dim vectors unless sliced; the
  // platform pin (text-embedding-004) is already 768 and ignores the
  // field safely (it predates outputDimensionality).
  const needsDimSlice = model !== "text-embedding-004";
  const body = {
    requests: texts.map((t) => ({
      model: `models/${model}`,
      content: { parts: [{ text: t.slice(0, EMBED_MAX_CHARS) }] },
      ...(needsDimSlice ? { outputDimensionality: EMBEDDING_DIMS } : {}),
    })),
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = (await resp.text().catch(() => "")).slice(0, 300);
    const err = new Error(`HTTP ${resp.status}: ${errText}`);
    (err as any).status = resp.status;
    throw err;
  }
  const data = (await resp.json()) as GeminiEmbedResponse;
  const vectors = (data.embeddings ?? []).map((e) => e.values ?? []);
  if (vectors.length !== texts.length) {
    throw new Error(`provider returned ${vectors.length}/${texts.length} vectors`);
  }
  for (const v of vectors) {
    if (v.length !== EMBEDDING_DIMS) {
      throw new Error(
        `provider returned ${v.length}-dim vectors; legal_chunks requires ${EMBEDDING_DIMS}`,
      );
    }
  }
  return vectors;
}

/**
 * Embed a list of chunk texts with the platform Gemini key.
 * Returns [] when unconfigured or on ANY provider failure — callers
 * fall back to keyword-only ingestion and audit the skip. Never throws.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = embeddingApiKey();
  if (!apiKey) return [];

  const override = process.env.LEGAL_EMBEDDING_MODEL;
  const candidates =
    override && override.length > 0 ? [override] : resolvedModel ? [resolvedModel, ...MODEL_CANDIDATES.filter((m) => m !== resolvedModel)] : [...MODEL_CANDIDATES];

  let lastError = "";
  for (const model of candidates) {
    try {
      // Batch in provider-friendly chunks; all batches must succeed or
      // the whole call degrades to keyword-only (partial vectors would
      // misalign with the caller's chunk order).
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += EMBED_BATCH) {
        const batch = texts.slice(i, i + EMBED_BATCH);
        out.push(...(await callBatchEmbedContents(model, batch, apiKey)));
      }
      resolvedModel = model;
      return out;
    } catch (e: any) {
      lastError = String(e?.message || e).slice(0, 200);
      const status = e?.status;
      // 404 = this model is unavailable for the key's project → try the
      // next candidate. 429/5xx/network = transient or capacity: retrying
      // a different model is wrong (same provider), degrade instead.
      if (status !== 404) return [];
    }
  }
  if (lastError) {
    // Every candidate 404'd — surface the reason to the audit log via
    // the returned sentinel? No: keep the contract simple. Callers log
    // "all embedding model candidates unavailable".
  }
  return [];
}

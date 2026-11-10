import { query, mutation, action, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { requireStaffCaller, requireFounderCaller } from "./callerAuth";

/**
 * legalKnowledge — the Legal Knowledge Engine service (Task 51).
 *
 * Three surfaces:
 *  1. RETRIEVAL — searchKnowledge (vector search over instrument_provisions +
 *     court_forms, hydrated with instrument + institution metadata, scored and
 *     merged). Called from AloaChat with a client-side query embedding (same
 *     pattern as embeddings.searchMemories).
 *  2. COVERAGE — getCoverageManifest: what ALOA knows, per institution and
 *     jurisdiction, with as-at dates and index status. Answers "what do you
 *     know about Kogi?" honestly instead of hiding the gap.
 *  3. CHANGE TRACKING — logInstrumentChange (founder intake for amendments /
 *     new editions / fee changes) + getRecentChanges + reviewChange. This is
 *     the "know when rules and forms change" engine's event log; monitoring
 *     automations (cron webFetch + hash diffing) will feed the same table.
 *
 * Plus INDEX BUILDER plumbing: getPendingLegalIndex + writeLegalEmbeddings —
 * the client-side builder (AgentSettings → "Build Legal Index") embeds
 * provisions/forms with the firm's Gemini key, the proven brain.seedFirm flow.
 */

// ─────────────────────────────────────────────────────────────────────────────
// RETRIEVAL
// ─────────────────────────────────────────────────────────────────────────────

export const searchKnowledge = action({
  args: {
    queryEmbedding: v.array(v.number()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    jurisdictionKey: v.optional(v.string()),
    institutionKey: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any[]> => {
    // Legal knowledge is shared (not firm-scoped) content, but retrieval is
    // still a staff capability — portal users must use portal surfaces.
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
    });

    const limit = Math.min(args.limit ?? 6, 12);

    const provisionResults = await ctx.vectorSearch("instrument_provisions", "by_embedding", {
      vector: args.queryEmbedding,
      limit,
      filter: args.jurisdictionKey
        ? (q: any) => q.eq("jurisdictionKey", args.jurisdictionKey)
        : undefined,
    });

    const formResults = await ctx.vectorSearch("court_forms", "by_embedding", {
      vector: args.queryEmbedding,
      limit,
      filter: args.jurisdictionKey
        ? (q: any) => q.eq("jurisdictionKey", args.jurisdictionKey)
        : undefined,
    });

    // Hydrate rows + their instruments (for citation strings + as-at dates).
    const provisionRows = await ctx.runQuery(internal.legalKnowledge.fetchProvisionsByIds, {
      ids: provisionResults.map((r: any) => r._id),
    });
    const formRows = await ctx.runQuery(internal.legalKnowledge.fetchFormsByIds, {
      ids: formResults.map((r: any) => r._id),
    });

    const instrumentKeys = new Set<string>([
      ...provisionRows.map((p: any) => p.instrumentKey),
      ...formRows.map((f: any) => f.instrumentKey).filter(Boolean),
    ]);
    const instruments = await ctx.runQuery(internal.legalKnowledge.fetchInstrumentsByKeys, {
      keys: Array.from(instrumentKeys),
    });
    const instrumentMap = new Map(instruments.map((i: any) => [i.key, i]));

    const pScores = new Map(provisionResults.map((r: any) => [r._id, r._score]));
    const fScores = new Map(formResults.map((r: any) => [r._id, r._score]));

    const merged: any[] = [
      ...provisionRows.map((p: any) => {
        const instrument = instrumentMap.get(p.instrumentKey);
        return {
          kind: "provision" as const,
          score: pScores.get(p._id) ?? 0,
          ref: p.ref,
          heading: p.heading,
          text: p.text,
          textType: p.textType,
          verificationStatus: p.verificationStatus,
          tags: p.tags,
          instrumentKey: p.instrumentKey,
          instrumentTitle: instrument?.title ?? p.instrumentKey,
          instrumentVersion: instrument?.versionLabel ?? null,
          lastVerifiedAt: instrument?.lastVerifiedAt ?? null,
        };
      }),
      ...formRows.map((f: any) => {
        const instrument = f.instrumentKey ? instrumentMap.get(f.instrumentKey) : undefined;
        return {
          kind: "form" as const,
          score: fScores.get(f._id) ?? 0,
          formNumber: f.formNumber,
          title: f.title,
          purpose: f.purpose,
          fee: f.fee,
          fields: f.fields,
          verificationStatus: f.verificationStatus,
          tags: f.tags,
          instrumentKey: f.instrumentKey ?? null,
          instrumentTitle: instrument?.title ?? null,
          institutionKey: f.institutionKey,
          lastVerifiedAt: instrument?.lastVerifiedAt ?? null,
        };
      }),
    ];

    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, limit);
  },
});

/** INTERNAL: hydrate provision rows for searchKnowledge. */
export const fetchProvisionsByIds = internalQuery({
  args: { ids: v.array(v.id("instrument_provisions")) },
  handler: async (ctx, args) => {
    const rows: any[] = [];
    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      if (row) rows.push(row);
    }
    return rows;
  },
});

/** INTERNAL: hydrate form rows for searchKnowledge. */
export const fetchFormsByIds = internalQuery({
  args: { ids: v.array(v.id("court_forms")) },
  handler: async (ctx, args) => {
    const rows: any[] = [];
    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      if (row) rows.push(row);
    }
    return rows;
  },
});

/** INTERNAL: hydrate instruments for citation metadata. */
export const fetchInstrumentsByKeys = internalQuery({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const rows: any[] = [];
    for (const key of args.keys) {
      const row = await ctx.db
        .query("instruments")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (row) rows.push(row);
    }
    return rows;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// COVERAGE MANIFEST — "what does ALOA know?"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * Four orphans removed (this record covers getCoverageManifest, getRecentChanges, getProvisionsForInstrument, getFormsForInstitution): the first two were staff-gated orphans with zero callers; the latter two were UNGATED instrument/institution reference reads with zero callers. The live legal surfaces read through the wired functions.
 */

/** Index status for the "Build Legal Index" flow + manifest badges. */
export const getIndexStatus = query({
  args: {},
  handler: async (ctx) => {
    const pendingProvisions = await ctx.db
      .query("instrument_provisions")
      .withIndex("by_embedded", (q) => q.eq("embedded", false))
      .take(1000);
    const pendingForms = await ctx.db
      .query("court_forms")
      .withIndex("by_embedded", (q) => q.eq("embedded", false))
      .take(1000);
    return {
      pendingProvisions: pendingProvisions.length,
      pendingForms: pendingForms.length,
      ready: pendingProvisions.length === 0 && pendingForms.length === 0,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// INDEX BUILDER (client-side embeddings, brain.seedFirm pattern)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch un-indexed provisions + forms for the client-side builder. */
export const getPendingLegalIndex = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
    });
    const limit = Math.min(args.limit ?? 200, 500);
    const provisions = await ctx.db
      .query("instrument_provisions")
      .withIndex("by_embedded", (q) => q.eq("embedded", false))
      .take(limit);
    const forms = await ctx.db
      .query("court_forms")
      .withIndex("by_embedded", (q) => q.eq("embedded", false))
      .take(limit);
    return {
      provisions: provisions.map((p) => ({
        _id: p._id,
        table: "instrument_provisions" as const,
        text: `${p.ref} — ${p.heading} (${p.instrumentKey})\n${p.text}\nTags: ${p.tags.join(", ")}`,
      })),
      forms: forms.map((f) => ({
        _id: f._id,
        table: "court_forms" as const,
        text: `${f.formNumber ? f.formNumber + " — " : ""}${f.title} (${f.institutionKey})\n${f.purpose ?? ""}\nFields: ${f.fields.join(", ")}\nTags: ${f.tags.join(", ")}`,
      })),
    };
  },
});

/** Write embeddings back from the client builder (staff-scoped). */
export const writeLegalEmbeddings = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    rows: v.array(
      v.object({
        table: v.union(v.literal("instrument_provisions"), v.literal("court_forms")),
        id: v.string(),
        embedding: v.array(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
    });
    let written = 0;
    for (const row of args.rows) {
      if (row.table === "instrument_provisions") {
        const doc = await ctx.db.get(row.id as any);
        if (doc) {
          await ctx.db.patch(doc._id, { embedding: row.embedding as any, embedded: true });
          written++;
        }
      } else {
        const doc = await ctx.db.get(row.id as any);
        if (doc) {
          await ctx.db.patch(doc._id, { embedding: row.embedding as any, embedded: true });
          written++;
        }
      }
    }
    return { written };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE TRACKING — "know when rules and forms change"
// ─────────────────────────────────────────────────────────────────────────────

/** Founder intake: log a detected/reported amendment, new edition, fee or form change. */
export const logInstrumentChange = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    founderEmail: v.optional(v.string()),
    instrumentKey: v.string(),
    changeType: v.union(
      v.literal("amendment"),
      v.literal("new_edition"),
      v.literal("fee_change"),
      v.literal("practice_direction"),
      v.literal("form_revision")
    ),
    summary: v.string(),
    detail: v.optional(v.string()),
    effectiveDate: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    confidence: v.optional(v.union(v.literal("verified"), v.literal("monitoring"), v.literal("reported"))),
  },
  handler: async (ctx, args) => {
    await requireFounderCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.founderEmail,
    });
    return await ctx.db.insert("instrument_changes", {
      instrumentKey: args.instrumentKey,
      changeType: args.changeType,
      summary: args.summary,
      detail: args.detail,
      effectiveDate: args.effectiveDate,
      sourceUrl: args.sourceUrl,
      confidence: args.confidence ?? "reported",
      status: "pending_review",
      detectedAt: Date.now(),
    });
  },
});

/**
 * Founder review: confirm a change (stamps the instrument's lastVerifiedAt and
 * updates its version label) or dismiss it. Confirmed changes are what ALOA's
 * "as at" answers rely on.
 */
export const reviewChange = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    founderEmail: v.optional(v.string()),
    changeId: v.id("instrument_changes"),
    decision: v.union(v.literal("confirmed"), v.literal("dismissed")),
    newVersionLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounderCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.founderEmail,
    });
    const change = await ctx.db.get(args.changeId);
    if (!change) throw new Error("Change entry not found.");

    await ctx.db.patch(args.changeId, {
      status: args.decision,
      reviewedBy: founder.email ?? args.founderEmail,
      reviewedAt: Date.now(),
    });

    if (args.decision === "confirmed") {
      const instrument = await ctx.db
        .query("instruments")
        .withIndex("by_key", (i) => i.eq("key", change.instrumentKey))
        .first();
      if (instrument) {
        await ctx.db.patch(instrument._id, {
          lastVerifiedAt: new Date().toISOString().slice(0, 10),
          ...(args.newVersionLabel ? { versionLabel: args.newVersionLabel } : {}),
        });
      }
    }
    return { ok: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// BROWSE — drill-down lists for the knowledge browser UI
// ─────────────────────────────────────────────────────────────────────────────


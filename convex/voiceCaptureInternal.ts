/**
 * voiceCaptureInternal.ts — internal DB hands for the Voice Capture actions.
 *
 * Why a separate file: Convex actions have no `ctx.db` (they reach the
 * database only through runQuery/runMutation), and an action that calls
 * `internal.<its own module>` creates a circular type reference that
 * silently degrades ApiFromModules inference for the WHOLE app (observed:
 * legal/search.ts types collapsing to {}). The two-file split — the same
 * pattern as backfillDocumentFiles + backfillDocumentFilesInternal — keeps
 * the type graph acyclic: voiceCapture.ts depends on this module, never the
 * reverse.
 *
 * Every function here re-checks firm ownership server-side — internal
 * visibility is not an authorization boundary on its own.
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Firm-scap cap for list queries (mirrors the FIRM_SCAN_CAP in voiceCapture). */
const SCAN_CAP = 300;

export const upsertCaptureRow = internalMutation({
  args: {
    clientLocalId: v.string(),
    firmId: v.string(),
    userId: v.string(),
    kind: v.string(),
    outputMode: v.string(),
    startedAt: v.optional(v.number()),
    segmentCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("voiceCaptures")
      .withIndex("by_client_local_id", (q) => q.eq("clientLocalId", args.clientLocalId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("voiceCaptures", {
      clientLocalId: args.clientLocalId,
      firmId: args.firmId,
      userId: args.userId,
      kind: args.kind,
      outputMode: args.outputMode,
      status: "recording",
      startedAt: args.startedAt ?? Date.now(),
      segmentCount: args.segmentCount ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const appendSegmentToRow = internalMutation({
  args: {
    captureId: v.id("voiceCaptures"),
    firmId: v.string(),
    segment: v.object({
      storageId: v.string(),
      mimeType: v.string(),
      startMs: v.number(),
      endMs: v.number(),
      bytes: v.number(),
    }),
    segmentText: v.object({
      index: v.number(),
      text: v.string(),
      provider: v.string(),
      at: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const row: any = await ctx.db.get(args.captureId);
    if (!row) throw new Error("Capture row vanished mid-upload.");
    if (row.firmId !== args.firmId) throw new Error("Not authorized.");
    const segs = Array.isArray(row.segments) ? row.segments : [];
    const texts = Array.isArray(row.segmentTexts) ? row.segmentTexts : [];
    // Idempotency: a replayed segment index is silently skipped.
    if (texts.some((t: any) => t.index === args.segmentText.index)) {
      return { skipped: true, segmentTexts: texts };
    }
    segs.push(args.segment);
    texts.push(args.segmentText);
    await ctx.db.patch(args.captureId, {
      segments: segs,
      segmentTexts: texts,
      durationMs: Math.max(row.durationMs || 0, args.segment.endMs),
      status: "transcribing",
      updatedAt: new Date().toISOString(),
    });
    return { skipped: false, segmentTexts: texts };
  },
});

/** Read one capture, firm-checked. Returns null when missing/foreign. */
export const getCaptureInternal = internalQuery({
  args: { clientLocalId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voiceCaptures")
      .withIndex("by_client_local_id", (q) => q.eq("clientLocalId", args.clientLocalId))
      .first();
    if (!row || row.firmId !== args.firmId) return null;
    return row;
  },
});

/** Patch one capture, firm re-checked inside the transaction. */
export const patchCaptureInternal = internalMutation({
  args: { clientLocalId: v.string(), firmId: v.string(), patch: v.any() },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voiceCaptures")
      .withIndex("by_client_local_id", (q) => q.eq("clientLocalId", args.clientLocalId))
      .first();
    if (!row) throw new Error("Capture not found.");
    if (row.firmId !== args.firmId) throw new Error("Not authorized.");
    await ctx.db.patch(row._id, {
      ...args.patch,
      updatedAt: new Date().toISOString(),
    });
    return row._id;
  },
});

/** Delete a capture row and its archived audio, firm re-checked. */
export const deleteCaptureInternal = internalMutation({
  args: { clientLocalId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voiceCaptures")
      .withIndex("by_client_local_id", (q) => q.eq("clientLocalId", args.clientLocalId))
      .first();
    if (!row) throw new Error("Capture not found.");
    if (row.firmId !== args.firmId) throw new Error("Not authorized.");
    const segs: any[] = Array.isArray(row.segments) ? row.segments : [];
    for (const s of segs) {
      try {
        await ctx.storage.delete(s.storageId as any);
      } catch { /* already gone */ }
    }
    await ctx.db.delete(row._id);
    return true;
  },
});

/** Slim firm matter list for triage matching / quick ask. */
export const listFirmMattersInternal = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const rows: any[] = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
    return rows.slice(0, SCAN_CAP).map((m) => ({
      id: String(m.id ?? m._id),
      title: m.title,
      suitNumber: m.suitNumber,
      clientId: m.clientId,
      status: m.status,
      court: m.court,
    }));
  },
});

/** Slim firm contact list for client-name matching. */
export const listFirmContactsInternal = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const rows: any[] = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
    return rows.slice(0, SCAN_CAP).map((c) => ({
      id: String(c.id ?? c._id),
      name: c.name,
    }));
  },
});

/** Firm note pages (title + head of content) for quick ask grounding. */
export const listFirmNotePagesInternal = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const rows: any[] = await ctx.db
      .query("notePages")
      .filter((q) => q.eq(q.field("firmId"), args.firmId))
      .collect();
    return rows.slice(0, SCAN_CAP).map((n) => ({
      id: String(n.id ?? n._id),
      title: n.title,
      contentHead: (n.content || "").slice(0, 500),
    }));
  },
});

/** Firm calendar events for quick ask schedule questions. */
export const listFirmEventsInternal = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const rows: any[] = await ctx.db
      .query("events")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
    return rows.slice(0, SCAN_CAP).map((e) => ({
      id: String(e.id ?? e._id),
      title: e.title,
      type: e.type,
      date: e.date,
      matterTitle: e.matterTitle,
    }));
  },
});

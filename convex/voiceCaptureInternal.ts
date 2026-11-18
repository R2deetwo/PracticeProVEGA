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

/** Slim firm matter list for triage matching / quick ask.
 *
 * INTELLIGENCE UPGRADE (owner spec, 2026-11-18): the LLM matters
 * directory now carries clientName (joined via contacts) and parties so
 * the model can SEMANTICALLY match informal references ("the Chukwu
 * file", "the Lekki land case") against party names and subjects — not
 * just title/suit-number containment. ACTIVE matters sort first so the
 * prompt's cap keeps the ones a lawyer is most likely working on. */
export const listFirmMattersInternal = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const rows: any[] = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
    // Client-name join for semantic matching.
    const contacts: any[] = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
    const clientNameById = new Map<string, string>();
    for (const c of contacts) {
      if (c && c.name) clientNameById.set(String(c.id ?? c._id), String(c.name));
    }
    const projected = rows.map((m) => {
      const parties = Array.isArray(m.parties)
        ? m.parties
            .map((p: any) =>
              typeof p === "string"
                ? p
                : p && typeof p === "object"
                  ? String(p.name || p.party || "").trim()
                  : ""
            )
            .filter(Boolean)
            .slice(0, 8)
        : [];
      return {
        id: String(m.id ?? m._id),
        title: m.title,
        suitNumber: m.suitNumber,
        clientId: m.clientId,
        clientName: m.clientId ? clientNameById.get(String(m.clientId)) || null : null,
        status: m.status,
        court: m.court,
        parties,
      };
    });
    // Active matters first, then the rest (both groups keep insertion
    // order) — the prompt cap then keeps the ones being actively worked.
    const rank = (m: { status?: string | null }) =>
      String(m.status || "").toLowerCase() === "active" ? 0 : 1;
    return projected
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, SCAN_CAP);
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

// ─── QUICK ASK ACTIONS (write path, owner spec 2026-11-18 §5) ─────────────
//
// Quick Ask is no longer read-only: the LLM may return tool-style actions
// (create a diary entry / save a case note). These internal mutations are
// the server-side executors — firm-scoped, ownership-stamped (created_by /
// authorId) so the one-tap UNDO can verify the caller really created the
// item, and recent (createdAt) so undo has a bounded window.

/** The general notes notebook's stable id (mirrors client MATTERS_NOTEBOOK_ID
 *  usage: matter-linked notes live in 'notebook_matters'; standalone notes
 *  go to the caller's preferred notebook, falling back to the matters one). */
const DEFAULT_NOTEBOOK_ID = "notebook_matters";

/** Create a calendar event on behalf of Quick Ask ("add a check on the
 *  Chukwu matter for tomorrow at 10 AM"). Ownership-stamped for undo. */
export const createDiaryEventInternal = internalMutation({
  args: {
    firmId: v.string(),
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
    /** Full ISO datetime (YYYY-MM-DDTHH:MM:SS.mmmZ). */
    dateISO: v.string(),
    /** Duration in ms (default 1 hour). */
    durationMs: v.optional(v.number()),
    matterId: v.optional(v.string()),
    matterTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const start = new Date(args.dateISO);
    if (isNaN(start.getTime())) throw new Error("Invalid event date.");
    const end = new Date(start.getTime() + (args.durationMs ?? 60 * 60 * 1000));
    const inserted = await ctx.db.insert("events", {
      firmId: args.firmId,
      title: args.title,
      description: args.description ?? null,
      type: args.type ?? "Meeting",
      date: start.toISOString(),
      endDate: end.toISOString(),
      matterId: args.matterId ?? null,
      matterTitle: args.matterTitle ?? null,
      status: "Active",
      // Ownership stamp: the Quick Ask undo path verifies this.
      created_by: args.userId,
      createdAt: now,
      updatedAt: now,
    });
    // NOTE: unlike `matters`, the events table has no legacy `id` column —
    // the Convex document id IS the id (projections use `_id`).
    return { eventId: String(inserted), title: args.title, dateISO: start.toISOString() };
  },
});

/** Save a case note (optionally linked to a matter) on behalf of Quick Ask. */
export const createCaseNoteInternal = internalMutation({
  args: {
    firmId: v.string(),
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    matterId: v.optional(v.string()),
    notebookId: v.optional(v.string()),
    rawTranscript: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const inserted = await ctx.db.insert("notePages", {
      firmId: args.firmId,
      title: args.title,
      content: args.content,
      notebookId: args.notebookId || DEFAULT_NOTEBOOK_ID,
      matterId: args.matterId ?? null,
      type: "user",
      authorId: args.userId,
      createdAt: now,
      updatedAt: now,
    });
    // NOTE: the notePages table has no legacy `id` column either — the
    // Convex document id is the id.
    return { notePageId: String(inserted), title: args.title };
  },
});

/** One-tap UNDO for a Quick Ask action: delete the created item. Guarded by
 *  firm scope + ownership (created_by / authorId) + a 15-minute recency
 *  window — you can only undo YOUR OWN fresh Quick Ask items, never a
 *  colleague's edit or an old record. */
export const undoQuickAskItemInternal = internalMutation({
  args: {
    firmId: v.string(),
    userId: v.string(),
    kind: v.string(), // "event" | "note"
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.kind !== "event" && args.kind !== "note") {
      throw new Error("Unknown Quick Ask item kind.");
    }
    const row: any = await ctx.db.get(args.itemId as any);
    if (!row) throw new Error("That item no longer exists — it may already be undone.");
    if (row.firmId !== args.firmId) throw new Error("Not authorized.");
    const ownerField = args.kind === "event" ? row.created_by : row.authorId;
    if (String(ownerField ?? "") !== String(args.userId)) {
      throw new Error("Only the creator can undo this item.");
    }
    const createdMs = row.createdAt ? Date.parse(row.createdAt) : 0;
    if (!createdMs || Date.now() - createdMs > 15 * 60 * 1000) {
      throw new Error("The undo window (15 minutes) for this item has passed — delete it from the calendar or notes instead.");
    }
    await ctx.db.delete(row._id);
    return { undone: true };
  },
});

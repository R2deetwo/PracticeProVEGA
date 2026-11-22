/**
 * voxSessionsInternal.ts — internal DB hands for the Vox Session Capture
 * actions (convex/voxSessions.ts).
 *
 * Same two-file split as voiceCapture/voiceCaptureInternal: Convex actions
 * have no ctx.db, and an action that calls `internal.<its own module>`
 * creates the circular type reference that collapses ApiFromModules
 * inference app-wide. This module holds every mutation/query hand the
 * session actions need; the dependency direction is one-way.
 *
 * Every function here re-checks firm ownership server-side — internal
 * visibility is not an authorization boundary on its own.
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Session row lifecycle ─────────────────────────────────────────────────

/** Create-or-refresh the voxSessions row for a clientLocalId (idempotent —
 *  offline replays and retry storms can never double-book a session). */
export const upsertSessionRow = internalMutation({
  args: {
    clientLocalId: v.string(),
    firmId: v.string(),
    userId: v.string(),
    title: v.optional(v.string()),
    sessionType: v.optional(v.string()),
    captureSource: v.optional(v.string()),
    matterId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    segmentCount: v.optional(v.number()),
    retentionDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) =>
        q.eq("clientLocalId", args.clientLocalId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        updatedAt: now,
        // Context (title/type/matter) may be edited between setup and the
        // first upload — the freshest value wins on each replay.
        ...(args.title !== undefined ? { title: args.title } : {}),
        ...(args.sessionType !== undefined ? { sessionType: args.sessionType } : {}),
        ...(args.captureSource !== undefined ? { captureSource: args.captureSource } : {}),
        ...(args.matterId !== undefined ? { matterId: args.matterId } : {}),
        ...(args.retentionDays !== undefined ? { retentionDays: args.retentionDays } : {}),
      });
      return existing._id;
    }
    return await ctx.db.insert("voxSessions", {
      clientLocalId: args.clientLocalId,
      firmId: args.firmId,
      userId: args.userId,
      title: args.title ?? null,
      sessionType: args.sessionType ?? "meeting",
      captureSource: args.captureSource ?? "mic",
      matterId: args.matterId ?? null,
      status: "recording",
      startedAt: args.startedAt ?? Date.now(),
      segmentCount: args.segmentCount ?? undefined,
      retentionDays: args.retentionDays ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Append one uploaded segment (audio artifact + diarized turns) to the
 *  session row. Idempotent on segmentIndex — replays are silently skipped. */
export const appendSessionSegment = internalMutation({
  args: {
    clientLocalId: v.string(),
    firmId: v.string(),
    segmentIndex: v.number(),
    segment: v.object({
      storageId: v.string(),
      mimeType: v.string(),
      startMs: v.number(),
      endMs: v.number(),
      bytes: v.number(),
    }),
    /** Diarized turns for this segment: [{speaker, text}] — plain text when
     *  the diarizer fell back (speaker "1"). */
    turns: v.optional(v.array(v.object({ speaker: v.string(), text: v.string() }))),
    provider: v.string(),
    at: v.number(),
  },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) =>
        q.eq("clientLocalId", args.clientLocalId)
      )
      .first();
    if (!row) throw new Error("Session row vanished mid-upload.");
    if (row.firmId !== args.firmId) throw new Error("Not authorized.");
    if (row.deleted) {
      throw new Error("Session was deleted — refusing the in-flight segment.");
    }
    const segs = Array.isArray(row.segments) ? row.segments : [];
    if (segs.some((s: any) => s.startMs === args.segment.startMs && s.storageId === args.segment.storageId)) {
      return { skipped: true };
    }
    // Index idempotency: a replayed index with DIFFERENT storage (a re-record
    // race) still skips — the earliest upload for an index wins.
    if (segs.length > args.segmentIndex && segs[args.segmentIndex]) {
      return { skipped: true };
    }
    segs.push(args.segment);
    // Raw diarized turns, parallel to segments by index — finalize flattens
    // + reconciles these into the final speaker-attributed transcript rows.
    const segTurns = Array.isArray(row.segmentTurns) ? row.segmentTurns : [];
    if (args.turns && args.turns.length > 0) {
      segTurns.push({
        index: args.segmentIndex,
        startMs: args.segment.startMs,
        endMs: args.segment.endMs,
        turns: args.turns,
      });
    }
    await ctx.db.patch(row._id, {
      segments: segs,
      segmentTurns: segTurns,
      segmentCount: Math.max(row.segmentCount || 0, segs.length),
      durationSeconds: Math.max(row.durationSeconds || 0, Math.round(args.segment.endMs / 1000)),
      status: "transcribing",
      provider: args.provider,
      updatedAt: new Date().toISOString(),
    });
    return { skipped: false };
  },
});

/** Mark the session closed + stamp its final duration (recording stopped). */
export const closeSessionRow = internalMutation({
  args: {
    clientLocalId: v.string(),
    firmId: v.string(),
    totalDurationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) =>
        q.eq("clientLocalId", args.clientLocalId)
      )
      .first();
    if (!row) throw new Error("Session row not found.");
    if (row.firmId !== args.firmId) throw new Error("Not authorized.");
    await ctx.db.patch(row._id, {
      status: "transcribing",
      ...(args.totalDurationMs
        ? { durationSeconds: Math.max(row.durationSeconds || 0, Math.round(args.totalDurationMs / 1000)) }
        : {}),
      updatedAt: new Date().toISOString(),
    });
    return row._id;
  },
});

/** Load the owned session row by clientLocalId (firm-scoped). */
export const getSessionRowInternal = internalQuery({
  args: { clientLocalId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) =>
        q.eq("clientLocalId", args.clientLocalId)
      )
      .first();
    if (!row) return null;
    if (row.firmId !== args.firmId) return null;
    if (row.deleted) return null;
    return row;
  },
});

// ─── Transcript segments (speaker-attributed turns) ────────────────────────

/** Replace the session's transcript segments wholesale with the reconciled
 *  speaker-attributed turns (finalize writes the canonical set once). */
export const writeTranscriptSegments = internalMutation({
  args: {
    clientLocalId: v.string(),
    firmId: v.string(),
    userId: v.string(),
    turns: v.array(
      v.object({
        speakerLabel: v.string(),
        speakerRole: v.string(),
        startMs: v.number(),
        endMs: v.number(),
        text: v.string(),
        confidence: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) =>
        q.eq("clientLocalId", args.clientLocalId)
      )
      .first();
    if (!row) throw new Error("Session row not found.");
    if (row.firmId !== args.firmId) throw new Error("Not authorized.");
    // Clear any prior set (a re-finalize replaces, never duplicates).
    const prior = await ctx.db
      .query("voxTranscriptSegments")
      .withIndex("by_session", (q) => q.eq("sessionId", row._id))
      .collect();
    for (const p of prior) await ctx.db.delete(p._id);
    const now = new Date().toISOString();
    let index = 0;
    for (const t of args.turns) {
      await ctx.db.insert("voxTranscriptSegments", {
        firmId: args.firmId,
        userId: args.userId,
        sessionId: row._id,
        segmentIndex: index++,
        speakerLabel: t.speakerLabel,
        speakerRole: t.speakerRole,
        startMs: t.startMs,
        endMs: t.endMs,
        text: t.text,
        confidence: t.confidence ?? undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
    return index;
  },
});

// ─── Outputs + search chunks ───────────────────────────────────────────────

/** Write (or replace) the session's synthesis outputs row. customDrafts
 *  from a prior generation are preserved (append-only, owner artifacts). */
export const writeSessionOutputs = internalMutation({
  args: {
    clientLocalId: v.string(),
    firmId: v.string(),
    userId: v.string(),
    fileNoteMarkdown: v.optional(v.string()),
    actionItems: v.optional(
      v.array(
        v.object({
          id: v.string(),
          task: v.string(),
          owner: v.string(),
          dueDateText: v.string(),
          completed: v.boolean(),
        })
      )
    ),
    issueMap: v.optional(
      v.array(v.object({ category: v.string(), nodes: v.array(v.string()) }))
    ),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) =>
        q.eq("clientLocalId", args.clientLocalId)
      )
      .first();
    if (!row) throw new Error("Session row not found.");
    if (row.firmId !== args.firmId) throw new Error("Not authorized.");
    const existing: any = await ctx.db
      .query("voxOutputs")
      .withIndex("by_session", (q) => q.eq("sessionId", row._id))
      .first();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        fileNoteMarkdown: args.fileNoteMarkdown ?? null,
        actionItems: args.actionItems ?? [],
        issueMap: args.issueMap ?? [],
        generatedAt: Date.now(),
        model: args.model ?? null,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("voxOutputs", {
      firmId: args.firmId,
      userId: args.userId,
      sessionId: row._id,
      fileNoteMarkdown: args.fileNoteMarkdown ?? null,
      actionItems: args.actionItems ?? [],
      issueMap: args.issueMap ?? [],
      generatedAt: Date.now(),
      model: args.model ?? null,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Replace the session's voxChunks (transcript + file-note chunks) for the
 *  Ask Aloa Vox cross-session index. */
export const writeSessionChunks = internalMutation({
  args: {
    clientLocalId: v.string(),
    firmId: v.string(),
    userId: v.string(),
    matterId: v.optional(v.string()),
    chunks: v.array(
      v.object({
        kind: v.string(),
        timestampMs: v.number(),
        text: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) =>
        q.eq("clientLocalId", args.clientLocalId)
      )
      .first();
    if (!row) throw new Error("Session row not found.");
    if (row.firmId !== args.firmId) throw new Error("Not authorized.");
    const prior = await ctx.db
      .query("voxChunks")
      .withIndex("by_session", (q) => q.eq("sessionId", row._id))
      .collect();
    for (const p of prior) await ctx.db.delete(p._id);
    const now = new Date().toISOString();
    for (const c of args.chunks) {
      await ctx.db.insert("voxChunks", {
        firmId: args.firmId,
        userId: args.userId,
        matterId: args.matterId ?? null,
        sessionId: row._id,
        kind: c.kind,
        timestampMs: c.timestampMs,
        text: c.text,
        createdAt: now,
      });
    }
    return args.chunks.length;
  },
});

/** Append one custom follow-up draft (client recap / memo / instruction
 *  confirmation) to the session's outputs row. */
export const appendCustomDraft = internalMutation({
  args: {
    clientLocalId: v.string(),
    firmId: v.string(),
    draft: v.object({ type: v.string(), content: v.string(), createdAt: v.number() }),
  },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) =>
        q.eq("clientLocalId", args.clientLocalId)
      )
      .first();
    if (!row) throw new Error("Session row not found.");
    if (row.firmId !== args.firmId) throw new Error("Not authorized.");
    const existing: any = await ctx.db
      .query("voxOutputs")
      .withIndex("by_session", (q) => q.eq("sessionId", row._id))
      .first();
    if (!existing) throw new Error("Session outputs not generated yet.");
    const drafts = Array.isArray(existing.customDrafts) ? existing.customDrafts : [];
    drafts.push(args.draft);
    await ctx.db.patch(existing._id, {
      customDrafts: drafts,
      updatedAt: new Date().toISOString(),
    });
    return drafts.length;
  },
});

// ─── Session status / read paths ───────────────────────────────────────────

/** Patch the session row (status, error, provider — finalize hands). */
export const patchSessionInternal = internalMutation({
  args: {
    clientLocalId: v.string(),
    firmId: v.string(),
    patch: v.any(),
  },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) =>
        q.eq("clientLocalId", args.clientLocalId)
      )
      .first();
    if (!row) throw new Error("Session row not found.");
    if (row.firmId !== args.firmId) throw new Error("Not authorized.");
    await ctx.db.patch(row._id, { ...args.patch, updatedAt: new Date().toISOString() });
    return row._id;
  },
});

/** The firm's matters (titles + people) for session context prompts. */
export const listFirmMattersForVoxInternal = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const rows: any[] = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
    return rows.slice(0, 300).map((m) => ({
      id: String(m.id ?? m._id),
      title: String(m.title || ""),
      clientName: m.clientName || null,
    }));
  },
});

/** Read a session's final transcript turns (speaker-attributed, in order). */
export const listSessionTurnsInternal = internalQuery({
  args: { clientLocalId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) =>
        q.eq("clientLocalId", args.clientLocalId)
      )
      .first();
    if (!row || row.firmId !== args.firmId || row.deleted) return [];
    const segRows: any[] = await ctx.db
      .query("voxTranscriptSegments")
      .withIndex("by_session", (q) => q.eq("sessionId", row._id))
      .collect();
    return segRows
      .sort((a: any, b: any) => (a.segmentIndex || 0) - (b.segmentIndex || 0))
      .map((s: any) => ({
        speakerLabel: String(s.speakerLabel || "Speaker 1"),
        speakerRole: String(s.speakerRole || "other"),
        startMs: Number(s.startMs || 0),
        endMs: Number(s.endMs || 0),
        text: String(s.text || ""),
      }));
  },
});

/** The Ask Vox retrieval pass: full-text search over the user's voxChunks
 *  with the session title + type joined on, optional matter scope. The
 *  search index itself filters firmId+userId — cross-workspace leakage is
 *  impossible — and this query additionally re-verifies both before
 *  joining, then caps the result set. */
export const searchVoxChunksInternal = internalQuery({
  args: {
    firmId: v.string(),
    userId: v.string(),
    query: v.string(),
    matterId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Convex full-text search wants a keyword query; strip punctuation but
    // keep the raw words (the LLM synthesis sees the original question).
    const searchQuery = String(args.query || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .slice(0, 12)
      .join(" ")
      .trim();
    if (!searchQuery) return [];
    let results: any[] = [];
    try {
      results = await ctx.db
        .query("voxChunks")
        .withSearchIndex("search_text", (q: any) =>
          q.search("text", searchQuery).eq("firmId", args.firmId).eq("userId", args.userId)
        )
        .take(48);
    } catch {
      return [];
    }
    // Re-verify the index filters (defence in depth) + apply the matter scope.
    const filtered = results.filter(
      (r: any) =>
        r.firmId === args.firmId &&
        r.userId === args.userId &&
        (!args.matterId || r.matterId === args.matterId)
    );
    // Join the session titles (one read per distinct session, capped).
    const titleCache = new Map<string, { title: string | null; sessionType: string | null; clientLocalId: string }>();
    const out: any[] = [];
    for (const r of filtered.slice(0, 48)) {
      const key = String(r.sessionId);
      if (!titleCache.has(key)) {
        const s: any = await ctx.db.get(r.sessionId as any);
        titleCache.set(key, {
          title: s?.title ?? null,
          sessionType: s?.sessionType ?? null,
          clientLocalId: String(s?.clientLocalId || ""),
        });
      }
      const meta = titleCache.get(key)!;
      out.push({
        clientLocalId: meta.clientLocalId,
        sessionId: key,
        title: meta.title,
        sessionType: meta.sessionType,
        matterId: r.matterId ?? null,
        timestampMs: Number(r.timestampMs || 0),
        kind: String(r.kind || "transcript"),
        snippet: String(r.text || "").slice(0, 600),
      });
    }
    return out;
  },
});

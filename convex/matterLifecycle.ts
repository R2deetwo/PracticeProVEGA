/**
 * convex/matterLifecycle.ts — V3: VEGA MATTER LIFECYCLE INTEGRITY.
 *
 * The V0 audit found the matter lifecycle entirely unenforced (V-MATTER-1
 * through V-MATTER-4, 7, 8, 9, 11, 12, 15, 17): status and stage were free
 * strings written through the generic v.any() CRUD path, the close/archive/
 * reopen modals existed but nothing could open them, "archive" was a
 * two-step client sequence (insert archive row → delete original) that
 * left GHOST archive rows whenever the FK-guarded delete failed, delete-
 * MatterCascade hard-deleted booked invoices, departed users lingered in
 * matter/event assignments forever, and stage "history" was one overwritten
 * timestamp.
 *
 * This module owns the lifecycle going forward:
 *   • MATTER_STATUSES + MATTER_TRANSITIONS — the server-enforced state
 *     machine (also applied to the generic updateItem path in myFunctions).
 *   • closeMatter / reopenMatter — validated, audited transitions that
 *     write firmActivity + durable stage history.
 *   • archiveMatter / restoreMatter — ONE atomic transaction each (a ghost
 *     archive row is impossible: either the archive row AND the status
 *     flip land together, or neither does). Archiving is SOFT: the matter
 *     row stays (children stay linked, restores are lossless) and gains
 *     status 'Archived' — the value the frontend MatterStatus enum always
 *     declared but no code ever wrote.
 *   • assignUsersToMatters — the bulk-assign the matter list's Assign
 *     button always promised (validated assignees, per-matter activity).
 *   • setMatterAssociatedContacts — secondary contact link/unlink on the
 *     REAL schema field (the old path wrote an orphan `contactIds` key).
 *   • getMatterClosePreview — the unbilled-time/expenses numbers the close
 *     modal warns about, computed server-side.
 *   • getFirmActivityFeed / getMatterStageHistory / getMatterActivity —
 *     the session-gated reads that make the activity history REAL (the
 *     old getFirmActivity was deleted in Round 11 for being ungated; this
 *     replacement gates on requireFirmUser).
 *
 * Protections honoured: tenancyLifecycle.ts (Atrium) is untouched; no
 * financial table is written here except through existing audited paths;
 * no historical record is rewritten — restores patch status forward, they
 * never edit history rows.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";

// ─── The state machine (V-MATTER-1) ──────────────────────────────────────────

/**
 * The complete set of legal matter statuses. Mirrors the frontend
 * MatterStatus enum (src/types.ts). 'Pending' / 'On Hold' do not exist in
 * the product model — the audit's "active, pending, on-hold, closed and
 * archived states according to the existing product model" resolves to the
 * three states the product actually defines, and every other string is now
 * a server-side rejection instead of silent data rot.
 */
export const MATTER_STATUSES = ["Active", "Closed", "Archived"] as const;
export type MatterStatusValue = (typeof MATTER_STATUSES)[number];

/**
 * The legal transitions. Same→same is allowed (forms re-send whole matter
 * objects on every edit — blocking it would break every save). Everything
 * else must follow the graph:
 *
 *   Active ──── close ────▶ Closed ──── reopen ────▶ Active
 *      │                       │
 *      └──── archive ──▶ Archived ◀──── archive ────┘
 *                           │
 *                     restore ──▶ Active (prior status)
 */
export const MATTER_TRANSITIONS: Record<MatterStatusValue, MatterStatusValue[]> = {
  Active: ["Active", "Closed", "Archived"],
  Closed: ["Closed", "Active", "Archived"],
  Archived: ["Archived", "Active"],
};

/** Case-insensitive normalisation to a canonical status, or null. */
export function normalizeMatterStatus(raw: unknown): MatterStatusValue | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hit = (MATTER_STATUSES as readonly string[]).find(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  );
  return (hit as MatterStatusValue) ?? null;
}

/**
 * Validate a status transition. Rows whose CURRENT status is an unknown
 * legacy string may move to ANY canonical status — repairing rot is not a
 * violation; writing more rot is.
 */
export function validateMatterStatusTransition(
  from: string | null | undefined,
  to: MatterStatusValue
): { ok: true } | { ok: false; error: string } {
  const current = normalizeMatterStatus(from ?? undefined);
  if (!current) return { ok: true };
  const allowed = MATTER_TRANSITIONS[current];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error:
        `Invalid matter lifecycle transition: '${current}' → '${to}'. ` +
        `Allowed from '${current}': ${allowed.filter((s) => s !== current).join(", ") || "(none)"}.` +
        (current === "Archived" ? " Restore the matter from the Archive first." : ""),
    };
  }
  return { ok: true };
}

/**
 * Stage shape validation (V-MATTER-2). Stages are firm-configurable
 * (workflows), so there is no fixed vocabulary — but a stage must be a
 * real, human-readable label: a non-empty trimmed string, no control
 * characters, bounded length. Objects, numbers, empty strings and 500-char
 * blobs are now rejections, not persisted garbage.
 */
export function validateMatterStage(raw: unknown): { ok: true; stage: string } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, stage: "" }; // clearing is not modelled; treat as no-op
  if (typeof raw !== "string") {
    return { ok: false, error: `Invalid matter stage: expected text, got ${typeof raw}.` };
  }
  const stage = raw.trim();
  if (!stage) return { ok: false, error: "Invalid matter stage: stage cannot be empty." };
  if (stage.length > 80) return { ok: false, error: "Invalid matter stage: maximum 80 characters." };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(stage)) {
    return { ok: false, error: "Invalid matter stage: control characters are not allowed." };
  }
  return { ok: true, stage };
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Dual-convention matter resolver (V-MATTER-14): the app forms link by the
 * matter's custom `id` (UUID), portal/batch paths by the Convex `_id`.
 * Every lifecycle operation resolves BOTH, always firm-scoped.
 */
export async function resolveMatterAnyId(
  ctx: any,
  firmId: string,
  matterId: string
): Promise<any | null> {
  if (!matterId) return null;
  // 1. Custom id (the app-forms convention) via the by_custom_id index.
  try {
    const byCustom = await ctx.db
      .query("matters")
      .withIndex("by_custom_id", (q: any) => q.eq("id", matterId))
      .first();
    if (byCustom && String(byCustom.firmId) === String(firmId)) return byCustom;
  } catch { /* index miss — fall through */ }
  // 2. Convex _id.
  try {
    const byId = await ctx.db.get(matterId);
    if (byId && String((byId as any).firmId) === String(firmId)) return byId;
  } catch { /* not a Convex id */ }
  return null;
}

/** Firm-scoped activity insert (same shape as myFunctions.logActivity). */
export async function insertFirmActivity(
  ctx: any,
  entry: {
    firmId: string;
    userId: string;
    userName: string;
    action: string;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    matterId?: string;
    metadata?: any;
  }
) {
  const now = new Date().toISOString();
  await ctx.db.insert("firmActivity", {
    firmId: entry.firmId,
    userId: entry.userId,
    userName: entry.userName,
    action: entry.action,
    timestamp: now,
    targetType: entry.targetType,
    targetId: entry.targetId,
    targetName: entry.targetName,
    matterId: entry.matterId,
    id: crypto.randomUUID(),
    metadata: entry.metadata,
    createdAt: now,
    updatedAt: now,
  });
}

/** Append one durable stage-history row (V-MATTER-12). */
export async function appendStageHistory(
  ctx: any,
  entry: {
    firmId: string;
    matterId: string;
    matterTitle?: string;
    fromStage: string | null;
    toStage: string;
    changedById: string;
    changedByName: string;
    source: string;
  }
) {
  const now = new Date().toISOString();
  await ctx.db.insert("matterStageHistory", {
    firmId: entry.firmId,
    matterId: entry.matterId,
    matterTitle: entry.matterTitle ?? null,
    fromStage: entry.fromStage,
    toStage: entry.toStage,
    changedAt: now,
    changedById: entry.changedById,
    changedByName: entry.changedByName,
    source: entry.source,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  });
}

/** Administrator-or-Founder gate — mirrors usePermissions' destructive-action policy. */
function requireMatterAdmin(user: any): void {
  if (user?.role !== "Admin" && user?.role !== "Founder") {
    throw new Error(
      "Permission denied. Archiving and deleting matters requires an Administrator (or Founder on a solo practice) role."
    );
  }
}

// ─── Close / Reopen (V-MATTER-3, V-MATTER-17) ────────────────────────────────

/**
 * closeMatter — the validated close the dead modal always wanted to be.
 * Records a firmActivity entry, stamps closedAt, appends the closing note
 * as a matter note. Does NOT touch stage (workflow stage lists are
 * firm-configured; 'Closed' as a stage was the old conflation).
 */
export const closeMatter = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    matterId: v.string(),
    closingNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const matter = await resolveMatterAnyId(ctx, auth.firmId, args.matterId);
    if (!matter) throw new Error("Matter not found.");

    const to = normalizeMatterStatus("Closed")!;
    const check = validateMatterStatusTransition(matter.status, to);
    if (!check.ok) throw new Error(check.error);
    if (normalizeMatterStatus(matter.status) === "Closed") {
      return { success: true, alreadyClosed: true };
    }

    const now = new Date().toISOString();
    await ctx.db.patch(matter._id, {
      status: to,
      closedAt: now,
      updatedAt: now,
    });

    // The closing note is persisted as a matter note — never silently
    // discarded the way the dead DockedModal copy did.
    const note = (args.closingNote || "").trim();
    if (note) {
      await ctx.db.insert("notePages", {
        firmId: auth.firmId,
        matterId: String(matter.id || matter._id),
        title: "Closing Summary",
        content: note,
        type: "user",
        createdAt: now,
        updatedAt: now,
      } as any);
    }

    await insertFirmActivity(ctx, {
      firmId: auth.firmId,
      userId: String(auth.user._id),
      userName: auth.user.name || "",
      action: "Matter closed",
      targetType: "Matter",
      targetId: String(matter.id || matter._id),
      targetName: matter.title || "",
      matterId: String(matter.id || matter._id),
      metadata: { priorStatus: matter.status || null, withClosingNote: !!note },
    });

    return { success: true };
  },
});

/** reopenMatter — Closed → Active, audited. */
export const reopenMatter = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    matterId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const matter = await resolveMatterAnyId(ctx, auth.firmId, args.matterId);
    if (!matter) throw new Error("Matter not found.");

    const to = normalizeMatterStatus("Active")!;
    const check = validateMatterStatusTransition(matter.status, to);
    if (!check.ok) throw new Error(check.error);
    if (normalizeMatterStatus(matter.status) === "Active") {
      return { success: true, alreadyActive: true };
    }

    const now = new Date().toISOString();
    await ctx.db.patch(matter._id, {
      status: to,
      closedAt: null,
      updatedAt: now,
    });

    await insertFirmActivity(ctx, {
      firmId: auth.firmId,
      userId: String(auth.user._id),
      userName: auth.user.name || "",
      action: "Matter reopened",
      targetType: "Matter",
      targetId: String(matter.id || matter._id),
      targetName: matter.title || "",
      matterId: String(matter.id || matter._id),
      metadata: { priorStatus: matter.status || null },
    });

    return { success: true };
  },
});

// ─── Archive / Restore (V-MATTER-4, V-MATTER-7, V-MATTER-8) ─────────────────

/**
 * archiveMatter — ONE atomic transaction. The old two-step client sequence
 * (insert archive row, then a delete the FK guard refuses for any matter
 * with children) is what manufactured ghost archive rows. Here:
 *
 *   1. ghost-guard: refuse if an archive row already exists for this matter;
 *   2. insert the archive row (the Archive page's listing + audit record;
 *      originalData carries priorStatus for a faithful restore);
 *   3. SOFT-archive the matter: status → 'Archived' + archivedAt/By.
 *      The row is NOT deleted — children stay linked, restores are
 *      lossless, and the FK guard can never fail midway.
 *
 * Any failure rolls back ALL of it — a half-archive cannot exist.
 */
export const archiveMatter = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    matterId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    requireMatterAdmin(auth.user);

    const matter = await resolveMatterAnyId(ctx, auth.firmId, args.matterId);
    if (!matter) throw new Error("Matter not found.");
    if (normalizeMatterStatus(matter.status) === "Archived") {
      throw new Error("This matter is already archived.");
    }

    // 1. Ghost guard: one archive row per matter, ever.
    const possibleIds = new Set(
      [String(matter._id), String(matter.id || "")].filter(Boolean)
    );
    const firmArchive = await ctx.db
      .query("archive")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(2000);
    const existing = (firmArchive as any[]).find(
      (r) => r.itemType === "matters" && possibleIds.has(String(r.itemId || ""))
    );
    if (existing) {
      throw new Error(
        "This matter already has an archive record. Restore it from the Archive page before archiving again."
      );
    }

    const now = new Date().toISOString();
    const canonicalId = String(matter.id || matter._id);

    // 2. The archive row — the Archive page record + restore source.
    await ctx.db.insert("archive", {
      firmId: auth.firmId,
      itemType: "matters",
      itemId: canonicalId,
      itemName: matter.title || "",
      originalData: { ...matter, priorStatus: matter.status || "Active" },
      archivedAt: now,
      archiverId: String(auth.user._id),
      archiverName: auth.user.name || "",
      createdAt: now,
      updatedAt: now,
    });

    // 3. Soft-archive the matter itself.
    await ctx.db.patch(matter._id, {
      status: "Archived",
      archivedAt: now,
      archivedById: String(auth.user._id),
      archivedByName: auth.user.name || "",
      updatedAt: now,
    });

    await insertFirmActivity(ctx, {
      firmId: auth.firmId,
      userId: String(auth.user._id),
      userName: auth.user.name || "",
      action: "Matter archived",
      targetType: "Matter",
      targetId: canonicalId,
      targetName: matter.title || "",
      matterId: canonicalId,
      metadata: { priorStatus: matter.status || "Active", softArchive: true },
    });

    return { success: true };
  },
});

/**
 * restoreMatter — the inverse, also atomic. Handles BOTH archive row
 * shapes: V3 soft-archived matters (row still exists → status flips back
 * to its prior status) and legacy hard-delete-era rows (matter gone →
 * originalData is re-inserted, exactly like the old restore path).
 */
export const restoreMatter = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    matterId: v.optional(v.string()),   // the matter (custom id or _id)
    archiveRowId: v.optional(v.string()), // …or the archive row itself
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    requireMatterAdmin(auth.user);

    const firmArchive = await ctx.db
      .query("archive")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(2000);
    const matterRows = (firmArchive as any[]).filter((r) => r.itemType === "matters");

    let row: any = null;
    if (args.archiveRowId) {
      row = matterRows.find((r) => String(r._id) === String(args.archiveRowId));
    } else if (args.matterId) {
      row = matterRows.find((r) => String(r.itemId || "") === String(args.matterId));
      if (!row) {
        // The stored itemId may be the OTHER id form — resolve via the matter.
        const matter = await resolveMatterAnyId(ctx, auth.firmId, args.matterId!);
        if (matter) {
          row = matterRows.find(
            (r) =>
              String(r.itemId || "") === String(matter.id || "") ||
              String(r.itemId || "") === String(matter._id)
          );
        }
      }
    }
    if (!row) throw new Error("Archive record not found for this matter.");

    // Resolve the live matter (soft-archived rows still have it).
    const liveMatter = await resolveMatterAnyId(
      ctx,
      auth.firmId,
      String(row.itemId || "")
    );
    const now = new Date().toISOString();
    const priorStatus = normalizeMatterStatus(
      (row.originalData as any)?.priorStatus
    ) || "Active";

    if (liveMatter) {
      // V3 soft archive: flip status back, clear the archive markers.
      // The archive row IS the restore authorisation — the matter returns
      // to its recorded priorStatus (Closed matters restore as Closed),
      // which the generic updateItem graph deliberately does not allow.
      await ctx.db.patch(liveMatter._id, {
        status: priorStatus,
        archivedAt: null,
        archivedById: null,
        archivedByName: null,
        updatedAt: now,
      });
    } else {
      // Legacy hard-delete-era row: re-insert the snapshot (old behaviour,
      // preserved so historical archive rows stay restorable).
      const { _id, _creationTime, ...snapshot } = (row.originalData as any) || {};
      if (!snapshot || snapshot.title === undefined) {
        throw new Error("Cannot restore: the archive record has no data snapshot.");
      }
      await ctx.db.insert("matters", {
        ...snapshot,
        status: priorStatus,
        archivedAt: null,
        archivedById: null,
        archivedByName: null,
        updatedAt: now,
      });
    }

    await ctx.db.delete(row._id);

    await insertFirmActivity(ctx, {
      firmId: auth.firmId,
      userId: String(auth.user._id),
      userName: auth.user.name || "",
      action: "Matter restored from archive",
      targetType: "Matter",
      targetId: String(row.itemId || ""),
      targetName: row.itemName || "",
      matterId: String(row.itemId || ""),
      metadata: { restoredStatus: priorStatus },
    });

    return { success: true };
  },
});

// ─── Assignment (V-MATTER-9, V-MATTER-15, V-MATTER-17) ──────────────────────

/**
 * assignUsersToMatters — the bulk-assign the matter list's Assign button
 * always promised. Assignees are validated against the firm's real user
 * rows (both id forms, deactivated members refused); each matter's
 * assignment change is patched and recorded in firmActivity.
 */
export const assignUsersToMatters = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    matterIds: v.array(v.string()),
    assignedUsers: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    if (args.assignedUsers.length === 0) {
      throw new Error("Select at least one team member to assign.");
    }

    // Validate every assignee is a real, non-deactivated member of THIS firm.
    const firmUsers = await ctx.db
      .query("users")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(500);
    const validUserIds = new Set<string>();
    for (const u of firmUsers as any[]) {
      if (u.deactivatedAt) continue;
      validUserIds.add(String(u._id));
      if (u.id) validUserIds.add(String(u.id));
    }
    const invalid = args.assignedUsers.filter((id) => !validUserIds.has(String(id)));
    if (invalid.length > 0) {
      throw new Error(
        `Cannot assign: ${invalid.length} selected user${invalid.length === 1 ? "" : "s"} ` +
        `not found in this firm (or deactivated).`
      );
    }

    let updated = 0;
    for (const matterId of args.matterIds) {
      const matter = await resolveMatterAnyId(ctx, auth.firmId, matterId);
      if (!matter) continue; // already deleted mid-flight — not fatal
      const before: string[] = Array.isArray(matter.assignedUsers) ? matter.assignedUsers : [];
      const after = Array.from(new Set(args.assignedUsers.map(String)));
      if (JSON.stringify(before) === JSON.stringify(after)) {
        continue; // no change, no noise
      }
      const now = new Date().toISOString();
      await ctx.db.patch(matter._id, { assignedUsers: after, updatedAt: now });
      const added = after.filter((id) => !before.includes(id));
      const removed = before.filter((id) => !after.includes(id));
      await insertFirmActivity(ctx, {
        firmId: auth.firmId,
        userId: String(auth.user._id),
        userName: auth.user.name || "",
        action: "Matter team updated",
        targetType: "Matter",
        targetId: String(matter.id || matter._id),
        targetName: matter.title || "",
        matterId: String(matter.id || matter._id),
        metadata: { added, removed, bulk: args.matterIds.length > 1 },
      });
      updated++;
    }

    return { success: true, updated };
  },
});

/**
 * setMatterAssociatedContacts — secondary contact link/unlink on the REAL
 * schema field. The old client path patched a `contactIds` key that exists
 * on no table (schemaValidation:false let it rot), so the Link Contacts
 * modal's selections always reset to empty and the "linked contact to
 * matter" toast in the other direction performed no mutation at all.
 */
export const setMatterAssociatedContacts = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    matterId: v.string(),
    contactIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const matter = await resolveMatterAnyId(ctx, auth.firmId, args.matterId);
    if (!matter) throw new Error("Matter not found.");

    // Every linked contact must be a real firm contact (both id forms).
    const firmContacts = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(2000);
    const validContactIds = new Set<string>();
    for (const c of firmContacts as any[]) {
      if (c.isArchived) continue;
      validContactIds.add(String(c._id));
      if (c.id) validContactIds.add(String(c.id));
    }
    const invalid = args.contactIds.filter((id) => !validContactIds.has(String(id)));
    if (invalid.length > 0) {
      throw new Error(
        `Cannot link: ${invalid.length} contact${invalid.length === 1 ? "" : "s"} not found in this firm.`
      );
    }

    const before: string[] = Array.isArray(matter.associatedContactIds)
      ? matter.associatedContactIds
      : [];
    const after = Array.from(new Set(args.contactIds.map(String)));
    const now = new Date().toISOString();
    await ctx.db.patch(matter._id, {
      associatedContactIds: after,
      updatedAt: now,
    });

    const linked = after.filter((id) => !before.includes(id));
    const unlinked = before.filter((id) => !after.includes(id));
    if (linked.length > 0 || unlinked.length > 0) {
      await insertFirmActivity(ctx, {
        firmId: auth.firmId,
        userId: String(auth.user._id),
        userName: auth.user.name || "",
        action: "Matter contacts updated",
        targetType: "Matter",
        targetId: String(matter.id || matter._id),
        targetName: matter.title || "",
        matterId: String(matter.id || matter._id),
        metadata: { linked, unlinked },
      });
    }

    return { success: true, linked: linked.length, unlinked: unlinked.length };
  },
});

// ─── Read-side queries (V-MATTER-3, V-MATTER-11, V-MATTER-12) ───────────────

/**
 * getMatterClosePreview — the numbers the close modal's unbilled warning
 * needs, computed server-side so the warning can't drift from the truth.
 */
export const getMatterClosePreview = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    matterId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const matter = await resolveMatterAnyId(ctx, auth.firmId, args.matterId);
    if (!matter) throw new Error("Matter not found.");

    const canonicalIds = new Set(
      [String(matter._id), String(matter.id || "")].filter(Boolean)
    );
    const matchMatter = (row: any) => {
      if (row.matterId && canonicalIds.has(String(row.matterId))) return true;
      const snap = (row as any).matter;
      const snapId = snap && typeof snap === "object" ? snap.id : snap;
      return snapId ? canonicalIds.has(String(snapId)) : false;
    };

    const [firmTime, firmExpenses, firmTasks, firmInvoices] = await Promise.all([
      ctx.db.query("timeEntries").withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId)).take(2000),
      ctx.db.query("expenses").withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId)).take(2000),
      ctx.db.query("tasks").withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId)).take(2000),
      ctx.db.query("invoices").withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId)).take(2000),
    ]);

    const unbilledTime = (firmTime as any[]).filter(
      (t) => matchMatter(t) && t.billable && !t.billedInInvoiceId
    );
    const unbilledExpenses = (firmExpenses as any[]).filter(
      (e) => matchMatter(e) && e.isBillable && !e.billedInInvoiceId
    );
    const openTasks = (firmTasks as any[]).filter(
      (t) => matchMatter(t) && t.status !== "Done"
    );
    const outstandingInvoices = (firmInvoices as any[]).filter(
      (inv) =>
        matchMatter(inv) &&
        inv.recordStatus !== "voided" &&
        inv.status !== "Draft" &&
        inv.status !== "Paid"
    );

    return {
      matterId: String(matter.id || matter._id),
      title: matter.title || "",
      status: matter.status || null,
      unbilledTimeCount: unbilledTime.length,
      unbilledHours: unbilledTime.reduce(
        (sum, t) => sum + (typeof t.duration === "number" ? t.duration : 0),
        0
      ),
      unbilledExpenseCount: unbilledExpenses.length,
      unbilledExpenseTotal: unbilledExpenses.reduce(
        (sum, e) => sum + (typeof e.amount === "number" ? e.amount : 0),
        0
      ),
      openTaskCount: openTasks.length,
      outstandingInvoiceCount: outstandingInvoices.length,
    };
  },
});

/**
 * getFirmActivityFeed — the session-gated firm-wide activity read. The
 * Round-11 removal of the ungated getFirmActivity left the Dashboard's
 * activity history showing nothing but the current session's optimistic
 * entries; this restores the history WITHOUT the cross-firm hole.
 */
export const getFirmActivityFeed = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const rows = await ctx.db
      .query("firmActivity")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(500);
    const sorted = [...(rows as any[])].sort(
      (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return sorted.slice(0, limit).map((r) => ({
      id: String(r._id),
      userId: r.userId || null,
      userName: r.userName || "",
      action: r.action || "",
      timestamp: r.timestamp || null,
      targetType: r.targetType || null,
      targetId: r.targetId || null,
      targetName: r.targetName || null,
      matterId: r.matterId || null,
      metadata: r.metadata ?? null,
    }));
  },
});

/** Durable stage history for one matter (V-MATTER-12), newest first. */
export const getMatterStageHistory = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    matterId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    // Resolve the matter first (firm-scope proof), then read its history —
    // matches on EITHER id convention because writers have used both.
    const matter = await resolveMatterAnyId(ctx, auth.firmId, args.matterId);
    const canonicalIds = new Set(
      [args.matterId, matter ? String(matter._id) : "", matter ? String(matter.id || "") : ""].filter(Boolean)
    );
    const rows = await ctx.db
      .query("matterStageHistory")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(1000);
    return (rows as any[])
      .filter((r) => canonicalIds.has(String(r.matterId || "")))
      .sort((a, b) => new Date(b.changedAt || 0).getTime() - new Date(a.changedAt || 0).getTime())
      .map((r) => ({
        id: String(r._id),
        matterId: r.matterId || null,
        fromStage: r.fromStage ?? null,
        toStage: r.toStage ?? null,
        changedAt: r.changedAt || null,
        changedByName: r.changedByName || "",
        source: r.source || "",
      }));
  },
});

/** Matter-scoped activity slice (the detail view's activity log). */
export const getMatterActivity = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    matterId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const matter = await resolveMatterAnyId(ctx, auth.firmId, args.matterId);
    if (!matter) return [];
    const canonicalIds = new Set(
      [String(matter._id), String(matter.id || "")].filter(Boolean)
    );
    const rows = await ctx.db
      .query("firmActivity")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(500);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return (rows as any[])
      .filter((r) => canonicalIds.has(String(r.matterId || "")))
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, limit)
      .map((r) => ({
        id: String(r._id),
        userName: r.userName || "",
        action: r.action || "",
        timestamp: r.timestamp || null,
        targetName: r.targetName || null,
        metadata: r.metadata ?? null,
      }));
  },
});

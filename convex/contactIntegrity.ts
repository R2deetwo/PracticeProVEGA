/**
 * convex/contactIntegrity.ts — V3: contact truth (V-MATTER-5, V-MATTER-16).
 *
 * The V0 audit found contact identity being destroyed in three ways:
 *
 *   1. NO DEDUP ANYWHERE on the automated creation paths — the matter form's
 *      "+ Create Profile", the enterprise wizard (which creates contacts with
 *      email: ''), and portal invitations (email→NAME fallback, so an invite
 *      with a differently-cased name created a second contact for the same
 *      person) could all mint duplicates of an existing client.
 *   2. MERGING DESTROYED PORTAL IDENTITY — the merge flow re-pointed
 *      matters.clientId + properties.contactId then HARD-DELETED the source
 *      row: if the source was the portal-linked contact, its `userId` link
 *      died with it and the client lost their portal. Secondary
 *      relationships (associatedContactIds, litigation parties, tenancies,
 *      property relationships) were orphaned, no merge audit existed, and
 *      notes on the source were silently lost.
 *   3. PHONE MATCHING was exact-string — "+234 803…" vs "0803…" vs
 *      "234803…" never matched, so inbound WhatsApp resolved to nothing.
 *
 * This module owns contact identity going forward. Rules:
 *   • Email is the primary identity. An email match is authoritative.
 *   • Phone matches are a WARNING, never a merge — different people
 *     legitimately share numbers.
 *   • Display-name matches are the weakest signal of all: nothing in this
 *     module EVER merges (or blocks) solely because two names look alike.
 *   • Merging is one atomic server transaction that preserves the portal
 *     link, re-points every relationship, keeps the source's data on the
 *     survivor, and leaves an auditable soft-deleted tombstone.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";
import { insertFirmActivity } from "./matterLifecycle";

// ─── Normalisation helpers ───────────────────────────────────────────────────

export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/** Digits-only phone normalisation (the residentContactSync convention). */
export function digitsOnly(phone: unknown): string {
  return typeof phone === "string" ? phone.replace(/\D/g, "") : "";
}

/** Phones are comparable when the digits match — full E.164 equality OR
 *  the trailing local-number core (0803… local form vs 234803… E.164 form). */
export function phonesMatch(a: unknown, b: unknown): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (da.length < 7 || db.length < 7) return false;
  if (da === db) return true;
  return da.length >= 10 && db.length >= 10 && da.slice(-10) === db.slice(-10);
}

/** Resolve a contact by Convex _id OR custom `id` (both app conventions). */
export async function resolveContactAnyId(
  ctx: any,
  firmId: string,
  contactId: string
): Promise<any | null> {
  if (!contactId) return null;
  try {
    const byCustom = await ctx.db
      .query("contacts")
      .withIndex("by_custom_id", (q: any) => q.eq("id", contactId))
      .first();
    if (byCustom && String(byCustom.firmId) === String(firmId)) return byCustom;
  } catch { /* fall through */ }
  try {
    const byId = await ctx.db.get(contactId);
    if (byId && String((byId as any).firmId) === String(firmId)) return byId;
  } catch { /* not a Convex id */ }
  return null;
}

// ─── Duplicate detection (read-side, for warnings) ───────────────────────────

/**
 * checkContactDuplicate — the pre-flight check the contact form calls while
 * typing. Returns what it found and NOTHING else: deciding what to do about
 * a duplicate stays with the human.
 *   • emailMatch — authoritative (same person).
 *   • phoneMatches — warning only; shared numbers are normal in this market.
 *   • nameMatches — the weakest signal, surfaced as "verify before saving",
 *     never as a recommendation to merge.
 */
export const checkContactDuplicate = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    name: v.optional(v.string()),
    excludeContactId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const contacts = (await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(2000)) as any[];

    const live = contacts.filter(
      (c) => !c.isArchived && String(c._id) !== String(args.excludeContactId || "")
    );

    const email = normalizeEmail(args.email);
    const emailMatch = email
      ? live.find((c) => normalizeEmail(c.email) === email) || null
      : null;

    const phoneMatches = args.phone
      ? live.filter((c) => phonesMatch(c.phone, args.phone)).slice(0, 5)
      : [];

    const nameKey = (typeof args.name === "string" ? args.name : "").trim().toLowerCase();
    const nameMatches = nameKey
      ? live.filter((c) => String(c.name || "").trim().toLowerCase() === nameKey).slice(0, 5)
      : [];

    return {
      emailMatch: emailMatch
        ? { id: String(emailMatch._id), name: emailMatch.name || "", email: emailMatch.email || "" }
        : null,
      phoneMatches: phoneMatches.map((c) => ({
        id: String(c._id), name: c.name || "", phone: c.phone || "",
      })),
      nameMatches: nameMatches.map((c) => ({
        id: String(c._id), name: c.name || "", email: c.email || "",
      })),
    };
  },
});

// ─── Merge (V-MATTER-5, V-MATTER-16) ─────────────────────────────────────────

/**
 * mergeContacts — one atomic, audited, portal-safe merge.
 *
 * What the old two-step flow destroyed and this preserves:
 *   • PORTAL IDENTITY: if only the source carries `userId`, it transfers to
 *     the survivor; if BOTH carry different users the merge REFUSES (two
 *     portal accounts cannot collapse into one — a human must unlink one).
 *   • SECONDARY RELATIONSHIPS: matters.clientId, matters.associatedContactIds,
 *     matters.parties[].contactId, properties.contactId, tenancies.tenant-
 *     ContactId and property_relationships grantor/grantee links are ALL
 *     re-pointed (the old flow only handled the first two).
 *   • DATA: the survivor keeps its own values and inherits any of the
 *     source's missing fields; source notes are appended with attribution
 *     instead of dying with the row.
 *   • THE RECORD: the source is soft-archived with mergedIntoId/mergedAt —
 *     a tombstone, not an erasure — and a firmActivity entry records the
 *     whole merge with its counts.
 *
 * Invoice client snapshots are deliberately NOT rewritten: they are
 * historical financial records (V2 non-negotiable), and every reader
 * already resolves the live contact by id or email.
 */
export const mergeContacts = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    sourceContactId: v.string(),
    targetContactId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (args.sourceContactId === args.targetContactId) {
      throw new Error("Cannot merge a contact into itself.");
    }

    const source = await resolveContactAnyId(ctx, auth.firmId, args.sourceContactId);
    const target = await resolveContactAnyId(ctx, auth.firmId, args.targetContactId);
    if (!source) throw new Error("Source contact not found.");
    if (!target) throw new Error("Target contact not found.");

    const sourceIds = new Set(
      [String(source._id), String(source.id || "")].filter(Boolean)
    );
    const targetKey = String(target.id || target._id); // the app-forms convention
    const targetIds = new Set(
      [String(target._id), String(target.id || "")].filter(Boolean)
    );

    // Portal identity rules (V-MATTER-16).
    const sourceUserId = (source as any).userId || null;
    const targetUserId = (target as any).userId || null;
    if (sourceUserId && targetUserId && String(sourceUserId) !== String(targetUserId)) {
      throw new Error(
        "Both contacts have linked portal accounts. Unlink one portal account before merging — two portal users cannot be collapsed into one."
      );
    }

    const now = new Date().toISOString();
    const results: Record<string, number> = {
      matters: 0,
      secondaryContacts: 0,
      parties: 0,
      properties: 0,
      tenancies: 0,
      propertyRelationships: 0,
    };

    // 1. Matters: clientId + associatedContactIds + parties[].contactId.
    const matters = (await ctx.db
      .query("matters")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(2000)) as any[];
    const touchedMatterIds: string[] = [];
    for (const m of matters) {
      let touched = false;
      let parties = m.parties;
      if (sourceIds.has(String(m.clientId || ""))) {
        await ctx.db.patch(m._id, { clientId: targetKey, updatedAt: now });
        results.matters++;
        touched = true;
      }
      if (Array.isArray(m.associatedContactIds)) {
        const next: string[] = (m.associatedContactIds as unknown[]).map((id) =>
          sourceIds.has(String(id)) ? targetKey : String(id)
        );
        const deduped = Array.from(new Set<string>(next));
        if (JSON.stringify(next) !== JSON.stringify(m.associatedContactIds)) {
          await ctx.db.patch(m._id, { associatedContactIds: deduped, updatedAt: now } as any);
          results.secondaryContacts++;
          touched = true;
        }
      }
      if (Array.isArray(parties) && parties.length > 0) {
        let partyChanged = false;
        parties = parties.map((p: any) => {
          if (p && sourceIds.has(String(p.contactId || ""))) {
            partyChanged = true;
            return { ...p, contactId: targetKey };
          }
          return p;
        });
        if (partyChanged) {
          await ctx.db.patch(m._id, { parties, updatedAt: now });
          results.parties++;
          touched = true;
        }
      }
      if (touched) {
        touchedMatterIds.push(String(m.id || m._id));
      }
    }

    // 2. Properties.
    const properties = (await ctx.db
      .query("properties")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(2000)) as any[];
    for (const p of properties) {
      if (sourceIds.has(String(p.contactId || ""))) {
        await ctx.db.patch(p._id, { contactId: targetKey, updatedAt: now });
        results.properties++;
      }
    }

    // 3. Tenancies.
    const tenancies = (await ctx.db
      .query("tenancies")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(2000)) as any[];
    for (const t of tenancies) {
      if (sourceIds.has(String(t.tenantContactId || ""))) {
        await ctx.db.patch(t._id, { tenantContactId: targetKey, updatedAt: now });
        results.tenancies++;
      }
    }

    // 4. Property relationships (grantor / grantee).
    const rels = (await ctx.db
      .query("property_relationships")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(2000)) as any[];
    for (const r of rels) {
      const patch: any = {};
      if (sourceIds.has(String(r.grantorContactId || ""))) patch.grantorContactId = targetKey;
      if (sourceIds.has(String(r.granteeContactId || ""))) patch.granteeContactId = targetKey;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(r._id, { ...patch, updatedAt: now });
        results.propertyRelationships++;
      }
    }

    // 5. Survivor enrichment: fill missing fields, union matter links,
    //    append source notes with attribution, and TAKE OVER the portal
    //    identity. The source's userId is CLEARED in the same transaction —
    //    a tombstone that still claims the portal user makes every
    //    find(c => c.userId === …) consumer resolve the DEAD contact.
    const survivorPatch: any = { updatedAt: now };
    if (sourceUserId && !targetUserId) survivorPatch.userId = sourceUserId;
    for (const field of ["email", "phone", "address", "jobTitle", "companyName", "website", "identificationNumber", "taxId", "nextOfKin", "dateOfBirth"] as const) {
      if (!(target as any)[field] && (source as any)[field]) {
        survivorPatch[field] = (source as any)[field];
      }
    }
    if (source.notes && source.notes.trim()) {
      const attribution = `[Merged from ${source.name || "contact"} on ${now.slice(0, 10)}]: ${source.notes.trim()}`;
      survivorPatch.notes = target.notes
        ? `${target.notes}\n\n${attribution}`
        : attribution;
    }
    const unionMatterIds: string[] = Array.from(
      new Set<string>([
        ...((target as any).matterIds || []),
        ...((source as any).matterIds || []),
        ...touchedMatterIds,
      ])
    );
    if (unionMatterIds.length > 0) survivorPatch.matterIds = unionMatterIds;
    const unionProperties = [
      ...((target as any).properties || []),
      ...((source as any).properties || []),
    ];
    if (unionProperties.length > 0) survivorPatch.properties = unionProperties;
    await ctx.db.patch(target._id, survivorPatch);

    // 6. Tombstone the source (auditable, reversible) — NOT a hard delete.
    //    The portal link, if any, now lives on the survivor alone.
    await ctx.db.patch(source._id, {
      ...(sourceUserId ? { userId: null } : {}),
      isArchived: true,
      archivedAt: now,
      archivedById: String(auth.user._id),
      archivedByName: auth.user.name || "",
      mergedIntoId: targetKey,
      mergedAt: now,
      updatedAt: now,
    });

    // 7. The audit trail.
    await insertFirmActivity(ctx, {
      firmId: auth.firmId,
      userId: String(auth.user._id),
      userName: auth.user.name || "",
      action: "Merged contacts",
      targetType: "Contact",
      targetId: targetKey,
      targetName: target.name || "",
      metadata: {
        sourceId: String(source.id || source._id),
        sourceName: source.name || "",
        targetId: targetKey,
        targetName: target.name || "",
        portalLinkTransferred: !!(sourceUserId && !targetUserId),
        ...results,
      },
    });

    // Explicit named fields (a Record spread leaves the inferred type as
    // { success: boolean } — the client toast needs the counts typed).
    return {
      success: true as const,
      matters: results.matters,
      secondaryContacts: results.secondaryContacts,
      parties: results.parties,
      properties: results.properties,
      tenancies: results.tenancies,
      propertyRelationships: results.propertyRelationships,
    };
  },
});

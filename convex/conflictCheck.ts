/**
 * convex/conflictCheck.ts — V3: CONFLICT-OF-INTEREST SCREENING MVP
 * (V-MATTER-6).
 *
 * Nothing like this existed anywhere in the repo: parties, opposing
 * counsel and adverse-party fields were stored on matters but never
 * compared against anything. This module is the practical MVP workflow:
 *
 *   • screenForConflicts — a pre-creation query that normalises the
 *     prospective client name, opposing parties and counsel, and compares
 *     them against the firm's existing clients, contacts and matters
 *     (litigation parties, opposing counsel, real-estate adverse parties,
 *     and — the classic conflict — a new opposing party who is already a
 *     client of the firm).
 *   • The result is a list of POTENTIAL matches for a human to review.
 *     Nothing here declares a legal conflict: normalised name matching is
 *     deliberately conservative (exact / legal-suffix-normalised / flagged
 *     partial overlap) and every match carries its strength and the value
 *     it matched on, precisely so a person can judge it.
 *   • recordConflictCheck / reviewConflictCheck — the audit trail. Every
 *     screen run is recorded with its inputs and outcome; an authorised
 *     user records the reviewed disposition (false positive or genuine
 *     conflict) with a note.
 *
 * Matching rules (and what they never do):
 *   • email equality → 'strong'.
 *   • normalised-name equality (case/punctuation/whitespace/legal-suffix
 *     normalised) → 'strong'.
 *   • bounded containment (one normalised name contained in the other,
 *     ≥5 chars on the shorter side) → 'possible' — shown for review,
 *     never treated as a conflict by itself.
 *   • Display-name similarity alone NEVER produces an outcome, never
 *     blocks creation, and never merges anything.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";
import { normalizeEmail } from "./contactIntegrity";

// ─── Name normalisation ──────────────────────────────────────────────────────

const LEGAL_SUFFIXES = new Set([
  "ltd", "limited", "plc", "llc", "inc", "incorporated", "co", "company",
  "enterprises", "ent", "ventures", "group", "holdings",
]);

/** lowercase, punctuation-stripped, whitespace-collapsed. */
export function normalizeNameForConflict(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** normalizeNameForConflict with trailing legal-suffix tokens removed. */
export function stripLegalSuffixes(raw: unknown): string {
  const words = normalizeNameForConflict(raw)
    .split(" ")
    .filter((w) => w && !LEGAL_SUFFIXES.has(w));
  return words.join(" ").trim();
}

export type MatchStrength = "strong" | "possible";

export function nameMatchStrength(
  input: string,
  candidate: string
): { strength: MatchStrength; on: string } | null {
  const a = normalizeNameForConflict(input);
  const b = normalizeNameForConflict(candidate);
  if (!a || !b) return null;
  if (a === b) return { strength: "strong", on: "exact name" };
  const a2 = stripLegalSuffixes(input);
  const b2 = stripLegalSuffixes(candidate);
  if (a2 && b2) {
    if (a2 === b2) return { strength: "strong", on: "name (legal-suffix normalised)" };
    // Bounded containment — flagged 'possible', always for human review.
    const shorter = Math.min(a2.length, b2.length);
    if (shorter >= 5 && (a2.includes(b2) || b2.includes(a2))) {
      return { strength: "possible", on: "partial name overlap" };
    }
  }
  return null;
}

export interface ConflictMatch {
  kind: "contact" | "matter";
  id: string;
  name: string;
  detail: string;
  matchedOn: string;   // which input triggered the match
  matchType: string;   // 'client name' | 'opposing party' | 'counsel' | 'email'
  strength: MatchStrength;
  matchedValue: string;
}

// ─── Screening query ─────────────────────────────────────────────────────────

/**
 * screenForConflicts — run BEFORE matter creation. Compares the
 * prospective client / opposing parties / counsel against everything the
 * firm already knows. Returns potential matches for display — the
 * DISPOSITION (proceed / false positive / genuine conflict) is always a
 * human decision recorded via recordConflictCheck / reviewConflictCheck.
 */
export const screenForConflicts = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    clientName: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    opposingParties: v.optional(v.array(v.string())),
    counsel: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    const inputs: Array<{ label: string; value: string }> = [];
    if (args.clientName && args.clientName.trim()) {
      inputs.push({ label: "client name", value: args.clientName.trim() });
    }
    for (const p of args.opposingParties || []) {
      if (p && p.trim()) inputs.push({ label: "opposing party", value: p.trim() });
    }
    for (const c of args.counsel || []) {
      if (c && c.trim()) inputs.push({ label: "counsel", value: c.trim() });
    }
    if (inputs.length === 0 && !args.clientEmail) {
      return { matches: [] as ConflictMatch[], screenedNames: [] as string[] };
    }

    const clientEmail = normalizeEmail(args.clientEmail);

    // Load the firm's directory + matters (bounded directory reads).
    const [contacts, matters] = await Promise.all([
      ctx.db.query("contacts").withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId)).take(2000),
      ctx.db.query("matters").withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId)).take(2000),
    ]);

    const matches: ConflictMatch[] = [];
    const seen = new Set<string>();
    const push = (m: ConflictMatch) => {
      const key = `${m.kind}:${m.id}:${m.matchType}:${m.matchedOn}`;
      if (seen.has(key)) return;
      seen.add(key);
      matches.push(m);
    };

    // 1. CONTACTS — the firm's known people and companies.
    for (const c of contacts as any[]) {
      if (c.isArchived) continue;
      const contactKey = String(c.id || c._id);

      // Email equality is the strongest signal of all.
      if (clientEmail && normalizeEmail(c.email) && normalizeEmail(c.email) === clientEmail) {
        push({
          kind: "contact",
          id: contactKey,
          name: c.name || "",
          detail: `Existing ${c.category || c.contactType || "contact"} in the firm directory${c.email ? ` (${c.email})` : ""}`,
          matchedOn: args.clientEmail || "",
          matchType: "email",
          strength: "strong",
          matchedValue: c.email || "",
        });
      }

      for (const input of inputs) {
        const hit = nameMatchStrength(input.value, c.name || "");
        if (hit) {
          push({
            kind: "contact",
            id: contactKey,
            name: c.name || "",
            detail: `Existing ${c.category || c.contactType || "contact"} in the firm directory`,
            matchedOn: input.value,
            matchType: input.label,
            strength: hit.strength,
            matchedValue: c.name || "",
          });
        }
      }
    }

    // Resolve matter client names (for the new-opposing-party-is-our-client check).
    const contactNameById = new Map<string, string>();
    for (const c of contacts as any[]) {
      contactNameById.set(String(c._id), c.name || "");
      if (c.id) contactNameById.set(String(c.id), c.name || "");
    }

    // 2. MATTERS — parties, opposing counsel, adverse parties, and clients.
    for (const m of matters as any[]) {
      const matterKey = String(m.id || m._id);
      const matterLabel = m.title || "untitled matter";

      const matterCandidates: Array<{ name: string; role: string }> = [];
      // Litigation parties (claimant + opposing side).
      if (Array.isArray(m.parties)) {
        for (const p of m.parties) {
          if (p && typeof p === "object" && p.name) {
            matterCandidates.push({ name: String(p.name), role: `${p.role || "party"} on matter "${matterLabel}"` });
          }
        }
      }
      if (m.opposingCounsel) {
        matterCandidates.push({ name: String(m.opposingCounsel), role: `opposing counsel on matter "${matterLabel}"` });
      }
      const adverse = (m.specialtyData as any)?.realEstate?.adverseParty;
      if (adverse) {
        matterCandidates.push({ name: String(adverse), role: `adverse party on matter "${matterLabel}"` });
      }
      // The matter's client is a candidate too — a NEW opposing party that
      // matches an EXISTING client is the textbook conflict.
      const clientName = m.clientId ? contactNameById.get(String(m.clientId)) : "";
      if (clientName) {
        matterCandidates.push({ name: clientName, role: `client on matter "${matterLabel}"` });
      }

      for (const cand of matterCandidates) {
        for (const input of inputs) {
          const hit = nameMatchStrength(input.value, cand.name);
          if (hit) {
            push({
              kind: "matter",
              id: matterKey,
              name: cand.name,
              detail: cand.role,
              matchedOn: input.value,
              matchType: input.label,
              strength: hit.strength,
              matchedValue: cand.name,
            });
          }
        }
      }
    }

    // Strong matches first, then possibles; stable within tiers.
    matches.sort((a, b) => {
      if (a.strength !== b.strength) return a.strength === "strong" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return {
      matches,
      screenedNames: inputs.map((i) => i.value),
    };
  },
});

// ─── Recording + human review ────────────────────────────────────────────────

const CONFLICT_OUTCOMES = ["clear", "reviewed-false-positive", "confirmed-conflict"] as const;

/**
 * recordConflictCheck — writes the audit row for a screen run. Called by
 * the matter-creation flow: 'clear' when there were no matches, and the
 * reviewed disposition when the user proceeded past (or stopped at) the
 * match list.
 */
export const recordConflictCheck = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    clientName: v.optional(v.string()),
    opposingParties: v.optional(v.array(v.string())),
    counsel: v.optional(v.array(v.string())),
    matches: v.optional(v.any()),
    outcome: v.string(),
    note: v.optional(v.string()),
    matterId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (!(CONFLICT_OUTCOMES as readonly string[]).includes(args.outcome)) {
      throw new Error(`Invalid conflict-check outcome '${args.outcome}'.`);
    }
    const matchList: any[] = Array.isArray(args.matches) ? args.matches : [];
    const now = new Date().toISOString();
    const checkId = await ctx.db.insert("conflict_checks", {
      firmId: auth.firmId,
      matterId: args.matterId || undefined,
      checkedById: String(auth.user._id),
      checkedByName: auth.user.name || "",
      clientName: args.clientName || "",
      opposingParties: args.opposingParties || [],
      counsel: args.counsel || [],
      matchCount: matchList.length,
      matches: matchList,
      outcome: args.outcome,
      note: args.note || "",
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, checkId: String(checkId) };
  },
});

/**
 * reviewConflictCheck — an authorised user records the reviewed
 * disposition of a check that surfaced potential matches: a reviewed false
 * positive (proceed) or a confirmed genuine conflict. Requires a note —
 * "we checked and it's fine" without a reason is not an audit trail.
 */
export const reviewConflictCheck = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    checkId: v.string(),
    outcome: v.string(), // 'reviewed-false-positive' | 'confirmed-conflict'
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (!["reviewed-false-positive", "confirmed-conflict"].includes(args.outcome)) {
      throw new Error("Review outcome must be 'reviewed-false-positive' or 'confirmed-conflict'.");
    }
    const note = (args.note || "").trim();
    if (!note) {
      throw new Error("A review note is required — record WHY this is a false positive (or a genuine conflict).");
    }
    const row: any = await ctx.db.get(args.checkId as any);
    if (!row || String(row.firmId) !== String(auth.firmId)) {
      throw new Error("Conflict check not found.");
    }
    const now = new Date().toISOString();
    await ctx.db.patch(row._id, {
      outcome: args.outcome,
      note,
      reviewedById: String(auth.user._id),
      reviewedByName: auth.user.name || "",
      reviewedAt: now,
      updatedAt: now,
    });
    return { success: true };
  },
});

/** The firm's conflict-check history (newest first). */
export const getConflictChecks = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const rows = await ctx.db
      .query("conflict_checks")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .take(500);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return (rows as any[])
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit)
      .map((r) => ({
        id: String(r._id),
        checkedByName: r.checkedByName || "",
        clientName: r.clientName || "",
        opposingParties: r.opposingParties || [],
        counsel: r.counsel || [],
        matchCount: r.matchCount ?? 0,
        outcome: r.outcome,
        note: r.note || "",
        reviewedByName: r.reviewedByName || "",
        reviewedAt: r.reviewedAt || null,
        matterId: r.matterId || null,
        createdAt: r.createdAt,
      }));
  },
});

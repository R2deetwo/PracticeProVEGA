/**
 * authorityLibrary.ts — the firm's VERIFIED legal authority store (owner
 * spec, 2026-11-19, §6.2 "Legal Authority and Jurisdiction Guardrails").
 *
 * "The system must not generate case citations, statute section numbers or
 * rule numbers from model memory." Written addresses and briefs produced by
 * the Voice → DraftPro pipeline may cite ONLY entries from this table:
 * assemble.ts/validateProseFill scrubs every unverified citation out of
 * generated prose and replaces it with a [CITATION TO BE VERIFIED: …]
 * placeholder pill (AC6.1).
 *
 * The library ships EMPTY. Two population paths:
 *   - addAuthority — the "Add authority" action in the DraftPro editor;
 *   - importAuthoritiesCsv — bulk import (citation,court,year,proposition,
 *     verified) — the CSV path from spec §6.2.
 *
 * Auth follows the house rules (session bearer via requireFirmUser,
 * firm-scoped, payload-capped). Pure CRUD — no AI calls live here.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";
// Shared pure parser (also used client-side for a paste-import preview).
import { parseAuthoritiesCsv } from "../src/legal/drafting/authorityLibrary";

/** Cap on a single citation string. */
const MAX_CITATION_CHARS = 300;
/** Cap on the proposition text. */
const MAX_PROPOSITION_CHARS = 1000;
/** Cap on one CSV import payload. */
const MAX_CSV_CHARS = 400_000;
/** Cap on rows per import / per firm. */
const MAX_ROWS = 2000;

/** listAuthorities — the firm's authority library, newest first. */
export const listAuthorities = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const rows: any[] = await ctx.db
      .query("authorityLibrary")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .collect();
    return rows
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, MAX_ROWS)
      .map((r) => ({
        id: r._id,
        citation: r.citation,
        court: r.court || "",
        year: r.year || "",
        proposition: r.proposition || "",
        verified: r.verified === true,
        createdAt: r.createdAt || null,
      }));
  },
});

/** addAuthority — the editor's "Add authority" action. Idempotent per
 *  (firm, citation): adding an existing citation updates it. */
export const addAuthority = mutation({
  args: {
    citation: v.string(),
    court: v.optional(v.string()),
    year: v.optional(v.string()),
    proposition: v.optional(v.string()),
    verified: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const citation = (args.citation || "").trim().slice(0, MAX_CITATION_CHARS);
    if (!citation) throw new Error("Enter the citation first.");
    const now = new Date().toISOString();
    const existing: any[] = await ctx.db
      .query("authorityLibrary")
      .withIndex("by_firm_citation", (q: any) =>
        q.eq("firmId", auth.firmId).eq("citation", citation)
      )
      .collect();
    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        court: (args.court || "").trim().slice(0, 160) || null,
        year: (args.year || "").trim().slice(0, 16) || null,
        proposition: (args.proposition || "").trim().slice(0, MAX_PROPOSITION_CHARS) || null,
        verified: args.verified === true,
        updatedAt: now,
      });
      return { id: existing[0]._id, updated: true };
    }
    const id = await ctx.db.insert("authorityLibrary", {
      firmId: auth.firmId,
      citation,
      court: (args.court || "").trim().slice(0, 160) || null,
      year: (args.year || "").trim().slice(0, 16) || null,
      proposition: (args.proposition || "").trim().slice(0, MAX_PROPOSITION_CHARS) || null,
      verified: args.verified === true,
      addedBy: String(auth.user._id),
      createdAt: now,
      updatedAt: now,
    });
    return { id, updated: false };
  },
});

/** removeAuthority — delete one entry. */
export const removeAuthority = mutation({
  args: {
    id: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const doc: any = await ctx.db.get(args.id as any);
    if (!doc || doc.firmId !== auth.firmId) {
      throw new Error("That authority is not in your library.");
    }
    await ctx.db.delete(args.id as any);
    return { removed: true };
  },
});

/** importAuthoritiesCsv — the CSV import path (spec §6.2):
 *  citation,court,year,proposition,verified — one entry per line. */
export const importAuthoritiesCsv = mutation({
  args: {
    csv: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const csv = (args.csv || "").slice(0, MAX_CSV_CHARS);
    const entries = parseAuthoritiesCsv(csv).slice(0, MAX_ROWS);
    if (entries.length === 0) throw new Error("No importable rows found in the CSV.");
    const now = new Date().toISOString();
    let imported = 0;
    for (const e of entries) {
      const existing: any[] = await ctx.db
        .query("authorityLibrary")
        .withIndex("by_firm_citation", (q: any) =>
          q.eq("firmId", auth.firmId).eq("citation", e.citation)
        )
        .collect();
      if (existing.length > 0) {
        await ctx.db.patch(existing[0]._id, {
          court: e.court || null,
          year: e.year || null,
          proposition: e.proposition || null,
          verified: e.verified,
          updatedAt: now,
        });
        imported++;
        continue;
      }
      await ctx.db.insert("authorityLibrary", {
        firmId: auth.firmId,
        citation: e.citation.slice(0, MAX_CITATION_CHARS),
        court: e.court || null,
        year: e.year || null,
        proposition: e.proposition || null,
        verified: e.verified,
        addedBy: String(auth.user._id),
        createdAt: now,
        updatedAt: now,
      });
      imported++;
    }
    return { imported };
  },
});

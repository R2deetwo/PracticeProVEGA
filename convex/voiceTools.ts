/**
 * voiceTools.ts — Personal Dictionary & Spoken Snippets (owner spec,
 * 2026-11-19: "Wispr-Flow-grade voice intelligence").
 *
 * Two small per-user stores that make dictation sharper over time:
 *
 *   1. PERSONAL DICTIONARY (voiceDictionary) — names, firms, courts and
 *      legal terms the user corrected once in the Quick Capture staging
 *      box ("Chinedoo" → "Chinedu") or added manually. The top terms are
 *      injected into every transcription / Smart Clean / analysis prompt
 *      as SPELLING HINTS (see voiceCapture.ts), so recognition stabilises
 *      without the user ever opening a settings page.
 *
 *   2. SPOKEN SNIPPETS (voiceSnippets) — reusable text blocks triggered by
 *      short spoken commands ("insert chambers signature"). Firm-wide
 *      defaults are seeded lazily on the first list; users can add,
 *      rewrite and delete their own. Active snippets ride into the
 *      analysis prompt so the LLM expands the trigger phrase into the
 *      block inside formatted outputs.
 *
 * Auth follows the house rules (session bearer via requireFirmUser, firm-
 * scoped, payload-capped). No AI calls live here — this is pure CRUD.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";

/** How many dictionary terms ride into a prompt as spelling hints. */
export const MAX_PROMPT_TERMS = 60;
/** Cap on a single stored term. */
const MAX_TERM_CHARS = 80;
/** Cap on snippet content. */
const MAX_SNIPPET_CHARS = 2000;
/** Cap on stored rows per user (oldest auto-learned rows fall off). */
const MAX_DICTIONARY_ROWS = 500;

/** The firm-wide default snippets seeded on first use (owner spec §4). */
export const DEFAULT_SNIPPETS: { trigger: string; content: string }[] = [
  {
    trigger: "insert chambers signature",
    content:
      "Thank you for your continued confidence in our chambers.\n\nYours faithfully,\n\n_______________________\n[Principal Partner]\nFor: [Firm Name]\nChambers of [Firm Name]\n[Address] · [Phone] · [Email]",
  },
  {
    trigger: "insert standard payment instructions",
    content:
      "All payments should be made to the firm's designated account:\nAccount Name: [Firm Name]\nBank: [Bank Name]\nAccount Number: [Account Number]\nKindly forward the payment receipt to chambers for reconciliation and record-keeping.",
  },
  {
    trigger: "insert caveat clause",
    content:
      "This communication is sent without prejudice to any of our client's rights, all of which are expressly reserved. Nothing contained herein shall be construed as a waiver of any right or remedy available to our client at law or in equity.",
  },
  {
    trigger: "insert standard adjournment note",
    content:
      "Matter adjourned at the instance of the court to allow [reason]. Parties are to file and serve all outstanding processes before the next adjourned date. The matter comes up next on [date] for [purpose].",
  },
];

/** The trigger whose content is bank-details-aware. */
export const PAYMENT_INSTRUCTIONS_TRIGGER = "insert standard payment instructions";

/**
 * Fill the payment-instructions snippet with the firm's OWN DEFAULT bank
 * account (Settings → Financial Configuration) — owner directive
 * 2026-11-24: "for the bank details, it should carry the firm's own
 * default account from settings … what happens if they have not set the
 * account?" When no account is set, the placeholder line is replaced with
 * an explicit configure-it instruction instead of a fake bank/number —
 * the user immediately sees WHY the details are missing.
 */
export function fillPaymentInstructions(
  content: string,
  acct: { bankName: string; accountName: string; accountNumber: string } | null,
  firmName: string,
): string {
  if (!acct || !acct.accountNumber) {
    return (
      "All payments should be made to the firm's designated account.\n" +
      "(No bank account configured yet — add the firm's default account in " +
      "Settings → Financial Configuration, and this snippet will carry it " +
      "automatically.)\n" +
      "Kindly forward the payment receipt to chambers for reconciliation and record-keeping."
    );
  }
  return content
    .replace(/\[Firm Name\]/g, acct.accountName || firmName)
    .replace(/\[Bank Name\]/g, acct.bankName)
    .replace(/\[Account Number\]/g, acct.accountNumber);
}

/** Resolve the firm's default bank account from a firms row (isDefault
 * first, then the first listed account, else null). Shared by the snippet
 * fill below. */
function defaultAccountOf(firm: any): { bankName: string; accountName: string; accountNumber: string } | null {
  const accounts: any[] = Array.isArray(firm?.bankAccounts) ? firm.bankAccounts : [];
  const acct = accounts.find((a: any) => a && a.isDefault) || accounts[0] || null;
  if (!acct || !acct.accountNumber) return null;
  return {
    bankName: String(acct.bankName || ""),
    accountName: String(acct.accountName || firm?.name || ""),
    accountNumber: String(acct.accountNumber || ""),
  };
}

/** listDictionary — the user's personal vocabulary, newest first. */
export const listDictionary = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const rows: any[] = await ctx.db
      .query("voiceDictionary")
      .withIndex("by_firm_user", (q: any) =>
        q.eq("firmId", auth.firmId).eq("userId", String(auth.user._id))
      )
      .collect();
    return rows
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
      .slice(0, MAX_DICTIONARY_ROWS)
      .map((r) => ({
        id: r._id,
        term: r.term,
        source: r.source || "manual",
        hits: r.hits || 0,
        createdAt: r.createdAt,
      }));
  },
});

/** addDictionaryTerms — idempotent add (auto-learn loop + manual entry).
 * An existing term (case-insensitive) just bumps its hit counter. */
export const addDictionaryTerms = mutation({
  args: {
    terms: v.array(v.string()),
    source: v.optional(v.string()), // "auto" | "manual"
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const userId = String(auth.user._id);
    const now = new Date().toISOString();
    const cleaned = Array.from(
      new Set(
        (args.terms || [])
          .map((t) => t.trim())
          .filter((t) => t.length >= 2 && t.length <= MAX_TERM_CHARS)
          .slice(0, 20)
      )
    );
    const added: string[] = [];
    for (const term of cleaned) {
      const existing: any = await ctx.db
        .query("voiceDictionary")
        .withIndex("by_firm_term", (q: any) =>
          q.eq("firmId", auth.firmId).eq("userId", userId).eq("term", term)
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { hits: (existing.hits || 0) + 1, updatedAt: now });
        continue;
      }
      await ctx.db.insert("voiceDictionary", {
        firmId: auth.firmId,
        userId,
        term,
        source: args.source === "auto" ? "auto" : "manual",
        hits: 1,
        createdAt: now,
        updatedAt: now,
      });
      added.push(term);
    }
    return { added, total: cleaned.length };
  },
});

/** removeDictionaryTerm — delete one entry (dictionary manager UI). */
export const removeDictionaryTerm = mutation({
  args: {
    id: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await ctx.db.get(args.id as any);
    if (!row) return { removed: false };
    if (row.firmId !== auth.firmId || String(row.userId) !== String(auth.user._id)) {
      throw new Error("Not authorized.");
    }
    await ctx.db.delete(row._id);
    return { removed: true };
  },
});

/** listSnippets — the user's snippets + firm defaults, seeded lazily.
 * The payment-instructions default is DYNAMIC: its content is filled with
 * the firm's own default bank account at read time (2026-11-24), so it
 * never inserts stale "[Bank Name]" placeholders into dictated text and
 * picks up an account the moment one is configured. */
export const listSnippets = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    // The firm row carries the default bank account for the payment snippet.
    const firm: any = await ctx.db.get(auth.firmId as any).catch(() => null);
    const acct = defaultAccountOf(firm);
    const firmName = String(firm?.name || "");
    const fillIfPayment = (s: { trigger: string; content: string }) =>
      s.trigger === PAYMENT_INSTRUCTIONS_TRIGGER
        ? { ...s, content: fillPaymentInstructions(s.content, acct, firmName) }
        : s;
    // Lazy seed: firm-wide default rows are created on first read.
    const firmDefaults: any[] = await ctx.db
      .query("voiceSnippets")
      .withIndex("by_firm_user", (q: any) =>
        q.eq("firmId", auth.firmId).eq("userId", null as any)
      )
      .collect();
    if (firmDefaults.length === 0) {
      // A query cannot write — seeding happens via seedDefaultSnippets
      // (called by the client when empty, or by the list action wrapper).
      // We still return the in-code defaults so the UI never blocks.
      return DEFAULT_SNIPPETS.map((s, i) => ({
        id: `default-${i}`,
        ...fillIfPayment(s),
        isDefault: true,
      }));
    }
    const userRows: any[] = await ctx.db
      .query("voiceSnippets")
      .withIndex("by_firm_user", (q: any) =>
        q.eq("firmId", auth.firmId).eq("userId", String(auth.user._id))
      )
      .collect();
    const map = (r: any) => ({
      id: r._id,
      trigger: r.trigger,
      content: r.content,
      isDefault: !!r.isDefault,
    });
    return [
      // Seeded default rows get the same dynamic payment-instructions fill
      // (they were seeded with static placeholders before 2026-11-24).
      ...firmDefaults.map((r: any) => fillIfPayment({ trigger: r.trigger, content: r.content })).map((s, i) => ({
        id: firmDefaults[i]._id,
        trigger: s.trigger,
        content: s.content,
        isDefault: !!firmDefaults[i].isDefault,
      })),
      ...userRows.sort((a, b) =>
        String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
      ).map(map),
    ];
  },
});

/** seedDefaultSnippets — one-time firm seed (idempotent). */
export const seedDefaultSnippets = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const existing: any[] = await ctx.db
      .query("voiceSnippets")
      .withIndex("by_firm_user", (q: any) =>
        q.eq("firmId", auth.firmId).eq("userId", null as any)
      )
      .collect();
    if (existing.length > 0) return { seeded: 0 };
    const now = new Date().toISOString();
    for (const s of DEFAULT_SNIPPETS) {
      await ctx.db.insert("voiceSnippets", {
        firmId: auth.firmId,
        userId: null,
        trigger: s.trigger,
        content: s.content,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { seeded: DEFAULT_SNIPPETS.length };
  },
});

/** saveSnippet — add (no id) or update (id) one of the user's snippets. */
export const saveSnippet = mutation({
  args: {
    id: v.optional(v.string()),
    trigger: v.string(),
    content: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const userId = String(auth.user._id);
    const trigger = args.trigger.trim().slice(0, 120);
    const content = args.content.trim().slice(0, MAX_SNIPPET_CHARS);
    if (!trigger || !content) throw new Error("A snippet needs a trigger phrase and its text.");
    const now = new Date().toISOString();
    if (args.id && !args.id.startsWith("default-")) {
      const row: any = await ctx.db.get(args.id as any);
      if (!row) throw new Error("Snippet not found.");
      if (row.firmId !== auth.firmId || String(row.userId) !== userId) {
        throw new Error("Not authorized.");
      }
      await ctx.db.patch(row._id, { trigger, content, updatedAt: now });
      return { id: args.id };
    }
    const id = await ctx.db.insert("voiceSnippets", {
      firmId: auth.firmId,
      userId,
      trigger,
      content,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });
    return { id: String(id) };
  },
});

/** deleteSnippet — remove one of the user's own snippets (defaults are
 * firm-wide; a user delete on a default creates a personal override-free
 * removal by simply refusing — managers edit defaults via the same table). */
export const deleteSnippet = mutation({
  args: {
    id: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await ctx.db.get(args.id as any);
    if (!row) return { deleted: false };
    if (row.firmId !== auth.firmId || String(row.userId) !== String(auth.user._id)) {
      throw new Error("Not authorized.");
    }
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});

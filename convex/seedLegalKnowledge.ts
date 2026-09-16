import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireFounderCaller } from "./callerAuth";
import {
  FEDERAL_INSTITUTIONS,
  REGISTRY_INSTITUTIONS,
  STATE_JUDICIARIES,
  FEDERAL_INSTRUMENTS,
  LAGOS_INSTRUMENTS,
  PROVISIONS,
  FORMS,
  CORPUS_VERSION,
} from "./legalCorpus";

/**
 * seedLegalKnowledge — Founder-only, idempotent seeder for the Legal Knowledge
 * Engine (Task 51).
 *
 * Invocation (R16 strict identity — bearer session required):
 *   npx convex run seedLegalKnowledge:seedAll '{"sessionToken":"<token>"}'
 *
 * What it seeds (idempotent upserts keyed by natural keys):
 *   - 44 institutions (5 federal courts/registries + 2 Lagos registries + 37 state/FCT judiciaries)
 *   - 46 instruments (9 federal + 2 Lagos + 37 state/FCT High Court rules, derived from
 *     the same citations the drafting engine already uses)
 *   - 27 provisions / practice anchors (Lagos HC, FHC, CFRN, CAMA, Evidence Act,
 *     Tenancy Law, Sheriffs Act, NICN)
 *   - 18 court & registry forms
 *   - instruments carry provisionCount/formCount so the coverage manifest needs
 *     no table scans.
 *
 * Embeddings are NOT generated here (no server-side model key). The founder
 * runs "Build Legal Index" (AgentSettings → client-side Gemini embeddings,
 * the proven brain.seedFirm pattern) to index provisions + forms for retrieval.
 */

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export const seedAll = mutation({
  args: { sessionToken: v.optional(v.string()), founderEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFounderCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.founderEmail,
    });

    const report = { institutions: 0, instruments: 0, provisions: 0, forms: 0, updated: 0 };

    // ── 1. Institutions ─────────────────────────────────────────────────────
    const allInstitutions = [
      ...FEDERAL_INSTITUTIONS,
      ...REGISTRY_INSTITUTIONS,
      // 37 state/FCT judiciaries derived from the registry list
      ...STATE_JUDICIARIES.map((s): typeof FEDERAL_INSTITUTIONS[number] => ({
        key: `${slugify(s.key)}_judiciary`,
        name: `Judiciary of ${s.name}`,
        type: "court" as const,
        level: s.key === "FCT" ? ("fct" as const) : ("state" as const),
        jurisdictionKey: s.key,
        divisions: [`${s.capital} Judicial Division`],
        notes: `State High Court, Magistrate Courts and customary courts in ${s.name}. High Court procedure governed by the ${s.rules}.`,
        coverageTier: s.key === "Lagos" ? ("deep" as const) : ("instruments" as const),
      })),
    ];

    for (const inst of allInstitutions) {
      const existing = await ctx.db
        .query("institutions")
        .withIndex("by_key", (q) => q.eq("key", inst.key))
        .first();
      if (existing) {
        // Preserve deep coverage if an earlier seed set it; refresh the rest.
        const coverageTier = existing.coverageTier === "deep" ? "deep" : inst.coverageTier;
        await ctx.db.patch(existing._id, { ...inst, coverageTier });
        report.updated++;
      } else {
        await ctx.db.insert("institutions", inst);
        report.institutions++;
      }
    }

    // ── 2. Instruments ──────────────────────────────────────────────────────
    const stateInstruments = STATE_JUDICIARIES.map((s) => ({
      key: `${slugify(s.key)}_hc_rules`,
      institutionKey: `${slugify(s.key)}_judiciary`,
      title: s.rules,
      kind: "rules" as const,
      year: s.year,
      status: "in_force" as const,
      summary: `High Court civil procedure for ${s.name}: originating processes, service, pleadings, trial and enforcement. Provision-level content is being expanded — the rules citation is already used by the drafting engine for ${s.name} captions.`,
      jurisdictionKey: s.key,
    }));

    const allInstruments = [...FEDERAL_INSTRUMENTS, ...LAGOS_INSTRUMENTS, ...stateInstruments];

    for (const ins of allInstruments) {
      const existing = await ctx.db
        .query("instruments")
        .withIndex("by_key", (q) => q.eq("key", ins.key))
        .first();
      if (existing) {
        // Keep live coverage counters; refresh bibliographic fields.
        const { provisionCount, formCount, ...rest } = existing as any;
        await ctx.db.patch(existing._id, { ...ins, provisionCount, formCount });
        report.updated++;
      } else {
        await ctx.db.insert("instruments", ins);
        report.instruments++;
      }
    }

    // ── 3. Provisions / practice anchors ────────────────────────────────────
    const provisionCounts: Record<string, number> = {};
    for (const p of PROVISIONS) {
      const existing = await ctx.db
        .query("instrument_provisions")
        .withIndex("by_instrument", (q) => q.eq("instrumentKey", p.instrumentKey))
        .filter((q) => q.eq(q.field("ref"), p.ref))
        .filter((q) => q.eq(q.field("heading"), p.heading))
        .first();
      const row = {
        ...p,
        verificationStatus: p.verificationStatus ?? "needs_founder_review",
        embedded: existing?.embedded ?? false,
      };
      if (existing) {
        // Never clobber a founder's verification or an existing embedding.
        const { embedding, verificationStatus, ...rest } = row as any;
        await ctx.db.patch(existing._id, rest);
        report.updated++;
      } else {
        await ctx.db.insert("instrument_provisions", row);
        report.provisions++;
      }
      provisionCounts[p.instrumentKey] = (provisionCounts[p.instrumentKey] || 0) + 1;
    }

    // ── 4. Forms ────────────────────────────────────────────────────────────
    const formCounts: Record<string, number> = {};
    for (const f of FORMS) {
      const existing = await ctx.db
        .query("court_forms")
        .withIndex("by_institution", (q) => q.eq("institutionKey", f.institutionKey))
        .filter((q) => q.eq(q.field("title"), f.title))
        .filter((q) => q.eq(q.field("formNumber"), f.formNumber))
        .first();
      const row = {
        ...f,
        verificationStatus: f.verificationStatus ?? "needs_founder_review",
        embedded: existing?.embedded ?? false,
      };
      if (existing) {
        const { embedding, verificationStatus, ...rest } = row as any;
        await ctx.db.patch(existing._id, rest);
        report.updated++;
      } else {
        await ctx.db.insert("court_forms", row);
        report.forms++;
      }
      if (f.instrumentKey) {
        formCounts[f.instrumentKey] = (formCounts[f.instrumentKey] || 0) + 1;
      }
    }

    // ── 5. Refresh coverage counters on instruments ─────────────────────────
    for (const [instrumentKey, count] of Object.entries(provisionCounts)) {
      const ins = await ctx.db
        .query("instruments")
        .withIndex("by_key", (q) => q.eq("key", instrumentKey))
        .first();
      if (ins) await ctx.db.patch(ins._id, { provisionCount: count });
    }
    for (const [instrumentKey, count] of Object.entries(formCounts)) {
      const ins = await ctx.db
        .query("instruments")
        .withIndex("by_key", (q) => q.eq("key", instrumentKey))
        .first();
      if (ins) await ctx.db.patch(ins._id, { formCount: count });
    }

    return {
      message: `Legal knowledge corpus ${CORPUS_VERSION} seeded: +${report.institutions} institutions, +${report.instruments} instruments, +${report.provisions} provisions, +${report.forms} forms (${report.updated} refreshed). Run "Build Legal Index" to embed for retrieval.`,
      ...report,
    };
  },
});

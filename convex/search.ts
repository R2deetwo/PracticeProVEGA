import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";

/**
 * UNIFIED SERVER-SIDE SEARCH — Phase 4 (Performance & Database)
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces the client-side Fuse.js search in FullScreenSearch, which loaded
 * ALL matters/contacts/documents/tasks into browser memory and rebuilt the
 * index on every data change. This query uses Convex searchIndexes
 * (matters.search_title / search_suit, contacts.search_name,
 * documents.search_title, tasks.search_title, properties.search_address)
 * and returns a slim projection per category, firm-scoped via the caller's
 * authenticated firm.
 *
 * Search indexes rank by relevance; the firmId filter is applied
 * server-side after the search. Each category is capped (default 10) so
 * the payload stays small regardless of firm size.
 *
 * K-1 (KOMPLETE unified-product integrity):
 *   - PROPERTIES are searchable (by address) — but ONLY for firms whose
 *     product is property-capable (Atrium / unified-Komplete). The
 *     product-scope rule is enforced SERVER-SIDE from the firm record,
 *     never from caller input, so a Vega-only firm cannot surface property
 *     rows by manipulating the request. Mobile and desktop search now
 *     cover the same categories.
 *   - Cross-firm isolation is absolute: firmId comes from the caller's
 *     verified session (requireFirmUser), and every category filters on it.
 *   - The `properties` key is ALWAYS present in the result (an empty array
 *     for legal-only firms) so clients can rely on a stable shape.
 */

const MIN_TERM_LENGTH = 2;

/** Server-side product-capability check — mirrors the frontend
 *  entitlements rule (property surfaces need a property-capable product).
 *  Accepted spellings: the backend validators write 'legal' | 'property' |
 *  'unified' | 'vega' | 'atrium' | 'komplete' (fixProductMode's valid list)
 *  and legacy rows may store 'sentry'. */
function isPropertyCapableProduct(product?: string | null): boolean {
  const p = String(product || "").toLowerCase().trim();
  return p === "property" || p === "atrium" || p === "unified" || p === "komplete" || p === "sentry";
}

/** Resolve the firm record for a firmId (custom id first, Convex id
 *  fallback — the same pattern as convex/estateCommunity.ts). */
async function resolveFirm(ctx: any, firmId: string): Promise<any | null> {
  let firm: any = await ctx.db
    .query("firms")
    .filter((q: any) => q.eq(q.field("id"), firmId))
    .first();
  if (!firm) {
    try { firm = await ctx.db.get(firmId as any); } catch { /* not a valid Convex id */ }
  }
  return firm || null;
}

export const searchAll = query({
  args: {
    userEmail: v.string(),
    sessionToken: v.optional(v.string()),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const firmId = auth.firmId;
    const term = args.query.trim();
    const perTypeLimit = Math.min(Math.max(args.limit ?? 10, 1), 25);

    if (!firmId || term.length < MIN_TERM_LENGTH) {
      return { matters: [], contacts: [], documents: [], tasks: [], properties: [] };
    }

    // K-1: product scoping is derived from the FIRM RECORD server-side.
    const firm = await resolveFirm(ctx, firmId);
    const propertySearchEnabled = isPropertyCapableProduct(firm?.product);

    const [mattersByTitle, mattersBySuit, contacts, documents, tasks, properties] =
      await Promise.all([
        ctx.db
          .query("matters")
          .withSearchIndex("search_title", (q) => q.search("title", term))
          .filter((q) => q.eq(q.field("firmId"), firmId))
          .take(perTypeLimit),
        ctx.db
          .query("matters")
          .withSearchIndex("search_suit", (q) => q.search("suitNumber", term))
          .filter((q) => q.eq(q.field("firmId"), firmId))
          .take(perTypeLimit),
        ctx.db
          .query("contacts")
          .withSearchIndex("search_name", (q) => q.search("name", term))
          .filter((q) => q.eq(q.field("firmId"), firmId))
          .take(perTypeLimit),
        ctx.db
          .query("documents")
          .withSearchIndex("search_title", (q) => q.search("title", term))
          .filter((q) => q.eq(q.field("firmId"), firmId))
          .take(perTypeLimit),
        ctx.db
          .query("tasks")
          .withSearchIndex("search_title", (q) => q.search("title", term))
          .filter((q) => q.eq(q.field("firmId"), firmId))
          .take(perTypeLimit),
        // K-1: property search — only queried when the firm is
        // property-capable (the promise still resolves so the destructuring
        // shape stays uniform).
        propertySearchEnabled
          ? ctx.db
              .query("properties")
              .withSearchIndex("search_address", (q) => q.search("address", term))
              .filter((q) => q.eq(q.field("firmId"), firmId))
              .take(perTypeLimit)
          : Promise.resolve([] as any[]),
      ]);

    // Merge the two matter searches (title + suitNumber), dedupe by _id
    const matterMap = new Map<
      string,
      { id: string; title: string; suitNumber?: string }
    >();
    for (const m of [...mattersByTitle, ...mattersBySuit]) {
      const id = String(m._id);
      if (!matterMap.has(id)) {
        matterMap.set(id, {
          id,
          title: m.title || "",
          suitNumber: m.suitNumber || undefined,
        });
      }
    }

    return {
      matters: Array.from(matterMap.values()).slice(0, perTypeLimit),
      contacts: contacts.map((c) => ({
        id: String(c._id),
        name: c.name || "",
        email: c.email || undefined,
      })),
      documents: documents.map((d) => ({
        id: String(d._id),
        title: d.title || "",
      })),
      tasks: tasks.map((t) => ({
        id: String(t._id),
        title: t.title || "",
      })),
      properties: properties.map((p) => ({
        id: String(p._id),
        address: p.address || "",
        status: p.status || undefined,
      })),
    };
  },
});

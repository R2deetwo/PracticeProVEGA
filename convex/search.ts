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
 * documents.search_title, tasks.search_title) and returns a slim projection
 * per category, firm-scoped via the caller's authenticated firm.
 *
 * Search indexes rank by relevance; the firmId filter is applied
 * server-side after the search. Each category is capped (default 10) so
 * the payload stays small regardless of firm size.
 */

const MIN_TERM_LENGTH = 2;

export const searchAll = query({
  args: {
    userEmail: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    const firmId = auth.firmId;
    const term = args.query.trim();
    const perTypeLimit = Math.min(Math.max(args.limit ?? 10, 1), 25);

    if (!firmId || term.length < MIN_TERM_LENGTH) {
      return { matters: [], contacts: [], documents: [], tasks: [] };
    }

    const [mattersByTitle, mattersBySuit, contacts, documents, tasks] =
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
    };
  },
});

import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// ─────────────────────────────────────────────────────────────────────────────
// LEGAL MODULES — CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const getAllModules = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("legal_modules").take(100);
    },
});

export const getModulesByCategory = query({
    args: { category: v.string() },
    handler: async (ctx, { category }) => {
        return await ctx.db
            .query("legal_modules")
            .withIndex("by_category", q => q.eq("category", category))
            .take(100);
    },
});

export const upsertModule = mutation({
    args: {
        moduleKey: v.string(),
        name: v.string(),
        shortName: v.string(),
        category: v.string(),
        jurisdiction: v.string(),
        authority: v.string(),
        version: v.optional(v.string()),
        description: v.optional(v.string()),
        coverageAreas: v.array(v.string()),
        primaryMatterTypes: v.array(v.string()),
        status: v.string(),
        isBundled: v.boolean(),
        lastUpdated: v.optional(v.string()),
        pricingType: v.optional(v.string()),
        priceAmount: v.optional(v.number()),
        currency: v.optional(v.string()),
        billingInterval: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("legal_modules")
            .withIndex("by_moduleKey", q => q.eq("moduleKey", args.moduleKey))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, args);
            return existing._id;
        }
        return await ctx.db.insert("legal_modules", args);
    },
});

export const deleteModule = mutation({
    args: { id: v.id("legal_modules") },
    handler: async (ctx, { id }) => {
        await ctx.db.delete(id);
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// STATUTES & SEMANTIC SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export const getStatutesByModule = query({
    args: { moduleKey: v.string() },
    handler: async (ctx, { moduleKey }) => {
        return await ctx.db
            .query("statutes")
            .withIndex("by_moduleKey", q => q.eq("moduleKey", moduleKey))
            .take(500);
    },
});

export const getStatuteById = query({
    args: { id: v.id("statutes") },
    handler: async (ctx, { id }) => {
        return await ctx.db.get(id);
    },
});

export const searchStatutes = action({
    args: {
        query: v.array(v.number()),
        moduleKey: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<any[]> => {
        const results = await ctx.vectorSearch("statutes", "by_embedding", {
            vector: args.query,
            limit: args.limit || 5,
            filter: args.moduleKey ? (q: any) => q.eq("moduleKey", args.moduleKey) : undefined,
        });

        // Resolve ID into actual record content using a query
        return await Promise.all(
            results.map(async (r: any) => {
                const statute = await ctx.runQuery(api.legalRepo.getStatuteById, { id: r._id as any });
                return { ...statute, _score: r._score };
            })
        );
    },
});

export const addStatute = mutation({
    args: {
        moduleKey: v.string(),
        title: v.string(),
        year: v.optional(v.number()),
        chapter: v.optional(v.string()),
        documentType: v.optional(v.string()),
        court: v.optional(v.string()),
        parties: v.optional(v.string()),
        suitNumber: v.optional(v.string()),
        dateOfDelivery: v.optional(v.string()),
        fullText: v.optional(v.string()),
        summary: v.optional(v.string()),
        citation: v.optional(v.string()),
        tags: v.array(v.string()),
        sourceUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("statutes", args);
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// FIRM LICENSES
// ─────────────────────────────────────────────────────────────────────────────

export const getLicensesForFirm = query({
    args: { firmId: v.string() },
    handler: async (ctx, { firmId }) => {
        return await ctx.db
            .query("firm_licenses")
            .withIndex("by_firmId", q => q.eq("firmId", firmId))
            .filter(q => q.eq(q.field("isActive"), true))
            .take(100);
    },
});

export const getAllLicenses = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("firm_licenses").take(500);
    },
});

export const grantLicense = mutation({
    args: {
        firmId: v.string(),
        moduleKey: v.string(),
        plan: v.string(),
    },
    handler: async (ctx, { firmId, moduleKey, plan }) => {
        const existing = await ctx.db
            .query("firm_licenses")
            .withIndex("by_firmId_moduleKey", q => q.eq("firmId", firmId).eq("moduleKey", moduleKey))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, { isActive: true, plan, revokedAt: undefined });
            return existing._id;
        }
        return await ctx.db.insert("firm_licenses", {
            firmId,
            moduleKey,
            isActive: true,
            plan,
            grantedAt: new Date().toISOString(),
        });
    },
});

export const revokeLicense = mutation({
    args: { firmId: v.string(), moduleKey: v.string() },
    handler: async (ctx, { firmId, moduleKey }) => {
        const license = await ctx.db
            .query("firm_licenses")
            .withIndex("by_firmId_moduleKey", q => q.eq("firmId", firmId).eq("moduleKey", moduleKey))
            .first();
        if (license) {
            await ctx.db.patch(license._id, { isActive: false, revokedAt: new Date().toISOString() });
        }
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// USAGE LOGS
// ─────────────────────────────────────────────────────────────────────────────

export const getUsageLogs = query({
    args: {
        firmId: v.optional(v.string()),
        moduleKey: v.optional(v.string()),
    },
    handler: async (ctx, { firmId, moduleKey }) => {
        if (firmId) {
            return await ctx.db
                .query("module_usage_logs")
                .withIndex("by_firmId", q => q.eq("firmId", firmId))
                .order("desc")
                .take(500);
        }
        if (moduleKey) {
            return await ctx.db
                .query("module_usage_logs")
                .withIndex("by_moduleKey", q => q.eq("moduleKey", moduleKey))
                .order("desc")
                .take(500);
        }
        return await ctx.db.query("module_usage_logs").order("desc").take(500);
    },
});

export const logUsage = mutation({
    args: {
        firmId: v.string(),
        moduleKey: v.string(),
        action: v.string(),
        sourceType: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("module_usage_logs", {
            ...args,
            loggedAt: new Date().toISOString(),
        });
    },
});

/**
 * Specifically used by ALOA to log usage while attributing the source
 */
export const logAloaModuleUsage = mutation({
    args: {
        firmId: v.string(),
        moduleKey: v.string(),
        query: v.string(),
        sourceType: v.literal("module"),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("module_usage_logs", {
            firmId: args.firmId,
            moduleKey: args.moduleKey,
            action: `ALOA Query: ${args.query}`,
            sourceType: "module",
            loggedAt: new Date().toISOString(),
        });
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTES ARCHIVE
// ─────────────────────────────────────────────────────────────────────────────

export const getArchivedNotes = query({
    args: { contextType: v.optional(v.string()) },
    handler: async (ctx, args) => {
        let q = ctx.db.query("notePages")
            .filter(qFilter => qFilter.neq(qFilter.field("archivedAt"), undefined));
        
        if (args.contextType && args.contextType !== 'all') {
             q = q.filter(qFilter => qFilter.eq(qFilter.field("contextType"), args.contextType));
        }
        
        return await q.collect();
    }
});

export const restoreNote = mutation({
    args: { id: v.id("notePages") },
    handler: async (ctx, args) => {
        const note = await ctx.db.get(args.id);
        if (!note) {
            throw new Error("Note not found");
        }
        await ctx.db.patch(args.id, { archivedAt: undefined });
    }
});

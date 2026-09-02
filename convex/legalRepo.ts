import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { resolveCaller } from "./callerAuth";

// ─────────────────────────────────────────────────────────────────────────────
// LEGAL MODULES — catalog reads
// ─────────────────────────────────────────────────────────────────────────────
// Round 8 auth retrofit: this module previously exported 14 public functions.
// Seven had zero callers AND no auth: upsertModule / deleteModule / addStatute
// (wrote the shared legal library), logUsage / logAloaModuleUsage (spoofable
// telemetry), getArchivedNotes + restoreNote (read/restored ANY firm's notes).
// All seven were deleted. The live license-management surfaces are now
// caller-verified: Founders may manage any firm's licenses (the Founder App
// admission rule); firm staff may only manage their own firm's.

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

/**
 * All licenses, scoped by caller: Founders see every firm's licenses;
 * firm staff see only their own firm's (previously ANY caller received
 * the full cross-firm licensing table).
 */
export const getAllLicenses = query({
    args: { userEmail: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const caller = await resolveCaller(ctx, { userEmail: args.userEmail });
        if (String(caller.role || "") === "Founder") {
            return await ctx.db.query("firm_licenses").take(500);
        }
        return await ctx.db
            .query("firm_licenses")
            .withIndex("by_firmId", q => q.eq("firmId", caller.firmId as any))
            .take(500);
    },
});

/**
 * Grant a module license. Founders may grant to any firm; firm staff may
 * only license their own firm (previously any caller could grant any firm
 * an Enterprise plan — a billing bypass).
 */
export const grantLicense = mutation({
    args: {
        firmId: v.string(),
        moduleKey: v.string(),
        plan: v.string(),
        userEmail: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const caller = await resolveCaller(ctx, { userEmail: args.userEmail });
        const isFounder = String(caller.role || "") === "Founder";
        if (!isFounder) {
            const firmId = String(caller.firmId || "");
            if (!firmId || firmId !== String(args.firmId)) {
                throw new Error(
                    "Not authorized: staff may only license their own firm. Cross-firm grants require a Founder."
                );
            }
        }

        const existing = await ctx.db
            .query("firm_licenses")
            .withIndex("by_firmId_moduleKey", q => q.eq("firmId", args.firmId).eq("moduleKey", args.moduleKey))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, { isActive: true, plan: args.plan, revokedAt: undefined });
            return existing._id;
        }
        return await ctx.db.insert("firm_licenses", {
            firmId: args.firmId,
            moduleKey: args.moduleKey,
            isActive: true,
            plan: args.plan,
            grantedAt: new Date().toISOString(),
        });
    },
});

/** Revoke a module license — same Founder/staff-own-firm rule as grantLicense. */
export const revokeLicense = mutation({
    args: { firmId: v.string(), moduleKey: v.string(), userEmail: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const caller = await resolveCaller(ctx, { userEmail: args.userEmail });
        const isFounder = String(caller.role || "") === "Founder";
        if (!isFounder) {
            const firmId = String(caller.firmId || "");
            if (!firmId || firmId !== String(args.firmId)) {
                throw new Error(
                    "Not authorized: staff may only revoke their own firm's licenses."
                );
            }
        }

        const license = await ctx.db
            .query("firm_licenses")
            .withIndex("by_firmId_moduleKey", q => q.eq("firmId", args.firmId).eq("moduleKey", args.moduleKey))
            .first();
        if (license) {
            await ctx.db.patch(license._id, { isActive: false, revokedAt: new Date().toISOString() });
        }
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// USAGE LOGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module usage logs, scoped by caller: Founders see all firms; staff see
 * their own firm only (previously returned the global cross-firm feed).
 */
export const getUsageLogs = query({
    args: {
        userEmail: v.optional(v.string()),
        firmId: v.optional(v.string()),
        moduleKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const caller = await resolveCaller(ctx, { userEmail: args.userEmail });
        const isFounder = String(caller.role || "") === "Founder";
        // Non-founders are pinned to their own firm regardless of args.
        const scopeFirmId = isFounder ? args.firmId : String(caller.firmId || "");

        if (scopeFirmId) {
            return await ctx.db
                .query("module_usage_logs")
                .withIndex("by_firmId", q => q.eq("firmId", scopeFirmId))
                .order("desc")
                .take(500);
        }
        const moduleKey = args.moduleKey;
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

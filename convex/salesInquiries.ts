import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Sales Inquiries — Unauthenticated lead capture pipeline.
 *
 * These functions operate COMPLETELY INDEPENDENTLY of user authentication.
 * No auth token, session, or firmId is required or checked.
 * This is by design: the Contact Sales drawer is available to anonymous
 * public visitors on the marketing site.
 */

// Submit a new sales inquiry (NO AUTH REQUIRED)
export const submitSalesInquiry = mutation({
    args: {
        email: v.string(),
        name: v.string(),
        companyName: v.optional(v.string()),
        message: v.string(),
        source: v.optional(v.string()), // Where the CTA was: "Enterprise Pricing CTA", "Komplete Callout", "Footer", etc.
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        const inquiryId = await ctx.db.insert("sales_inquiries", {
            email: args.email,
            name: args.name,
            companyName: args.companyName ?? "",
            message: args.message,
            source: args.source ?? "landing_page",
            status: "new",
            createdAt: now,
            updatedAt: now,
        });

        // Future: Trigger webhook / email notification here
        // e.g., await fetch(process.env.SALES_WEBHOOK_URL, { method: 'POST', body: JSON.stringify(args) });

        return inquiryId;
    },
});

// List all sales inquiries (for admin dashboard — protected by auth in future)
export const listSalesInquiries = query({
    args: {
        status: v.optional(v.union(
            v.literal("new"),
            v.literal("contacted"),
            v.literal("qualified"),
            v.literal("closed"),
            v.literal("spam"),
        )),
    },
    handler: async (ctx, args) => {
        let q = ctx.db.query("sales_inquiries").order("desc");
        const all = await q.collect();

        if (args.status) {
            return all.filter(i => i.status === args.status);
        }
        return all;
    },
});

// Update inquiry status (for admin use)
export const updateInquiryStatus = mutation({
    args: {
        inquiryId: v.id("sales_inquiries"),
        status: v.union(
            v.literal("new"),
            v.literal("contacted"),
            v.literal("qualified"),
            v.literal("closed"),
            v.literal("spam"),
        ),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.inquiryId, {
            status: args.status,
            notes: args.notes,
            updatedAt: Date.now(),
        });
    },
});

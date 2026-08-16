import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { notifyFounders } from "./founderNotifications";

/**
 * Sales Inquiries — Unauthenticated lead capture pipeline.
 *
 * These functions operate COMPLETELY INDEPENDENTLY of user authentication.
 * No auth token, session, or firmId is required or checked.
 * This is by design: the Contact Sales drawer is available to anonymous
 * public visitors on the marketing site.
 *
 * NOTIFICATION PIPELINE:
 * When a new lead is submitted, the backend:
 *   1. Inserts the lead into sales_inquiries table
 *   2. Creates a notification for ALL founder users (visible in Founder App)
 *   3. Fires an FCM push notification to the founder's registered devices
 * This ensures the founder is instantly alerted to new sales leads.
 */

// Submit a new sales inquiry (NO AUTH REQUIRED)
export const submitSalesInquiry = mutation({
    args: {
        email: v.string(),
        name: v.string(),
        companyName: v.optional(v.string()),
        message: v.string(),
        source: v.optional(v.string()),
        productInterest: v.optional(v.string()), // Vega / Atrium / Komplete
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        const inquiryId = await ctx.db.insert("sales_inquiries", {
            email: args.email,
            name: args.name,
            companyName: args.companyName ?? "",
            message: args.message,
            source: args.source ?? "landing_page",
            productInterest: args.productInterest ?? undefined,
            status: "unread",
            createdAt: now,
            updatedAt: now,
        });

        // ─── FOUNDER NOTIFICATION PIPELINE (unified) ───────────────────
        // Single function handles: in-app notification + FCM push to all founders.
        // Replaces 30+ lines of copy-pasted notification logic.
        await notifyFounders(ctx, {
            title: "New Sales Lead",
            message: `${args.name}${args.companyName ? ` (${args.companyName})` : ''} — ${args.productInterest ? `Interested in ${args.productInterest}` : 'Submitted an inquiry'}`,
            type: "sales_lead",
            link: {
                view: "sales",
                id: String(inquiryId),
                context: { inquiryId: String(inquiryId) },
            },
        });

        return inquiryId;
    },
});

// List all sales inquiries (for Founder App — Sales Pipeline tab)
export const listSalesInquiries = query({
    args: {
        status: v.optional(v.union(
            v.literal("unread"),
            v.literal("contacted"),
            v.literal("qualified"),
            v.literal("converted"),
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

// Get unread sales inquiry count (for badge)
export const getUnreadSalesInquiryCount = query({
    args: {},
    handler: async (ctx) => {
        const all = await ctx.db.query("sales_inquiries").collect();
        return all.filter(i => i.status === "unread").length;
    },
});

// Update inquiry status (for Founder App — marks as contacted/read)
export const updateInquiryStatus = mutation({
    args: {
        inquiryId: v.id("sales_inquiries"),
        status: v.union(
            v.literal("unread"),
            v.literal("contacted"),
            v.literal("qualified"),
            v.literal("converted"),
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

        // If marking as contacted/qualified/converted/closed, also mark
        // the associated notification as read so the badge decrements.
        if (args.status !== "unread") {
            const notifs = await ctx.db
                .query("notifications")
                .filter((q: any) => q.eq(q.field("type"), "sales_lead"))
                .collect();
            for (const n of notifs) {
                if (n.link?.context?.inquiryId === String(args.inquiryId) && !n.isRead) {
                    await ctx.db.patch(n._id, { isRead: true, updatedAt: new Date().toISOString() } as any);
                }
            }
        }

        return { success: true };
    },
});

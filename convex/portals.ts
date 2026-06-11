import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Maintenance Tickets ────────────────────────────────────────────────

export const createMaintenanceTicket = mutation({
  args: {
    firmId: v.string(),
    propertyId: v.string(),
    unitId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    tenantName: v.optional(v.string()),
    subject: v.string(),
    description: v.string(),
    category: v.union(v.literal("plumbing"), v.literal("electrical"), v.literal("structural"), v.literal("other")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("maintenance_tickets", {
      ...args,
      status: "open",
      priority: "medium",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getMaintenanceTicketsByTenant = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("maintenance_tickets")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  },
});

export const getMaintenanceTicketsByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("maintenance_tickets")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .order("desc")
      .collect();
  },
});

export const updateMaintenanceTicketStatus = mutation({
  args: {
    ticketId: v.id("maintenance_tickets"),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
    resolution: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
  },
  handler: async (ctx, args) => {
    const { ticketId, ...updates } = args;
    await ctx.db.patch(ticketId, { ...updates, updatedAt: Date.now() });
  },
});

// ─── Portal Invites ─────────────────────────────────────────────────────

export const createPortalInvite = mutation({
  args: {
    firmId: v.string(),
    inviterId: v.string(),
    inviteeEmail: v.string(),
    inviteeName: v.optional(v.string()),
    inviteePhone: v.optional(v.string()),
    portalType: v.union(v.literal("client"), v.literal("resident")),
    relatedId: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
    return await ctx.db.insert("portal_invites", {
      ...args,
      status: "pending",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getPortalInvitesByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portal_invites")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .order("desc")
      .collect();
  },
});

export const acceptPortalInvite = mutation({
  args: { inviteId: v.id("portal_invites") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inviteId, {
      status: "accepted",
      acceptedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// ─── Scheduled Messages ─────────────────────────────────────────────────

export const getScheduledMessagesByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scheduled_messages")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .order("desc")
      .collect();
  },
});

export const getPendingScheduledMessages = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const all = await ctx.db
      .query("scheduled_messages")
      .withIndex("by_firm_status", (q) => q.eq("firmId", args.firmId).eq("status", "scheduled"))
      .collect();
    return all.filter(m => m.scheduledFor > now).sort((a, b) => a.scheduledFor - b.scheduledFor);
  },
});

export const createScheduledMessage = mutation({
  args: {
    firmId: v.string(),
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    tenantIds: v.optional(v.array(v.string())),
    messageType: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("sms")),
    content: v.string(),
    scheduledFor: v.number(),
    isAutomation: v.optional(v.boolean()),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("scheduled_messages", {
      ...args,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const cancelScheduledMessage = mutation({
  args: { messageId: v.id("scheduled_messages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});

// ─── Tenant Ledger for Portal ───────────────────────────────────────────

export const getTenantLedger = query({
  args: { firmId: v.string(), tenantId: v.string() },
  handler: async (ctx, args) => {
    // Find all properties where this tenant is assigned
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const tenantProperties = properties.filter(p => p.currentTenantId === args.tenantId || p.tenantId === args.tenantId);

    // Get ledger entries for those properties/units
    const allLedger = await ctx.db
      .query("ledger_entries")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const tenantEntries = allLedger.filter(e => e.tenantId === args.tenantId);
    return tenantEntries;
  },
});

// ─── Inbound Messages for Tenant Portal ─────────────────────────────────

export const getInboundMessagesByTenant = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("atrium_inbound_messages")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  },
});

// ─── Client Documents for Portal ────────────────────────────────────────

export const getClientDocuments = query({
  args: { firmId: v.string(), contactId: v.string() },
  handler: async (ctx, args) => {
    // Find matters for this contact
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const clientMatters = matters.filter(m => m.clientId === args.contactId);
    const matterIds = clientMatters.map(m => m._id);

    if (matterIds.length === 0) return [];

    // Get documents for those matters
    const allDocs = await ctx.db
      .query("documents")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Also build a map of matterId -> matter title for enrichment
    const matterMap = new Map(clientMatters.map(m => [String(m._id), m.title || ""]));

    return allDocs
      .filter(d => d.matterId && matterIds.includes(d.matterId as any))
      .map(d => ({
        _id: d._id,
        title: d.title,
        matterId: d.matterId,
        matterTitle: d.matterId ? (matterMap.get(String(d.matterId)) || null) : null,
        dateFiled: d.dateFiled,
        isSharedWithClient: d.isSharedWithClient,
        clientReviewStatus: d.clientReviewStatus,
        isSignatureRequested: d.isSignatureRequested,
        source: d.source,
        createdAt: d.createdAt,
      }));
  },
});

// ─── Client Messages for Portal ─────────────────────────────────────────

export const getClientMessages = query({
  args: { firmId: v.string(), contactId: v.string() },
  handler: async (ctx, args) => {
    // Find matters for this contact
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const clientMatters = matters.filter(m => m.clientId === args.contactId);
    const matterIds = clientMatters.map(m => String(m._id));

    if (matterIds.length === 0) return [];

    // Get client messages for those matters
    const allMessages = await ctx.db
      .query("clientMessages")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Build matter title map
    const matterMap = new Map(clientMatters.map(m => [String(m._id), m.title || ""]));

    return allMessages
      .filter(m => matterIds.includes(m.matterId || ""))
      .sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tB - tA;
      })
      .slice(0, 50)
      .map(m => ({
        _id: m._id,
        matterId: m.matterId,
        matterTitle: matterMap.get(m.matterId || "") || "",
        authorId: m.authorId,
        content: m.content,
        timestamp: m.timestamp,
        isRead: m.isRead,
      }));
  },
});

// ─── Client Activity for Portal ─────────────────────────────────────────

export const getClientActivity = query({
  args: { firmId: v.string(), contactId: v.string() },
  handler: async (ctx, args) => {
    // Find matters for this contact
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const clientMatters = matters.filter(m => m.clientId === args.contactId);
    const matterIds = clientMatters.map(m => String(m._id));

    if (matterIds.length === 0) return [];

    // Get firm activity for those matters
    const allActivity = await ctx.db
      .query("firmActivity")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    return allActivity
      .filter(a => a.matterId && matterIds.includes(a.matterId))
      .sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tB - tA;
      })
      .slice(0, 10)
      .map(a => ({
        _id: a._id,
        userId: a.userId,
        userName: a.userName,
        action: a.action,
        targetType: a.targetType,
        targetName: a.targetName,
        matterId: a.matterId,
        timestamp: a.timestamp,
      }));
  },
});

// ─── Client Invoices for Portal ─────────────────────────────────────────

export const getClientInvoices = query({
  args: { firmId: v.string(), contactId: v.string() },
  handler: async (ctx, args) => {
    // Find matters for this contact
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const clientMatters = matters.filter(m => m.clientId === args.contactId);
    const matterIds = clientMatters.map(m => String(m._id));

    if (matterIds.length === 0) return [];

    // Get invoices for those matters
    const allInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    return allInvoices.filter(inv => {
      const matterField = inv.matter as any;
      const matterId = matterField?.id || matterField;
      return matterId && matterIds.includes(String(matterId));
    });
  },
});

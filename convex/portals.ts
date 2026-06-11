import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

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

/** Generate a crypto-random invite token (12 chars, URL-safe) */
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(12);
  // @ts-ignore — crypto available in Convex runtime
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join("");
}

/**
 * createPortalInvite — ACTION (not a plain mutation) so it can call
 * sendEmail / sendWhatsApp via ctx.runAction.
 *
 * 1. Generates a unique token for the magic-link URL
 * 2. Writes the portal_invites record
 * 3. Sends the invitation via the chosen channel (email / whatsapp / both)
 */
export const createPortalInvite = action({
  args: {
    firmId: v.string(),
    inviterId: v.string(),
    inviteeEmail: v.optional(v.string()),
    inviteeName: v.optional(v.string()),
    inviteePhone: v.optional(v.string()),
    portalType: v.union(v.literal("client"), v.literal("resident")),
    relatedId: v.optional(v.string()),
    channel: v.optional(v.string()),       // "email" | "whatsapp" | "both" — default "email"
    message: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ inviteId: string; token: string; channel: string; emailSent: boolean; emailSimulated: boolean; whatsappSent: boolean; whatsappSimulated: boolean; whatsappSkipped: boolean }> => {
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
    const token = generateToken();
    const channel = args.channel || "email";

    // 1. Insert the invite record
    const inviteId: string = await ctx.runMutation(api.portals.insertInviteRecord, {
      firmId: args.firmId,
      inviterId: args.inviterId,
      inviteeEmail: args.inviteeEmail,
      inviteeName: args.inviteeName,
      inviteePhone: args.inviteePhone,
      portalType: args.portalType,
      relatedId: args.relatedId,
      token,
      channel,
      message: args.message,
      expiresAt,
    });

    // 2. Build the magic-link URL
    const portalBase = args.portalType === "client"
      ? "https://practice-pro-vega.vercel.app/portal/client/login"
      : "https://practice-pro-vega.vercel.app/portal/tenant/login";
    const inviteUrl = `${portalBase}?token=${token}`;
    const portalLabel = args.portalType === "client" ? "Client Portal" : "Residents' Portal";
    const inviteeGreeting = args.inviteeName ? args.inviteeName : args.inviteeEmail;
    const personalMsg = args.message ? `\n\nPersonal message: ${args.message}` : "";

    // 3. Send via email (skip if no email address provided)
    const shouldSendEmail = (channel === "email" || channel === "both") && args.inviteeEmail;
    let emailResult: any = { success: true, simulated: true };
    if (shouldSendEmail) {
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #0f172a; border-radius: 16px; color: #e2e8f0;">
          <div style="text-align: center; margin-bottom: 28px;">
            <span style="font-size: 22px; font-weight: 800; color: #ffffff;">Practice<span style="color: #f59e0b;">Pro</span></span>
          </div>
          <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px;">You're Invited to the ${portalLabel}</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px;">
            Hello ${inviteeGreeting},<br/><br/>
            You have been invited to access the ${portalLabel} on PracticePro. Click the button below to get started.
            ${args.message ? `<br/><br/><em style="color: #cbd5e1;">"${args.message}"</em>` : ""}
          </p>
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff; font-weight: 700; font-size: 15px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);">
              Accept Invitation & Open Portal
            </a>
          </div>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            Or copy and paste this link into your browser:<br/>
            <a href="${inviteUrl}" style="color: #60a5fa; word-break: break-all;">${inviteUrl}</a><br/><br/>
            This invitation expires in 7 days. If you did not expect this invitation, you can safely ignore it.
          </p>
          <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;"/>
          <p style="font-size: 11px; color: #475569; text-align: center;">
            PracticePro Tech Ltd · Lagos, Nigeria · NDPA 2023 Compliant · ISO 27001 Aligned
          </p>
        </div>
      `;
      emailResult = await ctx.runAction(api.communications.sendEmail, {
        to: args.inviteeEmail!,
        toName: args.inviteeName,
        subject: `You're Invited: ${portalLabel} on PracticePro`,
        htmlContent: htmlBody,
        firmId: args.firmId,
      });
    }

    // 4. Send via WhatsApp
    const shouldSendWhatsApp = (channel === "whatsapp" || channel === "both") && args.inviteePhone;
    let waResult: any = { success: true, simulated: true };
    if (shouldSendWhatsApp) {
      const waText = `PracticePro ${portalLabel} Invitation\n\nHello ${inviteeGreeting}, you've been invited to the ${portalLabel}.\n\nClick here to access: ${inviteUrl}\n\nThis link expires in 7 days.${personalMsg}\n\n— PracticePro`;
      waResult = await ctx.runAction(api.communications.sendWhatsApp, {
        to: args.inviteePhone!,
        messageText: waText,
        firmId: args.firmId,
      });
    }

    return {
      inviteId,
      token,
      channel,
      emailSent: emailResult.success && !emailResult.simulated,
      emailSimulated: emailResult.simulated || false,
      whatsappSent: shouldSendWhatsApp && waResult.success && !waResult.simulated,
      whatsappSimulated: shouldSendWhatsApp && (waResult.simulated || false),
      whatsappSkipped: !shouldSendWhatsApp,
    };
  },
});

/**
 * Internal mutation — only used by createPortalInvite action to write the DB record.
 * Not exported for direct frontend use.
 */
export const insertInviteRecord = mutation({
  args: {
    firmId: v.string(),
    inviterId: v.string(),
    inviteeEmail: v.optional(v.string()),
    inviteeName: v.optional(v.string()),
    inviteePhone: v.optional(v.string()),
    portalType: v.union(v.literal("client"), v.literal("resident")),
    relatedId: v.optional(v.string()),
    token: v.optional(v.string()),
    channel: v.optional(v.string()),
    message: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("portal_invites", {
      firmId: args.firmId,
      inviterId: args.inviterId,
      inviteeEmail: args.inviteeEmail,
      inviteeName: args.inviteeName,
      inviteePhone: args.inviteePhone,
      portalType: args.portalType,
      relatedId: args.relatedId,
      token: args.token ?? undefined,
      channel: args.channel,
      message: args.message,
      status: "pending",
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * resendPortalInvite — action that updates the existing record's expiry + token,
 * then re-sends via the stored channel.
 */
export const resendPortalInvite = action({
  args: {
    inviteId: v.id("portal_invites"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(api.portals.getPortalInviteById, { inviteId: args.inviteId });
    if (!existing) throw new Error("Invitation not found");
    if (existing.status === "revoked") throw new Error("Cannot resend a revoked invitation");

    // Refresh token + expiry on the existing record
    const newToken = generateToken();
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
    await ctx.runMutation(api.portals.updateInviteRecord, {
      inviteId: args.inviteId,
      updates: { token: newToken, status: "pending", expiresAt, updatedAt: now },
    });

    // Re-send via stored channel
    const portalBase = existing.portalType === "client"
      ? "https://practice-pro-vega.vercel.app/portal/client/login"
      : "https://practice-pro-vega.vercel.app/portal/tenant/login";
    const inviteUrl = `${portalBase}?token=${newToken}`;
    const portalLabel = existing.portalType === "client" ? "Client Portal" : "Residents' Portal";
    const channel = existing.channel || "email";

    let emailResult: any = { success: true, simulated: true };
    if (channel === "email" || channel === "both") {
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #0f172a; border-radius: 16px; color: #e2e8f0;">
          <div style="text-align: center; margin-bottom: 28px;">
            <span style="font-size: 22px; font-weight: 800; color: #ffffff;">Practice<span style="color: #f59e0b;">Pro</span></span>
          </div>
          <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px;">Reminder: ${portalLabel} Invitation</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px;">
            Hello ${existing.inviteeName || existing.inviteeEmail},<br/><br/>
            This is a reminder about your invitation to the ${portalLabel}. Your link has been refreshed.
          </p>
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff; font-weight: 700; font-size: 15px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);">
              Accept Invitation & Open Portal
            </a>
          </div>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            Or copy and paste this link: <a href="${inviteUrl}" style="color: #60a5fa; word-break: break-all;">${inviteUrl}</a><br/><br/>
            This invitation expires in 7 days.
          </p>
          <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;"/>
          <p style="font-size: 11px; color: #475569; text-align: center;">PracticePro Tech Ltd · Lagos, Nigeria · NDPA 2023 Compliant</p>
        </div>
      `;
      emailResult = await ctx.runAction(api.communications.sendEmail, {
        to: existing.inviteeEmail!,
        toName: existing.inviteeName,
        subject: `Reminder: ${portalLabel} Invitation on PracticePro`,
        htmlContent: htmlBody,
        firmId: existing.firmId,
      });
    }

    let waResult: any = { success: true, simulated: true };
    if ((channel === "whatsapp" || channel === "both") && existing.inviteePhone) {
      const waText = `Reminder: PracticePro ${portalLabel} Invitation\n\nHello ${existing.inviteeName || existing.inviteeEmail}, your portal link has been refreshed.\n\nClick here: ${inviteUrl}\n\nExpires in 7 days.\n\n— PracticePro`;
      waResult = await ctx.runAction(api.communications.sendWhatsApp, {
        to: existing.inviteePhone,
        messageText: waText,
        firmId: existing.firmId,
      });
    }

    return {
      token: newToken,
      emailSent: emailResult.success && !emailResult.simulated,
      whatsappSent: waResult.success && !waResult.simulated,
    };
  },
});

/** Internal mutation to update an invite record */
export const updateInviteRecord = mutation({
  args: {
    inviteId: v.id("portal_invites"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inviteId, args.updates);
  },
});

/** Get a single invite by its ID (used by resendPortalInvite) */
export const getPortalInviteById = query({
  args: { inviteId: v.id("portal_invites") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.inviteId);
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

export const revokePortalInvite = mutation({
  args: { inviteId: v.id("portal_invites") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inviteId, {
      status: "revoked",
      updatedAt: Date.now(),
    });
  },
});

/** Look up an invite by its token — used by portal login pages for magic-link flow */
export const getInviteByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("portal_invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .collect();
    return results[0] || null;
  },
});

/** Accept an invite by token — marks it as accepted (called when invitee visits the magic link) */
export const acceptPortalInviteByToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("portal_invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .collect();
    const invite = results[0];
    if (!invite) throw new Error("Invalid invitation link");
    if (invite.status === "accepted") return invite; // already accepted, that's fine
    if (invite.status === "revoked") throw new Error("This invitation has been revoked");
    if (invite.status === "expired" || invite.expiresAt < Date.now()) {
      await ctx.db.patch(invite._id, { status: "expired", updatedAt: Date.now() });
      throw new Error("This invitation has expired. Please request a new one.");
    }
    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return invite;
  },
});

export const getPortalInvitesByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portal_invites")
      .withIndex("by_email", (q) => q.eq("inviteeEmail", args.email))
      .collect();
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

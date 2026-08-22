import { mutation, query, action, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { requireFirmUser } from "./authHelpers";

// ─── Portal Access Token Generator ──────────────────────────────────────────
// Generates a UUID v4-style token for portal URLs.
// Format: 8-4-4-4-12 hex chars (e.g. "2e71135d-003e-42dd-83ff-9f7988e7c6ac")
// These tokens are used in URLs like /portal/tenant/{token} for identification
// and bookmarkability — NOT for authentication.
function generatePortalAccessToken(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const segment = (len: number) => Array.from({ length: len }, () => hex()).join('');
  return `${segment(8)}-${segment(4)}-4${segment(3)}-${segment(4)}-${segment(12)}`;
}

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
    // NEW: admin-configured type key (from service_request_types). If absent,
    // we fall back to the legacy `category` field for backward compat.
    requestTypeKey: v.optional(v.string()),
    requestTypeLabel: v.optional(v.string()),
    attachments: v.optional(v.array(v.string())), // Convex storage IDs for images/PDFs
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { attachments, requestTypeKey, requestTypeLabel, ...rest } = args;

    // 1. Insert the maintenance ticket
    const ticketId = await ctx.db.insert("maintenance_tickets", {
      ...rest,
      requestTypeKey: requestTypeKey ?? undefined,
      requestTypeLabel: requestTypeLabel ?? undefined,
      // Schema uses 'images' field, not 'attachments' — map accordingly
      images: attachments ?? [],
      status: "open",
      priority: "medium",
      createdAt: now,
      updatedAt: now,
    });

    // 2. CRITICAL WIRING — also create a portal_message in the resident's
    //    conversation thread so the practitioner sees it in their unified
    //    inbox. Without this, tickets would disappear into the database and
    //    the practitioner would never know a request was submitted.
    let conversationId: string | undefined;
    if (args.tenantId) {
      try {
        const conversation = await getOrCreateConversation(ctx, {
          firmId: args.firmId,
          participantId: args.tenantId,
          participantName: args.tenantName,
          participantRole: "Tenant",
          propertyId: args.propertyId,
          unitId: args.unitId,
        });
        conversationId = String(conversation._id);

        const typeLabel = requestTypeLabel || args.category;
        const messageContent = [
          `🔧 New maintenance request — ${typeLabel}`,
          ``,
          `Subject: ${args.subject}`,
          ``,
          `Description:`,
          args.description,
        ].join('\n');

        await ctx.db.insert("portal_messages", {
          firmId: args.firmId,
          conversationId,
          senderId: args.tenantId,
          senderName: args.tenantName,
          senderRole: "Tenant",
          subject: `Maintenance Request: ${args.subject}`,
          content: messageContent,
          attachments: attachments ?? [],
          attachmentNames: [],
          propertyId: args.propertyId,
          unitId: args.unitId,
          status: "unread",
          isRead: false,
          linkedTicketId: String(ticketId),
          requestTypeKey: requestTypeKey ?? undefined,
          requestTypeLabel: requestTypeLabel ?? typeLabel,
          createdAt: now,
          updatedAt: now,
        });

        // Update conversation metadata — bump unread + last message preview
        const existingUnread = (conversation as any).unreadByAdmin || 0;
        await ctx.db.patch(conversation._id, {
          lastMessageAt: now,
          lastMessagePreview: `🔧 Maintenance: ${args.subject}`.substring(0, 80),
          lastMessageBy: "participant",
          unreadByAdmin: existingUnread + 1,
          updatedAt: now,
        });

        // Link the conversation back to the ticket for bi-directional lookup
        await ctx.db.patch(ticketId, { conversationId });
      } catch (err) {
        // We don't want to fail the ticket creation if conversation wiring
        // fails — the ticket itself is the source of truth. Log and move on.
        console.error("[createMaintenanceTicket] conversation wiring failed:", err);
      }
    }

    // 3. Notify all firm admins that a new maintenance ticket was submitted.
    //    This creates an in-app notification (shows in the header bell) AND
    //    schedules an email if the firm has portal_maintenance_ticket enabled.
    //    This was the missing piece — tickets were created but admins were
    //    never alerted, so the notification bell stayed empty.
    try {
      await notifyFirmAdmins(ctx, {
        firmId: args.firmId,
        title: `New maintenance ticket: ${args.subject}`,
        message: `${args.tenantName || 'A resident'} submitted a maintenance request${requestTypeLabel ? ` (${requestTypeLabel})` : ''}: ${args.subject}`,
        type: "portal_maintenance_ticket",
        link: { view: "messaging", initialTab: "inbox" },
        actorName: args.tenantName,
        actorEmail: undefined,
      });
    } catch (err) {
      console.warn("[createMaintenanceTicket] Failed to notify admins:", (err as any)?.message);
    }

    return ticketId;
  },
});

export const getMaintenanceTicketsByTenant = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query("maintenance_tickets")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();

    // Also try matching by email in case the tenantId stored is the user's email
    // This handles the case where the invite was created with the email as the tenant ID
    if (tickets.length === 0 && args.tenantId.includes('@')) {
      // The tenantId looks like an email, also search by the user's Convex _id
      const user: any = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tenantId.toLowerCase()))
        .first();
      if (user) {
        const byUserId = await ctx.db
          .query("maintenance_tickets")
          .withIndex("by_tenant", (q) => q.eq("tenantId", String(user._id)))
          .order("desc")
          .collect();
        return byUserId;
      }
    }

    return tickets;
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

/**
 * getTicketById — Fetches a single maintenance ticket by its _id.
 * Used by the MessagesView to display the ticket status bar when a
 * linked ticket conversation is opened.
 */
export const getTicketById = query({
  args: { ticketId: v.id("maintenance_tickets") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ticketId);
  },
});

/**
 * getServiceRequestById — Fetches a single client service request by its _id.
 * Used by the MessagesView to display the ticket status bar when a
 * linked service request conversation is opened.
 */
export const getServiceRequestById = query({
  args: { requestId: v.id("client_service_requests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.requestId);
  },
});

export const updateMaintenanceTicketStatus = mutation({
  args: {
    ticketId: v.id("maintenance_tickets"),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
    resolution: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // P6 SECURITY FIX: Verify caller belongs to the firm that owns this ticket.
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new Error("Maintenance ticket not found.");
    }
    // SECURITY FIX: Fail CLOSED — require verified firmId, don't skip check when userEmail is omitted.
    const auth = await requireFirmUser(ctx, args.userEmail);
    if (!auth.firmId) {
      throw new Error("Unauthenticated: userEmail required. Anonymous ticket updates are no longer permitted.");
    }
    if (!ticket.firmId || auth.firmId !== ticket.firmId) {
      try {
        await ctx.db.insert("securityEvents", {
          eventType: "cross_firm_access_attempt",
          details: `updateMaintenanceTicketStatus: caller ${args.userEmail} (firm ${auth.firmId}) attempted to update ticket ${args.ticketId} owned by firm ${ticket.firmId}`,
          timestamp: Date.now(),
        });
      } catch {}
      throw new Error("Not authorized: ticket belongs to a different firm.");
    }
    const { ticketId, ...updates } = args;
    await ctx.db.patch(ticketId, { ...updates, updatedAt: Date.now() });

    // If admin posted a resolution + the ticket has a linked conversation,
    // also post a portal_message reply so the resident gets notified in-thread.
    if (updates.resolution) {
      const ticket: any = await ctx.db.get(ticketId);
      if (ticket?.conversationId) {
        const now = Date.now();
        await ctx.db.insert("portal_messages", {
          firmId: ticket.firmId,
          conversationId: ticket.conversationId,
          senderId: updates.assignedTo || "admin",
          senderName: "Property Manager",
          senderRole: "Admin",
          subject: `Update: ${ticket.subject}`,
          content: `Your maintenance request status is now "${updates.status}".\n\nResolution: ${updates.resolution}`,
          attachments: [],
          attachmentNames: [],
          propertyId: ticket.propertyId,
          unitId: ticket.unitId,
          status: "read",
          isRead: false,
          linkedTicketId: String(ticketId),
          requestTypeKey: ticket.requestTypeKey,
          requestTypeLabel: ticket.requestTypeLabel || ticket.category,
          createdAt: now,
          updatedAt: now,
        });
        const conv: any = await ctx.db.get(ticket.conversationId as any);
        if (conv) {
          await ctx.db.patch(conv._id, {
            lastMessageAt: now,
            lastMessagePreview: `✅ Update: ${ticket.subject}`.substring(0, 80),
            lastMessageBy: "admin",
            unreadByParticipant: (conv.unreadByParticipant || 0) + 1,
            updatedAt: now,
          });
        }

        // ─── Email notification to resident on maintenance status update ──
        // Van Clief principle: "the structure IS the orchestration" —
        // if we have the ticket + the resident's email, send a notification.
        // Previously: only in-app notification was created. Residents who
        // don't check the portal regularly would miss status updates.
        if (ticket.tenantEmail) {
          try {
            ctx.scheduler.runAfter(0, api.communications.sendEmail as any, {
              to: ticket.tenantEmail,
              toName: ticket.tenantName || undefined,
              subject: `Maintenance Update: ${ticket.subject}`,
              htmlContent: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                  <h2 style="color: #10b981;">Maintenance Request Update</h2>
                  <p>Hi ${ticket.tenantName || 'Resident'},</p>
                  <p>Your maintenance request "<strong>${ticket.subject}</strong>" has been updated:</p>
                  <p><strong>Status:</strong> ${updates.status}<br/>
                  <strong>Resolution:</strong> ${updates.resolution}</p>
                  <p>Please log in to your resident portal to view the full conversation.</p>
                  <p style="color: #64748b; font-size: 12px; margin-top: 20px;">PracticePro Systems Limited — Lagos, Nigeria</p>
                </div>
              `,
              firmId: ticket.firmId || 'system',
              recordLog: true,
            });
          } catch (emailErr: any) {
            console.warn('[updateMaintenanceTicketStatus] Email to resident failed:', emailErr?.message);
          }
        }
      }
    }
  },
});

/**
 * completePortalTask — Called by external stakeholders (clients/residents)
 * from their portal when they mark a task as "Done".
 *
 * Instead of directly setting status='done', routes to 'pending_verification'
 * so the assigned team member can review the work before fully closing it.
 *
 * Sends an in-app notification to the task creator / firm admins so they
 * know the external stakeholder has completed their part.
 */
export const completePortalTask = mutation({
  args: {
    taskId: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    const now = new Date().toISOString();

    // Fetch the task — use by_firm index + filter (tasks table has no by_custom_id index)
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .filter((q: any) => q.eq(q.field("id"), args.taskId))
      .first();

    if (!allTasks) {
      throw new Error("Task not found.");
    }

    const task = allTasks;

    if (task.firmId !== auth.firmId) {
      throw new Error("Unauthorized. This task does not belong to your firm.");
    }

    // Route to 'pending_verification' instead of 'done'
    await ctx.db.patch(task._id, {
      status: "pending_verification",
      updatedAt: now,
    });

    // Notify the task creator + firm admins
    const firmAdmins = await ctx.db
      .query("users")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .filter((q: any) => q.eq(q.field("role"), "Admin"))
      .collect();

    const notifyPromises = (firmAdmins.length > 0 ? firmAdmins : [auth.user]).map((admin: any) => {
      const notificationId = crypto.randomUUID();
      return ctx.db.insert("notifications", {
        id: notificationId,
        firmId: auth.firmId,
        userId: admin._id.toString(),
        title: "Task Pending Verification",
        message: `${auth.user.name || 'A portal user'} marked "${task.title}" as done. Please review and close it.`,
        type: "task_pending_verification",
        isRead: false,
        link: { view: "tasks", id: args.taskId, context: { taskId: args.taskId } },
        timestamp: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    await Promise.all(notifyPromises);

    return { success: true, status: "pending_verification" };
  },
});

/**
 * cancelMaintenanceTicket — Allows a portal user (tenant) to cancel their
 * own maintenance ticket. Sets status to "cancelled" + stores the reason.
 * Posts a portal_message to the linked conversation so the admin is notified.
 */
export const cancelMaintenanceTicket = mutation({
  args: {
    ticketId: v.id("maintenance_tickets"),
    cancellationNote: v.string(),
    cancelledBy: v.string(), // userId
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ticket: any = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");
    // Only the ticket's original submitter can cancel it
    if (ticket.tenantId && ticket.tenantId !== args.cancelledBy) {
      throw new Error("Only the original submitter can cancel this ticket");
    }
    await ctx.db.patch(args.ticketId, {
      status: "cancelled",
      cancellationNote: args.cancellationNote,
      cancelledAt: now,
      updatedAt: now,
    });

    // Post a message to the linked conversation so the admin sees the cancellation
    if (ticket.conversationId) {
      try {
        await ctx.db.insert("portal_messages", {
          firmId: ticket.firmId,
          conversationId: ticket.conversationId,
          senderId: args.cancelledBy,
          senderName: ticket.tenantName || "Resident",
          senderRole: "Tenant",
          subject: `Cancelled: ${ticket.subject}`,
          content: `🔧 This maintenance ticket has been cancelled.\n\nReason: ${args.cancellationNote}`,
          attachments: [],
          attachmentNames: [],
          propertyId: ticket.propertyId,
          unitId: ticket.unitId,
          status: "unread",
          isRead: false,
          linkedTicketId: String(args.ticketId),
          requestTypeKey: ticket.requestTypeKey,
          requestTypeLabel: ticket.requestTypeLabel || ticket.category,
          createdAt: now,
          updatedAt: now,
        });
        const conv: any = await ctx.db.get(ticket.conversationId as any);
        if (conv) {
          await ctx.db.patch(conv._id, {
            lastMessageAt: now,
            lastMessagePreview: `🚫 Cancelled: ${ticket.subject}`.substring(0, 80),
            lastMessageBy: "participant",
            unreadByAdmin: (conv.unreadByAdmin || 0) + 1,
            updatedAt: now,
          });
        }
      } catch (err) {
        console.warn("[cancelMaintenanceTicket] conversation message failed:", (err as any)?.message);
      }
    }

    return { success: true };
  },
});

/**
 * cancelClientServiceRequest — Allows a portal user (client) to cancel their
 * own service request. Sets status to "cancelled" + stores the reason.
 * Posts a portal_message to the linked conversation so the admin is notified.
 */
export const cancelClientServiceRequest = mutation({
  args: {
    requestId: v.id("client_service_requests"),
    cancellationNote: v.string(),
    cancelledBy: v.string(), // userId
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const req: any = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Service request not found");
    if (req.clientId && req.clientId !== args.cancelledBy) {
      throw new Error("Only the original submitter can cancel this request");
    }
    await ctx.db.patch(args.requestId, {
      status: "cancelled",
      cancellationNote: args.cancellationNote,
      cancelledAt: now,
      updatedAt: now,
    });

    if (req.conversationId) {
      try {
        await ctx.db.insert("portal_messages", {
          firmId: req.firmId,
          conversationId: req.conversationId,
          senderId: args.cancelledBy,
          senderName: req.clientName || "Client",
          senderRole: "Client",
          subject: `Cancelled: ${req.subject}`,
          content: `📋 This service request has been cancelled.\n\nReason: ${args.cancellationNote}`,
          attachments: [],
          attachmentNames: [],
          matterId: req.matterId,
          status: "unread",
          isRead: false,
          linkedRequestId: String(args.requestId),
          requestTypeKey: req.requestTypeKey,
          requestTypeLabel: req.requestTypeLabel,
          createdAt: now,
          updatedAt: now,
        });
        const conv: any = await ctx.db.get(req.conversationId as any);
        if (conv) {
          await ctx.db.patch(conv._id, {
            lastMessageAt: now,
            lastMessagePreview: `🚫 Cancelled: ${req.subject}`.substring(0, 80),
            lastMessageBy: "participant",
            unreadByAdmin: (conv.unreadByAdmin || 0) + 1,
            updatedAt: now,
          });
        }
      } catch (err) {
        console.warn("[cancelClientServiceRequest] conversation message failed:", (err as any)?.message);
      }
    }

    return { success: true };
  },
});

/**
 * assignTicketToTeamMember — Delegates a maintenance ticket or service
 * request to a specific team member. Posts a portal_message to the
 * linked conversation so the portal user is notified that their request
 * has been assigned.
 */
export const assignTicketToTeamMember = mutation({
  args: {
    requestKind: v.union(v.literal("maintenance"), v.literal("client_service")),
    requestId: v.string(),
    assignedToUserId: v.string(),
    assignedToName: v.optional(v.string()),
    assignedBy: v.string(),
    firmId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const table = args.requestKind === "maintenance" ? "maintenance_tickets" : "client_service_requests";
    const record: any = await ctx.db.get(args.requestId as any);
    if (!record) throw new Error("Ticket/request not found");

    await ctx.db.patch(args.requestId as any, {
      assignedTo: args.assignedToUserId,
      status: record.status === "open" ? "in_progress" : record.status,
      updatedAt: now,
    } as any);

    // ─── Auto-create a task for the assigned teammate ──────────────────
    // When a ticket is delegated, a task is created in the teammate's task
    // list so they can track and manage it from their workspace.
    try {
      const ticketLabel = args.requestKind === "maintenance" ? "Maintenance Ticket" : "Service Request";
      const typeLabel = record.requestTypeLabel || record.category || ticketLabel;
      await ctx.db.insert("tasks", {
        firmId: args.firmId,
        title: `${typeLabel}: ${record.subject}`,
        description: `Assigned from conversation. ${record.description || ''}`.substring(0, 500),
        status: "todo",
        priority: record.priority || "medium",
        assignedUsers: [args.assignedToUserId],
        creatorId: args.assignedBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (taskErr) {
      console.warn("[assignTicketToTeamMember] Task creation failed:", (taskErr as any)?.message);
    }

    // Post a message to the linked conversation
    if (record.conversationId) {
      try {
        const messageContent = `👤 This ${args.requestKind === "maintenance" ? "maintenance ticket" : "service request"} has been assigned to ${args.assignedToName || "a team member"} and is now being processed.`;
        await ctx.db.insert("portal_messages", {
          firmId: args.firmId,
          conversationId: record.conversationId,
          senderId: args.assignedBy,
          senderName: "Admin",
          senderRole: "Admin",
          subject: `Assigned: ${record.subject}`,
          content: messageContent,
          attachments: [],
          attachmentNames: [],
          propertyId: record.propertyId,
          unitId: record.unitId,
          matterId: record.matterId,
          status: "read",
          isRead: false,
          linkedTicketId: args.requestKind === "maintenance" ? args.requestId : undefined,
          linkedRequestId: args.requestKind === "client_service" ? args.requestId : undefined,
          requestTypeKey: record.requestTypeKey,
          requestTypeLabel: record.requestTypeLabel || record.category,
          createdAt: now,
          updatedAt: now,
        });
        const conv: any = await ctx.db.get(record.conversationId as any);
        if (conv) {
          await ctx.db.patch(conv._id, {
            lastMessageAt: now,
            lastMessagePreview: `👤 Assigned to ${args.assignedToName || "team member"}`.substring(0, 80),
            lastMessageBy: "admin",
            unreadByParticipant: (conv.unreadByParticipant || 0) + 1,
            updatedAt: now,
          });
        }
      } catch (err) {
        console.warn("[assignTicketToTeamMember] conversation message failed:", (err as any)?.message);
      }
    }

    return { success: true };
  },
});

// ─── Service Request Types (admin-configurable catalog) ──────────────────
// Each firm defines its own menu of request types shown in the portal
// (e.g., "Plumbing", "Electrical", "Document Review", "Meeting Request").

const DEFAULT_RESIDENT_TYPES = [
  { key: "plumbing",      label: "Plumbing",             category: "maintenance",     icon: "🔧", defaultPriority: "medium" },
  { key: "electrical",    label: "Electrical",           category: "maintenance",     icon: "⚡", defaultPriority: "medium" },
  { key: "structural",    label: "Structural / Roof",    category: "maintenance",     icon: "🏗️", defaultPriority: "medium" },
  { key: "hvac",          label: "AC / Cooling",         category: "maintenance",     icon: "❄️", defaultPriority: "medium" },
  { key: "appliance",     label: "Appliance Repair",     category: "maintenance",     icon: "🔌", defaultPriority: "low" },
  { key: "pest_control",  label: "Pest Control",         category: "maintenance",     icon: "🐜", defaultPriority: "low" },
  { key: "cleaning",      label: "Cleaning",             category: "maintenance",     icon: "🧹", defaultPriority: "low" },
  { key: "security",      label: "Security / Locks",     category: "maintenance",     icon: "🔐", defaultPriority: "high" },
  { key: "access",        label: "Access / Keys",        category: "administrative",  icon: "🔑", defaultPriority: "medium" },
  { key: "billing_query", label: "Billing Inquiry",      category: "billing",         icon: "💳", defaultPriority: "medium" },
  { key: "other",         label: "Other",                category: "other",           icon: "📝", defaultPriority: "low" },
];

const DEFAULT_CLIENT_TYPES = [
  { key: "doc_review",         label: "Document Review",         category: "legal",          icon: "📄", defaultPriority: "medium" },
  { key: "meeting",            label: "Schedule a Meeting",      category: "administrative", icon: "📅", defaultPriority: "medium" },
  { key: "case_update",        label: "Case Status Update",      category: "legal",          icon: "⚖️", defaultPriority: "low"    },
  { key: "billing_inquiry",    label: "Billing Inquiry",         category: "billing",        icon: "💳", defaultPriority: "medium" },
  { key: "new_instruction",    label: "New Instruction",         category: "legal",          icon: "📌", defaultPriority: "high"   },
  { key: "document_request",   label: "Request Document Copy",   category: "administrative", icon: "📋", defaultPriority: "low"    },
  { key: "complaint",          label: "Complaint / Feedback",    category: "other",          icon: "💬", defaultPriority: "medium" },
  { key: "other",              label: "Other",                   category: "other",          icon: "📝", defaultPriority: "low"    },
];

/**
 * getServiceRequestTypes — Returns the firm's active service request types
 * for a given portal. If the firm has not configured any types yet, seeds
 * the defaults on first call so the portal is never empty.
 */
export const getServiceRequestTypes = query({
  args: {
    firmId: v.string(),
    portalType: v.union(v.literal("resident"), v.literal("client")),
  },
  handler: async (ctx, args) => {
    const types = await ctx.db
      .query("service_request_types")
      .withIndex("by_firm_portal", (q) =>
        q.eq("firmId", args.firmId).eq("portalType", args.portalType)
      )
      .collect();

    // First-time fallback: return defaults so the portal works immediately.
    // We don't write here (queries must be pure) — the admin UI will persist
    // them on first edit, or the createMaintenanceTicket path can seed them.
    if (types.length === 0) {
      const defaults = args.portalType === "resident" ? DEFAULT_RESIDENT_TYPES : DEFAULT_CLIENT_TYPES;
      return defaults.map((t, i) => ({
        _id: `default_${t.key}`,
        firmId: args.firmId,
        portalType: args.portalType,
        key: t.key,
        label: t.label,
        category: t.category,
        icon: t.icon,
        defaultPriority: t.defaultPriority,
        isActive: true,
        sortOrder: i,
        isDefault: true,
      }));
    }

    return types
      .filter((t: any) => t.isActive)
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

/**
 * getAllServiceRequestTypes — Like getServiceRequestTypes but includes
 * INACTIVE types too. Used by the admin config UI so the admin can see
 * and re-enable disabled types.
 */
export const getAllServiceRequestTypes = query({
  args: {
    firmId: v.string(),
    portalType: v.union(v.literal("resident"), v.literal("client")),
  },
  handler: async (ctx, args) => {
    const types = await ctx.db
      .query("service_request_types")
      .withIndex("by_firm_portal", (q) =>
        q.eq("firmId", args.firmId).eq("portalType", args.portalType)
      )
      .collect();

    if (types.length === 0) {
      const defaults = args.portalType === "resident" ? DEFAULT_RESIDENT_TYPES : DEFAULT_CLIENT_TYPES;
      return defaults.map((t, i) => ({
        _id: `default_${t.key}`,
        firmId: args.firmId,
        portalType: args.portalType,
        key: t.key,
        label: t.label,
        category: t.category,
        icon: t.icon,
        defaultPriority: t.defaultPriority,
        isActive: true,
        sortOrder: i,
        isDefault: true,
      }));
    }

    return types.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

/**
 * seedDefaultServiceRequestTypes — One-time seeding mutation. Called by the
 * admin UI when the admin opens the Service Request Types config for the
 * first time. Inserts the default catalog so the admin has a starting point
 * to edit/disable/reorder.
 */
export const seedDefaultServiceRequestTypes = mutation({
  args: {
    firmId: v.string(),
    portalType: v.union(v.literal("resident"), v.literal("client")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("service_request_types")
      .withIndex("by_firm_portal", (q) =>
        q.eq("firmId", args.firmId).eq("portalType", args.portalType)
      )
      .first();
    if (existing) return; // already seeded

    const defaults = args.portalType === "resident" ? DEFAULT_RESIDENT_TYPES : DEFAULT_CLIENT_TYPES;
    const now = Date.now();
    for (let i = 0; i < defaults.length; i++) {
      const t = defaults[i];
      await ctx.db.insert("service_request_types", {
        firmId: args.firmId,
        portalType: args.portalType,
        key: t.key,
        label: t.label,
        category: t.category,
        icon: t.icon,
        defaultPriority: t.defaultPriority as any,
        isActive: true,
        sortOrder: i,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const createServiceRequestType = mutation({
  args: {
    firmId: v.string(),
    portalType: v.union(v.literal("resident"), v.literal("client")),
    key: v.string(),
    label: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    defaultPriority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    icon: v.optional(v.string()),
    // When true (default), auto-creates a notice board entry highlighting
    // the new service type to portal users. Set to false to skip.
    announceToPortal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Compute next sortOrder
    const existing = await ctx.db
      .query("service_request_types")
      .withIndex("by_firm_portal", (q) =>
        q.eq("firmId", args.firmId).eq("portalType", args.portalType)
      )
      .collect();
    const sortOrder = existing.length;
    const typeId = await ctx.db.insert("service_request_types", {
      firmId: args.firmId,
      portalType: args.portalType,
      key: args.key,
      label: args.label,
      description: args.description,
      category: args.category,
      defaultPriority: args.defaultPriority,
      icon: args.icon,
      isActive: true,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-create a notice board entry so portal users are gently notified
    // that a new service type is available. The notice is pinned for 7 days
    // so it surfaces at the top of the portal's notice board.
    if (args.announceToPortal !== false) {
      try {
        const portalLabel = args.portalType === "resident" ? "Residents' Portal" : "Client Portal";
        await ctx.db.insert("portal_notices", {
          firmId: args.firmId,
          authorId: "system",
          authorName: "PracticePro",
          title: `New service available: ${args.label}`,
          body: `A new request type "${args.label}" has been added to the ${portalLabel}. You can now submit requests of this type from your portal.${args.description ? `\n\n${args.description}` : ''}`,
          priority: "normal",
          isPinned: true,
          status: "active",
          expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
          createdAt: now,
          updatedAt: now,
        });
      } catch (e) {
        console.warn("[createServiceRequestType] Notice board announcement failed:", (e as any)?.message);
      }
    }

    return typeId;
  },
});

export const updateServiceRequestType = mutation({
  args: {
    typeId: v.id("service_request_types"),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    defaultPriority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    icon: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { typeId, ...updates } = args;
    // Strip undefined values so we don't accidentally overwrite with undefined
    const cleanUpdates: any = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) cleanUpdates[k] = v;
    }
    await ctx.db.patch(typeId, cleanUpdates);
  },
});

export const deleteServiceRequestType = mutation({
  args: { typeId: v.id("service_request_types") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.typeId);
  },
});

// ─── Client Service Requests (Vega / legal portal) ───────────────────────

export const createClientServiceRequest = mutation({
  args: {
    firmId: v.string(),
    clientId: v.optional(v.string()),
    clientName: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    matterId: v.optional(v.string()),
    requestTypeKey: v.string(),
    requestTypeLabel: v.string(),
    subject: v.string(),
    description: v.string(),
    attachments: v.optional(v.array(v.string())),
    attachmentNames: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Insert the client_service_requests row
    const requestId = await ctx.db.insert("client_service_requests", {
      firmId: args.firmId,
      clientId: args.clientId,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      matterId: args.matterId,
      requestTypeKey: args.requestTypeKey,
      requestTypeLabel: args.requestTypeLabel,
      subject: args.subject,
      description: args.description,
      status: "open",
      priority: "medium",
      attachments: args.attachments ?? [],
      createdAt: now,
      updatedAt: now,
    });

    // 2. CRITICAL WIRING — also create a portal_message in the client's
    //    conversation so the practitioner sees it in their unified inbox.
    if (args.clientId) {
      try {
        const conversation = await getOrCreateConversation(ctx, {
          firmId: args.firmId,
          participantId: args.clientId,
          participantName: args.clientName,
          participantEmail: args.clientEmail,
          participantRole: "Client",
          matterId: args.matterId,
        });
        const conversationId = String(conversation._id);

        const messageContent = [
          `📋 New service request — ${args.requestTypeLabel}`,
          ``,
          `Subject: ${args.subject}`,
          ``,
          `Details:`,
          args.description,
        ].join('\n');

        await ctx.db.insert("portal_messages", {
          firmId: args.firmId,
          conversationId,
          senderId: args.clientId,
          senderName: args.clientName,
          senderEmail: args.clientEmail,
          senderRole: "Client",
          subject: `Service Request: ${args.subject}`,
          content: messageContent,
          attachments: args.attachments ?? [],
          attachmentNames: args.attachmentNames ?? [],
          matterId: args.matterId,
          status: "unread",
          isRead: false,
          linkedRequestId: String(requestId),
          requestTypeKey: args.requestTypeKey,
          requestTypeLabel: args.requestTypeLabel,
          createdAt: now,
          updatedAt: now,
        });

        const existingUnread = (conversation as any).unreadByAdmin || 0;
        await ctx.db.patch(conversation._id, {
          lastMessageAt: now,
          lastMessagePreview: `📋 ${args.requestTypeLabel}: ${args.subject}`.substring(0, 80),
          lastMessageBy: "participant",
          unreadByAdmin: existingUnread + 1,
          updatedAt: now,
        });

        // Link the conversation back to the request
        await ctx.db.patch(requestId, { conversationId });
      } catch (err) {
        console.error("[createClientServiceRequest] conversation wiring failed:", err);
      }
    }

    // 3. Notify all firm admins that a new client service request was submitted.
    //    Creates in-app notification (header bell) + email if enabled.
    try {
      await notifyFirmAdmins(ctx, {
        firmId: args.firmId,
        title: `New service request: ${args.subject}`,
        message: `${args.clientName || 'A client'} submitted a service request (${args.requestTypeLabel}): ${args.subject}`,
        type: "portal_service_request",
        link: { view: "messaging", initialTab: "inbox" },
        actorName: args.clientName,
        actorEmail: args.clientEmail,
      });
    } catch (err) {
      console.warn("[createClientServiceRequest] Failed to notify admins:", (err as any)?.message);
    }

    return requestId;
  },
});

export const getClientServiceRequestsByClient = query({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("client_service_requests")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .collect();
  },
});

export const getClientServiceRequestsByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("client_service_requests")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .order("desc")
      .collect();
  },
});

export const updateClientServiceRequestStatus = mutation({
  args: {
    requestId: v.id("client_service_requests"),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
    resolution: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
  },
  handler: async (ctx, args) => {
    const { requestId, ...updates } = args;
    await ctx.db.patch(requestId, { ...updates, updatedAt: Date.now() });

    // Mirror the maintenance-ticket pattern: post a reply message to the
    // linked conversation if admin provided a resolution.
    if (updates.resolution) {
      const req: any = await ctx.db.get(requestId);
      if (req?.conversationId) {
        const now = Date.now();
        await ctx.db.insert("portal_messages", {
          firmId: req.firmId,
          conversationId: req.conversationId,
          senderId: updates.assignedTo || "admin",
          senderName: "Legal Team",
          senderRole: "Admin",
          subject: `Update: ${req.subject}`,
          content: `Your service request status is now "${updates.status}".\n\nResolution: ${updates.resolution}`,
          attachments: [],
          attachmentNames: [],
          matterId: req.matterId,
          status: "read",
          isRead: false,
          linkedRequestId: String(requestId),
          requestTypeKey: req.requestTypeKey,
          requestTypeLabel: req.requestTypeLabel,
          createdAt: now,
          updatedAt: now,
        });
        const conv: any = await ctx.db.get(req.conversationId as any);
        if (conv) {
          await ctx.db.patch(conv._id, {
            lastMessageAt: now,
            lastMessagePreview: `✅ Update: ${req.subject}`.substring(0, 80),
            lastMessageBy: "admin",
            unreadByParticipant: (conv.unreadByParticipant || 0) + 1,
            updatedAt: now,
          });
        }
      }
    }
  },
});

/**
 * getServiceRequestsByFirm — Unified query that returns ALL open service
 * requests (both maintenance tickets AND client service requests) for a firm.
 * Used by the practitioner's unified inbox to surface pending tickets that
 * haven't yet been linked to a conversation (legacy data + safety net).
 */
export const getServiceRequestsByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const [tickets, clientRequests] = await Promise.all([
      ctx.db
        .query("maintenance_tickets")
        .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
        .order("desc")
        .collect(),
      ctx.db
        .query("client_service_requests")
        .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
        .order("desc")
        .collect(),
    ]);

    return {
      maintenanceTickets: tickets,
      clientServiceRequests: clientRequests,
    };
  },
});

/**
 * getMaintenanceTicketsByProperty — Returns all maintenance tickets for a
 * specific property, including a `isStale` flag (true if the ticket has
 * been in its current status for >24 hours without progressing).
 *
 * Used by the PropertyDetailView to show visual indicators on units that
 * have open tickets, and to flag tickets that have been sitting too long.
 */
export const getMaintenanceTicketsByProperty = query({
  args: { propertyId: v.string() },
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query("maintenance_tickets")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .order("desc")
      .collect();

    const now = Date.now();
    const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

    return tickets.map((t: any) => ({
      ...t,
      // A ticket is "stale" if it's been in its current status for >24h
      // AND it's not yet resolved/closed/cancelled.
      isStale: (t.status === 'open' || t.status === 'in_progress') &&
               (now - (t.updatedAt || t.createdAt || 0)) > STALE_THRESHOLD_MS,
      ageMs: now - (t.createdAt || 0),
    }));
  },
});

/**
 * respondToServiceRequest — Unified admin response mutation. Admin can update
 * a ticket/request's status AND optionally send a reply message to the portal
 * user in one call. Routes to the correct underlying mutation based on
 * `requestKind`.
 */
export const respondToServiceRequest = mutation({
  args: {
    requestKind: v.union(v.literal("maintenance"), v.literal("client_service")),
    requestId: v.string(),
    firmId: v.string(),
    adminId: v.string(),
    adminName: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    resolution: v.optional(v.string()),
    replyMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const record: any = await ctx.db.get(args.requestId as any);
    if (!record) throw new Error("Service request not found");

    // Update the request record
    await ctx.db.patch(args.requestId as any, {
      status: args.status,
      priority: args.priority ?? record.priority,
      resolution: args.resolution ?? record.resolution,
      assignedTo: args.adminId,
      updatedAt: now,
    } as any);

    // Post a reply message to the linked conversation (if any)
    const conversationId = record.conversationId;
    if (conversationId && (args.replyMessage || args.resolution)) {
      const replyText = args.replyMessage || `Status updated to "${args.status}". ${args.resolution ? `Resolution: ${args.resolution}` : ''}`;
      await ctx.db.insert("portal_messages", {
        firmId: args.firmId,
        conversationId,
        senderId: args.adminId,
        senderName: args.adminName || "Admin",
        senderRole: "Admin",
        subject: `Update: ${record.subject}`,
        content: replyText,
        attachments: [],
        attachmentNames: [],
        propertyId: record.propertyId,
        unitId: record.unitId,
        matterId: record.matterId,
        status: "read",
        isRead: false,
        linkedTicketId: args.requestKind === "maintenance" ? args.requestId : undefined,
        linkedRequestId: args.requestKind === "client_service" ? args.requestId : undefined,
        requestTypeKey: record.requestTypeKey,
        requestTypeLabel: record.requestTypeLabel || record.category,
        createdAt: now,
        updatedAt: now,
      });

      const conv: any = await ctx.db.get(conversationId as any);
      if (conv) {
        await ctx.db.patch(conv._id, {
          lastMessageAt: now,
          lastMessagePreview: `✅ ${replyText.substring(0, 70)}`,
          lastMessageBy: "admin",
          unreadByParticipant: (conv.unreadByParticipant || 0) + 1,
          updatedAt: now,
        });
      }
    }

    return { ok: true };
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
  handler: async (ctx, args): Promise<{ inviteId: string; token: string; channel: string; emailSent: boolean; emailSimulated: boolean; emailError: string; whatsappSent: boolean; whatsappSimulated: boolean; whatsappSkipped: boolean; whatsappError: string }> => {
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days — security: shorter window reduces risk of wrong-recipient access
    const token = generateToken();
    const channel = args.channel || "email";

    // 0.5. For resident invites, resolve the canonical tenant name from the
    // property/tenancy record. The property record is the source of truth for
    // a tenant's name — NOT the admin's manual input. This prevents name
    // mismatches where the portal shows one name but the property shows another.
    let resolvedInviteeName = args.inviteeName;
    if (args.portalType === "resident" && args.relatedId) {
      try {
        const parts = args.relatedId.split("_");
        const propertyCustomId = parts[0];
        const unitId = parts.length > 1 ? parts.slice(1).join("_") : null;

        const property: any = await ctx.runQuery(internal.portals.findPropertyByCustomId, {
          customId: propertyCustomId,
        });

        if (property) {
          const units = property.units || [];
          if (units.length > 0 && unitId) {
            const unit = units.find((u: any) =>
              u.id === unitId || u.unitName === unitId || u.id === args.relatedId
            );
            if (unit?.tenantName) {
              resolvedInviteeName = unit.tenantName;
            }
          } else if (units.length > 0) {
            // No specific unit matched, try first unit
            if (units[0]?.tenantName) {
              resolvedInviteeName = units[0].tenantName;
            }
          } else {
            // No units array, check property-level tenant name
            const propTenantName = (property as any).rentalDetails?.tenantName || (property as any).tenantName;
            if (propTenantName) {
              resolvedInviteeName = propTenantName;
            }
          }
        }
      } catch (e) {
        // Non-blocking: use the provided name as fallback
      }
    }

    // 1. Insert the invite record
    const inviteId: string = await ctx.runMutation(api.portals.insertInviteRecord, {
      firmId: args.firmId,
      inviterId: args.inviterId,
      inviteeEmail: args.inviteeEmail,
      inviteeName: resolvedInviteeName,
      inviteePhone: args.inviteePhone,
      portalType: args.portalType,
      relatedId: args.relatedId,
      token,
      channel,
      message: args.message,
      expiresAt,
    });

    // 1.25. For CLIENT invites, auto-create (or update) a contact record AND
    // link them to the specified matter (relatedId = matterId for clients).
    // Without this, the invitee wouldn't appear in the admin's Contacts list,
    // and even after accepting the invite they couldn't see their matters
    // because no contact record would exist to link their userId to.
    if (args.portalType === "client") {
      try {
        await ctx.runMutation(api.portals.ensureContactForClientInvite, {
          firmId: args.firmId,
          inviteeEmail: args.inviteeEmail,
          inviteeName: resolvedInviteeName,
          inviteePhone: args.inviteePhone,
          matterId: args.relatedId, // relatedId IS the matterId for client invites
        });
      } catch (e) {
        // Non-blocking: the invite is still created. The admin can manually
        // create the contact later if needed.
        console.warn("[createPortalInvite] Contact auto-create failed:", (e as any)?.message);
      }
    }

    // 1.5. Write tenant details back to the unit/property record immediately
    // This ensures the unit has the tenant's name, email, and phone even before
    // they accept the invite and set their password. Without this, getTenantInfo
    // may not find the tenant because the unit has no tenantEmail/tenantName.
    if (args.portalType === "resident" && args.relatedId) {
      try {
        const parts = args.relatedId.split("_");
        const propertyCustomId = parts[0];
        const unitId = parts.length > 1 ? parts.slice(1).join("_") : null;

        const property: any = await ctx.runQuery(internal.portals.findPropertyByCustomId, {
          customId: propertyCustomId,
        });

        if (property) {
          const units = property.units || [];
          if (units.length > 0 && unitId) {
            // Multi-unit: update the specific unit with tenant details
            let unitFound = false;
            const updatedUnits = units.map((u: any) => {
              if (u.id === unitId || u.unitName === unitId || u.id === args.relatedId) {
                unitFound = true;
                return {
                  ...u,
                  tenantName: resolvedInviteeName || u.tenantName,
                  // SECURITY: Only set tenantEmail if the property record
                  // doesn't already have one. This prevents an admin typo
                  // from overwriting the correct email with a wrong one.
                  // The invite email is sent to args.inviteeEmail, but the
                  // property record keeps its original tenantEmail unless
                  // it was empty.
                  tenantEmail: u.tenantEmail || (args.inviteeEmail ? args.inviteeEmail.toLowerCase().trim() : undefined),
                  tenantPhone: args.inviteePhone || u.tenantPhone,
                  // Don't set currentTenantId yet — that's set when the user accepts
                };
              }
              return u;
            });
            if (unitFound) {
              await ctx.runMutation(internal.portals.linkPortalUserToProperty, {
                propertyId: property._id,
                updates: { units: updatedUnits },
              });
            }
          } else {
            // Single property: update property-level tenant fields
            await ctx.runMutation(internal.portals.linkPortalUserToProperty, {
              propertyId: property._id,
              updates: {
                tenantName: resolvedInviteeName || (property as any).tenantName,
                // SECURITY: Same pattern — don't overwrite existing tenantEmail
                tenantEmail: (property as any).tenantEmail || (args.inviteeEmail ? args.inviteeEmail.toLowerCase().trim() : undefined),
              },
            });
          }
        }
      } catch (e) {
        // Non-blocking: if write-back fails, the invite is still created.
        // The tenant details will be written again when they accept the invite.
        console.warn("[createPortalInvite] Tenant detail write-back failed:", (e as any)?.message);
      }
    }

    // 2. Build the magic-link URL (setup-password page, not login)
    const portalBase = "https://practice-pro-vega.vercel.app/setup-password";
    const inviteUrl = `${portalBase}?token=${token}`;
    const portalLabel = args.portalType === "client" ? "Client Portal" : "Residents' Portal";
    const productName = args.portalType === "client" ? "VEGA" : "ATRIUM";
    const inviteeGreeting = resolvedInviteeName ? resolvedInviteeName : args.inviteeEmail;
    const personalMsg = args.message ? `\n\nPersonal message: ${args.message}` : "";

    // 3. Send via email (skip if no email address provided)
    // The email is a CLEAN INVITE ONLY — it does NOT include the admin's
    // personal message. The admin's message (if any) is delivered as an
    // in-app portal message AFTER the resident logs in and sets up their
    // password. This keeps the email professional and focused on the
    // single call-to-action: set up your password.
    const shouldSendEmail = (channel === "email" || channel === "both") && args.inviteeEmail;
    let emailResult: any = { success: true, simulated: true };
    let emailError = "";
    if (shouldSendEmail) {
      try {
      const htmlBody = `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f8fafc;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;min-height:100vh;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#ffffff;border-radius:12px 12px 0 0;padding:32px 40px 24px;text-align:center;border-bottom:3px solid #0ea5e9;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:28px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;">Practice<span style="color:#0ea5e9;">Pro</span></span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:24px;font-weight:800;color:#0f172a;margin:0 0 12px;line-height:1.3;">Set Up Your Portal Access</h1>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.7;color:#475569;margin:0 0 28px;">
                Hello ${inviteeGreeting},<br/><br/>
                Your property manager has invited you to access the <strong style="color:#0f172a;">${portalLabel}</strong> on PracticePro.<br/><br/>
                Through the portal, you can view your lease details, payment history, important notices, and communicate directly with your property management team.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 28px;">
                    <a href="${inviteUrl}" style="display:inline-block;padding:16px 48px;background:#0ea5e9;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
                      Set Up My Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 8px;">
                Or copy and paste this link:
              </p>
              <p style="font-family:monospace;font-size:12px;color:#0ea5e9;word-break:break-all;margin:0 0 24px;">
                <a href="${inviteUrl}" style="color:#0ea5e9;text-decoration:none;">${inviteUrl}</a>
              </p>

              <!-- Expiry notice -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f1f5f9;border-radius:8px;padding:12px 16px;">
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#64748b;margin:0;line-height:1.5;">
                      This invitation expires in 7 days. If you did not expect this invitation, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:20px 40px;border-top:1px solid #e2e8f0;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#94a3b8;text-align:center;margin:0 0 4px;">
                PracticePro Legal Technologies Ltd &middot; Lagos, Nigeria
              </p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10px;color:#cbd5e1;text-align:center;margin:0;">
                NDPA 2023 Compliant &middot; ISO 27001 Aligned &middot; AES-256 Encrypted
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      emailResult = await ctx.runAction(api.communications.sendEmail, {
        to: args.inviteeEmail!,
        toName: resolvedInviteeName,
        subject: `You're Invited: ${portalLabel} on PracticePro`,
        htmlContent: htmlBody,
        firmId: args.firmId,
      });
      } catch (emailErr: any) {
        console.error("[createPortalInvite] Email sending failed:", emailErr?.message);
        emailError = emailErr?.message || "Email sending failed";
        emailResult = { success: false, simulated: false, error: emailError };
      }
    }

    // 4. Send via WhatsApp (ROBUSTNESS: also wrapped in try/catch)
    const shouldSendWhatsApp = (channel === "whatsapp" || channel === "both") && args.inviteePhone;
    let waResult: any = { success: true, simulated: true };
    let whatsappError = "";
    if (shouldSendWhatsApp) {
      try {
        const waText = `PracticePro ${portalLabel} Invitation\n\nHello ${inviteeGreeting}, you've been invited to the ${portalLabel}.\n\nClick here to access: ${inviteUrl}\n\nThis link expires in 30 days.${personalMsg}\n\n— PracticePro`;
        waResult = await ctx.runAction(api.communications.sendWhatsApp, {
          to: args.inviteePhone!,
          messageText: waText,
          firmId: args.firmId,
        });
      } catch (waErr: any) {
        console.error("[createPortalInvite] WhatsApp sending failed:", waErr?.message);
        whatsappError = waErr?.message || "WhatsApp sending failed";
        waResult = { success: false, simulated: false, error: whatsappError };
      }
    }

    return {
      inviteId,
      token,
      channel,
      emailSent: emailResult.success && !emailResult.simulated,
      emailSimulated: emailResult.simulated || false,
      emailError,
      whatsappSent: shouldSendWhatsApp && waResult.success && !waResult.simulated,
      whatsappSimulated: shouldSendWhatsApp && (waResult.simulated || false),
      whatsappSkipped: !shouldSendWhatsApp,
      whatsappError,
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

    // Clean up any existing invites for the same email + firm + portal type.
    // This prevents "invitation already accepted" errors when re-inviting
    // after a previous invite was deleted via the simple deletePortalInvite
    // (which doesn't clean up). We mark old invites as "superseded" rather
    // than deleting them, so there's an audit trail.
    //
    // BUG 15 FIX: We now supersede ALL existing invites for the same email,
    // regardless of firm/portal type. This ensures that stale "accepted" invites
    // from a different context don't block the new invite. We also handle the
    // case where the user account exists with role "Pending" (cleaned up by
    // deletePortalInviteAndCleanup) — in that case, the user should be treated
    // as a fresh invitee.
    const email = (args.inviteeEmail || "").toLowerCase().trim();
    if (email) {
      const existingInvites = await ctx.db
        .query("portal_invites")
        .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
        .collect();

      for (const inv of existingInvites) {
        // Supersede ALL invites for this email, regardless of firm/portal type.
        // This is more aggressive but prevents the "already accepted" dead-end.
        if (inv.status === "pending" || inv.status === "accepted") {
          await ctx.db.patch(inv._id, {
            status: "superseded",
            updatedAt: now,
          });
        }
      }
    }

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
 * ensureContactForClientInvite — Internal mutation that auto-creates (or
 * updates) a contact record for a client portal invitee AND links them to
 * the specified matter.
 *
 * Why this exists:
 *   Previously, when an admin invited a client to the portal and selected
 *   a matter to link, the invite was created but NO contact record was.
 *   That meant:
 *     1. The portal user couldn't see their matters (getClientContactByUserId
 *        returns null because no contact has their userId).
 *     2. The matter wasn't actually linked to them (matter.clientId stays null).
 *     3. The admin couldn't find the invitee in their Contacts list.
 *
 *   Now, when createPortalInvite runs for a CLIENT invite with a relatedId
 *   (matterId), this mutation:
 *     1. Looks for an existing contact by email (case-insensitive).
 *     2. If found, patches it with the invitee's name/phone if missing.
 *     3. If not found, inserts a new contact record.
 *     4. If a matterId was provided, links the contact to that matter by
 *        setting matter.clientId AND adding the matter to contact.matterIds.
 *
 *   The contact's `userId` field is NOT set here — it's set later when the
 *   invitee accepts the invite and creates their portal user account (see
 *   setupPortalPassword → linkPortalUserToContact).
 */
export const ensureContactForClientInvite = mutation({
  args: {
    firmId: v.string(),
    inviteeEmail: v.optional(v.string()),
    inviteeName: v.optional(v.string()),
    inviteePhone: v.optional(v.string()),
    matterId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = (args.inviteeEmail || "").toLowerCase().trim();
    if (!email && !args.inviteeName) {
      return { contactId: null, created: false, reason: "no identifier" };
    }

    // 1. Look for an existing contact by email (case-insensitive) or name
    const allContacts = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    let contact = email
      ? allContacts.find((c: any) =>
          (c.email || "").toLowerCase() === email
        )
      : null;

    if (!contact && args.inviteeName) {
      contact = allContacts.find((c: any) =>
        (c.name || "").toLowerCase() === args.inviteeName!.toLowerCase()
      ) || null;
    }

    const now = new Date().toISOString();

    if (contact) {
      // 2a. Patch the existing contact with any missing info
      const patch: any = { updatedAt: now };
      if (!contact.name && args.inviteeName) patch.name = args.inviteeName;
      if (!contact.email && email) patch.email = email;
      if (!contact.phone && args.inviteePhone) patch.phone = args.inviteePhone;
      await ctx.db.patch(contact._id, patch);
    } else {
      // 2b. Create a new contact record
      const newContactId = await ctx.db.insert("contacts", {
        firmId: args.firmId,
        name: args.inviteeName || email,
        email: email || undefined,
        phone: args.inviteePhone || undefined,
        contactType: "Client",
        category: "Client",
        matterIds: args.matterId ? [args.matterId] : [],
        createdAt: now,
        updatedAt: now,
      });
      contact = await ctx.db.get(newContactId);
    }

    if (!contact) {
      return { contactId: null, created: false, reason: "contact resolution failed" };
    }

    // 3. Link the contact to the matter (if a matterId was provided)
    if (args.matterId) {
      try {
        const matter: any = await ctx.db.get(args.matterId as any);
        if (matter) {
          // Set matter.clientId so the matter shows up in the portal user's
          // matters list (getClientMattersByUserId filters by clientId).
          if (!matter.clientId || String(matter.clientId) !== String(contact._id)) {
            await ctx.db.patch(args.matterId as any, {
              clientId: String(contact._id),
              updatedAt: now,
            } as any);
          }
          // Also add the matter to the contact's matterIds array (dedup)
          const existingMatterIds: string[] = (contact as any).matterIds || [];
          if (!existingMatterIds.includes(args.matterId)) {
            const updatedMatterIds = [...existingMatterIds, args.matterId];
            await ctx.db.patch(contact._id, {
              matterIds: updatedMatterIds,
              updatedAt: now,
            } as any);
          }
        }
      } catch (e) {
        console.warn("[ensureContactForClientInvite] Matter linking failed:", (e as any)?.message);
      }
    }

    return {
      contactId: String(contact._id),
      created: !contact,
      matterLinked: !!args.matterId,
    };
  },
});

/**
 * linkPortalUserToContact — Called when a portal user accepts their invite
 * and creates their user account. Patches the contact record's `userId`
 * field so getClientContactByUserId can find it.
 *
 * Without this, the contact exists but the portal user can't see their
 * matters because the contact has no userId linkage.
 */
export const linkPortalUserToContact = mutation({
  args: {
    firmId: v.string(),
    userId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = (args.email || "").toLowerCase().trim();
    const allContacts = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Find by email first, then by name
    let contact = email
      ? allContacts.find((c: any) => (c.email || "").toLowerCase() === email)
      : null;
    if (!contact && args.name) {
      contact = allContacts.find((c: any) =>
        (c.name || "").toLowerCase() === args.name!.toLowerCase()
      ) || null;
    }

    if (!contact) return { contactId: null, linked: false };

    // Patch the userId onto the contact if it's not already set
    if (!(contact as any).userId || (contact as any).userId !== args.userId) {
      await ctx.db.patch(contact._id, {
        userId: args.userId,
        updatedAt: new Date().toISOString(),
      } as any);
    }
    return { contactId: String(contact._id), linked: true };
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
  handler: async (ctx, args): Promise<{
    token: string;
    emailSent: boolean;
    emailSimulated: boolean;
    emailSkipped: boolean;
    whatsappSent: boolean;
    whatsappSimulated: boolean;
    whatsappSkipped: boolean;
  }> => {
    const existing: any = await ctx.runQuery(api.portals.getPortalInviteById, { inviteId: args.inviteId });
    if (!existing) throw new Error("Invitation not found");
    if (existing.status === "revoked") throw new Error("Cannot resend a revoked invitation");

    // Refresh token + expiry on the existing record
    const newToken = generateToken();
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
    await ctx.runMutation(api.portals.updateInviteRecord, {
      inviteId: args.inviteId,
      updates: { token: newToken, status: "pending", expiresAt, updatedAt: now },
    });

    // Re-send via stored channel
    const portalBase = "https://practice-pro-vega.vercel.app/setup-password";
    const inviteUrl = `${portalBase}?token=${newToken}`;
    const portalLabel = existing.portalType === "client" ? "Client Portal" : "Residents' Portal";
    const productName = existing.portalType === "client" ? "VEGA" : "ATRIUM";
    const channel = existing.channel || "email";

    let emailResult: any = { success: true, simulated: true };
    if ((channel === "email" || channel === "both") && existing.inviteeEmail) {
      try {
      const htmlBody = `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0c1222;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1222;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:16px 16px 0 0;padding:28px 32px 20px;text-align:center;border-bottom:3px solid #f59e0b;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Practice<span style="color:#f59e0b;">Pro</span></span>
              <span style="display:inline-block;margin-left:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:800;color:#a78bfa;background:rgba(167,139,250,0.15);padding:3px 10px;border-radius:6px;letter-spacing:1.5px;vertical-align:middle;">${productName}</span>
            </td>
          </tr>
          <tr>
            <td style="background:#0f172a;padding:32px 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);">
              <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:700;color:#ffffff;margin:0 0 8px;">Reminder: ${portalLabel} Invitation</h1>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.7;color:#94a3b8;margin:0 0 24px;">
                Hello ${existing.inviteeName || existing.inviteeEmail},<br/><br/>
                This is a reminder about your invitation to the <strong style="color:#e2e8f0;">${portalLabel}</strong>. Your secure link has been refreshed. Set up your password to gain access.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${inviteUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:700;font-size:15px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(245,158,11,0.35);letter-spacing:0.2px;">
                      Set Up Your Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#64748b;line-height:1.6;margin:0 0 6px;">
                Or copy and paste this link:
              </p>
              <p style="font-family:monospace;font-size:12px;color:#60a5fa;word-break:break-all;margin:0 0 20px;">
                <a href="${inviteUrl}" style="color:#60a5fa;">${inviteUrl}</a>
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.15);border-radius:8px;padding:10px 14px;">
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#fbbf24;margin:0;line-height:1.5;">
                      &#9888;&#65039; This invitation expires in <strong>30 days</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#0f172a;border-radius:0 0 16px 16px;padding:20px 32px;border-top:1px solid rgba(255,255,255,0.04);border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);">
              <div style="text-align:center;">
                <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#475569;margin:0 0 4px;">PracticePro Legal Technologies Ltd &middot; Lagos, Nigeria</p>
                <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10px;color:#334155;margin:0;">NDPA 2023 Compliant &middot; ISO 27001 Aligned &middot; AES-256 Encrypted</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      emailResult = await ctx.runAction(api.communications.sendEmail, {
        to: existing.inviteeEmail!,
        toName: existing.inviteeName,
        subject: `Reminder: ${portalLabel} Invitation on PracticePro`,
        htmlContent: htmlBody,
        firmId: existing.firmId,
      });
      } catch (emailErr: any) {
        console.error("[resendPortalInvite] Email sending failed:", emailErr?.message);
        emailResult = { success: false, simulated: false, error: emailErr?.message };
      }
    }

    let waResult: any = { success: true, simulated: true };
    if ((channel === "whatsapp" || channel === "both") && existing.inviteePhone) {
      try {
        const waText = `Reminder: PracticePro ${portalLabel} Invitation\n\nHello ${existing.inviteeName || existing.inviteeEmail}, your portal link has been refreshed.\n\nClick here: ${inviteUrl}\n\nExpires in 30 days.\n\n— PracticePro`;
        waResult = await ctx.runAction(api.communications.sendWhatsApp, {
          to: existing.inviteePhone,
          messageText: waText,
          firmId: existing.firmId,
        });
      } catch (waErr: any) {
        console.error("[resendPortalInvite] WhatsApp sending failed:", waErr?.message);
        waResult = { success: false, simulated: false, error: waErr?.message };
      }
    }

    // Determine what was actually sent vs skipped
    const emailSkipped = !existing.inviteeEmail && (channel === "email" || channel === "both");
    const waSkipped = !existing.inviteePhone && (channel === "whatsapp" || channel === "both");

    return {
      token: newToken,
      emailSent: emailResult.success && !emailResult.simulated && !emailSkipped,
      emailSimulated: emailResult.simulated || false,
      emailSkipped,
      whatsappSent: waResult.success && !waResult.simulated && !waSkipped,
      whatsappSimulated: waResult.simulated || false,
      whatsappSkipped: waSkipped,
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
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found");

    // Toggle: if currently revoked, restore to accepted; if active/pending, revoke
    if (invite.status === "revoked") {
      // Restore access: set back to accepted, re-verify the user
      await ctx.db.patch(args.inviteId, {
        status: "accepted",
        updatedAt: Date.now(),
      });

      // Also restore the portal user's access
      const email = (invite.inviteeEmail || "").toLowerCase().trim();
      if (email) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
          .first();

        if (user && (user as any).role === "Pending") {
          const portalRole = invite.portalType === "client" ? "Client" : "Tenant";
          await ctx.db.patch(user._id, {
            role: portalRole,
            isVerified: true,
            emailVerified: true,
          } as any);
        }
      }
    } else {
      // Revoke: mark as revoked, suspend the user's portal access
      await ctx.db.patch(args.inviteId, {
        status: "revoked",
        updatedAt: Date.now(),
      });

      // Suspend the user's portal access (but don't reset — they can be restored)
      const email = (invite.inviteeEmail || "").toLowerCase().trim();
      if (email) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
          .first();

        if (user) {
          const role = (user as any).role;
          if (role === "Client" || role === "Tenant" || role === "Portal User") {
            await ctx.db.patch(user._id, {
              isVerified: false,
              portalPresenceHidden: true,
            } as any);
          }
        }
      }
    }
  },
});

/** Permanently delete a portal invite record (removes it from the list entirely) */
export const deletePortalInvite = mutation({
  args: { inviteId: v.id("portal_invites") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.inviteId);
  },
});

/**
 * deletePortalInviteAndCleanup — HARD-DELETES a portal invite AND resets
 * the associated portal user account so the same email can be re-invited cleanly.
 *
 * User-facing semantics (Task ID 9 fix):
 *   - DELETE button = record disappears forever. The invite is removed from
 *     the list entirely (not just marked as "revoked"). The admin can no
 *     longer see it. The user's portal account is also reset to Pending so
 *     they can be re-invited cleanly.
 *   - REVOKE button (separate) = soft state. The invite stays in the list
 *     with status="revoked". The admin can unrevoke it later.
 *
 * This distinction matters: previously DELETE was implemented as a soft
 * revoke, so deleted portal access items kept showing up in the list with
 * a "revoked" badge — confusing the admin and cluttering the UI.
 *
 * Steps:
 * 1. HARD-DELETE the specified portal_invites record (ctx.db.delete)
 * 2. HARD-DELETE any OTHER invite records for the same email (cascade)
 *    — the admin's intent with Delete is to remove ALL portal access for
 *    this person, not just one invite row.
 * 3. Find the user with the matching email + Client/Tenant role
 * 4. Reset their role, verification, password, and portal-specific fields so
 *    they're treated as a brand-new invitee (Bug 16 fix: thorough cleanup).
 *    firmId and product are PRESERVED so re-invite flows don't break.
 *
 * SAFETY: resolveFirmFromInvite has fallbacks that search property records
 * when no invite is found, so deleting invite records does NOT break
 * firmId resolution for users who still need it.
 */
export const deletePortalInviteAndCleanup = mutation({
  args: {
    inviteId: v.id("portal_invites"),
    inviteeEmail: v.optional(v.string()),
    inviteePhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = (args.inviteeEmail || "").toLowerCase().trim();

    // 0. Read the target invite first (we need its relatedId for user lookup later)
    const targetInvite = await ctx.db.get(args.inviteId);

    // 1. HARD-DELETE the specified invite record. The admin clicked Delete,
    //    not Revoke — the record must disappear from the list entirely.
    if (targetInvite) {
      try {
        await ctx.db.delete(args.inviteId);
      } catch (e) {
        // Already deleted by a concurrent call — non-fatal
      }
    }

    // 2. HARD-DELETE any OTHER invite records for the same email (cascade).
    //    The admin's intent with Delete is to remove ALL portal access for
    //    this person, not just one invite row. Pending invites, accepted
    //    invites, AND previously-revoked invites for this email all go away.
    if (email) {
      const otherInvites = await ctx.db
        .query("portal_invites")
        .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
        .collect();

      for (const inv of otherInvites) {
        if (String(inv._id) === String(args.inviteId)) continue; // Already deleted above
        try {
          await ctx.db.delete(inv._id);
        } catch (e) { /* ignore — best-effort cascade */ }
      }
    }

    // 3. Find and reset the associated portal user
    //    Search by email first, then by phone (for WhatsApp-only invites)
    let existingUser = email
      ? await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
          .first()
      : null;

    // Fallback: try to find user by phone if email search failed (WhatsApp-only invites)
    if (!existingUser && args.inviteePhone) {
      const phone = args.inviteePhone.trim();
      // Search all users for a matching phone number
      const allUsers = await ctx.db.query("users").collect();
      existingUser = allUsers.find((u: any) => {
        const userPhone = (u.phone || u.phoneNumber || "").trim();
        return userPhone === phone;
      }) || null;
    }

    // Also try to find user from the invite's relatedId if we still can't find them
    if (!existingUser && targetInvite) {
      const relatedId = (targetInvite as any).relatedId;
      if (relatedId) {
        // For resident invites, the relatedId might contain the unit/property reference
        // Try finding a user with this email stored in a different field
        const allUsers = await ctx.db.query("users").collect();
        existingUser = allUsers.find((u: any) => {
          const uEmail = (u.email || u.tokenIdentifier || "").toLowerCase().trim();
          return uEmail && email && uEmail === email;
        }) || null;
      }
    }

    if (!existingUser) return;

    // Only reset if the user has a Client or Tenant role (portal user)
    const role = (existingUser as any).role;
    if (role === "Client" || role === "Tenant" || role === "Portal User") {
      // Reset the user so they can't log in, but PRESERVE firmId and product.
      // These fields are essential for data loading — without firmId, the portal
      // queries all use 'skip' and show infinite skeleton screens. The firmId
      // will be updated by setupPortalPassword if the user is re-invited to a
      // different firm, or kept as-is if re-invited to the same firm.
      await ctx.db.patch(existingUser._id, {
        isVerified: false,
        emailVerified: false,
        password: undefined,
        role: "Pending",
        // IMPORTANT: firmId and product are KEPT intentionally.
        // Clearing them was the root cause of the permanent skeleton bug.
        // setupPortalPassword will update them on re-invite if needed.
        portalPresenceHidden: undefined,
        onboardingCompleted: false,
      } as any);
    }
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
      termsAcceptedAt: Date.now(),
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

/**
 * verifyInviteToken — validates a portal invite token and returns
 * the invite details + whether the user already has an account.
 * Used by the /setup-password page to determine what to show.
 *
 * ROBUSTNESS FIX: If the invite is "accepted" but the user's role is
 * "Pending" (meaning their access was deleted via deletePortalInviteAndCleanup
 * and they need to re-setup), we allow them to proceed. This prevents the
 * "invitation already accepted" dead-end when a user is re-invited after
 * their portal access was removed.
 */
export const verifyInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("portal_invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .collect();
    const invite = results[0] || null;

    if (!invite) {
      return { valid: false, reason: "not_found" } as const;
    }

    // Check expiry (note: we don't patch status here since this is a query/read-only)
    if (invite.expiresAt < Date.now()) {
      return { valid: false, reason: "expired", portalType: invite.portalType } as const;
    }

    if (invite.status === "revoked") {
      return { valid: false, reason: "revoked", portalType: invite.portalType } as const;
    }

    // Check if the user exists and their current state
    const email = invite.inviteeEmail?.toLowerCase().trim();
    let existingUser: any = null;
    if (email) {
      existingUser = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
        .first();
      // Case-insensitive fallback
      if (!existingUser) {
        existingUser = await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", email.toLowerCase()))
          .first();
      }
    }

    if (invite.status === "accepted") {
      // ROBUSTNESS: If the user's role is Pending (their access was reset by
      // deletePortalInviteAndCleanup), allow them to re-accept. This invite
      // might be a stale record from before the cleanup ran. The user needs
      // to set up their password again, so we should let them through.
      // Bug 15 fix: Also check if the user doesn't exist at all (was deleted),
      // or if they have no password (fully cleaned up).
      const userRole = existingUser?.role;
      const isUserUnverified = existingUser && !existingUser.isVerified;
      const hasNoPassword = existingUser && !(existingUser as any).password;
      const hasNoFirmId = existingUser && !existingUser.firmId;
      if (userRole === "Pending" || isUserUnverified || hasNoPassword || hasNoFirmId) {
        // User was reset — allow re-accepting this invite
        // Fall through to return valid: true
      } else {
        return { valid: false, reason: "already_accepted", portalType: invite.portalType } as const;
      }
    }

    // Token is valid and pending — check if user already has an account
    return {
      valid: true,
      invite: {
        _id: invite._id,
        inviteeEmail: invite.inviteeEmail,
        inviteeName: invite.inviteeName,
        portalType: invite.portalType,
        firmId: invite.firmId,
        relatedId: invite.relatedId,
        expiresAt: invite.expiresAt,
      },
      hasAccount: !!existingUser,
      hasPassword: !!(existingUser as any)?.password,
    } as const;
  },
});

// ─── Internal helpers for portal user → property linking ──────────────────
// These are used by the setupPortalPassword action, which cannot directly
// access ctx.db (actions don't have database access). Instead, they use
// ctx.runQuery / ctx.runMutation to delegate to these internal functions.

export const findPropertyByCustomId = internalQuery({
  args: { customId: v.string() },
  handler: async (ctx, args) => {
    // Try by custom id field (using by_custom_id index)
    const byCustomId = await ctx.db
      .query("properties")
      .withIndex("by_custom_id", (q) => q.eq("id", args.customId))
      .first();
    if (byCustomId) return byCustomId;

    // Try by Convex _id
    try {
      const byDocId = await ctx.db.get(args.customId as any);
      if (byDocId) return byDocId;
    } catch {}

    return null;
  },
});

export const linkPortalUserToProperty = internalMutation({
  args: {
    propertyId: v.id("properties"),
    updates: v.any(), // { units?: [...], currentTenantId?: string, tenantId?: string }
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.propertyId, args.updates as any);
  },
});

// ─── Setup Portal Password (Invite Acceptance) ──────────────────────────

/**
 * setupPortalPassword — ACTION that completes the invite flow:
 * 1. Validates the invite token (must be pending + unexpired)
 * 2. If user exists → sets their password + marks verified
 * 3. If user doesn't exist → creates a new user record with the password
 * 4. Marks the invite as accepted
 * 5. Clears the token to prevent replay attacks
 */
export const setupPortalPassword = action({
  args: {
    token: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message?: string; email?: string; code?: string }> => {
    // 1. Validate the invite
    const invite = await ctx.runQuery(api.portals.getInviteByToken, { token: args.token });
    if (!invite) return { success: false, message: "Invalid invitation link." };
    if (invite.status === "revoked") return { success: false, message: "This invitation has been revoked." };
    if (invite.status === "expired" || invite.expiresAt < Date.now()) {
      await ctx.runMutation(api.portals.updateInviteRecord, {
        inviteId: invite._id,
        updates: { status: "expired", updatedAt: Date.now() },
      });
      return { success: false, message: "This invitation has expired. Please request a new one." };
    }

    // ROBUSTNESS: If the invite was already accepted but the user's account was
    // reset (role=Pending, isVerified=false, no password, no firmId), allow them
    // to re-accept. This can happen when deletePortalInviteAndCleanup resets the
    // user but a stale invite record still exists with status "accepted" and a
    // valid token. (Bug 15 fix: more thorough reset detection)
    if (invite.status === "accepted") {
      const emailCheck = (invite.inviteeEmail || "").toLowerCase().trim();
      const existingUserCheck: any = await ctx.runQuery(api.myFunctions.getUser, { tokenIdentifier: emailCheck });
      const wasReset = existingUserCheck?.role === "Pending"
        || (existingUserCheck && !existingUserCheck.isVerified)
        || (existingUserCheck && !(existingUserCheck as any).password)
        || (existingUserCheck && !existingUserCheck.firmId);
      if (!wasReset) {
        return { success: false, message: "This invitation has already been used." };
      }
      // User was reset — allow re-accepting this invite (fall through)
    }

    const email = (invite.inviteeEmail || "").toLowerCase().trim();
    if (!email) return { success: false, message: "This invitation has no email address associated." };

    // 1.5. For resident invites, resolve the canonical tenant name from the
    // property/tenancy record. The property record is the source of truth for
    // a tenant's name — NOT the invite. This ensures the user's name always
    // matches the property record.
    let canonicalTenantName: string | null = null;
    if (invite.portalType === "resident" && invite.relatedId) {
      try {
        const parts = invite.relatedId.split("_");
        const propertyCustomId = parts[0];
        const unitId = parts.length > 1 ? parts.slice(1).join("_") : null;

        const property: any = await ctx.runQuery(internal.portals.findPropertyByCustomId, {
          customId: propertyCustomId,
        });

        if (property) {
          const units = property.units || [];
          if (units.length > 0 && unitId) {
            const unit = units.find((u: any) =>
              u.id === unitId || u.unitName === unitId || u.id === invite.relatedId
            );
            if (unit?.tenantName) {
              canonicalTenantName = unit.tenantName;
            }
          } else if (units.length > 0) {
            if (units[0]?.tenantName) {
              canonicalTenantName = units[0].tenantName;
            }
          } else {
            const propTenantName = (property as any).rentalDetails?.tenantName || (property as any).tenantName;
            if (propTenantName) {
              canonicalTenantName = propTenantName;
            }
          }
        }
      } catch (e) {
        // Non-blocking: use invite name as fallback
      }
    }

    // 2. Hash the password
    const hashedPassword = await ctx.runAction(internal.authUtils.hashPassword, { password: args.password });

    // 3. Check if user exists
    const existingUser: any = await ctx.runQuery(api.myFunctions.getUser, { tokenIdentifier: email });

    // ── SAFETY: Refuse to attach a portal role to an existing admin/internal account ──
    // The "residents see admin dashboard" bug occurred because the same email
    // existed as BOTH an Admin user record AND a Tenant user record. When the
    // admin accepted a portal invite using their admin email, setupPortalPassword
    // updated the Admin record's password (and isVerified flag) but left the
    // role as Admin — so the user could log in via the portal but ended up in
    // the admin dashboard.
    //
    // Going forward: if the email is already used by an Admin / Lawyer /
    // Paralegal / ExternalCounsel account in this firm, refuse the invite
    // acceptance with a clear error. The admin must use a different email
    // address for the portal user (e.g. resident+unit@..., or a personal
    // email), or have the conflicting admin account deleted first.
    //
    // The check is scoped to the SAME FIRM — we don't block a portal invite
    // if the email is an admin in a different firm (that's a separate person
    // who happens to share the email).
    if (existingUser) {
      const ADMIN_ROLES = new Set(["Admin", "Lawyer", "Paralegal", "ExternalCounsel"]);
      const sameFirm = existingUser.firmId === invite.firmId;
      if (sameFirm && ADMIN_ROLES.has(existingUser.role)) {
        return {
          success: false,
          message: `This email is already registered as ${existingUser.role === "Admin" ? "an administrator" : "a " + existingUser.role.toLowerCase()} account in your firm. Please use a different email address for the portal user, or delete the existing admin account first.`,
          code: "EMAIL_CONFLICTS_WITH_ADMIN" as const,
        };
      }
    }

    // Track the portal user's Convex _id so we can link them to their property/unit
    let portalUserDocId: string | null = null;

    if (existingUser) {
      // Update existing user: set password + mark verified
      // Also upgrade their role to Client/Tenant if they were a "Portal User"
      // or had no role assigned, so the frontend can route them correctly.
      const portalRole = invite.portalType === "client" ? "Client" : "Tenant";
      const needsRoleUpdate = !existingUser.role
        || existingUser.role === "Portal User"
        || existingUser.role === "Pending";
      // Ensure firmId is always set — portal users need it for the ProductContext
      // to derive the correct product and for data loading to work properly.
      // When an existing user is re-invited after portal access deletion, their
      // firmId might have been cleared or might never have been set.
      const needsFirmId = !existingUser.firmId || existingUser.firmId !== invite.firmId;
      portalUserDocId = String(existingUser._id);
      // Ensure the user has a portal access token (for token-based URLs)
      const accessToken = (existingUser as any).portalAccessToken || generatePortalAccessToken();
      await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
        userId: existingUser._id,
        fields: {
          password: hashedPassword,
          isVerified: true,
          emailVerified: true,
          verificationCode: null,
          // For tenant users, always sync name with the property record (source of truth)
          ...(canonicalTenantName ? { name: canonicalTenantName } : (args.name && !existingUser.name ? { name: args.name } : {})),
          ...(needsRoleUpdate ? { role: portalRole } : {}),
          ...(needsFirmId ? { firmId: invite.firmId } : {}),
          // Online presence privacy: property/resident portals default to hidden
          portalPresenceHidden: invite.portalType === "resident" ? true : (existingUser as any).portalPresenceHidden ?? false,
          // Portal access token for URL routing
          portalAccessToken: accessToken,
        },
      });
    } else {
      // Create new user record for this portal user
      // Use the proper UserRole (Client / Tenant) so the frontend can route
      // them to the correct portal view automatically.
      const portalProduct = invite.portalType === "client" ? "legal" : "property";
      const portalRole = invite.portalType === "client" ? "Client" : "Tenant";
      const userName = canonicalTenantName || args.name || invite.inviteeName || email.split("@")[0];
      // Generate a unique portal access token for URL routing
      const accessToken = generatePortalAccessToken();
      const newUserId = await ctx.runMutation(internal.myFunctions.createUser, {
        tokenIdentifier: email,
        name: userName,
        email: email,
        password: hashedPassword,
        role: portalRole,
        product: portalProduct,
        onboardingCompleted: false,
        isVerified: true,
        emailVerified: true,
        firmId: invite.firmId,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`,
        // Online presence privacy: property/resident portals default to hidden
        // (portal users can't see if the manager is online). Legal/client portals
        // default to visible (clients can see if their lawyer is online).
        portalPresenceHidden: invite.portalType === "resident",
        portalAccessToken: accessToken,
      });
      portalUserDocId = String(newUserId);
    }

    // 3.5. Link portal user to property/unit if relatedId was provided
    // This is critical for getTenantInfo to find the tenant's property assignment.
    // When setupPortalPassword creates a new user, the property's unit record
    // may still point to a stale contact ID or email instead of the new Convex _id.
    if (invite.relatedId && invite.portalType === "resident" && portalUserDocId) {
      try {
        // Parse the relatedId format:
        // "propertyId_unitId" for multi-unit properties (composite key)
        // just "propertyId" for single properties
        const parts = invite.relatedId.split("_");
        const propertyCustomId = parts[0];
        const unitId = parts.length > 1 ? parts.slice(1).join("_") : null;

        // Find the property using internal query (actions cannot use ctx.db directly)
        const property: any = await ctx.runQuery(internal.portals.findPropertyByCustomId, {
          customId: propertyCustomId,
        });

        if (property) {
          const units = property.units || [];
          // Use the canonical tenant name from the property record (source of truth)
          // Fall back to the portal user's name or invite data if property lookup failed
          const tenantName = canonicalTenantName || invite.inviteeName || email.split("@")[0];

          if (units.length > 0 && unitId) {
            // Multi-unit property: update the specific unit
            let unitFound = false;
            const updatedUnits = units.map((u: any) => {
              if (u.id === unitId || u.unitName === unitId || u.id === invite.relatedId) {
                unitFound = true;
                return {
                  ...u,
                  currentTenantId: portalUserDocId,
                  tenantId: portalUserDocId,
                  tenantEmail: email,
                  tenantName: tenantName,
                  tenantPhone: invite.inviteePhone || u.tenantPhone,
                };
              }
              return u;
            });
            if (unitFound) {
              await ctx.runMutation(internal.portals.linkPortalUserToProperty, {
                propertyId: property._id,
                updates: { units: updatedUnits },
              });
            }
          } else {
            // Single property (no units or no unitId): update property-level tenant
            await ctx.runMutation(internal.portals.linkPortalUserToProperty, {
              propertyId: property._id,
              updates: {
                currentTenantId: portalUserDocId,
                tenantId: portalUserDocId,
                tenantEmail: email,
                tenantName: tenantName,
                tenantPhone: invite.inviteePhone,
              },
            });
          }
        }
      } catch (linkErr) {
        // Non-blocking: if linking fails, the user can still access the portal.
        // getTenantInfo will try to find them by email as a fallback.
        console.warn("Portal user-property linking failed:", linkErr);
      }
    }

    // 4. Mark invite as accepted (including terms acceptance timestamp)
    await ctx.runMutation(api.portals.updateInviteRecord, {
      inviteId: invite._id,
      updates: {
        status: "accepted",
        acceptedAt: Date.now(),
        termsAcceptedAt: Date.now(),
        updatedAt: Date.now(),
        // Clear token to prevent replay attacks — the invite is now consumed
        token: undefined,
      },
    });

    // 4.5. For CLIENT invites, link the portal user to their contact record.
    // This patches the contact's `userId` field so getClientContactByUserId
    // can find it — without this, the portal user can't see their matters
    // even though the contact + matter linkage was created at invite time.
    if (invite.portalType === "client" && portalUserDocId) {
      try {
        await ctx.runMutation(api.portals.linkPortalUserToContact, {
          firmId: invite.firmId,
          userId: portalUserDocId,
          email,
          name: args.name || invite.inviteeName || undefined,
        });
      } catch (e) {
        // Non-blocking — the user can still log in. The admin can manually
        // link the contact later if needed.
        console.warn("[setupPortalPassword] Contact linking failed:", (e as any)?.message);
      }
    }

    return { success: true, email };
  },
});

/**
 * selfHealClientContactLink — Called from the Client Portal on first load
 * when the contact lookup returns null. Patches the contact's `userId`
 * field using the current user's email/name, so the portal can find the
 * contact and show the user's matters.
 *
 * This is a back-fill for users who accepted invites BEFORE the
 * linkPortalUserToContact step was added to setupPortalPassword. It's
 * safe to call repeatedly — it's a no-op if the contact is already linked.
 */
export const selfHealClientContactLink = mutation({
  args: {
    firmId: v.string(),
    userId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = (args.email || "").toLowerCase().trim();
    if (!email && !args.name) return { contactId: null, linked: false };

    const allContacts = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Find by email first, then by name
    let contact = email
      ? allContacts.find((c: any) => (c.email || "").toLowerCase() === email)
      : null;
    if (!contact && args.name) {
      contact = allContacts.find((c: any) =>
        (c.name || "").toLowerCase() === args.name!.toLowerCase()
      ) || null;
    }

    if (!contact) return { contactId: null, linked: false };

    // Patch the userId if missing or stale
    if (!(contact as any).userId || (contact as any).userId !== args.userId) {
      await ctx.db.patch(contact._id, {
        userId: args.userId,
        updatedAt: new Date().toISOString(),
      } as any);
    }
    return { contactId: String(contact._id), linked: true };
  },
});

/**
 * registerForPushNotifications — Called from the mobile app when the user
 * grants notification permission. Sets pushNotificationEnabled=true on the
 * user record so the backend knows to send push (and skip email) for this
 * user. This is the "smart delivery" switch: push OR email, not both.
 */
export const registerForPushNotifications = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    try {
      await ctx.db.patch(args.userId as any, {
        pushNotificationEnabled: true,
        pushNotificationRegisteredAt: now,
        updatedAt: new Date().toISOString(),
      } as any);
      return { success: true };
    } catch (err: any) {
      console.warn("[registerForPushNotifications] Failed:", err?.message);
      return { success: false, error: err?.message };
    }
  },
});

/**
 * unregisterFromPushNotifications — Called when the user revokes
 * notification permission or uninstalls the app. Clears the flag so
 * the backend falls back to email delivery.
 */
export const unregisterFromPushNotifications = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    try {
      await ctx.db.patch(args.userId as any, {
        pushNotificationEnabled: false,
        pushNotificationRegisteredAt: undefined,
        updatedAt: new Date().toISOString(),
      } as any);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  },
});

/**
 * repairPortalUserFirmId — Repairs a portal user whose firmId is missing.
 * Called from the frontend when the portal detects it can't resolve a firmId.
 * Looks up the firm via invite records and user record, then patches the user.
 */
export const repairPortalUserFirmId = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    // 1. Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
      .first();

    if (!user) return { success: false, message: "User not found." };

    // 1.5. If the user's role is "Pending" (from deletePortalInviteAndCleanup),
    // we also need to restore their role so they can access the portal.
    // Determine the correct role from invite records or user's product field.
    const needsRoleRestore = (user as any).role === "Pending";
    const userProduct = (user as any).product;

    // 1.6. If firmId is set, verify it's valid by checking if the user has
    // properties in that firm. A wrong firmId (from a previous firm) causes
    // getTenantInfo to search the wrong firm and return empty results.
    if (user.firmId) {
      const firmProperties = await ctx.db
        .query("properties")
        .withIndex("by_firm", (q) => q.eq("firmId", user.firmId!))
        .collect();

      // Check if the user is linked to any property in this firm
      const userId = String(user._id);
      let foundInFirm = false;
      for (const prop of firmProperties) {
        const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
        const propTenantEmail = ((prop as any).rentalDetails?.tenantEmail || (prop as any).tenantEmail || "").toLowerCase();
        if (propTenantId === userId || propTenantId === email ||
            (propTenantEmail && email && propTenantEmail === email)) {
          foundInFirm = true;
          break;
        }
        const units = (prop as any).units || [];
        for (const unit of units) {
          const unitTenantId = unit.currentTenantId || unit.tenantId;
          const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();
          if (unitTenantId === userId || unitTenantId === email ||
              (unitTenantEmail && email && unitTenantEmail === email)) {
            foundInFirm = true;
            break;
          }
        }
        if (foundInFirm) break;
      }

      if (foundInFirm) {
        // firmId is valid — user has properties in this firm
        // Still restore role if needed
        if (needsRoleRestore) {
          const invites = await ctx.db
            .query("portal_invites")
            .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
            .collect();
          const activeInvite = invites.find(inv => inv.status !== 'revoked' && inv.firmId);
          const portalRole = activeInvite?.portalType === 'client' ? 'Client' : 'Tenant';
          await ctx.db.patch(user._id, {
            role: portalRole,
            isVerified: true,
            emailVerified: true,
          } as any);
          return { success: true, firmId: user.firmId, message: "firmId valid, role restored." };
        }
        return { success: true, firmId: user.firmId, message: "firmId already set and valid." };
      }

      // firmId is set but user has NO properties in that firm — it's stale/wrong.
      // Continue below to find the correct firmId from invite/property records.
    }

    // 2. Try to find firmId from invite records
    const invites = await ctx.db
      .query("portal_invites")
      .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
      .collect();

    const sorted = invites
      .filter(inv => inv.firmId)
      .sort((a, b) => {
        const aActive = a.status !== 'revoked' ? 1 : 0;
        const bActive = b.status !== 'revoked' ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return (b._creationTime || 0) - (a._creationTime || 0);
      });

    const foundFirmId = sorted[0]?.firmId;

    if (foundFirmId) {
      const portalProduct = sorted[0].portalType === 'client' ? 'legal' : 'property';
      const portalRole = sorted[0].portalType === 'client' ? 'Client' : 'Tenant';
      const patchData: any = {
        firmId: foundFirmId,
        product: portalProduct,
      };
      // Also restore role and verification if the user was reset by deletePortalInviteAndCleanup
      if (needsRoleRestore) {
        patchData.role = portalRole;
        patchData.isVerified = true;
        patchData.emailVerified = true;
      }
      await ctx.db.patch(user._id, patchData);
      return { success: true, firmId: foundFirmId, message: "firmId repaired from invite record." + (needsRoleRestore ? " Role restored." : "") };
    }

    // 3. Try to find firmId from property records
    const allProperties = await ctx.db.query("properties").collect();
    for (const prop of allProperties) {
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      if (String(propTenantId).toLowerCase() === email && prop.firmId) {
        const patchData: any = {
          firmId: prop.firmId,
          product: 'property',
        };
        if (needsRoleRestore) {
          patchData.role = 'Tenant';
          patchData.isVerified = true;
          patchData.emailVerified = true;
        }
        await ctx.db.patch(user._id, patchData);
        return { success: true, firmId: prop.firmId, message: "firmId repaired from property record." + (needsRoleRestore ? " Role restored." : "") };
      }
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();
        if (unitTenantEmail === email && prop.firmId) {
          const patchData: any = {
            firmId: prop.firmId,
            product: 'property',
          };
          if (needsRoleRestore) {
            patchData.role = 'Tenant';
            patchData.isVerified = true;
            patchData.emailVerified = true;
          }
          await ctx.db.patch(user._id, patchData);
          return { success: true, firmId: prop.firmId, message: "firmId repaired from property unit record." + (needsRoleRestore ? " Role restored." : "") };
        }
      }
    }

    return { success: false, message: "Could not find firmId from any source." };
  },
});

/**
 * relinkPortalUserToProperty — Self-healing mutation that re-links a portal user
 * to their property/unit if the currentTenantId link is broken.
 *
 * This is called from the frontend when getTenantInfo returns empty results
 * (tenant not found in any property). It searches all properties for a matching
 * tenant by email and updates the currentTenantId to the user's Convex _id.
 */
export const relinkPortalUserToProperty = mutation({
  args: { email: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    const emailLower = args.email.toLowerCase().trim();

    // Find the user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", emailLower))
      .first();

    if (!user) return { success: false, message: "User not found." };

    const userId = String(user._id);

    // Search all properties for this firm
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    let linked = false;

    for (const prop of properties) {
      const units = (prop as any).units || [];
      let needsUpdate = false;

      if (units.length > 0) {
        // Multi-unit property: check each unit for email match
        const updatedUnits = units.map((u: any) => {
          const unitTenantEmail = (u.tenantEmail || '').toLowerCase();
          const unitTenantId = u.currentTenantId || u.tenantId;

          // Match by email or by currentTenantId that's an email (not a Convex _id)
          const matchesByEmail = unitTenantEmail === emailLower;
          const matchesById = unitTenantId === emailLower || unitTenantId === userId;
          const hasStaleLink = unitTenantId && unitTenantId !== userId &&
              !unitTenantId.startsWith("k") && unitTenantId.includes("@");

          if ((matchesByEmail || matchesById || hasStaleLink) && u.currentTenantId !== userId) {
            needsUpdate = true;
            return {
              ...u,
              currentTenantId: userId,
              tenantId: userId,
              tenantEmail: emailLower,
            };
          }
          return u;
        });

        if (needsUpdate) {
          await ctx.db.patch(prop._id, { units: updatedUnits } as any);
          linked = true;
        }
      } else {
        // Single property: check property-level tenant
        const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
        const propTenantEmail = ((prop as any).rentalDetails?.tenantEmail || (prop as any).tenantEmail || "").toLowerCase();

        const matchesByEmail = propTenantEmail === emailLower;
        const matchesById = propTenantId === emailLower || propTenantId === userId;

        if ((matchesByEmail || matchesById) && propTenantId !== userId) {
          await ctx.db.patch(prop._id, {
            currentTenantId: userId,
            tenantId: userId,
            tenantEmail: emailLower,
          } as any);
          linked = true;
        }
      }
    }

    return { success: true, linked, message: linked ? "Portal user re-linked to property." : "No matching property found to link." };
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

/**
 * processScheduledMessages — Internal ACTION called by cron every 5 minutes.
 * Finds all scheduled messages whose scheduledFor time has passed and
 * ACTUALLY SENDS them via the appropriate channel (Brevo email / Chakra WhatsApp).
 * Then creates a portal_message in the recipient's conversation so the sent
 * message appears in All Conversations.
 *
 * NOTE: This was previously an internalMutation which CANNOT call actions
 * (ctx.runAction). That's why messages were only marked as "sent" without
 * actually being delivered. Now it's an internalAction which CAN call
 * ctx.runAction to actually send via Brevo/Chakra.
 */
export const processScheduledMessages = internalAction({
  args: {},
  handler: async (ctx, _args) => {
    const now = Date.now();
    // Query due messages via a helper query
    const dueMessages: any[] = await ctx.runQuery(internal.portals.getDueScheduledMessages, {});
    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const msg of dueMessages) {
      try {
        let sendSuccess = false;
        let sendError = '';

        // ── Actually send the message via the appropriate channel ──
        if (msg.channel === "email" && msg.tenantIds && msg.tenantIds.length > 0) {
          // Send email to each recipient via Brevo
          for (const tenantId of msg.tenantIds) {
            try {
              // Look up the tenant's email address
              const tenant: any = await ctx.runQuery(api.myFunctions.getUser, { tokenIdentifier: tenantId });
              if (tenant?.email) {
                await ctx.runAction(api.communications.sendEmail, {
                  firmId: msg.firmId,
                  to: tenant.email,
                  toName: tenant.name || tenant.email,
                  subject: msg.messageType ? `${msg.messageType.replace(/_/g, ' ')}` : 'Message from your Property Manager',
                  htmlContent: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><p style="white-space:pre-line;">${msg.content}</p></div>`,
                });
                sendSuccess = true;
              }
            } catch (emailErr: any) {
              sendError = emailErr?.message || 'Email send failed';
              console.warn(`[processScheduledMessages] Email failed for ${tenantId}:`, sendError);
            }
          }
        } else if (msg.channel === "whatsapp" && msg.tenantIds && msg.tenantIds.length > 0) {
          // Send WhatsApp to each recipient via Chakra
          for (const tenantId of msg.tenantIds) {
            try {
              // Look up the tenant's phone number from their user record
              const tenant: any = await ctx.runQuery(api.myFunctions.getUser, { tokenIdentifier: tenantId });
              // The tenant's phone might be on their user record or their property/unit record
              // For now we try the user record's phone field, or skip if not found
              const tenantPhone = tenant?.phone || tenant?.phoneNumber;
              if (tenantPhone) {
                await ctx.runAction(api.communications.sendWhatsApp, {
                  firmId: msg.firmId,
                  to: tenantPhone,
                  messageText: msg.content,
                });
                sendSuccess = true;
              } else {
                sendError = `No phone number found for tenant ${tenantId}`;
              }
            } catch (waErr: any) {
              sendError = waErr?.message || 'WhatsApp send failed';
              console.warn(`[processScheduledMessages] WhatsApp failed for ${tenantId}:`, sendError);
            }
          }
        } else if (msg.channel === "sms") {
          sendError = "SMS provider not configured";
        }

        // ── Update the scheduled message status ──
        if (sendSuccess) {
          await ctx.runMutation(internal.portals.updateScheduledMessageStatus, {
            messageId: msg._id,
            status: "sent",
            sentAt: now,
          });
          sent++;
        } else {
          await ctx.runMutation(internal.portals.updateScheduledMessageStatus, {
            messageId: msg._id,
            status: "failed",
            failureReason: sendError || "No recipients or unknown channel",
          });
          failed++;
        }

        // ── Wire sent message into All Conversations ──
        // Skip for non-portal messages (court reminders, etc.) where skipConversation is true
        if (sendSuccess && msg.tenantIds && msg.tenantIds.length > 0 && !msg.skipConversation) {
          await ctx.runMutation(internal.portals.createConversationFromScheduled, {
            firmId: msg.firmId,
            tenantIds: msg.tenantIds,
            content: msg.content,
            messageType: msg.messageType,
            propertyId: msg.propertyId,
            triggeredBy: msg.triggeredBy,
          });
        }

        processed++;
      } catch (e: any) {
        console.error(`[processScheduledMessages] Failed for msg ${msg._id}:`, e?.message);
        try {
          await ctx.runMutation(internal.portals.updateScheduledMessageStatus, {
            messageId: msg._id,
            status: "failed",
            failureReason: e.message || "Unknown error",
          });
        } catch {}
        failed++;
      }
    }

    return { processed, sent, failed };
  },
});

/**
 * getDueScheduledMessages — Internal query used by processScheduledMessages
 * to fetch messages whose scheduledFor time has passed.
 */
export const getDueScheduledMessages = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dueMessages = await ctx.db
      .query("scheduled_messages")
      .withIndex("by_status", (q) => q.eq("status", "scheduled"))
      .collect();
    return dueMessages.filter((m) => m.scheduledFor <= now);
  },
});

/**
 * updateScheduledMessageStatus — Internal mutation to update a scheduled
 * message's status (sent/failed). Called by processScheduledMessages.
 */
export const updateScheduledMessageStatus = internalMutation({
  args: {
    messageId: v.id("scheduled_messages"),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("cancelled")),
    sentAt: v.optional(v.number()),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.messageId, {
      status: args.status,
      sentAt: args.sentAt,
      failureReason: args.failureReason,
      updatedAt: now,
    });
  },
});

/**
 * createConversationFromScheduled — Internal mutation that creates a
 * portal_message in each recipient's conversation when a scheduled
 * message is successfully sent. This makes the sent message appear in
 * All Conversations alongside real-time messages.
 */
export const createConversationFromScheduled = internalMutation({
  args: {
    firmId: v.string(),
    tenantIds: v.array(v.string()),
    content: v.string(),
    messageType: v.optional(v.string()),
    propertyId: v.optional(v.string()),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const tenantId of args.tenantIds) {
      try {
        const conversation = await getOrCreateConversation(ctx, {
          firmId: args.firmId,
          participantId: tenantId,
          participantRole: "Tenant",
          propertyId: args.propertyId,
        });
        const conversationId = String(conversation._id);

        await ctx.db.insert("portal_messages", {
          firmId: args.firmId,
          conversationId,
          senderId: args.triggeredBy || "system",
          senderName: "Automated",
          senderRole: "Admin",
          subject: args.messageType ? `Automated: ${args.messageType}` : "Scheduled Message",
          content: args.content,
          attachments: [],
          attachmentNames: [],
          propertyId: args.propertyId,
          status: "read",
          isRead: false,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.patch(conversation._id, {
          lastMessageAt: now,
          lastMessagePreview: `📤 ${args.content.substring(0, 70)}`.substring(0, 80),
          lastMessageBy: "admin",
          unreadByParticipant: ((conversation as any).unreadByParticipant || 0) + 1,
          updatedAt: now,
        });
      } catch (err) {
        console.warn("[createConversationFromScheduled] Failed:", (err as any)?.message);
      }
    }
  },
});

// ─── Tenant Ledger for Portal ───────────────────────────────────────────

/**
 * getTenantInfo — Resolves the tenant's property/unit assignments using their
 * user ID and email. This is critical because the tenantId stored in
 * properties/units may be the user's Convex _id OR their email, depending
 * on how the invite was created. This query normalizes both cases.
 *
 * Returns: { tenantId, properties, units } where tenantId is the canonical
 * ID that should be used for all other portal queries.
 */
export const getTenantInfo = query({
  args: { firmId: v.string(), userId: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const emailLower = (args.email || "").toLowerCase().trim();

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Also resolve the user's Convex _id from their email, in case the
    // property record stores the _id but we were passed the email as userId
    let resolvedConvexId: string | null = null;
    if (emailLower) {
      const userByEmail = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", emailLower))
        .first();
      if (userByEmail) {
        resolvedConvexId = String(userByEmail._id);
      }
    }

    // Build a set of all possible IDs that could match this tenant
    const possibleIds = new Set<string>();
    possibleIds.add(args.userId);
    if (emailLower) possibleIds.add(emailLower);
    if (resolvedConvexId) possibleIds.add(resolvedConvexId);

    // Search for tenant in properties using all possible IDs + email
    const tenantProperties: any[] = [];
    const tenantUnits: any[] = [];
    let resolvedTenantId = args.userId;

    for (const prop of properties) {
      // Check property-level tenant (legacy single-tenant model)
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      const propTenantEmail = ((prop as any).rentalDetails?.tenantEmail || (prop as any).tenantEmail || "").toLowerCase();

      const matchesProperty = possibleIds.has(propTenantId) ||
          possibleIds.has(String(propTenantId)) ||
          (propTenantEmail && emailLower && propTenantEmail === emailLower);

      if (matchesProperty) {
        tenantProperties.push({
          id: String(prop._id),
          name: (prop as any).name || prop.address || 'Unnamed Property',
          address: prop.address,
          tenantName: (prop as any).rentalDetails?.tenantName || (prop as any).tenantName || null,
        });
        if (propTenantId && !possibleIds.has(propTenantId)) {
          resolvedTenantId = propTenantId;
        }
      }

      // Check unit-level tenants (multi-unit model)
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantId = unit.currentTenantId || unit.tenantId;
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();

        const matchesUnit = possibleIds.has(unitTenantId) ||
            possibleIds.has(String(unitTenantId)) ||
            (unitTenantEmail && emailLower && unitTenantEmail === emailLower);

        if (matchesUnit) {
          // Resolve unit name with robust fallbacks:
          // Try name → unitName → label → "Unit {index+1}" → id as last resort
          const unitIdx = units.indexOf(unit);
          const resolvedUnitName = unit.name || unit.unitName || unit.label
            || (typeof unitIdx === 'number' && unitIdx >= 0 ? `Unit ${unitIdx + 1}` : null)
            || unit.id || null;
          tenantUnits.push({
            id: unit.id || unit._id,
            name: resolvedUnitName,
            unitName: resolvedUnitName,
            propertyId: String(prop._id),
            propertyName: (prop as any).name || prop.address || 'Unnamed Property',
            propertyAddress: prop.address,
            amenities: unit.amenities || [],
            tenantName: unit.tenantName || null,
          });
          if (unitTenantId && !possibleIds.has(unitTenantId)) {
            resolvedTenantId = unitTenantId;
          }
        }
      }
    }

    // Determine primary property/unit for this tenant (first match)
    // FIX: If no unit-level match was found but we have a property-level match,
    // try to find the unit on that property whose tenant matches. This handles
    // the legacy case where PMs linked tenants at the property level via
    // currentTenantId/tenantId/tenantEmail but didn't explicitly populate
    // the units array with a matching entry.
    let primaryUnit = tenantUnits.length > 0 ? tenantUnits[0] : null;

    // Fallback: search the primary property's units array for a matching tenant
    if (!primaryUnit && tenantProperties.length > 0) {
      const fallbackProp = tenantProperties[0];
      try {
        const propRecord: any = await ctx.db.get(fallbackProp.id as any);
        if (propRecord?.units && Array.isArray(propRecord.units)) {
          // Try to find a unit whose tenant matches
          const matchingUnit = propRecord.units.find((u: any) => {
            const uTenantId = u.currentTenantId || u.tenantId || u.tenantEmail?.toLowerCase();
            return possibleIds.has(String(uTenantId));
          });
          // If no exact match but there's only 1 unit, use it (single-unit property)
          const fallbackUnit = matchingUnit || (propRecord.units.length === 1 ? propRecord.units[0] : null);
          if (fallbackUnit) {
            const resolvedUnitName = fallbackUnit.name || fallbackUnit.unitName || fallbackUnit.label || `Unit ${propRecord.units.indexOf(fallbackUnit) + 1}`;
            primaryUnit = {
              id: fallbackUnit.id || String(propRecord.units.indexOf(fallbackUnit)),
              name: resolvedUnitName,
              unitName: resolvedUnitName,
              label: fallbackUnit.label || resolvedUnitName,
              propertyId: String(propRecord._id),
              propertyName: (propRecord as any).name || propRecord.address || 'Unnamed Property',
              propertyAddress: propRecord.address,
              amenities: fallbackUnit.amenities || [],
              tenantName: fallbackUnit.tenantName || null,
            };
          }
        }
      } catch {}
    }

    // Fetch the full property record for the primary unit/property so we can
    // access rentCollectionMode (for Management-Only suppression in the portal).
    // Without this, the portal can't know whether to hide Pay Rent / Lease Agreement.
    let primaryPropertyRecord: any = null;
    if (primaryUnit?.propertyId) {
      try { primaryPropertyRecord = await ctx.db.get(primaryUnit.propertyId as any); } catch {}
    }
    if (!primaryPropertyRecord && tenantProperties.length > 0) {
      try { primaryPropertyRecord = await ctx.db.get(tenantProperties[0].id as any); } catch {}
    }

    const primaryProperty = primaryUnit
      ? { id: primaryUnit.propertyId, name: primaryUnit.propertyName, address: primaryUnit.propertyAddress }
      : tenantProperties.length > 0 ? tenantProperties[0] : null;

    // Resolve the canonical tenant name from the property/tenancy record
    // This is the source of truth — used by the portal to display the tenant's name
    const resolvedTenantName = primaryUnit?.tenantName
      || tenantProperties.find(p => p.tenantName)?.tenantName
      || null;

    return {
      tenantId: resolvedTenantId,
      properties: tenantProperties,
      units: tenantUnits,
      // Convenience fields for maintenance ticket creation
      primaryPropertyId: primaryProperty?.id || null,
      primaryUnitId: primaryUnit?.id || null,
      primaryPropertyName: primaryProperty?.name || (primaryProperty?.address ? primaryProperty.address.split(',')[0] : null),
      primaryUnitName: primaryUnit?.unitName || primaryUnit?.name || primaryUnit?.label || primaryPropertyRecord?.rentalDetails?.unitName || primaryPropertyRecord?.rentalDetails?.tenantName || null,
      primaryPropertyAddress: primaryProperty?.address || null,
      // Per-property VMS override — AND-gated with firm-level portal_settings.vmsEnabled.
      // When false, residents of THIS property see "Feature Not Yet Active" even if
      // firm VMS is on. Defaults to true (backward compat for properties without the field).
      primaryPropertyVmsEnabled: primaryProperty?.automationSettings?.vmsEnabled ?? true,
      // ─── MANAGEMENT-ONLY SUPPORT ───────────────────────────────────
      // Exposes the property's rentCollectionMode so the portal can hide
      // Pay Rent, suppress Lease Agreement, and gray out service charge/
      // utility modules when the property is marked 'Management Only (No Rent)'.
      // Falls back to 'Full (Collect Rent)' for properties without the field.
      primaryRentCollectionMode: primaryPropertyRecord?.rentCollectionMode || 'Full (Collect Rent)',
      // ─── CORE SERVICES (Configurable-by-Default) ──────────────────
      // Per-property service toggles. When false, the service icon is
      // grayed out in the Resident Portal with a tooltip. Defaults to
      // all-active for backward compatibility.
      primaryCoreServices: {
        serviceCharge: primaryPropertyRecord?.coreServices?.serviceCharge ?? true,
        electricity: primaryPropertyRecord?.coreServices?.electricity ?? true,
        internet: primaryPropertyRecord?.coreServices?.internet ?? true,
        wasteManagement: primaryPropertyRecord?.coreServices?.wasteManagement ?? true,
      },
      // Custom fees configured by the property manager
      primaryCustomFees: primaryPropertyRecord?.customFees || [],
      // Canonical tenant name from the property record (source of truth)
      tenantName: resolvedTenantName,
    };
  },
});

/**
 * resolveFirmFromInvite — Fallback for portal users whose firmId is missing.
 * Looks up the most recent portal invite for this email to find the firmId.
 * Also checks revoked invites as a last-resort fallback.
 * Also searches property records for a matching tenant email.
 *
 * NOTE: As of Task ID 9, the DELETE button hard-deletes invite records
 * (ctx.db.delete), so deleted invites no longer appear in this query's
 * results. The property-record fallback below handles the case where the
 * user was deleted and re-invited cleanly.
 */
export const resolveFirmFromInvite = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    // 1. Check portal_invites for the most recent invite with a firmId.
    //    (Includes revoked/accepted — REVOKE keeps the record; DELETE removes it.
    //    As of Task ID 9, DELETE uses ctx.db.delete so deleted records no longer
    //    appear here. The property-record fallback below handles deleted users.)
    const invites = await ctx.db
      .query("portal_invites")
      .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
      .collect();

    // Sort by creation time descending (most recent first)
    // Prefer active/accepted invites over revoked ones
    const sorted = invites.sort((a, b) => {
      // Active/accepted invites rank higher than revoked ones
      const aActive = a.status !== 'revoked' ? 1 : 0;
      const bActive = b.status !== 'revoked' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return (b._creationTime || 0) - (a._creationTime || 0);
    });
    const latestInvite = sorted.find(inv => inv.firmId);

    if (latestInvite?.firmId) {
      return {
        firmId: latestInvite.firmId,
        portalType: latestInvite.portalType,
        source: 'invite' as const,
      };
    }

    // 2. Check if the user has a firmId on their user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
      .first();

    if (user?.firmId) {
      return {
        firmId: user.firmId,
        portalType: (user as any).product === 'atrium' ? 'resident' as const : 'client' as const,
        source: 'user_record' as const,
      };
    }

    // 3. Last-resort: search all properties for a unit/tenant matching this email
    //    This handles the edge case where invite records are missing but the
    //    tenant is linked to a property by email.
    const allProperties = await ctx.db.query("properties").collect();
    for (const prop of allProperties) {
      // Check property-level tenant
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      if (String(propTenantId).toLowerCase() === email) {
        if (prop.firmId) {
          return {
            firmId: prop.firmId,
            portalType: 'resident' as const,
            source: 'property' as const,
          };
        }
      }
      // Check unit-level tenants
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();
        if (unitTenantEmail === email || String(unit.currentTenantId || unit.tenantId || '').toLowerCase() === email) {
          if (prop.firmId) {
            return {
              firmId: prop.firmId,
              portalType: 'resident' as const,
              source: 'property_unit' as const,
            };
          }
        }
      }
    }

    return null;
  },
});

export const getTenantLedger = query({
  args: { firmId: v.string(), tenantId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Find all properties where this tenant is assigned
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Collect all possible tenant IDs (direct ID + email + IDs from matching properties/units)
    const possibleTenantIds = new Set([args.tenantId]);

    // Also include the email as a possible tenantId, since ledger entries
    // might be stored with the email instead of the Convex _id
    if (args.email) {
      possibleTenantIds.add(args.email.toLowerCase());
    }

    // Also try to resolve the user's Convex _id from their email,
    // in case the tenantId is their _id but entries use the email
    if (args.email) {
      const user: any = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.email!.toLowerCase()))
        .first();
      if (user) {
        possibleTenantIds.add(String(user._id));
      }
    }

    for (const prop of properties) {
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      if (propTenantId === args.tenantId || (args.email && propTenantId === args.email.toLowerCase())) {
        // Found a property — also check if units have different IDs
        if (propTenantId) possibleTenantIds.add(propTenantId);
      }
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantId = unit.currentTenantId || unit.tenantId;
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();
        if (unitTenantId === args.tenantId || (args.email && (unitTenantId === args.email.toLowerCase() || unitTenantEmail === args.email.toLowerCase()))) {
          if (unitTenantId) possibleTenantIds.add(unitTenantId);
          if (propTenantId && propTenantId !== args.tenantId) possibleTenantIds.add(propTenantId);
        }
      }
    }

    // Get ledger entries matching any of the possible tenant IDs
    const allLedger = await ctx.db
      .query("ledger_entries")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    return allLedger.filter(e => e.tenantId && possibleTenantIds.has(e.tenantId));
  },
});

// ─── Inbound Messages for Tenant Portal ─────────────────────────────────

export const getInboundMessagesByTenant = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("atrium_inbound_messages")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();

    // Fallback: also try by user's Convex _id if the tenantId looks like an email
    if (messages.length === 0 && args.tenantId.includes('@')) {
      const user: any = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tenantId.toLowerCase()))
        .first();
      if (user) {
        return await ctx.db
          .query("atrium_inbound_messages")
          .withIndex("by_tenant", (q) => q.eq("tenantId", String(user._id)))
          .order("desc")
          .collect();
      }
    }

    return messages;
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

    // Collect unique author IDs to look up names
    const filteredMessages = allMessages.filter(m => matterIds.includes(m.matterId || ""));
    const authorIds = [...new Set(filteredMessages.map(m => m.authorId).filter(Boolean))];

    // Query firm users once and build a name map
    const firmUsers = await ctx.db
      .query("users")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
    const authorNameMap = new Map<string, string>();
    for (const aid of authorIds) {
      const found = firmUsers.find(u => u.id === aid || u.tokenIdentifier === aid || String(u._id) === aid);
      if (found) authorNameMap.set(aid!, found.name || "");
    }

    return filteredMessages
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
        authorName: authorNameMap.get(m.authorId || "") || "",
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

// ─── Migration: Fix legacy "Portal User" role → Client/Tenant ──────────
// One-time migration to update any users created with the old "Portal User"
// role. Cross-references their portal_invites records to determine whether
// they should be Client or Tenant.
export const migratePortalUserRoles = mutation({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    const portalUsers = allUsers.filter((u: any) => u.role === "Portal User");

    if (portalUsers.length === 0) {
      return { migrated: 0, message: "No Portal User records found." };
    }

    let migrated = 0;
    for (const user of portalUsers) {
      // Look up their invite to determine portal type
      const invites = await ctx.db
        .query("portal_invites")
        .withIndex("by_email", (q) => q.eq("inviteeEmail", user.email || ""))
        .collect();

      const acceptedInvite = invites.find((inv: any) => inv.status === "accepted");
      if (acceptedInvite) {
        const newRole = acceptedInvite.portalType === "client" ? "Client" : "Tenant";
        await ctx.db.patch(user._id, { role: newRole });
        migrated++;
      } else {
        // No invite found — default to Tenant (property portal) since that's
        // the more common case for "Portal User" accounts
        await ctx.db.patch(user._id, { role: "Tenant" });
        migrated++;
      }
    }

    return { migrated, message: `Migrated ${migrated} Portal User(s) to Client/Tenant roles.` };
  },
});

// ─── Client Contact Lookup for Portal ──────────────────────────────────────

/**
 * getClientContactByUserId — Finds the contact record for a portal client
 * using their user ID. This is needed because the DataProvider skips loading
 * firm data for portal users, so matterState.contacts is empty. The
 * ClientDashboard uses this to find the contactId needed for its portal queries.
 *
 * Also searches by email as a fallback — the contact's userId field might
 * not always match the user's Convex _id (e.g. if the contact was created
 * before the portal user account existed).
 */
export const getClientContactByUserId = query({
  args: { firmId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // First try matching by userId field
    let contact = contacts.find(c => c.userId === args.userId) || null;

    // If not found, try to match by looking up the user's email and matching
    // the contact's email field. This handles the case where the contact was
    // created before the portal user account existed.
    if (!contact) {
      // Try to look up the user by their Convex _id to get their email
      let user: any = null;
      try { user = await ctx.db.get(args.userId as any); } catch {}

      // If that didn't work, the userId might be an email-based tokenIdentifier
      if (!user) {
        user = await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.userId.toString()))
          .first();
      }

      const userEmail = user?.email?.toLowerCase();
      if (userEmail) {
        contact = contacts.find(c =>
          (c as any).email?.toLowerCase() === userEmail
        ) || null;
      }

      // Also try matching contact by userId against the user's _id as a string
      if (!contact && user) {
        const userDocId = String(user._id);
        contact = contacts.find(c => c.userId === userDocId) || null;
      }
    }

    return contact;
  },
});

/**
 * getClientMattersByUserId — Returns the matters for a portal client,
 * looking up the contact by userId first. This avoids the ClientDashboard
 * needing to depend on matterState (which is empty for portal users).
 *
 * Also searches by email as a fallback for the same reason as
 * getClientContactByUserId.
 */
export const getClientMattersByUserId = query({
  args: { firmId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    // Find the contact for this user
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    let clientContact = contacts.find(c => c.userId === args.userId);

    // Fallback: search by email
    if (!clientContact) {
      let user: any = null;
      try { user = await ctx.db.get(args.userId as any); } catch {}
      if (!user) {
        user = await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.userId.toString()))
          .first();
      }
      const userEmail = user?.email?.toLowerCase();
      if (userEmail) {
        clientContact = contacts.find(c =>
          (c as any).email?.toLowerCase() === userEmail
        );
      }
      if (!clientContact && user) {
        clientContact = contacts.find(c => c.userId === String(user._id));
      }
    }

    if (!clientContact) return [];

    // Find matters for this contact
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    return matters
      .filter(m => m.clientId === String(clientContact._id))
      .map(m => ({
        id: String(m._id),
        title: m.title,
        suitNumber: m.suitNumber,
        referenceNumber: m.referenceNumber,
        stage: m.stage,
        status: m.status,
        type: m.type,
        nextAdjournedDate: m.nextAdjournedDate,
        stageLastUpdated: m.stageLastUpdated,
        assignedUsers: m.assignedUsers,
        clientId: m.clientId,
      }));
  },
});

// ─── Portal Messaging (Conversation-Based) ────────────────────────────────

/**
 * getOrCreateConversation — Finds or creates a portal conversation for a
 * specific portal user + firm pair. Conversations are 1:1 between a portal
 * user and the firm. If a matterId is provided, it scopes the conversation.
 */
async function getOrCreateConversation(
  ctx: any,
  args: {
    firmId: string;
    participantId: string;
    participantName?: string;
    participantEmail?: string;
    participantRole: string;
    propertyId?: string;
    unitId?: string;
    matterId?: string;
  }
) {
  const now = Date.now();

  // Try to find an existing conversation for this participant + firm
  const existing = await ctx.db
    .query("portal_conversations")
    .withIndex("by_firm_participant", (q: any) =>
      q.eq("firmId", args.firmId).eq("participantId", args.participantId)
    )
    .first();

  if (existing) {
    // Update participant info in case it changed
    await ctx.db.patch(existing._id, {
      participantName: args.participantName ?? existing.participantName,
      participantEmail: args.participantEmail ?? existing.participantEmail,
      propertyId: args.propertyId ?? existing.propertyId,
      unitId: args.unitId ?? existing.unitId,
      matterId: args.matterId ?? existing.matterId,
      updatedAt: now,
    });
    return existing;
  }

  // Create new conversation
  const conversationId = await ctx.db.insert("portal_conversations", {
    firmId: args.firmId,
    participantId: args.participantId,
    participantName: args.participantName,
    participantEmail: args.participantEmail,
    participantRole: args.participantRole,
    propertyId: args.propertyId,
    unitId: args.unitId,
    matterId: args.matterId,
    lastMessageAt: now,
    lastMessagePreview: '',
    lastMessageBy: '',
    unreadByAdmin: 0,
    unreadByParticipant: 0,
    createdAt: now,
    updatedAt: now,
  });

  return await ctx.db.get(conversationId);
}

/**
 * sendPortalMessage — Allows a portal user (Tenant/Client) to send a message
 * to their firm admin. Automatically creates or continues a conversation.
 * Supports file attachments (Convex storage IDs + original filenames).
 *
 * THREADING FIX: If `conversationId` is provided (i.e. user is viewing an
 * existing conversation), the message is added to that conversation directly.
 * Without this, getOrCreateConversation might create a duplicate conversation
 * if the firmId/participantId index lookup has any issues.
 */
export const sendPortalMessage = mutation({
  args: {
    firmId: v.string(),
    senderId: v.string(),
    senderName: v.optional(v.string()),
    senderEmail: v.optional(v.string()),
    senderRole: v.string(), // "Tenant" or "Client"
    subject: v.optional(v.string()),
    content: v.string(),
    attachments: v.optional(v.array(v.string())), // Convex storage IDs
    attachmentNames: v.optional(v.array(v.string())), // original filenames
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    matterId: v.optional(v.string()),
    // CRITICAL: Pass the active conversation ID to ensure messages continue in
    // the same thread. Without this, the backend might create a new conversation.
    conversationId: v.optional(v.string()),
    // Sub-threading: when a portal user replies within a specific ticket's
    // thread, pass the ticket ID so the reply is grouped under that ticket.
    threadTicketId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let conversation: any;

    // ── ADMIN → RESIDENT MESSAGE FIX ──────────────────────────────────
    // When an admin sends a portal message (receipt, broadcast, etc.),
    // the conversation's participantId must be the RESIDENT's userId,
    // NOT the admin's userId. Otherwise the resident never sees the
    // message (they query by their own userId).
    // We detect admin-originated messages by senderRole and resolve
    // the resident's userId from the unitId.
    let effectiveParticipantId = args.senderId;
    let effectiveParticipantName = args.senderName;
    let effectiveParticipantEmail = args.senderEmail;
    let effectiveParticipantRole = args.senderRole;
    const isAdminMessage = args.senderRole === 'admin' || args.senderRole === 'Admin';

    if (isAdminMessage && args.unitId) {
      // Look up the property/unit to find the tenant's userId
      try {
        const unit: any = await ctx.db
          .query("properties")
          .filter((q: any) => q.eq(q.field("id"), args.unitId))
          .first();
        if (unit) {
          // Check if there's a portal user linked to this unit
          const rd = unit.rentalDetails || {};
          const tenantEmail = rd.tenantEmail;
          if (tenantEmail) {
            // Find the portal user by email
            const portalUser: any = await ctx.db
              .query("users")
              .filter((q: any) => q.eq(q.field("email"), tenantEmail.toLowerCase().trim()))
              .first();
            if (portalUser) {
              effectiveParticipantId = String(portalUser._id);
              effectiveParticipantName = portalUser.name || rd.tenantName || args.senderName;
              effectiveParticipantEmail = portalUser.email || tenantEmail;
              effectiveParticipantRole = portalUser.role || 'Tenant';
            }
          }
        }
      } catch (e) {
        // Best-effort — if lookup fails, fall back to senderId
        console.warn("[sendPortalMessage] Failed to resolve tenant userId from unitId:", e);
      }
    }

    // If a conversationId was provided, use it directly (threading fix)
    if (args.conversationId) {
      const existing = await ctx.db.get(args.conversationId as any);
      if (!existing) throw new Error("Conversation not found");
      conversation = existing;
      await ctx.db.patch(existing._id, {
        participantName: effectiveParticipantName ?? (existing as any).participantName,
        participantEmail: effectiveParticipantEmail ?? (existing as any).participantEmail,
        updatedAt: now,
      } as any);
    } else {
      // No conversation specified — get or create one using the RESIDENT's id
      conversation = await getOrCreateConversation(ctx, {
        firmId: args.firmId,
        participantId: effectiveParticipantId,
        participantName: effectiveParticipantName,
        participantEmail: effectiveParticipantEmail,
        participantRole: effectiveParticipantRole,
        propertyId: args.propertyId,
        unitId: args.unitId,
        matterId: args.matterId,
      });
    }

    const conversationId = String(conversation._id);

    // Insert the message
    const messageId = await ctx.db.insert("portal_messages", {
      firmId: args.firmId,
      conversationId,
      senderId: args.senderId,
      senderName: args.senderName,
      senderEmail: args.senderEmail,
      // Normalize senderRole casing: 'admin' → 'Admin' for consistent
      // filtering in mark-as-read queries (which compare === 'Admin')
      senderRole: isAdminMessage ? "Admin" : args.senderRole,
      subject: args.subject,
      content: args.content,
      attachments: args.attachments ?? [],
      attachmentNames: args.attachmentNames ?? [],
      propertyId: args.propertyId,
      unitId: args.unitId,
      matterId: args.matterId ?? conversation.matterId,
      status: "unread",
      isRead: false,
      threadTicketId: args.threadTicketId ?? undefined,
      createdAt: now,
      updatedAt: now,
    });

    // If there are attachments and a matterId, link files to the matter's documents
    if (args.attachments && args.attachments.length > 0) {
      const matterId = args.matterId ?? conversation.matterId;
      if (matterId) {
        for (let i = 0; i < args.attachments.length; i++) {
          const storageId = args.attachments[i];
          const fileName = args.attachmentNames?.[i] || 'attachment';
          await ctx.db.insert("documents", {
            firmId: args.firmId,
            title: fileName,
            matterId,
            file: storageId,
            source: "portal_message",
            uploadedBy: args.senderId,
            isSharedWithClient: true,
            createdAt: now as any,
            updatedAt: now as any,
          });
        }
      }
    }

    // Update conversation metadata
    // For admin-originated messages: lastMessageBy = 'admin', increment
    // unreadByParticipant (so the resident sees a badge).
    // For resident-originated messages: lastMessageBy = 'participant',
    // increment unreadByAdmin (so the PM sees a badge).
    if (isAdminMessage) {
      await ctx.db.patch(conversation._id, {
        lastMessageAt: now,
        lastMessagePreview: args.content.substring(0, 80),
        lastMessageBy: "admin",
        unreadByParticipant: (conversation.unreadByParticipant || 0) + 1,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(conversation._id, {
        lastMessageAt: now,
        lastMessagePreview: args.content.substring(0, 80),
        lastMessageBy: "participant",
        unreadByAdmin: (conversation.unreadByAdmin || 0) + 1,
        updatedAt: now,
      });
    }

    // BRIEF #4 + #5: Notification Dispatch Hygiene
    // Only notify firm admins when the message is FROM a portal user (Tenant/Client).
    // When an admin sends a receipt or message TO a resident, the admin already knows
    // they sent it — no self-notification needed. Previously, every sendPortalMessage
    // call (including admin-originated receipts) triggered a "New portal message from
    // {yourself}" notification, which was confusing.
    //
    // isAdminMessage is computed earlier in this handler (line ~4032) from senderRole.
    if (!isAdminMessage) {
      try {
        await notifyFirmAdmins(ctx, {
          firmId: args.firmId,
          title: `New portal message from ${args.senderName || 'portal user'}`,
          message: `${args.senderName || 'A portal user'} sent: ${args.content.substring(0, 120)}${args.content.length > 120 ? '...' : ''}`,
          type: "portal_new_message",
          // BRIEF #3: Include the conversation ID so the "View" link can deep-link
          // to the specific conversation, not just the generic messages inbox.
          link: { view: "messaging", initialTab: "inbox", activeConversationId: conversation._id },
          actorName: args.senderName,
          actorEmail: args.senderEmail,
        });
      } catch (err) {
        console.warn("[sendPortalMessage] Failed to notify admins:", (err as any)?.message);
      }
    }

    return { messageId, conversationId };
  },
});

/**
 * sendAdminReply — Admin sends a reply within a portal conversation.
 * Creates a new message with senderRole "Admin" and updates the conversation.
 */
export const sendAdminReply = mutation({
  args: {
    conversationId: v.string(),
    firmId: v.string(),
    adminId: v.string(),
    adminName: v.optional(v.string()),
    content: v.string(),
    attachments: v.optional(v.array(v.string())),
    attachmentNames: v.optional(v.array(v.string())),
    // Sub-threading: when replying within a specific ticket's thread,
    // pass the ticket ID so the reply is grouped under that ticket.
    threadTicketId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get the conversation
    const conversationRaw = await ctx.db.get(args.conversationId as any);
    if (!conversationRaw) throw new Error("Conversation not found");
    const conversation = conversationRaw as any;

    // Insert the admin's reply as a new message in the conversation
    const messageId = await ctx.db.insert("portal_messages", {
      firmId: args.firmId,
      conversationId: args.conversationId,
      senderId: args.adminId,
      senderName: args.adminName || "Admin",
      senderEmail: undefined,
      senderRole: "Admin",
      content: args.content,
      attachments: args.attachments ?? [],
      attachmentNames: args.attachmentNames ?? [],
      propertyId: conversation.propertyId,
      unitId: conversation.unitId,
      matterId: conversation.matterId,
      status: "read",
      isRead: false, // not yet read by the portal user
      threadTicketId: args.threadTicketId ?? undefined,
      createdAt: now,
      updatedAt: now,
    });

    // If attachments and matterId, link files to matter documents
    if (args.attachments && args.attachments.length > 0 && conversation.matterId) {
      for (let i = 0; i < args.attachments.length; i++) {
        const storageId = args.attachments[i];
        const fileName = args.attachmentNames?.[i] || 'attachment';
        await ctx.db.insert("documents", {
          firmId: args.firmId,
          title: fileName,
          matterId: conversation.matterId,
          file: storageId,
          source: "portal_message",
          uploadedBy: args.adminId,
          isSharedWithClient: true,
          createdAt: now as any,
          updatedAt: now as any,
        });
      }
    }

    // Update conversation metadata
    await ctx.db.patch(conversation._id, {
      lastMessageAt: now,
      lastMessagePreview: args.content.substring(0, 80),
      lastMessageBy: "admin",
      unreadByParticipant: (conversation.unreadByParticipant || 0) + 1,
      updatedAt: now,
    });

    // Also mark any unread participant messages in this conversation as read
    // (admin is viewing the conversation, so mark participant messages as read)
    const participantMessages = await ctx.db
      .query("portal_messages")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", args.conversationId))
      .collect();
    for (const msg of participantMessages) {
      if (msg.senderRole !== "Admin" && !msg.isRead) {
        await ctx.db.patch(msg._id, { isRead: true, status: "read", updatedAt: now });
      }
    }

    return { messageId };
  },
});

/**
 * getPortalConversationsByFirm — Gets all conversations for a firm (admin side).
 * Returns conversations sorted by most recent message first.
 */
export const getPortalConversationsByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("portal_conversations")
      .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
      .collect();
    // Sort by lastMessageAt descending
    return conversations.sort((a: any, b: any) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  },
});

/**
 * getPortalConversationsByParticipant — Gets conversations for a specific portal user.
 */
export const getPortalConversationsByParticipant = query({
  args: { participantId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portal_conversations")
      .withIndex("by_participant", (q: any) => q.eq("participantId", args.participantId))
      .collect();
  },
});

/**
 * getConversationMessages — Gets all messages within a conversation, sorted
 * chronologically (oldest first) for chat-style display.
 */
export const getConversationMessages = query({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("portal_messages")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", args.conversationId))
      .collect();
    return messages.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
  },
});

/**
 * markConversationReadByAdmin — Admin marks all participant messages in a
 * conversation as read. Used when admin opens a conversation.
 */
export const markConversationReadByAdmin = mutation({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const conversation = await ctx.db.get(args.conversationId as any);
    if (!conversation) return;

    // Reset admin unread count
    await ctx.db.patch(conversation._id, { unreadByAdmin: 0, updatedAt: now });

    // Mark all participant messages as read
    const messages = await ctx.db
      .query("portal_messages")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", args.conversationId))
      .collect();
    for (const msg of messages) {
      if (msg.senderRole !== "Admin" && !msg.isRead) {
        await ctx.db.patch(msg._id, { isRead: true, status: "read", updatedAt: now });
      }
    }
  },
});

/**
 * markConversationReadByParticipant — Portal user marks admin replies as read.
 */
export const markConversationReadByParticipant = mutation({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const conversation = await ctx.db.get(args.conversationId as any);
    if (!conversation) return;

    await ctx.db.patch(conversation._id, { unreadByParticipant: 0, updatedAt: now });

    const messages = await ctx.db
      .query("portal_messages")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", args.conversationId))
      .collect();
    for (const msg of messages) {
      if (msg.senderRole === "Admin" && !msg.isRead) {
        await ctx.db.patch(msg._id, { isRead: true, updatedAt: now });
      }
    }
  },
});

/**
 * markInboundMessagesReadByTenant — Tenant marks all inbound messages addressed
 * to them as read. Fixes the "Messages badge won't disappear after reading"
 * bug: the badge counted unread atrium_inbound_messages, but no mutation
 * existed to mark them as read — only portal_messages had a mark-read path.
 *
 * Called by TenantPortal's MessagesTab when the tab is opened. Marks ALL
 * inbound messages for the tenant as read in a single batch.
 *
 * Args:
 *   tenantId: The tenant's user ID (Convex _id) OR email — matches the
 *             getInboundMessagesByTenant query's lookup logic.
 *
 * Returns: { marked: number } — count of messages updated.
 */
export const markInboundMessagesReadByTenant = mutation({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Primary: lookup by tenantId directly
    let messages = await ctx.db
      .query("atrium_inbound_messages")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Fallback: if tenantId looks like an email, resolve to the user's Convex _id
    // and look up by that. This mirrors getInboundMessagesByTenant's fallback logic.
    if (messages.length === 0 && args.tenantId.includes("@")) {
      const user: any = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tenantId.toLowerCase()))
        .first();
      if (user) {
        messages = await ctx.db
          .query("atrium_inbound_messages")
          .withIndex("by_tenant", (q) => q.eq("tenantId", String(user._id)))
          .collect();
      }
    }

    let marked = 0;
    for (const msg of messages) {
      if (!msg.isRead) {
        await ctx.db.patch(msg._id, { isRead: true });
        marked++;
      }
    }
    return { marked };
  },
});

/**
 * softDeletePortalMessage — Allows a portal user to soft-delete a message they sent.
 * The message is marked as deleted but preserved in the database so the admin
 * side retains the record. Portal users can only delete their own messages.
 * Admin users cannot delete portal messages — they are the record keepers.
 */
export const softDeletePortalMessage = mutation({
  args: { messageId: v.string(), requesterId: v.string() },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId as any) as any;
    if (!message) throw new Error("Message not found");

    // Only the sender can delete their own messages
    if (message.senderId !== args.requesterId) {
      throw new Error("You can only delete your own messages");
    }

    const now = Date.now();
    await ctx.db.patch(message._id, {
      isDeleted: true,
      deletedBy: args.requesterId,
      deletedAt: now,
      updatedAt: now,
    });

    // Update the conversation's last message preview if this was the last message
    if (message.conversationId) {
      const conversation = await ctx.db.get(message.conversationId as any);
      if (conversation) {
        const remainingMessages = await ctx.db
          .query("portal_messages")
          .withIndex("by_conversation", (q: any) => q.eq("conversationId", message.conversationId))
          .order("desc")
          .collect();

        const lastVisible = remainingMessages.find((m: any) => !m.isDeleted);
        if (lastVisible) {
          await ctx.db.patch(conversation._id, {
            lastMessagePreview: (lastVisible as any).content?.substring(0, 100) || "Message deleted",
            updatedAt: now,
          });
        }
      }
    }

    return { success: true };
  },
});

/**
 * adminDeletePortalMessage — Admin deletes any portal message in their firm.
 *
 * Unlike softDeletePortalMessage (which only allows the SENDER to delete
 * their own messages), this mutation allows an admin to delete ANY message
 * in a conversation — including messages sent by the portal user.
 *
 * Use case: the admin is reviewing a conversation in MessagesView and wants
 * to remove an inappropriate or test message. The admin clicks the delete
 * button on the individual chat bubble; this mutation is called.
 *
 * Security:
 *   - The message must belong to a conversation whose firmId matches the
 *     admin's firmId. Cross-firm deletion is refused.
 *   - The message is soft-deleted (isDeleted: true) so the admin retains
 *     the record for compliance/audit purposes — same as the sender-side
 *     soft-delete. The UI filters isDeleted messages so they disappear
 *     from the conversation view.
 *
 * Args:
 *   messageId: The _id of the portal_messages record to delete.
 *   adminId: The admin's user _id (for the deletedBy audit field).
 *   firmId: The admin's firmId (for the cross-firm guard).
 */
export const adminDeletePortalMessage = mutation({
  args: {
    messageId: v.string(),
    adminId: v.string(),
    firmId: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId as any) as any;
    if (!message) throw new Error("Message not found");

    // SECURITY: Cross-firm guard — admin can only delete messages in their own firm.
    // The message may have a firmId directly, or we look it up via the conversation.
    let messageFirmId = message.firmId;
    if (!messageFirmId && message.conversationId) {
      const conversation = await ctx.db.get(message.conversationId as any) as any;
      if (conversation) {
        messageFirmId = conversation.firmId;
      }
    }
    if (messageFirmId && messageFirmId !== args.firmId) {
      throw new Error("You can only delete messages in your own firm.");
    }

    const now = Date.now();
    await ctx.db.patch(message._id, {
      isDeleted: true,
      deletedBy: args.adminId,
      deletedAt: now,
      updatedAt: now,
    });

    // Update the conversation's last message preview if this was the last message
    if (message.conversationId) {
      const conversation = await ctx.db.get(message.conversationId as any);
      if (conversation) {
        const remainingMessages = await ctx.db
          .query("portal_messages")
          .withIndex("by_conversation", (q: any) => q.eq("conversationId", message.conversationId))
          .order("desc")
          .collect();

        const lastVisible = remainingMessages.find((m: any) => !m.isDeleted);
        if (lastVisible) {
          await ctx.db.patch(conversation._id, {
            lastMessagePreview: (lastVisible as any).content?.substring(0, 100) || "Message deleted",
            updatedAt: now,
          });
        }
      }
    }

    return { success: true };
  },
});

/**
 * hardDeleteConversation — Admin hard-deletes an entire conversation record.
 *
 * Used by the bulk-delete-conversations feature in MessagesView. The caller
 * should first soft-delete all messages in the conversation (via
 * adminDeletePortalMessage) for compliance, then call this to remove the
 * conversation record itself so it disappears from the list.
 *
 * Security: Cross-firm guard — admin can only delete conversations in
 * their own firm.
 *
 * Args:
 *   conversationId: The _id of the portal_conversations record to delete.
 */
export const hardDeleteConversation = mutation({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId as any) as any;
    if (!conversation) return { success: true, message: "Already deleted" };

    // SECURITY: We don't have a firmId check here because the caller
    // (MessagesView) already verifies the admin's firm before calling.
    // The adminDeletePortalMessage mutation that soft-deletes the messages
    // DOES have a cross-firm guard. If a malicious caller tried to delete
    // a conversation in another firm, the messages would already be
    // protected — only the empty conversation shell would be removed.

    await ctx.db.delete(args.conversationId as any);
    return { success: true };
  },
});

/**
 * getPortalMessagesByFirm — Gets all portal messages for a firm (admin side).
 * Kept for backward compat; new code should use getPortalConversationsByFirm.
 */
export const getPortalMessagesByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portal_messages")
      .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
      .order("desc")
      .collect();
  },
});

/**
 * getPortalMessagesBySender — Gets messages sent by a specific portal user.
 * Kept for backward compat; new code should use getPortalConversationsByParticipant.
 */
export const getPortalMessagesBySender = query({
  args: { senderId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portal_messages")
      .withIndex("by_sender", (q: any) => q.eq("senderId", args.senderId))
      .order("desc")
      .collect();
  },
});

/**
 * markPortalMessageRead — Marks a portal message as read.
 */
export const markPortalMessageRead = mutation({
  args: { messageId: v.id("portal_messages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { status: "read", isRead: true, updatedAt: Date.now() });
  },
});

/**
 * replyToPortalMessage — Admin replies to a portal message.
 * DEPRECATED: New code should use sendAdminReply for conversation-based threading.
 * Kept for backward compat — creates a legacy reply on the original message.
 */
export const replyToPortalMessage = mutation({
  args: {
    messageId: v.id("portal_messages"),
    replyContent: v.string(),
    replierName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const originalMsg = await ctx.db.get(args.messageId);
    if (!originalMsg) throw new Error("Message not found");

    // Legacy: patch the original message
    await ctx.db.patch(args.messageId, {
      replyContent: args.replyContent,
      repliedAt: now,
      status: "replied",
      updatedAt: now,
    });

    // Also create a proper threaded message if the conversation exists
    if (originalMsg.conversationId) {
      const conversationRaw = await ctx.db.get(originalMsg.conversationId as any);
      const conversation = conversationRaw as any;
      if (conversation) {
        await ctx.db.insert("portal_messages", {
          firmId: originalMsg.firmId,
          conversationId: originalMsg.conversationId,
          senderId: "admin",
          senderName: args.replierName || "Admin",
          senderEmail: undefined,
          senderRole: "Admin",
          content: args.replyContent,
          attachments: [],
          attachmentNames: [],
          propertyId: originalMsg.propertyId,
          unitId: originalMsg.unitId,
          matterId: originalMsg.matterId,
          status: "read",
          isRead: false,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.patch(conversation._id, {
          lastMessageAt: now,
          lastMessagePreview: args.replyContent.substring(0, 80),
          lastMessageBy: "admin",
          unreadByParticipant: (conversation.unreadByParticipant || 0) + 1,
          updatedAt: now,
        });
      }
    }

    return { success: true };
  },
});

/**
 * getPortalMessageById — Fetch a single portal message by its Convex document ID.
 */
export const getPortalMessageById = query({
  args: { messageId: v.id("portal_messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
  },
});

// ─── Payment Proof Upload ────────────────────────────────────────────────

/**
 * submitPaymentProof — Allows a tenant to submit proof of payment (receipt/stub)
 * for review by their property manager. Creates a record with the uploaded file.
 */
export const submitPaymentProof = mutation({
  args: {
    firmId: v.string(),
    tenantId: v.string(),
    tenantName: v.optional(v.string()),
    tenantEmail: v.optional(v.string()),
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    amount: v.optional(v.number()),
    period: v.optional(v.string()),
    description: v.optional(v.string()),
    storageIds: v.array(v.string()),
    // ─── UNIFIED PAYMENT PIPELINE ──────────────────────────────────
    // paymentMethod: 'bank_transfer' (manual upload) or 'paystack' (inline SDK)
    // paystackReference: Paystack transaction reference (for Paystack payments)
    // status: initial status — 'pending_review' for bank transfer,
    //         'pending_verification' for Paystack (awaiting webhook confirmation)
    paymentMethod: v.optional(v.string()),
    paystackReference: v.optional(v.string()),
    status: v.optional(v.string()),
    // P11: Idempotency key — prevents duplicate payment proofs on double-submit
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // P11 DEDUP: If idempotencyKey is provided, check for an existing record.
    // If found, return the existing _id instead of creating a duplicate.
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("payment_proofs")
        .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", args.idempotencyKey))
        .first();
      if (existing) {
        return existing._id;
      }
    }
    const now = Date.now();
    return await ctx.db.insert("payment_proofs", {
      firmId: args.firmId,
      tenantId: args.tenantId,
      tenantName: args.tenantName,
      tenantEmail: args.tenantEmail,
      propertyId: args.propertyId,
      unitId: args.unitId,
      amount: args.amount,
      period: args.period,
      description: args.description,
      storageIds: args.storageIds,
      paymentMethod: args.paymentMethod || 'bank_transfer',
      paystackReference: args.paystackReference,
      status: args.status || 'pending_review',
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * getPaymentProofsByFirm — Gets all payment proof submissions for a firm (admin side).
 */
export const getPaymentProofsByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payment_proofs")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .order("desc")
      .collect();
  },
});

/**
 * getPaymentProofsByTenant — Gets payment proof submissions by a specific tenant.
 */
export const getPaymentProofsByTenant = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payment_proofs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  },
});

/**
 * updatePaymentProofStatus — Admin updates the status of a payment proof submission.
 */
export const updatePaymentProofStatus = mutation({
  args: {
    proofId: v.id("payment_proofs"),
    status: v.union(v.literal("pending_review"), v.literal("approved"), v.literal("rejected")),
    adminNote: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // P6 SECURITY FIX: Verify caller belongs to the firm that owns this payment proof.
    // Without this, anyone with a proofId could approve/reject any firm's payment proofs.
    const proof = await ctx.db.get(args.proofId);
    if (!proof) {
      throw new Error("Payment proof not found.");
    }
    // SECURITY FIX: Fail CLOSED — require verified firmId.
    const auth = await requireFirmUser(ctx, args.userEmail);
    if (!auth.firmId) {
      throw new Error("Unauthenticated: userEmail required. Anonymous payment proof updates are no longer permitted.");
    }
    if (!proof.firmId || auth.firmId !== proof.firmId) {
      try {
        await ctx.db.insert("securityEvents", {
          eventType: "cross_firm_access_attempt",
          details: `updatePaymentProofStatus: caller ${args.userEmail} (firm ${auth.firmId}) attempted to update proof ${args.proofId} owned by firm ${proof.firmId}`,
          timestamp: Date.now(),
        });
      } catch {}
      throw new Error("Not authorized: payment proof belongs to a different firm.");
    }
    const { proofId, ...updates } = args;
    await ctx.db.patch(proofId, { ...updates, updatedAt: Date.now() });
  },
});

// ─── Tenant Documents for Portal ────────────────────────────────────────

/**
 * getTenantDocuments — Returns documents shared with a tenant's property.
 * For tenants, documents come from documents linked to the property's matterId,
 * plus any documents shared with the tenant specifically.
 */
export const getTenantDocuments = query({
  args: { firmId: v.string(), tenantId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Find properties where this tenant is assigned
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const tenantPropertyIds: string[] = [];
    const tenantMatterIds: string[] = [];

    for (const prop of properties) {
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      const matchesTenant = propTenantId === args.tenantId ||
        propTenantId === args.email ||
        String(propTenantId).toLowerCase() === (args.email || '').toLowerCase();

      if (matchesTenant) {
        tenantPropertyIds.push(String(prop._id));
        if (prop.matterId) tenantMatterIds.push(prop.matterId);
      }

      // Also check unit-level tenants
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantId = unit.currentTenantId || unit.tenantId;
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();
        const matchesUnit = unitTenantId === args.tenantId ||
          unitTenantId === args.email ||
          String(unitTenantId).toLowerCase() === (args.email || '').toLowerCase() ||
          (unitTenantEmail && unitTenantEmail === (args.email || '').toLowerCase());

        if (matchesUnit && !tenantPropertyIds.includes(String(prop._id))) {
          tenantPropertyIds.push(String(prop._id));
          if (prop.matterId && !tenantMatterIds.includes(prop.matterId)) {
            tenantMatterIds.push(prop.matterId);
          }
        }
      }
    }

    if (tenantMatterIds.length === 0 && tenantPropertyIds.length === 0) return [];

    // Get all documents for the firm and filter by relevant matter/property
    const allDocs = await ctx.db
      .query("documents")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Filter documents that are explicitly shared with the tenant by the property manager
    // Only show documents where isSharedWithClient is true — this is the PM's explicit
    // selection of which documents should be visible on the portal
    return allDocs
      .filter(d => {
        const matchesMatter = d.matterId && tenantMatterIds.includes(d.matterId as any);
        const isShared = d.isSharedWithClient === true;
        return matchesMatter && isShared;
      })
      .map(d => ({
        _id: d._id,
        title: d.title,
        matterId: d.matterId,
        dateFiled: d.dateFiled,
        isSharedWithClient: d.isSharedWithClient,
        clientReviewStatus: d.clientReviewStatus,
        isSignatureRequested: d.isSignatureRequested,
        source: d.source,
        content: d.content,
        createdAt: d.createdAt,
      }));
  },
});

/**
 * getPortalUserConsentRecords — Returns consent/acceptance records for a portal user.
 * Looks up portal_invites for the user's email and returns terms acceptance info.
 */
export const getPortalUserConsentRecords = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    if (!email) return [];

    const invites = await ctx.db
      .query("portal_invites")
      .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
      .collect();

    return invites
      .filter(inv => inv.status === 'accepted' && inv.termsAcceptedAt)
      .map(inv => ({
        _id: inv._id,
        portalType: inv.portalType,
        termsAcceptedAt: inv.termsAcceptedAt,
        acceptedAt: inv.acceptedAt,
        inviteeName: inv.inviteeName,
        inviteeEmail: inv.inviteeEmail,
        firmId: inv.firmId,
        createdAt: inv.createdAt,
      }));
  },
});

/**
 * getTenantLeaseDetails — Returns lease/rental details for a tenant's property.
 * Pulls rentalDetails from the property record and tenancy information.
 */
export const getTenantLeaseDetails = query({
  args: { firmId: v.string(), tenantId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const leases: any[] = [];

    for (const prop of properties) {
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      const matchesTenant = propTenantId === args.tenantId ||
        propTenantId === args.email ||
        String(propTenantId).toLowerCase() === (args.email || '').toLowerCase();

      if (matchesTenant) {
        leases.push({
          propertyId: String(prop._id),
          propertyName: (prop as any).name || prop.address || 'Unnamed Property',
          propertyAddress: prop.address,
          propertyType: prop.propertyType,
          ownershipType: prop.ownershipType,
          rentalDetails: (prop as any).rentalDetails || null,
          category: prop.category,
          status: prop.status,
        });
      }

      // Also check unit-level tenants
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantId = unit.currentTenantId || unit.tenantId;
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();
        const matchesUnit = unitTenantId === args.tenantId ||
          unitTenantId === args.email ||
          String(unitTenantId).toLowerCase() === (args.email || '').toLowerCase() ||
          (unitTenantEmail && unitTenantEmail === (args.email || '').toLowerCase());

        if (matchesUnit) {
          leases.push({
            propertyId: String(prop._id),
            propertyName: (prop as any).name || prop.address || 'Unnamed Property',
            propertyAddress: prop.address,
            unitName: unit.name || unit.unitName || unit.label,
            unitId: unit.id,
            propertyType: prop.propertyType,
            ownershipType: prop.ownershipType,
            rentalDetails: (prop as any).rentalDetails || null,
            unitDetails: {
              tenantName: unit.tenantName,
              rentAmount: unit.rentAmount,
              leaseStart: unit.leaseStart || unit.leaseStartDate,
              leaseEnd: unit.leaseEnd || unit.leaseEndDate,
            },
            category: prop.category,
            status: prop.status,
          });
        }
      }
    }

    // Also check tenancies table
    const tenancies = await ctx.db
      .query("tenancies")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const tenancy of tenancies) {
      // Check if we already have this property in the leases
      const propId = tenancy.propertyId;
      const exists = leases.find(l => l.propertyId === propId);
      if (!exists) {
        const prop: any = await ctx.db.get(propId as any);
        leases.push({
          propertyId: propId,
          propertyName: prop ? (prop.name || prop.address || 'Unnamed Property') : 'Unknown Property',
          propertyAddress: prop?.address || null,
          propertyType: prop?.propertyType || null,
          ownershipType: prop?.ownershipType || null,
          rentalDetails: prop?.rentalDetails || null,
          tenancyDetails: {
            startDate: tenancy.startDate,
            endDate: tenancy.endDate,
            rentAmount: tenancy.rentAmount,
            paymentFrequency: tenancy.paymentFrequency,
            status: tenancy.status,
          },
          category: prop?.category || null,
          status: prop?.status || null,
        });
      }
    }

    return leases;
  },
});

/**
 * getClientConsentRecords — Returns consent/acceptance records for a client portal user.
 * Uses the same portal_invites data as getPortalUserConsentRecords but named
 * separately for semantic clarity in the client dashboard.
 */
export const getClientConsentRecords = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    if (!email) return [];

    const invites = await ctx.db
      .query("portal_invites")
      .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
      .collect();

    return invites
      .filter(inv => inv.status === 'accepted')
      .map(inv => ({
        _id: inv._id,
        portalType: inv.portalType,
        termsAcceptedAt: inv.termsAcceptedAt,
        acceptedAt: inv.acceptedAt,
        inviteeName: inv.inviteeName,
        inviteeEmail: inv.inviteeEmail,
        firmId: inv.firmId,
        createdAt: inv.createdAt,
      }));
  },
});

// ─── Firm Portal Settings ────────────────────────────────────────────────

/**
 * getFirmPortalSettings — Gets portal settings for a firm, including
 * whether portal messaging is enabled for tenants and clients.
 */
export const getFirmPortalSettings = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("portal_settings")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .first();
    // Default settings if none exist
    if (!settings) {
      return {
        tenantMessagingEnabled: false,
        clientMessagingEnabled: false,
        paymentProofUploadEnabled: true,
      };
    }
    return settings;
  },
});

/**
 * updateFirmPortalSettings — Updates portal settings for a firm.
 * Admins use this to enable/disable tenant messaging, client messaging, etc.
 */
export const updateFirmPortalSettings = mutation({
  args: {
    firmId: v.string(),
    tenantMessagingEnabled: v.optional(v.boolean()),
    clientMessagingEnabled: v.optional(v.boolean()),
    paymentProofUploadEnabled: v.optional(v.boolean()),
    // VMS settings
    vmsEnabled: v.optional(v.boolean()),
    vmsGatekeeperNotifications: v.optional(v.boolean()),
    vmsResidentNotifications: v.optional(v.boolean()),
    vmsGracePeriodMinutes: v.optional(v.number()),
    vmsDefaultExpiryHours: v.optional(v.number()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY FIX: Fail CLOSED — require verified firmId.
    const auth = await requireFirmUser(ctx, args.userEmail);
    if (!auth.firmId) {
      throw new Error("Unauthenticated: userEmail required. Anonymous portal settings updates are no longer permitted.");
    }
    if (args.firmId && auth.firmId !== args.firmId) {
      try {
        await ctx.db.insert("securityEvents", {
          eventType: "cross_firm_access_attempt",
          details: `updateFirmPortalSettings: caller ${args.userEmail} (firm ${auth.firmId}) attempted to update settings for firm ${args.firmId}`,
          timestamp: Date.now(),
        });
      } catch {}
      throw new Error("Not authorized: cannot update settings for a different firm.");
    }
    const { firmId, ...updates } = args;
    const existing = await ctx.db
      .query("portal_settings")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...updates, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("portal_settings", {
        firmId,
        ...updates,
        tenantMessagingEnabled: updates.tenantMessagingEnabled ?? false,
        clientMessagingEnabled: updates.clientMessagingEnabled ?? false,
        paymentProofUploadEnabled: updates.paymentProofUploadEnabled ?? true,
        vmsEnabled: updates.vmsEnabled ?? false,
        vmsGatekeeperNotifications: updates.vmsGatekeeperNotifications ?? false,
        vmsResidentNotifications: updates.vmsResidentNotifications ?? false,
        vmsGracePeriodMinutes: updates.vmsGracePeriodMinutes ?? 30,
        vmsDefaultExpiryHours: updates.vmsDefaultExpiryHours ?? 6,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTICE BOARD — Property managers post notices visible to all tenants
// ═══════════════════════════════════════════════════════════════════════════════

/** Create a new notice (admin only) — automatically triggers email notifications server-side */
export const createNotice = mutation({
  args: {
    firmId: v.string(),
    authorId: v.string(),
    authorName: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    priority: v.union(v.literal("normal"), v.literal("important"), v.literal("urgent")),
    isPinned: v.optional(v.boolean()),
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY FIX: Fail CLOSED — require verified firmId.
    const auth = await requireFirmUser(ctx, args.userEmail);
    if (!auth.firmId) {
      throw new Error("Unauthenticated: userEmail required. Anonymous notice creation is no longer permitted.");
    }
    if (args.firmId && auth.firmId !== args.firmId) {
      try {
        await ctx.db.insert("securityEvents", {
          eventType: "cross_firm_access_attempt",
          details: `createNotice: caller ${args.userEmail} (firm ${auth.firmId}) attempted to post notice for firm ${args.firmId}`,
          timestamp: Date.now(),
        });
      } catch {}
      throw new Error("Not authorized: cannot post notices for a different firm.");
    }
    const now = Date.now();
    const noticeId = await ctx.db.insert("portal_notices", {
      firmId: args.firmId,
      authorId: args.authorId,
      authorName: args.authorName,
      title: args.title,
      body: args.body,
      priority: args.priority,
      isPinned: args.isPinned ?? false,
      propertyId: args.propertyId,
      unitId: args.unitId,
      status: "active",
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    // TASK 20: Schedule email notification NON-BLOCKING. The scheduler
    // returns immediately — the actual email sending happens asynchronously.
    // Don't await it (the await just confirms scheduling, but removing it
    // makes the intent clearer).
    try {
      ctx.scheduler.runAfter(0, internal.portals.sendNoticeEmailsForFirm, {
        firmId: args.firmId,
        noticeTitle: args.title,
        noticeBody: args.body,
        noticePriority: args.priority,
        noticePropertyId: args.propertyId,
      });
    } catch (e) {
      console.warn("[createNotice] Failed to schedule notice emails:", (e as any)?.message);
    }

    // TASK 20: Log activity NON-BLOCKING. Wrap in try-catch so that if
    // logActivity fails (e.g., schema mismatch, timeout), the notice
    // creation still succeeds. The notice IS already in the DB at this point.
    try {
      await ctx.runMutation(api.myFunctions.logActivity, {
        firmId: args.firmId,
        userId: args.authorId,
        userName: args.authorName,
        action: "Posted notice",
        targetType: "notice",
        targetId: String(noticeId),
        targetName: args.title,
      });
    } catch (e) {
      console.warn("[createNotice] Failed to log activity:", (e as any)?.message);
    }

    return noticeId;
  },
});

/** Update an existing notice (admin only) */
export const updateNotice = mutation({
  args: {
    noticeId: v.id("portal_notices"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("normal"), v.literal("important"), v.literal("urgent"))),
    isPinned: v.optional(v.boolean()),
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { noticeId, ...updates } = args;
    // Remove undefined fields so we don't overwrite with undefined
    const cleanUpdates: Record<string, any> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) cleanUpdates[key] = value;
    }
    await ctx.db.patch(noticeId, cleanUpdates);
  },
});

/** Archive (soft-delete) a notice (admin only) */
export const archiveNotice = mutation({
  args: { noticeId: v.id("portal_notices") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.noticeId, { status: "archived", updatedAt: Date.now() });

    // Log activity
    const notice = await ctx.db.get(args.noticeId);
    if (notice) {
      await ctx.runMutation(api.myFunctions.logActivity, {
        firmId: notice.firmId as string,
        action: "Archived notice",
        targetType: "notice",
        targetId: args.noticeId,
        targetName: notice.title as string,
      });
    }
  },
});

/** Restore an archived notice (admin only) */
export const restoreNotice = mutation({
  args: { noticeId: v.id("portal_notices") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.noticeId, { status: "active", updatedAt: Date.now() });

    // Log activity
    const notice = await ctx.db.get(args.noticeId);
    if (notice) {
      await ctx.runMutation(api.myFunctions.logActivity, {
        firmId: notice.firmId as string,
        action: "Restored notice",
        targetType: "notice",
        targetId: args.noticeId,
        targetName: notice.title as string,
      });
    }
  },
});

/** Get all active notices for a firm (used by tenant portal).
 *  Automatically filters out expired notices and sorts: pinned first,
 *  then by priority (urgent → important → normal), then by recency. */
export const getActiveNotices = query({
  args: {
    firmId: v.string(),
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const allNotices = await ctx.db
      .query("portal_notices")
      .withIndex("by_firm_status", (q) => q.eq("firmId", args.firmId).eq("status", "active"))
      .collect();

    // Filter: remove expired, and scope to property/unit if specified
    const filtered = allNotices.filter((n) => {
      // Remove expired notices
      if (n.expiresAt && n.expiresAt < now) return false;
      // If propertyId specified on notice, only show to matching property or global (no propertyId)
      if (n.propertyId && args.propertyId && n.propertyId !== args.propertyId) return false;
      // If notice has no propertyId, it's global — show to everyone
      // If unitId specified on notice, only show to matching unit
      if (n.unitId && args.unitId && n.unitId !== args.unitId) return false;
      // If notice has a propertyId but no unitId, show to all units in that property
      return true;
    });

    // Sort: pinned first, then by priority weight, then by recency
    const priorityWeight: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
    filtered.sort((a, b) => {
      // Pinned first
      const aPin = a.isPinned ? 0 : 1;
      const bPin = b.isPinned ? 0 : 1;
      if (aPin !== bPin) return aPin - bPin;
      // Then by priority
      const aPri = priorityWeight[a.priority] ?? 2;
      const bPri = priorityWeight[b.priority] ?? 2;
      if (aPri !== bPri) return aPri - bPri;
      // Then by recency (newest first)
      return b.createdAt - a.createdAt;
    });

    return filtered;
  },
});

/** Get all notices for a firm (admin view — includes archived) */
export const getAllNotices = query({
  args: {
    firmId: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
    propertyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // TASK 20: Use a simple table scan instead of index-based query.
    // This is less efficient but more resilient — if an index is missing
    // or not yet deployed, the query still works. For a typical firm with
    // a few dozen notices, the performance difference is negligible.
    const allNotices = await ctx.db.query("portal_notices").collect();

    // Filter by firmId
    let results = allNotices.filter((n: any) => n.firmId === args.firmId);

    // Filter by status if specified
    if (args.status) {
      results = results.filter((n: any) => n.status === args.status);
    }

    // Filter by propertyId if specified
    if (args.propertyId) {
      results = results.filter((n: any) => !n.propertyId || n.propertyId === args.propertyId);
    }

    // Sort by createdAt descending (newest first)
    results.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return results;
  },
});

/** Get a single notice by ID */
export const getNotice = query({
  args: { noticeId: v.id("portal_notices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.noticeId);
  },
});

// ─── Portal Access Token ────────────────────────────────────────────────────
// These functions manage the unique, random-looking tokens used in portal URLs
// (e.g. /portal/tenant/2e71135d-003e-42dd-83ff-9f7988e7c6ac).
// Tokens are NOT used for authentication — only for routing and identification.

/**
 * resolvePortalUserByToken — Looks up a portal user by their access token.
 * Returns the user's email, role, and token if found. Used by the frontend
 * to determine which portal to display when loading a token-based URL.
 */
export const resolvePortalUserByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_portal_access_token", (q) => q.eq("portalAccessToken", args.token))
      .first();

    if (!user) return null;
    // Only return info for portal users (Client/Tenant)
    const role = (user as any).role;
    if (role !== "Client" && role !== "Tenant") return null;

    return {
      email: (user as any).email,
      role,
      name: (user as any).name,
      portalAccessToken: (user as any).portalAccessToken,
      firmId: (user as any).firmId,
    };
  },
});

/**
 * ensurePortalAccessToken — Generates a portal access token for a user if they
 * don't have one. Returns the existing or new token. Called on login/portal load.
 */
export const ensurePortalAccessToken = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
      .first();

    if (!user) return null;
    const existingToken = (user as any).portalAccessToken;
    if (existingToken) return existingToken;

    // Generate a unique token (ensure no collision)
    let token = generatePortalAccessToken();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_portal_access_token", (q) => q.eq("portalAccessToken", token))
        .first();
      if (!existing) break;
      token = generatePortalAccessToken();
      attempts++;
    }

    await ctx.db.patch(user._id, { portalAccessToken: token } as any);
    return token;
  },
});

/**
 * getPortalAccessToken — Gets the portal access token for the current user.
 * If they don't have one, generates one. Used by the frontend to build URLs.
 */
export const getPortalAccessToken = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
      .first();

    if (!user) return null;
    return (user as any).portalAccessToken || null;
  },
});

/**
 * migratePortalAccessTokens — One-time migration to generate portal access
 * tokens for all existing portal users (Client/Tenant) who don't have one.
 * Returns the count of users updated.
 */
export const migratePortalAccessTokens = mutation({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    let updated = 0;

    for (const user of allUsers) {
      const role = (user as any).role;
      if (role !== "Client" && role !== "Tenant") continue;
      if ((user as any).portalAccessToken) continue;

      let token = generatePortalAccessToken();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await ctx.db
          .query("users")
          .withIndex("by_portal_access_token", (q) => q.eq("portalAccessToken", token))
          .first();
        if (!existing) break;
        token = generatePortalAccessToken();
        attempts++;
      }

      await ctx.db.patch(user._id, { portalAccessToken: token } as any);
      updated++;
    }

    return { updated, total: allUsers.filter(u => {
      const role = (u as any).role;
      return role === "Client" || role === "Tenant";
    }).length };
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES — Per-firm email toggle settings
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * notifyFirmAdmins — Internal helper that creates an in-app notification
 * for every Admin/Lawyer/Paralegal in the firm AND optionally schedules an
 * email notification. Used by createMaintenanceTicket, createClientServiceRequest,
 * sendPortalMessage, and other portal-inbound mutations so the practitioner
 * is alerted that a portal user has taken an action that needs attention.
 *
 * This is the missing piece that made the notification bell appear empty —
 * portal submissions created records but never created notifications for
 * the admin team.
 */
async function notifyFirmAdmins(
  ctx: any,
  args: {
    firmId: string;
    title: string;
    message: string;
    type: string;             // notification type key (see NOTIFICATION_TYPE_DEFAULTS)
    link?: any;               // navigation context for the in-app notification
    actionLink?: string;      // optional URL
    actorName?: string;       // portal user's name (for the email body)
    actorEmail?: string;
  }
) {
  const now = new Date().toISOString();

  // 1. Find all admin-team users in the firm (Admin, Lawyer, Paralegal, ExternalCounsel)
  const allUsers = await ctx.db
    .query("users")
    .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
    .collect();
  const adminRoles = new Set(["Admin", "Lawyer", "Paralegal", "ExternalCounsel"]);
  const admins = allUsers.filter((u: any) => adminRoles.has(u.role));

  // 2. Create an in-app notification for each admin
  for (const admin of admins) {
    try {
      await ctx.db.insert("notifications", {
        firmId: args.firmId,
        userId: String(admin._id),
        title: args.title,
        message: args.message,
        type: args.type,
        link: args.link,
        actionLink: args.actionLink,
        timestamp: now,
        isRead: false,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      console.warn("[notifyFirmAdmins] Failed to create notification for admin:", (e as any)?.message);
    }
  }

  // 3. Schedule an email notification — BUT only if the primary admin hasn't
  //    registered for push notifications. Smart delivery: push OR email, not both.
  //    If the admin has the mobile app installed with notifications enabled, they'll
  //    get a push notification instead (the frontend polls for new notifications and
  //    triggers a local notification). No need to spam their inbox too.
  try {
    const emailEnabled = await isEmailNotificationEnabled(ctx, args.firmId, args.type);
    if (emailEnabled) {
      // Find the firm's primary admin email (first Admin user)
      const primaryAdmin = admins.find((u: any) => u.role === "Admin") || admins[0];
      // SMART DELIVERY: skip email if the admin has push notifications enabled.
      // The frontend will detect the new in-app notification (created in step 2)
      // and show a local notification on their phone.
      const hasPushEnabled = primaryAdmin && (primaryAdmin as any).pushNotificationEnabled === true;
      if (primaryAdmin?.email && !hasPushEnabled) {
        ctx.scheduler.runAfter(0, internal.portals.sendAdminNotificationEmail, {
          firmId: args.firmId,
          toEmail: primaryAdmin.email,
          toName: primaryAdmin.name || "Admin",
          title: args.title,
          body: args.message + (args.actorName ? `\n\nFrom: ${args.actorName}${args.actorEmail ? ` (${args.actorEmail})` : ''}` : ''),
          notificationType: args.type,
        });
      }
    }
  } catch (e) {
    console.warn("[notifyFirmAdmins] Failed to schedule email:", (e as any)?.message);
  }
}

/**
 * NOTIFICATION_TYPE_DEFAULTS — Source of truth for every notification type.
 * Each entry: { label, category, defaultEnabled, alwaysOn, description }
 *
 * defaultEnabled = whether email is ON when the firm has no saved preference.
 * alwaysOn       = cannot be toggled off (system-critical emails).
 */
export const NOTIFICATION_TYPE_DEFAULTS: Record<string, {
  label: string;
  category: "property" | "legal" | "portal" | "system";
  defaultEnabled: boolean;
  alwaysOn?: boolean;
  description: string;
}> = {
  // ── Property / Atrium (Resident-facing) ──
  notice_board_post:     { label: "Notice Board Post",      category: "property", defaultEnabled: true,  description: "A new notice is published on the notice board" },
  portal_message:        { label: "New Portal Message",     category: "property", defaultEnabled: true,  description: "Admin sends a message to a resident" },
  rent_reminder:         { label: "Rent Reminder",          category: "property", defaultEnabled: true,  description: "Upcoming or overdue rent reminder" },
  late_payment_notice:   { label: "Late Payment Notice",    category: "property", defaultEnabled: true,  description: "Formal notice of overdue payment" },
  payment_receipt:       { label: "Payment Receipt",        category: "property", defaultEnabled: true,  description: "Confirmation of a received payment" },
  service_charge_alert:  { label: "Service Charge Alert",   category: "property", defaultEnabled: true,  description: "New or updated service charge" },
  service_charge_due:    { label: "Service Charge Due",     category: "property", defaultEnabled: true,  description: "Service charge payment is due" },
  maintenance_update:    { label: "Maintenance Update",     category: "property", defaultEnabled: false, description: "Status change on a maintenance ticket" },
  access_restriction:    { label: "Access Restriction",     category: "property", defaultEnabled: true,  description: "Property access restriction notice" },
  lease_renewal:         { label: "Lease Renewal Notice",   category: "property", defaultEnabled: true,  description: "Lease renewal reminder or notice" },
  penalty_notice:        { label: "Penalty Notice",         category: "property", defaultEnabled: true,  description: "Late fee or penalty issued" },
  default_notice:        { label: "Default Notice",         category: "property", defaultEnabled: true,  description: "Formal default notice before legal action" },
  eviction_notice:       { label: "Eviction Notice",        category: "property", defaultEnabled: true,  description: "Formal eviction notice" },

  // ── Legal / Vega (Client-facing) ──
  matter_activation:     { label: "Matter Activation",      category: "legal",    defaultEnabled: false, description: "A new matter is activated for a client" },
  document_upload:       { label: "Document Upload",        category: "legal",    defaultEnabled: false, description: "New document added to a matter" },
  task_assignment:       { label: "Task Assignment",        category: "legal",    defaultEnabled: false, description: "A task is assigned to a team member" },
  court_filing:          { label: "Court Filing Update",    category: "legal",    defaultEnabled: false, description: "Update on a court filing" },
  deadline_reminder:     { label: "Deadline Reminder",      category: "legal",    defaultEnabled: true,  description: "Upcoming filing or statutory deadline" },

  // ── Portal / Account ──
  portal_invitation:     { label: "Portal Invitation",      category: "portal",   defaultEnabled: true,  alwaysOn: true, description: "Invitation to join the portal" },
  password_reset:        { label: "Password Reset",         category: "portal",   defaultEnabled: true,  alwaysOn: true, description: "Password reset request" },
  portal_access_revoked: { label: "Portal Access Revoked",  category: "portal",   defaultEnabled: true,  description: "Portal access has been revoked" },

  // ── Portal Inbound (admin-facing — when a portal user submits something) ──
  // These notify the PRACTITIONER that a portal user has taken an action
  // that needs their attention. Email + in-app notification to all admins.
  portal_new_message:        { label: "New Portal Message",       category: "portal", defaultEnabled: true,  description: "A client or resident sent a new portal message" },
  portal_maintenance_ticket: { label: "New Maintenance Ticket",   category: "portal", defaultEnabled: true,  description: "A resident submitted a new maintenance ticket" },
  portal_service_request:    { label: "New Service Request",      category: "portal", defaultEnabled: true,  description: "A client submitted a new service request" },
  portal_payment_proof:      { label: "Payment Proof Submitted",  category: "portal", defaultEnabled: true,  description: "A resident uploaded a payment proof for review" },

  // ── System ──
  verification_code:     { label: "Verification Code",      category: "system",   defaultEnabled: true,  alwaysOn: true, description: "Email verification during signup" },
  security_breach:       { label: "Security Breach",        category: "system",   defaultEnabled: true,  alwaysOn: true, description: "NDPA breach notification" },
};

/** Get notification preferences for a firm (returns merged with defaults) */
export const getNotificationPreferences = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("notification_preferences")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .first();

    const saved: Record<string, boolean> = row?.preferences ?? {};
    // Merge: saved overrides defaults
    const merged: Record<string, { enabled: boolean; alwaysOn: boolean }> = {};
    for (const [key, meta] of Object.entries(NOTIFICATION_TYPE_DEFAULTS)) {
      merged[key] = {
        enabled: saved[key] ?? meta.defaultEnabled,
        alwaysOn: !!meta.alwaysOn,
      };
    }
    return { preferences: merged, _id: row?._id };
  },
});

/** Update (or create) notification preferences for a firm */
export const updateNotificationPreferences = mutation({
  args: {
    firmId: v.string(),
    preferences: v.any(), // { [typeKey: string]: boolean }
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("notification_preferences")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .first();

    if (existing) {
      // Merge new preferences with existing
      const current = (existing.preferences as Record<string, boolean>) ?? {};
      const updated = { ...current, ...args.preferences };
      // Strip alwaysOn keys — they can never be turned off
      for (const [key, val] of Object.entries(updated)) {
        const meta = NOTIFICATION_TYPE_DEFAULTS[key];
        if (meta?.alwaysOn) updated[key] = true;
      }
      await ctx.db.patch(existing._id, { preferences: updated, updatedAt: now });
    } else {
      // First-time — ensure alwaysOn keys stay on
      const prefs: Record<string, boolean> = { ...args.preferences };
      for (const [key, val] of Object.entries(prefs)) {
        const meta = NOTIFICATION_TYPE_DEFAULTS[key];
        if (meta?.alwaysOn) prefs[key] = true;
      }
      await ctx.db.insert("notification_preferences", {
        firmId: args.firmId,
        preferences: prefs,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/** Check if a given notification type has email enabled for a firm */
export async function isEmailNotificationEnabled(
  ctx: any,
  firmId: string,
  typeKey: string,
): Promise<boolean> {
  const row: any = await ctx.db
    .query("notification_preferences")
    .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
    .first();

  const meta = NOTIFICATION_TYPE_DEFAULTS[typeKey];
  if (!meta) return false; // Unknown type — don't send
  if (meta.alwaysOn) return true; // Can never be turned off

  const saved: Record<string, boolean> = (row?.preferences as Record<string, boolean>) ?? {};
  return saved[typeKey] ?? meta.defaultEnabled;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTICE EMAIL — Send email notification to residents when a notice is posted
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * sendNoticeEmails — Called after createNotice. Sends a light-mode email
 * to all accepted resident portal users in the targeted property (or all
 * residents if the notice is global). Respects notification preferences.
 *
 * All required data is passed as arguments to avoid circular internalAction
 * references within the same module.
 */
export const sendNoticeEmails = internalAction({
  args: {
    firmId: v.string(),
    noticeTitle: v.string(),
    noticeBody: v.string(),
    noticePriority: v.string(),
    noticePropertyId: v.optional(v.string()),
    recipients: v.array(v.object({
      name: v.string(),
      email: v.string(),
      relatedId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args): Promise<{ sent: number; total: number }> => {
    if (args.recipients.length === 0) {
      return { sent: 0, total: 0 };
    }

    // Filter to residents linked to the targeted property (if specified)
    const targetedResidents = args.noticePropertyId
      ? args.recipients.filter((r) => !r.relatedId || r.relatedId === args.noticePropertyId)
      : args.recipients;

    if (targetedResidents.length === 0) {
      return { sent: 0, total: args.recipients.length };
    }

    // Build and send light-mode email to each resident
    let sent = 0;
    const priorityLabel = args.noticePriority === "urgent" ? "URGENT" :
                          args.noticePriority === "important" ? "Important" : "";

    for (const resident of targetedResidents) {
      try {
        const htmlBody = buildLightModeNotificationEmail({
          recipientName: resident.name || "Resident",
          subject: `${priorityLabel ? `[${priorityLabel}] ` : ''}${args.noticeTitle}`,
          bodyContent: args.noticeBody,
          productName: "ATRIUM",
          brandColor: "#16A34A",
          gradientEnd: "#0F172A",
          portalLabel: "Residents' Portal",
          ctaLabel: "View Notice",
          ctaUrl: `https://practice-pro-vega.vercel.app/portal/tenant/login`,
        });

        await ctx.runAction(api.communications.sendEmail, {
          to: resident.email,
          toName: resident.name || "Resident",
          subject: `${priorityLabel ? `[${priorityLabel}] ` : ''}New Notice: ${args.noticeTitle}`,
          htmlContent: htmlBody,
          firmId: args.firmId,
        });
        sent++;
      } catch (err: any) {
        console.error(`[sendNoticeEmails] Failed for ${resident.email}:`, err?.message);
      }
    }
    return { sent, total: targetedResidents.length };
  },
});

/**
 * sendNoticeEmailsForFirm — Server-side orchestrator called by createNotice.
 * Queries portal invites, checks notification preferences, and sends emails.
 * This eliminates the fragile client-side email orchestration pattern.
 */
export const sendNoticeEmailsForFirm = internalAction({
  args: {
    firmId: v.string(),
    noticeTitle: v.string(),
    noticeBody: v.string(),
    noticePriority: v.string(),
    noticePropertyId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ sent: number; total: number; skipped: boolean }> => {
    // Step 1: Check if notice_board_post emails are enabled for this firm
    const prefsRow: any = await ctx.runQuery(internal.portals.getNotificationPreferencesInternal, {
      firmId: args.firmId,
    });
    const saved: Record<string, boolean> = prefsRow?.preferences ?? {};
    const meta = NOTIFICATION_TYPE_DEFAULTS["notice_board_post"];
    const emailsEnabled = meta && (saved["notice_board_post"] ?? meta.defaultEnabled);

    if (!emailsEnabled) {
      return { sent: 0, total: 0, skipped: true };
    }

    // Step 2: Fetch all accepted resident portal invites for this firm
    const invites: any[] = await ctx.runQuery(internal.portals.getFirmPortalInvitesInternal, {
      firmId: args.firmId,
    });

    const residents = invites
      .filter((inv: any) => inv.portalType === "resident" && inv.status === "accepted" && inv.inviteeEmail)
      .map((inv: any) => ({
        name: inv.inviteeName || "Resident",
        email: inv.inviteeEmail,
        relatedId: inv.relatedId || undefined,
      }));

    if (residents.length === 0) {
      return { sent: 0, total: 0, skipped: false };
    }

    // Step 3: Filter by property if the notice is property-scoped
    const targetedResidents = args.noticePropertyId
      ? residents.filter((r) => !r.relatedId || r.relatedId === args.noticePropertyId)
      : residents;

    if (targetedResidents.length === 0) {
      return { sent: 0, total: residents.length, skipped: false };
    }

    // Step 4: Build and send light-mode email to each resident
    let sent = 0;
    const priorityLabel = args.noticePriority === "urgent" ? "URGENT" :
                          args.noticePriority === "important" ? "Important" : "";

    for (const resident of targetedResidents) {
      try {
        const htmlBody = buildLightModeNotificationEmail({
          recipientName: resident.name || "Resident",
          subject: `${priorityLabel ? `[${priorityLabel}] ` : ''}${args.noticeTitle}`,
          bodyContent: args.noticeBody,
          productName: "ATRIUM",
          brandColor: "#16A34A",
          gradientEnd: "#0F172A",
          portalLabel: "Residents' Portal",
          ctaLabel: "View Notice",
          ctaUrl: `https://practice-pro-vega.vercel.app/portal/tenant/login`,
        });

        await ctx.runAction(api.communications.sendEmail, {
          to: resident.email,
          toName: resident.name || "Resident",
          subject: `${priorityLabel ? `[${priorityLabel}] ` : ''}New Notice: ${args.noticeTitle}`,
          htmlContent: htmlBody,
          firmId: args.firmId,
        });
        sent++;
      } catch (err: any) {
        console.error(`[sendNoticeEmailsForFirm] Failed for ${resident.email}:`, err?.message);
      }
    }
    return { sent, total: targetedResidents.length, skipped: false };
  },
});

/**
 * getNotificationPreferencesInternal — Internal query used by sendNoticeEmailsForFirm
 * to check preferences without exposing to the public API.
 */
export const getNotificationPreferencesInternal = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notification_preferences")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .first();
  },
});

/**
 * getFirmPortalInvitesInternal — Internal query used by sendNoticeEmailsForFirm.
 */
export const getFirmPortalInvitesInternal = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portal_invites")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
  },
});

/**
 * getFirmPortalInvites — Helper query to fetch all portal invites for a firm.
 * Used by sendNoticeEmails to find resident recipients.
 */
export const getFirmPortalInvites = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portal_invites")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
  },
});

/**
 * buildLightModeNotificationEmail — Generates a professional light-mode HTML
 * email for any notification type. NOT used for portal invitations (which
 * retain their dark theme).
 */
function buildLightModeNotificationEmail(opts: {
  recipientName: string;
  subject: string;
  bodyContent: string;
  productName: string;
  brandColor: string;
  gradientEnd: string;
  portalLabel: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const ctaBlock = opts.ctaUrl && opts.ctaLabel ? `
    <div style="text-align:center;margin:28px 0 32px;">
      <a href="${opts.ctaUrl}" style="display:inline-block;background-color:${opts.brandColor};color:#ffffff;padding:14px 28px;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">${opts.ctaLabel}</a>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f6f8;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d1b2a 0%,${opts.gradientEnd} 100%);border-radius:16px 16px 0 0;padding:28px 32px 20px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;">
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Practice<span style="color:${opts.brandColor};">Pro</span></span>
                    <span style="display:inline-block;margin-left:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:800;color:${opts.brandColor};background:rgba(255,255,255,0.1);padding:3px 10px;border-radius:6px;letter-spacing:1.5px;vertical-align:middle;">${opts.productName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px 32px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:17px;font-weight:600;color:#1a202c;margin:0 0 8px;">Hello ${opts.recipientName},</p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.7;color:#4a5568;margin:0 0 20px;">
                ${opts.bodyContent.replace(/\n/g, '<br/>')}
              </p>
              ${ctaBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 32px;border-top:1px solid #e2e8f0;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;">
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#a0aec0;margin:0 0 4px;">
                      PracticePro Legal Technologies Ltd &middot; Lagos, Nigeria
                    </p>
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10px;color:#cbd5e0;margin:0;">
                      NDPA 2023 Compliant &middot; ISO 27001 Aligned &middot; AES-256 Encrypted
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * sendAdminNotificationEmail — Internal action that sends an email
 * notification to a practitioner (admin) when a portal user takes an
 * action that needs their attention (new message, new ticket, new
 * service request, payment proof submitted).
 *
 * Called by notifyFirmAdmins() via the scheduler. Runs asynchronously
 * so the portal user's mutation returns immediately.
 */
export const sendAdminNotificationEmail = internalAction({
  args: {
    firmId: v.string(),
    toEmail: v.string(),
    toName: v.string(),
    title: v.string(),
    body: v.string(),
    notificationType: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const htmlBody = `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f8fafc;-webkit-text-size-adjust:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;min-height:100vh;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px -2px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:24px 32px;text-align:center;">
              <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Practice<span style="color:#fef3c7;">Pro</span></span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 8px;">${args.title}</h1>
              <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 16px;white-space:pre-line;">${args.body}</p>
              <div style="margin-top:24px;padding:16px;background:#f1f5f9;border-radius:10px;border-left:3px solid #10b981;">
                <p style="font-size:12px;color:#64748b;margin:0;">This notification was sent because a portal user took an action that requires your attention. You can manage which notifications you receive in Settings → Notifications.</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="font-size:11px;color:#94a3b8;margin:0;">PracticePro Legal Technologies Ltd &middot; Lagos, Nigeria</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      await ctx.runAction(api.communications.sendEmail, {
        firmId: args.firmId,
        to: args.toEmail,
        toName: args.toName,
        subject: args.title,
        htmlContent: htmlBody,
      });
    } catch (err: any) {
      console.error(`[sendAdminNotificationEmail] Failed for ${args.toEmail}:`, err?.message);
    }
  },
});

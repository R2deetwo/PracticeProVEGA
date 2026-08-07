import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ─── HELPERS ────────────────────────────────────────────────────────────────

/** Simple deterministic hash for append-only enforcement */
function makeTxHash(firmId: string, unitId: string, amount: number, timestamp: number, type: string): string {
  const raw = `${firmId}|${unitId}|${amount}|${timestamp}|${type}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = Math.imul(31, h) + raw.charCodeAt(i) | 0;
  }
  return `TX-${Math.abs(h).toString(16).toUpperCase().padStart(8, "0")}`;
}

// ─── LEDGER ─────────────────────────────────────────────────────────────────

export const addLedgerEntry = mutation({
  args: {
    firmId: v.string(),
    propertyId: v.optional(v.string()),
    unitId: v.string(),
    tenantId: v.optional(v.string()),
    amount: v.number(),
    type: v.union(v.literal("rent"), v.literal("service_charge"), v.literal("penalty"), v.literal("deposit"), v.literal("management_fee")),
    status: v.union(v.literal("pending"), v.literal("cleared"), v.literal("defaulted")),
    paymentRef: v.optional(v.string()),
    channel: v.optional(v.string()),
    description: v.optional(v.string()),
    period: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const txHash = makeTxHash(args.firmId, args.unitId, args.amount, timestamp, args.type);
    return await ctx.db.insert("ledger_entries", {
      ...args,
      timestamp,
      txHash,
    });
  },
});

export const getLedgerByFirm = query({
  args: { firmId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { firmId, limit }) => {
    const entries = await ctx.db
      .query("ledger_entries")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .order("desc")
      .take(limit ?? 100);
    return entries;
  },
});

export const getLedgerByUnit = query({
  args: { unitId: v.string() },
  handler: async (ctx, { unitId }) => {
    return await ctx.db
      .query("ledger_entries")
      .withIndex("by_unit", q => q.eq("unitId", unitId))
      .order("desc")
      .take(200);
  },
});

export const updateLedgerStatus = mutation({
  args: {
    entryId: v.id("ledger_entries"),
    status: v.union(v.literal("pending"), v.literal("cleared"), v.literal("defaulted")),
  },
  handler: async (ctx, { entryId, status }) => {
    // Only status transitions are permitted — the core record stays immutable
    await ctx.db.patch(entryId, { status });
  },
});

export const getCashFlowSummary = query({
  args: { firmId: v.string() },
  handler: async (ctx, { firmId }) => {
    const entries = await ctx.db
      .query("ledger_entries")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .collect();

    const cleared = entries.filter(e => e.status === "cleared");
    const defaulted = entries.filter(e => e.status === "defaulted");
    const pending = entries.filter(e => e.status === "pending");

    const totalIncome = cleared.reduce((s, e) => s + e.amount, 0);
    const revenueAtRisk = defaulted.reduce((s, e) => s + e.amount, 0) + pending.reduce((s, e) => s + e.amount, 0);

    // Monthly buckets for the last 6 months
    const now = new Date();
    const monthlyData: Record<string, { income: number; risk: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[key] = { income: 0, risk: 0 };
    }

    for (const e of entries) {
      const d = new Date(e.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyData[key]) {
        if (e.status === "cleared") monthlyData[key].income += e.amount;
        else monthlyData[key].risk += e.amount;
      }
    }

    return { totalIncome, revenueAtRisk, totalTransactions: entries.length, monthlyData };
  },
});

// ─── SERVICE CHARGES ────────────────────────────────────────────────────────

export const upsertServiceCharge = mutation({
  args: {
    firmId: v.string(),
    unitId: v.string(),
    tenantId: v.optional(v.string()),
    category: v.union(v.literal("Diesel"), v.literal("Security"), v.literal("Cleaning"), v.literal("Water"), v.literal("Other")),
    amount: v.number(),
    cycle: v.union(v.literal("Monthly"), v.literal("Quarterly"), v.literal("Annually")),
    nextDueDate: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find existing charge for this unit+category
    const existing = await ctx.db
      .query("service_charges")
      .withIndex("by_unit", q => q.eq("unitId", args.unitId))
      .filter(q => q.eq(q.field("category"), args.category))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, isDefaulter: false });
      return existing._id;
    }
    return await ctx.db.insert("service_charges", { ...args, isDefaulter: false });
  },
});

export const getServiceChargesByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, { firmId }) => {
    return await ctx.db
      .query("service_charges")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .collect();
  },
});

export const getDefaulters = query({
  args: { firmId: v.string() },
  handler: async (ctx, { firmId }) => {
    return await ctx.db
      .query("service_charges")
      .withIndex("by_firm_defaulter", q => q.eq("firmId", firmId).eq("isDefaulter", true))
      .collect();
  },
});

export const applyLatePenalty = mutation({
  args: {
    firmId: v.string(),
    serviceChargeId: v.id("service_charges"),
    penaltyAmount: v.number(),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, { firmId, serviceChargeId, penaltyAmount, triggeredBy }) => {
    const sc = await ctx.db.get(serviceChargeId);
    if (!sc) throw new Error("Service charge not found");
    // Mark penalty applied
    await ctx.db.patch(serviceChargeId, { penaltyApplied: true });
    // Write penalty to ledger
    const timestamp = Date.now();
    const txHash = makeTxHash(firmId, sc.unitId, penaltyAmount, timestamp, "penalty");
    await ctx.db.insert("ledger_entries", {
      firmId,
      unitId: sc.unitId,
      tenantId: sc.tenantId,
      amount: penaltyAmount,
      type: "penalty",
      status: "pending",
      timestamp,
      txHash,
      description: `Late penalty — ${sc.category} service charge`,
    });
    return { success: true };
  },
});

export const markChargeAsPaid = mutation({
  args: {
    serviceChargeId: v.id("service_charges"),
    paidAmount: v.number(),
    firmId: v.string(),
    channel: v.optional(v.string()),
    isPartialPayment: v.optional(v.boolean()),
  },
  handler: async (ctx, { serviceChargeId, paidAmount, firmId, channel, isPartialPayment }) => {
    const sc = await ctx.db.get(serviceChargeId);
    if (!sc) throw new Error("Service charge not found");

    const totalAmount = sc.amount;
    const previouslyPaid = sc.amountPaidThisCycle ?? 0;
    const newTotalPaid = previouslyPaid + paidAmount;
    const outstandingBalance = Math.max(0, totalAmount - newTotalPaid);

    // Determine new status
    let newStatus: "PAID_FULLY" | "PARTIALLY_PAID" | "UNPAID";
    if (outstandingBalance <= 0) {
      newStatus = "PAID_FULLY";
    } else if (newTotalPaid > 0) {
      newStatus = "PARTIALLY_PAID";
    } else {
      newStatus = "UNPAID";
    }

    // If fully paid, advance nextDueDate
    let nextDueDate = sc.nextDueDate;
    let isDefaulter = sc.isDefaulter;
    let daysOverdue = sc.daysOverdue;
    let penaltyApplied = sc.penaltyApplied;

    if (newStatus === "PAID_FULLY") {
      const cycleMs = sc.cycle === "Monthly" ? 30 * 86400000 : sc.cycle === "Quarterly" ? 90 * 86400000 : 365 * 86400000;
      nextDueDate = Date.now() + cycleMs;
      isDefaulter = false;
      daysOverdue = 0;
      penaltyApplied = false;
    }

    await ctx.db.patch(serviceChargeId, {
      isDefaulter,
      lastPaidDate: Date.now(),
      nextDueDate,
      penaltyApplied,
      daysOverdue,
      serviceChargeStatus: newStatus,
      outstandingBalance: newStatus === "PAID_FULLY" ? 0 : outstandingBalance,
      amountPaidThisCycle: newStatus === "PAID_FULLY" ? 0 : newTotalPaid,
      // Reset reminder tracking on any payment
      consecutiveReminderCount: 0,
      remindersPaused: false,
    });

    // Ledger entry
    const timestamp = Date.now();
    const txHash = makeTxHash(firmId, sc.unitId, paidAmount, timestamp, "service_charge");
    await ctx.db.insert("ledger_entries", {
      firmId,
      unitId: sc.unitId,
      tenantId: sc.tenantId,
      amount: paidAmount,
      type: "service_charge",
      status: newStatus === "PAID_FULLY" ? "cleared" : "pending",
      timestamp,
      txHash,
      channel,
      description: newStatus === "PAID_FULLY"
        ? `${sc.category} service charge — full payment`
        : `${sc.category} service charge — partial payment (₦${newTotalPaid.toLocaleString()} of ₦${totalAmount.toLocaleString()})`,
    });

    // ── PAID Confirmation WhatsApp Message ──
    // When a tenant is marked as fully paid by the administrator,
    // send a confirmation message acknowledging the payment.
    if (newStatus === "PAID_FULLY") {
      try {
        // Resolve tenant contact from the property/unit
        const unitDoc = await ctx.db
          .query("properties")
          .withIndex("by_custom_id", q => q.eq("id", sc.unitId))
          .first();
        const altDoc = !unitDoc ? await ctx.db
          .query("properties")
          .filter(q => q.eq(q.field("_id"), sc.unitId))
          .first() : null;
        const effectiveDoc = unitDoc || altDoc;

        if (effectiveDoc) {
          const rd = (effectiveDoc as any).rentalDetails || {};
          const tenantPhone: string = rd.tenantPhone || '';
          const tenantEmail: string = rd.tenantEmail || '';
          const tenantName: string = rd.tenantName || 'Tenant';
          const unitName: string = rd.unitName || 'Unit';
          const chargeLabel = sc.isMinimumVend ? ((effectiveDoc as any).minimumVendLabel || 'Minimum Vend') : sc.category;
          const recipient = tenantPhone || tenantEmail;

          if (recipient) {
            const confirmMessage = `Dear ${tenantName}, we confirm receipt of your ${chargeLabel} service charge payment of ₦${totalAmount.toLocaleString()} for ${unitName}. Your account is now fully settled. Thank you for your prompt payment.`;
            await ctx.db.insert("automation_logs", {
              firmId,
              unitId: sc.unitId,
              tenantId: sc.tenantId,
              messageType: "payment_receipt",
              channel: tenantPhone ? "whatsapp" : "email",
              recipient,
              messagePreview: confirmMessage,
              sentAt: Date.now(),
              status: "simulated",
              triggeredBy: "admin_mark_paid",
            });
          }
        }
      } catch (e) {
        // Non-blocking — don't fail the payment recording if confirmation fails
        console.warn("Failed to send PAID confirmation:", e);
      }
    }
  },
});

// Internal mutation called by cron job
export const flagOverdueCharges = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allCharges = await ctx.db.query("service_charges").collect();
    let flagged = 0;
    for (const charge of allCharges) {
      if (charge.nextDueDate < now && charge.serviceChargeStatus !== "PAID_FULLY") {
        const daysOverdue = Math.floor((now - charge.nextDueDate) / 86400000);
        // If no partial payment has been made, status stays UNPAID (or becomes UNPAID if not set)
        const currentStatus = charge.serviceChargeStatus || (charge.isDefaulter ? "UNPAID" : "UNPAID");
        await ctx.db.patch(charge._id, {
          isDefaulter: true,
          daysOverdue,
          // Preserve PARTIALLY_PAID if tenant has made a partial payment, otherwise UNPAID
          serviceChargeStatus: currentStatus === "PARTIALLY_PAID" ? "PARTIALLY_PAID" : "UNPAID",
          outstandingBalance: currentStatus === "PARTIALLY_PAID"
            ? (charge.outstandingBalance ?? charge.amount - (charge.amountPaidThisCycle ?? 0))
            : charge.amount,
        });
        flagged++;
      }
    }
    return { flagged };
  },
});

// ─── LEADS PIPELINE ─────────────────────────────────────────────────────────

export const addLeadToPipeline = mutation({
  args: {
    firmId: v.string(),
    unitId: v.string(),
    applicantName: v.string(),
    contactInfo: v.string(),
    stage: v.optional(v.union(v.literal("Inquiry"), v.literal("Vetted"), v.literal("Lease_Generated"), v.literal("Closed"))),
    vettingScore: v.optional(v.number()),
    proposedRent: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("leads_pipeline", {
      ...args,
      stage: args.stage ?? "Inquiry",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const advanceLeadStage = mutation({
  args: {
    leadId: v.id("leads_pipeline"),
    stage: v.union(v.literal("Inquiry"), v.literal("Vetted"), v.literal("Lease_Generated"), v.literal("Closed")),
    vettingScore: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { leadId, stage, vettingScore, notes }) => {
    await ctx.db.patch(leadId, { stage, vettingScore, notes, updatedAt: Date.now() });
  },
});

export const getPipelineByUnit = query({
  args: { unitId: v.string() },
  handler: async (ctx, { unitId }) => {
    return await ctx.db
      .query("leads_pipeline")
      .withIndex("by_unit", q => q.eq("unitId", unitId))
      .collect();
  },
});

export const getPipelineByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, { firmId }) => {
    return await ctx.db
      .query("leads_pipeline")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .collect();
  },
});

// ─── AUTOMATION LOGS ────────────────────────────────────────────────────────

export const logAutomation = mutation({
  args: {
    firmId: v.string(),
    unitId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    messageType: v.union(
      v.literal("custom"),
      v.literal("rent_reminder"),
      v.literal("late_notice"),
      v.literal("payment_receipt"),
      v.literal("service_charge_alert"),
      v.literal("access_restriction"),
      v.literal("penalty_notice"),
      v.literal("lease_renewal"),
    ),
    channel: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("sms"), v.literal("portal")),
    recipient: v.string(),
    messagePreview: v.optional(v.string()),
    messageContent: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("outbound"), v.literal("inbound"))),
    senderName: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("simulated")),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("automation_logs", { ...args, sentAt: Date.now() });
  },
});

export const getAutomationLogs = query({
  args: { firmId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { firmId, limit }) => {
    return await ctx.db
      .query("automation_logs")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .order("desc")
      .take(limit ?? 50);
  },
});

// ─── AUDIT TRAIL ────────────────────────────────────────────────────────────
// Returns merged chronological timeline of outbound (automation_logs) and
// inbound (atrium_inbound_messages) communications for a firm.

export interface AuditTrailEntry {
  _id: string;
  direction: "outbound" | "inbound";
  channel: string;
  messageType?: string;
  recipient?: string;
  senderName?: string;
  senderContact?: string;
  content: string;
  timestamp: number;
  status?: string;
  triggeredBy?: string;
  unitId?: string;
  tenantId?: string;
}

export const getAuditTrail = query({
  args: {
    firmId: v.string(),
    unitId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    channel: v.optional(v.string()),
    messageType: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { firmId, unitId, tenantId, channel, messageType, startDate, endDate, limit }) => {
    const maxLimit = limit ?? 200;

    // Fetch outbound logs
    let outboundQuery = ctx.db
      .query("automation_logs")
      .withIndex("by_firm", q => q.eq("firmId", firmId));

    let outboundLogs = await outboundQuery.order("desc").take(maxLimit);

    // Apply filters to outbound
    if (unitId) outboundLogs = outboundLogs.filter(l => l.unitId === unitId);
    if (tenantId) outboundLogs = outboundLogs.filter(l => l.tenantId === tenantId);
    if (channel) outboundLogs = outboundLogs.filter(l => l.channel === channel);
    if (messageType) outboundLogs = outboundLogs.filter(l => l.messageType === messageType);
    if (startDate) outboundLogs = outboundLogs.filter(l => l.sentAt >= startDate);
    if (endDate) outboundLogs = outboundLogs.filter(l => l.sentAt <= endDate);

    const outbound: AuditTrailEntry[] = outboundLogs.map(l => ({
      _id: l._id,
      direction: (l.direction || "outbound") as "outbound" | "inbound",
      channel: l.channel,
      messageType: l.messageType,
      recipient: l.recipient,
      senderName: l.senderName,
      content: l.messageContent || l.messagePreview || "",
      timestamp: l.sentAt,
      status: l.status,
      triggeredBy: l.triggeredBy,
      unitId: l.unitId,
      tenantId: l.tenantId,
    }));

    // Fetch inbound messages
    let inboundQuery = ctx.db
      .query("atrium_inbound_messages")
      .withIndex("by_firm", q => q.eq("firmId", firmId));

    let inboundMsgs = await inboundQuery.order("desc").take(maxLimit);

    // Apply filters to inbound
    if (unitId) inboundMsgs = inboundMsgs.filter(m => m.unitId === unitId);
    if (tenantId) inboundMsgs = inboundMsgs.filter(m => m.tenantId === tenantId);
    if (channel) inboundMsgs = inboundMsgs.filter(m => m.channel === channel);
    if (startDate) inboundMsgs = inboundMsgs.filter(m => m.receivedAt >= startDate);
    if (endDate) inboundMsgs = inboundMsgs.filter(m => m.receivedAt <= endDate);

    const inbound: AuditTrailEntry[] = inboundMsgs.map(m => ({
      _id: m._id,
      direction: "inbound" as const,
      channel: m.channel,
      senderName: m.senderName,
      senderContact: m.senderContact,
      content: m.content,
      timestamp: m.receivedAt,
      unitId: m.unitId,
      tenantId: m.tenantId,
    }));

    // Merge and sort chronologically (newest first)
    const merged = [...outbound, ...inbound].sort((a, b) => b.timestamp - a.timestamp);
    return merged.slice(0, maxLimit);
  },
});

/** Get all communications for printing — returns full detail for a specific tenant/unit */
export const getCommunicationsForPrint = query({
  args: {
    firmId: v.string(),
    unitId: v.optional(v.string()),
    tenantContact: v.optional(v.string()),
  },
  handler: async (ctx, { firmId, unitId, tenantContact }) => {
    // Outbound messages
    let outboundLogs = await ctx.db
      .query("automation_logs")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .order("asc")
      .collect();

    if (unitId) outboundLogs = outboundLogs.filter(l => l.unitId === unitId);
    if (tenantContact) outboundLogs = outboundLogs.filter(l => l.recipient === tenantContact);

    // Inbound messages
    let inboundMsgs = await ctx.db
      .query("atrium_inbound_messages")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .order("asc")
      .collect();

    if (unitId) inboundMsgs = inboundMsgs.filter(m => m.unitId === unitId);
    if (tenantContact) inboundMsgs = inboundMsgs.filter(m => m.senderContact === tenantContact);

    return {
      outbound: outboundLogs.map(l => ({
        _id: l._id,
        direction: l.direction || "outbound",
        channel: l.channel,
        messageType: l.messageType,
        recipient: l.recipient,
        senderName: l.senderName,
        content: l.messageContent || l.messagePreview || "",
        timestamp: l.sentAt,
        status: l.status,
        triggeredBy: l.triggeredBy,
        unitId: l.unitId,
        tenantId: l.tenantId,
      })),
      inbound: inboundMsgs.map(m => ({
        _id: m._id,
        direction: "inbound",
        channel: m.channel,
        senderName: m.senderName,
        senderContact: m.senderContact,
        content: m.content,
        timestamp: m.receivedAt,
        unitId: m.unitId,
        tenantId: m.tenantId,
      })),
    };
  },
});

/** Spam guard: check if a message of this type was already sent to this recipient within the last N hours */
export const checkSpamGuard = query({
  args: {
    firmId: v.string(),
    recipient: v.string(),
    messageType: v.string(),
    withinHours: v.number(),
  },
  handler: async (ctx, { firmId, recipient, messageType, withinHours }) => {
    const cutoff = Date.now() - withinHours * 3600000;
    const recent = await ctx.db
      .query("automation_logs")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .filter(q =>
        q.and(
          q.eq(q.field("recipient"), recipient),
          q.eq(q.field("messageType"), messageType),
          q.gte(q.field("sentAt"), cutoff)
        )
      )
      .first();
    return { blocked: !!recent, lastSentAt: recent?.sentAt };
  },
});

export const processInboundMessage = internalMutation({
  args: {
    senderContact: v.string(),
    senderName: v.string(),
    content: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("sms"), v.literal("email"), v.literal("portal")),
    mediaUrl: v.optional(v.string()),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Attempt to match the senderContact with a tenant
    const contacts = await ctx.db
      .query("contacts")
      .filter((q) => q.eq(q.field("phone"), args.senderContact))
      .collect();

    let firmId = "unknown";
    let tenantId = undefined;
    
    if (contacts.length > 0) {
      firmId = contacts[0].firmId ?? "unknown";
      tenantId = contacts[0]._id;
    }


    await ctx.db.insert("atrium_inbound_messages", {
      firmId,
      tenantId,
      senderContact: args.senderContact,
      senderName: args.senderName,
      content: args.content,
      channel: args.channel,
      mediaUrl: args.mediaUrl,
      mimeType: args.mimeType,
      receivedAt: Date.now(),
      isRead: false,
    });
  },
});

// ─── SERVICE CHARGE WHATSAPP REMINDERS ─────────────────────────────────────
// Scans all active tenancies with unpaid or partially-paid service charges
// and triggers automated WhatsApp reminder notifications via the integration gateway.
// Called daily by cron job "serviceChargeWhatsAppReminder" at 6:30 AM UTC.
// Dynamically includes outstanding balance for PARTIALLY_PAID tenants.
export const sendServiceChargeReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let remindersSent = 0;
    let remindersSkipped = 0;
    let remindersPausedCount = 0;

    // 1. Find all service_charges that are overdue or upcoming (nextDue within 7 days)
    const allCharges = await ctx.db.query("service_charges").collect();
    const actionableCharges = allCharges.filter(sc => {
      // Skip fully paid charges
      if (sc.serviceChargeStatus === "PAID_FULLY") return false;
      const daysUntilDue = Math.floor((sc.nextDueDate - now) / 86400000);
      // Include: currently unpaid/defaulted OR partially paid OR due within the next 7 days
      return sc.isDefaulter || sc.serviceChargeStatus === "PARTIALLY_PAID" || daysUntilDue <= 7;
    });

    // Pre-load all properties for property-level toggle checks
    const allProperties = await ctx.db.query("properties").collect();
    const propertyMap = new Map<string, any>();
    for (const p of allProperties) {
      if (p.id) propertyMap.set(p.id, p);
      if ((p as any)._id) propertyMap.set((p as any)._id, p);
      // Also index by unit IDs embedded in the property
      const units: any[] = (p as any).units || [];
      for (const u of units) {
        if (u.id) propertyMap.set(u.id, p);
      }
    }

    for (const charge of actionableCharges) {
      // ── GUARD 0: Per-unit mute toggle ──
      if (charge.remindersMuted) {
        remindersSkipped++;
        continue;
      }

      // ── GUARD 1: Cool-off — if remindersPaused, skip entirely ──
      if (charge.remindersPaused) {
        remindersPausedCount++;
        remindersSkipped++;
        continue;
      }

      // ── GUARD 2: Property-level reminders toggle ──
      const parentProperty = propertyMap.get(charge.unitId);
      if (parentProperty && parentProperty.remindersEnabled === false) {
        remindersSkipped++;
        continue;
      }

      // Resolve cool-off threshold (property-level override or default 7)
      const coolOffThreshold = parentProperty?.reminderCoolOffDays || 7;

      // ── GUARD 3: Cool-off — check consecutive reminder count ──
      const consecutiveCount = charge.consecutiveReminderCount ?? 0;
      if (consecutiveCount >= coolOffThreshold) {
        // Auto-pause: flag the unit so admin sees REMINDERS_PAUSED_MAX_EFFORT
        await ctx.db.patch(charge._id, {
          remindersPaused: true,
        });
        remindersPausedCount++;
        remindersSkipped++;
        continue;
      }

      // 2. Resolve tenant phone from the properties table
      const unitDoc = parentProperty || await ctx.db
        .query("properties")
        .withIndex("by_custom_id", q => q.eq("id", charge.unitId))
        .first();

      if (!unitDoc) {
        // Also try by Convex _id match
        const altDoc = await ctx.db
          .query("properties")
          .filter(q => q.eq(q.field("_id"), charge.unitId))
          .first();
        if (!altDoc) {
          remindersSkipped++;
          continue;
        }
      }

      const effectiveDoc = unitDoc || propertyMap.get(charge.unitId);
      if (!effectiveDoc) {
        remindersSkipped++;
        continue;
      }

      // Extract tenant contact info from rentalDetails
      const rd = (effectiveDoc as any).rentalDetails || {};
      const tenantPhone: string = rd.tenantPhone || '';
      const tenantEmail: string = rd.tenantEmail || '';
      const tenantName: string = rd.tenantName || 'Tenant';
      const unitName: string = rd.unitName || 'Unit';
      // Check if property has minimum vend enabled
      const minimumVendEnabled = (effectiveDoc as any).minimumVendEnabled || false;
      const vendLabel = charge.isMinimumVend ? ((effectiveDoc as any).minimumVendLabel || 'Minimum Vend') : null;

      if (!tenantPhone && !tenantEmail) {
        remindersSkipped++;
        continue;
      }

      // 3. Spam guard: check if we already sent a service_charge_alert in the last 24 hours
      const cutoff = now - 24 * 3600000;
      const recentAlert = await ctx.db
        .query("automation_logs")
        .withIndex("by_firm", q => q.eq("firmId", charge.firmId))
        .filter(q =>
          q.and(
            q.eq(q.field("unitId"), charge.unitId),
            q.eq(q.field("messageType"), "service_charge_alert"),
            q.gte(q.field("sentAt"), cutoff)
          )
        )
        .first();

      if (recentAlert) {
        remindersSkipped++;
        continue;
      }

      // 4. Build dynamic reminder message based on payment status
      const daysOverdue = charge.isDefaulter && charge.daysOverdue
        ? charge.daysOverdue
        : Math.max(0, Math.floor((now - charge.nextDueDate) / 86400000));
      const isUpcoming = !charge.isDefaulter && charge.nextDueDate > now;
      const dueDateStr = new Date(charge.nextDueDate).toLocaleDateString('en-NG');
      const chargeLabel = charge.isMinimumVend ? (vendLabel || 'Minimum Vend') : charge.category;

      let messagePreview: string;
      if (charge.serviceChargeStatus === "PARTIALLY_PAID") {
        // Dynamic message for partial payments — include exact outstanding balance
        const outstanding = charge.outstandingBalance ?? (charge.amount - (charge.amountPaidThisCycle ?? 0));
        messagePreview = `Dear ${tenantName}, your ${chargeLabel} service charge for ${unitName} has an outstanding balance of ₦${outstanding.toLocaleString()}. You have paid ₦${(charge.amountPaidThisCycle ?? 0).toLocaleString()} of ₦${charge.amount.toLocaleString()}. Kindly complete the payment to avoid penalties.`;
      } else if (isUpcoming) {
        messagePreview = `Dear ${tenantName}, your ${chargeLabel} service charge of ₦${charge.amount.toLocaleString()} for ${unitName} is due on ${dueDateStr}. Please ensure timely payment.`;
      } else {
        messagePreview = `Dear ${tenantName}, your ${chargeLabel} service charge of ₦${charge.amount.toLocaleString()} for ${unitName} is ${daysOverdue} day(s) overdue. Kindly make payment to avoid penalties.`;
      }

      // 5. Determine channel — prefer WhatsApp if phone available
      const channel = tenantPhone ? "whatsapp" as const : "email" as const;
      const recipient = tenantPhone || tenantEmail;

      // 6. Log the automation (simulated for now — actual WhatsApp/email dispatch
      // would integrate with Twilio/Resend here)
      await ctx.db.insert("automation_logs", {
        firmId: charge.firmId,
        unitId: charge.unitId,
        tenantId: charge.tenantId,
        messageType: "service_charge_alert",
        channel,
        recipient,
        messagePreview,
        sentAt: now,
        status: "simulated",
        triggeredBy: "cron_service_charge_reminder",
      });

      // 7. Increment consecutive reminder counter + record last reminder timestamp
      await ctx.db.patch(charge._id, {
        consecutiveReminderCount: (charge.consecutiveReminderCount ?? 0) + 1,
        lastReminderSentAt: now,
      });

      remindersSent++;
    }

    return { remindersSent, remindersSkipped, remindersPausedCount };
  },
});

export const runDailyAutomation = internalMutation({
  args: {},
  handler: async (ctx) => {
    
    // In a full implementation, we would:
    // 1. Scan properties for automationSettings.remindRentDue === true
    // 2. Cross-reference Service Charges and Rent Payments for nextDueDate
    // 3. Dispatch emails / whatsapp using Resend / Twilio
    // For now, we simulate this step and log it to automation_logs.
    
    const overdueCharges = await ctx.db
      .query("service_charges")
      .filter((q) => q.eq(q.field("isDefaulter"), true))
      .collect();
      
    for (const charge of overdueCharges) {
      if (charge.daysOverdue && charge.daysOverdue === 1) {
        // Send a simulated late notice
        await ctx.db.insert("automation_logs", {
          firmId: charge.firmId,
          unitId: charge.unitId,
          tenantId: charge.tenantId,
          messageType: "late_notice",
          channel: "whatsapp",
          recipient: "simulated_tenant",
          messagePreview: "Your service charge is overdue by 1 day.",
          sentAt: Date.now(),
          status: "simulated",
          triggeredBy: "system",
        });
      }
    }
  },
});

export const getInboundMessages = query({
  args: { firmId: v.string() },
  handler: async (ctx, { firmId }) => {
    return await ctx.db
      .query("atrium_inbound_messages")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .order("desc")
      .collect();
  },
});

export const markMessageAsRead = mutation({
  args: { messageId: v.id("atrium_inbound_messages") },
  handler: async (ctx, { messageId }) => {
    await ctx.db.patch(messageId, { isRead: true });
  },
});

export const deleteInboundMessage = mutation({
  args: { messageId: v.id("atrium_inbound_messages") },
  handler: async (ctx, { messageId }) => {
    await ctx.db.delete(messageId);
  },
});

// ─── MONTHLY SERVICE CHARGE RESET ─────────────────────────────────────────
// Resets all active service charges back to UNPAID on the 1st of every month.
// Called by cron job "monthlyServiceChargeReset" at 00:30 UTC on the 1st.
// Handles both regular service charges and minimum vend charges.
export const resetMonthlyServiceCharges = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let resetCount = 0;
    let skippedCount = 0;

    // Get all service charges
    const allCharges = await ctx.db.query("service_charges").collect();

    for (const charge of allCharges) {
      // Only reset Monthly cycle charges (Quarterly/Annual have their own cycle)
      // Also reset minimum vend charges regardless of cycle since they're monthly
      if (charge.cycle !== "Monthly" && !charge.isMinimumVend) {
        skippedCount++;
        continue;
      }

      // Skip if already reset this month (idempotency guard)
      if (charge.lastResetAt) {
        const lastReset = new Date(charge.lastResetAt);
        const currentMonth = new Date(now);
        if (lastReset.getMonth() === currentMonth.getMonth() && lastReset.getFullYear() === currentMonth.getFullYear()) {
          skippedCount++;
          continue;
        }
      }

      // Reset to UNPAID, clear cycle payment tracking
      await ctx.db.patch(charge._id, {
        serviceChargeStatus: "UNPAID",
        outstandingBalance: charge.amount,
        amountPaidThisCycle: 0,
        lastResetAt: now,
        // Recalculate nextDueDate for the new month
        nextDueDate: now + 30 * 86400000,
        // Clear defaulter status for the new cycle
        isDefaulter: false,
        daysOverdue: 0,
        penaltyApplied: false,
      });
      resetCount++;
    }

    // Also check for properties with minimumVendEnabled that might not have a service_charges record yet
    const allProperties = await ctx.db.query("properties").collect();
    const propertiesWithVend = allProperties.filter(p => p.minimumVendEnabled);

    for (const prop of propertiesWithVend) {
      // Check if a minimum vend charge already exists for each unit
      const units: any[] = (prop as any).units || [];
      const unitIds = units.length > 0
        ? units.map((u: any) => u.id || u._id)
        : [prop.id];

      for (const unitId of unitIds) {
        if (!unitId) continue;

        const existingVend = allCharges.find(c =>
          c.unitId === unitId && c.isMinimumVend
        );

        if (!existingVend) {
          // Create the minimum vend charge record
          const vendAmount = (prop as any).minimumVendAmount || 0;
          if (vendAmount > 0) {
            await ctx.db.insert("service_charges", {
              firmId: prop.firmId!,
              unitId,
              tenantId: prop.tenantId || prop.currentTenantId || undefined,
              category: "Other",
              amount: vendAmount,
              cycle: "Monthly",
              nextDueDate: now + 30 * 86400000,
              isDefaulter: false,
              isMinimumVend: true,
              serviceChargeStatus: "UNPAID",
              outstandingBalance: vendAmount,
              amountPaidThisCycle: 0,
              lastResetAt: now,
            });
            resetCount++;
          }
        }
      }
    }

    return { resetCount, skippedCount };
  },
});

// ─── REMINDER TOGGLE MUTATIONS ──────────────────────────────────────────────

/** Toggle property-level reminders on/off */
export const setPropertyRemindersEnabled = mutation({
  args: {
    propertyId: v.string(),
    remindersEnabled: v.boolean(),
    reminderCoolOffDays: v.optional(v.number()),
  },
  handler: async (ctx, { propertyId, remindersEnabled, reminderCoolOffDays }) => {
    // Find by custom id or Convex _id
    let doc = await ctx.db
      .query("properties")
      .withIndex("by_custom_id", q => q.eq("id", propertyId))
      .first();
    if (!doc) {
      const all = await ctx.db.query("properties").collect();
      doc = all.find(p => p._id === propertyId as any) || null;
    }
    if (!doc) throw new Error("Property not found");
    await ctx.db.patch(doc._id, {
      remindersEnabled,
      ...(reminderCoolOffDays !== undefined ? { reminderCoolOffDays } : {}),
    });
    return { success: true };
  },
});

/** Toggle per-unit reminder mute */
export const setUnitRemindersMuted = mutation({
  args: {
    serviceChargeId: v.id("service_charges"),
    remindersMuted: v.boolean(),
  },
  handler: async (ctx, { serviceChargeId, remindersMuted }) => {
    await ctx.db.patch(serviceChargeId, { remindersMuted });
    return { success: true };
  },
});

/** Unpause reminders for a unit (manual admin intervention after cool-off auto-pause) */
export const unpauseReminders = mutation({
  args: {
    serviceChargeId: v.id("service_charges"),
  },
  handler: async (ctx, { serviceChargeId }) => {
    await ctx.db.patch(serviceChargeId, {
      remindersPaused: false,
      consecutiveReminderCount: 0,
    });
    return { success: true };
  },
});


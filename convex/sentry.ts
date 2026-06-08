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
    type: v.union(v.literal("rent"), v.literal("service_charge"), v.literal("penalty"), v.literal("deposit")),
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
  },
  handler: async (ctx, { serviceChargeId, paidAmount, firmId, channel }) => {
    const sc = await ctx.db.get(serviceChargeId);
    if (!sc) throw new Error("Service charge not found");

    // Advance nextDueDate
    const cycleMs = sc.cycle === "Monthly" ? 30 * 86400000 : sc.cycle === "Quarterly" ? 90 * 86400000 : 365 * 86400000;
    const nextDueDate = Date.now() + cycleMs;

    await ctx.db.patch(serviceChargeId, {
      isDefaulter: false,
      lastPaidDate: Date.now(),
      nextDueDate,
      penaltyApplied: false,
      daysOverdue: 0,
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
      status: "cleared",
      timestamp,
      txHash,
      channel,
      description: `${sc.category} service charge payment`,
    });
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
      if (charge.nextDueDate < now) {
        const daysOverdue = Math.floor((now - charge.nextDueDate) / 86400000);
        await ctx.db.patch(charge._id, { isDefaulter: true, daysOverdue });
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
    channel: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("sms")),
    recipient: v.string(),
    messagePreview: v.optional(v.string()),
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
    channel: v.union(v.literal("whatsapp"), v.literal("sms"), v.literal("email")),
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
// Scans all active tenancies with unpaid service charges and triggers
// automated WhatsApp reminder notifications via the integration gateway.
// Called daily by cron job "serviceChargeWhatsAppReminder" at 6:30 AM UTC.
export const sendServiceChargeReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Running Service Charge WhatsApp Reminder scan...");
    const now = Date.now();
    let remindersSent = 0;
    let remindersSkipped = 0;

    // 1. Find all service_charges that are overdue or upcoming (nextDue within 7 days)
    const allCharges = await ctx.db.query("service_charges").collect();
    const actionableCharges = allCharges.filter(sc => {
      const daysUntilDue = Math.floor((sc.nextDueDate - now) / 86400000);
      // Include: currently unpaid/defaulted OR due within the next 7 days
      return sc.isDefaulter || daysUntilDue <= 7;
    });

    for (const charge of actionableCharges) {
      // 2. Resolve tenant phone from the properties table
      const property = await ctx.db
        .query("properties")
        .withIndex("by_custom_id", q => q.eq("id", charge.unitId))
        .first();

      // Also try by Convex _id match
      const unitDoc = property || await ctx.db
        .query("properties")
        .filter(q => q.eq(q.field("_id"), charge.unitId))
        .first();

      if (!unitDoc) {
        remindersSkipped++;
        continue;
      }

      // Extract tenant contact info from rentalDetails
      const rd = (unitDoc as any).rentalDetails || {};
      const tenantPhone: string = rd.tenantPhone || '';
      const tenantEmail: string = rd.tenantEmail || '';
      const tenantName: string = rd.tenantName || 'Tenant';
      const unitName: string = rd.unitName || 'Unit';

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

      // 4. Build reminder message
      const daysOverdue = charge.isDefaulter && charge.daysOverdue
        ? charge.daysOverdue
        : Math.max(0, Math.floor((now - charge.nextDueDate) / 86400000));
      const isUpcoming = !charge.isDefaulter && charge.nextDueDate > now;
      const dueDateStr = new Date(charge.nextDueDate).toLocaleDateString('en-NG');

      const messagePreview = isUpcoming
        ? `Dear ${tenantName}, your ${charge.category} service charge of ₦${charge.amount.toLocaleString()} for ${unitName} is due on ${dueDateStr}. Please ensure timely payment.`
        : `Dear ${tenantName}, your ${charge.category} service charge of ₦${charge.amount.toLocaleString()} for ${unitName} is ${daysOverdue} day(s) overdue. Kindly make payment to avoid penalties.`;

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

      remindersSent++;
    }

    console.log(`Service Charge Reminders: ${remindersSent} sent, ${remindersSkipped} skipped.`);
    return { remindersSent, remindersSkipped };
  },
});

export const runDailyAutomation = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Running Daily Sentry Automation Scans...");
    
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


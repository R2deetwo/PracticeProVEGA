import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "aggregateDailyMetrics", 
  { hourUTC: 0, minuteUTC: 0 }, 
  internal.analytics.aggregateDailyMetrics,
  { date: new Date().toISOString().split('T')[0] }
);

crons.daily(
  "purgeOldArchiveData",
  { hourUTC: 1, minuteUTC: 0 },
  internal.myFunctions.purgeOldArchiveData,
  {}
);

// Atrium Revenue Protection: flag overdue service charges every 6 hours
crons.interval(
  "flagOverdueServiceCharges",
  { hours: 6 },
  internal.sentry.flagOverdueCharges,
  {}
);

// Atrium Daily Automation: overdue late notices, reminders (8:00 AM WAT = 7:00 AM UTC)
crons.daily(
  "sentryDailyAutomation",
  { hourUTC: 7, minuteUTC: 0 },
  internal.sentry.runDailyAutomation,
  {}
);

// Service Charge WhatsApp Reminders: every morning at 7:30 AM WAT (6:30 UTC)
// Scans all active tenancies with unpaid service charges and triggers
// automated WhatsApp reminder notifications via the integration gateway
crons.daily(
  "serviceChargeWhatsAppReminder",
  { hourUTC: 6, minuteUTC: 30 },
  internal.sentry.sendServiceChargeReminders,
  {}
);

// Monthly Service Charge Reset: 1st of every month at 00:30 UTC (1:30 AM WAT)
// Resets all monthly service charges back to UNPAID, clears partial payment tracking,
// and auto-creates minimum vend charges for properties that have the toggle enabled.
crons.monthly(
  "monthlyServiceChargeReset",
  { day: 1, hourUTC: 0, minuteUTC: 30 },
  internal.sentry.resetMonthlyServiceCharges,
  {}
);

// Scheduled Messages Processor: every 5 minutes
// Finds scheduled messages whose delivery time has passed and processes them.
crons.interval(
  "processScheduledMessages",
  { minutes: 5 },
  internal.portals.processScheduledMessages,
  {}
);

// ─── PHASE 2: PROACTIVE INTELLIGENCE CRONS ──────────────────────────────────

// Deadline Scanner: every 6 hours
// Scans tasks, events, and service charges for upcoming & overdue deadlines.
// Creates proactive insights and in-app notifications for urgent items.
crons.interval(
  "scanDeadlines",
  { hours: 6 },
  internal.proactive.scanDeadlines,
  {}
);

// Anomaly Detector: daily at 6:00 AM UTC (7:00 AM WAT)
// Detects stalled matters, high defaulter ratios, unassigned matters,
// and unread messages. Runs before the morning briefing so anomalies
// are included in the daily briefing.
crons.daily(
  "detectAnomalies",
  { hourUTC: 6, minuteUTC: 0 },
  internal.proactive.detectAnomalies,
  {}
);

// AI Morning Briefing: daily at 6:15 AM UTC (7:15 AM WAT)
// Generates an AI-powered morning briefing for each firm summarizing
// deadlines, anomalies, revenue at risk, and suggested priorities.
// Stored as both a proactive insight and an ARIA chat conversation.
crons.daily(
  "generateMorningBriefing",
  { hourUTC: 6, minuteUTC: 15 },
  internal.proactive.generateMorningBriefing,
  {}
);

// Conversation Memory: Nightly Summarization at 11:00 PM UTC (midnight WAT)
// Compresses conversations older than 24h into structured summaries
// stored in conversation_summaries. These are injected into new ARIA
// sessions to provide cross-session continuity.
crons.daily(
  "batchSummarizeConversations",
  { hourUTC: 23, minuteUTC: 0 },
  internal.conversationMemory.batchSummarize,
  {}
);

// ─── PART 2: AUTOMATED RETAINER BILLING CRONS ──────────────────────────────
// Premium feature for Vega Growth+/Pro and Komplete firms. Scans all
// retainer-billed matters with retainerAutoBillingEnabled=true and stages
// draft invoices in invoice_outbox when nextBillingDate <= now.

// Every 30 minutes — scan matters for due retainer cycles
crons.interval(
  "scanMattersForRetainerCycle",
  { minutes: 30 },
  internal.retainerBilling.scanMattersForRetainerCycle,
  {}
);

// Every 15 minutes — advance Staged entries to Queued and trigger send
crons.interval(
  "advanceStagedRetainerOutbox",
  { minutes: 15 },
  internal.retainerBilling.advanceStagedOutbox,
  {}
);

// ─── NIGHTLY R2 BACKUP ───────────────────────────────────────────────────
// Full database export to Cloudflare R2 at 2:00 AM UTC (3:00 AM WAT).
// Exports all 72 tables, gzip-compresses, uploads to R2, and cleans up
// backups older than 30 days. If R2 env vars are not set, the backup
// silently skips (app still works). See convex/backups.ts for setup.
crons.daily(
  "nightlyR2Backup",
  { hourUTC: 2, minuteUTC: 0 },
  internal.backups.runBackup,
  {}
);

// ─── VISITOR TOKEN EXPIRY CLEANUP ────────────────────────────────────────
// Every 15 minutes, scan active visitor tokens and mark any past their
// grace period as "expired". This keeps the gatekeeper verification
// accurate and cleans up stale tokens.
crons.interval(
  "cleanupExpiredVisitorTokens",
  { minutes: 15 },
  internal.visitorManagement.cleanupExpiredTokens,
  {}
);

export default crons;

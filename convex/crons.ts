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

// Resident Wallet Auto-Deduct: daily at 6:15 AM UTC (7:15 AM WAT).
// Scans due service charges and auto-deducts from resident wallets.
// Runs BEFORE the reminder cron (6:30 UTC) so auto-deducted residents
// never receive a WhatsApp reminder for a charge already paid.
crons.daily(
  "walletAutoDeduct",
  { hourUTC: 6, minuteUTC: 15 },
  internal.wallets.processAutoDeductions,
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

// ─── EXPIRED BROADCAST CLEANUP ──────────────────────────────────────────
// Every 15 minutes, mark broadcast notifications with expiresAt in the
// past as isRead=true. This auto-removes expired maintenance notices
// and scheduled-outage banners from user dashboards without manual action.
crons.interval(
  "cleanupExpiredBroadcasts",
  { minutes: 15 },
  internal.broadcasts.cleanupExpiredBroadcasts,
  {}
);

// ─── COURT DATE REMINDERS ────────────────────────────────────────────────────
// Daily at 6:00 UTC (7:00 AM WAT). Scans matters with nextAdjournedDate
// set. For each hearing 7, 3, or 1 day(s) away, inserts a scheduled_messages
// row. The processScheduledMessages cron (every 5 min) delivers it via WhatsApp.
crons.daily(
  "courtDateReminders",
  { hourUTC: 6, minuteUTC: 0 },
  internal.proactive.sendCourtReminders,
  {}
);

// ─── MONTHLY WHATSAPP QUOTA RESET ────────────────────────────────────────────
// 1st of each month at 0:15 UTC. Resets whatsappMessagesSent to 0 for all firms.
// Fixes the bug where "per month" tier limits (100/500) were effectively lifetime
// caps because the counter was never reset.
crons.monthly(
  "monthlyWhatsAppQuotaReset",
  { day: 1, hourUTC: 0, minuteUTC: 15 },
  internal.myFunctions.resetWhatsAppQuotaMonthly,
  {}
);

// ─── TASK HALFWAY REMINDERS ──────────────────────────────────────────────────
// Every 30 minutes. Scans tasks with due dates, calculates the midpoint between
// creation and due date, and sends a reminder at the midpoint if the task isn't
// done. Also handles overdue notifications and short-task final reminders.
crons.interval(
  "scanTaskHalfwayReminders",
  { minutes: 30 },
  internal.myFunctions.scanTaskHalfwayReminders,
  {}
);

// ─── CRO AUDIT TRACK B: TRIAL EXPIRY CRON ────────────────────────────────────
// Daily at 0:05 UTC (1:05 AM WAT). Scans for firms whose trialEndsAt has
// passed and reverts them to Core. Also sends "trial ending in 4 days" and
// "trial ends tomorrow" notifications. See convex/myFunctions.ts:expireTrials.
crons.daily(
  "expireTrials",
  { hourUTC: 0, minuteUTC: 5 },
  internal.myFunctions.expireTrials,
  {}
);

// ─── LEASE EXPIRY ALERTS (ATRIUM) ────────────────────────────────────────────
// Daily at 7:00 AM UTC (8:00 AM WAT). Scans all properties for leases expiring
// within 30, 60, or 90 days. Creates a notification for the firm admin so they
// can initiate renewal proceedings before the lease lapses.
crons.daily(
  "leaseExpiryAlerts",
  { hourUTC: 7, minuteUTC: 0 },
  internal.myFunctions.scanLeaseExpiries,
  {}
);

// ─── CRO AUDIT TRACK A: PENDING SUBSCRIPTION REQUEST AUTO-REVERT ────────────
// Daily at 0:10 UTC (1:10 AM WAT). Auto-reverts any subscription request
// still in 'pending_review' status after 72 hours. Prevents stale pending
// requests from accumulating in the founder dashboard.
crons.daily(
  "expirePendingSubscriptionRequests",
  { hourUTC: 0, minuteUTC: 10 },
  internal.myFunctions.expirePendingSubscriptionRequests,
  {}
);

// ─── R12: SUBSCRIPTION DUNNING + GRACE + SOFT DOWNGRADE ─────────────────────
// Daily at 0:20 UTC (1:20 AM WAT). Drives the paid-subscription lifecycle
// from nextBillingDate: 7d/1d pre-renewal reminders, 14-day past-due grace
// (adminStatus 'past_due') with day-7 + day-13 warnings, then a SOFT
// downgrade to Core — data is never deleted, and a confirmed payment
// (activateFirmSubscription) restores the plan and resets the lifecycle.
// Decision logic: convex/dunning.ts (pure, tested in
// tests/unit/dunning.test.ts); mutations/emails: convex/myFunctions.ts.
crons.daily(
  "runSubscriptionDunning",
  { hourUTC: 0, minuteUTC: 20 },
  internal.myFunctions.runSubscriptionDunning,
  {}
);

// ─── SETUP WIZARD: COMMUNICATION SETUP REMINDER ────────────────────────────
// Daily at 8:00 AM UTC (9:00 AM WAT). Scans firms whose
// settings.communicationSetupReminderAt has passed (set 7 days after onboarding
// if the user opted into WhatsApp or Email during the Setup Wizard but hasn't
// connected credentials yet). Sends one in-app notification per missing channel,
// then clears the timestamp so we don't nag again. See
// convex/myFunctions.ts:sendCommunicationSetupReminders.
crons.daily(
  "sendCommunicationSetupReminders",
  { hourUTC: 8, minuteUTC: 0 },
  internal.myFunctions.sendCommunicationSetupReminders,
  {}
);

export default crons;

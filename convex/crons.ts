
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

export default crons;

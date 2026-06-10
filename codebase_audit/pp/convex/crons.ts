
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

export default crons;

crons.daily(
  "sentryDailyAutomation",
  { hourUTC: 7, minuteUTC: 0 }, // 8:00 AM WAT is 7:00 AM UTC
  internal.sentry.runDailyAutomation,
  {}
);

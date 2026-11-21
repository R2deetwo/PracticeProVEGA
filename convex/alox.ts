/**
 * alox.ts — ALOA X, the platform watchdog (2026-11-19).
 *
 * OWNER SPEC: "we can have aloa x that is in charge of all the other apps
 * and ensures that there are no problems." Aloa X is the supervisor layer
 * of the founder APK: every 15 minutes it sweeps EVERY surface the
 * platform runs on —
 *
 *   Backend & API     error_events (cron/webhook/action failures)
 *   Legal KB Engine   the in-Convex ingestion worker (stall / failure pileup)
 *   Financial Books   financial_reconciliation_reports (red / missed runs)
 *   Backups           backup_log (last successful export)
 *   Database          table_size_records (tables at the 5000-row cap)
 *   Security          founder-set changes, lockouts, failed-login pressure
 *   Messaging         scheduled_messages dispatch backlog
 *   Alert Reach       founder device push registration
 *
 * — and manages an alert lifecycle: a problem OPENS an `alox_alerts` row
 * and pushes to the founder's phone (notifyFounders chain, so it lands as
 * an FCM push + in-app notification), persists with re-notify cadence
 * (critical: 6h, warning: 24h), and RESOLVES with a closing push when the
 * surface turns healthy again. Problems find the founder; the founder does
 * not have to go looking.
 *
 * The same signal-gathering code powers getAloxStatus (the founder-app
 * dashboard) so what the cron checks and what the founder sees can never
 * drift apart.
 *
 * FOUNDER LOGIN PUSH ALERTS live here too: verifyLogin records every
 * login attempt on founder accounts through recordFounderLoginEvent
 * (success / failed / locked), which pushes immediately — someone typing
 * the founder password wrong anywhere in the world makes the founder's
 * phone buzz. The event feed is also the brute-force signal the watchdog
 * sweeps, and the "Recent founder logins" card on the Aloa X dashboard.
 */
import { internalMutation, internalQuery, mutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireFounder } from "./founderMetrics";
import { notifyFounders } from "./founderNotifications";
import { withCronReporting } from "./observability";

// ─── Thresholds (exported for unit tests) ──────────────────────────────────
export const ALOX_THRESHOLDS = {
  /** Backend errors in 24h that trigger a warning / critical alert. */
  BACKEND_ERRORS_WARNING: 10,
  BACKEND_ERRORS_CRITICAL: 50,
  /** Ingestion engine: no successful run for this long = stalled
   * (cron runs every 15 min — 45 min = 3 missed cycles). */
  INGESTION_STALL_MS: 45 * 60 * 1000,
  /** Failed queue rows before the engine is "failing systemically". */
  INGESTION_FAILURES_WARNING: 20,
  /** Financial reconciliation: daily cron — a report older than this
   * means the checker missed its slot. */
  RECONCILIATION_STALE_MS: 36 * 60 * 60 * 1000,
  /** Backups: nightly at 02:00 UTC — tolerate 30h before warning. */
  BACKUP_STALE_WARNING_MS: 30 * 60 * 60 * 1000,
  BACKUP_STALE_CRITICAL_MS: 7 * 24 * 60 * 60 * 1000,
  /** Scheduled messages: past-due unsent rows before alerting. */
  MESSAGING_BACKLOG_WARNING: 20,
  MESSAGING_BACKLOG_CRITICAL: 100,
  /** A scheduled message is "backlog" once past due by this much. */
  MESSAGING_BACKLOG_GRACE_MS: 60 * 60 * 1000,
  /** Failed founder logins in 24h = sustained brute force. */
  FOUNDER_LOGIN_FAILURES_WARNING: 10,
  /** Login-attempt push dedup window (bursts collapse to one push). */
  LOGIN_PUSH_DEDUP_MS: 15 * 60 * 1000,
  /** Re-notify cadence for a still-open alert, by severity. */
  RENOTIFY_CRITICAL_MS: 6 * 60 * 60 * 1000,
  RENOTIFY_WARNING_MS: 24 * 60 * 60 * 1000,
  /** Only push "resolved" if the alert had been open at least this long
   * (suppresses push spam from flapping checks). */
  RESOLVE_PUSH_MIN_AGE_MS: 60 * 60 * 1000,
  /** Retention. */
  LOGIN_EVENT_RETENTION_MS: 90 * 24 * 60 * 60 * 1000,
  RESOLVED_ALERT_RETENTION_MS: 30 * 24 * 60 * 60 * 1000,
} as const;

// ─── Check outcomes (pure — unit-tested) ───────────────────────────────────
export interface CheckOutcome {
  checkKey: string;
  surface: string;
  status: "ok" | "problem" | "info";
  severity?: "critical" | "warning";
  title?: string;
  detail?: string;
}

const ok = (checkKey: string, surface: string): CheckOutcome =>
  ({ checkKey, surface, status: "ok" });

/** Informational outcome — NOT an alert. Used when a surface is
 * deliberately not configured (e.g. no backup targets): the dashboard
 * shows an honest "not configured" state instead of a false alarm or a
 * reassuring green dot. Never opens/re-notifies an alert; resolves any
 * alert previously open for the same checkKey. */
const info = (checkKey: string, surface: string, title: string, detail: string): CheckOutcome =>
  ({ checkKey, surface, status: "info", title, detail });

export function evaluateBackendErrors(errors24h: number): CheckOutcome {
  if (errors24h >= ALOX_THRESHOLDS.BACKEND_ERRORS_CRITICAL) {
    return {
      checkKey: "backend.errors", surface: "Backend & API", status: "problem",
      severity: "critical",
      title: `${errors24h} backend errors in 24h`,
      detail: `The backend captured ${errors24h} error events in the last 24 hours (crons, webhooks or actions failing). Open System Status for the exact failures and stack traces.`,
    };
  }
  if (errors24h >= ALOX_THRESHOLDS.BACKEND_ERRORS_WARNING) {
    return {
      checkKey: "backend.errors", surface: "Backend & API", status: "problem",
      severity: "warning",
      title: `${errors24h} backend errors in 24h`,
      detail: `The backend captured ${errors24h} error events in the last 24 hours. Worth a look — System Status lists each one with its stack trace.`,
    };
  }
  return ok("backend.errors", "Backend & API");
}

export function evaluateIngestion(
  enabled: boolean,
  lastRunAt: number | null | undefined,
  now: number
): CheckOutcome {
  if (!enabled) return ok("ingestion.stalled", "Legal KB Engine");
  const age = lastRunAt ? now - lastRunAt : Number.POSITIVE_INFINITY;
  if (age > ALOX_THRESHOLDS.INGESTION_STALL_MS) {
    const stallMin = lastRunAt ? Math.round(age / 60000) : 0;
    return {
      checkKey: "ingestion.stalled", surface: "Legal KB Engine", status: "problem",
      severity: "critical",
      title: "Legal KB engine stalled",
      detail: lastRunAt
        ? `The ingestion engine is ON but has not completed a run in ${stallMin} minutes (expected every 15). Check the Ingestion view.`
        : "The ingestion engine is ON but has never completed a run. The 15-minute worker cron may not be firing.",
    };
  }
  return ok("ingestion.stalled", "Legal KB Engine");
}

export function evaluateIngestionFailures(failedCount: number): CheckOutcome {
  if (failedCount >= ALOX_THRESHOLDS.INGESTION_FAILURES_WARNING) {
    return {
      checkKey: "ingestion.failures", surface: "Legal KB Engine", status: "problem",
      severity: "warning",
      title: `${failedCount} failed ingestion tasks`,
      detail: `${failedCount} queue rows have failed (dead links, blocks or parser errors). Some failures are normal; a pile means a source is systematically broken.`,
    };
  }
  return ok("ingestion.failures", "Legal KB Engine");
}

export function evaluateReconciliation(
  latest: { ranAt: number; ok: boolean } | null,
  now: number
): CheckOutcome {
  if (!latest) {
    return {
      checkKey: "finance.reconciliation", surface: "Financial Books", status: "problem",
      severity: "warning",
      title: "Financial reconciliation has never run",
      detail: "No financial_reconciliation_reports row exists. The daily 07:15 UTC checker has never recorded a run on this deployment.",
    };
  }
  if (now - latest.ranAt > ALOX_THRESHOLDS.RECONCILIATION_STALE_MS) {
    return {
      checkKey: "finance.reconciliation", surface: "Financial Books", status: "problem",
      severity: "warning",
      title: "Financial reconciliation is stale",
      detail: `The last reconciliation report is ${Math.round((now - latest.ranAt) / 3600000)}h old (daily expected). The 07:15 UTC cron may have missed runs.`,
    };
  }
  if (!latest.ok) {
    return {
      checkKey: "finance.reconciliation", surface: "Financial Books", status: "problem",
      severity: "critical",
      title: "Financial reconciliation FAILED",
      detail: "The latest reconciliation report is RED — money movements do not balance against the ledger. Open Financials → Reconciliation.",
    };
  }
  return ok("finance.reconciliation", "Financial Books");
}

/**
 * Backups check (2026-11-22 clarity fix — founder bug report).
 *
 * THE PIPELINE (audited): crons.ts `nightlyR2Backup` fires daily at 02:00
 * UTC → convex/backups.ts runBackup exports EVERY table (see ALL_TABLES)
 * as one gzip'd JSON → uploads to GitHub (GITHUB_BACKUP_* env vars) and
 * Telegram (TELEGRAM_* env vars) → writes a backup_log row per target →
 * 30-day retention cleanup. If NO target env vars are set the job exits
 * with NO_TARGETS_CONFIGURED and writes nothing — which used to read as
 * "the nightly backup has never completed", a false alarm.
 *
 * The check now distinguishes the three real states:
 *   1. NOT CONFIGURED (no target env vars) → INFO, no alert. The pipeline
 *      exists but has nowhere to send data; the dashboard says exactly
 *      that and points at the Runbook.
 *   2. CONFIGURED but never succeeded → WARNING (real: data unprotected
 *      AND the job is failing).
 *   3. CONFIGURED + stale success → the old warning/critical ladder.
 */
export function evaluateBackups(
  lastSuccessAt: number | null,
  now: number,
  targetsConfigured?: string[]
): CheckOutcome {
  // Explicit empty array = probed and NOTHING is configured → info.
  // undefined = legacy caller that only knows the success timestamp (a
  // recorded success implies a target existed) → the classic ladder.
  if (targetsConfigured !== undefined && targetsConfigured.length === 0) {
    return info(
      "backups.stale",
      "Backups",
      "Backups not configured",
      "The nightly 02:00 UTC export job exists (every table, gzip) but no upload target is configured — set GITHUB_BACKUP_* or TELEGRAM_* env vars (see RUNBOOK.md → Backups). Until then this check stays quiet instead of crying wolf."
    );
  }
  if (lastSuccessAt === null) {
    return {
      checkKey: "backups.stale", surface: "Backups", status: "problem",
      severity: "warning",
      title: "Backup never succeeded",
      detail: `Targets are configured (${(targetsConfigured ?? ["github/telegram"]).join(" + ")}) but no backup has ever completed. The 02:00 UTC job is failing — check its error log and target credentials.`,
    };
  }
  const age = now - lastSuccessAt;
  if (age > ALOX_THRESHOLDS.BACKUP_STALE_CRITICAL_MS) {
    return {
      checkKey: "backups.stale", surface: "Backups", status: "problem",
      severity: "critical",
      title: `Last backup ${Math.floor(age / 86400000)} days ago`,
      detail: "The nightly backup has not succeeded in over a week. Backups are the only recovery path for catastrophic data loss.",
    };
  }
  if (age > ALOX_THRESHOLDS.BACKUP_STALE_WARNING_MS) {
    return {
      checkKey: "backups.stale", surface: "Backups", status: "problem",
      severity: "warning",
      title: `Last backup ${Math.round(age / 3600000)}h ago`,
      detail: "The nightly backup is late (expected daily at 02:00 UTC).",
    };
  }
  return ok("backups.stale", "Backups");
}

export function evaluateDbCapacity(
  sizes: Array<{ table: string; rowCount: number; capped: boolean }> | null | undefined
): CheckOutcome {
  if (!sizes || sizes.length === 0) return ok("db.capacity", "Database");
  const capped = sizes.filter((s) => s.capped);
  if (capped.length > 0) {
    return {
      checkKey: "db.capacity", surface: "Database", status: "problem",
      severity: "warning",
      title: `${capped.length} table${capped.length === 1 ? "" : "s"} at the 5000-row observability cap`,
      detail: `${capped.map((s) => s.table).join(", ")} reached the monitoring count cap — growth is outpacing the bounded reads. Check Export CSV / table trends.`,
    };
  }
  return ok("db.capacity", "Database");
}

export function evaluateFounderCount(count: number): CheckOutcome {
  if (count === 0) {
    return {
      checkKey: "security.founder_count", surface: "Security", status: "problem",
      severity: "critical",
      title: "No founder account exists",
      detail: "Zero users have role=Founder. Nobody can administer the platform. If an account was deactivated or its role changed, restore it from the Convex dashboard.",
    };
  }
  // 2026-11-20 owner review: a steady state of 2+ founders is NO LONGER a
  // standing critical alert — the owner may legitimately keep more than one
  // founder account ("we keep both accounts and that can be an okay
  // thing"), and the old check nagged with a re-notify push every 6 hours
  // forever. The escalation tripwire moved to computeFounderSetChange +
  // the security.founder_set sweep outcome below: a ONE-SHOT critical alert
  // the instant an account is ADDED to or REMOVED from the founder set —
  // which is the actual attack signal (a role changed by hand) — while an
  // intentional, stable multi-founder lineup stays quiet.
  return ok("security.founder_count", "Security");
}

/**
 * Founder-set change detection (2026-11-20) — the replacement for the
 * "expected exactly 1 founder" standing alert.
 *
 * The watchdog persists the founder email set it saw last sweep
 * (alox_state.founderBaseline) and compares it against the live set every
 * 15 minutes. Any addition or removal fires ONE immediate critical alert
 * (security.founder_set) naming the accounts that appeared/disappeared;
 * the baseline is then updated, so the alert opens with its push and
 * quietly resolves on the next sweep (it is an EVENT, not a state —
 * nothing re-notifies). First run after upgrade adopts the current set
 * silently (the pre-existing multi-founder state is already known to the
 * owner — the old alert covered it and resolves with one closing push).
 *
 * Case-insensitive on emails (role changes sometimes flip casing).
 */
export function computeFounderSetChange(
  current: string[],
  baseline: string[] | null | undefined
): { added: string[]; removed: string[] } | null {
  if (!baseline) return null; // first run — adopt silently
  const cur = new Set(current.map((e) => e.toLowerCase().trim()));
  const base = new Set(baseline.map((e) => e.toLowerCase().trim()));
  const added = current.filter((e) => !base.has(e.toLowerCase().trim()));
  const removed = baseline.filter((e) => !cur.has(e.toLowerCase().trim()));
  if (added.length === 0 && removed.length === 0) return null;
  return { added, removed };
}

export function evaluateFounderSecurity(
  founders: Array<{ email: string; lockedUntil?: number | null; failedLoginAttempts?: number | null }>,
  now: number
): CheckOutcome {
  const locked = founders.filter((f) => f.lockedUntil && f.lockedUntil > now);
  if (locked.length > 0) {
    return {
      checkKey: "security.founder_lock", surface: "Security", status: "problem",
      severity: "critical",
      title: "Founder account LOCKED",
      detail: `${locked.map((f) => f.email).join(", ")} is locked out after too many failed login attempts (15-minute cool-down). If this was not you, someone is trying your password.`,
    };
  }
  const pressured = founders.filter((f) => (f.failedLoginAttempts || 0) >= 3);
  if (pressured.length > 0) {
    return {
      checkKey: "security.founder_lock", surface: "Security", status: "problem",
      severity: "warning",
      title: "Failed login attempts on founder account",
      detail: `${pressured.map((f) => f.email).join(", ")} has ${pressured[0].failedLoginAttempts} consecutive failed attempts (lockout at 5).`,
    };
  }
  return ok("security.founder_lock", "Security");
}

export function evaluateFounderBruteforce(failedEvents24h: number): CheckOutcome {
  if (failedEvents24h >= ALOX_THRESHOLDS.FOUNDER_LOGIN_FAILURES_WARNING) {
    return {
      checkKey: "security.founder_bruteforce", surface: "Security", status: "problem",
      severity: "warning",
      title: `${failedEvents24h} failed founder logins in 24h`,
      detail: "Sustained failed login attempts on the founder account. Each individual burst also pushes an alert — check Recent founder logins for the pattern.",
    };
  }
  return ok("security.founder_bruteforce", "Security");
}

export function evaluateMessagingBacklog(backlog: number): CheckOutcome {
  if (backlog >= ALOX_THRESHOLDS.MESSAGING_BACKLOG_CRITICAL) {
    return {
      checkKey: "messaging.backlog", surface: "Messaging", status: "problem",
      severity: "critical",
      title: `${backlog} scheduled messages overdue`,
      detail: "The 5-minute message dispatcher is not keeping up (or has stopped). Court reminders, rent notices and automation messages are queueing undelivered.",
    };
  }
  if (backlog >= ALOX_THRESHOLDS.MESSAGING_BACKLOG_WARNING) {
    return {
      checkKey: "messaging.backlog", surface: "Messaging", status: "problem",
      severity: "warning",
      title: `${backlog} scheduled messages overdue`,
      detail: "Past-due scheduled messages are piling up. The dispatcher cron may be erroring.",
    };
  }
  return ok("messaging.backlog", "Messaging");
}

export function evaluatePushReachability(
  founderCount: number,
  foundersWithActiveTokens: number
): CheckOutcome {
  if (founderCount > 0 && foundersWithActiveTokens === 0) {
    return {
      checkKey: "alerts.push_unreachable", surface: "Alert Reach", status: "problem",
      severity: "critical",
      title: "Aloa X cannot reach your phone",
      detail: "No founder device has an active push token. Every watchdog and login alert would be silent. Open the founder APK once and check Settings → notifications are enabled.",
    };
  }
  return ok("alerts.push_unreachable", "Alert Reach");
}

/** Re-notify gate for a still-open alert (pure). */
export function shouldRenotify(
  alert: { severity: string; lastNotifiedAt: number },
  now: number
): boolean {
  const cadence =
    alert.severity === "critical"
      ? ALOX_THRESHOLDS.RENOTIFY_CRITICAL_MS
      : ALOX_THRESHOLDS.RENOTIFY_WARNING_MS;
  return now - alert.lastNotifiedAt >= cadence;
}

// ─── Signal gathering (shared by the cron + the dashboard query) ───────────
async function gatherSignals(ctx: any, now: number) {
  const day24h = now - 24 * 60 * 60 * 1000;
  const week7d = now - 7 * 24 * 60 * 60 * 1000;

  // Backend errors (error_events — server-side truth).
  const errors24hRows = await ctx.db
    .query("error_events")
    .withIndex("by_timestamp", (q: any) => q.gte("timestamp", day24h))
    .take(600);
  const errors7dRows = await ctx.db
    .query("error_events")
    .withIndex("by_timestamp", (q: any) => q.gte("timestamp", week7d))
    .take(600);

  // Legal KB engine.
  const engine: any = await ctx.db.query("legal_engine_state").first();
  const failedRows = await ctx.db
    .query("legal_scrape_queue")
    .withIndex("by_status_priority", (q: any) => q.eq("status", "failed"))
    .take(300);
  const queuedRows = await ctx.db
    .query("legal_scrape_queue")
    .withIndex("by_status_priority", (q: any) => q.eq("status", "queued"))
    .take(1000);
  const inProgressRows = await ctx.db
    .query("legal_scrape_queue")
    .withIndex("by_status_priority", (q: any) => q.eq("status", "in_progress"))
    .take(100);
  // 2026-11-22: real operational telemetry (the founder bug report asked
  // why the card showed a bare "On") — completed count + the last run's
  // outcome mix (pdfDeferred etc.) so the card reads like a status page.
  const completedRows = await ctx.db
    .query("legal_scrape_queue")
    .withIndex("by_status_priority", (q: any) => q.eq("status", "completed"))
    .take(1000);
  const judgmentsCount = (await ctx.db.query("legal_judgments").take(1000)).length;
  const instrumentsCount = (await ctx.db.query("legal_instruments").take(1000)).length;
  const chunksRows = await ctx.db.query("legal_chunks").take(1000);
  const chunksEmbedded = chunksRows.filter(
    (c: any) => Array.isArray(c.embedding) && c.embedding.length > 0
  ).length;

  // Financial reconciliation.
  const latestReport: any = await ctx.db
    .query("financial_reconciliation_reports")
    .withIndex("by_ran_at", (q: any) => q.gte("ranAt", 0))
    .order("desc")
    .take(1);

  // Backups (createdAt is an ISO string — newest last via by_created desc).
  const backupRows = await ctx.db
    .query("backup_log")
    .withIndex("by_created", (q: any) => q.gte("createdAt", ""))
    .order("desc")
    .take(30);
  const lastBackup = backupRows.find((b: any) => b.success === true);
  const lastBackupAt = lastBackup ? Date.parse(String(lastBackup.createdAt)) : null;

  // 2026-11-22: WHICH upload targets are configured? The nightly job
  // silently no-ops without them (runBackup → NO_TARGETS_CONFIGURED) —
  // the watchdog must distinguish "not configured" (info, no alert)
  // from "configured but failing" (real warning). Env vars are readable
  // from queries in the Convex runtime.
  const backupTargetsConfigured: string[] = [];
  if (process.env.GITHUB_BACKUP_TOKEN && process.env.GITHUB_BACKUP_OWNER && process.env.GITHUB_BACKUP_REPO) {
    backupTargetsConfigured.push("github");
  }
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BACKUP_CHAT_ID) {
    backupTargetsConfigured.push("telegram");
  }

  // DB capacity (latest weekly recording).
  const sizeRecord: any = await ctx.db
    .query("table_size_records")
    .withIndex("by_recorded_at", (q: any) => q.gte("recordedAt", ""))
    .order("desc")
    .take(1);
  const sizes = sizeRecord[0]?.sizes ?? null;
  const topTables = sizes
    ? [...sizes].sort((a: any, b: any) => b.rowCount - a.rowCount).slice(0, 5)
    : [];

  // Founders + their devices + sessions.
  const founders: any[] = await ctx.db
    .query("users")
    .filter((q: any) => q.eq(q.field("role"), "Founder"))
    .take(2000);
  let foundersWithTokens = 0;
  const founderDetails: Array<{
    email: string; name: string; activeTokens: number;
    activeSessions: number; lockedUntil: number | null; failedLoginAttempts: number;
  }> = [];
  for (const f of founders) {
    const tokens = await ctx.db
      .query("user_push_tokens")
      .withIndex("by_user_active", (q: any) =>
        q.eq("userId", String(f._id)).eq("isActive", true)
      )
      .take(20);
    if (tokens.length > 0) foundersWithTokens++;
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q: any) => q.eq("userId", f._id))
      .order("desc")
      .take(25);
    const activeSessions = sessions.filter(
      (s: any) => s.revokedAt == null && s.expiresAt > now
    );
    founderDetails.push({
      email: String(f.email || ""),
      name: String(f.name || ""),
      activeTokens: tokens.length,
      activeSessions: activeSessions.length,
      lockedUntil: f.lockedUntil ?? null,
      failedLoginAttempts: f.failedLoginAttempts ?? 0,
    });
  }

  // Founder login events (the push-alert audit feed).
  const failedLogins24hRows = await ctx.db
    .query("founder_login_events")
    .withIndex("by_event_created", (q: any) =>
      q.eq("event", "failed").gte("createdAt", day24h)
    )
    .take(200);
  const recentLogins = await ctx.db
    .query("founder_login_events")
    .order("desc")
    .take(20);

  // Messaging backlog: past-due unsent scheduled messages.
  const scheduledRows = await ctx.db
    .query("scheduled_messages")
    .withIndex("by_status", (q: any) => q.eq("status", "scheduled"))
    .take(500);
  const backlogCutoff = now - ALOX_THRESHOLDS.MESSAGING_BACKLOG_GRACE_MS;
  const backlog = scheduledRows.filter(
    (m: any) => typeof m.scheduledFor === "number" && m.scheduledFor < backlogCutoff
  ).length;

  return {
    backend: {
      errors24h: errors24hRows.length,
      errors7d: errors7dRows.length,
    },
    ingestion: {
      enabled: engine?.enabled === true,
      lastRunAt: engine?.lastRunAt ?? null,
      lastRunSummary: engine?.lastRunSummary ?? null,
      runsCount: engine?.runsCount ?? 0,
      failed: failedRows.length,
      queued: queuedRows.length,
      inProgress: inProgressRows.length,
      completed: completedRows.length,
      corpus: {
        judgments: judgmentsCount,
        instruments: instrumentsCount,
        chunks: chunksRows.length,
        chunksEmbedded,
      },
    },
    finance: latestReport[0]
      ? {
          ranAt: latestReport[0].ranAt,
          ok: latestReport[0].ok === true,
          unmatchedSettledProofs: latestReport[0].unmatchedSettledProofs ?? 0,
          creditsWaiting: latestReport[0].creditsWaiting ?? 0,
        }
      : null,
    backups: {
      lastSuccessAt: lastBackupAt,
      target: lastBackup?.target ?? null,
      targetsConfigured: backupTargetsConfigured,
    },
    db: { topTables, recordedAt: sizeRecord[0]?.recordedAt ?? null },
    security: {
      founderCount: founders.length,
      founders: founderDetails,
      failedLogins24h: failedLogins24hRows.length,
    },
    messaging: { backlog },
    push: { foundersWithActiveTokens: foundersWithTokens },
    recentLogins: recentLogins.map((e: any) => ({
      email: e.email, event: e.event, clientHint: e.clientHint ?? null,
      attemptsRemaining: e.attemptsRemaining ?? null, createdAt: e.createdAt,
    })),
  };
}

type Signals = Awaited<ReturnType<typeof gatherSignals>>;

/** Evaluate all checks from a gathered signal set (pure, unit-tested). */
export function evaluateAllChecks(signals: Signals, now: number): CheckOutcome[] {
  return [
    evaluateBackendErrors(signals.backend.errors24h),
    evaluateIngestion(signals.ingestion.enabled, signals.ingestion.lastRunAt, now),
    evaluateIngestionFailures(signals.ingestion.failed),
    evaluateReconciliation(signals.finance ? { ranAt: signals.finance.ranAt, ok: signals.finance.ok } : null, now),
    evaluateBackups(signals.backups.lastSuccessAt, now, signals.backups.targetsConfigured ?? []),
    evaluateDbCapacity(signals.db.topTables.length > 0 ? signals.db.topTables.map((t: any) => ({ table: t.table, rowCount: t.rowCount, capped: t.capped })) : null),
    evaluateFounderCount(signals.security.founderCount),
    evaluateFounderSecurity(
      signals.security.founders.map((f) => ({
        email: f.email, lockedUntil: f.lockedUntil, failedLoginAttempts: f.failedLoginAttempts,
      })),
      now
    ),
    evaluateFounderBruteforce(signals.security.failedLogins24h),
    evaluateMessagingBacklog(signals.messaging.backlog),
    evaluatePushReachability(signals.security.founderCount, signals.push.foundersWithActiveTokens),
  ];
}

// ─── The watchdog sweep ─────────────────────────────────────────────────────
export const runAloxWatchdog = internalMutation({
  args: {},
  handler: withCronReporting("crons:aloxWatchdog", async (ctx) => {
    const startedAt = Date.now();
    const now = startedAt;
    const signals = await gatherSignals(ctx, now);
    const outcomes = evaluateAllChecks(signals, now);

    // ── Founder-set change detection (2026-11-20) ──
    // Replaces the old "expected exactly 1 founder" standing alert. The
    // founder emails live in alox_state.founderBaseline; any add/remove
    // against it becomes a ONE-SHOT critical security.founder_set outcome
    // (opens with a push this sweep, quietly resolves next sweep — an
    // event, not a state). First run (no baseline) adopts silently.
    const founderEmails = Array.from(
      new Set(
        signals.security.founders
          .map((f) => String(f.email || "").toLowerCase().trim())
          .filter((e) => e.length > 0)
      )
    ).sort();
    const stateRow: any = await ctx.db.query("alox_state").first();
    const founderSetChange = computeFounderSetChange(
      founderEmails,
      stateRow?.founderBaseline ?? null
    );
    if (founderSetChange) {
      const parts: string[] = [];
      if (founderSetChange.added.length > 0) {
        parts.push(`ADDED: ${founderSetChange.added.join(", ")}`);
      }
      if (founderSetChange.removed.length > 0) {
        parts.push(`REMOVED: ${founderSetChange.removed.join(", ")}`);
      }
      outcomes.push({
        checkKey: "security.founder_set",
        surface: "Security",
        status: "problem",
        severity: "critical",
        title: "Founder accounts changed",
        detail:
          `The founder account set changed since the last sweep — ${parts.join(" · ")}. ` +
          "Founder signup is closed, so this means a role was changed by hand (Convex dashboard) " +
          "or an account was deactivated. If this was not you, investigate immediately.",
      });
    }

    // Existing OPEN alerts by checkKey.
    const openAlerts: any[] = await ctx.db
      .query("alox_alerts")
      .withIndex("by_status", (q: any) => q.eq("status", "open"))
      .take(200);
    const openByKey = new Map(openAlerts.map((a: any) => [a.checkKey, a]));

    // 2026-11-22 (founder bug report): "clicking a warning/alert should
    // take me to the exact error details, not a dead screen." The push
    // link now routes by surface — backend errors land on System Status
    // (the unified error_events log with stack traces), ingestion alerts
    // land on the Ingestion console, everything else on the Aloa X
    // control room. The founder app's VIEW_MAP resolves these.
    const linkViewFor = (checkKey: string): string => {
      if (checkKey.startsWith("backend.")) return "system";
      if (checkKey.startsWith("ingestion.")) return "ingestion";
      return "aloax";
    };

    const summary: Array<{ checkKey: string; status: string; severity?: string; title?: string }> = [];
    let openCount = 0;

    for (const outcome of outcomes) {
      const existing = openByKey.get(outcome.checkKey);
      if (outcome.status === "problem") {
        openCount++;
        summary.push({ checkKey: outcome.checkKey, status: "problem", severity: outcome.severity, title: outcome.title });
        if (!existing) {
          // OPEN a new alert + immediate push.
          await ctx.db.insert("alox_alerts", {
            checkKey: outcome.checkKey,
            severity: outcome.severity || "warning",
            surface: outcome.surface,
            title: outcome.title || outcome.checkKey,
            detail: outcome.detail || "",
            status: "open",
            firstSeenAt: now,
            lastSeenAt: now,
            lastNotifiedAt: now,
            resolvedAt: null,
            notifyCount: 1,
          });
          try {
            await notifyFounders(ctx, {
              title: `Aloa X: ${outcome.title}`,
              message: outcome.detail || "",
              type: "alox_alert",
              link: { view: linkViewFor(outcome.checkKey), id: null, context: { checkKey: outcome.checkKey } },
              tag: `alox-${outcome.checkKey}`,
            });
          } catch (e: any) {
            console.warn("[alox] open-notify failed:", e?.message || e);
          }
        } else {
          // Still open: refresh detail; re-notify on cadence (or if it worsened).
          const worsened =
            outcome.severity === "critical" && existing.severity !== "critical";
          const renotify = worsened || shouldRenotify(existing, now);
          await ctx.db.patch(existing._id, {
            severity: outcome.severity || existing.severity,
            title: outcome.title || existing.title,
            detail: outcome.detail || existing.detail,
            lastSeenAt: now,
            ...(renotify
              ? { lastNotifiedAt: now, notifyCount: (existing.notifyCount || 1) + 1 }
              : {}),
          });
          if (renotify) {
            try {
              await notifyFounders(ctx, {
                title: `Aloa X: ${outcome.title}${existing.notifyCount > 1 ? " (still open)" : ""}`,
                message: outcome.detail || "",
                type: "alox_alert",
                link: { view: linkViewFor(outcome.checkKey), id: null, context: { checkKey: outcome.checkKey } },
                tag: `alox-${outcome.checkKey}`,
              });
            } catch (e: any) {
              console.warn("[alox] renotify failed:", e?.message || e);
            }
          }
        }
      } else {
        // ok OR info: no alert lifecycle beyond resolving anything that was
        // open for this checkKey (e.g. backup targets were just configured,
        // or the previously-failing check turned healthy).
        summary.push({ checkKey: outcome.checkKey, status: outcome.status });
        if (existing) {
          // Healthy again → resolve (+ closing push if it was open long enough).
          await ctx.db.patch(existing._id, {
            status: "resolved",
            resolvedAt: now,
            lastSeenAt: now,
          });
          const wasOpenLong =
            now - existing.firstSeenAt >= ALOX_THRESHOLDS.RESOLVE_PUSH_MIN_AGE_MS;
          if (wasOpenLong) {
            try {
              await notifyFounders(ctx, {
                title: `Aloa X: resolved — ${existing.title}`,
                message: `"${existing.title}" has cleared. The surface is healthy again.`,
                type: "alox_resolved",
                link: { view: "aloax", id: null, context: { checkKey: outcome.checkKey } },
                tag: `alox-${outcome.checkKey}`,
              });
            } catch (e: any) {
              console.warn("[alox] resolve-notify failed:", e?.message || e);
            }
          }
        }
      }
    }

    // Heartbeat singleton. founderBaseline is written EVERY sweep to the
    // live founder set — the set-change alert above fires exactly once per
    // actual change (this sweep's baseline update is what makes it one-shot).
    const statePatch = {
      lastRunAt: now,
      lastRunMs: Date.now() - startedAt,
      checksRun: outcomes.length,
      openCount,
      lastSummary: summary,
      founderBaseline: founderEmails,
      updatedAt: now,
    };
    if (stateRow) await ctx.db.patch(stateRow._id, statePatch);
    else await ctx.db.insert("alox_state", statePatch);

    // Retention (bounded per sweep — gradual drain of old rows).
    const loginCutoff = now - ALOX_THRESHOLDS.LOGIN_EVENT_RETENTION_MS;
    const oldLogins = await ctx.db
      .query("founder_login_events")
      .withIndex("by_event_created", (q: any) =>
        q.eq("event", "success").lt("createdAt", loginCutoff)
      )
      .take(100);
    for (const row of oldLogins) await ctx.db.delete(row._id);

    const alertCutoff = now - ALOX_THRESHOLDS.RESOLVED_ALERT_RETENTION_MS;
    const oldResolved = await ctx.db
      .query("alox_alerts")
      .withIndex("by_status", (q: any) => q.eq("status", "resolved"))
      .take(200);
    for (const row of oldResolved) {
      if (row.resolvedAt && row.resolvedAt < alertCutoff) await ctx.db.delete(row._id);
    }

    return { checksRun: outcomes.length, openCount, lastRunMs: statePatch.lastRunMs };
  }),
});

// ─── Founder-app surface ────────────────────────────────────────────────────

/** The Aloa X dashboard payload (founder-gated). */
export const getAloxStatus = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, undefined, args.sessionToken);
    const now = Date.now();
    const signals = await gatherSignals(ctx, now);
    const outcomes = evaluateAllChecks(signals, now);
    const state: any = await ctx.db.query("alox_state").first();
    const openAlerts = await ctx.db
      .query("alox_alerts")
      .withIndex("by_status", (q: any) => q.eq("status", "open"))
      .order("desc")
      .take(50);
    const recentResolved = await ctx.db
      .query("alox_alerts")
      .withIndex("by_status", (q: any) => q.eq("status", "resolved"))
      .order("desc")
      .take(10);

    return {
      now,
      state: state
        ? {
            lastRunAt: state.lastRunAt,
            lastRunMs: state.lastRunMs ?? 0,
            checksRun: state.checksRun ?? 0,
            openCount: state.openCount ?? 0,
          }
        : null,
      checks: outcomes,
      openAlerts,
      recentResolved: recentResolved.map((a: any) => ({
        checkKey: a.checkKey, title: a.title, severity: a.severity,
        firstSeenAt: a.firstSeenAt, resolvedAt: a.resolvedAt,
      })),
      signals,
    };
  },
});

/**
 * Manual "Run checks now" from the founder app (founder-gated).
 *
 * The explicit annotations are load-bearing: typing this action requires
 * `internal.alox.runAloxWatchdog` from the generated api, which itself is
 * derived from `typeof` this module's exports — a circular inference that
 * TypeScript resolves to implicit-any (TS7022/7023) now that the module
 * count pushed the api type over its inference budget. Pinning the result
 * shape (mirrors runAloxWatchdog's return) breaks the cycle.
 */
export const runAloxWatchdogNow = action({
  args: { sessionToken: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ checksRun: number; openCount: number; lastRunMs: number }> => {
    await requireFounder(ctx, undefined, args.sessionToken);
    const result = (await ctx.runMutation(internal.alox.runAloxWatchdog, {})) as {
      checksRun: number;
      openCount: number;
      lastRunMs: number;
    };
    return result;
  },
});

/** "Send test alert" — proves the watchdog → phone chain end to end. */
export const sendAloxTestAlert = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, undefined, args.sessionToken);
    await notifyFounders(ctx, {
      title: "Aloa X: test alert",
      message: "This is a test of the watchdog alert chain. If you can read this on your phone, alerts will reach you.",
      type: "alox_test",
      link: { view: "aloax", id: null, context: {} },
      tag: "alox-test",
    });
    return { success: true };
  },
});

// ─── Founder login push alerts (called from verifyLogin) ───────────────────

/**
 * internalMutation: recordFounderLoginEvent — every login attempt on a
 * FOUNDER account lands here from verifyLogin (scheduled fire-and-forget
 * so login latency is unaffected). Records the audit row always; pushes
 * with a dedup window so a burst of attempts collapses to one push —
 * except lockouts, which ALWAYS push.
 */
export const recordFounderLoginEvent = internalMutation({
  args: {
    email: v.string(),
    event: v.string(), // 'success' | 'failed' | 'locked'
    clientHint: v.optional(v.string()),
    attemptsRemaining: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const email = args.email.toLowerCase().trim();

    // Dedup: same email + event pushed recently → record but stay silent.
    // 2026-11-20 owner requirement — "anytime somebody logs into a founder
    // account, I should get a notification. It's that simple.": SUCCESS
    // events now ALWAYS push (logging in twice in 15 minutes from two
    // devices is two logins — the founder wants both). Only FAILED bursts
    // collapse (a 5-wrong-password burst should buzz once, not five times)
    // and lockouts keep their unconditional push.
    const recent = await ctx.db
      .query("founder_login_events")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .order("desc")
      .take(10);
    const alreadyPushed = recent.some(
      (r: any) =>
        r.event === args.event &&
        r.notified === true &&
        now - r.createdAt < ALOX_THRESHOLDS.LOGIN_PUSH_DEDUP_MS
    );

    const shouldPush =
      args.event === "locked" || args.event === "success" || !alreadyPushed;

    await ctx.db.insert("founder_login_events", {
      email,
      event: args.event,
      clientHint: args.clientHint ?? null,
      attemptsRemaining: args.attemptsRemaining ?? null,
      createdAt: now,
      notified: shouldPush,
    });

    if (!shouldPush) return { recorded: true, pushed: false };

    const source = args.clientHint === "founder-apk" ? "Founder APK" : "app";
    let title = "";
    let message = "";
    if (args.event === "success") {
      title = "Founder login detected";
      message = `${email} signed in just now (${source}). If this was not you, change the password immediately.`;
    } else if (args.event === "locked") {
      title = "Founder account LOCKED";
      message = `${email} has been locked out after too many failed attempts (15-minute cool-down). If this was not you, someone is trying your password.`;
    } else {
      const left = typeof args.attemptsRemaining === "number" ? args.attemptsRemaining : 5;
      title = "Failed founder login attempt";
      message = `Wrong password entered for ${email} (${source}). ${left} attempt${left === 1 ? "" : "s"} left before lockout.`;
    }

    try {
      await notifyFounders(ctx, {
        title,
        message,
        type: args.event === "success" ? "founder_login" : `founder_login_${args.event}`,
        link: { view: "aloax", id: null, context: { email, event: args.event } },
        tag: `founder-login-${args.event}`,
      });
    } catch (e: any) {
      console.warn("[alox] founder-login push failed:", e?.message || e);
    }
    return { recorded: true, pushed: true };
  },
});

// ─── Founder push/login diagnostics (2026-11-20) ────────────────────────────

/**
 * internalQuery: founderDiagnostics — READ-ONLY root-cause view for the
 * "why do I get every Aloa X notification twice" investigation.
 *
 * NOT client-callable (internal): it is executed via the deploy key from
 * CI (`npx convex run alox:founderDiagnostics`, see
 * .github/workflows/alox-diagnostics.yml) or from the Convex dashboard.
 * Returns everything needed to explain the notification topology — founder
 * accounts, their registered device tokens (with capabilities, so the
 * main-app vs founder-APK split is visible), sessions, open alerts, the
 * login-event audit feed — with every sensitive value MASKED (emails:
 * first char + domain; FCM tokens: first 6 + last 4; no session tokens at
 * all) because the workflow logs of this public repository are
 * world-readable.
 */
export const founderDiagnostics = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const maskEmail = (email: string): string => {
      const [local, domain] = String(email || "").split("@");
      if (!domain) return "***";
      const shown = local.slice(0, 1);
      const tail = local.length > 1 ? local.slice(-1) : "";
      return `${shown}***${tail}@${domain}`;
    };
    const maskToken = (token: string): string => {
      const t = String(token || "");
      if (t.length <= 12) return `${t.slice(0, 4)}…`;
      return `${t.slice(0, 6)}…${t.slice(-4)} (len ${t.length})`;
    };

    // Founder accounts with token/session topology.
    const founders: any[] = await ctx.db
      .query("users")
      .filter((q: any) => q.eq(q.field("role"), "Founder"))
      .take(2000);

    // Cross-account token sharing: the SAME FCM token registered under
    // more than one userId (registerPushToken reassigns, but stale rows
    // from before that behaviour — or concurrent installs — can leave
    // dupes; these become double pushes without the transport dedup).
    const tokenOwnerCount = new Map<string, Set<string>>();
    const accountSummaries = [];
    for (const f of founders) {
      const tokens = await ctx.db
        .query("user_push_tokens")
        .withIndex("by_user_active", (q: any) =>
          q.eq("userId", String(f._id)).eq("isActive", true)
        )
        .take(50);
      for (const t of tokens) {
        if (!tokenOwnerCount.has(t.token)) tokenOwnerCount.set(t.token, new Set());
        tokenOwnerCount.get(t.token)!.add(String(f._id));
      }
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_user", (q: any) => q.eq("userId", f._id))
        .order("desc")
        .take(25);
      const activeSessions = sessions.filter(
        (s: any) => s.revokedAt == null && s.expiresAt > now
      );
      accountSummaries.push({
        maskedEmail: maskEmail(f.email || f.tokenIdentifier || ""),
        displayName: String(f.name || ""),
        memberSince: f.createdAt ? new Date(f.createdAt).toISOString().slice(0, 10) : null,
        deactivated: !!f.deactivatedAt,
        lockedNow: !!(f.lockedUntil && f.lockedUntil > now),
        failedLoginAttempts: f.failedLoginAttempts ?? 0,
        activeTokens: tokens.map((t: any) => ({
          fingerprint: maskToken(t.token),
          deviceType: String(t.deviceType || ""),
          capabilities: String(t.capabilities || ""),
          deviceName: String(t.deviceName || "").slice(0, 60),
          registeredAt: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : null,
          updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString().slice(0, 10) : null,
        })),
        activeSessionCount: activeSessions.length,
        activeSessionDevices: activeSessions
          .slice(0, 5)
          .map((s: any) => String(s.device || "").slice(0, 30)),
      });
    }

    const sharedTokens = Array.from(tokenOwnerCount.entries())
      .filter(([, owners]) => owners.size > 1)
      .map(([token, owners]) => ({ fingerprint: maskToken(token), ownerCount: owners.size }));

    // Open alerts + watchdog heartbeat.
    const openAlerts = await ctx.db
      .query("alox_alerts")
      .withIndex("by_status", (q: any) => q.eq("status", "open"))
      .order("desc")
      .take(50);
    const state: any = await ctx.db.query("alox_state").first();

    // Recent login audit feed (the "logs of any time an account is logged
    // into" the owner asked for — this is that table's real content).
    const recentLogins = await ctx.db
      .query("founder_login_events")
      .order("desc")
      .take(25);

    return {
      generatedAt: new Date(now).toISOString(),
      founderCount: founders.length,
      founders: accountSummaries,
      tokensRegisteredUnderMultipleFounderAccounts: sharedTokens,
      watchdog: {
        lastRunAt: state?.lastRunAt ? new Date(state.lastRunAt).toISOString() : null,
        openCount: state?.openCount ?? null,
        founderBaseline: Array.isArray(state?.founderBaseline)
          ? (state.founderBaseline as string[]).map((e) => maskEmail(e))
          : null,
      },
      openAlerts: openAlerts.map((a: any) => ({
        checkKey: a.checkKey,
        severity: a.severity,
        title: a.title,
        notifyCount: a.notifyCount,
        firstSeenAt: a.firstSeenAt ? new Date(a.firstSeenAt).toISOString() : null,
        lastNotifiedAt: a.lastNotifiedAt ? new Date(a.lastNotifiedAt).toISOString() : null,
      })),
      recentFounderLogins: recentLogins.map((e: any) => ({
        maskedEmail: maskEmail(e.email),
        event: e.event,
        clientHint: e.clientHint ?? null,
        notified: !!e.notified,
        at: e.createdAt ? new Date(e.createdAt).toISOString() : null,
      })),
    };
  },
});

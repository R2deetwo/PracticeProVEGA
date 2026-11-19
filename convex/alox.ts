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
 *   Security          founder count, lockouts, failed-login pressure
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
import { internalMutation, mutation, query, action } from "./_generated/server";
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
  status: "ok" | "problem";
  severity?: "critical" | "warning";
  title?: string;
  detail?: string;
}

const ok = (checkKey: string, surface: string): CheckOutcome =>
  ({ checkKey, surface, status: "ok" });

export function evaluateBackendErrors(errors24h: number): CheckOutcome {
  if (errors24h >= ALOX_THRESHOLDS.BACKEND_ERRORS_CRITICAL) {
    return {
      checkKey: "backend.errors", surface: "Backend & API", status: "problem",
      severity: "critical",
      title: `${errors24h} backend errors in 24h`,
      detail: `The backend captured ${errors24h} error events in the last 24 hours (crons, webhooks or actions failing). Open System Status for the stack traces.`,
    };
  }
  if (errors24h >= ALOX_THRESHOLDS.BACKEND_ERRORS_WARNING) {
    return {
      checkKey: "backend.errors", surface: "Backend & API", status: "problem",
      severity: "warning",
      title: `${errors24h} backend errors in 24h`,
      detail: `The backend captured ${errors24h} error events in the last 24 hours. Worth a look in System Status.`,
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

export function evaluateBackups(lastSuccessAt: number | null, now: number): CheckOutcome {
  if (lastSuccessAt === null) {
    return {
      checkKey: "backups.stale", surface: "Backups", status: "problem",
      severity: "warning",
      title: "No successful backup on record",
      detail: "The nightly 02:00 UTC backup has never completed. If this is intentional (targets not configured), disable this check mentally — otherwise data is unprotected.",
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
  if (count > 1) {
    return {
      checkKey: "security.founder_count", surface: "Security", status: "problem",
      severity: "critical",
      title: `${count} founder accounts exist (expected 1)`,
      detail: "More than one user has role=Founder. Founder signup has been closed since the first account — multiple founders means a role was changed by hand. Verify each account.",
    };
  }
  return ok("security.founder_count", "Security");
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
    },
    finance: latestReport[0]
      ? {
          ranAt: latestReport[0].ranAt,
          ok: latestReport[0].ok === true,
          unmatchedSettledProofs: latestReport[0].unmatchedSettledProofs ?? 0,
          creditsWaiting: latestReport[0].creditsWaiting ?? 0,
        }
      : null,
    backups: { lastSuccessAt: lastBackupAt, target: lastBackup?.target ?? null },
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
    evaluateBackups(signals.backups.lastSuccessAt, now),
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

    // Existing OPEN alerts by checkKey.
    const openAlerts: any[] = await ctx.db
      .query("alox_alerts")
      .withIndex("by_status", (q: any) => q.eq("status", "open"))
      .take(200);
    const openByKey = new Map(openAlerts.map((a: any) => [a.checkKey, a]));

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
              link: { view: "aloax", id: null, context: { checkKey: outcome.checkKey } },
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
                link: { view: "aloax", id: null, context: { checkKey: outcome.checkKey } },
                tag: `alox-${outcome.checkKey}`,
              });
            } catch (e: any) {
              console.warn("[alox] renotify failed:", e?.message || e);
            }
          }
        }
      } else {
        summary.push({ checkKey: outcome.checkKey, status: "ok" });
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

    // Heartbeat singleton.
    const stateRow: any = await ctx.db.query("alox_state").first();
    const statePatch = {
      lastRunAt: now,
      lastRunMs: Date.now() - startedAt,
      checksRun: outcomes.length,
      openCount,
      lastSummary: summary,
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

    const shouldPush = args.event === "locked" || !alreadyPushed;

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

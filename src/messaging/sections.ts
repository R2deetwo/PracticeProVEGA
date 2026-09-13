/**
 * sections.ts — Inbox collapse behavior + scheduled-message classification.
 *
 * USER DIRECTIVE (2026-09-14, Messages page overhaul):
 * "Conversations should be collapsed when the user opens it for the first
 *  time… afterwards you can see which one was left open and when they go
 *  back to it, it should be that one that is open… All closed except maybe
 *  the one they usually use — if they don't have a team, the Practice Pro
 *  (support) messages; if Atrium, Residents; if Vega, Clients."
 *
 * Also answers "why are payment receipts scheduled?": the
 * `scheduled_messages` table doubles as the system's dispatch queue, so
 * transactional messages (receipts, late notices, SC alerts) pass through
 * it on their way out. partitionScheduledMessages() separates them so the
 * Scheduled tab can present human intent ("your scheduled messages") apart
 * from system automation ("the automation queue").
 */

// ── Inbox section ids (must match the section keys used in MessagesView) ──
export const INBOX_SECTION_IDS = [
  'system',           // "PracticePro Team" (support channel)
  'inbound',          // Inbound WhatsApp & Email (Atrium/Komplete)
  'team',             // Team DMs
  'portal_clients',   // Clients (portal conversations, Client role)
  'portal_residents', // Residents (portal conversations, Tenant role)
  'client',           // Matter Messages (legacy Vega, unread only)
] as const;

export type InboxSectionId = (typeof INBOX_SECTION_IDS)[number];

/** Context used to pick the default-open inbox section. */
export interface SmartDefaultContext {
  /** Pure Atrium product (property-only). */
  isAtrium: boolean;
  /** Other members exist in the firm besides the current user. */
  hasTeam: boolean;
  /** The user has a support thread (the PracticePro Team section renders). */
  hasSupportThread: boolean;
  /** The Clients section renders (isLegal || isUnified). */
  hasClientsSection: boolean;
  /** The Residents section renders (hasPropertyFeatures || isUnified). */
  hasResidentsSection: boolean;
}

/**
 * The ONE section that should be open on first visit (everything else
 * collapsed). Priority per the user's spec:
 *   1. No team → the Practice Pro support channel ("PracticePro Team").
 *   2. Atrium  → Residents.
 *   3. Vega / Komplete → Clients.
 * Returns null when nothing relevant renders (everything stays collapsed —
 * the tidy default).
 */
export function getSmartDefaultOpenSection(ctx: SmartDefaultContext): InboxSectionId | null {
  let preferred: InboxSectionId | null;
  if (!ctx.hasTeam) {
    preferred = 'system';
  } else if (ctx.isAtrium) {
    preferred = 'portal_residents';
  } else {
    preferred = 'portal_clients';
  }
  return refineDefaultOpenSection(preferred, ctx);
}

/**
 * Fall back when the preferred section does not render (e.g. no support
 * thread yet, or the product hides that section). Never opens a section the
 * product wouldn't draw — an orphan "open" state on a hidden section is
 * indistinguishable from "all collapsed", but the fallback keeps the page
 * USEFUL (something visible is open) instead of purely empty.
 */
export function refineDefaultOpenSection(
  preferred: InboxSectionId | null,
  ctx: SmartDefaultContext
): InboxSectionId | null {
  const fallback: InboxSectionId = ctx.isAtrium ? 'portal_residents' : 'portal_clients';
  let choice = preferred;
  if (choice === 'system' && !ctx.hasSupportThread) choice = fallback;
  if (choice === 'portal_clients' && !ctx.hasClientsSection) choice =
    ctx.hasResidentsSection ? 'portal_residents' : null;
  if (choice === 'portal_residents' && !ctx.hasResidentsSection) choice =
    ctx.hasClientsSection ? 'portal_clients' : null;
  if (choice === 'inbound' || choice === 'team' || choice === 'client') return null;
  return choice;
}

/**
 * The initial collapsed set: every section EXCEPT the one that should be
 * open (or all of them when nothing qualifies).
 */
export function computeInitialCollapsed(
  openSection: InboxSectionId | null
): Set<InboxSectionId> {
  return new Set(INBOX_SECTION_IDS.filter((id) => id !== openSection));
}

// ── Persistence (which section was left open) ────────────────────────────
// Keyed per user so shared devices keep separate collapse states.

export function collapsedStorageKey(userId: string): string {
  return `pp_msg_collapsed_v1:${userId}`;
}

export function loadPersistedCollapsed(userId: string): Set<InboxSectionId> | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = window.localStorage.getItem(collapsedStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter((id): id is InboxSectionId =>
      (INBOX_SECTION_IDS as readonly string[]).includes(id)
    );
    // An array that validates to nothing is treated as "not stored" — it
    // was probably a different shape written by an older/buggy version.
    if (valid.length === 0 && parsed.length > 0) return null;
    return new Set(valid);
  } catch {
    return null;
  }
}

export function persistCollapsed(userId: string, collapsed: Set<InboxSectionId>): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(
      collapsedStorageKey(userId),
      JSON.stringify(Array.from(collapsed))
    );
  } catch {
    // Storage full / disabled — collapse state just won't persist.
  }
}

// ── Scheduled-message classification ─────────────────────────────────────

/**
 * Is this scheduled message SYSTEM-generated (a receipt, reminder, or alert
 * the automation queued) rather than something a human deliberately chose
 * to schedule? System rows carry `isAutomation` or a machine `triggeredBy`
 * ("system_cron", "admin_mark_paid", "cron_*", "system"). Human rows carry
 * the scheduler's email or user id (or nothing, for the oldest rows).
 */
const SYSTEM_TRIGGER_PATTERN = /^(system|cron_|admin_|founder_bot)/i;

export function isSystemGeneratedMessage(msg: any): boolean {
  if (!msg) return false;
  if (msg.isAutomation === true) return true;
  const by = typeof msg.triggeredBy === 'string' ? msg.triggeredBy : '';
  return SYSTEM_TRIGGER_PATTERN.test(by);
}

export type ScheduledMessageStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled';

export interface ScheduledPartition {
  /** Human-scheduled, still waiting to go out. */
  mine: any[];
  /** System/automation messages in the dispatch queue (mostly transient). */
  automationQueue: any[];
  /** Anything already sent/failed/cancelled — history, shown in the Sent tab. */
  history: any[];
}

/**
 * Split the firm's scheduled_messages into the three views the tab needs.
 * `mine` and `automationQueue` keep only `status === 'scheduled'`; everything
 * else is history. Sorted ascending by scheduledFor (soonest first).
 */
export function partitionScheduledMessages(rows: any[]): ScheduledPartition {
  const mine: any[] = [];
  const automationQueue: any[] = [];
  const history: any[] = [];
  for (const row of rows || []) {
    if (row?.status === 'scheduled') {
      (isSystemGeneratedMessage(row) ? automationQueue : mine).push(row);
    } else {
      history.push(row);
    }
  }
  const byTimeAsc = (a: any, b: any) => (a.scheduledFor || 0) - (b.scheduledFor || 0);
  mine.sort(byTimeAsc);
  automationQueue.sort(byTimeAsc);
  return { mine, automationQueue, history };
}

/**
 * Has a scheduled message's send time arrived? (System receipts are queued
 * with scheduledFor = now, so they display as "sending now…".)
 */
export function isDueNow(msg: any, now: number = Date.now()): boolean {
  return (msg?.scheduledFor || 0) <= now + 60_000;
}

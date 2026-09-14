/**
 * automationEngine — the Scheduled Messages orchestration core.
 *
 * THE SINGLE ORCHESTRATION POINT (user directive, 2026-09-14):
 * "THIS SCHEDULED MESSAGES SHOULD BE WHERE ALL OF IT IS ORCHESTRATED"
 * — every automated tenant/client/vendor reminder flows through this
 * engine into `scheduled_messages`, where the 5-minute dispatch
 * processor sends it. The scattered reminder crons
 * (serviceChargeWhatsAppReminder, sentryDailyAutomation) are RETIRED —
 * their targeting lives on here, unified behind per-firm workflow
 * toggles, per-step offset adjusters, idempotency keys, and payment
 * suppression. Onboarding/registration/auth emails are NOT part of this
 * engine (they are transactional, not reminders).
 *
 * WHAT RUNS DAILY (cron "automationEngine", 6:30 UTC = 7:30 AM WAT,
 * deliberately AFTER walletAutoDeductions at 6:15 so wallet-paid
 * residents are already PAID_FULLY and never reminded):
 *   1. For every firm: load (or default) the firm's workflow configs.
 *   2. For each ENABLED workflow: resolve live targets from real data
 *      (properties.units, service_charges, tenancies).
 *   3. For each target × step: is TODAY the trigger day (anchor ±
 *      offsetDays)? Suppression gates: already paid, pending payment
 *      proof, opt-out, reminders muted/paused/cool-off, property
 *      reminders disabled.
 *   4. Idempotency: the automation_dispatch_log ledger (unique on
 *      firm|workflow|step|tenant|period) guarantees a tenant is NEVER
 *      messaged twice for one billing period / milestone — the hard
 *      no-duplicates rule.
 *   5. Enqueue: one scheduled_messages row per target/step with
 *      merge-fields already rendered ({{tenant_name}}, {{amount_due}}…)
 *      and the recipient contact embedded, ready for the dispatcher.
 *
 * PAYMENT SUPPRESSION (restored WhatsApp-era behaviour):
 *   receipt uploaded → pending reminders for that tenant are PAUSED
 *   (status "paused") · approved/verified → they are CANCELLED ·
 *   rejected → they RESUME, so the day-of and late-notice sequence
 *   follows naturally. Hooks: internal.onPaymentProofSubmitted /
 *   Approved / Rejected (called from portals.ts) + Paystack webhook.
 */

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logError } from "./observability";
import { internal } from "./_generated/api";
import { requireStaffCaller, assertSameFirm } from "./callerAuth";
import { createUnitResolver, canonicalTenantId } from "./unitLookup";
import { randomHex } from "./secureRandom";
import { withCronReporting } from "./observability";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Workflow definitions — the Atrium pre-built automation library
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowStepDefault {
  key: string;
  label: string;           // legacy timing label (compat; the UI shows title + live offset phrase)
  title: string;           // semantic, NUMBER-FREE name — never contradicts an adjusted offset
  offsetDays: number;      // relative to the anchor date (negative = before)
  enabled: boolean;
  channel: "auto" | "email" | "whatsapp"; // auto = email when the tenant has one, else WhatsApp
  messageType: string;     // scheduled_messages.messageType
  subject: string;         // default message template (supports merge fields)
}

export interface WorkflowDefinition {
  key: string;
  name: string;
  description: string;
  anchor: string;          // human explanation of the anchor date
  defaultEnabled: boolean;
  steps: WorkflowStepDefault[];
}

/**
 * Merge fields available in every template:
 *   {{tenant_name}} {{unit_number}} {{amount_due}} {{due_date}}
 *   {{property_name}} {{firm_name}} {{payment_link}}
 *
 * TEMPLATE WRITING RULES (2026-09-14, user feedback "messages are sparse
 * and not very helpful — flesh out; be clear what each message is"):
 *   1. Every message greets by name and signs off with the firm — one
 *      consistent voice across the ladder.
 *   2. Every payment-bearing message says WHAT is due, the AMOUNT, the
 *      UNIT, the DATE, and HOW to pay ({{payment_link}} — always resolves:
 *      personal portal token when the resident has one, the portal login
 *      page otherwise).
 *   3. Escalation steps state the CONSEQUENCE plainly (late charges per
 *      the tenancy agreement, formal recovery proceedings) and always
 *      leave a door open ("reply to arrange payment").
 *   4. Bodies are OFFSET-AGNOSTIC: no "in 3 days" / "tomorrow" / "7 days
 *      overdue" — the stepper can change any offset, and the text must
 *      never contradict it. The anchor date ({{due_date}}) carries the
 *      timing. Only "today" is allowed, and only on the due-date step
 *      (true whenever the message arrives on its offset day).
 *   5. lease_expiry / rent_review steps use NO {{payment_link}} and NO
 *      {{amount_due}} — those resolvers have no payment data; tags would
 *      render empty.
 */
export const AUTOMATION_WORKFLOW_DEFAULTS: WorkflowDefinition[] = [
  {
    key: "rent_collection",
    name: "Rent Collection Ladder",
    description:
      "RENT only — the full collection ladder: gentle heads-up before rent is due, the due-date demand, a courtesy grace note, then escalating overdue notices (Notice of Default at 7 days, final demand at 14). Never double-messages a resident on the same day (see the Service Charge workflow below).",
    anchor: "each unit's rent due date (day-of-month of the lease start)",
    defaultEnabled: true,
    steps: [
      { key: "pre_7", label: "7 days before due", title: "Gentle heads-up", offsetDays: -7, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Hi {{tenant_name}},\n\nA friendly heads-up: your rent of {{amount_due}} for {{unit_number}} at {{property_name}} is due on {{due_date}}.\n\nYou can pay securely from your resident portal: {{payment_link}}\n\nThank you,\n{{firm_name}}" },
      { key: "pre_3", label: "3 days before due", title: "Rent reminder", offsetDays: -3, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Hi {{tenant_name}},\n\nA reminder that your rent of {{amount_due}} for {{unit_number}} at {{property_name}} is due on {{due_date}}.\n\nPay securely: {{payment_link}}\nIf you have already paid, please upload your receipt in the portal so we can confirm quickly.\n\n{{firm_name}}" },
      { key: "pre_1", label: "1 day before due", title: "Final reminder", offsetDays: -1, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Hi {{tenant_name}},\n\nFinal reminder: your rent of {{amount_due}} for {{unit_number}} is due on {{due_date}}.\n\nTo avoid late charges under your tenancy agreement, please settle before the due date: {{payment_link}}\n\n{{firm_name}}" },
      { key: "due_day", label: "Due date (morning)", title: "Due-date reminder", offsetDays: 0, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Hi {{tenant_name}},\n\nYour rent of {{amount_due}} for {{unit_number}} is due today ({{due_date}}).\n\nPlease pay securely now: {{payment_link}}\nOnce paid, upload your receipt in the portal and we will confirm within one business day.\n\n{{firm_name}}" },
      { key: "grace_3", label: "3 days after (courtesy)", title: "Courtesy grace note", offsetDays: 3, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Hi {{tenant_name}},\n\nWe have not yet received your rent of {{amount_due}} for {{unit_number}}, which was due on {{due_date}}.\n\nIf you have already paid, please upload your receipt in the portal so we can confirm: {{payment_link}}\nIf you need more time, simply reply to this message — we are happy to discuss a payment plan before any charges apply.\n\n{{firm_name}}" },
      { key: "late_7", label: "7 days late — Notice of Default", title: "Notice of Default", offsetDays: 7, enabled: true, channel: "auto", messageType: "late_notice",
        subject: "NOTICE OF DEFAULT — {{unit_number}}, {{property_name}}\n\nHi {{tenant_name}},\n\nThe rent of {{amount_due}} for {{unit_number}}, due on {{due_date}}, is now overdue. Under your tenancy agreement, late payment may attract late charges.\n\nPlease settle the full amount today: {{payment_link}}\nIf payment (or an agreed payment plan) is not in place within seven days, {{firm_name}} may begin formal recovery proceedings, which can affect your tenancy.\n\nIf you are having difficulty paying, contact us now — we would rather agree a plan.\n\n{{firm_name}}" },
      { key: "late_14", label: "14 days late — escalated demand", title: "Escalated demand", offsetDays: 14, enabled: true, channel: "auto", messageType: "late_notice",
        subject: "FINAL DEMAND — {{unit_number}}, {{property_name}}\n\nHi {{tenant_name}},\n\nDespite earlier reminders, the rent of {{amount_due}} for {{unit_number}}, due on {{due_date}}, remains unpaid. This is a final demand.\n\nPay immediately: {{payment_link}}\nIf the amount is not settled — or a written payment plan agreed — within seven days, {{firm_name}} will commence formal recovery proceedings. This may include termination of the tenancy, recovery of possession, and recovery of costs.\n\nReply to this message now if you wish to arrange payment.\n\n{{firm_name}}" },
    ],
  },
  {
    key: "service_charge",
    name: "Service Charge Reminders",
    description:
      "SERVICE CHARGE only — notices for diesel, security, cleaning and other service-charge cycles, before the contribution is due, on the day, and as it falls into arrears. A resident gets at most ONE payment reminder per day, so this workflow and the Rent Collection ladder never double-send to the same person on the same day.",
    anchor: "each service charge's next due date",
    defaultEnabled: true,
    steps: [
      { key: "pre_3", label: "3 days before due", title: "Service-charge heads-up", offsetDays: -3, enabled: true, channel: "auto", messageType: "service_charge_alert",
        subject: "Hi {{tenant_name}},\n\nYour service charge contribution of {{amount_due}} for {{unit_number}} at {{property_name}} is due on {{due_date}}.\n\nThis covers shared running costs — diesel, security, cleaning and common services.\n\nPay securely: {{payment_link}}\n\n{{firm_name}}" },
      { key: "due_day", label: "Due date", title: "Due-date notice", offsetDays: 0, enabled: true, channel: "auto", messageType: "service_charge_alert",
        subject: "Hi {{tenant_name}},\n\nYour service charge contribution of {{amount_due}} for {{unit_number}} is due today ({{due_date}}).\n\nPay securely now: {{payment_link}} — we confirm receipts in the portal within one business day.\n\n{{firm_name}}" },
      { key: "late_7", label: "7 days overdue", title: "Overdue alert", offsetDays: 7, enabled: true, channel: "auto", messageType: "service_charge_alert",
        subject: "Hi {{tenant_name}},\n\nYour service charge contribution of {{amount_due}} for {{unit_number}}, due on {{due_date}}, is now overdue.\n\nPlease settle it today: {{payment_link}}\nUnder your tenancy agreement, overdue service charges may attract late charges and may be recovered as rent arrears.\n\nIf you have already paid, upload your receipt in the portal so we can confirm.\n\n{{firm_name}}" },
      { key: "late_14", label: "14 days overdue", title: "Escalated demand", offsetDays: 14, enabled: true, channel: "auto", messageType: "late_notice",
        subject: "FINAL NOTICE — SERVICE CHARGE, {{unit_number}}\n\nHi {{tenant_name}},\n\nThe service charge of {{amount_due}} for {{unit_number}}, due on {{due_date}}, remains unpaid despite earlier notices.\n\nPay immediately: {{payment_link}}\nIf it is not settled — or a payment plan agreed — within seven days, {{firm_name}} may treat it as recoverable rent arrears and begin formal recovery steps.\n\nReply to this message now if you need to arrange payment.\n\n{{firm_name}}" },
    ],
  },
  {
    key: "lease_expiry",
    name: "Lease & Tenancy Milestones",
    description:
      "Renewal conversations start long before the lease ends — automatic expiry warnings at 90, 60 and 30 days so no tenancy quietly lapses.",
    anchor: "the tenancy end date",
    defaultEnabled: false,
    steps: [
      { key: "expiry_90", label: "90 days before expiry", title: "Early renewal prompt", offsetDays: -90, enabled: true, channel: "auto", messageType: "lease_renewal",
        subject: "Hi {{tenant_name}},\n\nYour tenancy for {{unit_number}} at {{property_name}} expires on {{due_date}}. We have valued having you as a resident and would be glad to have you stay.\n\nIf you would like to renew, simply reply to this message and we will send the renewal terms.\n\n{{firm_name}}" },
      { key: "expiry_60", label: "60 days before expiry", title: "Renewal reminder", offsetDays: -60, enabled: true, channel: "auto", messageType: "lease_renewal",
        subject: "Hi {{tenant_name}},\n\nA reminder that your tenancy for {{unit_number}} expires on {{due_date}}.\n\nRenewal terms are ready — reply to this message, or review and accept them in your resident portal.\n\nIf we do not hear from you, we will plan for the unit to be handed back on the expiry date.\n\n{{firm_name}}" },
      { key: "expiry_30", label: "30 days before expiry", title: "Final renewal notice", offsetDays: -30, enabled: true, channel: "auto", messageType: "lease_renewal",
        subject: "FINAL RENEWAL NOTICE — {{unit_number}}\n\nHi {{tenant_name}},\n\nYour tenancy for {{unit_number}} ends on {{due_date}}. If you wish to stay, please confirm your renewal now — reply to this message or accept the terms in your resident portal.\n\nIf we receive no confirmation by the expiry date, we will schedule the move-out inspection and prepare the unit for re-letting.\n\n{{firm_name}}" },
    ],
  },
  {
    key: "rent_review",
    name: "Rent Review Notices",
    description:
      "Scheduled alerts ahead of each unit's rent escalation date, so reviews never surprise the resident. Requires a rent review date on the unit's rental details.",
    anchor: "the unit's rent review / escalation date",
    defaultEnabled: false,
    steps: [
      { key: "review_60", label: "60 days before review", title: "Rent-review notice", offsetDays: -60, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "NOTICE OF RENT REVIEW — {{unit_number}}\n\nHi {{tenant_name}},\n\nThe rent for {{unit_number}} will be reviewed with effect from {{due_date}}, as provided in your tenancy agreement. We will send the reviewed terms to you in writing before the review takes effect.\n\nIf you have any questions, simply reply to this message.\n\n{{firm_name}}" },
      { key: "review_30", label: "30 days before review", title: "Final rent-review notice", offsetDays: -30, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Hi {{tenant_name}},\n\nA reminder that the rent review for {{unit_number}} takes effect on {{due_date}}. The reviewed terms follow in writing before that date, as your tenancy agreement requires.\n\nIf you have questions about the review, please reply before the effective date.\n\n{{firm_name}}" },
    ],
  },
];

/** Vega (legal practice) roadmap — architecture slot, not seeded for Atrium:
 * court_date (7/3/1-day hearing reminders), retainer cycles, filing
 * deadlines. Same engine, same ledger, different target resolvers. */
export const AUTOMATION_WORKFLOW_KEYS = AUTOMATION_WORKFLOW_DEFAULTS.map((w) => w.key);

// ── SAME-DAY OVERLAP GUARD — pure policy helpers (exported for unit tests) ──
// The two PAYMENT ladders (rent + service charge) share due dates in
// practice; the engine enforces at most ONE payment reminder per resident
// per day, preferring more severe steps. Informational workflows
// (lease_expiry, rent_review) are exempt.
export const PAYMENT_WORKFLOW_KEYS = new Set<string>(["rent_collection", "service_charge"]);

/** 0 = escalation (Notices of Default / final demands), 1 = due-day,
 *  2 = pre-due/grace reminders, 3 = informational (exempt from the guard).
 *  Lower dispatches first and claims the resident's day. */
export function paymentSeverity(
  workflowKey: string,
  step: { offsetDays: number; messageType: string }
): number {
  if (!PAYMENT_WORKFLOW_KEYS.has(String(workflowKey))) return 3;
  if (step.offsetDays >= 7 || step.messageType === "late_notice") return 0;
  if (step.offsetDays === 0) return 1;
  return 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Pure helpers (exported for unit tests)
// ─────────────────────────────────────────────────────────────────────────────

export interface MergeVars {
  tenant_name?: string | null;
  unit_number?: string | null;
  amount_due?: number | null;
  due_date?: string | null;
  property_name?: string | null;
  firm_name?: string | null;
  payment_link?: string | null;
  [k: string]: unknown;
}

/** Render {{merge_field}} tags. Unknown tags are stripped (never leak syntax). */
export function renderMergeFields(template: string, vars: MergeVars): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, rawKey: string) => {
    const key = String(rawKey).toLowerCase();
    const value = (vars as Record<string, unknown>)[key];
    if (value === undefined || value === null) return "";
    if (typeof value === "number") {
      return `₦${value.toLocaleString("en-NG")}`;
    }
    return String(value).trim();
  });
}

/** YYYY-MM-DD in UTC — period keys and trigger-day comparisons. */
export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Billing period key for a monthly cycle anchor (YYYY-MM). */
export function periodKeyFor(ts: number): string {
  return new Date(ts).toISOString().slice(0, 7);
}

/**
 * The rent due day-of-month for a unit: derived from the lease start
 * (rent is due on the same day each month), defaulting to the 1st.
 */
export function rentDueDayOfMonth(leaseStartTs: number | null | undefined): number {
  if (!leaseStartTs) return 1;
  const d = new Date(leaseStartTs).getUTCDate();
  return Math.min(Math.max(d, 1), 28); // clamp: months without day 29-31
}

/**
 * The NEXT occurrence of a rent due day at/after `fromTs` (UTC), so
 * pre-due reminders for the upcoming cycle anchor correctly.
 */
export function nextRentDueTimestamp(fromTs: number, dayOfMonth: number): number {
  const from = new Date(fromTs);
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  let candidate = new Date(Date.UTC(year, month, dayOfMonth, 0, 0, 0));
  if (candidate.getTime() < from.getTime() - 86_400_000) {
    // Day already passed this month (more than a day ago) → next month.
    candidate = new Date(Date.UTC(year, month + 1, dayOfMonth, 0, 0, 0));
  }
  return candidate.getTime();
}

/** Does `today` equal `anchor + offsetDays` (UTC calendar days)? */
export function isTriggerDay(anchorTs: number, offsetDays: number, nowTs: number): boolean {
  const anchorDay = new Date(anchorTs);
  anchorDay.setUTCHours(0, 0, 0, 0);
  const trigger = anchorDay.getTime() + offsetDays * 86_400_000;
  const today = new Date(nowTs);
  today.setUTCHours(0, 0, 0, 0);
  return trigger === today.getTime();
}

/** Dedup key: firm|workflow|step|tenantKey|period — the no-duplicate contract. */
export function buildDedupKey(
  firmId: string, workflowKey: string, stepKey: string, tenantKey: string, periodKey: string
): string {
  return [firmId, workflowKey, stepKey, tenantKey, periodKey].join("|");
}

/** Email-first channel rule (matches the retired crons' behaviour). */
export function resolveChannel(
  configured: "auto" | "email" | "whatsapp", tenantEmail: string | null
): "email" | "whatsapp" {
  if (configured === "email") return "email";
  if (configured === "whatsapp") return "whatsapp";
  return tenantEmail ? "email" : "whatsapp";
}

export const PORTAL_BASE = "https://practice-pro-vega.vercel.app";

// ─────────────────────────────────────────────────────────────────────────────
// 3. Target resolution (server-side, reuses the shared unit resolver)
// ─────────────────────────────────────────────────────────────────────────────

interface EngineTarget {
  firmId: string;
  propertyId: string;
  unitId: string;            // canonical composite/convex id as stored elsewhere
  unitLabel: string;         // "Flat 2A"
  propertyName: string;      // address first line
  tenantKey: string;         // canonical tenant id or normalized contact
  tenantName: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  anchorTs: number;          // workflow anchor date (rent due / charge due / expiry)
  amountDue: number | null;
  periodKey: string;
  paymentLink: string | null;
  extra: Record<string, unknown>; // workflow-specific gates (charge flags etc.)
}

/** parse "YYYY-MM-DD" or "DD/MM/YYYY"-ish strings robustly; null if unusable. */
function parseDateField(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0, 10) + "T00:00:00Z").getTime();
  const dm = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dm) {
    let [, d, m, y] = dm;
    if (y.length === 2) y = "20" + y;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getTime();
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

async function resolveRentTargets(ctx: any, firmId: string): Promise<EngineTarget[]> {
  const resolver = createUnitResolver(ctx, firmId);
  const properties: any[] = await ctx.db
    .query("properties").withIndex("by_firm", (q: any) => q.eq("firmId", firmId)).take(500);
  const now = Date.now();
  const targets: EngineTarget[] = [];

  for (const p of properties) {
    if (p.remindersEnabled === false) continue; // property-level kill switch
    const propRd: any = p.rentalDetails || {};
    const units: any[] = Array.isArray(p.units) ? p.units : [];
    const address = String(p.address || "").split(",")[0] || "Property";
    const entries: Array<{ unit: any | null; unitId: string }> = units.length
      ? units.map((u: any) => ({ unit: u, unitId: u.id != null ? `${p._id}_${u.id}` : String(p._id) }))
      : [{ unit: null, unitId: String(p._id) }];

    for (const { unit, unitId } of entries) {
      const rd: any = (unit?.rentalDetails || propRd) || {};
      const email = String(unit?.tenantEmail || rd.tenantEmail || propRd.tenantEmail || p.tenantEmail || "").trim() || null;
      const phone = String(unit?.tenantPhone || rd.tenantPhone || propRd.tenantPhone || p.tenantPhone || "").trim() || null;
      const name = String(unit?.tenantName || rd.tenantName || propRd.tenantName || p.tenantName || "").trim() || null;
      if (!email && !phone) continue; // nobody to message
      const rent = Number(unit?.rentAmount ?? rd.rentAmount ?? propRd.rentAmount ?? 0) || null;

      // Anchor: the unit's rent due date for the CURRENT billing period.
      const leaseStart = parseDateField(unit?.leaseStart || rd.leaseStart || propRd.leaseStart);
      const dueDay = rentDueDayOfMonth(leaseStart);
      const anchorTs = nextRentDueTimestamp(now, dueDay);
      // If the anchor is ~today, reminders reference THIS cycle. If the
      // anchor passed >14 days ago the arrears ladder anchors there too —
      // nextRentDueTimestamp already rolls forward, so late steps only fire
      // when the overdue anchor is still the current period (a charge that
      // is chronically unpaid re-anchors every month; the dispatch ledger
      // period key (YYYY-MM) still guarantees one message per period).
      const period = periodKeyFor(anchorTs);

      const tenantRef = await resolver.tenantFor({
        property: p, unit, propertyId: String(p._id), customId: p.id ?? null,
        label: "", match: "composite",
      });
      const canonical = canonicalTenantId(tenantRef);
      const tenantKey = canonical || email?.toLowerCase() || phone || unitId;

      // Paid gate: latest rentPaymentHistory entry for this period marked paid.
      const history: any[] = Array.isArray(unit?.rentPaymentHistory)
        ? unit.rentPaymentHistory
        : Array.isArray(p.rentPaymentHistory) ? p.rentPaymentHistory : [];
      const paidThisPeriod = history.some((h: any) => {
        const hMonth = String(h?.month || h?.period || "").slice(0, 7);
        const hStatus = String(h?.status || "").toLowerCase();
        return hMonth === period && (hStatus === "paid" || hStatus === "paid on time" || hStatus === "paid_ontime");
      });

      // Payment link — personal portal deep link when the resident has an
      // access token; otherwise the portal LOGIN page (never null, so
      // {{payment_link}} in every rent/service template always resolves to
      // something actionable — a stripped tag would leave "Pay securely:
      // " dangling mid-sentence). The login page leaks nothing and is the
      // same destination the personal link leads to after sign-in.
      let paymentLink: string | null = null;
      if (email) {
        const user = await resolver.userByEmail(email.toLowerCase());
        const token = (user as any)?.portalAccessToken;
        paymentLink = token
          ? `${PORTAL_BASE}/portal/tenant/${token}`
          : `${PORTAL_BASE}/portal/tenant/login`;
      } else {
        paymentLink = `${PORTAL_BASE}/portal/tenant/login`;
      }

      targets.push({
        firmId, propertyId: String(p._id), unitId, unitLabel: String(unit?.unitName || unit?.name || ""), propertyName: address,
        tenantKey, tenantName: name, tenantEmail: email, tenantPhone: phone,
        anchorTs, amountDue: rent, periodKey: period, paymentLink,
        extra: { paidThisPeriod },
      });
    }
  }
  return targets;
}

async function resolveServiceChargeTargets(ctx: any, firmId: string): Promise<EngineTarget[]> {
  const resolver = createUnitResolver(ctx, firmId);
  const charges: any[] = await ctx.db
    .query("service_charges").withIndex("by_firm", (q: any) => q.eq("firmId", firmId)).take(1000);
  const now = Date.now();
  const targets: EngineTarget[] = [];

  for (const sc of charges) {
    if (sc.serviceChargeStatus === "PAID_FULLY") continue;
    if (!sc.nextDueDate) continue;
    if (sc.remindersMuted === true || sc.remindersPaused === true) continue;
    const dueTs = Number(sc.nextDueDate);
    if (!Number.isFinite(dueTs)) continue;

    const ref = await resolver.resolveUnit(String(sc.unitId || ""));
    if (!ref || (ref.property as any)?.firmId !== firmId) continue;
    if ((ref.property as any).remindersEnabled === false) continue;
    const tenantRef = await resolver.tenantFor(ref);
    const email = tenantRef.email || String(sc.tenantEmail || "").trim() || null;
    const phone = tenantRef.phone || String(sc.tenantPhone || "").trim() || null;
    if (!email && !phone) continue;

    const canonical = canonicalTenantId(tenantRef);
    const tenantKey = canonical || email?.toLowerCase() || phone || String(sc.unitId);
    const period = `${periodKeyFor(dueTs)}:${String(sc.category || "General")}`;

    // Payment link — personal deep link when a token exists, else the portal
    // login page ({{payment_link}} must never render empty; see rent resolver).
    let paymentLink: string | null = null;
    if (email) {
      const user = await resolver.userByEmail(email.toLowerCase());
      const token = (user as any)?.portalAccessToken;
      paymentLink = token
        ? `${PORTAL_BASE}/portal/tenant/${token}`
        : `${PORTAL_BASE}/portal/tenant/login`;
    } else {
      paymentLink = `${PORTAL_BASE}/portal/tenant/login`;
    }

    targets.push({
      firmId, propertyId: ref.propertyId, unitId: String(sc.unitId || ref.propertyId),
      unitLabel: String(ref.unit?.unitName || ref.unit?.name || ""), propertyName: String(ref.label || ""),
      tenantKey, tenantName: tenantRef.name, tenantEmail: email, tenantPhone: phone,
      anchorTs: dueTs, amountDue: Number(sc.outstandingBalance ?? sc.amount) || null,
      periodKey: period, paymentLink,
      extra: { chargeId: String(sc._id), isDefaulter: !!sc.isDefaulter, daysOverdue: Number(sc.daysOverdue || 0) },
    });
  }
  return targets;
}

async function resolveLeaseTargets(ctx: any, firmId: string): Promise<EngineTarget[]> {
  const resolver = createUnitResolver(ctx, firmId);
  const properties: any[] = await ctx.db
    .query("properties").withIndex("by_firm", (q: any) => q.eq("firmId", firmId)).take(500);
  const now = Date.now();
  const targets: EngineTarget[] = [];
  const LOOKAHEAD_DAYS = 95;

  for (const p of properties) {
    const units: any[] = Array.isArray(p.units) ? p.units : [];
    const address = String(p.address || "").split(",")[0] || "Property";
    for (const unit of units) {
      const rd: any = unit.rentalDetails || p.rentalDetails || {};
      const endTs = parseDateField(unit.leaseEnd || rd.leaseEnd || unit.endDate || rd.endDate);
      if (!endTs) continue;
      const daysTo = (endTs - now) / 86_400_000;
      if (daysTo < -1 || daysTo > LOOKAHEAD_DAYS) continue;
      const email = String(unit.tenantEmail || rd.tenantEmail || p.tenantEmail || "").trim() || null;
      const phone = String(unit.tenantPhone || rd.tenantPhone || p.tenantPhone || "").trim() || null;
      if (!email && !phone) continue;
      const tenantRef = await resolver.tenantFor({
        property: p, unit, propertyId: String(p._id), customId: p.id ?? null, label: "", match: "composite",
      });
      const canonical = canonicalTenantId(tenantRef);
      targets.push({
        firmId, propertyId: String(p._id), unitId: `${p._id}_${unit.id}`, unitLabel: String(unit.unitName || ""),
        propertyName: address,
        tenantKey: canonical || email?.toLowerCase() || phone || String(unit.id),
        tenantName: tenantRef.name, tenantEmail: email, tenantPhone: phone,
        anchorTs: endTs, amountDue: null, periodKey: dayKey(endTs), paymentLink: null,
        extra: {},
      });
    }
  }
  return targets;
}

async function resolveRentReviewTargets(ctx: any, firmId: string): Promise<EngineTarget[]> {
  const properties: any[] = await ctx.db
    .query("properties").withIndex("by_firm", (q: any) => q.eq("firmId", firmId)).take(500);
  const now = Date.now();
  const targets: EngineTarget[] = [];
  const LOOKAHEAD_DAYS = 65;

  for (const p of properties) {
    const units: any[] = Array.isArray(p.units) ? p.units : [];
    const address = String(p.address || "").split(",")[0] || "Property";
    for (const unit of units) {
      const rd: any = unit.rentalDetails || p.rentalDetails || {};
      const reviewTs = parseDateField(unit.rentReviewDate || rd.rentReviewDate);
      if (!reviewTs) continue;
      const daysTo = (reviewTs - now) / 86_400_000;
      if (daysTo < -1 || daysTo > LOOKAHEAD_DAYS) continue;
      const email = String(unit.tenantEmail || rd.tenantEmail || p.tenantEmail || "").trim() || null;
      const phone = String(unit.tenantPhone || rd.tenantPhone || p.tenantPhone || "").trim() || null;
      if (!email && !phone) continue;
      targets.push({
        firmId, propertyId: String(p._id), unitId: `${p._id}_${unit.id}`, unitLabel: String(unit.unitName || ""),
        propertyName: address,
        tenantKey: email?.toLowerCase() || phone || String(unit.id),
        tenantName: String(unit.tenantName || rd.tenantName || ""), tenantEmail: email, tenantPhone: phone,
        anchorTs: reviewTs, amountDue: null, periodKey: dayKey(reviewTs), paymentLink: null,
        extra: {},
      });
    }
  }
  return targets;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Suppression gates
// ─────────────────────────────────────────────────────────────────────────────

async function hasPendingPaymentProof(ctx: any, firmId: string, tenantKey: string, unitId: string): Promise<boolean> {
  try {
    const proofs: any[] = await ctx.db
      .query("payment_proofs")
      .withIndex("by_firm_status", (q: any) => q.eq("firmId", firmId).eq("status", "pending_review"))
      .take(200);
    return proofs.some((pr: any) => {
      const byUnit = pr.unitId && String(pr.unitId) === unitId;
      const byTenant = pr.tenantId && String(pr.tenantId) === tenantKey;
      const byEmail = pr.tenantEmail && tenantKey.includes(String(pr.tenantEmail).toLowerCase());
      return byUnit || byTenant || byEmail;
    });
  } catch {
    return false;
  }
}

async function isOptedOut(ctx: any, firmId: string, email: string | null, phone: string | null): Promise<boolean> {
  try {
    for (const key of [email?.toLowerCase(), phone].filter(Boolean) as string[]) {
      const row = await ctx.db
        .query("message_opt_outs")
        .withIndex("by_firm_contact", (q: any) => q.eq("firmId", firmId).eq("contactKey", key))
        .first();
      if (row) return true;
    }
  } catch {}
  return false;
}

async function alreadyDispatched(
  ctx: any, firmId: string, workflowKey: string, stepKey: string, tenantKey: string, periodKey: string
): Promise<boolean> {
  const existing = await ctx.db
    .query("automation_dispatch_log")
    .withIndex("by_dedup", (q: any) =>
      q.eq("firmId", firmId).eq("workflowKey", workflowKey).eq("stepKey", stepKey)
       .eq("tenantKey", tenantKey).eq("periodKey", periodKey))
    .first();
  return !!existing;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. The engine (internalMutation — cron daily 6:30 UTC)
// ─────────────────────────────────────────────────────────────────────────────

async function loadFirmWorkflows(ctx: any, firmId: string): Promise<Array<{ def: WorkflowDefinition; steps: WorkflowStepDefault[]; enabled: boolean }>> {
  const rows: any[] = await ctx.db
    .query("automation_workflows").withIndex("by_firm", (q: any) => q.eq("firmId", firmId)).collect();
  const byKey = new Map(rows.map((r: any) => [String(r.workflowKey), r]));
  return AUTOMATION_WORKFLOW_DEFAULTS.map((def) => {
    const stored = byKey.get(def.key);
    if (stored && Array.isArray(stored.steps) && stored.steps.length) {
      // Merge: stored step overrides (offset/enabled/channel/SUBJECT) over
      // defaults; new default steps appear automatically.
      const byStep = new Map((stored.steps as any[]).map((s: any) => [String(s.key), s]));
      const steps = def.steps.map((d) => {
        const s = byStep.get(d.key);
        return s ? {
          ...d,
          enabled: !!s.enabled,
          offsetDays: Number(s.offsetDays ?? d.offsetDays),
          channel: (s.channel || d.channel) as WorkflowStepDefault["channel"],
          // custom template beats the default text; trim guards whitespace-only saves
          subject: typeof s.subject === "string" && s.subject.trim() ? s.subject : d.subject,
        } : d;
      });
      return { def, steps, enabled: !!stored.enabled };
    }
    return { def, steps: def.steps, enabled: def.defaultEnabled };
  });
}

/** Active per-unit opt-outs for a firm, as a flat alias set (all id shapes). */
async function loadUnitOptOutAliases(ctx: any, firmId: string): Promise<Set<string>> {
  try {
    const rows: any[] = await ctx.db
      .query("automation_unit_opt_outs")
      .withIndex("by_firm_active", (q: any) => q.eq("firmId", firmId).eq("active", true))
      .take(2000);
    const set = new Set<string>();
    for (const r of rows) {
      if (r.unitKey) set.add(String(r.unitKey));
      for (const a of (r.aliases as string[] | undefined) || []) set.add(String(a));
    }
    return set;
  } catch {
    return new Set<string>();
  }
}

async function recordDispatch(
  ctx: any, firmId: string, workflowKey: string, stepKey: string, tenantKey: string, periodKey: string,
  outcome: string, scheduledMessageId?: string, detail?: string
): Promise<void> {
  await ctx.db.insert("automation_dispatch_log", {
    firmId, workflowKey, stepKey, tenantKey, periodKey, outcome,
    ...(scheduledMessageId ? { scheduledMessageId } : {}),
    ...(detail ? { detail: detail.slice(0, 300) } : {}),
    createdAt: Date.now(),
  });
}

async function enqueueMessage(
  ctx: any, args: {
    firmId: string; propertyId: string; unitId: string; tenantKey: string;
    tenantName: string | null; tenantEmail: string | null; tenantPhone: string | null;
    channel: "email" | "whatsapp"; messageType: string; content: string;
    amountDue: number | null; dueLabel: string; paymentLink: string | null;
    workflowKey: string; stepKey: string; dedupKey: string; scheduledFor: number;
    firmName: string;
  }
): Promise<string> {
  const now = Date.now();
  // automation_logs row (Sent tab history continuity, linked for status sync)
  const logId = await ctx.db.insert("automation_logs", {
    firmId: args.firmId,
    unitId: args.unitId,
    tenantId: args.tenantKey,
    messageType: (["rent_reminder", "late_notice", "service_charge_alert", "lease_renewal", "welcome_note"].includes(args.messageType)
      ? args.messageType : "custom") as any,
    channel: args.channel,
    recipient: args.tenantEmail || args.tenantPhone || args.tenantName || args.tenantKey,
    messagePreview: args.content.slice(0, 120),
    messageContent: args.content,
    direction: "outbound",
    senderName: "Automation Engine",
    sentAt: now,
    status: "sending",
  });
  const messageId = await ctx.db.insert("scheduled_messages", {
    firmId: args.firmId,
    propertyId: args.propertyId,
    unitId: args.unitId,
    tenantIds: [args.tenantKey],
    messageType: args.messageType,
    channel: args.channel,
    content: args.content,
    scheduledFor: args.scheduledFor,
    status: "scheduled",
    isAutomation: true,
    triggeredBy: "automation_engine",
    recipientName: args.tenantName || undefined,
    recipientEmail: args.channel === "email" ? (args.tenantEmail || undefined) : undefined,
    recipientPhone: args.channel === "whatsapp" ? (args.tenantPhone || undefined) : undefined,
    ...(args.tenantName || args.amountDue != null || args.dueLabel ? {
      templateData: {
        ...(args.tenantName ? { tenantName: args.tenantName } : {}),
        ...(args.amountDue != null ? { amount: args.amountDue } : {}),
        ...(args.dueLabel ? { dueDate: args.dueLabel } : {}),
        firmName: args.firmName,
        messageText: args.content,
      },
    } : {}),
    automationLogId: logId,
    workflowKey: args.workflowKey,
    stepKey: args.stepKey,
    dedupKey: args.dedupKey,
    createdAt: now,
    updatedAt: now,
  });
  return messageId;
}

export const runAutomationEngine = internalMutation({
  args: {},
  handler: withCronReporting("crons:automationEngine", async (ctx): Promise<{
    firms: number; workflowsRun: number; enqueued: number; suppressed: number; skipped: number;
  }> => {
    const now = Date.now();
    // Dispatch at 07:00 UTC (08:00 WAT) the same morning; fall back to
    // now+5min if the 07:00 slot already passed today.
    const todayAt7 = new Date(now); todayAt7.setUTCHours(7, 0, 0, 0);
    const scheduledFor = todayAt7.getTime() > now ? todayAt7.getTime() : now + 5 * 60_000;

    const firms: any[] = await ctx.db.query("firms").take(2000);
    let workflowsRun = 0, enqueued = 0, suppressed = 0, skipped = 0;

    // ── SAME-DAY OVERLAP GUARD (2026-09-14) ─────────────────────────────
    // USER CONTEXT: "I just hope there is no overlap with messages, 'cause
    // you called one rent and service charge and the other service charge."
    // Rent and service charge cycles share due dates in practice, so both
    // workflows could message the SAME resident on the SAME day. Contract:
    // at most ONE payment reminder per resident per day — escalations
    // (Notice of Default / final demands) outrank due-day and pre-due
    // reminders, and rent outranks service charge within the same tier
    // (evaluated first in defs order; Array.prototype.sort is stable).
    // Lease/renewal workflows are informational and exempt.
    const dayStartUtc = new Date(scheduledFor); dayStartUtc.setUTCHours(0, 0, 0, 0);
    const dayStartMs = dayStartUtc.getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

    for (const firm of firms) {
      const firmId = String(firm._id);
      try {
        const workflows = await loadFirmWorkflows(ctx, firmId);
        const firmName = String(firm.name || "your property manager");
        const unitOptOuts = await loadUnitOptOutAliases(ctx, firmId);
        const resolvers: Record<string, () => Promise<EngineTarget[]>> = {
          rent_collection: () => resolveRentTargets(ctx, firmId),
          service_charge: () => resolveServiceChargeTargets(ctx, firmId),
          lease_expiry: () => resolveLeaseTargets(ctx, firmId),
          rent_review: () => resolveRentReviewTargets(ctx, firmId),
        };

        // Tenants that already receive an automated PAYMENT reminder today
        // (pre-seeded from earlier engine runs / re-runs, then appended as
        // this run claims residents).
        const claimedToday = new Set<string>();
        const todaysRows: any[] = await ctx.db
          .query("scheduled_messages")
          .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
          .take(500);
        for (const m of todaysRows) {
          if (!m.isAutomation) continue;
          if (!PAYMENT_WORKFLOW_KEYS.has(String(m.workflowKey))) continue;
          const status = String(m.status || "");
          if (status === "cancelled" || status === "failed" || status === "sent_failed") continue;
          const at = Number(m.scheduledFor || 0);
          if (at < dayStartMs || at >= dayEndMs) continue;
          for (const tid of (m.tenantIds as string[] | undefined) || []) claimedToday.add(String(tid));
        }

        // Collect every trigger-day candidate first, then dispatch in
        // SEVERITY order (escalations > due-day > pre-due > informational).
        interface EngineCandidate { wf: { def: WorkflowDefinition; steps: WorkflowStepDefault[]; enabled: boolean }; step: WorkflowStepDefault; t: EngineTarget; }
        const candidates: EngineCandidate[] = [];
        for (const wf of workflows) {
          if (!wf.enabled) continue;
          workflowsRun++;
          const resolve = resolvers[wf.def.key];
          if (!resolve) continue;
          let targets: EngineTarget[] = [];
          try { targets = await resolve(); } catch (e: any) {
            await logError(ctx, {
              scope: "automation", name: "automationEngine:targetResolution",
              error: e, severity: "warning", firmId,
              context: { workflow: wf.def.key },
            });
            continue;
          }
          if (targets.length === 0) continue;
          for (const step of wf.steps) {
            if (!step.enabled) continue;
            for (const t of targets) {
              if (!isTriggerDay(t.anchorTs, step.offsetDays, now)) continue;
              candidates.push({ wf, step, t });
            }
          }
        }
        candidates.sort((a, b) => paymentSeverity(a.wf.def.key, a.step) - paymentSeverity(b.wf.def.key, b.step));

        for (const { wf, step, t } of candidates) {
          try {
            const isPaymentWf = PAYMENT_WORKFLOW_KEYS.has(wf.def.key);
            if (isPaymentWf && claimedToday.has(String(t.tenantKey))) {
              await recordDispatch(ctx, firmId, wf.def.key, step.key, t.tenantKey, t.periodKey, "suppressed_daily_overlap", undefined,
                "this resident already gets another payment reminder today — one per resident per day");
              suppressed++; continue;
            }
            const dedupKey = buildDedupKey(firmId, wf.def.key, step.key, t.tenantKey, t.periodKey);
            if (await alreadyDispatched(ctx, firmId, wf.def.key, step.key, t.tenantKey, t.periodKey)) {
              skipped++;
              continue;
            }
            // ── Suppression gates ──
            if (unitOptOuts.has(String(t.unitId))) {
              await recordDispatch(ctx, firmId, wf.def.key, step.key, t.tenantKey, t.periodKey, "suppressed_unit_optout");
              suppressed++; continue;
            }
            if (t.extra.paidThisPeriod === true) {
              await recordDispatch(ctx, firmId, wf.def.key, step.key, t.tenantKey, t.periodKey, "suppressed_paid");
              suppressed++; continue;
            }
            if (await isOptedOut(ctx, firmId, t.tenantEmail, t.tenantPhone)) {
              await recordDispatch(ctx, firmId, wf.def.key, step.key, t.tenantKey, t.periodKey, "suppressed_optout");
              suppressed++; continue;
            }
            if (await hasPendingPaymentProof(ctx, firmId, t.tenantKey, t.unitId)) {
              await recordDispatch(ctx, firmId, wf.def.key, step.key, t.tenantKey, t.periodKey, "suppressed_proof_pending");
              suppressed++; continue;
            }
            const channel = resolveChannel(step.channel, t.tenantEmail);
            if (channel === "email" && !t.tenantEmail) {
              await recordDispatch(ctx, firmId, wf.def.key, step.key, t.tenantKey, t.periodKey, "skipped_no_contact", undefined, "email step, tenant has no email");
              skipped++; continue;
            }
            if (channel === "whatsapp" && !t.tenantPhone) {
              await recordDispatch(ctx, firmId, wf.def.key, step.key, t.tenantKey, t.periodKey, "skipped_no_contact", undefined, "whatsapp step, tenant has no phone");
              skipped++; continue;
            }

            const content = renderMergeFields(step.subject, {
              tenant_name: t.tenantName,
              unit_number: t.unitLabel ? `${t.unitLabel}, ${t.propertyName}` : t.propertyName,
              amount_due: t.amountDue,
              due_date: new Date(t.anchorTs).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }),
              property_name: t.propertyName,
              firm_name: firmName,
              payment_link: t.paymentLink,
            });

            const messageId = await enqueueMessage(ctx, {
              firmId, propertyId: t.propertyId, unitId: t.unitId, tenantKey: t.tenantKey,
              tenantName: t.tenantName, tenantEmail: t.tenantEmail, tenantPhone: t.tenantPhone,
              channel, messageType: step.messageType, content,
              amountDue: t.amountDue,
              dueLabel: new Date(t.anchorTs).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }),
              paymentLink: t.paymentLink,
              workflowKey: wf.def.key, stepKey: step.key, dedupKey, scheduledFor, firmName,
            });
            await recordDispatch(ctx, firmId, wf.def.key, step.key, t.tenantKey, t.periodKey, "enqueued", messageId);
            enqueued++;
            if (isPaymentWf) claimedToday.add(String(t.tenantKey));
          } catch (e: any) {
            await logError(ctx, {
              scope: "automation", name: "automationEngine:enqueue",
              error: e, severity: "warning", firmId,
              context: { workflow: wf.def.key, step: step.key },
            });
          }
        }
      } catch (e: any) {
        await logError(ctx, {
          scope: "automation", name: "automationEngine:firmRun",
          error: e, firmId,
        });
      }
    }
    console.log(`[automationEngine] firms=${firms.length} workflows=${workflowsRun} enqueued=${enqueued} suppressed=${suppressed} skipped=${skipped}`);
    return { firms: firms.length, workflowsRun, enqueued, suppressed, skipped };
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Payment suppression hooks (internal — called by portals.ts / paystack)
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = ["scheduled", "sending"] as const;

/** Receipt uploaded → HOLD pending automation messages for that tenant. */
export const onPaymentProofSubmitted = internalMutation({
  args: { firmId: v.string(), tenantKey: v.optional(v.string()), unitId: v.optional(v.string()), tenantEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    let paused = 0;
    for (const status of ACTIVE_STATUSES) {
      const rows: any[] = await ctx.db
        .query("scheduled_messages")
        .withIndex("by_firm_status", (q: any) => q.eq("firmId", args.firmId).eq("status", status))
        .filter((m: any) => {
          if (!m.isAutomation) return false;
          const tenants: string[] = m.tenantIds || [];
          const matchTenant = args.tenantKey && tenants.includes(args.tenantKey);
          const matchUnit = args.unitId && m.unitId === args.unitId;
          const matchEmail = args.tenantEmail && (m.recipientEmail || "").toLowerCase() === args.tenantEmail.toLowerCase();
          return !!(matchTenant || matchUnit || matchEmail);
        })
        .take(100);
      for (const m of rows) {
        if (m.status === "paused") continue;
        await ctx.db.patch(m._id, { status: "paused", pauseReason: "payment_review", pausedAt: now, updatedAt: now });
        paused++;
      }
    }
    return { paused };
  },
});

/** Payment approved/verified → the hold becomes permanent for this period. */
export const onPaymentProofApproved = internalMutation({
  args: { firmId: v.string(), tenantKey: v.optional(v.string()), unitId: v.optional(v.string()), tenantEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    let cancelled = 0;
    const statuses = [...ACTIVE_STATUSES, "paused"] as const;
    for (const status of statuses) {
      const rows: any[] = await ctx.db
        .query("scheduled_messages")
        .withIndex("by_firm_status", (q: any) => q.eq("firmId", args.firmId).eq("status", status))
        .filter((m: any) => {
          if (!m.isAutomation) return false;
          const tenants: string[] = m.tenantIds || [];
          const matchTenant = args.tenantKey && tenants.includes(args.tenantKey);
          const matchUnit = args.unitId && m.unitId === args.unitId;
          const matchEmail = args.tenantEmail && (m.recipientEmail || "").toLowerCase() === args.tenantEmail.toLowerCase();
          return !!(matchTenant || matchUnit || matchEmail);
        })
        .take(100);
      for (const m of rows) {
        // Only collection-ladder messages stop on payment — receipts,
        // lease renewals and court reminders are not payment-driven.
        const mt = String(m.messageType || "");
        if (!["rent_reminder", "late_notice", "service_charge_alert", "penalty_notice", "access_restriction"].includes(mt)) continue;
        await ctx.db.patch(m._id, { status: "cancelled", failureReason: "payment_verified", updatedAt: now });
        cancelled++;
      }
    }
    return { cancelled };
  },
});

/** Proof rejected → the paused sequence RESUMES (day-of + late ladder follows). */
export const onPaymentProofRejected = internalMutation({
  args: { firmId: v.string(), tenantKey: v.optional(v.string()), unitId: v.optional(v.string()), tenantEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    let resumed = 0;
    const rows: any[] = await ctx.db
      .query("scheduled_messages")
      .withIndex("by_firm_status", (q: any) => q.eq("firmId", args.firmId).eq("status", "paused"))
      .filter((m: any) => {
        if (!m.isAutomation || m.pauseReason !== "payment_review") return false;
        const tenants: string[] = m.tenantIds || [];
        const matchTenant = args.tenantKey && tenants.includes(args.tenantKey);
        const matchUnit = args.unitId && m.unitId === args.unitId;
        const matchEmail = args.tenantEmail && (m.recipientEmail || "").toLowerCase() === args.tenantEmail.toLowerCase();
        return !!(matchTenant || matchUnit || matchEmail);
      })
      .take(100);
    for (const m of rows) {
      // Resume: send promptly if the original time passed, else keep the slot.
      const scheduledFor = Math.max(Number(m.scheduledFor || 0), now + 60_000);
      await ctx.db.patch(m._id, { status: "scheduled", scheduledFor, pauseReason: undefined, pausedAt: undefined, updatedAt: now });
      resumed++;
    }
    return { resumed };
  },
});

/** Dispatch-time opt-out check (defense in depth for queued rows). */
export const isContactOptedOut = internalQuery({
  args: { firmId: v.string(), contactKey: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    if (!args.contactKey) return false;
    const row = await ctx.db
      .query("message_opt_outs")
      .withIndex("by_firm_contact", (q: any) => q.eq("firmId", args.firmId).eq("contactKey", args.contactKey.toLowerCase()))
      .first();
    return !!row;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 6b. Unsubscribe support (internal — called by the /unsubscribe HTTP route)
// ─────────────────────────────────────────────────────────────────────────────

export const getFirmName = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args): Promise<string> => {
    try {
      const firm = await ctx.db.get(args.firmId as any);
      return String((firm as any)?.name || "");
    } catch {
      return "";
    }
  },
});

export const recordOptOut = internalMutation({
  args: { firmId: v.string(), contactKey: v.string(), source: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("message_opt_outs")
      .withIndex("by_firm_contact", (q: any) => q.eq("firmId", args.firmId).eq("contactKey", args.contactKey.toLowerCase()))
      .first();
    if (existing) return { success: true, existing: true };
    const channel = args.contactKey.includes("@") ? "email" : "whatsapp";
    await ctx.db.insert("message_opt_outs", {
      firmId: args.firmId,
      contactKey: args.contactKey.toLowerCase(),
      channel,
      token: "http",
      source: args.source,
      createdAt: Date.now(),
    });
    return { success: true, existing: false };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Public API for the Scheduled Messages UI
// ─────────────────────────────────────────────────────────────────────────────

export const getAutomationOverview = query({
  args: { firmId: v.string(), userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    const rows: any[] = await ctx.db
      .query("automation_workflows").withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId)).collect();
    const byKey = new Map(rows.map((r: any) => [String(r.workflowKey), r]));
    const workflows = AUTOMATION_WORKFLOW_DEFAULTS.map((def) => {
      const stored = byKey.get(def.key);
      const steps = def.steps.map((d) => {
        const s = stored && (stored.steps as any[] || []).find((x: any) => String(x.key) === d.key);
        const customSubject = s && typeof s.subject === "string" && s.subject.trim() ? s.subject : null;
        const base = {
          key: d.key, label: d.label, title: d.title, messageType: d.messageType,
          subject: customSubject ?? d.subject,   // EFFECTIVE text residents receive
          defaultSubject: d.subject,             // factory text — the Reset target
          subjectEdited: !!customSubject,
        };
        return s ? { ...base, enabled: !!s.enabled, offsetDays: Number(s.offsetDays ?? d.offsetDays), channel: (s.channel || d.channel) } : { ...base, enabled: d.enabled, offsetDays: d.offsetDays, channel: d.channel };
      });
      return {
        key: def.key, name: def.name, description: def.description, anchor: def.anchor,
        enabled: stored ? !!stored.enabled : def.defaultEnabled,
        steps,
        isCustomized: !!stored,
      };
    });

    // Firm name (message previews render {{firm_name}} exactly as sends do).
    let firmName = "your property manager";
    try {
      const firm: any = await ctx.db.get(args.firmId as any);
      if (firm?.name) firmName = String(firm.name);
    } catch { /* firmId not a doc id — keep the fallback */ }

    // Per-unit opt-outs (the user's per-unit off switch).
    const optRows: any[] = await ctx.db
      .query("automation_unit_opt_outs")
      .withIndex("by_firm_active", (q: any) => q.eq("firmId", args.firmId).eq("active", true))
      .take(2000);
    const optedOutUnits = optRows.map((r: any) => ({ unitKey: String(r.unitKey), label: String(r.label || r.unitKey) }));

    // Live queue counts for the header badges.
    const active: any[] = await ctx.db
      .query("scheduled_messages")
      .withIndex("by_firm_status", (q: any) => q.eq("firmId", args.firmId).eq("status", "scheduled"))
      .take(500);
    const paused: any[] = await ctx.db
      .query("scheduled_messages")
      .withIndex("by_firm_status", (q: any) => q.eq("firmId", args.firmId).eq("status", "paused"))
      .take(500);
    const automationQueue = active.filter((m: any) => m.isAutomation).length;

    return {
      workflows, firmName, optedOutUnits,
      queue: { automationQueued: automationQueue, manualQueued: active.length - automationQueue, paused: paused.length },
    };
  },
});

const STEP_FIELDS = {
  enabled: v.optional(v.boolean()),
  offsetDays: v.optional(v.number()),
  channel: v.optional(v.string()),
  // Custom message text (merge fields allowed). Non-empty → override;
  // EMPTY STRING → reset to the engine default (explicit factory reset).
  subject: v.optional(v.string()),
};

export const setWorkflowEnabled = mutation({
  args: { firmId: v.string(), workflowKey: v.string(), enabled: v.boolean(), userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    const def = AUTOMATION_WORKFLOW_DEFAULTS.find((w) => w.key === args.workflowKey);
    if (!def) throw new Error(`Unknown workflow: ${args.workflowKey}`);
    const existing = await ctx.db
      .query("automation_workflows").withIndex("by_firm_workflow", (q: any) => q.eq("firmId", args.firmId).eq("workflowKey", args.workflowKey)).first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled, updatedAt: now, updatedBy: caller.email || undefined });
    } else {
      await ctx.db.insert("automation_workflows", {
        firmId: args.firmId, workflowKey: args.workflowKey, enabled: args.enabled,
        steps: def.steps.map((s) => ({ key: s.key, enabled: s.enabled, offsetDays: s.offsetDays, channel: s.channel, messageType: s.messageType })),
        seededAt: now, updatedAt: now, updatedBy: caller.email || undefined,
      });
    }
    return { success: true };
  },
});

export const updateWorkflowStep = mutation({
  args: {
    firmId: v.string(), workflowKey: v.string(), stepKey: v.string(),
    ...STEP_FIELDS,
    userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    const def = AUTOMATION_WORKFLOW_DEFAULTS.find((w) => w.key === args.workflowKey);
    const stepDef = def?.steps.find((s) => s.key === args.stepKey);
    if (!def || !stepDef) throw new Error(`Unknown workflow step: ${args.workflowKey}/${args.stepKey}`);
    if (args.offsetDays != null && Math.abs(args.offsetDays) > 180) throw new Error("Offset must be within ±180 days.");

    /** Subject pass-through: provided string (even empty = reset) wins;
     *  absent → preserve the stored override untouched. */
    const mergeSubject = (prev: unknown): string | undefined => {
      if (typeof args.subject === "string") {
        const t = args.subject.trim();
        return t ? t.slice(0, 1000) : undefined;   // empty → default text
      }
      return typeof prev === "string" && prev.trim() ? prev.slice(0, 1000) : undefined;
    };

    const existing = await ctx.db
      .query("automation_workflows").withIndex("by_firm_workflow", (q: any) => q.eq("firmId", args.firmId).eq("workflowKey", args.workflowKey)).first();
    const now = Date.now();
    let steps: Array<{ key: string; enabled: boolean; offsetDays: number; channel: string; messageType: string; subject?: string }>;
    if (existing && Array.isArray(existing.steps) && existing.steps.length) {
      steps = (existing.steps as any[]).map((s: any) => String(s.key) === args.stepKey
        ? { key: s.key, enabled: args.enabled ?? !!s.enabled, offsetDays: args.offsetDays ?? Number(s.offsetDays), channel: args.channel || s.channel, messageType: s.messageType, subject: mergeSubject(s.subject) }
        : { key: s.key, enabled: !!s.enabled, offsetDays: Number(s.offsetDays), channel: s.channel, messageType: s.messageType, ...(typeof s.subject === "string" && s.subject.trim() ? { subject: s.subject } : {}) });
      await ctx.db.patch(existing._id, { steps: steps as any, updatedAt: now, updatedBy: caller.email || undefined });
    } else {
      steps = def.steps.map((s) => s.key === args.stepKey
        ? { key: s.key, enabled: args.enabled ?? s.enabled, offsetDays: args.offsetDays ?? s.offsetDays, channel: args.channel || s.channel, messageType: s.messageType, subject: mergeSubject(undefined) }
        : { key: s.key, enabled: s.enabled, offsetDays: s.offsetDays, channel: s.channel, messageType: s.messageType });
      await ctx.db.insert("automation_workflows", {
        firmId: args.firmId, workflowKey: args.workflowKey, enabled: def.defaultEnabled,
        steps: steps as any, seededAt: now, updatedAt: now, updatedBy: caller.email || undefined,
      });
    }
    return { success: true };
  },
});

/** Target preview for the auto-population panel: who would be messaged now. */
export const previewWorkflowTargets = query({
  args: { firmId: v.string(), workflowKey: v.string(), userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    let targets: EngineTarget[] = [];
    if (args.workflowKey === "rent_collection") targets = await resolveRentTargets(ctx, args.firmId);
    else if (args.workflowKey === "service_charge") targets = await resolveServiceChargeTargets(ctx, args.firmId);
    else if (args.workflowKey === "lease_expiry") targets = await resolveLeaseTargets(ctx, args.firmId);
    else if (args.workflowKey === "rent_review") targets = await resolveRentReviewTargets(ctx, args.firmId);
    const optOuts = await loadUnitOptOutAliases(ctx, args.firmId);
    const effective = targets.filter((t) => !optOuts.has(String(t.unitId)));
    return {
      count: effective.length,   // who actually gets messaged (opted-out units excluded)
      total: targets.length,
      sample: targets.slice(0, 25).map((t) => ({
        tenantName: t.tenantName, unit: t.unitLabel, property: t.propertyName,
        email: t.tenantEmail, phone: t.tenantPhone,
        amountDue: t.amountDue,
        anchor: new Date(t.anchorTs).toISOString().slice(0, 10),
        paid: t.extra.paidThisPeriod === true,
        unitId: t.unitId,                       // for the per-unit off switch
        optedOut: optOuts.has(String(t.unitId)),
      })),
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 7b. Per-unit opt-out (the user's "turn it off per unit" switch)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Turn ALL automated workflows off (or back on) for ONE unit.
 * The stored aliases carry every id shape the unit may be referenced by,
 * so rent/lease/review targets AND service-charge targets match regardless
 * of which format their rows carry.
 */
export const setUnitAutomationOptOut = mutation({
  args: {
    firmId: v.string(), unitKey: v.string(), optOut: v.boolean(),
    label: v.optional(v.string()), propertyAddress: v.optional(v.string()),
    userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    if (!args.unitKey) throw new Error("unitKey is required.");

    // Resolve the property+unit server-side and collect EVERY id shape.
    const aliases = new Set<string>([args.unitKey]);
    let label = (args.label || "").trim() || args.unitKey;
    let propertyAddress = (args.propertyAddress || "").trim() || undefined;
    try {
      const resolver = createUnitResolver(ctx, args.firmId);
      const ref = await resolver.resolveUnit(args.unitKey);
      if (ref) {
        const prop: any = ref.property || {};
        const unit: any = ref.unit;
        const propIds = new Set<string>();
        if (prop._id) propIds.add(String(prop._id));
        if (prop.id != null) propIds.add(String(prop.id));
        const unitParts = new Set<string>();
        if (unit) {
          if (unit.id != null) unitParts.add(String(unit.id));
          if (unit.unitName) unitParts.add(String(unit.unitName));
          if (unit.name) unitParts.add(String(unit.name));
        }
        for (const pid of propIds) {
          for (const up of unitParts) aliases.add(`${pid}_${up}`);
        }
        // A STANDALONE property (no embedded units) IS the unit — its bare
        // ids are genuine unit keys. A multi-unit property must NOT match
        // on its bare id or one opt-out would silence sibling units.
        if (!Array.isArray(prop.units) || prop.units.length === 0) {
          for (const pid of propIds) aliases.add(pid);
        }
        const unitName = unitParts.values().next().value as string | undefined;
        const tenant = String(unit?.tenantName || prop.rentalDetails?.tenantName || "");
        if (unitName) label = (args.label || "").trim() || `${unitName}${tenant ? ` — ${tenant}` : ""}`;
        if (prop.address) propertyAddress = (args.propertyAddress || "").trim() || String(prop.address);
      }
    } catch { /* best-effort enrichment — raw key still works for engine-format ids */ }

    const now = Date.now();
    const all: any[] = await ctx.db
      .query("automation_unit_opt_outs").withIndex("by_firm_unit", (q: any) => q.eq("firmId", args.firmId)).collect();
    const row = all.find((r: any) =>
      String(r.unitKey) === args.unitKey || (r.aliases as string[] | undefined)?.includes(args.unitKey));

    if (args.optOut) {
      if (row) {
        await ctx.db.patch(row._id, {
          active: true,
          aliases: Array.from(aliases),
          label, ...(propertyAddress ? { propertyAddress } : {}),
          updatedAt: now, updatedBy: caller.email || undefined,
        });
      } else {
        await ctx.db.insert("automation_unit_opt_outs", {
          firmId: args.firmId, unitKey: args.unitKey, aliases: Array.from(aliases),
          label, ...(propertyAddress ? { propertyAddress } : {}),
          active: true, createdBy: caller.email || undefined, createdAt: now, updatedAt: now,
        });
      }
      return { success: true, optedOut: true };
    }

    if (row) {
      await ctx.db.patch(row._id, { active: false, updatedAt: now, updatedBy: caller.email || undefined });
      return { success: true, optedOut: false };
    }
    return { success: true, optedOut: false };
  },
});

/** Every unit in the firm with its automation on/off state (management panel). */
export const listUnitAutomationStatus = query({
  args: { firmId: v.string(), userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    const props: any[] = await ctx.db
      .query("properties").withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId)).take(2000);
    const optRows: any[] = await ctx.db
      .query("automation_unit_opt_outs")
      .withIndex("by_firm_active", (q: any) => q.eq("firmId", args.firmId).eq("active", true))
      .take(2000);
    const byKey = new Map<string, any>();
    for (const r of optRows) {
      byKey.set(String(r.unitKey), r);
      for (const a of (r.aliases as string[] | undefined) || []) byKey.set(String(a), r);
    }

    const units: Array<{ unitKey: string; label: string; tenantName: string; property: string; optedOut: boolean }> = [];
    for (const p of props) {
      const addr = String((p as any).address || "").split(",")[0] || "Property";
      const unitsArr: any[] = Array.isArray(p.units) ? p.units : [];
      if (unitsArr.length === 0) {
        // Standalone property — key format matches resolveRentTargets' fallback.
        const tenant = String((p as any).rentalDetails?.tenantName || "");
        units.push({
          unitKey: String(p._id), label: tenant ? `${addr} — ${tenant}` : addr,
          tenantName: tenant, property: addr, optedOut: byKey.has(String(p._id)),
        });
      } else {
        for (const u of unitsArr) {
          // Key format is byte-identical to resolveRentTargets line: u.id != null
          // ? `${p._id}_${u.id}` : String(p._id) — the by-construction match.
          const unitKey = u.id != null ? `${p._id}_${u.id}` : String(p._id);
          const unitName = String(u.unitName || u.name || u.id || "");
          const tenant = String(u.tenantName || (p as any).rentalDetails?.tenantName || "");
          units.push({
            unitKey,
            label: unitName ? `${unitName}${tenant ? ` — ${tenant}` : ""}` : (tenant ? `${addr} — ${tenant}` : addr),
            tenantName: tenant, property: addr, optedOut: byKey.has(unitKey),
          });
        }
      }
    }
    // Tenanted units first (those are the ones residents actually occupy).
    units.sort((a, b) => Number(b.tenantName ? 1 : 0) - Number(a.tenantName ? 1 : 0));
    return { units, optedOutCount: units.filter((u) => u.optedOut).length };
  },
});

/** Live queue for the Scheduled tab: pending + recent outcomes, labelled. */
export const getAutomationQueue = query({
  args: { firmId: v.string(), userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    const collectByStatus = async (status: string, limit: number) => {
      const rows: any[] = await ctx.db
        .query("scheduled_messages")
        .withIndex("by_firm_status", (q: any) => q.eq("firmId", args.firmId).eq("status", status))
        .order("desc")
        .take(limit);
      return rows;
    };
    const [scheduled, sending, paused, sent, failed, cancelled] = await Promise.all([
      collectByStatus("scheduled", 200), collectByStatus("sending", 100), collectByStatus("paused", 100),
      collectByStatus("sent", 60), collectByStatus("failed", 60), collectByStatus("cancelled", 30),
    ]);
    const mapRow = (m: any) => ({
      _id: m._id, status: m.status, channel: m.channel, messageType: m.messageType,
      content: m.content, scheduledFor: m.scheduledFor, sentAt: m.sentAt,
      failureReason: m.failureReason, pauseReason: m.pauseReason,
      isAutomation: !!m.isAutomation, workflowKey: m.workflowKey || null, stepKey: m.stepKey || null,
      triggeredBy: m.triggeredBy || null, tenantIds: m.tenantIds || [],
      recipientName: m.recipientName || null, recipientEmail: m.recipientEmail || null, recipientPhone: m.recipientPhone || null,
      unitId: m.unitId || null,
    });
    return {
      pending: [...scheduled, ...sending].map(mapRow),
      paused: paused.map(mapRow),
      history: [...sent, ...failed, ...cancelled].map(mapRow),
    };
  },
});

/** Pause one queued automation dispatch (manual override). */
export const pauseScheduledAutomation = mutation({
  args: { messageId: v.id("scheduled_messages"), userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const m = await ctx.db.get(args.messageId);
    if (!m) throw new Error("Message not found");
    assertSameFirm(caller, m.firmId as any);
    if (m.status !== "scheduled" && m.status !== "sending") throw new Error(`Cannot pause a message in status '${m.status}'.`);
    const now = Date.now();
    await ctx.db.patch(args.messageId, { status: "paused", pauseReason: "manual", pausedAt: now, updatedAt: now });
    return { success: true };
  },
});

/** Resume a paused dispatch (manual or after rejected proof). */
export const resumeScheduledAutomation = mutation({
  args: { messageId: v.id("scheduled_messages"), userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const m = await ctx.db.get(args.messageId);
    if (!m) throw new Error("Message not found");
    assertSameFirm(caller, m.firmId as any);
    if (m.status !== "paused") throw new Error(`Cannot resume a message in status '${m.status}'.`);
    const now = Date.now();
    await ctx.db.patch(args.messageId, {
      status: "scheduled",
      scheduledFor: Math.max(Number(m.scheduledFor || 0), now + 60_000),
      pauseReason: undefined, pausedAt: undefined, updatedAt: now,
    });
    return { success: true };
  },
});

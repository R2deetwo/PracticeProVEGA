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
  label: string;
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
 */
export const AUTOMATION_WORKFLOW_DEFAULTS: WorkflowDefinition[] = [
  {
    key: "rent_collection",
    name: "Rent & Service Charge Collections",
    description:
      "The full collection ladder: gentle heads-up before rent is due, the due-date demand, a courtesy grace note, then escalating overdue notices (Notice of Default at 7 days, demand at 14).",
    anchor: "each unit's rent due date (day-of-month of the lease start)",
    defaultEnabled: true,
    steps: [
      { key: "pre_7", label: "7 days before due", offsetDays: -7, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Hi {{tenant_name}}, a quick heads-up: your rent of {{amount_due}} for {{unit_number}} is due on {{due_date}}." },
      { key: "pre_3", label: "3 days before due", offsetDays: -3, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Reminder: rent of {{amount_due}} for {{unit_number}} is due in 3 days ({{due_date}})." },
      { key: "pre_1", label: "1 day before due", offsetDays: -1, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Final reminder — {{amount_due}} for {{unit_number}} is due tomorrow, {{due_date}}." },
      { key: "due_day", label: "Due date (morning)", offsetDays: 0, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Your rent of {{amount_due}} for {{unit_number}} is due today ({{due_date}}). Pay here: {{payment_link}}" },
      { key: "grace_3", label: "3 days after (courtesy)", offsetDays: 3, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Courtesy note: we haven't received the {{amount_due}} for {{unit_number}} (was due {{due_date}}). If you've already paid, kindly upload your receipt in your portal." },
      { key: "late_7", label: "7 days late — Notice of Default", offsetDays: 7, enabled: true, channel: "auto", messageType: "late_notice",
        subject: "NOTICE OF DEFAULT: rent of {{amount_due}} for {{unit_number}} is now 7 days overdue (due {{due_date}})." },
      { key: "late_14", label: "14 days late — escalated demand", offsetDays: 14, enabled: true, channel: "auto", messageType: "late_notice",
        subject: "Escalated demand: the outstanding {{amount_due}} for {{unit_number}} (due {{due_date}}) is now 14 days overdue." },
    ],
  },
  {
    key: "service_charge",
    name: "Service Charge & Utility Contributions",
    description:
      "Automated notices for diesel, security, cleaning and other service-charge cycles — before the contribution is due, on the day, and as it falls into arrears.",
    anchor: "each service charge's next due date",
    defaultEnabled: true,
    steps: [
      { key: "pre_3", label: "3 days before due", offsetDays: -3, enabled: true, channel: "auto", messageType: "service_charge_alert",
        subject: "Hi {{tenant_name}}, your {{unit_number}} service charge contribution of {{amount_due}} is due on {{due_date}}." },
      { key: "due_day", label: "Due date", offsetDays: 0, enabled: true, channel: "auto", messageType: "service_charge_alert",
        subject: "Service charge of {{amount_due}} for {{unit_number}} is due today ({{due_date}})." },
      { key: "late_7", label: "7 days overdue", offsetDays: 7, enabled: true, channel: "auto", messageType: "service_charge_alert",
        subject: "Your service charge contribution of {{amount_due}} for {{unit_number}} (due {{due_date}}) is now 7 days in arrears." },
      { key: "late_14", label: "14 days overdue", offsetDays: 14, enabled: true, channel: "auto", messageType: "late_notice",
        subject: "Overdue service charge: {{amount_due}} for {{unit_number}} (due {{due_date}}) is 14 days late. Please settle to avoid penalties." },
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
      { key: "expiry_90", label: "90 days before expiry", offsetDays: -90, enabled: true, channel: "auto", messageType: "lease_renewal",
        subject: "Hi {{tenant_name}}, your tenancy for {{unit_number}} expires on {{due_date}} (90 days). Shall we begin renewal terms?" },
      { key: "expiry_60", label: "60 days before expiry", offsetDays: -60, enabled: true, channel: "auto", messageType: "lease_renewal",
        subject: "Reminder: your {{unit_number}} lease expires {{due_date}} (60 days). Renewal terms are ready when you are." },
      { key: "expiry_30", label: "30 days before expiry", offsetDays: -30, enabled: true, channel: "auto", messageType: "lease_renewal",
        subject: "Final renewal notice: the {{unit_number}} tenancy ends on {{due_date}} (30 days). Confirm your renewal to hold the unit." },
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
      { key: "review_60", label: "60 days before review", offsetDays: -60, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Notice of upcoming rent review for {{unit_number}} effective {{due_date}}." },
      { key: "review_30", label: "30 days before review", offsetDays: -30, enabled: true, channel: "auto", messageType: "rent_reminder",
        subject: "Your rent for {{unit_number}} will be reviewed on {{due_date}} (30 days). New terms will follow in writing." },
    ],
  },
];

/** Vega (legal practice) roadmap — architecture slot, not seeded for Atrium:
 * court_date (7/3/1-day hearing reminders), retainer cycles, filing
 * deadlines. Same engine, same ledger, different target resolvers. */
export const AUTOMATION_WORKFLOW_KEYS = AUTOMATION_WORKFLOW_DEFAULTS.map((w) => w.key);

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

      let paymentLink: string | null = null;
      if (email) {
        const user = await resolver.userByEmail(email.toLowerCase());
        const token = (user as any)?.portalAccessToken;
        if (token) paymentLink = `${PORTAL_BASE}/portal/tenant/${token}`;
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

    let paymentLink: string | null = null;
    if (email) {
      const user = await resolver.userByEmail(email.toLowerCase());
      const token = (user as any)?.portalAccessToken;
      if (token) paymentLink = `${PORTAL_BASE}/portal/tenant/${token}`;
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
      // Merge: stored step overrides (offset/enabled/channel) over defaults;
      // new default steps appear automatically.
      const byStep = new Map((stored.steps as any[]).map((s: any) => [String(s.key), s]));
      const steps = def.steps.map((d) => {
        const s = byStep.get(d.key);
        return s ? { ...d, enabled: !!s.enabled, offsetDays: Number(s.offsetDays ?? d.offsetDays), channel: (s.channel || d.channel) as WorkflowStepDefault["channel"] } : d;
      });
      return { def, steps, enabled: !!stored.enabled };
    }
    return { def, steps: def.steps, enabled: def.defaultEnabled };
  });
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

    for (const firm of firms) {
      const firmId = String(firm._id);
      try {
        const workflows = await loadFirmWorkflows(ctx, firmId);
        const firmName = String(firm.name || "your property manager");
        const resolvers: Record<string, () => Promise<EngineTarget[]>> = {
          rent_collection: () => resolveRentTargets(ctx, firmId),
          service_charge: () => resolveServiceChargeTargets(ctx, firmId),
          lease_expiry: () => resolveLeaseTargets(ctx, firmId),
          rent_review: () => resolveRentReviewTargets(ctx, firmId),
        };

        for (const wf of workflows) {
          if (!wf.enabled) continue;
          workflowsRun++;
          const resolve = resolvers[wf.def.key];
          if (!resolve) continue;
          let targets: EngineTarget[] = [];
          try { targets = await resolve(); } catch (e: any) {
            console.warn(`[automationEngine] target resolution failed firm=${firmId} wf=${wf.def.key}:`, e?.message);
            continue;
          }
          if (targets.length === 0) continue;

          for (const step of wf.steps) {
            if (!step.enabled) continue;
            for (const t of targets) {
              try {
                if (!isTriggerDay(t.anchorTs, step.offsetDays, now)) continue;
                const dedupKey = buildDedupKey(firmId, wf.def.key, step.key, t.tenantKey, t.periodKey);
                if (await alreadyDispatched(ctx, firmId, wf.def.key, step.key, t.tenantKey, t.periodKey)) {
                  skipped++;
                  continue;
                }
                // ── Suppression gates ──
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
              } catch (e: any) {
                console.warn(`[automationEngine] enqueue failed firm=${firmId} wf=${wf.def.key} step=${step.key}:`, e?.message);
              }
            }
          }
        }
      } catch (e: any) {
        console.warn(`[automationEngine] firm ${firmId} failed:`, e?.message);
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
        return s ? { ...d, enabled: !!s.enabled, offsetDays: Number(s.offsetDays ?? d.offsetDays), channel: (s.channel || d.channel) } : d;
      });
      return {
        key: def.key, name: def.name, description: def.description, anchor: def.anchor,
        enabled: stored ? !!stored.enabled : def.defaultEnabled,
        steps,
        isCustomized: !!stored,
      };
    });

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

    return { workflows, queue: { automationQueued: automationQueue, manualQueued: active.length - automationQueue, paused: paused.length } };
  },
});

const STEP_FIELDS = {
  enabled: v.optional(v.boolean()),
  offsetDays: v.optional(v.number()),
  channel: v.optional(v.string()),
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

    const existing = await ctx.db
      .query("automation_workflows").withIndex("by_firm_workflow", (q: any) => q.eq("firmId", args.firmId).eq("workflowKey", args.workflowKey)).first();
    const now = Date.now();
    let steps: Array<{ key: string; enabled: boolean; offsetDays: number; channel: string; messageType: string }>;
    if (existing && Array.isArray(existing.steps) && existing.steps.length) {
      steps = (existing.steps as any[]).map((s: any) => String(s.key) === args.stepKey
        ? { key: s.key, enabled: args.enabled ?? !!s.enabled, offsetDays: args.offsetDays ?? Number(s.offsetDays), channel: args.channel || s.channel, messageType: s.messageType }
        : { key: s.key, enabled: !!s.enabled, offsetDays: Number(s.offsetDays), channel: s.channel, messageType: s.messageType });
      await ctx.db.patch(existing._id, { steps: steps as any, updatedAt: now, updatedBy: caller.email || undefined });
    } else {
      steps = def.steps.map((s) => s.key === args.stepKey
        ? { key: s.key, enabled: args.enabled ?? s.enabled, offsetDays: args.offsetDays ?? s.offsetDays, channel: args.channel || s.channel, messageType: s.messageType }
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
    return {
      count: targets.length,
      sample: targets.slice(0, 25).map((t) => ({
        tenantName: t.tenantName, unit: t.unitLabel, property: t.propertyName,
        email: t.tenantEmail, phone: t.tenantPhone,
        amountDue: t.amountDue,
        anchor: new Date(t.anchorTs).toISOString().slice(0, 10),
        paid: t.extra.paidThisPeriod === true,
      })),
    };
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

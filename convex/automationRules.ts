/**
 * automationRules — the Automation Studio execution engine (Task 48, 2026-09-16).
 *
 * WHAT THIS MODULE MAKES REAL
 * ---------------------------
 * The `automationRules` table ("Your Rules" in Settings → Firm Configuration →
 * Automations) was UI-ONLY for its whole life: a firm could save
 * "When a matter moves to Trial → WhatsApp the client" and nothing ever
 * executed. This module is the missing engine:
 *
 *   EVENT-DRIVEN TRIGGERS (fired from myFunctions createItem / updateItem,
 *   same transaction, non-blocking — an engine error can NEVER fail the
 *   user's save):
 *     matter_created            → createItem("matters")
 *     lead_created              → createItem("leads")
 *     event_created             → createItem("events")   (triggerValue: any|hearing|deadline|meeting)
 *     document_uploaded         → createItem("documents")(triggerValue: any|client_portal)
 *     matter_stage_change       → updateItem("matters") where stage actually changed
 *
 *   TIME-BASED TRIGGERS (daily sweep cron "ruleEngineSweep", 6:45 UTC —
 *   after the Atrium engine at 6:30 so the two engines never write in the
 *   same instant):
 *     invoice_overdue           → invoice past dueDate, status not Paid/Voided/Draft
 *     task_overdue              → task past dueDate, status not done (triggerValue: any|High|Medium|Low)
 *     client_onboarding_incomplete → matter ≥24h old with NO tasks, documents
 *                                    or events attached (the honest definition:
 *                                    a matter nobody has worked on)
 *
 *   The four property_* trigger types in the client enum are DELIBERATELY
 *   not executed here: rent/lease/maintenance messaging is owned by the
 *   Atrium automationEngine (convex/automationEngine.ts) — the single
 *   orchestration point directive. A rule saved with one of those triggers
 *   simply never matches (and the builder UI no longer offers them).
 *
 * ACTIONS
 *   create_task      → direct tasks insert (assigned to the matter's team,
 *                      falling back to the firm's admin users). Marks
 *                      isSystem=true, creatorId="automation".
 *   send_email       → scheduled_messages row (channel email) → the 5-minute
 *                      dispatcher delivers it with the branded footer +
 *                      unsubscribe + opt-out enforcement for free.
 *   send_whatsapp    → scheduled_messages row (channel whatsapp) → same
 *                      dispatcher (template retry, status sync).
 *   generate_document→ NOT yet automated (document generation needs a
 *                      template-rendering pipeline that doesn't exist yet).
 *                      Logged honestly as outcome "skipped_unsupported" —
 *                      the rule stays visible in the activity log instead
 *                      of silently doing nothing.
 *
 * IDEMPOTENCY (the hard contract, same as the Atrium engine):
 *   Every dispatch writes an automation_dispatch_log ledger row keyed
 *   firmId | workflowKey="rule:<ruleId>" | stepKey=<triggerType> |
 *   tenantKey=<entityId> | periodKey="once". A ledger row existing means
 *   that rule has ALREADY fired for that entity — forever. So a matter
 *   created, edited ten times, stage-flipped back and forth, can never
 *   double-fire matter_created; an invoice nagging rule fires ONCE per
 *   invoice, not daily spam. The task insert additionally carries an
 *   idempotencyKey (tasks.by_idempotency) as a belt-and-braces guard.
 *
 * MERGE FIELDS available in task titles/descriptions, email subjects/bodies
 * and WhatsApp messages (rendered with the SAME renderer as the Atrium
 * engine — unknown tags are stripped, never leak syntax):
 *   {{client_name}} {{matter_title}} {{matter_type}} {{matter_stage}}
 *   {{firm_name}} {{invoice_number}} {{amount_due}} {{due_date}}
 *   {{event_title}} {{event_type}} {{lead_name}} {{task_title}}
 */

import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { renderMergeFields } from "./automationEngine";
import { requireStaffCaller } from "./callerAuth";
import { withCronReporting } from "./observability";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Types + pure helpers (exported for unit tests)
// ─────────────────────────────────────────────────────────────────────────────

/** The eight trigger types this engine executes. */
export const RULE_TRIGGER_TYPES = [
  "matter_stage_change",
  "matter_created",
  "invoice_overdue",
  "lead_created",
  "event_created",
  "task_overdue",
  "document_uploaded",
  "client_onboarding_incomplete",
] as const;

export type RuleTriggerType = (typeof RULE_TRIGGER_TYPES)[number];

/** The four client-enum property triggers owned by the Atrium engine. */
export const PROPERTY_ONLY_TRIGGERS = new Set([
  "property_rent_due",
  "property_rent_overdue",
  "property_lease_expiring",
  "property_maintenance_reported",
]);

export function isExecutableTrigger(t: string): boolean {
  return (RULE_TRIGGER_TYPES as readonly string[]).includes(t);
}

const norm = (v: string | null | undefined) => (v || "").trim().toLowerCase();

/**
 * Does a rule's triggerValue match this event?
 *   matter_stage_change  → exact stage name (case-insensitive)
 *   event_created        → 'any' | substring of the event type (hearing/deadline/meeting)
 *   task_overdue         → 'any' | exact priority name (High/Medium/Low)
 *   document_uploaded    → 'any' | 'client_portal' (matches documents.source)
 *   everything else      → 'any' (value ignored)
 */
export function ruleTriggerMatches(
  rule: { triggerType: string; triggerValue?: string | null },
  ctx: { triggerType: string; value?: string | null },
): boolean {
  if (rule.triggerType !== ctx.triggerType) return false;
  if (!isExecutableTrigger(rule.triggerType)) return false;
  const want = norm(rule.triggerValue || "any");
  const have = norm(ctx.value || "");
  if (want === "any" || want === "") return true;
  switch (ctx.triggerType) {
    case "matter_stage_change":
      return want === have;
    case "event_created":
      // "Court Hearing" matches triggerValue 'hearing'; 'deadline' matches
      // "Filing Deadline". Substring keeps it forgiving across the firm's
      // custom event-type names.
      return have.includes(want);
    case "task_overdue":
      return want === have;
    case "document_uploaded":
      return want === have;
    default:
      return true;
  }
}

/** Ledger/dedup key — identical shape to the Atrium engine's contract. */
export function ruleDedupKey(
  firmId: string,
  ruleId: string,
  triggerType: string,
  entityId: string,
): string {
  return `${firmId}|rule:${ruleId}|${triggerType}|${entityId}|once`;
}

/** The shape of one rule's actions as stored in automationRules.actions. */
export interface RuleAction {
  type?: string;
  taskTitle?: string;
  dueInDays?: number;
  priority?: string;
  description?: string;
  emailSubject?: string;
  emailBody?: string;
  whatsappMessage?: string;
  templateId?: string;
  [k: string]: unknown;
}

export interface RuleLike {
  _id?: unknown;
  id?: string | null;
  firmId?: string | null;
  name?: string | null;
  triggerType?: string | null;
  triggerValue?: string | null;
  actions?: RuleAction[] | null;
  isEnabled?: boolean | null;
}

/** Entity snapshot handed to the dispatcher — one field per trigger family. */
export interface RuleEventContext {
  triggerType: RuleTriggerType;
  /** triggerValue discriminator (new stage / event type / task priority / doc source) */
  value?: string | null;
  entityId: string;
  matter?: {
    id?: string | null;
    title?: string | null;
    type?: string | null;
    stage?: string | null;
    clientId?: string | null;
    assignedUsers?: string[];
  } | null;
  lead?: { name?: string | null; email?: string | null } | null;
  event?: { title?: string | null; type?: string | null; matterId?: string | null } | null;
  document?: { title?: string | null; source?: string | null; matterId?: string | null; uploadedBy?: string | null } | null;
  invoice?: {
    invoiceNumber?: string | null;
    total?: number | null;
    dueDate?: string | null;
    matterId?: string | null;
    clientName?: string | null;
    clientEmail?: string | null;
  } | null;
  task?: { title?: string | null; priority?: string | null; dueDate?: string | null; matterId?: string | null } | null;
}

/** Build the merge-var map for one event (pure — exported for tests). */
export function ruleMergeVars(
  firmName: string,
  e: RuleEventContext,
  clientName: string | null,
): Record<string, unknown> {
  return {
    firm_name: firmName || "your firm",
    client_name: clientName,
    matter_title: e.matter?.title || null,
    matter_type: e.matter?.type || null,
    matter_stage: e.matter?.stage || (e.triggerType === "matter_stage_change" ? e.value : null),
    invoice_number: e.invoice?.invoiceNumber || null,
    amount_due: e.invoice?.total ?? null,
    due_date: e.invoice?.dueDate || e.task?.dueDate || null,
    event_title: e.event?.title || null,
    event_type: e.event?.type || (e.triggerType === "event_created" ? e.value : null),
    lead_name: e.lead?.name || null,
    task_title: e.task?.title || null,
  };
}

/** Task payload for create_task (pure — exported for tests). */
export function buildTaskPayload(
  action: RuleAction,
  firmName: string,
  e: RuleEventContext,
  clientName: string | null,
  nowMs: number,
): { title: string; description: string; priority: string; dueDate: string | null } {
  const vars = ruleMergeVars(firmName, e, clientName);
  const dueInDays = Number(action.dueInDays ?? 0);
  const dueMs = nowMs + dueInDays * 86_400_000;
  const dateStr = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : String(v);
  return {
    title: renderMergeFields(String(action.taskTitle || "Follow up"), vars).slice(0, 200),
    description: renderMergeFields(
      String(action.description || `Created automatically by automation rule (${e.triggerType}).`),
      vars,
    ).slice(0, 1000),
    priority: ["High", "Medium", "Low"].includes(String(action.priority))
      ? String(action.priority)
      : "Medium",
    dueDate: dateStr(new Date(dueMs).toISOString()),
  };
}

/** Message payload for send_email / send_whatsapp (pure — exported for tests). */
export function buildMessagePayload(
  action: RuleAction,
  firmName: string,
  e: RuleEventContext,
  clientName: string | null,
): { channel: "email" | "whatsapp"; subject: string; body: string } {
  const vars = ruleMergeVars(firmName, e, clientName);
  const isEmail = action.type === "send_email";
  return {
    channel: isEmail ? "email" : "whatsapp",
    subject: isEmail
      ? renderMergeFields(String(action.emailSubject || "Update on your matter"), vars).slice(0, 200)
      : "",
    body: renderMergeFields(
      String(
        isEmail
          ? action.emailBody || ""
          : action.whatsappMessage || "",
      ),
      vars,
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Server-side helpers
// ─────────────────────────────────────────────────────────────────────────────

function stableEntityId(doc: { _id?: unknown; id?: string | null }): string {
  return String(doc.id || doc._id || "");
}

async function getFirmName(ctx: any, firmId: string): Promise<string> {
  const firm = await ctx.db.get(firmId as any);
  return String(firm?.name || "your firm");
}

/** The client contact behind a matter (for name/email/phone resolution). */
async function resolveMatterClient(ctx: any, firmId: string, clientId: string | null | undefined) {
  if (!clientId) return null;
  const contact = await ctx.db
    .query("contacts")
    .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
    .filter((q: any) => q.eq(q.field("id"), clientId))
    .first();
  return contact || null;
}

/** Firm admin fallback assignees for tasks on unassigned matters. */
async function resolveAdminAssignees(ctx: any, firmId: string): Promise<string[]> {
  const users: any[] = await ctx.db
    .query("users")
    .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
    .take(200);
  const adminRoles = new Set(["Admin", "Lawyer", "Paralegal"]);
  const admins = users.filter((u) => adminRoles.has(u.role));
  return admins.slice(0, 5).map((u) => String(u._id));
}

/** Resolve message recipient (name + email/phone) for an event context. */
async function resolveRecipient(
  ctx: any,
  firmId: string,
  e: RuleEventContext,
): Promise<{ name: string | null; email: string | null; phone: string | null } | null> {
  // Leads carry their own email.
  if (e.triggerType === "lead_created" && e.lead) {
    if (!e.lead.email) return null;
    return { name: e.lead.name || null, email: e.lead.email, phone: null };
  }
  // Invoices: embedded client object first, then the matter's contact.
  if (e.triggerType === "invoice_overdue" && e.invoice) {
    if (e.invoice.clientEmail) {
      return { name: e.invoice.clientName || null, email: e.invoice.clientEmail, phone: null };
    }
    if (e.invoice.matterId) {
      const matter = await ctx.db
        .query("matters")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .filter((q: any) => q.eq(q.field("id"), e.invoice!.matterId))
        .first();
      if (matter?.clientId) {
        const c = await resolveMatterClient(ctx, firmId, matter.clientId);
        if (c && (c.email || c.phone)) {
          return { name: c.name || null, email: c.email || null, phone: c.phone || null };
        }
      }
    }
    return null;
  }
  // Matter-family triggers: the matter's client contact.
  const matter = e.matter
    || (e.event?.matterId
      ? await ctx.db
          .query("matters")
          .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
          .filter((q: any) => q.eq(q.field("id"), e.event!.matterId))
          .first()
      : null)
    || (e.document?.matterId
      ? await ctx.db
          .query("matters")
          .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
          .filter((q: any) => q.eq(q.field("id"), e.document!.matterId))
          .first()
      : null)
    || (e.task?.matterId
      ? await ctx.db
          .query("matters")
          .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
          .filter((q: any) => q.eq(q.field("id"), e.task!.matterId))
          .first()
      : null);
  if (matter?.clientId) {
    const c = await resolveMatterClient(ctx, firmId, matter.clientId);
    if (c && (c.email || c.phone)) {
      return { name: c.name || null, email: c.email || null, phone: c.phone || null };
    }
  }
  return null;
}

async function recordRuleDispatch(
  ctx: any,
  args: {
    firmId: string; ruleId: string; triggerType: string; entityId: string;
    outcome: string; detail?: string;
  },
) {
  await ctx.db.insert("automation_dispatch_log", {
    firmId: args.firmId,
    workflowKey: `rule:${args.ruleId}`,
    stepKey: args.triggerType,
    tenantKey: args.entityId,
    periodKey: "once",
    outcome: args.outcome,
    ...(args.detail ? { detail: args.detail.slice(0, 300) } : {}),
    createdAt: Date.now(),
  });
}

async function hasDispatched(
  ctx: any,
  firmId: string,
  ruleId: string,
  triggerType: string,
  entityId: string,
): Promise<boolean> {
  const existing = await ctx.db
    .query("automation_dispatch_log")
    .withIndex("by_dedup", (q: any) =>
      q.eq("firmId", firmId)
        .eq("workflowKey", `rule:${ruleId}`)
        .eq("stepKey", triggerType)
        .eq("tenantKey", entityId)
        .eq("periodKey", "once"),
    )
    .first();
  return Boolean(existing);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. The dispatcher (plain function — called inline by myFunctions hooks
//    inside try/catch, so a failure can NEVER roll back the user's write)
// ─────────────────────────────────────────────────────────────────────────────

export interface DispatchResult {
  rulesEvaluated: number;
  tasksCreated: number;
  messagesEnqueued: number;
  skipped: number;
}

export async function dispatchRulesForEvent(
  ctx: any,
  args: { firmId: string; event: RuleEventContext },
): Promise<DispatchResult> {
  const { firmId, event } = args;
  const result: DispatchResult = { rulesEvaluated: 0, tasksCreated: 0, messagesEnqueued: 0, skipped: 0 };
  if (!isExecutableTrigger(event.triggerType)) return result;

  const rules: any[] = await ctx.db
    .query("automationRules")
    .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
    .take(200);

  const matching = rules.filter(
    (r) =>
      r.isEnabled !== false &&
      ruleTriggerMatches(
        { triggerType: String(r.triggerType || ""), triggerValue: r.triggerValue },
        { triggerType: event.triggerType, value: event.value },
      ),
  );
  result.rulesEvaluated = matching.length;
  if (matching.length === 0) return result;

  const firmName = await getFirmName(ctx, firmId);
  const recipient = await resolveRecipient(ctx, firmId, event);
  const clientName = recipient?.name || null;

  for (const rule of matching) {
    const ruleId = String(rule.id || rule._id || "");
    if (!ruleId) continue;
    // Idempotency: once per rule per entity, forever.
    if (await hasDispatched(ctx, firmId, ruleId, event.triggerType, event.entityId)) {
      result.skipped++;
      continue;
    }

    const actions: RuleAction[] = Array.isArray(rule.actions) ? rule.actions : [];
    const outcomes: string[] = [];
    for (const action of actions) {
      try {
        if (action.type === "create_task") {
          const payload = buildTaskPayload(action, firmName, event, clientName, Date.now());
          const assignees =
            (event.matter?.assignedUsers && event.matter.assignedUsers.length > 0
              ? event.matter.assignedUsers
              : null) || (await resolveAdminAssignees(ctx, firmId));
          const nowIso = new Date().toISOString();
          await ctx.db.insert("tasks", {
            firmId,
            title: payload.title,
            description: payload.description,
            status: "todo",
            dueDate: payload.dueDate,
            assignedUsers: assignees,
            assigneeType: "team",
            matterId: event.matter?.id || event.task?.matterId || event.invoice?.matterId || event.event?.matterId || event.document?.matterId || null,
            creatorId: "automation",
            priority: payload.priority.toLowerCase(),
            isSystem: true,
            idempotencyKey: ruleDedupKey(firmId, ruleId, event.triggerType, event.entityId),
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          outcomes.push("enqueued_task");
          result.tasksCreated++;
        } else if (action.type === "send_email" || action.type === "send_whatsapp") {
          const payload = buildMessagePayload(action, firmName, event, clientName);
          const email = action.type === "send_email" ? recipient?.email : null;
          const phone = action.type === "send_whatsapp" ? recipient?.phone : null;
          if (!email && !phone) {
            outcomes.push("skipped_no_recipient");
            continue;
          }
          const now = Date.now();
          const content = payload.channel === "email" && payload.subject
            ? `${payload.subject}\n\n${payload.body}`
            : payload.body;
          const logId = await ctx.db.insert("automation_logs", {
            firmId,
            messageType: "custom",
            channel: payload.channel,
            recipient: String(email || phone || recipient?.name || event.entityId),
            messagePreview: content.slice(0, 120),
            messageContent: content,
            direction: "outbound",
            senderName: "Automation Rule",
            sentAt: now,
            status: "sending",
            triggeredBy: `rule:${ruleId}`,
          });
          await ctx.db.insert("scheduled_messages", {
            firmId,
            messageType: "automation_rule",
            channel: payload.channel,
            content,
            scheduledFor: now + 60_000, // next 5-min dispatcher tick
            status: "scheduled",
            isAutomation: true,
            triggeredBy: "automation_rule",
            recipientName: recipient?.name || undefined,
            recipientEmail: email || undefined,
            recipientPhone: phone || undefined,
            automationLogId: logId,
            workflowKey: `rule:${ruleId}`,
            stepKey: event.triggerType,
            dedupKey: ruleDedupKey(firmId, ruleId, event.triggerType, event.entityId),
            createdAt: now,
            updatedAt: now,
          });
          outcomes.push(payload.channel === "email" ? "enqueued_email" : "enqueued_whatsapp");
          result.messagesEnqueued++;
        } else if (action.type === "generate_document") {
          // Honest non-execution — visible in the activity log, never silent.
          outcomes.push("skipped_unsupported");
        }
      } catch (err: any) {
        console.warn(
          `[automationRules] action failed (rule ${ruleId}, ${action.type} on ${event.triggerType}/${event.entityId}):`,
          err?.message,
        );
        outcomes.push("error");
      }
    }

    const primary = outcomes.includes("enqueued_task")
      ? "enqueued_task"
      : outcomes.includes("enqueued_email")
        ? "enqueued_email"
        : outcomes.includes("enqueued_whatsapp")
          ? "enqueued_whatsapp"
          : outcomes[0] || "no_action";
    await recordRuleDispatch(ctx, {
      firmId,
      ruleId,
      triggerType: event.triggerType,
      entityId: event.entityId,
      outcome: primary,
      detail: `rule="${rule.name || ruleId}" outcomes=[${outcomes.join(",")}]`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Time-based sweep (cron "ruleEngineSweep", daily 6:45 UTC)
// ─────────────────────────────────────────────────────────────────────────────

/** Invoice statuses that must NOT trigger overdue rules. */
export const INVOICE_OPEN_STATUSES = new Set(["sent", "overdue", "partially_paid", "unpaid", ""]);
const INVOICE_CLOSED_STATUSES = new Set(["paid", "voided", "void", "draft", "written_off"]);

export function isInvoiceOverdue(invoice: { status?: string | null; dueDate?: string | null }, nowMs: number): boolean {
  const status = norm(invoice.status);
  if (INVOICE_CLOSED_STATUSES.has(status)) return false;
  if (!invoice.dueDate) return false;
  const due = Date.parse(String(invoice.dueDate));
  if (isNaN(due)) return false;
  return due < nowMs;
}

export const TASK_OPEN_STATUSES = new Set(["todo", "to do", "in_progress", "in progress", "open", "pending", ""]);

export function isTaskOverdue(task: { status?: string | null; dueDate?: string | null }, nowMs: number): boolean {
  const status = norm(task.status);
  if (!TASK_OPEN_STATUSES.has(status)) return false;
  if (!task.dueDate) return false;
  const due = Date.parse(String(task.dueDate));
  if (isNaN(due)) return false;
  return due < nowMs;
}

/** A matter nobody has worked on: ≥24h old, no tasks, no documents, no events. */
export function isOnboardingIncomplete(
  matter: { createdAt?: string | null },
  counts: { tasks: number; documents: number; events: number },
  nowMs: number,
): boolean {
  if (!matter.createdAt) return false;
  const created = Date.parse(String(matter.createdAt));
  if (isNaN(created)) return false;
  const ageMs = nowMs - created;
  if (ageMs < 24 * 3_600_000) return false;
  return counts.tasks === 0 && counts.documents === 0 && counts.events === 0;
}

export const runRuleEngineSweep = internalMutation({
  args: {},
  handler: withCronReporting("crons:ruleEngineSweep", async (ctx): Promise<{
    firms: number; rulesEvaluated: number; triggered: number;
  }> => {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const firms: any[] = await ctx.db.query("firms").take(2000);
    let rulesEvaluated = 0;
    let triggered = 0;

    for (const firm of firms) {
      const firmId = String(firm._id);
      try {
        const rules: any[] = await ctx.db
          .query("automationRules")
          .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
          .take(200);
        const active = rules.filter((r) => r.isEnabled !== false);
        if (active.length === 0) continue;

        const wants = (t: string) => active.some((r) => String(r.triggerType) === t);

        // ── invoice_overdue ────────────────────────────────────────────
        if (wants("invoice_overdue")) {
          const invoices: any[] = await ctx.db
            .query("invoices")
            .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
            .take(500);
          for (const inv of invoices) {
            if (!isInvoiceOverdue(inv, now)) continue;
            const client = (inv.client && typeof inv.client === "object" ? inv.client : {}) as any;
            rulesEvaluated++;
            const res = await dispatchRulesForEvent(ctx, {
              firmId,
              event: {
                triggerType: "invoice_overdue",
                value: "any",
                entityId: String(inv.id || inv._id),
                invoice: {
                  invoiceNumber: inv.invoiceNumber || null,
                  total: Number(inv.total_amount ?? inv.subTotal ?? 0) || null,
                  dueDate: inv.dueDate || null,
                  matterId: inv.matter?.id || inv.matterId || null,
                  clientName: client.name || null,
                  clientEmail: client.email || null,
                },
              },
            });
            if (res.rulesEvaluated > 0) triggered++;
          }
        }

        // ── task_overdue ───────────────────────────────────────────────
        if (wants("task_overdue")) {
          const tasks: any[] = await ctx.db
            .query("tasks")
            .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
            .take(500);
          for (const t of tasks) {
            if (!isTaskOverdue(t, now)) continue;
            // Automation-created tasks are themselves excluded — a rule
            // reacting to its own output would loop.
            if (t.creatorId === "automation") continue;
            rulesEvaluated++;
            const res = await dispatchRulesForEvent(ctx, {
              firmId,
              event: {
                triggerType: "task_overdue",
                value: t.priority || "medium",
                entityId: String(t.id || t._id),
                task: {
                  title: t.title || null,
                  priority: t.priority || null,
                  dueDate: t.dueDate || null,
                  matterId: t.matterId || null,
                },
              },
            });
            if (res.rulesEvaluated > 0) triggered++;
          }
        }

        // ── client_onboarding_incomplete ───────────────────────────────
        if (wants("client_onboarding_incomplete")) {
          const matters: any[] = await ctx.db
            .query("matters")
            .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
            .take(500);
          for (const m of matters) {
            // Only matters created in the last 14 days — older dormant
            // matters are a different problem (the anomaly detector owns
            // those), and the ledger dedups per-matter anyway.
            const created = m.createdAt ? Date.parse(String(m.createdAt)) : NaN;
            if (isNaN(created) || now - created > 14 * 86_400_000) continue;
            const [taskRows, docRows, eventRows] = await Promise.all([
              ctx.db.query("tasks").withIndex("by_matter", (q: any) => q.eq("matterId", String(m.id || m._id))).take(5),
              ctx.db.query("documents").withIndex("by_matter", (q: any) => q.eq("matterId", String(m.id || m._id))).take(5),
              ctx.db.query("events").withIndex("by_matter", (q: any) => q.eq("matterId", String(m.id || m._id))).take(5),
            ]);
            if (!isOnboardingIncomplete(m, { tasks: taskRows.length, documents: docRows.length, events: eventRows.length }, now)) continue;
            rulesEvaluated++;
            const res = await dispatchRulesForEvent(ctx, {
              firmId,
              event: {
                triggerType: "client_onboarding_incomplete",
                value: "any",
                entityId: String(m.id || m._id),
                matter: {
                  id: String(m.id || m._id),
                  title: m.title || null,
                  type: m.type || null,
                  stage: m.stage || null,
                  clientId: m.clientId || null,
                  assignedUsers: Array.isArray(m.assignedUsers) ? m.assignedUsers : [],
                },
              },
            });
            if (res.rulesEvaluated > 0) triggered++;
          }
        }
      } catch (err: any) {
        console.warn(`[ruleEngineSweep] firm ${firmId} failed:`, err?.message);
      }
    }
    console.log(`[ruleEngineSweep] firms=${firms.length} rulesEvaluated=${rulesEvaluated} triggered=${triggered} at=${nowIso}`);
    return { firms: firms.length, rulesEvaluated, triggered };
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. UI support — per-rule activity (last fired + counts) for Automation Studio
// ─────────────────────────────────────────────────────────────────────────────

export const getRuleActivity = query({
  args: { firmId: v.string(), userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    const rows: any[] = await ctx.db
      .query("automation_dispatch_log")
      .withIndex("by_firm_workflow", (q: any) => q.eq("firmId", args.firmId))
      .take(1000);
    const activity: Record<string, { lastFiredAt: number; total: number; lastOutcome: string }> = {};
    for (const r of rows) {
      const wk = String(r.workflowKey || "");
      if (!wk.startsWith("rule:")) continue;
      const ruleId = wk.slice(5);
      const at = Number(r.createdAt || 0);
      const cur = activity[ruleId];
      if (!cur) {
        activity[ruleId] = { lastFiredAt: at, total: 1, lastOutcome: String(r.outcome || "") };
      } else {
        cur.total++;
        if (at > cur.lastFiredAt) {
          cur.lastFiredAt = at;
          cur.lastOutcome = String(r.outcome || "");
        }
      }
    }
    return activity;
  },
});

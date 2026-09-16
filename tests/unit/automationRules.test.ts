/**
 * Automation Studio rule-execution engine contract tests (Task 48, 2026-09-16).
 *
 * THE GAP THIS ENGINE CLOSES: the `automationRules` table was UI-only for its
 * whole life — a firm could save "When a matter moves to Trial → WhatsApp the
 * client" and NOTHING ever executed. These tests pin the new contract:
 *
 * PART 1 — pure engine logic: trigger matching (stage/event-type/priority/
 *   source discriminators), once-forever dedup keys, merge-field rendering,
 *   task + message payload building, and the sweep selection predicates
 *   (invoice/task overdue, onboarding-incomplete).
 * PART 2 — wiring contracts (source-scanned so removal fails CI):
 *   - createItem dispatches matter_created / lead_created / event_created /
 *     document_uploaded; updateItem dispatches matter_stage_change on REAL
 *     stage changes; participant portal attachments dispatch
 *     document_uploaded with value 'client_portal'
 *   - every hook is non-blocking (try/catch — an engine error can never
 *     fail the user's save)
 *   - the ruleEngineSweep cron is registered at 6:45 UTC (a quarter-hour
 *     after the Atrium engine at 6:30)
 *   - dispatch writes an automation_dispatch_log ledger row keyed
 *     rule:<id> with periodKey "once" (the once-per-rule-per-entity
 *     idempotency contract)
 *   - generate_document is honestly non-executing (outcome
 *     skipped_unsupported — never a silent no-op)
 *   - the property_* triggers are NOT executed here (owned by the Atrium
 *     engine — the single-orchestration-point directive)
 *   - getRuleActivity is staff-guarded (identity audit)
 *   - the UI surfaces live activity + blueprint ideas and isolates the
 *     activity query behind a SectionErrorBoundary (version-skew safety)
 * PART 3 — Practice Blueprint merge-engine contracts (Task 47 backfill):
 *   additive-only, idempotent re-run, workflow sub-category merge — the
 *   guarantees the "Re-run Blueprint" UI promises ("Existing data is kept").
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/automationRules.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

// The engine module imports the same Convex-generated scaffolding as
// automationEngine (which tests already import directly) — no runtime
// execution happens at import time.
import {
    ruleTriggerMatches,
    ruleDedupKey,
    ruleMergeVars,
    buildTaskPayload,
    buildMessagePayload,
    isExecutableTrigger,
    isInvoiceOverdue,
    isTaskOverdue,
    isOnboardingIncomplete,
    PROPERTY_ONLY_TRIGGERS,
    RULE_TRIGGER_TYPES,
    type RuleEventContext,
} from '../../convex/automationRules';
import {
    buildLegalPlan,
    buildAtriumPlan,
    mergePlans,
} from '../../src/hooks/usePracticeProfile';
import { getProfilesForAreas } from '../../src/config/practiceProfileLibrary';
import { getAtriumProfilesForPortfolio } from '../../src/config/atriumProfileLibrary';

// ─── PART 1: pure engine logic ──────────────────────────────────────────────

describe('automation rules: trigger matching', () => {
    it('matter_stage_change matches the stage exactly (case-insensitive)', () => {
        const rule = { triggerType: 'matter_stage_change', triggerValue: 'Trial' };
        expect(ruleTriggerMatches(rule, { triggerType: 'matter_stage_change', value: 'trial' })).toBe(true);
        expect(ruleTriggerMatches(rule, { triggerType: 'matter_stage_change', value: 'Pre-Trial' })).toBe(false);
        expect(ruleTriggerMatches(rule, { triggerType: 'matter_created', value: 'any' })).toBe(false);
    });

    it('event_created: any matches all; hearing/deadline/meeting match by substring of the event type', () => {
        const anyRule = { triggerType: 'event_created', triggerValue: 'any' };
        expect(ruleTriggerMatches(anyRule, { triggerType: 'event_created', value: 'Court Hearing' })).toBe(true);
        const hearingRule = { triggerType: 'event_created', triggerValue: 'hearing' };
        expect(ruleTriggerMatches(hearingRule, { triggerType: 'event_created', value: 'Court Hearing' })).toBe(true);
        expect(ruleTriggerMatches(hearingRule, { triggerType: 'event_created', value: 'Filing Deadline' })).toBe(false);
        const deadlineRule = { triggerType: 'event_created', triggerValue: 'deadline' };
        expect(ruleTriggerMatches(deadlineRule, { triggerType: 'event_created', value: 'Filing Deadline' })).toBe(true);
    });

    it('task_overdue matches priority; document_uploaded matches source', () => {
        const highRule = { triggerType: 'task_overdue', triggerValue: 'High' };
        expect(ruleTriggerMatches(highRule, { triggerType: 'task_overdue', value: 'high' })).toBe(true);
        expect(ruleTriggerMatches(highRule, { triggerType: 'task_overdue', value: 'low' })).toBe(false);
        expect(ruleTriggerMatches({ triggerType: 'task_overdue', triggerValue: 'any' }, { triggerType: 'task_overdue', value: 'low' })).toBe(true);
        const portalRule = { triggerType: 'document_uploaded', triggerValue: 'client_portal' };
        expect(ruleTriggerMatches(portalRule, { triggerType: 'document_uploaded', value: 'client_portal' })).toBe(true);
        expect(ruleTriggerMatches(portalRule, { triggerType: 'document_uploaded', value: 'internal' })).toBe(false);
    });

    it('a missing/empty triggerValue behaves as "any"', () => {
        expect(ruleTriggerMatches({ triggerType: 'matter_stage_change', triggerValue: '' }, { triggerType: 'matter_stage_change', value: 'Trial' })).toBe(true);
        expect(ruleTriggerMatches({ triggerType: 'matter_stage_change' }, { triggerType: 'matter_stage_change', value: 'Trial' })).toBe(true);
    });

    it('property_* triggers are never executable here (Atrium engine owns them)', () => {
        for (const t of PROPERTY_ONLY_TRIGGERS) {
            expect(isExecutableTrigger(t)).toBe(false);
        }
        for (const t of RULE_TRIGGER_TYPES) {
            expect(isExecutableTrigger(t)).toBe(true);
        }
    });
});

describe('automation rules: dedup keys + merge fields + payloads', () => {
    it('ruleDedupKey is the once-per-rule-per-entity contract', () => {
        expect(ruleDedupKey('f1', 'r1', 'matter_created', 'm9'))
            .toBe('f1|rule:r1|matter_created|m9|once');
        // Different rule on the same entity → may fire
        expect(ruleDedupKey('f1', 'r2', 'matter_created', 'm9'))
            .not.toBe(ruleDedupKey('f1', 'r1', 'matter_created', 'm9'));
        // Same rule, different entity → may fire
        expect(ruleDedupKey('f1', 'r1', 'matter_created', 'm10'))
            .not.toBe(ruleDedupKey('f1', 'r1', 'matter_created', 'm9'));
        // Same rule, different trigger family → may fire (a stage-change
        // rule and a creation rule are different events)
        expect(ruleDedupKey('f1', 'r1', 'matter_stage_change', 'm9'))
            .not.toBe(ruleDedupKey('f1', 'r1', 'matter_created', 'm9'));
    });

    it('ruleMergeVars carries every documented field and nulls honestly', () => {
        const e: RuleEventContext = {
            triggerType: 'invoice_overdue',
            value: 'any',
            entityId: 'inv1',
            invoice: { invoiceNumber: 'INV-042', total: 150000, dueDate: '2026-09-01' },
        };
        const vars = ruleMergeVars('Ade & Sons', e, 'Mrs. Bello');
        expect(vars.firm_name).toBe('Ade & Sons');
        expect(vars.client_name).toBe('Mrs. Bello');
        expect(vars.invoice_number).toBe('INV-042');
        expect(vars.amount_due).toBe(150000);
        expect(vars.due_date).toBe('2026-09-01');
        // Fields with no data in this context are null (renderer strips them)
        expect(vars.matter_title).toBeNull();
        expect(vars.event_title).toBeNull();
    });

    it('buildTaskPayload renders merge fields, respects dueInDays and clamps priority', () => {
        const now = new Date('2026-09-16T09:00:00Z').getTime();
        const e: RuleEventContext = {
            triggerType: 'matter_stage_change',
            value: 'Trial',
            entityId: 'm1',
            matter: { id: 'm1', title: 'Bello v. Zenith Bank', type: 'Civil Litigation', stage: 'Trial' },
        };
        const p = buildTaskPayload(
            { type: 'create_task', taskTitle: 'Prepare {{matter_title}} for {{matter_stage}}', dueInDays: 3, priority: 'High', description: 'Client: {{client_name}}' },
            'Ade & Sons',
            e,
            'Mrs. Bello',
            now,
        );
        expect(p.title).toBe('Prepare Bello v. Zenith Bank for Trial');
        expect(p.priority).toBe('High');
        expect(p.description).toBe('Client: Mrs. Bello');
        expect(new Date(p.dueDate!).toISOString().slice(0, 10)).toBe('2026-09-19');
        // Unknown priority falls back to Medium; unknown tags are stripped
        const p2 = buildTaskPayload({ type: 'create_task', taskTitle: 'X {{nonexistent}}', priority: 'Urgent' }, 'F', e, null, now);
        expect(p2.priority).toBe('Medium');
        expect(p2.title).toBe('X ');
    });

    it('buildMessagePayload separates email (subject+body) from WhatsApp (body only)', () => {
        const e: RuleEventContext = {
            triggerType: 'lead_created',
            value: 'any',
            entityId: 'l1',
            lead: { name: 'Chika Okafor', email: 'chika@example.com' },
        };
        const email = buildMessagePayload(
            { type: 'send_email', emailSubject: 'Welcome, {{lead_name}}!', emailBody: 'Hello {{lead_name}}, thanks for reaching out to {{firm_name}}.' },
            'Ade & Sons', e, null,
        );
        expect(email.channel).toBe('email');
        expect(email.subject).toBe('Welcome, Chika Okafor!');
        expect(email.body).toContain('Hello Chika Okafor, thanks for reaching out to Ade & Sons.');
        const wa = buildMessagePayload(
            { type: 'send_whatsapp', whatsappMessage: 'Hi {{lead_name}}, this is {{firm_name}}.' },
            'Ade & Sons', e, null,
        );
        expect(wa.channel).toBe('whatsapp');
        expect(wa.body).toBe('Hi Chika Okafor, this is Ade & Sons.');
    });
});

describe('automation rules: sweep selection predicates', () => {
    const NOW = new Date('2026-09-16T09:00:00Z').getTime();

    it('isInvoiceOverdue: only open statuses past their due date', () => {
        expect(isInvoiceOverdue({ status: 'Sent', dueDate: '2026-09-01' }, NOW)).toBe(true);
        expect(isInvoiceOverdue({ status: 'sent', dueDate: '2026-09-01' }, NOW)).toBe(true);
        expect(isInvoiceOverdue({ status: 'Sent', dueDate: '2026-09-20' }, NOW)).toBe(false); // not due yet
        expect(isInvoiceOverdue({ status: 'Paid', dueDate: '2026-09-01' }, NOW)).toBe(false);
        expect(isInvoiceOverdue({ status: 'Voided', dueDate: '2026-09-01' }, NOW)).toBe(false);
        expect(isInvoiceOverdue({ status: 'Draft', dueDate: '2026-09-01' }, NOW)).toBe(false);
        expect(isInvoiceOverdue({ status: 'Sent', dueDate: null }, NOW)).toBe(false); // no due date
        expect(isInvoiceOverdue({ status: 'Sent', dueDate: 'garbage' }, NOW)).toBe(false); // unparseable
    });

    it('isTaskOverdue: only open tasks past their due date', () => {
        expect(isTaskOverdue({ status: 'todo', dueDate: '2026-09-15' }, NOW)).toBe(true);
        expect(isTaskOverdue({ status: 'In Progress', dueDate: '2026-09-15' }, NOW)).toBe(true);
        expect(isTaskOverdue({ status: 'done', dueDate: '2026-09-15' }, NOW)).toBe(false);
        expect(isTaskOverdue({ status: 'completed', dueDate: '2026-09-15' }, NOW)).toBe(false);
        expect(isTaskOverdue({ status: 'todo', dueDate: '2026-09-20' }, NOW)).toBe(false);
        expect(isTaskOverdue({ status: 'todo', dueDate: null }, NOW)).toBe(false);
    });

    it('isOnboardingIncomplete: ≥24h old with zero tasks/documents/events', () => {
        const created20h = new Date(NOW - 20 * 3_600_000).toISOString();
        const created30h = new Date(NOW - 30 * 3_600_000).toISOString();
        expect(isOnboardingIncomplete({ createdAt: created30h }, { tasks: 0, documents: 0, events: 0 }, NOW)).toBe(true);
        expect(isOnboardingIncomplete({ createdAt: created20h }, { tasks: 0, documents: 0, events: 0 }, NOW)).toBe(false); // too soon
        expect(isOnboardingIncomplete({ createdAt: created30h }, { tasks: 1, documents: 0, events: 0 }, NOW)).toBe(false); // worked on
        expect(isOnboardingIncomplete({ createdAt: created30h }, { tasks: 0, documents: 2, events: 0 }, NOW)).toBe(false);
        expect(isOnboardingIncomplete({ createdAt: null }, { tasks: 0, documents: 0, events: 0 }, NOW)).toBe(false);
    });
});

// ─── PART 2: wiring contracts (source-scanned) ──────────────────────────────

describe('automation rules: engine wiring contracts', () => {
    const engine = () => read('convex/automationRules.ts');
    const myFunctions = () => read('convex/myFunctions.ts');
    const portals = () => read('convex/portals.ts');
    const crons = () => read('convex/crons.ts');
    const ui = () => read('src/components/settings/AutomationSettings.tsx');

    it('createItem dispatches all four creation triggers, non-blocking', () => {
        const src = myFunctions();
        for (const t of ['matter_created', 'lead_created', 'event_created', 'document_uploaded']) {
            expect(src).toContain(`triggerType: "${t}"`);
        }
        expect(src).toContain('dispatchRulesForEvent');
        // The hook is inside a try/catch so an engine failure never fails the save
        expect(src).toMatch(/automation-rule dispatch failed \(non-blocking\)/);
    });

    it('updateItem dispatches matter_stage_change only on REAL stage changes', () => {
        const src = myFunctions();
        expect(src).toContain('priorMatterStage');
        expect(src).toContain('triggerType: "matter_stage_change"');
        // Same-stage re-saves are a no-op: the guard requires oldStage !== newStage
        expect(src).toMatch(/newStage !== oldStage/);
        // And both stages must be non-empty (a matter with no stage can't "change" to one)
        expect(src).toMatch(/newStage && oldStage/);
    });

    it('participant portal attachments fire document_uploaded as client_portal', () => {
        const src = portals();
        expect(src).toContain('if (!isAdminMessage)');
        expect(src).toMatch(/triggerType: "document_uploaded"/);
        expect(src).toMatch(/value: "client_portal"/);
        // Non-blocking, and the admin-side attachment path does NOT fire it
        expect(src).toMatch(/\[sendPortalMessage\] automation-rule dispatch failed \(non-blocking\)/);
    });

    it('ruleEngineSweep cron is registered daily at 6:45 UTC, after the Atrium engine', () => {
        const src = crons();
        expect(src).toMatch(/crons\.daily\(\s*"ruleEngineSweep",\s*\{ hourUTC: 6, minuteUTC: 45 \}/s);
        expect(src).toContain('internal.automationRules.runRuleEngineSweep');
    });

    it('dispatch writes the once-forever ledger row (rule: prefix, periodKey once)', () => {
        const src = engine();
        expect(src).toContain('workflowKey: `rule:${args.ruleId}`');
        expect(src).toContain('periodKey: "once"');
        // The ledger check gates every dispatch
        expect(src).toContain('hasDispatched');
        expect(src).toContain('.withIndex("by_dedup"');
    });

    it('scheduled_messages enqueue carries the rule origin + dedup key', () => {
        const src = engine();
        expect(src).toContain('workflowKey: `rule:${ruleId}`');
        expect(src).toContain('dedupKey: ruleDedupKey(');
        expect(src).toContain('isAutomation: true');
        expect(src).toContain('status: "scheduled"');
    });

    it('create_task actions insert a real tasks row with idempotencyKey + matter link', () => {
        const src = engine();
        expect(src).toMatch(/await ctx\.db\.insert\("tasks"/);
        expect(src).toContain('creatorId: "automation"');
        expect(src).toContain('idempotencyKey: ruleDedupKey(');
    });

    it('generate_document is honestly non-executing (skipped_unsupported, never silent)', () => {
        const src = engine();
        expect(src).toContain('skipped_unsupported');
        expect(src).not.toMatch(/generate_document[^]*generateAndSaveDocument/); // no fake generation
    });

    it('the sweep never reacts to its own output (automation-created tasks excluded)', () => {
        const src = engine();
        expect(src).toMatch(/creatorId === "automation"/);
    });

    it('getRuleActivity is staff-guarded (identity audit)', () => {
        const src = engine();
        expect(src).toMatch(/export const getRuleActivity[\s\S]*?requireStaffCaller/);
    });

    it('the generated API declares the automationRules module (until CI codegen)', () => {
        const api = read('convex/_generated/api.d.ts');
        expect(api).toContain('import type * as automationRules from "../automationRules.js"');
        expect(api).toContain('automationRules: typeof automationRules');
    });

    it('the UI shows live activity, isolates the query, and surfaces blueprint ideas', () => {
        const src = ui();
        expect(src).toContain('api.automationRules.getRuleActivity');
        expect(src).toContain('SectionErrorBoundary');
        expect(src).toContain("hasn't fired yet");
        // Blueprint recipe wiring: ideas come from the firm's actual profile
        expect(src).toContain('getProfilesForAreas');
        expect(src).toContain('getAtriumProfilesForPortfolio');
        expect(src).toContain('Ideas from your Practice Blueprint');
    });
});

// ─── PART 3: Practice Blueprint merge-engine contracts (Task 47 backfill) ──

describe('practice blueprint: additive + idempotent merge engine', () => {
    const profile = { buildLegalPlan, buildAtriumPlan, mergePlans };

    const emptyDeps = {
        contactCategories: [],
        documentCategories: [],
        eventTypes: [],
        workflows: [],
        checklistTemplates: [],
    };

    it('a fresh workspace plans ONLY additions (no duplicate flags)', () => {
        const plan = profile.buildLegalPlan(getProfilesForAreas(['Corporate & Commercial']), emptyDeps);
        expect(plan.items.length).toBeGreaterThan(0);
        expect(plan.items.every((i: any) => !i.duplicate)).toBe(true);
        expect(plan.counts.matterTypes).toBeGreaterThan(0);
        expect(plan.counts.contactTypes).toBeGreaterThan(0);
        expect(plan.counts.documentCategories).toBeGreaterThan(0);
        // Every planned write goes through the firm-scoped generic tables
        const tables = new Set(plan.items.map((i: any) => i.table));
        for (const t of ['workflows', 'contactCategories', 'documentCategories', 'eventTypes', 'checklistTemplates']) {
            expect(tables.has(t)).toBe(true);
        }
    });

    it('re-running against the now-existing workspace marks everything duplicate (idempotent)', () => {
        const first = profile.buildLegalPlan(getProfilesForAreas(['Corporate & Commercial']), emptyDeps);
        // Simulate the workspace AFTER apply: the planned rows now exist
        const afterDeps = {
            contactCategories: first.items.filter((i: any) => i.table === 'contactCategories').map((i: any) => ({ id: 'x', name: i.label })),
            documentCategories: first.items.filter((i: any) => i.table === 'documentCategories').map((i: any) => ({ id: 'x', name: i.label })),
            eventTypes: first.items.filter((i: any) => i.table === 'eventTypes').map((i: any) => ({ id: 'x', name: i.label, color: 'blue' })),
            workflows: first.items.filter((i: any) => i.table === 'workflows').map((i: any) => ({ id: 'w1', type: i.data.type, subCategories: i.data.subCategories })),
            checklistTemplates: first.items.filter((i: any) => i.table === 'checklistTemplates').map((i: any) => ({ id: 'x', name: i.label })),
        };
        const second = profile.buildLegalPlan(getProfilesForAreas(['Corporate & Commercial']), afterDeps);
        expect(second.items.every((i: any) => i.duplicate)).toBe(true);
        expect(second.counts.matterTypes).toBe(0);
        expect(second.counts.contactTypes).toBe(0);
        expect(second.workflowMerges).toHaveLength(0);
        // "Everything already set up" — the preview's disabled state
        expect(second.items.filter((i: any) => !i.duplicate).length + second.workflowMerges.length).toBe(0);
    });

    it('an EXISTING workflow of the same matter type is MERGED, never overwritten', () => {
        const profiles = getProfilesForAreas(['Corporate & Commercial']);
        const wfBlueprint = profiles.flatMap((p: any) => p.workflows)[0];
        const existingSubs: Record<string, unknown> = {};
        const firstSub = Object.keys(wfBlueprint.subCategories)[0];
        existingSubs[firstSub] = wfBlueprint.subCategories[firstSub];
        const deps = {
            ...emptyDeps,
            workflows: [{
                id: 'w-existing',
                type: wfBlueprint.type,
                default: { stages: ['Custom Stage'], suggestions: {} },
                subCategories: existingSubs,
            }],
        };
        const plan = profile.buildLegalPlan(profiles, deps);
        // No new workflow row for the same type…
        expect(plan.items.filter((i: any) => i.table === 'workflows' && !i.duplicate)).toHaveLength(0);
        // …instead a merge that adds ONLY the missing sub-categories
        expect(plan.workflowMerges).toHaveLength(1);
        expect(plan.workflowMerges[0].workflowId).toBe('w-existing');
        expect(Object.keys(plan.workflowMerges[0].subCategories)).not.toContain(firstSub);
        expect(Object.keys(plan.workflowMerges[0].subCategories).length)
            .toBe(Object.keys(wfBlueprint.subCategories).length - 1);
    });

    it('mergePlans de-duplicates rows that appear in both the legal and portfolio plans', () => {
        const legal = profile.buildLegalPlan(getProfilesForAreas(['Corporate & Commercial']), emptyDeps);
        const atrium = profile.buildAtriumPlan(
            getAtriumProfilesForPortfolio(['residential'], []).profiles,
            [],
            emptyDeps,
        );
        const merged = profile.mergePlans(legal, atrium);
        const keys = merged.items.map((i: any) => `${i.table}:${i.label.toLowerCase()}`);
        expect(new Set(keys).size).toBe(keys.length); // no duplicate rows
        // counts are recomputed post-merge, never a naive sum
        expect(merged.counts.contactTypes)
            .toBe(merged.items.filter((i: any) => i.table === 'contactCategories' && !i.duplicate).length);
    });
});

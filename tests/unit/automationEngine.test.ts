/**
 * Automation Engine contract tests (2026-09-14).
 *
 * THE USER'S CONTRACT:
 *   "REMEMBER WE ARE NOT TO HAVE DUPLICATE AUTO MESSAGING. THIS SCHEDULED
 *    MESSAGES SHOULD BE WHERE ALL OF IT IS ORCHESTRATED."
 *
 * PART 1 — pure engine math: trigger-day computation, rent anchors,
 *   period keys, dedup keys, channel resolution, merge-field rendering.
 * PART 2 — suppression contract: payment proof submit → pause, approve →
 *   cancel (collection types only), reject → resume (source-scanned).
 * PART 3 — orchestration contract (source-scanned so removal fails CI):
 *   - the engine cron exists and the two retired duplicate-reminder crons
 *     are GONE from crons.ts (they double-sent: 6:30 service-charge alert
 *     + 7:00 late notice for the same overdue charge)
 *   - engine enqueues carry workflowKey/stepKey/dedupKey and the dispatch
 *     ledger row is written with outcome "enqueued"
 *   - the dispatch processor claims rows before sending (no double-send
 *     on overlapping 5-minute runs) and reclaims stale "sending" rows
 *   - payment-proof mutations call the suppression hooks; the Paystack
 *     webhook verifies pending tenant proofs on charge.success
 *   - automated emails go out with the branded footer + unsubscribe link;
 *     the /unsubscribe HTTP route exists and verifies tokens
 *   - unsubscribe opt-outs are enforced at BOTH enqueue and dispatch time
 *   - the founder login wires the account-recovery actions
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/automationEngine.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

// The engine module is pure enough to import directly (no Convex runtime
// at import time — the function builders only run when called).
import {
    renderMergeFields,
    dayKey,
    periodKeyFor,
    rentDueDayOfMonth,
    nextRentDueTimestamp,
    isTriggerDay,
    buildDedupKey,
    resolveChannel,
    AUTOMATION_WORKFLOW_DEFAULTS,
} from '../../convex/automationEngine';
import {
    unsubscribeToken,
    decodeUnsubscribeToken,
    buildAutomatedEmailHtml,
} from '../../convex/emailBranding';
import { renderMergeFields as clientRender } from '../../src/utils/mergeFields';
import { SCHEDULE_TEMPLATES } from '../../src/utils/messageTemplates';

// ─── PART 1: engine math ────────────────────────────────────────────────────

describe('automation engine: pure scheduling math', () => {
    it('rentDueDayOfMonth clamps to valid days and defaults to the 1st', () => {
        expect(rentDueDayOfMonth(null)).toBe(1);
        expect(rentDueDayOfMonth(new Date('2026-01-05T10:00:00Z').getTime())).toBe(5);
        expect(rentDueDayOfMonth(new Date('2026-01-31T10:00:00Z').getTime())).toBe(28); // months without a 31st
    });

    it('nextRentDueTimestamp rolls forward to the next occurrence', () => {
        const from = new Date('2026-09-20T09:00:00Z').getTime(); // the 20th
        const dueDay = 15;
        const next = nextRentDueTimestamp(from, dueDay);
        expect(new Date(next).toISOString().slice(0, 10)).toBe('2026-10-15');
        // Same-day anchor: the 20th from the 20th stays today (not next month)
        const sameDay = nextRentDueTimestamp(from, 20);
        expect(new Date(sameDay).toISOString().slice(0, 10)).toBe('2026-09-20');
    });

    it('isTriggerDay matches anchor ± offset on calendar days', () => {
        const anchor = new Date('2026-10-01T00:00:00Z').getTime(); // rent due Oct 1
        const now = new Date('2026-09-24T12:00:00Z').getTime();    // Sep 24
        expect(isTriggerDay(anchor, -7, now)).toBe(true);          // 7 days before
        expect(isTriggerDay(anchor, -3, now)).toBe(false);
        expect(isTriggerDay(anchor, 0, new Date('2026-10-01T23:00:00Z').getTime())).toBe(true);
        expect(isTriggerDay(anchor, 7, new Date('2026-10-08T06:00:00Z').getTime())).toBe(true);
    });

    it('buildDedupKey is the five-part no-duplicate contract', () => {
        expect(buildDedupKey('f1', 'rent_collection', 'pre_7', 't1', '2026-10'))
            .toBe('f1|rent_collection|pre_7|t1|2026-10');
        // Same tenant, different step → different key (each step may fire once)
        expect(buildDedupKey('f1', 'rent_collection', 'pre_3', 't1', '2026-10'))
            .not.toBe(buildDedupKey('f1', 'rent_collection', 'pre_7', 't1', '2026-10'));
        // Same step, different period → different key (next month is a new cycle)
        expect(buildDedupKey('f1', 'rent_collection', 'pre_7', 't1', '2026-11'))
            .not.toBe(buildDedupKey('f1', 'rent_collection', 'pre_7', 't1', '2026-10'));
    });

    it('resolveChannel: auto prefers email and falls back to WhatsApp', () => {
        expect(resolveChannel('auto', 'a@b.com')).toBe('email');
        expect(resolveChannel('auto', null)).toBe('whatsapp');
        expect(resolveChannel('email', null)).toBe('email');
        expect(resolveChannel('whatsapp', 'a@b.com')).toBe('whatsapp');
    });

    it('periodKeyFor/dayKey produce stable calendar keys', () => {
        expect(periodKeyFor(new Date('2026-09-15T10:00:00Z').getTime())).toBe('2026-09');
        expect(dayKey(new Date('2026-10-01T23:59:00Z').getTime())).toBe('2026-10-01');
    });

    it('renderMergeFields resolves tags and formats naira; unknown tags strip', () => {
        const out = renderMergeFields('Hi {{tenant_name}}, {{amount_due}} due {{due_date}} for {{unit_number}}.', {
            tenant_name: 'Ada', amount_due: 1250000, due_date: 'October 1, 2026', unit_number: 'Flat 2A',
        });
        expect(out).toContain('Hi Ada');
        expect(out).toContain('₦1,250,000');
        expect(out).toContain('Flat 2A');
        expect(renderMergeFields('x {{nope}} y', {})).toBe('x  y');
        expect(renderMergeFields('{{tenant_name}}', { tenant_name: null })).toBe('');
    });

    it('client and server renderers agree on the same template (preview honesty)', () => {
        const vars = { tenant_name: 'Ada', unit_number: 'Flat 2A', amount_due: 900000, due_date: 'Oct 1' };
        const template = '{{tenant_name}} owes {{amount_due}} for {{unit_number}} by {{due_date}}';
        expect(clientRender(template, vars)).toBe(renderMergeFields(template, vars));
    });
});

describe('automation engine: workflow library', () => {
    it('ships the Atrium pre-built workflows with the user-specified ladders', () => {
        const keys = AUTOMATION_WORKFLOW_DEFAULTS.map((w) => w.key);
        expect(keys).toEqual(expect.arrayContaining(['rent_collection', 'service_charge', 'lease_expiry', 'rent_review']));

        const rent = AUTOMATION_WORKFLOW_DEFAULTS.find((w) => w.key === 'rent_collection')!;
        const rentStepKeys = rent.steps.map((s) => s.key);
        // The exact ladder the user specified: 7/3/1 pre-due, due day,
        // grace+3, NOD at 7 late, 14 late, escalated.
        expect(rentStepKeys).toEqual(['pre_7', 'pre_3', 'pre_1', 'due_day', 'grace_3', 'late_7', 'late_14']);
        expect(rent.steps.find((s) => s.key === 'late_7')?.offsetDays).toBe(7);
        expect(rent.steps.find((s) => s.key === 'grace_3')?.offsetDays).toBe(3);

        const lease = AUTOMATION_WORKFLOW_DEFAULTS.find((w) => w.key === 'lease_expiry')!;
        expect(lease.steps.map((s) => s.key)).toEqual(['expiry_90', 'expiry_60', 'expiry_30']);
    });

    it('every default template uses only resolvable merge fields', () => {
        const allowed = ['tenant_name', 'unit_number', 'amount_due', 'due_date', 'property_name', 'firm_name', 'payment_link'];
        for (const wf of AUTOMATION_WORKFLOW_DEFAULTS) {
            for (const step of wf.steps) {
                const tags = [...step.subject.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
                for (const tag of tags) expect(allowed).toContain(tag);
            }
        }
    });
});

// ─── PART 1b: intuitiveness round (user feedback 2026-09-14) ───────────────
// "When I increase the days, the number does not change." → titles are
// number-free and semantic; "I cannot see what the messages look like." →
// every step text is previewable/editable; "turn it off per unit as well" →
// per-unit opt-outs; "clicking a type would not pre-populate" → the listed
// types ARE the templates.

describe('automation engine: intuitiveness round', () => {
    it('every step has a NUMBER-FREE semantic title (offsets adjust without contradicting it)', () => {
        for (const wf of AUTOMATION_WORKFLOW_DEFAULTS) {
            for (const step of wf.steps) {
                expect(step.title).toBeTruthy();
                expect((step.title || '').length).toBeGreaterThan(2);
                expect(step.title).not.toMatch(/\d/);
            }
        }
    });

    it('the schedule-form starter templates ARE the engine texts (one voice per notice type)', () => {
        // (template key, engine workflow, engine step, distinctive core wording)
        const pairs: Array<[string, string, string, string]> = [
            ['rent_reminder', 'rent_collection', 'pre_7',
                'A friendly heads-up: your rent of {{amount_due}} for {{unit_number}} at {{property_name}} is due on {{due_date}}'],
            ['late_notice', 'rent_collection', 'late_7',
                'NOTICE OF DEFAULT — {{unit_number}}, {{property_name}}'],
            ['service_charge_alert', 'service_charge', 'pre_3',
                'Your service charge contribution of {{amount_due}} for {{unit_number}} at {{property_name}} is due on {{due_date}}'],
            ['lease_renewal', 'lease_expiry', 'expiry_90',
                'Your tenancy for {{unit_number}} at {{property_name}} expires on {{due_date}}'],
        ];
        for (const [tplKey, wfKey, stepKey, core] of pairs) {
            const tpl = SCHEDULE_TEMPLATES.find((t) => t.key === tplKey)!;
            expect(tpl).toBeTruthy();
            const wf = AUTOMATION_WORKFLOW_DEFAULTS.find((w) => w.key === wfKey)!;
            const step = wf.steps.find((s) => s.key === stepKey)!;
            expect(tpl.template).toContain(core);
            expect(tpl.type).toBe(step.messageType);
        }
    });

    it('schedule templates only use resolvable merge fields', () => {
        const allowed = ['tenant_name', 'unit_number', 'amount_due', 'due_date', 'property_name', 'firm_name', 'payment_link'];
        for (const tpl of SCHEDULE_TEMPLATES) {
            const tags = [...tpl.template.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
            for (const tag of tags) expect(allowed).toContain(tag);
        }
    });
});

// ─── PART 1c: template completeness round (user feedback 2026-09-14:
// "messages are sparse and not very helpful… links directing where to make
// payment, consequences if necessary… standard and complete ones") ──────

describe('automation engine: template completeness round', () => {
    const stepsOf = (wfKey: string) =>
        AUTOMATION_WORKFLOW_DEFAULTS.find((w) => w.key === wfKey)!.steps;

    it('every template greets by name and signs off with the firm (one consistent voice)', () => {
        for (const wf of AUTOMATION_WORKFLOW_DEFAULTS) {
            for (const step of wf.steps) {
                expect(step.subject).toContain('{{tenant_name}}');
                expect(step.subject.trim().endsWith('{{firm_name}}')).toBe(true);
            }
        }
    });

    it('every payment-bearing step tells the resident HOW to pay (payment link)', () => {
        for (const wfKey of ['rent_collection', 'service_charge']) {
            for (const step of stepsOf(wfKey)) {
                expect(step.subject).toContain('{{payment_link}}');
            }
        }
    });

    it('escalation steps state the consequence (charges / recovery)', () => {
        for (const step of stepsOf('rent_collection')) {
            if (['late_7', 'late_14'].includes(step.key)) {
                expect(step.subject).toMatch(/late charges|recovery/i);
            }
        }
        for (const step of stepsOf('service_charge')) {
            if (['late_7', 'late_14'].includes(step.key)) {
                expect(step.subject).toMatch(/late charges|rent arrears|recovery/i);
            }
        }
    });

    it('escalation steps leave a door open (arrange payment)', () => {
        for (const step of stepsOf('rent_collection')) {
            if (['late_7', 'late_14'].includes(step.key)) {
                expect(step.subject).toMatch(/reply to this message|contact us now/i);
            }
        }
    });

    it('lease/review steps use NO payment or amount tags (their resolvers have none)', () => {
        for (const wfKey of ['lease_expiry', 'rent_review']) {
            for (const step of stepsOf(wfKey)) {
                expect(step.subject).not.toContain('{{payment_link}}');
                expect(step.subject).not.toContain('{{amount_due}}');
            }
        }
    });

    it('bodies are OFFSET-AGNOSTIC — no digits, no "in N days"/"tomorrow" that a stepper change could contradict', () => {
        for (const wf of AUTOMATION_WORKFLOW_DEFAULTS) {
            for (const step of wf.steps) {
                expect(step.subject).not.toMatch(/\d/);
                expect(step.subject).not.toMatch(/tomorrow/i);
            }
        }
    });

    it('preview shows the raw template (one presentation — no live-recipient rendering)', () => {
        // The UI panel must show the template itself, NOT a rendered sample:
        // "some have a real name, some have variables — stick with one."
        const ui = read('src/components/messaging/AutomationWorkflows.tsx');
        expect(ui).toContain('{step.subject || \'\'}'); // raw template rendered directly
        expect(ui).not.toContain('sampleVarsFor');
        expect(ui).not.toContain('Mrs. Adaeze Okonkwo'); // the fabricated sample is gone
        expect(ui).not.toContain('renderMergeFields');
    });
});

// ─── PART 2: suppression + footer contracts ────────────────────────────────

describe('unsubscribe tokens', () => {
    it('tokens are deterministic and self-verifying', () => {
        const t1 = unsubscribeToken('firm1', 'Ada@Example.com');
        const t2 = unsubscribeToken('firm1', 'ada@example.com');
        expect(t1).toBe(t2); // contact key normalized — same link every send
        const decoded = decodeUnsubscribeToken(t1);
        expect(decoded).toEqual({ firmId: 'firm1', contactKey: 'ada@example.com' });
    });

    it('tampered tokens are rejected', () => {
        const t = unsubscribeToken('firm1', 'a@b.com');
        expect(decodeUnsubscribeToken(t + 'x')).toBeNull();
        expect(decodeUnsubscribeToken('nonsense')).toBeNull();
        expect(decodeUnsubscribeToken(''.padStart(10, 'a'))).toBeNull();
    });

    it('different firms/contacts never collide', () => {
        expect(unsubscribeToken('f1', 'a@b.com')).not.toBe(unsubscribeToken('f2', 'a@b.com'));
        expect(unsubscribeToken('f1', 'a@b.com')).not.toBe(unsubscribeToken('f1', 'c@d.com'));
    });
});

describe('automated email footer (the user\'s spec)', () => {
    const html = buildAutomatedEmailHtml({
        firmId: 'f1', firmName: 'Atrium Estates', body: 'Rent is due.', contactKey: 'ada@example.com',
    });

    it('says the message is automated, names the firm', () => {
        expect(html).toContain('automated message');
        expect(html).toContain('Atrium Estates');
    });

    it('carries a working unsubscribe link', () => {
        expect(html).toMatch(/Unsubscribe from these notices<\/a>/);
        const href = html.match(/href="([^"]*\/unsubscribe\?t=[^"]+)"/)?.[1];
        expect(href).toBeTruthy();
        const token = decodeURIComponent(href!.split('t=')[1]);
        expect(decodeUnsubscribeToken(token)).toEqual({ firmId: 'f1', contactKey: 'ada@example.com' });
    });

    it('shows the non-obtrusive "Powered by PracticePro Systems" line', () => {
        expect(html).toContain('Powered by');
        expect(html).toContain('PracticePro Systems');
    });

    it('escapes HTML in the body (plain text path)', () => {
        const safe = buildAutomatedEmailHtml({ firmId: 'f', firmName: 'F', body: '<script>alert(1)</script>', contactKey: 'x@y.z' });
        expect(safe).not.toContain('<script>');
    });

    it('transactional mode keeps branding but drops the unsubscribe link', () => {
        const noLink = buildAutomatedEmailHtml({ firmId: 'f', firmName: 'F', body: 'Receipt', contactKey: 'x@y.z', includeUnsubscribe: false });
        expect(noLink).not.toMatch(/\/unsubscribe\?t=/);
        expect(noLink).toContain('automated message');
    });
});

// ─── PART 3: orchestration contract (source-scanned) ───────────────────────

const engineSrc = read('convex/automationEngine.ts');
const portalsSrc = read('convex/portals.ts');
const cronsSrc = read('convex/crons.ts');
const httpSrc = read('convex/http.ts');
const paystackSrc = read('convex/paystack.ts');
const schemaSrc = read('convex/schema.ts');
const workflowsUiSrc = read('src/components/messaging/AutomationWorkflows.tsx');
const scheduledTabSrc = read('src/components/messaging/ScheduledTab.tsx');
const loginSrc = read('src/admin/AdminLogin.tsx');
const settingsSrc = read('src/admin/views/Settings.tsx');

describe('orchestration: one engine, no duplicate crons', () => {
    it('the engine cron is registered (daily 6:30 UTC)', () => {
        expect(cronsSrc).toContain('"automationEngine"');
        expect(cronsSrc).toContain('internal.automationEngine.runAutomationEngine');
    });

    it('the two duplicate-reminder crons are RETIRED (the double-send bug)', () => {
        // Both crons selected the same overdue charge on the same morning:
        // service_charge_alert at 6:30 AND late_notice at 7:00. They must
        // remain commented out — uncommenting either reintroduces
        // duplicate automated messaging outside the engine.
        const activeLines = cronsSrc
            .split('\n')
            .map((l) => l.replace(/\/\/.*$/, ''))  // strip line comments
            .filter((l) => l.trim().length > 0);
        const activeCrons = activeLines.join('\n');
        expect(activeCrons, 'serviceChargeWhatsAppReminder cron must stay retired').not.toContain('"serviceChargeWhatsAppReminder"');
        expect(activeCrons, 'sentryDailyAutomation cron must stay retired').not.toContain('"sentryDailyAutomation"');
        // …and the retirement is DOCUMENTED (someone later doesn't "helpfully" re-add them)
        expect(cronsSrc).toMatch(/RETIRED 2026-09-14/);
        expect(cronsSrc).toContain('internal.automationEngine.runAutomationEngine');
    });

    it('engine enqueues stamp workflowKey, stepKey and dedupKey', () => {
        const enqueueBlock = engineSrc.slice(engineSrc.indexOf('async function enqueueMessage'));
        expect(enqueueBlock).toContain('workflowKey: args.workflowKey');
        expect(enqueueBlock).toContain('stepKey: args.stepKey');
        expect(enqueueBlock).toContain('dedupKey: args.dedupKey');
    });

    it('every enqueue writes a dispatch-ledger row (the idempotency contract)', () => {
        const runBlock = engineSrc.slice(engineSrc.indexOf('runAutomationEngine = internalMutation'));
        expect(runBlock).toContain('alreadyDispatched(');
        expect(runBlock).toContain('recordDispatch(');
        expect(runBlock).toContain('"enqueued"');
        // Suppression outcomes are recorded too — auditable, never silent
        expect(runBlock).toContain('"suppressed_paid"');
        expect(runBlock).toContain('"suppressed_proof_pending"');
    });

    it('the engine honours paid, opt-out and pending-proof gates before enqueue', () => {
        const runBlock = engineSrc.slice(engineSrc.indexOf('runAutomationEngine = internalMutation'));
        expect(runBlock).toContain('paidThisPeriod');
        expect(runBlock).toContain('isOptedOut');
        expect(runBlock).toContain('hasPendingPaymentProof');
    });

    it('per-unit opt-outs gate the engine (the "turn it off per unit" switch)', () => {
        // Table exists with both lookup indexes
        expect(schemaSrc).toContain('automation_unit_opt_outs: defineTable');
        expect(schemaSrc).toContain('.index("by_firm_unit"');
        expect(schemaSrc).toContain('.index("by_firm_active"');
        // Engine loads the alias set BEFORE dispatching and records the outcome
        const runBlock = engineSrc.slice(engineSrc.indexOf('runAutomationEngine = internalMutation'));
        expect(runBlock).toContain('loadUnitOptOutAliases');
        expect(runBlock).toContain('"suppressed_unit_optout"');
        // The alias set matches target unit ids in EVERY stored shape
        expect(engineSrc).toContain('for (const a of (r.aliases as string[] | undefined) || [])');
        // Management surface for the UI
        expect(engineSrc).toContain('setUnitAutomationOptOut = mutation');
        expect(engineSrc).toContain('listUnitAutomationStatus = query');
        // The preview answers "who gets these?" with per-unit state
        const previewBlock = engineSrc.slice(engineSrc.indexOf('previewWorkflowTargets = query'));
        expect(previewBlock).toContain('unitId: t.unitId');
        expect(previewBlock).toContain('optedOut: optOuts.has');
        expect(previewBlock).toContain('count: effective.length');
        // The workflow card renders the per-unit panel and quick-mute
        expect(workflowsUiSrc).toContain('Per-unit settings');
        expect(workflowsUiSrc).toContain('toggleUnitAutomation');
    });

    it('custom step text is honoured end-to-end (subject override = "replace what is sent")', () => {
        // Validator accepts the subject field
        expect(engineSrc).toContain('subject: v.optional(v.string())');
        // Stored override beats the default at ENGINE dispatch time
        const mergeBlock = engineSrc.slice(engineSrc.indexOf('async function loadFirmWorkflows'));
        expect(mergeBlock).toContain('subject: typeof s.subject === "string" && s.subject.trim() ? s.subject : d.subject');
        expect(engineSrc).toContain('renderMergeFields(step.subject');
        // Empty string = explicit factory reset
        expect(engineSrc).toContain('return t ? t.slice(0, 1000) : undefined');
        // The overview exposes effective vs default text so the UI can show
        // both and offer Reset
        const overviewBlock = engineSrc.slice(engineSrc.indexOf('getAutomationOverview = query'));
        expect(overviewBlock).toContain('subjectEdited');
        expect(overviewBlock).toContain('defaultSubject');
        expect(overviewBlock).toContain('firmName');
        expect(overviewBlock).toContain('optedOutUnits');
        // The UI previews + edits the message inline. (2026-09-14
        // consistency round: the preview shows the RAW template — with the
        // {{tags}} visible — matching the editor exactly; the rendered
        // merge-fields sample was removed after the user flagged "some
        // have a real name, some have variables — stick with one".)
        expect(workflowsUiSrc).toContain('See the message');
        expect(workflowsUiSrc).toContain('saveSubject');
        expect(workflowsUiSrc).toContain("{step.subject || ''}");
    });

    it('the create-form pre-populates from the selected type (the listed types ARE the templates)', () => {
        expect(scheduledTabSrc).toContain('Message template');
        expect(scheduledTabSrc).toContain('SCHEDULE_TEMPLATES.map');
        expect(scheduledTabSrc).toContain('applyTemplate');
        expect(scheduledTabSrc).toContain('openScheduleForm');
        // Type-swap only replaces untouched template text, never a user draft
        expect(scheduledTabSrc).toContain('isPristineTemplateText');
    });
});

describe('dispatch processor: no double-send, no zombie sends', () => {
    it('claims each due row (scheduled → sending) BEFORE provider calls', () => {
        expect(portalsSrc).toContain('claimScheduledMessage = internalMutation');
        const runBlock = portalsSrc.slice(portalsSrc.indexOf('processScheduledMessages = internalAction'));
        expect(runBlock.indexOf('claimScheduledMessage')).toBeGreaterThan(-1);
        expect(runBlock.indexOf('claimScheduledMessage')).toBeLessThan(runBlock.indexOf('api.communications.sendEmail'));
    });

    it('reclaims stale "sending" rows at the start of every run', () => {
        expect(portalsSrc).toContain('reclaimStaleSending = internalMutation');
        const runBlock = portalsSrc.slice(portalsSrc.indexOf('processScheduledMessages = internalAction'));
        const reclaimIdx = runBlock.indexOf('reclaimStaleSending');
        const fetchIdx = runBlock.indexOf('getDueScheduledMessages');
        expect(reclaimIdx).toBeGreaterThan(-1);
        expect(reclaimIdx).toBeLessThan(fetchIdx); // recovery BEFORE the due fetch
    });

    it('automated emails carry the branded footer; manual sends are untouched', () => {
        const runBlock = portalsSrc.slice(portalsSrc.indexOf('processScheduledMessages = internalAction'));
        expect(runBlock).toContain('buildAutomatedEmailHtml');
        expect(runBlock).toContain('msg.isAutomation');
    });

    it('opt-outs are enforced at dispatch time as well as enqueue time', () => {
        const runBlock = portalsSrc.slice(portalsSrc.indexOf('processScheduledMessages = internalAction'));
        expect(runBlock).toContain('isContactOptedOut');
        expect(runBlock).toContain('recipient_opted_out');
    });
});

describe('payment suppression (restored WhatsApp-era behaviour)', () => {
    it('submitPaymentProof holds pending automation rows', () => {
        const block = portalsSrc.slice(portalsSrc.indexOf('submitPaymentProof = mutation'), portalsSrc.indexOf('getPaymentProofsByFirm'));
        expect(block).toContain('onPaymentProofSubmitted');
    });

    it('updatePaymentProofStatus cancels on approve and resumes on reject', () => {
        const block = portalsSrc.slice(portalsSrc.indexOf('updatePaymentProofStatus = mutation'), portalsSrc.indexOf('Tenant Documents for Portal'));
        expect(block).toContain('onPaymentProofApproved');
        expect(block).toContain('onPaymentProofRejected');
    });

    it('approve cancels only collection-ladder types (receipts/renewals survive)', () => {
        const block = engineSrc.slice(engineSrc.indexOf('onPaymentProofApproved = internalMutation'), engineSrc.indexOf('onPaymentProofRejected = internalMutation'));
        expect(block).toContain('rent_reminder');
        expect(block).toContain('late_notice');
        expect(block).toContain('service_charge_alert');
    });

    it('reject resumes the held ladder promptly (scheduledFor floor = now+60s)', () => {
        const block = engineSrc.slice(engineSrc.indexOf('onPaymentProofRejected = internalMutation'), engineSrc.indexOf('isContactOptedOut'));
        expect(block).toContain('Math.max');
        expect(block).toMatch(/60_000|60000/);
    });

    it('the Paystack webhook verifies pending tenant proofs on charge.success', () => {
        const start = paystackSrc.indexOf("args.eventType === 'charge.success'");
        const block = paystackSrc.slice(start, paystackSrc.lastIndexOf('paystackEvents'));
        expect(start).toBeGreaterThan(-1);
        expect(block).toContain('pending_verification');
        expect(block).toContain('onPaymentProofApproved');
    });
});

describe('unsubscribe route + founder recovery wiring', () => {
    it('the /unsubscribe HTTP route exists and validates tokens', () => {
        expect(httpSrc).toContain('path: "/unsubscribe"');
        expect(httpSrc).toContain('decodeUnsubscribeToken');
        expect(httpSrc).toContain('recordOptOut');
    });

    it('the founder login wires the full recovery flow', () => {
        expect(loginSrc).toContain('findFounderAccounts');
        expect(loginSrc).toContain('sendFounderRecoveryCode');
        expect(loginSrc).toContain('requestPasswordReset');
        expect(loginSrc).toContain('resetPassword');
        expect(loginSrc).toMatch(/Forgot password/i);
    });

    it('the account finder masks emails (never returns full addresses)', () => {
        const block = read('convex/myFunctions.ts').slice(
            read('convex/myFunctions.ts').indexOf('findFounderAccounts = query'),
            read('convex/myFunctions.ts').indexOf('sendFounderRecoveryCode = mutation')
        );
        expect(block).toContain('maskEmail');
        expect(block).toContain('maskedEmail');
    });

    it('founder push diagnostics persist the result and name the Firebase fix', () => {
        expect(settingsSrc).toContain('lastPushResult');
        expect(settingsSrc).toContain('com.practicepro.admin');
    });
});

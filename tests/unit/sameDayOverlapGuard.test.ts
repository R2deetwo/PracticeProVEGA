/**
 * sameDayOverlapGuard.test.ts — one payment reminder per resident per day
 * (2026-09-14), plus the "Who gets this message?" restoration.
 *
 * USER CONTEXT (two worries, one round):
 *   1. "i just hope there is no overlap with messages cause you called one
 *      rent and service charge and you called the other service charge
 *      something" — the two payment ladders share due dates in practice;
 *      both could message the SAME resident on the SAME day.
 *   2. "i wonder why you got rid of the 'who gets this message?' in the
 *      scheduled messages schedules" — the fan-out design buried recipient
 *      identity in truncated one-line rows.
 *
 * PINS:
 *   1. paymentSeverity orders escalations > due-day > pre-due > exempt.
 *   2. The engine pre-seeds claimedToday from earlier runs same-day, then
 *      appends as it claims residents — and records suppressed_daily_overlap
 *      so the log explains WHY a dispatch was skipped.
 *   3. Candidates dispatch in severity order (stable sort — rent before
 *      service charge at equal severity).
 *   4. The two payment workflow names no longer collide ("Rent Collection
 *      Ladder" vs "Service Charge Reminders") and both descriptions state
 *      what they cover.
 *   5. The Scheduled tab renders an explicit "Who gets this message?"
 *      expander per schedule card, groups identical fan-out rows, and keeps
 *      one-tap hold/stop for single dispatches.
 *   6. The workflow cards surface the one-per-day promise in the UI.
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

// Pure helpers — safe to import directly (house pattern: engine math).
import { paymentSeverity, PAYMENT_WORKFLOW_KEYS, AUTOMATION_WORKFLOW_DEFAULTS } from '../../convex/automationEngine';

const ENGINE = 'convex/automationEngine.ts';
const SCHEDULED = 'src/components/messaging/ScheduledTab.tsx';
const WORKFLOWS = 'src/components/messaging/AutomationWorkflows.tsx';

describe('same-day overlap guard (engine contract)', () => {
    it('1. severity ordering: escalation < due-day < pre-due < exempt', () => {
        // Lower sorts first and claims the resident's day.
        expect(paymentSeverity('rent_collection', { offsetDays: 7, messageType: 'late_notice' })).toBe(0);
        expect(paymentSeverity('service_charge', { offsetDays: 14, messageType: 'final_demand' })).toBe(0);
        expect(paymentSeverity('rent_collection', { offsetDays: 0, messageType: 'rent_reminder' })).toBe(1);
        expect(paymentSeverity('rent_collection', { offsetDays: -3, messageType: 'rent_reminder' })).toBe(2);
        expect(paymentSeverity('rent_collection', { offsetDays: 5, messageType: 'rent_reminder' })).toBe(2);
        // Informational workflows are exempt from the guard entirely.
        expect(paymentSeverity('lease_expiry', { offsetDays: 0, messageType: 'lease_renewal' })).toBe(3);
        expect(paymentSeverity('rent_review', { offsetDays: 30, messageType: 'custom' })).toBe(3);
    });

    it('2. exactly the two payment ladders are guarded', () => {
        expect(PAYMENT_WORKFLOW_KEYS.has('rent_collection')).toBe(true);
        expect(PAYMENT_WORKFLOW_KEYS.has('service_charge')).toBe(true);
        expect(PAYMENT_WORKFLOW_KEYS.has('lease_expiry')).toBe(false);
        expect(PAYMENT_WORKFLOW_KEYS.has('rent_review')).toBe(false);
        expect(PAYMENT_WORKFLOW_KEYS.size).toBe(2);
    });

    it('3. the engine pre-seeds same-day claims, appends, and logs the suppression', () => {
        const engine = read(ENGINE);
        const runIdx = engine.indexOf('export const runAutomationEngine');
        expect(runIdx).toBeGreaterThan(-1);
        const body = engine.slice(runIdx, runIdx + 12000);

        // Pre-seed from earlier runs / re-runs (same UTC day window).
        expect(body).toContain('claimedToday');
        expect(body).toContain('dayStartMs');
        // Cancelled/failed rows must NOT count as "already messaged today".
        expect(body).toContain("status === \"cancelled\"");
        // The skip reason is recorded (log explains the silence).
        expect(body).toContain('suppressed_daily_overlap');
        // The claim is appended as this run dispatches.
        expect(body).toContain('claimedToday.add(String(t.tenantKey))');
        // Dispatch order: severity ascending (escalations claim the day first).
        expect(body).toContain('candidates.sort((a, b) => paymentSeverity(a.wf.def.key, a.step) - paymentSeverity(b.wf.def.key, b.step))');
    });

    it('4. the two payment workflow names no longer collide', () => {
        const rent = AUTOMATION_WORKFLOW_DEFAULTS.find((w) => w.key === 'rent_collection');
        const sc = AUTOMATION_WORKFLOW_DEFAULTS.find((w) => w.key === 'service_charge');
        expect(rent?.name).toBe('Rent Collection Ladder');
        expect(sc?.name).toBe('Service Charge Reminders');
        // Descriptions state scope + the one-per-day promise.
        expect(rent?.description).toContain('RENT only');
        expect(sc?.description).toContain('SERVICE CHARGE only');
        expect(sc?.description).toContain('at most ONE payment reminder per day');
    });
});

describe('"Who gets this message?" restoration (UI contract)', () => {
    it('5. every schedule card carries the expander + grouped fan-out', () => {
        const tab = read(SCHEDULED);
        // The literal affordance, restored and unmissable.
        expect(tab).toContain('Who gets this message?');
        // Fan-out rows collapse by (content + send time + workflow step).
        expect(tab).toContain('const groupRows = (rows: any[])');
        // Both pending sections render grouped cards.
        expect(tab).toContain("groupRows(automationQueue).map((g) => renderGroupCard(g, 'automation'))");
        expect(tab).toContain("groupRows(mine).map((g) => renderGroupCard(g, 'mine'))");
        // History groups too (a 30-recipient send is one line, expandable).
        expect(tab).toContain('groupRows(history).map(historyGroupRow)');
        // One-tap hold/stop preserved for single dispatches.
        expect(tab).toContain('Single dispatch: one-tap hold/stop stay in the header.');
        // Group-level stop-all for multi-recipient sends.
        expect(tab).toContain('Stop all {count} dispatches');
        // Recipients resolve unit context (not a bare truncated name).
        expect(tab).toContain('unitLabelFor(row.unitId)');
    });

    it('6. workflow cards surface the one-per-day promise', () => {
        const wf = read(WORKFLOWS);
        expect(wf).toContain('One payment reminder per resident per day');
        expect(wf).toContain('ShieldIcon');
        // Mobile: long descriptions clamp when collapsed, header subtext
        // hidden on xs (the same round's mobile-optimization ask).
        expect(wf).toContain("open ? '' : 'line-clamp-2'");
        expect(wf).toContain('hidden sm:inline');
        // The scheduled tab header too.
        const tab = read(SCHEDULED);
        expect(tab).toContain('hidden sm:block');
    });
});

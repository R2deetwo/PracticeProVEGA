/**
 * phaseRoundF.test.ts — UX-32/33/34 source contracts (Phase 0 roadmap,
 * Phase 5 workflow-surgery row).
 *
 * UX-32: the scoped Add-unit action is restored on the Units tab (the inline
 *   form was fully built but unreachable; the edit modal was the only path).
 * UX-33: guards reply where they triage — InlineTicketReply is extracted to a
 *   shared module used by BOTH MessagesView and MaintenanceQueue, and the
 *   property maintenance badge deep-links to the ticket's conversation
 *   (legacy tickets fall back to the messaging hub).
 * UX-34: the two automation paradigms are linked — AutomationCenter (property
 *   reminders) points to the Settings matter-workflow studio for legal-capable
 *   firms, and AutomationSettings points back to Financials → Reminder Rules
 *   for property-capable firms. One job, two honest, cross-linked surfaces.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const src = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

describe('UX-32 — the scoped Add-unit action is restored', () => {
    const pd = src('src/components/details/PropertyDetailView.tsx');
    it('the Units tab header carries a live Add Unit button', () => {
        expect(pd).toContain('onClick={() => setShowAddUnitForm(true)}');
        expect(pd).toContain('Add Unit');
    });
    it('the inline form still has its submit/cancel handlers wired', () => {
        expect(pd).toContain('{showAddUnitForm && (');
        expect(pd).toContain('onClick={handleAddUnitSubmit}');
        expect(pd).toContain("setShowAddUnitForm(false); setNewUnitName('')");
    });
});

describe('UX-33 — guards reply where they triage', () => {
    it('InlineTicketReply is a shared module used by both hosts', () => {
        const shared = src('src/components/messaging/InlineTicketReply.tsx');
        expect(shared).toContain('threadTicketId: ticketId');
        const mv = src('src/components/MessagesView.tsx');
        expect(mv).toContain("import { InlineTicketReply } from './messaging/InlineTicketReply'");
        expect(mv).not.toContain('const InlineTicketReply: React.FC');
        const mq = src('src/components/atrium/MaintenanceQueue.tsx');
        expect(mq).toContain("import { InlineTicketReply } from '../messaging/InlineTicketReply'");
    });
    it('MaintenanceQueue embeds the composer on conversational rows', () => {
        const mq = src('src/components/atrium/MaintenanceQueue.tsx');
        expect(mq).toContain("t.status !== 'cancelled' && t.conversationId && (");
        expect(mq).toContain('activeReplyId === t._id ? (');
        expect(mq).toContain('Reply to resident');
        expect(mq).toContain('sendAdminReply={sendAdminReply}');
        // the ticket type carries the link field the queue gates on
        expect(mq).toContain('conversationId?: string;');
    });
    it('the property maintenance badge deep-links to the ticket conversation', () => {
        const pd = src('src/components/details/PropertyDetailView.tsx');
        expect(pd).toContain("openTickets.map((t: any) => t.conversationId).find(Boolean)");
        expect(pd).toContain("navigateTo('messaging', null, { initialTab: 'inbox', selectedInboxId: String(targetConv) })");
        // honest fallback for legacy tickets with no conversation link
        expect(pd).toContain("navigateTo('messaging' as any)");
    });
});

describe('UX-34 — the two automation surfaces are cross-linked', () => {
    it('AutomationCenter points legal-capable firms to the matter-workflow studio', () => {
        const ac = src('src/components/atrium/AutomationCenter.tsx');
        expect(ac).toContain("(isLegal || isUnified) && (");
        expect(ac).toContain("navigateTo('settings', null, { settingsTargetId: 'automation-settings' })");
        expect(ac).toContain('Matter workflows → Settings');
    });
    it('AutomationSettings points property-capable firms to Reminder Rules', () => {
        const asrc = src('src/components/settings/AutomationSettings.tsx');
        expect(asrc).toContain("(isProperty || isUnified) && (");
        expect(asrc).toContain("navigateTo('billing', null, { billingTab: 'automations' })");
        expect(asrc).toContain('Financials → Reminder Rules');
    });
});

describe('Round F follow-up — status chips pass contrast on light', () => {
    it('LedgerManager STATUS_STYLES are paired', () => {
        const lm = src('src/components/atrium/LedgerManager.tsx');
        expect(lm).toContain("cleared: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'");
        expect(lm).not.toContain("'bg-emerald-900/40 text-emerald-400 border-emerald-800'");
    });
    it('AutomationCenter action chips are paired', () => {
        const ac = src('src/components/atrium/AutomationCenter.tsx');
        expect(ac).toContain('bg-green-100 dark:bg-green-900/30');
        expect(ac).toContain('bg-sky-100 dark:bg-sky-900/30');
        expect(ac).not.toContain('bg-green-900/30 hover:bg-green-900/50 text-green-400');
    });
    it('ServiceChargeMonitor critical chips are paired', () => {
        const scm = src('src/components/atrium/ServiceChargeMonitor.tsx');
        expect(scm).toContain('bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400');
    });
});

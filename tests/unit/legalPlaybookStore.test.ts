/**
 * legalPlaybookStore tests — ALOA's "learn from the web, never from user
 * data" research memory (2026-09-24, user feedback round 3).
 *
 * The user's requirement: "ensure that anything it gets from the web it
 * learns from in terms of legal drafting and law — but it should not use
 * user data to learn."
 *
 * These tests pin:
 *   1. Saving a researched packet stores process/legal/document knowledge.
 *   2. NOTHING user-identifying survives the scrubber (emails, phone
 *      numbers, long digit runs, bracketed personal facts).
 *   3. Retrieval finds the right playbook for a similar job.
 *   4. Merging refreshes a similar playbook instead of duplicating it.
 *   5. The LRU cap holds.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    savePlaybook,
    findRelevantPlaybooks,
    renderPlaybookContext,
    clearPlaybooks,
    scrubUserIdentifiers,
    LegalPlaybook,
} from '../../src/utils/legalPlaybookStore';

const FIRM = 'firm-test-1';

// A minimal localStorage shim for the node test environment.
const store = new Map<string, string>();
beforeEach(() => {
    store.clear();
    (global as any).localStorage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
    };
    clearPlaybooks(FIRM);
});

const possessionPacket = {
    jobTitle: 'Recovering possession of a tenanted flat in Lagos',
    processSummary: 'Serve a notice to quit, then a 7-day notice of owner intention, then file at the court.',
    legalRequirements: 'Lagos Tenancy Law 2011 requires 6 months notice for yearly tenancies.',
    documents: [
        { name: 'Notice to Quit', purpose: 'Terminates the tenancy.', legalBasis: 's. 13, Lagos Tenancy Law 2011' },
        { name: "Notice of Owner's Intention to Recover Possession", purpose: '7-day statutory warning.' },
    ],
    sources: [{ text: 'Lagos Tenancy Law 2011 — text of sections', url: 'https://example.com/lagos-tenancy' }],
};

describe('scrubUserIdentifiers — the "never learn user data" guarantee', () => {
    it('removes emails', () => {
        expect(scrubUserIdentifiers('Contact chidi.okafor@example.com for details')).not.toContain('chidi.okafor@example.com');
    });

    it('removes phone numbers (Nigerian and generic)', () => {
        expect(scrubUserIdentifiers('Call +234 803 123 4567 now')).not.toMatch(/\+234\s?803/);
        expect(scrubUserIdentifiers('Call 08031234567 now')).not.toContain('08031234567');
    });

    it('neutralises bracketed personal facts and long reference numbers', () => {
        const out = scrubUserIdentifiers('For [MR CHIDI OKAFOR of 12 MARINA ROAD] re account 1234567890');
        expect(out).toContain('[DETAIL]');
        expect(out).toContain('[REF]');
        expect(out).not.toContain('CHIDI');
    });

    it('leaves plain legal knowledge untouched', () => {
        const text = 'A yearly tenant in Lagos is entitled to 6 months notice to quit.';
        expect(scrubUserIdentifiers(text)).toBe(text);
    });
});

describe('savePlaybook + findRelevantPlaybooks', () => {
    it('stores a researched packet and retrieves it for a similar job', () => {
        savePlaybook(FIRM, possessionPacket);
        const found = findRelevantPlaybooks(FIRM, 'draft the documents necessary to recover possession of my flat in Lagos');
        expect(found.length).toBeGreaterThan(0);
        expect(found[0].jobTitle).toContain('Recovering possession');
        expect(found[0].documents.map(d => d.name)).toContain('Notice to Quit');
    });

    it('does not retrieve for an unrelated job', () => {
        savePlaybook(FIRM, possessionPacket);
        const found = findRelevantPlaybooks(FIRM, 'incorporate a company at CAC and draft a shareholders agreement');
        expect(found.length).toBe(0);
    });

    it('never persists user-identifying material from the research text', () => {
        savePlaybook(FIRM, {
            ...possessionPacket,
            processSummary: 'Serve notices on [MR CHIDI OKAFOR] — email chidi@example.com, phone 08031234567.',
        });
        const raw = store.get(`legalplaybooks:${FIRM}`) || '';
        expect(raw).not.toContain('chidi@example.com');
        expect(raw).not.toContain('08031234567');
        expect(raw).not.toContain('CHIDI OKAFOR');
        // The legal knowledge part survives.
        expect(raw).toContain('Serve notices');
    });

    it('merges re-researched similar jobs instead of duplicating', () => {
        savePlaybook(FIRM, possessionPacket);
        savePlaybook(FIRM, {
            ...possessionPacket,
            jobTitle: 'Recovery of possession of a tenanted flat in Lagos State',
            legalRequirements: 'Updated: Lagos Tenancy Law 2011 as amended.',
        });
        const found = findRelevantPlaybooks(FIRM, 'recover possession tenanted flat Lagos');
        expect(found.length).toBe(1);
        expect(found[0].legalRequirements).toContain('as amended');
    });

    it('caps the store at 20 playbooks (LRU)', () => {
        for (let i = 0; i < 25; i++) {
            savePlaybook(FIRM, {
                jobTitle: `Distinct legal job number ${i} — registering a charge`,
                documents: [{ name: `Document ${i}`, purpose: 'Purpose.' }],
            });
        }
        const raw = store.get(`legalplaybooks:${FIRM}`) || '';
        const parsed = JSON.parse(raw) as LegalPlaybook[];
        expect(parsed.length).toBeLessThanOrEqual(20);
    });

    it('rejects packets with no documents', () => {
        expect(savePlaybook(FIRM, { jobTitle: 'Empty', documents: [] })).toBeNull();
    });
});

describe('renderPlaybookContext', () => {
    it('renders a labelled, prompt-injectable knowledge block', () => {
        savePlaybook(FIRM, possessionPacket);
        const found = findRelevantPlaybooks(FIRM, 'recover possession of tenanted flat in Lagos');
        const ctx = renderPlaybookContext(found);
        expect(ctx).toContain('FIRM RESEARCH KNOWLEDGE');
        expect(ctx).toContain('PLAYBOOK 1');
        expect(ctx).toContain('Notice to Quit');
        expect(ctx).toContain('NOT user facts');
    });

    it('returns empty for no playbooks', () => {
        expect(renderPlaybookContext([])).toBe('');
    });
});

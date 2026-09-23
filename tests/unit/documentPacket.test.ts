/**
 * documentPacket tests — Task 69 (ALOA Document Packet system).
 *
 * Root cause being tested: the user asked ALOA to "draft the documents
 * necessary" for a process; ALOA drafted ONE document, then drafted the
 * next one "rather weakly" from a bare instruction. The packet system must
 * (a) normalise model tool args into a safe packet, (b) build a rich,
 * context-carrying prompt for EVERY packet document (never bare), and
 * (c) detect document-set requests for status-line sugar.
 */
import { describe, it, expect } from 'vitest';
import {
    buildPacketDraftPrompt,
    normalizePacketArgs,
    packetDocDraftKey,
    mentionsDocumentSet,
    DocumentPacket,
} from '../../src/utils/documentPacket';

const basePacket: DocumentPacket = {
    jobId: 'pktabc123',
    jobTitle: 'Recovering possession of a tenanted flat in Lagos',
    processSummary:
        'Serve the statutory notices, then file at the Magistrate/HIGH Court if the tenant does not yield possession.',
    legalRequirements:
        'Lagos Tenancy Law 2011: half-a-year notice for yearly tenancies; 7 days notice of owner intention to recover possession after the notice to quit expires.',
    documents: [
        {
            name: 'Notice to Quit',
            purpose: 'Terminates the tenancy as at the expiration date — the foundation document for recovery.',
            legalBasis: 's. 13, Lagos Tenancy Law 2011 (yearly tenancy — 6 months notice)',
        },
        {
            name: "Notice of Owner's Intention to Recover Possession",
            purpose: 'Statutory 7-day warning after the quit notice expires; a precondition to filing.',
            legalBasis: 'Recovery of Premises provisions, Lagos Tenancy Law 2011',
            notes: 'Must be served on the tenant personally or by substituted means.',
        },
    ],
    createdAt: '2026-09-24T00:00:00.000Z',
};

describe('normalizePacketArgs', () => {
    it('normalises a well-formed tool call', () => {
        const p = normalizePacketArgs({
            jobTitle: 'Incorporating a company limited by guarantee at CAC',
            processSummary: 'Name reservation, then filing of incorporation documents.',
            documents: [
                { name: 'Application for Name Reservation', purpose: 'Reserves the proposed name.' },
                { name: 'Memorandum & Articles', purpose: 'Constitution of the company.', legalBasis: 'CAMA 2020' },
            ],
        });
        expect(p).not.toBeNull();
        expect(p!.documents).toHaveLength(2);
        expect(p!.documents[0].name).toBe('Application for Name Reservation');
        expect(p!.jobTitle).toContain('CAC');
    });

    it('returns null when no usable documents are present', () => {
        expect(normalizePacketArgs({ jobTitle: 'X', documents: [] })).toBeNull();
        expect(normalizePacketArgs({ jobTitle: 'X', documents: [{ purpose: 'no name' }] })).toBeNull();
        expect(normalizePacketArgs(null)).toBeNull();
    });

    it('truncates hostile overlong fields and caps sources', () => {
        const p = normalizePacketArgs({
            jobTitle: 'J'.repeat(5000),
            documents: [{ name: 'D'.repeat(500), purpose: 'P'.repeat(5000) }],
            citations: Array.from({ length: 20 }, (_, i) => ({ text: `source ${i}` })),
        });
        expect(p!.jobTitle.length).toBeLessThanOrEqual(200);
        expect(p!.documents[0].name.length).toBeLessThanOrEqual(200);
        expect(p!.documents[0].purpose.length).toBeLessThanOrEqual(600);
        expect(p!.sources).toHaveLength(12);
    });
});

describe('buildPacketDraftPrompt — the anti-weak-draft fix', () => {
    it('carries the job, process, legal requirements, purpose and legal basis', () => {
        const prompt = buildPacketDraftPrompt(basePacket, 0, { conversationContext: 'My tenant Chidi has not paid rent for 8 months at 12 Awolowo Road.' });
        expect(prompt).toContain('Recovering possession of a tenanted flat in Lagos');
        expect(prompt).toContain('Notice to Quit');
        expect(prompt).toContain('Terminates the tenancy');
        expect(prompt).toContain('s. 13, Lagos Tenancy Law 2011');
        expect(prompt).toContain('WHAT THE LAW REQUIRES');
        expect(prompt).toContain('Chidi');
        expect(prompt).toContain('(1 of 2)');
    });

    it('includes the sequencing position for the second document', () => {
        const prompt = buildPacketDraftPrompt(basePacket, 1, {});
        expect(prompt).toContain('(2 of 2)');
        expect(prompt).toContain("Notice of Owner's Intention to Recover Possession");
        expect(prompt).toContain('substituted means'); // notes included
    });

    it('never leaves the facts section empty without a fallback instruction', () => {
        const prompt = buildPacketDraftPrompt(basePacket, 0, {});
        expect(prompt).toContain('none supplied');
        expect(prompt).toContain('[BRACKETED PLACEHOLDERS]');
    });

    it('adapts the principal line to property mode', () => {
        const legal = buildPacketDraftPrompt(basePacket, 0, { isProperty: false });
        const property = buildPacketDraftPrompt(basePacket, 0, { isProperty: true });
        expect(legal).toContain('lawyer/solicitor');
        expect(property).toContain('property manager');
    });

    it('injects firm research playbooks (web-learned knowledge) when provided', () => {
        const prompt = buildPacketDraftPrompt(basePacket, 0, {
            playbookContext: 'FIRM RESEARCH KNOWLEDGE (learned from public legal research — NOT user facts):\nPLAYBOOK 1 — Recovering possession of a tenanted flat in Lagos\nProcess: notice to quit → 7-day notice → filing.',
        });
        expect(prompt).toContain('FIRM RESEARCH KNOWLEDGE');
        expect(prompt).toContain('PLAYBOOK 1');
        expect(prompt.indexOf('PLAYBOOK 1')).toBeLessThan(prompt.indexOf('FACTS FROM THE CONVERSATION'));
    });

    it('demands zero vertical gaps in every packet draft (2026-09-24)', () => {
        const prompt = buildPacketDraftPrompt(basePacket, 0, {});
        expect(prompt).toContain('Zero vertical gaps');
    });

    it('throws for an out-of-range index instead of drafting the wrong document', () => {
        expect(() => buildPacketDraftPrompt(basePacket, 9, {})).toThrow();
    });
});

describe('packetDocDraftKey', () => {
    it('gives every document in a packet a distinct, stable key', () => {
        const k0 = packetDocDraftKey(basePacket, 0);
        const k1 = packetDocDraftKey(basePacket, 1);
        expect(k0).not.toBe(k1);
        expect(k0).toBe(packetDocDraftKey(basePacket, 0));
        expect(k0.startsWith('draft:pkt-')).toBe(true);
    });

    it('does not collide across packets with same-named documents', () => {
        const other: DocumentPacket = { ...basePacket, jobId: 'pktxyz999' };
        expect(packetDocDraftKey(basePacket, 0)).not.toBe(packetDocDraftKey(other, 0));
    });
});

describe('mentionsDocumentSet (status-line heuristic)', () => {
    it('detects document-set requests', () => {
        expect(mentionsDocumentSet('please draft the documents necessary to recover my flat')).toBe(true);
        expect(mentionsDocumentSet('what documents do I need to file at CAC?')).toBe(true);
        expect(mentionsDocumentSet('prepare all the documents for this probate')).toBe(true);
        expect(mentionsDocumentSet('the paperwork for tenant onboarding')).toBe(true);
    });

    it('does not fire on single-document or casual messages', () => {
        expect(mentionsDocumentSet('hello')).toBe(false);
        expect(mentionsDocumentSet('draft a tenancy agreement')).toBe(false);
        expect(mentionsDocumentSet('what is my task list?')).toBe(false);
    });
});

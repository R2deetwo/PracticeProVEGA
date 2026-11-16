/**
 * complianceGate + frontloading + signatureCompliance + preflight — the
 * Pillar 1 orchestrator and its surfaces.
 *
 * Part of the ALOA LEGAL ENGINE test suite. SAFE_STOP must fire on a time
 * bar and on nothing else; advisory findings must never block.
 */
import { describe, it, expect } from 'vitest';
import { runComplianceGate } from '../../src/legal/complianceGate';
import { checkFrontloadingBundle } from '../../src/legal/frontloadingGate';
import { checkSignatureBlock } from '../../src/legal/signatureCompliance';
import { runCourtProcessPreflight } from '../../src/legal/preflight';

describe('checkFrontloadingBundle', () => {
    it('detects the missing mandatory items and separates conditional ones', () => {
        const r = checkFrontloadingBundle({
            documentTitles: ['Statement of Claim', 'Witness Statement on Oath of John Doe', 'List of Witnesses', 'List of Documents'],
            processType: 'Writ of Summons',
        });
        expect(r.satisfied.length).toBe(4);
        expect(r.missing).toEqual([]);
        expect(r.complete).toBe(true);
        expect(r.conditionalMissing.length).toBe(1); // pre-action counseling — conditional
        expect(r.citation).toContain('frontloading');
    });

    it('reports every missing mandatory document', () => {
        const r = checkFrontloadingBundle({ documentTitles: ['Cover letter'], processType: 'Writ of Summons' });
        expect(r.complete).toBe(false);
        expect(r.missing.length).toBe(4);
        expect(r.missing.some(m => m.includes('Statement of Claim'))).toBe(true);
        expect(r.missing.some(m => m.includes('List of Witnesses'))).toBe(true);
    });

    it('Originating Summons carries the affidavit note', () => {
        const r = checkFrontloadingBundle({ documentTitles: [], processType: 'Originating Summons' });
        expect(r.notes.some(n => n.includes('Originating Summons'))).toBe(true);
    });
});

describe('checkSignatureBlock', () => {
    it('a complete block passes', () => {
        const r = checkSignatureBlock(
            'Dated this 5th day of June 2026. Jane Doe, Esq. (Call to Bar: 2015) NBA/SC/1234567. NBA Seal and Stamp affixed.',
        );
        expect(r.missing).toEqual([]);
        expect(r.present).toEqual({ fullName: true, callToBarNumber: true, nbaSealStamp: true });
    });

    it('each missing element is named', () => {
        const r = checkSignatureBlock('Filed at the registry today.');
        expect(r.missing.length).toBe(3);
        expect(r.missing.some(m => m.includes('full name'))).toBe(true);
        expect(r.missing.some(m => m.includes('Call-to-Bar'))).toBe(true);
        expect(r.missing.some(m => m.includes('NBA Seal'))).toBe(true);
    });

    it('detects the NBA number token without the label', () => {
        const r = checkSignatureBlock('Jane Doe, Esq. NBA/SC/7654321');
        expect(r.present.callToBarNumber).toBe(true);
        expect(r.missing.some(m => m.includes('NBA Seal'))).toBe(true);
    });
});

describe('runComplianceGate — SAFE_STOP semantics', () => {
    it('a time-barred claim stops the gate and lists the reasons', () => {
        const g = runComplianceGate({
            subjectMatter: 'breach of a supply contract',
            causeOfAction: 'simple_contract',
            accrualDate: '2018-01-01',
            proposedFilingDate: '2026-06-01',
            state: 'Lagos',
        });
        expect(g.safeStop).toBe(true);
        expect(g.safeStopReasons.length).toBe(1);
        expect(g.safeStopReasons[0]).toContain('TIME-BARRED');
        expect(g.checks.limitation?.status).toBe('TIME_BARRED');
        expect(g.checks.jurisdiction?.recommendedForum).toBe('STATE_HIGH_COURT');
        expect(g.citationTrace.some(c => c.check === 'jurisdiction')).toBe(true);
        expect(g.citationTrace.some(c => c.check === 'limitation')).toBe(true);
    });

    it('advisory findings (frontloading + signature gaps) do NOT stop the gate', () => {
        const g = runComplianceGate({
            subjectMatter: 'wrongful dismissal of an employee',
            causeOfAction: 'simple_contract',
            accrualDate: '2025-01-01',
            proposedFilingDate: '2026-01-01',
            originatingProcess: 'Writ of Summons',
            documentTitles: ['Statement of Claim'],
            documentText: '<p>I am the claimant and I say as follows:</p>',
        });
        expect(g.safeStop).toBe(false);
        expect(g.checks.jurisdiction?.recommendedForum).toBe('NICN');
        expect(g.checks.frontloading?.missing.length).toBe(3);
        expect(g.checks.signature?.missing.length).toBe(3);
        expect(g.advisory.length).toBeGreaterThanOrEqual(6);
    });

    it('no cause of action → no limitation check, no stop', () => {
        const g = runComplianceGate({ subjectMatter: 'recovery of land in Lekki' });
        expect(g.checks.limitation).toBeUndefined();
        expect(g.safeStop).toBe(false);
    });
});

describe('runCourtProcessPreflight — DraftPro export surface', () => {
    const COURT_HTML =
        '<h1>IN THE HIGH COURT OF LAGOS STATE</h1><p>SUIT NO: LD/1234/2026</p>' +
        '<p>It is trite law as held in Okafor v. Eze (2024) 12 NWLR (Pt. 1934) 1 at 15 that equity is discretionary.</p>';

    it('a court process with gaps returns WARN with findings', () => {
        const r = runCourtProcessPreflight(COURT_HTML, { title: 'Statement of Claim' });
        expect(r.isCourtProcess).toBe(true);
        expect(r.outcome).toBe('WARN');
        expect(r.citationCount).toBe(1);
        expect(r.findings.some(f => f.check === 'signature_block' && f.severity === 'HIGH')).toBe(true);
        expect(r.findings.some(f => f.check === 'evidential_closure' && f.severity === 'INFO')).toBe(true);
    });

    it('a complete signature block and complete citation still disclose the verification limit', () => {
        const html =
            COURT_HTML +
            '<p>Jane Doe, Esq. (Call to Bar: 2015) NBA/SC/1234567. NBA Seal and Stamp affixed.</p>';
        const r = runCourtProcessPreflight(html, { title: 'Statement of Claim' });
        // Signature satisfied; citation classified complete; the INFO
        // evidential-closure finding remains — honesty is unconditional.
        expect(r.findings.some(f => f.check === 'signature_block')).toBe(false);
        expect(r.findings.some(f => f.severity === 'INFO')).toBe(true);
        expect(r.outcome === 'PASS' || r.outcome === 'WARN').toBe(true);
    });

    it('a non-court document is skipped entirely', () => {
        const r = runCourtProcessPreflight('<p>Meeting notes from Tuesday standup</p>', { title: 'Notes' });
        expect(r.outcome).toBe('NOT_COURT_PROCESS');
        expect(r.findings).toEqual([]);
    });
});

/**
 * roundV1DPrivacy.test.ts — V1-D: AI PRIVACY TRUTH AND SECURITY CAMPAIGN
 * CLOSURE.
 * ─────────────────────────────────────────────────────────────────────────
 * Privacy-truth tests for every content path that leaves this client for an
 * external AI provider, plus the claim surfaces users read.
 *
 * FIXTURE RULE (round brief item 8): every NIN, BVN, phone, email, card and
 * bank value in this file is SYNTHETIC — generated for these tests, never
 * copied from any client record. No real client information appears here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    stripPIIWithReport,
    stripPII,
    toPersistablePiiReport,
    maskPIIValueForDisplay,
} from '../../src/utils/aiUtils';
import { buildAiAuditPayload } from '../../src/utils/aiTrust';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(here, '../..');
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Synthetic PII corpus (fixture rule: generated, never real) ─────────────
const SYN = {
    email: 'synthetic.client@example.com',        // not a real person
    phoneLocal: '08031234567',                    // synthetic NG mobile (0803…)
    phoneIntl: '+2348031234567',                  // the same number, intl form
    nin: '12345678901',                           // synthetic 11-digit NIN
    bvn: '22345678901',                           // synthetic 11-digit BVN
    card: '4111 1111 1111 1111',                  // classic test PAN (Luhn-valid, reserved for testing)
    bankAccount: '0123456789',                    // synthetic 10-digit account
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. The PII scan — behavioural, synthetic matrix
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-D — stripPIIWithReport (synthetic matrix)', () => {
    it('redacts every identified value class from Nigerian-format synthetic text', () => {
        const text = `Client email ${SYN.email}, phone ${SYN.phoneLocal}, NIN ${SYN.nin}, ` +
            `BVN ${SYN.bvn}, card ${SYN.card}. Transfer to account no: ${SYN.bankAccount}.`;
        const r = stripPIIWithReport(text);
        expect(r.sanitized).not.toContain(SYN.email);
        expect(r.sanitized).not.toContain(SYN.phoneLocal);
        expect(r.sanitized).not.toContain(SYN.nin);
        expect(r.sanitized).not.toContain(SYN.bvn);
        expect(r.sanitized).not.toContain(SYN.card);
        expect(r.sanitized).not.toContain(SYN.bankAccount);
        expect(r.sanitized).toContain('[EMAIL_REDACTED]');
        expect(r.sanitized).toContain('[PHONE_REDACTED]');
        expect(r.sanitized).toContain('[ID_REDACTED]');
        expect(r.sanitized).toContain('[CARD_REDACTED]');
        expect(r.sanitized).toContain('[ACCOUNT_REDACTED]');
        // The intl phone form of the same synthetic number is caught too:
        const r2 = stripPIIWithReport(`Call me on ${SYN.phoneIntl} please.`);
        expect(r2.sanitized).not.toContain(SYN.phoneIntl);
    });

    it('the in-memory report DOES carry originals by design (the scan needs them to report) — but nothing that persists may', () => {
        const r = stripPIIWithReport(`NIN ${SYN.nin} and email ${SYN.email}`);
        expect(r.found.some((f: any) => f.original === SYN.nin)).toBe(true);
        // ...and the persistence conversion drops them:
        const persistable = toPersistablePiiReport(r);
        const blob = JSON.stringify(persistable);
        expect(blob).not.toContain(SYN.nin);
        expect(blob).not.toContain(SYN.email);
        expect(persistable.found.every((f: any) => typeof f.masked === 'string' && !('original' in f))).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. The persistence mask
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-D — toPersistablePiiReport / maskPIIValueForDisplay', () => {
    it('masks long values as first2+••••+last2 and short values as ****', () => {
        expect(maskPIIValueForDisplay(SYN.nin)).toBe('12••••01');
        expect(maskPIIValueForDisplay(SYN.email)).toBe('sy••••om');
        expect(maskPIIValueForDisplay('1234')).toBe('****');
        expect(maskPIIValueForDisplay('123')).toBe('****');
    });

    it('a zero-findings report converts to an empty persistable list', () => {
        const persistable = toPersistablePiiReport({ found: [], totalStripped: 0 });
        expect(persistable.found).toEqual([]);
        expect(persistable.totalStripped).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. AI audit records never carry original sensitive content
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-D — AI audit preview is redacted (no logging of originals)', () => {
    it('a model output that echoes synthetic PII is redacted before the preview is built', () => {
        // A model response CAN echo PII that reached it via tool results —
        // the audit record (ai_output_logs) must never store those values.
        const modelOutput = `Your tenant can be reached on ${SYN.phoneLocal} and emailed at ${SYN.email}. NIN on file: ${SYN.nin}.`;
        const payload = buildAiAuditPayload({
            assistant: 'ALOA',
            text: modelOutput,
            model: 'gemini-test',
            conversationId: 'conv-synthetic',
            messageKind: 'chat',
        });
        expect(payload.preview).not.toContain(SYN.phoneLocal);
        expect(payload.preview).not.toContain(SYN.email);
        expect(payload.preview).not.toContain(SYN.nin);
        expect(payload.preview).toContain('[PHONE_REDACTED]');
        expect(payload.preview).toContain('[ID_REDACTED]');
        expect(payload.preview.length).toBeLessThanOrEqual(400);
        expect(payload.charCount).toBe(modelOutput.length);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Transmission-boundary source contracts (geminiService)
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-D — geminiService transmission boundary', () => {
    const src = read('src/services/geminiService.ts');
    const sendMessageStart = src.indexOf('export const sendMessage');
    const streamMessageStart = src.indexOf('export const streamMessage');
    const sendMessageFn = src.slice(sendMessageStart, streamMessageStart);
    const streamMessageFn = src.slice(streamMessageStart, src.indexOf('export const streamDraft'));

    it('retrieval queries (Brain + legal corpus → embedding provider) are redacted in BOTH paths', () => {
        for (const [name, fn] of [['sendMessage', sendMessageFn], ['streamMessage', streamMessageFn]] as const) {
            expect(fn).toContain('searchBrain(stripPII(lastUserMsg))');
            expect(fn).toContain('searchLegalRepo(stripPII(lastUserMsg))');
            expect(fn).not.toContain('searchBrain(lastUserMsg)');
            expect(fn).not.toContain('searchLegalRepo(lastUserMsg)');
        }
    });

    it('message text and system instructions are redacted in BOTH paths (pre-existing; pinned)', () => {
        expect(sendMessageFn).toContain('stripPII(msg.content)');
        expect(streamMessageFn).toContain('stripPII(msg.content)');
        expect(sendMessageFn).toContain('stripPII(systemInstruction + researchSuffix)');
        expect(streamMessageFn).toContain('stripPII(systemInstruction + researchSuffix)');
    });

    it('extracted attachment TEXT is redacted before it enters the payload in BOTH paths', () => {
        for (const [name, fn] of [['sendMessage', sendMessageFn], ['streamMessage', streamMessageFn]] as const) {
            expect(fn).toContain('stripPII(textParts.join(\'\\n\\n\'))');
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. ALOA chat — persistence + badge + ALDIA display
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-D — AloaChat message records and ALDIA display', () => {
    const aloaSrc = read('src/components/aloa/AloaChat.tsx');
    const badgeSrc = read('src/components/aloa/PIIShieldBadge.tsx');

    it('the piiResult stored on the message (→ aloaMessages rows) is the persistable form', () => {
        expect(aloaSrc).toContain('toPersistablePiiReport(piiResult)');
        expect(aloaSrc).not.toContain('piiResult = piiResult : undefined');
    });

    it('the message records the honest attachments-transmitted flag', () => {
        expect(aloaSrc).toContain('attachmentsTransmitted = (newUserMsg.attachments?.length ?? 0) > 0');
        expect(aloaSrc).toContain('attachmentsTransmitted={!!(m.raw as any).attachmentsTransmitted}');
    });

    it('the ALDIA tool result discloses file-mode transmission instead of implying redaction', () => {
        expect(aloaSrc).toContain("report.transmission?.mode === 'file'");
        expect(aloaSrc).toContain('The document file itself was transmitted to the AI provider');
        expect(aloaSrc).toContain('stripped from the text before AI analysis');
    });

    it('the badge renders masked previews (never originals) and the redaction-vs-attachment distinction', () => {
        expect(badgeSrc).toContain('item.masked ?? item.original');
        expect(badgeSrc).toContain('redaction, not pseudonymisation');
        expect(badgeSrc).toContain('image and scanned files are transmitted to the AI provider for analysis as-is');
        // The old false claim is gone:
        expect(badgeSrc).not.toContain('The AI never sees the original values');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. ALDIA — transmission disclosure + masked persisted report
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-D — ALDIA binary/file transmission truth', () => {
    const agentSrc = read('src/agents/AdvancedLegalDocumentIntelligenceAgent.ts');

    it('file-mode analyses disclose that the document itself was transmitted unredacted', () => {
        expect(agentSrc).toContain("transmissionMode = 'file'");
        expect(agentSrc).toContain("mode: 'file'");
        expect(agentSrc).toContain('piiRedactedInTransmission: false');
        expect(agentSrc).toContain('File contents are not redacted');
    });

    it('text-mode analyses state the redaction accurately', () => {
        expect(agentSrc).toContain("mode: 'text'");
        expect(agentSrc).toContain('piiRedactedInTransmission: true');
        expect(agentSrc).toContain('redacted from the text before transmission to the AI provider');
    });

    it('the persisted ALDIA report carries masked previews only (the report is spread onto documents rows)', () => {
        expect(agentSrc).toContain('toPersistablePiiReport(piiResult)');
        expect(agentSrc).toContain('piiStripped: persistablePii.found');
        // The report type no longer promises an `original` field:
        expect(agentSrc).not.toContain('piiStripped?: { type: string; original: string; replacement: string }[]');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Claim surfaces (the words users read)
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-D — user-facing privacy claims match reality', () => {
    it('AgentSettings: both PII Shield cards state the text/binary distinction', () => {
        const s = read('src/components/settings/AgentSettings.tsx');
        expect(s.split('Redacts NIN, BVN, account numbers from TEXT before AI processing. Attached/binary files are transmitted for analysis unredacted.').length).toBe(3); // two cards + the string itself
        expect(s).not.toContain('Strips NIN, BVN, account numbers before AI processing');
    });

    it('WhatsNew: the badge claim describes redaction + the attachment caveat', () => {
        const s = read('src/components/WhatsNew.tsx');
        expect(s).toContain('redacted from the message text before it is sent to the AI provider');
        expect(s).not.toContain('PII is detected and stripped before AI processing');
    });

    it('TermsOfService: the Privacy Shield definition carries the redaction/binary distinction', () => {
        const s = read('src/components/TermsOfService.tsx');
        expect(s).toContain('redaction, not anonymisation or pseudonymisation');
        expect(s).toContain('transmitted to the AI provider for analysis as-is');
        expect(s).not.toContain('helps redact Personally Identifiable Information (also called PII — data that can identify a person) before other AI Services process it');
    });

    it('AIConsentModal: the false “isolated within your firm’s encrypted workspace” claim is gone; transmission is disclosed', () => {
        const s = read('src/components/modals/AIConsentModal.tsx');
        expect(s).not.toContain('All inputs remain isolated within your firm');
        expect(s).toContain('transmitted to the configured AI provider (Google Gemini by default) for processing');
        expect(s).toContain('Attached and binary files (images, scanned PDFs) are transmitted for analysis as-is and cannot be redacted');
    });
});

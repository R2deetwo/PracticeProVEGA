/**
 * emailDelivery — the email channel for WhatsApp's duties (regression tests).
 *
 * CONTEXT: Chakra's WhatsApp gateway is billing-gated and the firm is not
 * using WhatsApp for now; receipts, service-charge alerts and rent
 * reminders must reach residents by EMAIL instead. These tests lock the
 * shared helpers: email-first channel preference, the branded receipt
 * email, and HTML escaping.
 */
import { describe, it, expect } from 'vitest';
import {
    resolvePreferredChannel,
    buildReceiptEmailHtml,
    buildReceiptEmailSubject,
    escapeHtml,
} from '../../src/utils/emailDelivery';

describe('resolvePreferredChannel — email-first while WhatsApp is paused', () => {
    it('prefers email when the tenant has one on file', () => {
        expect(resolvePreferredChannel({ tenantEmail: 'ada@ex.ng', tenantPhone: '08011112222' })).toBe('email');
    });

    it('falls back to WhatsApp only when no email exists', () => {
        expect(resolvePreferredChannel({ tenantEmail: '', tenantPhone: '08011112222' })).toBe('whatsapp');
        expect(resolvePreferredChannel({ tenantEmail: undefined, tenantPhone: undefined })).toBe('whatsapp');
    });

    it('an explicit prefill channel always wins', () => {
        expect(resolvePreferredChannel({ tenantEmail: 'ada@ex.ng', prefillChannel: 'whatsapp' })).toBe('whatsapp');
        expect(resolvePreferredChannel({ tenantPhone: '0801', prefillChannel: 'portal' })).toBe('portal');
    });

    it('trims whitespace before deciding', () => {
        expect(resolvePreferredChannel({ tenantEmail: '   ' })).toBe('whatsapp');
    });
});

describe('buildReceiptEmailHtml — the receipt in the resident\u2019s inbox', () => {
    const input = {
        firmName: 'Atrium Estates',
        receiptNumber: 'RC-123456-3',
        tenantName: 'Ada Obi',
        unitName: 'Block B, Unit 4',
        chargeTypeLabel: 'Service Charge',
        billingPeriod: 'September 2026',
        amountPaid: 720000,
        paymentDate: '2026-09-12',
        settlementMethod: 'Advance Payment (6 months)',
        coverageNote: 'Sep 2026 – Feb 2027 (6 months)',
    };

    it('carries the receipt facts + branded envelope', () => {
        const html = buildReceiptEmailHtml(input);
        expect(html).toContain('RC-123456-3');
        expect(html).toContain('Ada Obi');
        expect(html).toContain('Block B, Unit 4');
        expect(html).toContain('₦720,000');
        expect(html).toContain('Atrium Estates'); // firm-branded shell
        expect(html).toContain('Covers');         // advance coverage row
        expect(html).toContain('Sep 2026 – Feb 2027 (6 months)');
        expect(html).toContain('Advance Payment (6 months)');
    });

    it('omits the Covers row for plain single-period receipts', () => {
        const html = buildReceiptEmailHtml({ ...input, coverageNote: undefined });
        expect(html).not.toContain('Covers');
    });

    it('escapes HTML in tenant-provided fields', () => {
        const html = buildReceiptEmailHtml({ ...input, tenantName: '<script>alert(1)</script>' });
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('formats the amount with thousands separators', () => {
        const html = buildReceiptEmailHtml({ ...input, amountPaid: 3250000 });
        expect(html).toContain('₦3,250,000');
    });
});

describe('buildReceiptEmailSubject', () => {
    it('matches the portal message subject shape', () => {
        expect(buildReceiptEmailSubject({
            receiptNumber: 'RC-654321-2',
            chargeTypeLabel: 'Minimum Vend',
            billingPeriod: 'August 2026',
        })).toBe('Receipt RC-654321-2 — Minimum Vend (August 2026)');
    });
});

describe('escapeHtml', () => {
    it('neutralizes the dangerous five', () => {
        expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;');
    });
});

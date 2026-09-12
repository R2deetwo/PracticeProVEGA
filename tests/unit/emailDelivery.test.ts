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
    buildReceiptPdfBase64,
    receiptPdfFileName,
    buildTenantPortalLoginUrl,
    buildPortalButtonHtml,
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

    it('says the PDF is attached when pdfAttached is set', () => {
        const html = buildReceiptEmailHtml({ ...input, pdfAttached: true });
        expect(html).toContain('attached as a PDF');
        expect(html).toContain('same document you will find in your resident portal');
    });

    it('keeps the plain portal-copy intro when no PDF rides along', () => {
        const html = buildReceiptEmailHtml({ ...input, pdfAttached: false });
        expect(html).toContain('a copy is also available in your resident portal');
        expect(html).not.toContain('attached as a PDF');
    });

    it('renders the portal button when a portalUrl is provided', () => {
        const html = buildReceiptEmailHtml({ ...input, portalUrl: 'https://app.example/portal/tenant/login?email=ada%40ex.ng' });
        expect(html).toContain('Open your resident portal');
        expect(html).toContain('https://app.example/portal/tenant/login?email=ada%40ex.ng');
        expect(html).toContain('everything about your tenancy in one place');
    });

    it('omits the portal button when no portalUrl is provided', () => {
        const html = buildReceiptEmailHtml(input);
        expect(html).not.toContain('Open your resident portal');
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

describe('buildReceiptPdfBase64 — the receipt as a real PDF document', () => {
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

    it('returns raw base64 of a real PDF (magic header, no data: prefix)', () => {
        const b64 = buildReceiptPdfBase64(input);
        expect(b64).not.toContain('data:');
        expect(b64.startsWith('JVBERi0')).toBe(true); // base64('%PDF-')
        expect(b64.length).toBeGreaterThan(1000);     // a real document, not a stub
    });

    it('decodes to a PDF with the receipt metadata as plain content', () => {
        const b64 = buildReceiptPdfBase64(input);
        const decoded = Buffer.from(b64, 'base64').toString('latin1');
        expect(decoded.startsWith('%PDF-')).toBe(true);
        expect(decoded).toContain('RC-123456-3');
        expect(decoded).toContain('Atrium Estates');
        expect(decoded).toContain('NGN 720,000');
    });

    it('renders the naira amount as NGN (PDF core fonts carry no naira glyph)', () => {
        const decoded = Buffer.from(buildReceiptPdfBase64(input), 'base64').toString('latin1');
        expect(decoded).not.toContain('\u20A6');
        expect(decoded).toContain('NGN');
    });
});

describe('receiptPdfFileName', () => {
    it('derives a stable, filesystem-safe name from the receipt number', () => {
        expect(receiptPdfFileName('RC-123456-3')).toBe('Receipt-RC-123456-3.pdf');
        expect(receiptPdfFileName('RC 12/34:56')).toBe('Receipt-RC-12-34-56.pdf');
        expect(receiptPdfFileName('')).toBe('Receipt-receipt.pdf');
    });
});

describe('buildTenantPortalLoginUrl — the emailed portal link', () => {
    it('builds the login link with the email prefilled and encoded', () => {
        const url = buildTenantPortalLoginUrl('Ada.Obi@Example.ng', 'https://app.example');
        expect(url).toBe('https://app.example/portal/tenant/login?email=ada.obi%40example.ng');
    });

    it('trims trailing slashes off the origin', () => {
        const url = buildTenantPortalLoginUrl('ada@ex.ng', 'https://app.example/');
        expect(url).toBe('https://app.example/portal/tenant/login?email=ada%40ex.ng');
    });

    it('omits the query string entirely for an empty email', () => {
        expect(buildTenantPortalLoginUrl('', 'https://app.example'))
            .toBe('https://app.example/portal/tenant/login');
    });
});

describe('buildPortalButtonHtml', () => {
    it('renders a styled anchor with a safe href', () => {
        const html = buildPortalButtonHtml('https://app.example/portal/tenant/login?email=a%40b.ng');
        expect(html).toContain('<a href="https://app.example/portal/tenant/login?email=a%40b.ng"');
        expect(html).toContain('Open your resident portal');
    });

    it('escapes a malicious URL', () => {
        const html = buildPortalButtonHtml('" onmouseover="alert(1)');
        expect(html).not.toContain('" onmouseover=');
        expect(html).toContain('&quot;');
    });
});

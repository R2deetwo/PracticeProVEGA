/**
 * Messaging UX round (2026-09-08) — regression tests for the pure helpers
 * behind the user-facing fixes:
 *
 *   1. isWhatsAppWindowError — classifying Meta's 24-hour customer-service
 *      window / template-required errors (the "0 sent 1 failed" mystery:
 *      the reason existed but was discarded everywhere).
 *   2. buildEmailHtml — the branded email shell (firm name identity; plain
 *      text vs HTML body handling; escaping).
 *   3. resolveFinancials / parseMoneyInput / hasAutoFilledFigures — the
 *      per-recipient financial auto-fill ("selected late service charge
 *      for a resident and it still required me to fill in the info").
 *   4. sendWhatsAppWithTemplateFallback — free-form first, template retry
 *      only on window-class errors with a registered template.
 */
import { describe, it, expect } from 'vitest';
import {
  isWhatsAppWindowError,
  sendWhatsAppWithTemplateFallback,
  WHATSAPP_TEMPLATES,
  summarizeError,
} from '../../src/utils/deliveryErrors';
import { buildEmailHtml } from '../../src/utils/emailTemplate';
import {
  resolveFinancials,
  parseMoneyInput,
  hasAutoFilledFigures,
} from '../../src/utils/messageFinancials';
import { explainWhatsAppError, isWhatsAppWindowError as isWindowServer } from '../../convex/communications';

describe('isWhatsAppWindowError — the Meta 24h-window / template-required class', () => {
  it('recognises the Meta 131047 re-engagement error', () => {
    expect(isWhatsAppWindowError('Re-engagement message (code 131047)')).toBe(true);
  });

  it('recognises the "more than 24 hours" phrasing', () => {
    expect(isWhatsAppWindowError(
      'message failed to send because more than 24 hours have passed since the customer last replied'
    )).toBe(true);
  });

  it('recognises template-required phrasings', () => {
    expect(isWhatsAppWindowError('Message template is required for this message')).toBe(true);
    expect(isWhatsAppWindowError('Templates only allowed outside the 24h window')).toBe(true);
  });

  it('does NOT match unrelated provider errors', () => {
    expect(isWhatsAppWindowError('Invalid recipient phone number')).toBe(false);
    expect(isWhatsAppWindowError('Monthly WhatsApp limit reached (50)')).toBe(false);
    expect(isWhatsAppWindowError('template name does not exist')).toBe(false); // not a "required" phrasing
    expect(isWhatsAppWindowError(null)).toBe(false);
    expect(isWhatsAppWindowError(undefined)).toBe(false);
    expect(isWhatsAppWindowError('')).toBe(false);
  });

  it('client and server classifiers agree on the contract', () => {
    const samples = [
      'Re-engagement message (code 131047)',
      'more than 24 hours have passed since the customer last replied',
      'Invalid phone',
      '',
    ];
    for (const s of samples) {
      expect(isWhatsAppWindowError(s)).toBe(isWindowServer(s));
    }
  });

  it('explainWhatsAppError appends actionable guidance for window errors', () => {
    const explained = explainWhatsAppError('Re-engagement message (code 131047)');
    expect(explained).toContain('Re-engagement message');
    expect(explained).toContain('24 hours');
    expect(explained.length).toBeGreaterThan('Re-engagement message (code 131047)'.length);
  });

  it('explainWhatsAppError passes unrelated errors through unchanged', () => {
    expect(explainWhatsAppError('Invalid phone')).toBe('Invalid phone');
  });
});

describe('sendWhatsAppWithTemplateFallback — ONE call; the server owns the retry', () => {
  const recipient = { tenantName: 'Ada', amount: 150000, address: '12 Marina' };

  it('makes exactly one call passing fallback (messageType + recipient data) — success passthrough', async () => {
    const calls: any[] = [];
    const result = await sendWhatsAppWithTemplateFallback(
      async (args) => { calls.push(args); return { success: true, messageId: 'wamid.1' }; },
      { messageType: 'rent_reminder', recipient }
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].fallback?.messageType).toBe('rent_reminder');
    expect(calls[0].fallback?.templateVarsData).toEqual(recipient);
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('wamid.1');
  });

  it('passes ONE call even when the free-form send fails — the server retries with the mapped template', async () => {
    const calls: any[] = [];
    const result = await sendWhatsAppWithTemplateFallback(
      async (args) => {
        calls.push(args);
        // The server did the free-form attempt, hit 131047, retried with the
        // firm mapping, and the template went through — all inside one call.
        return { success: true, messageId: 'wamid.2', usedTemplate: true };
      },
      { messageType: 'rent_reminder', recipient }
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].fallback?.messageType).toBe('rent_reminder');
    expect(result.success).toBe(true);
    expect(result.usedTemplate).toBe(true);
  });

  it('propagates the provider failure verbatim when both free-form and template retry fail', async () => {
    const result = await sendWhatsAppWithTemplateFallback(
      async () => ({
        success: false,
        usedTemplate: true,
        error: 'template payment_reminder_v2 does not exist (free-form was rejected: Re-engagement message)',
      }),
      { messageType: 'late_notice', recipient }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
    expect(result.error).toContain('Re-engagement');
  });

  it('still sends ONE call for message types with no mapping configured — the server simply has no fallback', async () => {
    const calls: any[] = [];
    const result = await sendWhatsAppWithTemplateFallback(
      async (args) => { calls.push(args); return { success: false, error: 'Re-engagement message (code 131047)' }; },
      { messageType: 'promotion', recipient }
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].fallback?.messageType).toBe('promotion');
    expect(result.success).toBe(false);
  });
});

describe('buildEmailHtml — the branded email shell', () => {
  it('carries the firm name as the visible identity', () => {
    const html = buildEmailHtml({ firmName: 'Grand Starfish Estates', body: 'Rent is due.' });
    expect(html).toContain('Grand Starfish Estates');
    expect(html).not.toContain('PracticePro Systems');
    expect(html).toContain('Sent via PracticePro on behalf of Grand Starfish Estates');
  });

  it('converts plain-text bodies with newlines preserved', () => {
    const html = buildEmailHtml({ firmName: 'F', body: 'Line one\nLine two' });
    expect(html).toContain('Line one');
    expect(html).toContain('Line two');
    expect(html).toContain('white-space:pre-wrap');
  });

  it('escapes HTML in plain-text bodies', () => {
    const html = buildEmailHtml({ firmName: 'F', body: '<script>alert(1)</script>' });
    // starts with '<' → treated as HTML... so test a mixed body instead
    const html2 = buildEmailHtml({ firmName: 'F', body: 'price < 5 & more' });
    expect(html2).toContain('&lt; 5 &amp; more');
    expect(html2).not.toContain('price < 5');
  });

  it('passes existing HTML bodies through unwrapped', () => {
    const html = buildEmailHtml({ firmName: 'F', body: '<p>Already html</p>' });
    expect(html).toContain('<p>Already html</p>');
  });

  it('includes the footer note when provided', () => {
    const html = buildEmailHtml({ firmName: 'F', body: 'b', footerNote: 'Official notice' });
    expect(html).toContain('Official notice');
  });
});

describe('resolveFinancials — per-recipient financial auto-fill', () => {
  const resident = {
    tenantName: 'Ada',
    amount: 150000,
    serviceCharge: 25000,
    legalFee: 5000,
    agencyFee: 7500,
    cautionDeposit: 50000,
  };

  it('falls back to the resident\'s own figures when nothing is typed', () => {
    const fin = resolveFinancials({}, resident);
    expect(fin).toEqual({
      amount: 150000,
      serviceCharge: 25000,
      legalFee: 5000,
      agencyFee: 7500,
      cautionDeposit: 50000,
    });
  });

  it('a typed override wins over the resident record', () => {
    const fin = resolveFinancials({ serviceCharge: 9999 }, resident);
    expect(fin.serviceCharge).toBe(9999);
    expect(fin.amount).toBe(150000); // untouched field still falls back
  });

  it('empty-string manual inputs parse to null and fall back (parseMoneyInput)', () => {
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput(undefined)).toBeNull();
    expect(parseMoneyInput('150,000')).toBe(150000);
    expect(parseMoneyInput('150000.50')).toBe(150000.5);
    expect(parseMoneyInput('abc')).toBeNull();
    const fin = resolveFinancials(
      { amount: parseMoneyInput(''), serviceCharge: parseMoneyInput('25,000') },
      resident
    );
    expect(fin.amount).toBe(150000);
    expect(fin.serviceCharge).toBe(25000);
  });

  it('missing everything resolves to zeros (template omits the lines)', () => {
    const fin = resolveFinancials({}, {});
    expect(fin.amount).toBe(0);
    expect(fin.serviceCharge).toBe(0);
  });

  it('hasAutoFilledFigures detects when record data is in play', () => {
    expect(hasAutoFilledFigures({}, resident)).toBe(true);
    expect(hasAutoFilledFigures({}, {})).toBe(false);
    expect(hasAutoFilledFigures({ serviceCharge: 9999 }, resident)).toBe(true); // other fields still auto
  });
});

describe('resolveFinancials — EXISTING residents owe rent only (move-in fees settled)', () => {
  const existingResident = {
    tenantName: 'Mr. Chigozie Ubah',
    amount: 1400000,
    serviceCharge: 0,
    legalFee: 140000,
    agencyFee: 140000,
    cautionDeposit: 200000,
    isExistingTenant: true, // tenancy commenced — fees settled at move-in
  };

  it('an existing resident resolves move-in fees to 0 — the reported bug (caution + legal/agency in a rent reminder)', () => {
    const fin = resolveFinancials({}, existingResident);
    expect(fin).toEqual({
      amount: 1400000,      // rent unchanged
      serviceCharge: 0,     // recurring charge unchanged
      legalFee: 0,          // move-in fee — settled
      agencyFee: 0,         // move-in fee — settled
      cautionDeposit: 0,    // move-in fee — settled
    });
  });

  it('a manually typed move-in fee still wins for an existing resident (deliberate recovery demand)', () => {
    const fin = resolveFinancials({ cautionDeposit: 200000 }, existingResident);
    expect(fin.cautionDeposit).toBe(200000);
    expect(fin.legalFee).toBe(0);
    expect(fin.agencyFee).toBe(0);
    expect(fin.amount).toBe(1400000);
  });

  it('a NEW resident (isExistingTenant falsy) keeps the full move-in breakdown', () => {
    const fin = resolveFinancials({}, { ...existingResident, isExistingTenant: false });
    expect(fin).toEqual({
      amount: 1400000,
      serviceCharge: 0,
      legalFee: 140000,
      agencyFee: 140000,
      cautionDeposit: 200000,
    });
    // Absent flag (older callers / non-tenant recipients) behaves as NEW — legacy behavior
    const legacy = resolveFinancials({}, { ...existingResident, isExistingTenant: undefined });
    expect(legacy.cautionDeposit).toBe(200000);
  });

  it('rent and service charge resolution is unaffected by tenant status', () => {
    const withSC = { ...existingResident, serviceCharge: 40000 };
    expect(resolveFinancials({}, withSC).serviceCharge).toBe(40000);
    expect(resolveFinancials({}, withSC).amount).toBe(1400000);
    expect(resolveFinancials({ amount: 999999 }, withSC).amount).toBe(999999);
  });
});

describe('summarizeError — toast-length error truncation', () => {
  it('keeps short errors intact', () => {
    expect(summarizeError('Invalid phone')).toBe('Invalid phone');
  });
  it('collapses whitespace and truncates long provider payloads', () => {
    const long = 'x'.repeat(300);
    const out = summarizeError(long, 100);
    expect(out.length).toBe(101); // 100 chars + ellipsis
    expect(out.endsWith('…')).toBe(true);
    expect(summarizeError(null)).toBe('Unknown error');
    expect(summarizeError(undefined)).toBe('Unknown error');
  });
});

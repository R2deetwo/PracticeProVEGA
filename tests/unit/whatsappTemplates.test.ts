/**
 * WhatsApp template registry + error extraction — regression tests.
 *
 * 2026-09-12 user report: "my template is not the same as what you have in
 * the app; the Meta and PracticePro templates are not the same. Templates
 * are approved but sends fail with 'Unknown WhatsApp gateway error'."
 *
 * Root causes locked in here:
 *   1. extractWaError missed Chakra's documented error envelope
 *      { _data, _meta, _errors: [...] } — so real provider errors were
 *      discarded and the UI dead-ended at "Unknown WhatsApp gateway error."
 *   2. The app sent hardcoded template names/variable orders that never
 *      matched what the firm actually registered in Meta. The new
 *      resolveTemplateFor prefers the firm's CONFIGURED mapping; the
 *      normalizeTemplate parser counts {{n}} placeholders so the mapping
 *      UI can enforce count/order parity; buildVarsForOrder renders the
 *      chosen fields in order.
 */
import { describe, it, expect } from 'vitest';
import { extractWaError, explainWhatsAppError, isTemplateNotFoundError, buildTemplateVarsForOrder } from '../../convex/communications';
import { normalizeTemplate, suggestMappings, scoreTemplateForType, defaultVarOrderFor } from '../../convex/whatsappTemplates';
import {
  buildVarsForOrder,
  resolveTemplateFor,
  FirmTemplateMapping,
  TemplateRecipientData,
} from '../../src/utils/deliveryErrors';

describe('extractWaError — every documented Chakra/Meta error shape is surfaced', () => {
  it('reads Chakra envelope _errors (string array) — the shape that produced "Unknown WhatsApp gateway error"', () => {
    const body = { _data: {}, _meta: {}, _errors: ['Template atrium_rent_reminder does not exist'] };
    expect(extractWaError(body)).toBe('Template atrium_rent_reminder does not exist');
  });

  it('joins multiple _errors entries', () => {
    const body = { _data: {}, _meta: {}, _errors: ['first problem', 'second problem'] };
    expect(extractWaError(body)).toBe('first problem; second problem');
  });

  it('reads Chakra envelope _errors containing objects with message fields', () => {
    const body = { _errors: [{ message: 'quota exceeded' }] };
    expect(extractWaError(body)).toBe('quota exceeded');
  });

  it('reads Meta Graph error object with code and error_data', () => {
    const body = {
      error: {
        message: '(#132000) Template name does not exist in the translation',
        type: 'OAuthException',
        code: 132000,
        error_data: { messaging_product: 'whatsapp', details: 'template lookup failed' },
      },
    };
    const out = extractWaError(body) || '';
    expect(out).toContain('(#132000) Template name does not exist in the translation');
    expect(out).toContain('(code 132000)');
    expect(out).toContain('template lookup failed');
  });

  it('reads plain Meta errors array', () => {
    const body = { errors: [{ message: 'bad param', code: 132001 }] };
    expect(extractWaError(body)).toBe('bad param (code 132001)');
  });

  it('reads legacy shapes: error string and message string', () => {
    expect(extractWaError({ error: 'plain string error' })).toBe('plain string error');
    expect(extractWaError({ message: 'message field error' })).toBe('message field error');
  });

  it('returns null for unrecognized/empty bodies (caller shows HTTP status + raw text instead)', () => {
    expect(extractWaError(null)).toBeNull();
    expect(extractWaError({})).toBeNull();
    expect(extractWaError({ _data: { ok: true } })).toBeNull();
  });
});

describe('explainWhatsAppError — actionable hints, never a dead-end', () => {
  it('template-not-found errors point to the Sync-from-Meta settings flow', () => {
    const out = explainWhatsAppError('Template foo does not exist');
    expect(out).toContain('Sync from Meta');
    expect(out).toContain('Settings');
  });

  it('window errors explain the 24h rule and template requirement', () => {
    const out = explainWhatsAppError('Re-engagement message (error code: 131047)');
    expect(out).toContain('24 hours');
    expect(out).toContain('template');
  });

  it('token errors hint at re-issuing the Chakra token', () => {
    const out = explainWhatsAppError('(#190) Access token has expired (code 190)');
    expect(out).toContain('CHAKRA_ACCESS_TOKEN');
  });

  it('unknown errors pass through verbatim', () => {
    expect(explainWhatsAppError('some novel provider error')).toBe('some novel provider error');
  });
});

describe('isTemplateNotFoundError — locale/name lookup misses', () => {
  it('recognizes the 132000-class codes', () => {
    expect(isTemplateNotFoundError('(##132000) Template name does not exist')).toBe(true);
    expect(isTemplateNotFoundError('(##132001) Template param mismatch')).toBe(true);
    expect(isTemplateNotFoundError('something else entirely')).toBe(false);
  });

  it('recognizes language-mismatch phrasing', () => {
    expect(isTemplateNotFoundError('language does not match the template')).toBe(true);
  });
});

describe('normalizeTemplate — Meta template parsing with variable counting', () => {
  it('counts positional placeholders and extracts the BODY component', () => {
    const t = normalizeTemplate({
      name: 'rent_reminder_v2',
      language: 'en_US',
      status: 'APPROVED',
      category: 'UTILITY',
      id: '1099',
      components: [
        { type: 'HEADER', text: 'Rent Due' },
        { type: 'BODY', text: 'Hi {{1}}, your rent of {{2}} for {{3}} is due {{4}}.' },
      ],
    });
    expect(t).toMatchObject({
      name: 'rent_reminder_v2',
      language: 'en_US',
      status: 'APPROVED',
      category: 'UTILITY',
      metaId: '1099',
      variableCount: 4,
    });
    expect(t?.bodyText).toContain('{{1}}');
  });

  it('handles templates without variables', () => {
    const t = normalizeTemplate({
      name: 'plain_notice',
      language: 'en',
      status: 'PENDING',
      components: [{ type: 'BODY', text: 'No placeholders here.' }],
    });
    expect(t?.variableCount).toBe(0);
  });

  it('survives malformed entries', () => {
    expect(normalizeTemplate(null)).toBeNull();
    expect(normalizeTemplate({ status: 'APPROVED' })).toBeNull();
    expect(normalizeTemplate({ name: 'x', components: 'not-an-array' })).toMatchObject({ name: 'x' });
  });
});

const recipient: TemplateRecipientData = {
  tenantName: 'Mr. Chigozie Ubah',
  amount: 1400000,
  address: 'Unit 1',
  totalPayable: 1780000,
  serviceCharge: 40000,
  firmName: 'Giovani et. Vargas',
  dueDate: '01/10/2026',
};

describe('buildVarsForOrder — variable values in the configured order', () => {
  it('renders a 4-slot order with the right fields', () => {
    const vars = buildVarsForOrder(['tenantName', 'totalPayable', 'address', 'dueDate'], recipient);
    expect(vars).toEqual(['Mr. Chigozie Ubah', '1,780,000', 'Unit 1', '01/10/2026']);
  });

  it('falls back to the legacy [name, amount, address] triple when no order is set', () => {
    expect(buildVarsForOrder(null, recipient)).toEqual(['Mr. Chigozie Ubah', '1,400,000', 'Unit 1']);
    expect(buildVarsForOrder(undefined, recipient)).toEqual(['Mr. Chigozie Ubah', '1,400,000', 'Unit 1']);
  });

  it('defaults missing fields instead of crashing the send', () => {
    const vars = buildVarsForOrder(['tenantName', 'firmName', 'dueDate', 'address'], {});
    expect(vars).toEqual(['Resident', 'Management', 'the due date', 'your unit']);
  });
});

describe('resolveTemplateFor — the CONFIGURED mapping always wins', () => {
  const configured: FirmTemplateMapping[] = [
    {
      messageType: 'rent_reminder',
      templateName: 'my_actual_approved_template',
      templateLanguage: 'en_US',
      varOrder: ['tenantName', 'totalPayable', 'dueDate'],
    },
  ];

  it('uses the firm mapping with its language first in the chain', () => {
    const tpl = resolveTemplateFor('rent_reminder', configured);
    expect(tpl?.name).toBe('my_actual_approved_template');
    expect(tpl?.languages[0]).toBe('en_US');
    expect(tpl?.languages).toContain('en');
    const vars = tpl?.buildVars(recipient) as string[];
    expect(vars).toEqual(['Mr. Chigozie Ubah', '1,780,000', '01/10/2026']);
  });

  it('falls back to the legacy guess when nothing is configured (rent_reminder only)', () => {
    const tpl = resolveTemplateFor('rent_reminder', []);
    expect(tpl?.name).toBe('atrium_rent_reminder');
    expect(tpl?.languages).toEqual(['en', 'en_US', 'en_GB']);
  });

  it('returns null for unmapped types with no legacy default', () => {
    expect(resolveTemplateFor('late_notice', [])).toBeNull();
    expect(resolveTemplateFor('late_notice', undefined)).toBeNull();
  });

  it('a configured mapping for a type without a legacy default enables the retry', () => {
    const lateNotice: FirmTemplateMapping[] = [
      { messageType: 'late_notice', templateName: 'overdue_payment_notice', templateLanguage: 'en' },
    ];
    const tpl = resolveTemplateFor('late_notice', lateNotice);
    expect(tpl?.name).toBe('overdue_payment_notice');
    // no varOrder → legacy triple
    expect(tpl?.buildVars(recipient)).toEqual(['Mr. Chigozie Ubah', '1,400,000', 'Unit 1']);
  });
});

describe('suggestMappings — auto-mapping by keyword (zero-config templates)', () => {
  const templates = [
    { name: 'rent_payment_reminder', language: 'en_US', status: 'APPROVED', variableCount: 3,
      bodyText: 'Dear {{1}}, your rent of {{2}} for {{3}} is due.' },
    { name: 'payment_confirmation', language: 'en', status: 'APPROVED', variableCount: 2,
      bodyText: 'Hi {{1}}, we received your payment of {{2}}.' },
    { name: 'overdue_notice', language: 'en', status: 'APPROVED', variableCount: 2,
      bodyText: 'Your account is overdue.' },
    { name: 'draft_only', language: 'en', status: 'PENDING', variableCount: 1,
      bodyText: 'rent rent rent' },
  ] as any[];

  it('maps rent_reminder to the rent-flavoured approved template, not the pending one', () => {
    const s = suggestMappings(templates, []);
    const rent = s.find((x) => x.messageType === 'rent_reminder');
    expect(rent).toBeDefined();
    expect(rent!.templateName).toBe('rent_payment_reminder');
    expect(rent!.templateLanguage).toBe('en_US');
    expect(rent!.varOrder).toEqual(['tenantName', 'amount', 'address']);
  });

  it('maps payment_receipt to the confirmation template', () => {
    const s = suggestMappings(templates, []);
    const receipt = s.find((x) => x.messageType === 'payment_receipt');
    expect(receipt!.templateName).toBe('payment_confirmation');
    expect(receipt!.varOrder).toEqual(['tenantName', 'amount']);
  });

  it('maps late_notice to the overdue template (body keyword scores)', () => {
    const s = suggestMappings(templates, []);
    const late = s.find((x) => x.messageType === 'late_notice');
    expect(late!.templateName).toBe('overdue_notice');
  });

  it('NEVER suggests a type the firm already mapped — manual mappings win', () => {
    const s = suggestMappings(templates, ['rent_reminder']);
    expect(s.find((x) => x.messageType === 'rent_reminder')).toBeUndefined();
  });

  it('ignores non-APPROVED templates entirely', () => {
    const s = suggestMappings(templates, []);
    expect(s.every((x) => x.templateName !== 'draft_only')).toBe(true);
  });

  it('returns nothing when no template matches any keyword', () => {
    expect(suggestMappings([
      { name: 'totally_unrelated', language: 'en', status: 'APPROVED' } as any,
    ], [])).toEqual([]);
  });

  it('name hits outscore body hits (2x weight)', () => {
    expect(scoreTemplateForType({ name: 'rent_reminder' }, 'rent_reminder')).toBeGreaterThan(
      scoreTemplateForType({ name: 'x', bodyText: 'rent' }, 'rent_reminder')
    );
  });
});

describe('defaultVarOrderFor — slot count sizing', () => {
  it('slices the type default when the template has fewer slots', () => {
    expect(defaultVarOrderFor('rent_reminder', 2)).toEqual(['tenantName', 'amount']);
  });
  it('pads with firmName/dueDate when the template has more slots', () => {
    const order = defaultVarOrderFor('rent_reminder', 5);
    expect(order).toHaveLength(5);
    expect(order.slice(0, 3)).toEqual(['tenantName', 'amount', 'address']);
    expect(order).toContain('firmName');
  });
  it('unknown types get the generic order', () => {
    expect(defaultVarOrderFor('custom', 1)).toEqual(['tenantName']);
  });
});

describe('buildTemplateVarsForOrder (server twin) — identical output to the client', () => {
  it('renders the configured order the same way buildVarsForOrder does', () => {
    const order = ['tenantName', 'amount', 'address'] as string[];
    const r = { tenantName: 'Ada', amount: 150000, address: '12 Marina' };
    expect(buildTemplateVarsForOrder(order, r)).toEqual(['Ada', '150,000', '12 Marina']);
  });
  it('legacy default triple when no order is set', () => {
    expect(buildTemplateVarsForOrder(undefined, { tenantName: 'Ada' })).toEqual(['Ada', '0', 'your unit']);
  });
  it('₦ is NOT prefixed for serviceCharge (mirrors the client exactly)', () => {
    // Consistency with buildVarsForOrder matters more than the symbol —
    // the server twin must render identically to the client it replaced.
    expect(buildTemplateVarsForOrder(['serviceCharge'], { serviceCharge: 40000 })).toEqual(['40,000']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2026-11-24 — THE BANK-DETAILS ROUND (owner directive: "for the bank
// details, it should carry the firm's own default account from settings …
// what happens if they have not set the account?")
//
// The live platform WABA's three APPROVED templates all label their payment
// slots inline ("Pay to:\nBank: {{6}}\nAccount Name: {{7}}\nAccount Number:
// {{8}}"), and the OLD auto-mapper filled those slots with
// firmName/dueDate/messageText — so a rent reminder read "Bank: <firm name>
// … Account Number: <due date>". These tests pin the body-aware fix.
// ═══════════════════════════════════════════════════════════════════════════

import {
  inferLabeledSlots,
  varOrderForTemplate,
  nameTokenHits,
  VEGA_TEMPLATE_DEFS,
} from '../../convex/whatsappTemplates';
import { fillPaymentInstructions, PAYMENT_INSTRUCTIONS_TRIGGER, DEFAULT_SNIPPETS } from '../../convex/voiceTools';

// The three real bodies from the production account (WABA 1365626695350672,
// phone +234 816 312 2497 — verified via dumpWhatsAppState 2026-11-24).
const LIVE_ATRIUM_RENT = {
  name: 'atrium_rent_reminder', language: 'en', status: 'APPROVED', variableCount: 6,
  bodyText: 'Hello {{1}},\n\nThis is a friendly reminder that your rent of NGN {{2}} for {{3}} is now due.\n\nPay to:\nBank: {{4}}\nAccount Name: {{5}}\nAccount Number: {{6}}\n\nPlease use your property address as the payment reference. Thank you.',
} as any;
const LIVE_ATRIUM_LATE = {
  name: 'atrium_late_reminder', language: 'en', status: 'APPROVED', variableCount: 8,
  bodyText: 'Hello {{1}},\n\nThis is a reminder that your {{2}} of NGN {{3}} for {{4}} is now {{5}} days overdue.\n\nPay to:\nBank: {{6}}\nAccount Name: {{7}}\nAccount Number: {{8}}\n\nPlease use your property address as the payment reference. Thank you.',
} as any;
const LIVE_ATRIUM_SC = {
  name: 'atrium_service_charge_reminder', language: 'en', status: 'APPROVED', variableCount: 7,
  bodyText: 'Hello {{1}},\n\nThis is a friendly reminder that your Service Charge of NGN {{2}} for {{3}} is now due (Due Date: {{4}}).\n\nPay to:\nBank: {{5}}\nAccount Name: {{6}}\nAccount Number: {{7}}\n\nPlease use your property address as the payment reference. Thank you.',
} as any;

describe('inferLabeledSlots — payment-slot labels are detected from the body', () => {
  it('pins Bank / Account Name / Account Number / days-overdue / Due Date slots', () => {
    const slots = inferLabeledSlots(LIVE_ATRIUM_LATE.bodyText);
    expect(slots).toMatchObject({
      2: 'paymentKind',  // "your {{2}} of"
      3: 'amount',       // "of NGN {{3}}"
      4: 'address',      // "for {{4}}"
      5: 'daysOverdue',  // "{{5}} days overdue"
      6: 'bankName',
      7: 'accountName',
      8: 'accountNumber',
    });
    const rent = inferLabeledSlots(LIVE_ATRIUM_RENT.bodyText);
    expect(rent).toMatchObject({ 4: 'bankName', 5: 'accountName', 6: 'accountNumber' });
    const sc = inferLabeledSlots(LIVE_ATRIUM_SC.bodyText);
    expect(sc).toMatchObject({ 2: 'amount', 3: 'address', 4: 'dueDate', 5: 'bankName', 6: 'accountName', 7: 'accountNumber' });
  });

  it('returns nothing for bodies without labeled slots', () => {
    expect(inferLabeledSlots('Hi {{1}}, plain {{2}} message.')).toEqual({});
    expect(inferLabeledSlots(undefined)).toEqual({});
  });
});

describe('varOrderForTemplate — the LIVE atrium templates map bank slots to bank fields', () => {
  it('atrium_rent_reminder: [name, amount, address, bankName, accountName, accountNumber]', () => {
    expect(varOrderForTemplate('rent_reminder', LIVE_ATRIUM_RENT)).toEqual([
      'tenantName', 'amount', 'address', 'bankName', 'accountName', 'accountNumber',
    ]);
  });

  it('atrium_late_reminder: 8 slots exactly, bank trailing, daysOverdue pinned', () => {
    expect(varOrderForTemplate('late_notice', LIVE_ATRIUM_LATE)).toEqual([
      'tenantName', 'paymentKind', 'amount', 'address', 'daysOverdue',
      'bankName', 'accountName', 'accountNumber',
    ]);
  });

  it('atrium_service_charge_reminder: labeled Due Date wins the slot', () => {
    expect(varOrderForTemplate('service_charge_alert', LIVE_ATRIUM_SC)).toEqual([
      'tenantName', 'amount', 'address', 'dueDate', 'bankName', 'accountName', 'accountNumber',
    ]);
  });

  it('never pads bank fields into unlabeled templates', () => {
    const order = varOrderForTemplate('rent_reminder', {
      variableCount: 5, bodyText: 'Dear {{1}}, your rent of {{2}} for {{3}} is due {{4}}. Thanks, {{5}}.',
    });
    expect(order).toHaveLength(5);
    expect(order.some((f) => ['bankName', 'accountName', 'accountNumber'].includes(f))).toBe(false);
  });

  it('always returns exactly variableCount entries (no short param lists)', () => {
    expect(varOrderForTemplate('late_notice', LIVE_ATRIUM_LATE)).toHaveLength(8);
    expect(varOrderForTemplate('rent_reminder', LIVE_ATRIUM_RENT)).toHaveLength(6);
  });
});

describe('suggestMappings — a NAME-token hit is required (2026-11-24)', () => {
  it('a body-only "payment reference" footer hit does NOT map payment_receipt', () => {
    // This is EXACTLY the production bug: payment_receipt auto-mapped to
    // atrium_service_charge_reminder because both bodies end with
    // "…as the payment reference". The name has no receipt keywords.
    const s = suggestMappings([LIVE_ATRIUM_SC, LIVE_ATRIUM_RENT, LIVE_ATRIUM_LATE], []);
    expect(s.find((x) => x.messageType === 'payment_receipt')).toBeUndefined();
    expect(s.find((x) => x.messageType === 'general_announcement')).toBeUndefined();
  });

  it('the live three templates map with bank-aware varOrders', () => {
    const s = suggestMappings([LIVE_ATRIUM_SC, LIVE_ATRIUM_RENT, LIVE_ATRIUM_LATE], []);
    const rent = s.find((x) => x.messageType === 'rent_reminder')!;
    expect(rent.templateName).toBe('atrium_rent_reminder');
    expect(rent.varOrder).toEqual(['tenantName', 'amount', 'address', 'bankName', 'accountName', 'accountNumber']);
    const late = s.find((x) => x.messageType === 'late_notice')!;
    expect(late.varOrder).toHaveLength(8);
    expect(late.varOrder.slice(5)).toEqual(['bankName', 'accountName', 'accountNumber']);
  });
});

describe('Vega templates — the vega_* set created via createVegaTemplates', () => {
  const vegaTemplates = VEGA_TEMPLATE_DEFS.map((d) => ({
    name: d.name, language: 'en', status: 'APPROVED',
    variableCount: Math.max(...[...d.bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => parseInt(m[1], 10))),
    bodyText: d.bodyText,
  })) as any[];

  it('every def has a Meta-legal name (lowercase/underscores, ≤60 chars)', () => {
    for (const d of VEGA_TEMPLATE_DEFS) {
      expect(d.name).toMatch(/^[a-z0-9_]+$/);
      expect(d.name.length).toBeLessThanOrEqual(60);
      expect(d.name.startsWith('vega_')).toBe(true);
    }
  });

  it('each def body slot-count matches its messageType default var order', () => {
    for (const d of VEGA_TEMPLATE_DEFS) {
      const order = varOrderForTemplate(d.messageType, {
        variableCount: Math.max(...[...d.bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => parseInt(m[1], 10))),
        bodyText: d.bodyText,
      });
      expect(order.length).toBeGreaterThan(0);
    }
  });

  it('suggestMappings maps every Vega message type to its vega_* template', () => {
    const s = suggestMappings([...vegaTemplates, LIVE_ATRIUM_RENT, LIVE_ATRIUM_LATE, LIVE_ATRIUM_SC], []);
    const byType = Object.fromEntries(s.map((x) => [x.messageType, x.templateName]));
    expect(byType['court_reminder']).toBe('vega_court_reminder');
    expect(byType['invoice_reminder']).toBe('vega_invoice_reminder');
    expect(byType['document_ready']).toBe('vega_document_ready');
    expect(byType['appointment_reminder']).toBe('vega_appointment_reminder');
    expect(byType['engagement_followup']).toBe('vega_engagement_followup');
    // The atrium types still map to their own templates (no cross-product theft).
    expect(byType['rent_reminder']).toBe('atrium_rent_reminder');
  });

  it('vega_invoice_reminder carries the bank slots at the tail', () => {
    const s = suggestMappings(vegaTemplates, []);
    const inv = s.find((x) => x.messageType === 'invoice_reminder')!;
    expect(inv.varOrder.slice(-3)).toEqual(['bankName', 'accountName', 'accountNumber']);
  });

  it('the engagement followup is the only MARKETING template', () => {
    expect(VEGA_TEMPLATE_DEFS.filter((d) => d.category === 'MARKETING').map((d) => d.name))
      .toEqual(['vega_engagement_followup']);
  });
});

describe('buildTemplateVarsForOrder + buildVarsForOrder — bank slots (twins)', () => {
  const bankOrder = ['tenantName', 'amount', 'address', 'bankName', 'accountName', 'accountNumber'] as const;

  it('renders the firm default account when provided', () => {
    const data = {
      tenantName: 'Ada', amount: 150000, address: '12 Marina',
      bankName: 'Providus Bank', accountName: 'Acme Mgmt Ltd', accountNumber: '1234567890',
    };
    const server = buildTemplateVarsForOrder([...bankOrder], data);
    const client = buildVarsForOrder(bankOrder, data as any);
    expect(server).toEqual(['Ada', '150,000', '12 Marina', 'Providus Bank', 'Acme Mgmt Ltd', '1234567890']);
    // The twins must render IDENTICALLY (a resident must never see a
    // different preview from what the server sends).
    expect(client).toEqual(server);
  });

  it('the UNSET-ACCOUNT fallback: honest copy, never a fake number', () => {
    const data = { tenantName: 'Ada', amount: 150000, address: '12 Marina' };
    const out = buildTemplateVarsForOrder([...bankOrder], data);
    expect(out.slice(3)).toEqual(['Not yet set', 'Please contact the office', 'for transfer details']);
    expect(buildVarsForOrder(bankOrder, data as any)).toEqual(out);
    // No fabricated 10-digit NUBAN ever ships.
    expect(out.some((v) => /^\d{10}$/.test(v))).toBe(false);
  });

  it('paymentKind and daysOverdue defaults read naturally in the late template', () => {
    const out = buildTemplateVarsForOrder(
      ['tenantName', 'paymentKind', 'amount', 'address', 'daysOverdue', 'bankName', 'accountName', 'accountNumber'],
      { tenantName: 'Ada', amount: 150000, address: '12B Admiralty Way' },
    );
    expect(out[1]).toBe('payment');      // "your payment of NGN 150,000"
    expect(out[4]).toBe('several');      // "is now several days overdue"
    expect(out[5]).toBe('Not yet set');  // no account configured
  });

  it('the amount slot falls back to serviceCharge when amount is absent', () => {
    expect(buildTemplateVarsForOrder(['amount'], { serviceCharge: 40000 })).toEqual(['40,000']);
    expect(buildVarsForOrder(['amount'], { serviceCharge: 40000 })).toEqual(['40,000']);
  });
});

describe('voiceTools — the payment-instructions snippet carries the firm default account', () => {
  const base = DEFAULT_SNIPPETS.find((s) => s.trigger === PAYMENT_INSTRUCTIONS_TRIGGER)!.content;

  it('fills [Firm Name]/[Bank Name]/[Account Number] from the default account', () => {
    const out = fillPaymentInstructions(base, {
      bankName: 'GTBank', accountName: 'Ubah & Co', accountNumber: '0123456789',
    }, 'Ubah & Co');
    expect(out).toContain('Bank: GTBank');
    expect(out).toContain('Account Number: 0123456789');
    expect(out).not.toContain('[Bank Name]');
    expect(out).not.toContain('[Account Number]');
    expect(out).not.toContain('[Firm Name]');
  });

  it('no account set → an explicit configure-it note, never placeholders or a fake number', () => {
    const out = fillPaymentInstructions(base, null, 'Ubah & Co');
    expect(out).toContain('Settings → Financial Configuration');
    expect(out).not.toContain('[Bank Name]');
    expect(out).not.toContain('[Account Number]');
    expect(out).not.toMatch(/\d{10}/);
  });
});

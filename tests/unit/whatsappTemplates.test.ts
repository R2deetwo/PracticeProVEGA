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

/**
 * WhatsApp error classes — regression tests (Task 39 / Item 1).
 *
 * The Task 37 live test proved the root cause of every failed template
 * send: Chakra returns HTTP 402 with
 *   "Template Message sending is disabled. You need to upgrade to a paid
 *    plan. Upgrade link - https://app.chakrahq.com/admin/billing/..."
 * These tests lock in the classification of that billing gate (and every
 * other status-based class) so:
 *   - failed message records store a machine-readable errorClass
 *   - the UI shows the MAPPED reason, never the raw string by default
 *   - the 402 gate drives the persistent admin banner + disabled send
 */
import { describe, it, expect } from 'vitest';
import {
  extractWaError,
  explainWhatsAppError,
  classifyWhatsAppError,
  WHATSAPP_ERROR_CLASS_MESSAGES,
  CHAKRA_WHATSAPP_BILLING_URL,
} from '../../convex/communications';
import {
  classifyWhatsAppErrorText,
  mappedErrorClass,
  WHATSAPP_ERROR_CLASS_MESSAGES as CLIENT_MESSAGES,
} from '../../src/utils/deliveryErrors';

// The EXACT body the Task 37 live test captured from production Chakra.
const CHAKRA_402_BODY = {
  _data: [],
  _errors: [
    'Template Message sending is disabled. You need to upgrade to a paid plan. Upgrade link - https://app.chakrahq.com/admin/billing/chakra-whatsapp-upgrade',
  ],
};

describe('classifyWhatsAppError — the Chakra 402 billing gate (THE root cause)', () => {
  it('402 + "Template Message sending is disabled" → plan_upgrade_required (status path)', () => {
    const text = extractWaError(CHAKRA_402_BODY);
    expect(text).toBeTruthy();
    expect(classifyWhatsAppError(text, 402)).toBe('plan_upgrade_required');
  });

  it('the exact captured 402 body classifies by TEXT alone (legacy records without status)', () => {
    // Log rows written before errorClass existed only store the error text.
    const text = extractWaError(CHAKRA_402_BODY) || '';
    expect(classifyWhatsAppError(text, undefined)).toBe('plan_upgrade_required');
    expect(classifyWhatsAppErrorText(text)).toBe('plan_upgrade_required');
  });

  it('402 with any other body → payment_issue', () => {
    expect(classifyWhatsAppError('Insufficient credits', 402)).toBe('payment_issue');
    expect(classifyWhatsAppError('something else entirely', 402)).toBe('payment_issue');
  });

  it('explainWhatsAppError maps the 402 billing gate to the admin message + billing link', () => {
    const text = extractWaError(CHAKRA_402_BODY) || '';
    const out = explainWhatsAppError(text, 402);
    expect(out).toContain('plan upgrade required');
    expect(out).toContain(CHAKRA_WHATSAPP_BILLING_URL);
  });
});

describe('classifyWhatsAppError — the other status-based classes', () => {
  it('401 → auth_failed', () => {
    expect(classifyWhatsAppError('no body', 401)).toBe('auth_failed');
  });

  it('403 → auth_failed', () => {
    expect(classifyWhatsAppError('forbidden', 403)).toBe('auth_failed');
  });

  it('429 → rate_limited (status and text)', () => {
    expect(classifyWhatsAppError('too many requests', 429)).toBe('rate_limited');
    expect(classifyWhatsAppError('You have exceeded the rate limit', undefined)).toBe('rate_limited');
  });

  it('5xx → service_unavailable', () => {
    expect(classifyWhatsAppError('Internal Server Error', 500)).toBe('service_unavailable');
    expect(classifyWhatsAppError('Bad Gateway', 502)).toBe('service_unavailable');
    expect(classifyWhatsAppError('Service Unavailable', 503)).toBe('service_unavailable');
  });

  it('httpStatus 0 (the fetch threw — network/DNS/timeout) → service_unavailable', () => {
    expect(classifyWhatsAppError('fetch failed', 0)).toBe('service_unavailable');
    expect(classifyWhatsAppError('ETIMEDOUT', 0)).toBe('service_unavailable');
  });

  it('network error text without a status → service_unavailable', () => {
    expect(classifyWhatsAppError('network request failed', undefined)).toBe('service_unavailable');
  });

  it('explainWhatsAppError carries the mapped admin message for each status class', () => {
    expect(explainWhatsAppError('no body', 401)).toContain('authentication failed');
    expect(explainWhatsAppError('too many requests', 429)).toContain('Rate limited');
    expect(explainWhatsAppError('Bad Gateway', 502)).toContain('temporarily unavailable');
    expect(explainWhatsAppError('whatever', 402)).toContain('payment issue');
  });
});

describe('classifyWhatsAppError — the original text classes still classify', () => {
  it('24h window (131047) → window', () => {
    expect(classifyWhatsAppError('Re-engagement message (error code: 131047)', 400)).toBe('window');
  });

  it('template name/language lookup miss (132000) → template_not_found', () => {
    expect(classifyWhatsAppError('(#132000) Template name does not exist in the translation', 400)).toBe('template_not_found');
  });

  it('param mismatch → param_mismatch', () => {
    expect(classifyWhatsAppError('Template param count mismatch', 400)).toBe('param_mismatch');
  });

  it('code 190 / access token → auth_failed', () => {
    expect(classifyWhatsAppError('(#190) Access token has expired (code 190)', 400)).toBe('auth_failed');
  });

  it('recipient number rejection → recipient_invalid', () => {
    expect(classifyWhatsAppError('(code 131026) recipient is not a valid WhatsApp user', 400)).toBe('recipient_invalid');
  });

  it('novel errors → unknown (never misclassified)', () => {
    expect(classifyWhatsAppError('some novel provider error', 400)).toBe('unknown');
    expect(classifyWhatsAppError('some novel provider error', undefined)).toBe('unknown');
  });
});

describe('explainWhatsAppError — backward compatibility (no httpStatus)', () => {
  it('window errors keep the 24h explanation', () => {
    const out = explainWhatsAppError('Re-engagement message (error code: 131047)');
    expect(out).toContain('24 hours');
    expect(out).toContain('template');
  });

  it('template-not-found errors keep the Sync-from-Meta guidance', () => {
    const out = explainWhatsAppError('Template foo does not exist');
    expect(out).toContain('Sync from Meta');
    expect(out).toContain('Settings');
  });

  it('token errors keep the CHAKRA_ACCESS_TOKEN hint', () => {
    expect(explainWhatsAppError('(#190) Access token has expired (code 190)')).toContain('CHAKRA_ACCESS_TOKEN');
  });

  it('unknown errors still pass through verbatim', () => {
    expect(explainWhatsAppError('some novel provider error')).toBe('some novel provider error');
  });
});

describe('WHATSAPP_ERROR_CLASS_MESSAGES — every class has a mapped reason', () => {
  it('covers all server classes', () => {
    const classes = [
      'plan_upgrade_required', 'payment_issue', 'auth_failed', 'rate_limited', 'service_unavailable',
      'window', 'template_not_found', 'param_mismatch', 'recipient_invalid',
      'quota_exceeded', 'not_configured', 'invalid_phone', 'unknown',
    ] as const;
    for (const cls of classes) {
      expect(WHATSAPP_ERROR_CLASS_MESSAGES[cls]).toBeTruthy();
      expect(WHATSAPP_ERROR_CLASS_MESSAGES[cls].length).toBeGreaterThan(10);
    }
  });

  it('server and client twins carry the SAME messages (they render in the UI together)', () => {
    for (const key of Object.keys(WHATSAPP_ERROR_CLASS_MESSAGES)) {
      expect(CLIENT_MESSAGES[key]).toBe(WHATSAPP_ERROR_CLASS_MESSAGES[key as keyof typeof WHATSAPP_ERROR_CLASS_MESSAGES]);
    }
  });

  it('the 402 admin message is the exact spec text', () => {
    expect(WHATSAPP_ERROR_CLASS_MESSAGES.plan_upgrade_required).toBe(
      'WhatsApp plan upgrade required — Chakra billing. Template messages blocked.'
    );
    expect(WHATSAPP_ERROR_CLASS_MESSAGES.payment_issue).toBe(
      'WhatsApp payment issue. Check Chakra + Meta Business billing.'
    );
    expect(WHATSAPP_ERROR_CLASS_MESSAGES.auth_failed).toBe('WhatsApp authentication failed. Check Chakra token.');
    expect(WHATSAPP_ERROR_CLASS_MESSAGES.rate_limited).toBe('Rate limited. Retry in a few minutes.');
    expect(WHATSAPP_ERROR_CLASS_MESSAGES.service_unavailable).toBe('WhatsApp service temporarily unavailable. Retrying…');
  });
});

describe('client twin — classifyWhatsAppErrorText + mappedErrorClass', () => {
  it('classifies the billing-gate text identically to the server', () => {
    const text = extractWaError(CHAKRA_402_BODY) || '';
    expect(classifyWhatsAppErrorText(text)).toBe('plan_upgrade_required');
  });

  it('classifies the other text-reachable classes', () => {
    expect(classifyWhatsAppErrorText('Re-engagement message (error code: 131047)')).toBe('window');
    expect(classifyWhatsAppErrorText('Template foo does not exist')).toBe('template_not_found');
    expect(classifyWhatsAppErrorText('(#190) Access token has expired (code 190)')).toBe('auth_failed');
    expect(classifyWhatsAppErrorText('network request failed')).toBe('service_unavailable');
    expect(classifyWhatsAppErrorText('')).toBe('unknown');
    expect(classifyWhatsAppErrorText(null)).toBe('unknown');
  });

  it('mappedErrorClass prefers the STORED class and falls back to text classification', () => {
    // New record: errorClass stored — no text parsing needed.
    expect(mappedErrorClass('plan_upgrade_required', 'anything')).toBe('plan_upgrade_required');
    // Legacy record: no errorClass — classify from the raw error text.
    expect(mappedErrorClass(undefined, extractWaError(CHAKRA_402_BODY) || '')).toBe('plan_upgrade_required');
    // Empty strings (the clear value) fall back to text, not to ''.
    expect(mappedErrorClass('', 'Re-engagement message (error code: 131047)')).toBe('window');
  });
});

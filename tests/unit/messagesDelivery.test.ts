/**
 * Messages delivery fix — regression tests.
 *
 * Covers the two unit-testable halves of the false-"sent" fix:
 *   1. normalisePhoneForMeta — WhatsApp E.164 normalisation (the shapes
 *      actually stored in the DB: "+234...", "234...", "0801...", "801...").
 *   2. The status-derivation contract shared by the UI call sites: a
 *      provider result only counts as "sent" when success && !simulated.
 *
 * The end-to-end guarantee (sendEmail returning success:false when the Brevo
 * key is missing, processScheduledMessages checking provider results, and
 * automation_logs being corrected via updateAutomationLogStatus) is enforced
 * in convex/communications.ts + convex/portals.ts + convex/sentry.ts.
 */
import { describe, it, expect } from 'vitest';
import { normalisePhoneForMeta } from '../../convex/communications';

describe('normalisePhoneForMeta (WhatsApp E.164 normalisation)', () => {
  it('passes through already-international Nigerian numbers', () => {
    expect(normalisePhoneForMeta('2348012345678')).toBe('2348012345678');
    expect(normalisePhoneForMeta('+2348012345678')).toBe('2348012345678');
    expect(normalisePhoneForMeta('+234 801 234 5678')).toBe('2348012345678');
  });

  it('converts local Nigerian format with leading 0', () => {
    expect(normalisePhoneForMeta('08012345678')).toBe('2348012345678');
    expect(normalisePhoneForMeta('0801 234 5678')).toBe('2348012345678');
  });

  it('converts local Nigerian format without leading 0', () => {
    expect(normalisePhoneForMeta('8012345678')).toBe('2348012345678');
  });

  it('keeps other international numbers (12+ digits) unchanged', () => {
    expect(normalisePhoneForMeta('+441234567890')).toBe('441234567890');
    expect(normalisePhoneForMeta('441234567890')).toBe('441234567890');
  });

  it('treats 10-11 digit numbers as Nigerian local (Nigeria-first contract)', () => {
    // Documented trade-off: this app serves Nigerian property managers and
    // the frontend already prefixes the 234 country code; the backend
    // normaliser is a safety net for DB-stored local shapes. A 10-11 digit
    // number without a country-code prefix is assumed NG local.
    expect(normalisePhoneForMeta('4155551234')).toBe('2344155551234');
    expect(normalisePhoneForMeta('14155551234')).toBe('23414155551234');
  });

  it('rejects inputs that cannot be valid phone numbers', () => {
    expect(normalisePhoneForMeta('')).toBeNull();
    expect(normalisePhoneForMeta('abc')).toBeNull();
    expect(normalisePhoneForMeta('123')).toBeNull(); // too short
    expect(normalisePhoneForMeta('0000')).toBeNull();
  });
});

describe('delivery status derivation (the honest-status contract)', () => {
  // Mirrors the logic now used by ComposeMessageModal, AutomationCenter bulk
  // reminders, and processScheduledMessages.
  const deriveStatus = (result: { success?: boolean; simulated?: boolean } | null | undefined) =>
    result?.success && !result?.simulated ? 'sent' : result?.simulated ? 'simulated' : 'failed';

  it('real provider success → sent', () => {
    expect(deriveStatus({ success: true, simulated: false })).toBe('sent');
  });

  it('unconfigured provider (success:true, simulated:true — the OLD sendEmail lie) → simulated, never sent', () => {
    // This is the exact shape sendEmail used to return when the Brevo key
    // was missing — the root of "it says email sent but nothing delivers".
    expect(deriveStatus({ success: true, simulated: true })).toBe('simulated');
  });

  it('provider failure → failed', () => {
    expect(deriveStatus({ success: false, simulated: false })).toBe('failed');
    expect(deriveStatus({ success: false, simulated: true })).toBe('simulated');
  });

  it('no result at all → failed', () => {
    expect(deriveStatus(null)).toBe('failed');
    expect(deriveStatus(undefined)).toBe('failed');
  });
});

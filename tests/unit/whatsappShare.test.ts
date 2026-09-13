/**
 * whatsappShare — tests for the post-integration WhatsApp handoff.
 *
 * The WhatsApp Business API integration is retired; the "next best thing"
 * composes the message in-app and opens WhatsApp via a wa.me deep link with
 * the text prefilled. These tests pin the phone normalisation (the DB stores
 * several Nigerian formats) and the URL shape.
 */
import { describe, it, expect } from 'vitest';
import { normalizePhoneForWa, whatsappShareUrl } from '../../src/utils/whatsappShare';

describe('normalizePhoneForWa', () => {
  it('strips formatting from international numbers', () => {
    expect(normalizePhoneForWa('+234 801 234 5678')).toBe('2348012345678');
  });
  it('keeps already-international digits as-is', () => {
    expect(normalizePhoneForWa('2348012345678')).toBe('2348012345678');
  });
  it('converts Nigerian local format with leading 0', () => {
    expect(normalizePhoneForWa('08012345678')).toBe('2348012345678');
  });
  it('converts Nigerian local format without leading 0', () => {
    expect(normalizePhoneForWa('8012345678')).toBe('2348012345678');
  });
  it('returns empty for garbage / empty input', () => {
    expect(normalizePhoneForWa('')).toBe('');
    expect(normalizePhoneForWa(null as any)).toBe('');
    expect(normalizePhoneForWa('not a phone')).toBe('');
  });
  it('keeps other-country numbers unchanged (user fixes prefix in WhatsApp)', () => {
    expect(normalizePhoneForWa('441632960961')).toBe('441632960961');
  });
});

describe('whatsappShareUrl', () => {
  it('builds a wa.me link with phone and encoded text', () => {
    expect(whatsappShareUrl('08012345678', 'Hello world')).toBe(
      'https://wa.me/2348012345678?text=Hello%20world'
    );
  });
  it('encodes newlines and special characters', () => {
    const url = whatsappShareUrl('+2348012345678', 'Line1\nLine2 — ₦5,000');
    expect(url.startsWith('https://wa.me/2348012345678?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe('Line1\nLine2 — ₦5,000');
  });
  it('falls back to a text-only share when no phone is available', () => {
    expect(whatsappShareUrl('', 'Hello')).toBe('https://wa.me/?text=Hello');
    expect(whatsappShareUrl(null, 'Hello')).toBe('https://wa.me/?text=Hello');
  });
});

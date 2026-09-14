/**
 * pushReplyAuth tests — the WhatsApp-style notification-reply bearer.
 *
 * The replyToken is the ONLY auth gate for POST /api/push-reply (the
 * Android notification shade has no session), so its properties are
 * security-critical:
 *   1. A minted token verifies for exactly its (user, conversation).
 *   2. Any other conversation → rejected (token theft can't cross chats).
 *   3. Tampered payload or signature → rejected.
 *   4. A token minted with a DIFFERENT service account key → rejected
 *      (rotating the Firebase key invalidates outstanding tokens).
 *   5. Round-trip stability: mint → verify returns the embedded ids.
 */
import { describe, it, expect } from 'vitest';
import { mintReplyToken, verifyReplyToken } from '../../convex/pushReplyAuth';

const SA = JSON.stringify({
  project_id: 'practicepro-42178',
  client_email: 'push@practicepro-42178.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQ\n-----END PRIVATE KEY-----\n',
});
const OTHER_SA = JSON.stringify({
  project_id: 'practicepro-42178',
  client_email: 'push@practicepro-42178.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nTOTALLYDIFFERENTKEYMATERIAL\n-----END PRIVATE KEY-----\n',
});

describe('pushReplyAuth (notification inline-reply bearer)', () => {
  it('round-trips: mint → verify returns the embedded user and conversation', async () => {
    const token = await mintReplyToken(SA, 'user-123', 'conv-abc');
    const verified = await verifyReplyToken(SA, token, 'conv-abc');
    expect(verified).not.toBeNull();
    expect(verified!.userId).toBe('user-123');
    expect(verified!.conversationId).toBe('conv-abc');
    expect(verified!.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects a token used against a different conversation', async () => {
    const token = await mintReplyToken(SA, 'user-123', 'conv-abc');
    const verified = await verifyReplyToken(SA, token, 'conv-OTHER');
    expect(verified).toBeNull();
  });

  it('rejects tampered payloads (signature no longer matches)', async () => {
    const token = await mintReplyToken(SA, 'user-123', 'conv-abc');
    const parts = token.split('.');
    // Decode payload, swap the user id, re-encode — signature stays the old one.
    const payload = Buffer.from(
      parts[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    const tampered = payload.replace('user-123', 'user-999');
    const tamperedB64 = Buffer.from(tampered, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const tamperedToken = `v2.${tamperedB64}.${parts[2]}`;
    expect(await verifyReplyToken(SA, tamperedToken, 'conv-abc')).toBeNull();
  });

  it('rejects a token minted under a different service account key', async () => {
    const token = await mintReplyToken(SA, 'user-123', 'conv-abc');
    expect(await verifyReplyToken(OTHER_SA, token, 'conv-abc')).toBeNull();
  });

  it('rejects garbage, non-string tokens and missing configuration', async () => {
    expect(await verifyReplyToken(SA, '', 'conv-abc')).toBeNull();
    expect(await verifyReplyToken(SA, undefined, 'conv-abc')).toBeNull();
    expect(await verifyReplyToken(SA, 12345, 'conv-abc')).toBeNull();
    expect(await verifyReplyToken(SA, 'v2.not.enough.parts', 'conv-abc')).toBeNull();
    expect(await verifyReplyToken(undefined, 'v2.a.b', 'conv-abc')).toBeNull();
  });
});

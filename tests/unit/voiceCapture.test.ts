/**
 * voiceCapture — the Voice Capture Engine's pure logic.
 *
 * Covers the pieces the owner spec (2026-11-18) hinges on:
 *   - verbatim assembly stays order-safe across out-of-order offline replays
 *   - the Whisper→Gemini provider chain's retryable-vs-permanent error split
 *   - the IndexedDB queue's backoff schedule and key derivation
 *   - Smart Clean prompt rules (self-correction resolution, Nigerian legal
 *     terminology, case citations, Pidgin preservation)
 *   - triage prompt JSON contract + deterministic matter/contact matching
 *   - Lagos (UTC+01:00) "today" context used for relative-date resolution
 *   - base64 decoding for the upload path
 *   - the TriageCard's event-type coercion against the firm's type list
 */

import { describe, it, expect } from 'vitest';
import {
  assembleVerbatim,
  lagosNow,
  matchMatterCandidates,
  parseModelJson,
  decodeBase64ToBytes,
  buildVerbatimPrompt,
  SMART_CLEAN_SYSTEM_PROMPT,
  buildTriagePrompt,
  buildMergePrompt,
  classifyGeminiFailure,
  GEMINI_FAILURE_MESSAGES,
} from '../../convex/voiceCapture';
import { backoffDelayMs, segmentKey } from '../../src/services/voice/audioQueue';
import { isRetryableError } from '../../src/services/voice/voiceCaptureService';

// ─── Verbatim assembly ──────────────────────────────────────────────────────

describe('assembleVerbatim', () => {
  it('joins segment texts in index order regardless of arrival order', () => {
    const out = assembleVerbatim([
      { index: 2, text: ' third.' },
      { index: 0, text: 'First,' },
      { index: 1, text: 'second,' },
    ]);
    expect(out).toBe('First, second, third.');
  });

  it('drops empty segments and collapses whitespace', () => {
    const out = assembleVerbatim([
      { index: 0, text: '  hello   world  ' },
      { index: 1, text: '' },
      { index: 2, text: 'again' },
    ]);
    expect(out).toBe('hello world again');
  });

  it('returns empty string for no segments (finalize guard)', () => {
    expect(assembleVerbatim([])).toBe('');
    expect(assembleVerbatim(undefined as any)).toBe('');
  });
});

// ─── Lagos time context (relative-date resolution for triage) ───────────────

describe('lagosNow', () => {
  it('shifts UTC to West Africa Time (UTC+01:00) with correct weekday', () => {
    // 2026-11-18 23:30 UTC → 2026-11-19 00:30 WAT (Wednesday → Thursday)
    const t = lagosNow(Date.UTC(2026, 10, 18, 23, 30));
    expect(t.dateISO).toBe('2026-11-19');
    expect(t.weekday).toBe('Thursday');
    expect(t.time).toBe('00:30');
  });

  it('keeps the date inside the same Lagos day mid-afternoon', () => {
    // 2026-11-18 10:00 UTC → 11:00 WAT same day
    const t = lagosNow(Date.UTC(2026, 10, 18, 10, 0));
    expect(t.dateISO).toBe('2026-11-18');
    expect(t.weekday).toBe('Wednesday');
    expect(t.time).toBe('11:00');
  });
});

// ─── Deterministic matter/contact matching ─────────────────────────────────

describe('matchMatterCandidates', () => {
  const matters = [
    { id: 'm1', title: 'Okafor & Sons Ltd v. First Bank of Nigeria', suitNumber: 'FHC/L/123/2024', clientId: 'c1' },
    { id: 'm2', title: 'Ademola Tenancy Dispute', suitNumber: null, clientId: 'c2' },
    { id: 'm3', title: 'In Re: Chidi Estates', suitNumber: 'CA/L/999/2025', clientId: 'c3' },
  ];
  const contacts = [
    { id: 'c1', name: 'Chief Okafor' },
    { id: 'c2', name: 'Mrs Ademola' },
  ];

  it('matches a candidate contained in a matter title (case/punctuation-insensitive)', () => {
    const r = matchMatterCandidates(['Okafor & Sons'], matters, contacts);
    expect(r.matchedMatterIds).toEqual(['m1']);
  });

  it('matches by suit number', () => {
    const r = matchMatterCandidates(['FHC/L/123/2024'], matters, contacts);
    expect(r.matchedMatterIds).toEqual(['m1']);
  });

  it('matches contacts by name both directions', () => {
    const r = matchMatterCandidates(['Chief Okafor'], matters, contacts);
    expect(r.matchedContactIds).toEqual(['c1']);
    const r2 = matchMatterCandidates(['Okafor'], matters, contacts);
    expect(r2.matchedContactIds).toContain('c1');
  });

  it('ignores short candidates (<3 chars) to avoid noise matches', () => {
    const r = matchMatterCandidates(['v.', 'of'], matters, contacts);
    expect(r.matchedMatterIds).toEqual([]);
    expect(r.matchedContactIds).toEqual([]);
  });

  it('returns empty for no candidates', () => {
    const r = matchMatterCandidates([], matters, contacts);
    expect(r).toEqual({ matchedMatterIds: [], matchedContactIds: [] });
  });
});

// ─── Model JSON parsing ─────────────────────────────────────────────────────

describe('parseModelJson', () => {
  it('parses bare JSON', () => {
    expect(parseModelJson('{"intent":"case_note"}')).toEqual({ intent: 'case_note' });
  });

  it('strips markdown fences', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('extracts JSON from surrounding prose', () => {
    expect(parseModelJson('Sure! Here is the triage: {"intent":"share"} hope that helps')).toEqual({
      intent: 'share',
    });
  });

  it('returns null for non-JSON and truncated output', () => {
    expect(parseModelJson('no json here')).toBeNull();
    expect(parseModelJson('{"intent":')).toBeNull();
    expect(parseModelJson('')).toBeNull();
  });
});

// ─── Base64 decode (upload path) ────────────────────────────────────────────

describe('decodeBase64ToBytes', () => {
  it('round-trips plain base64', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 0, 128]);
    const b64 = Buffer.from(bytes).toString('base64');
    expect(Array.from(decodeBase64ToBytes(b64))).toEqual(Array.from(bytes));
  });

  it('accepts data: URLs', () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const dataUrl = 'data:audio/wav;base64,' + Buffer.from(bytes).toString('base64');
    expect(Array.from(decodeBase64ToBytes(dataUrl))).toEqual([10, 20, 30]);
  });
});

// ─── Prompt contracts ───────────────────────────────────────────────────────

describe('prompts', () => {
  it('verbatim prompt: forbids cleanup, preserves Pidgin and names, carries the continuation tail', () => {
    const p = buildVerbatimPrompt('the matter was adjourned');
    expect(p).toContain('word for word');
    expect(p).toContain('do not translate');
    expect(p).toContain('[inaudible]');
    expect(p).toContain('the matter was adjourned');
  });

  it('verbatim prompt: omits the tail block when there is no tail', () => {
    expect(buildVerbatimPrompt()).not.toContain('CONTEXT');
  });

  it('Smart Clean: resolves self-corrections, preserves citations/legal terms/Pidgin', () => {
    const p = SMART_CLEAN_SYSTEM_PROMPT;
    // The owner's exact example: "Tuesday... actually make that Thursday"
    expect(p).toContain('RESOLVE MID-SENTENCE SELF-CORRECTIONS');
    expect(p).toContain('actually make that Thursday');
    // Nigerian legal terminology + citations stay verbatim
    expect(p).toContain('NWLR');
    expect(p).toContain('LPELR');
    expect(p).toContain('habeas corpus');
    expect(p).toContain('governor\'s consent');
    expect(p).toContain('do not translate to English');
    expect(p).toContain('NEVER add, infer');
  });

  it('triage prompt: strict JSON contract, Lagos today context, firm data, event types', () => {
    const p = buildTriagePrompt({
      lagos: { dateISO: '2026-11-18', weekday: 'Wednesday', time: '09:00' },
      matters: [{ id: 'm1', title: 'Okafor v. FBN', suitNumber: 'FHC/L/123/2024' }],
      contacts: [{ id: 'c1', name: 'Chief Okafor' }],
      eventTypeNames: ['Mention', 'Hearing'],
    });
    expect(p).toContain('Wednesday, 2026-11-18, 09:00');
    expect(p).toContain('Okafor v. FBN');
    expect(p).toContain('Chief Okafor');
    expect(p).toContain('Mention, Hearing');
    expect(p).toContain('STRICT JSON');
    expect(p).toContain('"intent"');
    expect(p).toContain('resolve relative words like "tomorrow", "Friday"');
  });

  it('triage prompt: falls back to a default event-type list when the firm has none', () => {
    const p = buildTriagePrompt({
      lagos: { dateISO: '2026-11-18', weekday: 'Wednesday', time: '09:00' },
      matters: [],
      contacts: [],
      eventTypeNames: [],
    });
    expect(p).toContain('Meeting, Hearing, Mention, Deadline, Consultation');
  });

  it('merge prompt: weaves shorthand + verbatim, flags discrepancies, never invents', () => {
    const p = buildMergePrompt();
    expect(p).toContain('RECORD A');
    expect(p).toContain('RECORD B');
    expect(p).toContain('Discrepancies');
    expect(p).toContain('Never invent facts');
  });
});

// ─── Upload queue: backoff + keys ───────────────────────────────────────────

describe('audioQueue backoff', () => {
  it('schedules 0s → 5s → 30s → 2m → 5m cap', () => {
    expect(backoffDelayMs(0)).toBe(0);
    expect(backoffDelayMs(1)).toBe(5_000);
    expect(backoffDelayMs(2)).toBe(30_000);
    expect(backoffDelayMs(3)).toBe(120_000);
    expect(backoffDelayMs(4)).toBe(300_000);
    expect(backoffDelayMs(50)).toBe(300_000);
  });

  it('derives stable, parseable segment keys', () => {
    expect(segmentKey('abc-123', 4)).toBe('abc-123:4');
  });
});

// ─── Retryable vs permanent upload errors ───────────────────────────────────

describe('isRetryableError', () => {
  it('retries network-style failures', () => {
    expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRetryableError(new Error('Network connection lost'))).toBe(true);
    expect(isRetryableError(new Error('Request timed out'))).toBe(true);
    expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
    expect(isRetryableError(new Error('Uncaught Error: 502 Bad Gateway'))).toBe(true);
  });

  it('does NOT retry auth or payload rejections (dead-letter instead)', () => {
    expect(isRetryableError(new Error('Unauthorized: the session token is invalid'))).toBe(false);
    expect(isRetryableError(new Error('Audio segment too large (4 MB limit)'))).toBe(false);
    expect(isRetryableError(new Error('Segment too long (5 min limit)'))).toBe(false);
  });
});

// ─── Gemini failure classification (2026-11-18 key-leak incident) ───────────

describe('classifyGeminiFailure', () => {
  it('classifies the leaked-key 403 the founder actually hit', () => {
    // Verbatim shape Google returns when its secret scanner disables a key
    // committed to a public repo (founder screenshot 2026-11-18).
    expect(
      classifyGeminiFailure(
        403,
        'PERMISSION_DENIED: Your API key was reported as leaked. Please use another API key.'
      )
    ).toBe('key-rejected');
  });

  it('classifies 401/403 and key-shaped messages as key-rejected', () => {
    expect(classifyGeminiFailure(401, '')).toBe('key-rejected');
    expect(classifyGeminiFailure(403, 'PERMISSION_DENIED')).toBe('key-rejected');
    expect(classifyGeminiFailure(500, 'API key not valid. Please pass a valid API key.')).toBe('key-rejected');
    expect(classifyGeminiFailure(200, 'something about an api_key issue')).toBe('key-rejected');
  });

  it('classifies rate limits, outages, and bad requests', () => {
    expect(classifyGeminiFailure(429, 'RESOURCE_EXHAUSTED')).toBe('rate-limited');
    expect(classifyGeminiFailure(503, 'backend error')).toBe('provider-down');
    expect(classifyGeminiFailure(400, 'invalid payload')).toBe('bad-request');
    expect(classifyGeminiFailure(404, 'model not found')).toBe('bad-request');
  });

  it('falls through to unknown for anything else', () => {
    expect(classifyGeminiFailure(418, "I'm a teapot")).toBe('unknown');
  });

  it('maps every class to a client-safe message (no raw provider jargon, no request IDs)', () => {
    for (const cls of ['key-rejected', 'rate-limited', 'provider-down', 'bad-request', 'unknown'] as const) {
      const msg = GEMINI_FAILURE_MESSAGES[cls];
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toMatch(/AIza|Request ID|Uncaught|PERMISSION_DENIED|Gemini \d/);
    }
  });
});

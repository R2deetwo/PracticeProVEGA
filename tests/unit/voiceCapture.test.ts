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
  buildQuickAskContext,
  QUICK_ASK_SYSTEM_PROMPT,
  addDaysISO,
  buildAnalysisPrompt,
  rankAndValidateMatterMatches,
  validateQuickAskActions,
  validateWorkspaceProposals,
} from '../../convex/voiceCapture';
import { backoffDelayMs, segmentKey } from '../../src/services/voice/audioQueue';
import { isRetryableError } from '../../src/services/voice/voiceCaptureService';
import {
  extractNewClipText,
  joinDraftText,
  appendSeparatorLabel,
  stripMetaSpeech,
  formatEndorsementText,
  eventDescriptionFrom,
  extractLearnedTerms,
} from '../../src/services/voice/draftUtils';

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

  it('Smart Clean: resolves self-corrections, preserves citations/legal terms, normalises Pidgin', () => {
    const p = SMART_CLEAN_SYSTEM_PROMPT;
    // Backtracking pivots (owner spec 2026-11-19 §2.1): the exact phrases
    // that must discard the retracted phrase entirely.
    expect(p).toContain('RESOLVE MID-SENTENCE SELF-CORRECTIONS AND BACKTRACKING');
    expect(p).toContain('actually scratch that, make it Wednesday at 4 PM');
    // Nigerian legal terminology + citations stay verbatim
    expect(p).toContain('NWLR');
    expect(p).toContain('LPELR');
    expect(p).toContain('habeas corpus');
    expect(p).toContain('governor\'s consent');
    // Wispr-Flow upgrade (2026-11-19 §2.7): the CLEANED tier now normalises
    // casual Pidgin into professional English (verbatim still preserves it).
    expect(p).toContain('normalise casual Pidgin phrasing into crisp professional English');
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

// ─── Incremental dictation ("Add More" / append to voice note) ───────────────

describe('extractNewClipText', () => {
  it('isolates the new clip when the previous verbatim is a prefix (the normal append case)', () => {
    const prev = 'First clip words about the matter.';
    const full = 'First clip words about the matter. Also, the matter was adjourned to Friday at 9 AM';
    expect(extractNewClipText(full, prev)).toBe(
      'Also, the matter was adjourned to Friday at 9 AM'
    );
  });

  it('ignores whitespace differences at the seam (assembleVerbatim collapses them)', () => {
    expect(extractNewClipText('hello world   again', 'hello world')).toBe('again');
    expect(extractNewClipText('  hello world again  ', '  hello world  ')).toBe('again');
  });

  it('returns the full text when there was no previous clip', () => {
    expect(extractNewClipText('brand new note', '')).toBe('brand new note');
  });

  it('returns empty when nothing new was spoken (identical transcripts)', () => {
    expect(extractNewClipText('same words', 'same words')).toBe('');
  });

  it('falls back to the FULL text when the previous is not a prefix — words are never silently dropped', () => {
    const full = 'completely different words';
    expect(extractNewClipText(full, 'unrelated prefix that is not there')).toBe(full);
  });

  it('handles empty inputs gracefully', () => {
    expect(extractNewClipText('', 'previous')).toBe('');
    expect(extractNewClipText('', '')).toBe('');
  });
});

describe('joinDraftText', () => {
  it('appends a new clip after the existing draft with a paragraph break', () => {
    expect(joinDraftText('First part.', 'Second part.')).toBe('First part.\n\nSecond part.');
  });

  it('NEVER overwrites or deletes the earlier text — original words are preserved verbatim', () => {
    const draft = 'Client instructed us to file the motion.';
    const out = joinDraftText(draft, 'Adjourned to Friday.');
    expect(out.startsWith(draft)).toBe(true);
    expect(out).toContain('Adjourned to Friday.');
  });

  it('treats an empty draft as just the addition', () => {
    expect(joinDraftText('', 'first words')).toBe('first words');
  });

  it('ignores empty additions (no stray separators)', () => {
    expect(joinDraftText('existing', '')).toBe('existing');
    expect(joinDraftText('existing', '   ')).toBe('existing');
  });

  it('trims the join point: draft keeps its leading whitespace, addition is fully trimmed', () => {
    // The draft is the user's own text — leading indentation is preserved;
    // only the trailing edge (where the join happens) and the machine-added
    // clip are trimmed.
    expect(joinDraftText('  base  ', '  added  ')).toBe('  base\n\nadded');
  });
});

describe('assembleVerbatim across append rounds (index continuation)', () => {
  it('assembles original + appended segments in chronological order even with index gaps', () => {
    // Round 1: segments 0 and 1. Round 2 (Add More) continues at index 2.
    // A dead-lettered segment 1 leaves a gap — order must still hold.
    const out = assembleVerbatim([
      { index: 2, text: 'And the adjourned date is Friday.' },
      { index: 0, text: 'Notes from the hearing today.' },
    ]);
    expect(out).toBe('Notes from the hearing today. And the adjourned date is Friday.');
  });
});

describe('appendSeparatorLabel', () => {
  it('formats a compact human-readable separator with date and time', () => {
    const d = new Date(2026, 10, 18, 14, 32); // Wed 18 Nov 2026, 14:32 local
    expect(appendSeparatorLabel(d)).toBe('— Appended Wed 18 Nov 2026, 14:32 —');
  });

  it('zero-pads minutes and hours', () => {
    const d = new Date(2026, 0, 5, 9, 5); // Mon 5 Jan 2026
    expect(appendSeparatorLabel(d)).toBe('— Appended Mon 5 Jan 2026, 09:05 —');
  });
});

// ── quickAsk grounding (owner bug report 2026-11-18: "how many matters do
//    I have?" was answered "you have no matters" — the prompt led with
//    "MATCHED MATTERS: (none)", a keyword miss the model read as an empty
//    firm). The context now leads with authoritative counts + an inventory,
//    and the keyword sections are labelled as subsets.
describe('buildQuickAskContext', () => {
  const baseArgs = {
    noteCount: 4,
    upcomingCount: 2,
    matchedMatters: [] as { title: string; detail: string }[],
    matchedNotes: [] as { title: string; detail: string }[],
    upcoming: [
      { title: 'Mention — Adebayo v. State', detail: '2026-11-20 09:00 · Mention' },
    ],
  };

  it('leads with authoritative counts so counting questions have real numbers', () => {
    const ctx = buildQuickAskContext({
      ...baseArgs,
      matters: [
        { title: 'Adebayo v. State', suitNumber: 'FCT/ABJ/CR/123/2026', status: 'Active' },
        { title: 'Chukwu v. Zenith Bank', suitNumber: null, status: 'Closed' },
        { title: 'Estate of Musa', suitNumber: 'NICN/LA/45/2026', status: 'Active' },
      ],
    });
    expect(ctx).toContain('FIRM DATA SUMMARY (authoritative');
    expect(ctx).toContain('- Matters on record: 3');
    expect(ctx).toContain('(2 active, 1 closed/archived)');
    expect(ctx).toContain('- Notes on record: 4');
    expect(ctx).toContain('- Upcoming calendar events (today onwards): 2');
  });

  it('includes the matter inventory (title, suit number, status)', () => {
    const ctx = buildQuickAskContext({
      ...baseArgs,
      matters: [{ title: 'Adebayo v. State', suitNumber: 'FCT/ABJ/CR/123/2026', status: 'Active' }],
    });
    expect(ctx).toContain('MATTER INVENTORY (first 1 of 1)');
    expect(ctx).toContain('- Adebayo v. State [FCT/ABJ/CR/123/2026] (Active)');
  });

  it('says plainly when the firm genuinely has no matters', () => {
    const ctx = buildQuickAskContext({ ...baseArgs, matters: [] });
    expect(ctx).toContain('- Matters on record: 0');
    expect(ctx).toContain('MATTER INVENTORY: the firm has no matters on record.');
  });

  it('labels keyword misses as subset misses, never as an empty firm', () => {
    // "how many matters do I have" matches no title — the regression case.
    const ctx = buildQuickAskContext({
      ...baseArgs,
      matters: [
        { title: 'Adebayo v. State', suitNumber: 'FCT/ABJ/CR/123/2026', status: 'Active' },
        { title: 'Chukwu v. Zenith Bank', suitNumber: null, status: 'Active' },
      ],
      matchedMatters: [],
    });
    expect(ctx).toContain('KEYWORD-MATCHED MATTERS (subset filtered');
    expect(ctx).toContain('of 2 on record');
    expect(ctx).toContain('empty here means no title matched the wording, NOT that the firm has none');
    expect(ctx).toContain('(no keyword match)');
    // The counts still lead — the answer cannot be "no matters".
    expect(ctx.indexOf('- Matters on record: 2')).toBeLessThan(ctx.indexOf('KEYWORD-MATCHED MATTERS'));
  });

  it('caps the inventory at 25 rows while reporting the true total', () => {
    const matters = Array.from({ length: 30 }, (_, i) => ({
      title: `Matter ${i + 1}`,
      status: 'Active',
    }));
    const ctx = buildQuickAskContext({ ...baseArgs, matters });
    expect(ctx).toContain('- Matters on record: 30');
    expect(ctx).toContain('MATTER INVENTORY (first 25 of 30)');
    expect(ctx).toContain('- Matter 25');
    expect(ctx).not.toContain('- Matter 26');
  });

  it('counts statuses case-insensitively and buckets unknown statuses as other', () => {
    const ctx = buildQuickAskContext({
      ...baseArgs,
      matters: [
        { title: 'A', status: 'ACTIVE' },
        { title: 'B', status: 'archived' },
        { title: 'C', status: 'Pending' },
      ],
    });
    expect(ctx).toContain('(1 active, 1 closed/archived, 1 other status)');
  });
});

describe('QUICK_ASK_SYSTEM_PROMPT', () => {
  it('instructs the model to answer counting questions from the summary counts', () => {
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('authoritative counts');
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain("how many matters do I have");
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('never from the keyword-matched subsets');
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('filtered subsets');
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('Never invent matters');
  });

  it('is action-capable (owner spec §5): declares the create_event / save_note tools and the strict-JSON envelope', () => {
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('ACTION TOOLS');
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('create_event');
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('save_note');
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('add a check on the Chukwu matter for tomorrow at 10 AM');
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain("use 09:00");
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('only act on a CLEAR instruction');
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('"answer"');
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('"actions"');
  });
});

// ── INTELLIGENCE UPGRADE (owner spec 2026-11-18: semantic matching,
//    relative dates, multi-intent triage, action-capable Quick Ask) ─────────

describe('addDaysISO', () => {
  it('adds days across month and year boundaries (UTC-safe)', () => {
    expect(addDaysISO('2026-11-18', 1)).toBe('2026-11-19');
    expect(addDaysISO('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-11-18', 7)).toBe('2026-11-25');
    expect(addDaysISO('2024-02-28', 1)).toBe('2024-02-29'); // leap year
  });

  it('passes through invalid input untouched', () => {
    expect(addDaysISO('', 1)).toBe('');
    expect(addDaysISO('tomorrow', 1)).toBe('tomorrow');
  });
});

describe('buildAnalysisPrompt (multi-intent analysis, owner spec §1–§4)', () => {
  const lagos = { dateISO: '2026-11-18', weekday: 'Wednesday', time: '15:30' };
  const matters = [
    {
      id: 'm1',
      title: 'Chukwu v. Zenith Bank',
      suitNumber: 'FHC/L/CS/45/2026',
      clientName: 'Chukwu Okafor',
      parties: ['Chukwu Okafor', 'Zenith Bank'],
      status: 'Active',
      court: 'Federal High Court, Lagos',
    },
    {
      id: 'm2',
      title: 'Lekki Land Dispute',
      suitNumber: null,
      clientName: null,
      parties: ['Adeniyi'],
      status: 'Active',
      court: null,
    },
  ];
  const contacts = [{ id: 'c1', name: 'Chukwu Okafor' }];

  it('passes the exact WAT date/time so relative terms resolve', () => {
    const p = buildAnalysisPrompt({ lagos, matters, contacts, eventTypeNames: ['Meeting', 'Hearing'] });
    expect(p).toContain('Africa/Lagos, WAT UTC+01:00');
    expect(p).toContain('Wednesday, 2026-11-18, 15:30');
    // Resolved anchors for the common relative terms.
    expect(p).toContain('"tomorrow" = 2026-11-19');
    expect(p).toContain('"in 3 days" = 2026-11-21');
    expect(p).toContain('"next week" = 2026-11-25');
  });

  it('renders the matters directory with suit, client, parties for semantic matching', () => {
    const p = buildAnalysisPrompt({ lagos, matters, contacts, eventTypeNames: [] });
    expect(p).toContain('Chukwu v. Zenith Bank');
    expect(p).toContain('suit FHC/L/CS/45/2026');
    expect(p).toContain('client Chukwu Okafor');
    expect(p).toContain('parties Chukwu Okafor / Zenith Bank');
    expect(p).toContain('(id: m1)');
  });

  it('demands semantic fuzzy matching with ranked confidences (§2)', () => {
    const p = buildAnalysisPrompt({ lagos, matters, contacts, eventTypeNames: [] });
    expect(p).toContain('SEMANTIC fuzzy matching');
    expect(p).toContain('the Chukwu file');
    expect(p).toContain('the Lekki land case');
    expect(p).toContain('confidence');
    expect(p).toContain('top 3 max');
  });

  it('pins the 09:00 default + timeEstimated flag and implied tasks (§3)', () => {
    const p = buildAnalysisPrompt({ lagos, matters, contacts, eventTypeNames: [] });
    expect(p).toContain('use 09:00 for morning');
    expect(p).toContain('set timeEstimated true');
    expect(p).toContain('follow up with registry');
    expect(p).toContain('empty string if truly no date was spoken');
  });

  it('is multi-intent: a case note can carry events (§4) and endorsements extract', () => {
    const p = buildAnalysisPrompt({ lagos, matters, contacts, eventTypeNames: [] });
    expect(p).toContain('one note can be several things at once');
    expect(p).toContain('the events ride along');
    expect(p).toContain('"endorsement"');
    expect(p).toContain('nextAdjournedDate');
    expect(p).toContain('"matterMatches"');
    expect(p).toContain('"isDiaryTask"');
  });
});

describe('rankAndValidateMatterMatches (§2 backstop merge)', () => {
  const matters = [
    { id: 'm1', title: 'Chukwu v. Zenith Bank', suitNumber: 'FHC/L/CS/45/2026' },
    { id: 'm2', title: 'Chukwu Estate Administration', suitNumber: null },
    { id: 'm3', title: 'Adebayo v. State', suitNumber: null },
  ];
  const contacts = [{ id: 'c1', name: 'Chukwu' }];

  it('drops LLM matches whose id is not a real matter (no conjured ids)', () => {
    const out = rankAndValidateMatterMatches(
      [{ matterId: 'made-up', confidence: 0.99 }],
      matters,
      [],
      contacts
    );
    expect(out).toEqual([]);
  });

  it('ranks by confidence and keeps the LLM ranking over the backstop', () => {
    const out = rankAndValidateMatterMatches(
      [
        { matterId: 'm3', confidence: 0.4, reason: 'party name' },
        { matterId: 'm1', confidence: 0.9, reason: 'the Chukwu file' },
      ],
      matters,
      ['Zenith Bank'], // containment backstop hits only m1 — already ranked
      contacts
    );
    expect(out.map((m) => m.matterId)).toEqual(['m1', 'm3']);
    expect(out[0].reason).toBe('the Chukwu file');
  });

  it('backstop disambiguates similar names ("Chukwu" hits both Chukwu matters)', () => {
    const out = rankAndValidateMatterMatches(
      [{ matterId: 'm1', confidence: 0.9, reason: 'the Chukwu file' }],
      matters,
      ['Chukwu'],
      contacts
    );
    // The ambiguous surname surfaces BOTH Chukwu matters as ranked pills —
    // exactly the 1-tap disambiguation the card needs.
    expect(out.map((m) => m.matterId)).toEqual(['m1', 'm2']);
    expect(out[1].confidence).toBe(0.5);
  });

  it('appends deterministic containment hits the LLM missed (backstop 0.5)', () => {
    const out = rankAndValidateMatterMatches(
      [{ matterId: 'm3', confidence: 0.8 }],
      matters,
      ['Chukwu v. Zenith Bank'],
      contacts
    );
    expect(out).toHaveLength(2);
    const backstop = out.find((m) => m.matterId === 'm1');
    expect(backstop?.confidence).toBe(0.5);
  });

  it('de-duplicates and caps the disambiguation pills at 3', () => {
    const out = rankAndValidateMatterMatches(
      [
        { matterId: 'm1', confidence: 0.9 },
        { matterId: 'm1', confidence: 0.7 },
        { matterId: 'm2', confidence: 0.6 },
        { matterId: 'm3', confidence: 0.55 },
      ],
      matters,
      [],
      contacts
    );
    expect(out).toHaveLength(3);
    expect(new Set(out.map((m) => m.matterId)).size).toBe(3);
  });

  it('drops zero-confidence noise', () => {
    const out = rankAndValidateMatterMatches(
      [{ matterId: 'm1', confidence: 0 }],
      matters,
      [],
      contacts
    );
    expect(out).toEqual([]);
  });
});

describe('validateQuickAskActions (§5 action sanitisation)', () => {
  const matters = [
    { id: 'm1', title: 'Chukwu v. Zenith Bank' },
    { id: 'm2', title: 'Adebayo v. State' },
  ];

  it('keeps a well-formed create_event and defaults the time to 09:00', () => {
    const out = validateQuickAskActions(
      [{ type: 'create_event', title: 'Check — Chukwu matter', eventType: 'Deadline', dateISO: '2026-11-19', time: '', matterId: 'm1' }],
      matters
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: 'create_event',
      title: 'Check — Chukwu matter',
      type2: 'Deadline',
      dateISO: '2026-11-19',
      time: '09:00',
      matterId: 'm1',
    });
  });

  it('drops create_event without a real YYYY-MM-DD date (never fails on relative words)', () => {
    const out = validateQuickAskActions(
      [
        { type: 'create_event', title: 'No date', dateISO: 'tomorrow' },
        { type: 'create_event', title: 'Empty date', dateISO: '' },
      ],
      matters
    );
    expect(out).toEqual([]);
  });

  it('drops save_note without content and events with matter ids from another firm', () => {
    const out = validateQuickAskActions(
      [
        { type: 'save_note', title: 'Empty note', content: '   ', matterId: 'm1' },
        { type: 'create_event', title: 'Foreign matter', dateISO: '2026-11-19', matterId: 'someone-else' },
        { type: 'save_note', title: 'Good note', content: 'Client confirmed terms.', matterId: 'm2' },
      ],
      matters
    );
    expect(out).toHaveLength(1);
    expect(out[0].matterId).toBe('m2');
  });

  it('drops unknown action types entirely (only create_event / save_note exist)', () => {
    const out = validateQuickAskActions(
      [{ type: 'delete_everything', title: 'Nice try' }],
      matters
    );
    expect(out).toEqual([]);
  });

  it('caps at 3 actions per call', () => {
    const raw = Array.from({ length: 5 }, (_, i) => ({
      type: 'create_event',
      title: `Event ${i}`,
      dateISO: '2026-11-19',
    }));
    expect(validateQuickAskActions(raw, matters)).toHaveLength(3);
  });
});

// ─── Wispr-Flow formatting helpers (owner spec 2026-11-19) ──────────────────

describe('stripMetaSpeech', () => {
  it('strips "From voice note:" scaffolding', () => {
    expect(stripMetaSpeech('From voice note: I have a matter tomorrow on the Sino Truck file.'))
      .toBe('I have a matter tomorrow on the Sino Truck file.');
  });

  it('strips reminder meta-instructions', () => {
    expect(stripMetaSpeech("I'm trying to set a reminder for the registry check tomorrow."))
      .toBe('The registry check tomorrow.');
    expect(stripMetaSpeech('Remind me to call the registrar.'))
      .toBe('Call the registrar.');
  });

  it('peels stacked openers ("Okay, I want to capture a quick note about…")', () => {
    expect(stripMetaSpeech('Okay, I want to capture a quick note about the tenancy inspection.'))
      .toBe('The tenancy inspection.');
  });

  it('strips trailing closers but never content', () => {
    expect(stripMetaSpeech('Registry check tomorrow. That is all.'))
      .toBe('Registry check tomorrow');
  });

  it('leaves clean legal content untouched', () => {
    const clean = 'Court adjourned the matter to December 14 for hearing.';
    expect(stripMetaSpeech(clean)).toBe(clean);
  });

  it('returns empty for empty input', () => {
    expect(stripMetaSpeech('')).toBe('');
    expect(stripMetaSpeech('   ')).toBe('');
  });
});

describe('formatEndorsementText', () => {
  it('renders the formal endorsement block with ordered orders', () => {
    const out = formatEndorsementText({
      court: 'Federal High Court, Lagos',
      suitNumber: 'FHC/L/CS/45/2026',
      parties: 'Chukwu v. Zenith Bank',
      judge: 'Hon. Justice A. Ogundipe',
      orders: ['Parties to file written addresses within 14 days.', 'Hearing on the adjourned date.'],
      nextAdjournedDate: '2026-12-14',
      nextAdjournedTime: '09:00',
    });
    expect(out).toContain('COURT: Federal High Court, Lagos');
    expect(out).toContain('SUIT NO: FHC/L/CS/45/2026');
    expect(out).toContain('CORAM: Hon. Justice A. Ogundipe');
    expect(out).toContain('PROCEEDINGS / ORDERS:');
    expect(out).toContain('1. Parties to file written addresses within 14 days.');
    expect(out).toContain('2. Hearing on the adjourned date.');
    expect(out).toContain('NEXT ADJOURNED DATE: 2026-12-14 at 09:00');
  });

  it('returns empty string for nothing meaningful', () => {
    expect(formatEndorsementText(null)).toBe('');
    expect(formatEndorsementText({})).toBe('');
  });
});

describe('eventDescriptionFrom', () => {
  it('prefers the per-event action summary (never the transcript dump)', () => {
    expect(
      eventDescriptionFrom(
        'Visit the court registry to confirm the next adjourned date.',
        'From voice note: I am trying to set a reminder blah blah blah'
      )
    ).toBe('Visit the court registry to confirm the next adjourned date.');
  });

  it('falls back to the meta-stripped draft when no note exists', () => {
    const out = eventDescriptionFrom(null, 'From voice note: registry check on the Sino Truck file.');
    expect(out).toBe('Registry check on the Sino Truck file.');
    expect(out).not.toContain('From voice note');
  });

  it('caps runaway fallback text', () => {
    const long = 'A'.repeat(2000);
    expect(eventDescriptionFrom(null, long).length).toBe(600);
  });
});

describe('extractLearnedTerms (Personal Dictionary silent learning)', () => {
  it('learns a corrected proper noun ("Chinedoo" → "Chinedu")', () => {
    const before = 'Follow up with Chinedoo about the haulage invoices.';
    const after = 'Follow up with Chinedu about the haulage invoices.';
    expect(extractLearnedTerms(before, after)).toContain('Chinedu');
  });

  it('learns a corrected multi-word term ("Ikeja High Cot" → "Ikeja High Court")', () => {
    const before = 'File the process at the Ikeja High Cot before Friday.';
    const after = 'File the process at the Ikeja High Court before Friday.';
    expect(extractLearnedTerms(before, after)).toContain('Ikeja High Court');
  });

  it('learns nothing when the text is unchanged', () => {
    const t = 'Adjourned to December 14 for hearing at the Ikeja High Court.';
    expect(extractLearnedTerms(t, t)).toEqual([]);
  });

  it('does not learn common lowercase edits', () => {
    const before = 'The matter was adjourned today.';
    const after = 'The matter is adjourned today.';
    expect(extractLearnedTerms(before, after)).toEqual([]);
  });
});

// ─── Analysis prompt: workspace directories + proposals (Part 1) ────────────

describe('buildAnalysisPrompt (Wispr-Flow upgrade, 2026-11-19)', () => {
  const lagos = { dateISO: '2026-11-19', weekday: 'Thursday', time: '08:30' };
  const matters = [
    { id: 'm1', title: 'Nigerian Sino Truck v Chinedu and Sons Ltd', suitNumber: 'FHC/L/CS/9/2026' },
  ];
  const contacts = [{ id: 'c1', name: 'Mrs. Tunde Adeyemi' }];
  const properties = [
    {
      id: 'p1',
      address: 'Chevron Drive Terrace',
      propertyType: 'Terrace',
      units: [
        { id: 'u1', label: 'Block B, Flat 3', tenantName: 'Mr. Bassey' },
      ],
    },
  ];
  const openTasks = [
    { kind: 'event' as const, id: 'e1', title: 'Registry check — Sino Truck', dueDate: '2026-11-19T08:00:00.000Z', matterTitle: 'Sino Truck' },
  ];

  it('renders the properties/units and open-tasks directories', () => {
    const out = buildAnalysisPrompt({
      lagos,
      matters,
      contacts,
      eventTypeNames: [],
      properties,
      openTasks,
    });
    expect(out).toContain('Chevron Drive Terrace');
    expect(out).toContain('Block B, Flat 3');
    expect(out).toContain('[unitId: u1]');
    expect(out).toContain('Registry check — Sino Truck');
    expect(out).toContain('[event] Registry check — Sino Truck');
  });

  it('includes every workspace proposal slot in the JSON contract', () => {
    const out = buildAnalysisPrompt({
      lagos,
      matters,
      contacts,
      eventTypeNames: [],
      properties: [],
      openTasks: [],
    });
    expect(out).toContain('"newMatter"');
    expect(out).toContain('"contactUpsert"');
    expect(out).toContain('"propertyNote"');
    expect(out).toContain('"draftBlueprint"');
    expect(out).toContain('"financialEntry"');
    expect(out).toContain('"taskUpdates"');
    expect(out).toContain('"clientUpdateText"');
    expect(out).toContain('"caseNoteText"');
  });

  it('never asks the LLM for missing critical fields (AC2.5)', () => {
    const out = buildAnalysisPrompt({ lagos, matters, contacts, eventTypeNames: [] });
    expect(out).not.toContain('missingCriticalFields');
    expect(out).not.toContain('missingFields');
  });

  it('teaches backtracking, code-switching and register rules', () => {
    const out = buildAnalysisPrompt({ lagos, matters, contacts, eventTypeNames: [] });
    expect(out).toContain('scratch that');
    expect(out).toContain('BACKTRACKING');
    expect(out).toContain('CODE-SWITCHING');
    expect(out).toContain('REGISTER SHIFTING');
    expect(out).toContain('make I follow up with registrar for Ikeja');
  });

  it('injects spelling hints and spoken snippets when provided', () => {
    const out = buildAnalysisPrompt({
      lagos,
      matters,
      contacts,
      eventTypeNames: [],
      dictionaryTerms: ['Chinedu', 'Ikeja High Court'],
      snippets: [{ trigger: 'insert chambers signature', content: 'Yours faithfully, Chambers.' }],
    });
    expect(out).toContain('SPELLING HINTS');
    expect(out).toContain('Chinedu, Ikeja High Court');
    expect(out).toContain('insert chambers signature');
    expect(out).toContain('Yours faithfully, Chambers.');
  });

  it('instructs standalone (no-matter) events without forcing a match', () => {
    const out = buildAnalysisPrompt({ lagos, matters, contacts, eventTypeNames: [] });
    expect(out).toContain('STANDALONE chambers/admin tasks with no matter');
  });
});

describe('SMART_CLEAN_SYSTEM_PROMPT (backtracking + code-switching)', () => {
  it('lists the backtracking pivot words', () => {
    expect(SMART_CLEAN_SYSTEM_PROMPT).toContain('"actually"');
    expect(SMART_CLEAN_SYSTEM_PROMPT).toContain('scratch that');
    expect(SMART_CLEAN_SYSTEM_PROMPT).toContain('no, wait');
    expect(SMART_CLEAN_SYSTEM_PROMPT).toContain('I mean');
    expect(SMART_CLEAN_SYSTEM_PROMPT).toContain('make that');
  });

  it('normalises Pidgin into professional English in the cleaned tier', () => {
    expect(SMART_CLEAN_SYSTEM_PROMPT).toContain('NIGERIAN CODE-SWITCHING');
    expect(SMART_CLEAN_SYSTEM_PROMPT).toContain('normalise casual Pidgin phrasing into crisp professional English');
  });

  it('honours spelling hints when provided', () => {
    expect(SMART_CLEAN_SYSTEM_PROMPT).toContain('SPELLING HINTS');
  });
});

// ─── Workspace proposal validation (Part 1 determinism) ─────────────────────

describe('validateWorkspaceProposals', () => {
  const ctx = {
    matters: [{ id: 'm1', title: 'Sino Truck' }],
    contacts: [{ id: 'c1', name: 'Mrs. Tunde Adeyemi' }],
    properties: [
      { id: 'p1', address: 'Chevron Drive Terrace', units: [{ id: 'u1', label: 'Block B, Flat 3' }] },
    ],
    openTasks: [
      { kind: 'event' as const, id: 'e1', title: 'Registry check' },
      { kind: 'task' as const, id: 't1', title: 'Send engagement letter' },
    ],
    bestMatterConfidence: 0,
  };

  it('keeps a new-matter proposal when no existing matter matched confidently', () => {
    const out = validateWorkspaceProposals(
      {
        newMatter: {
          title: 'Mrs. Tunde Adeyemi — Lekki Phase 1 Commercial Lease Renewal',
          clientName: 'Mrs. Tunde Adeyemi',
          opposingParty: 'Prime Haulage Limited',
          practiceArea: 'Commercial Lease',
          summaryNote: '- Client: Mrs. Tunde Adeyemi\n- Rent: ₦18,000,000',
        },
      },
      ctx
    );
    expect(out.newMatter?.title).toBe('Mrs. Tunde Adeyemi — Lekki Phase 1 Commercial Lease Renewal');
    expect(out.newMatter?.clientName).toBe('Mrs. Tunde Adeyemi');
  });

  it('drops the new-matter proposal when an existing matter already matched ≥ 0.75 (no duplicates)', () => {
    const out = validateWorkspaceProposals(
      { newMatter: { title: 'Sino Truck duplicate' } },
      { ...ctx, bestMatterConfidence: 0.9 }
    );
    expect(out.newMatter).toBeNull();
  });

  it('drops property notes with an unknown propertyId and unit ids that do not belong', () => {
    const out = validateWorkspaceProposals(
      {
        propertyNote: { propertyId: 'not-a-property', note: 'Pump tripped' },
      },
      ctx
    );
    expect(out.propertyNote).toBeNull();

    const out2 = validateWorkspaceProposals(
      {
        propertyNote: { propertyId: 'p1', unitId: 'u1', note: 'Borehole pump tripped; tenant to pay service charge Friday.' },
      },
      ctx
    );
    expect(out2.propertyNote?.propertyId).toBe('p1');
    expect(out2.propertyNote?.unitId).toBe('u1');

    const out3 = validateWorkspaceProposals(
      {
        propertyNote: { propertyId: 'p1', unitId: 'rogue-unit', note: 'x' },
      },
      ctx
    );
    expect(out3.propertyNote?.unitId).toBe('');
  });

  it('validates financial amounts and normalises the type', () => {
    const out = validateWorkspaceProposals(
      {
        financialEntry: { type: 'EXPENSE', amount: 14500, currency: 'ngn', description: 'CTC fees and transport at Ikeja', matterId: 'm1' },
      },
      ctx
    );
    expect(out.financialEntry?.type).toBe('expense');
    expect(out.financialEntry?.amount).toBe(14500);
    expect(out.financialEntry?.currency).toBe('NGN');
    expect(out.financialEntry?.matterId).toBe('m1');

    const bad = validateWorkspaceProposals(
      { financialEntry: { type: 'expense', amount: -5, description: 'negative' } },
      ctx
    );
    expect(bad.financialEntry).toBeNull();

    const foreign = validateWorkspaceProposals(
      { financialEntry: { type: 'expense', amount: 100, matterId: 'someone-else' } },
      ctx
    );
    expect(foreign.financialEntry?.matterId).toBe('');
  });

  it('validates task updates against the open-task directory and normalises statuses', () => {
    const out = validateWorkspaceProposals(
      {
        taskUpdates: [
          { kind: 'event', itemId: 'e1', status: 'done', note: 'Registry check finished; adjourned to December 14.' },
          { kind: 'task', itemId: 'made-up', status: 'Completed' },
        ],
      },
      ctx
    );
    expect(out.taskUpdates).toHaveLength(1);
    expect(out.taskUpdates[0].status).toBe('Completed');
    expect(out.taskUpdates[0].itemId).toBe('e1');
  });

  it('keeps contact upserts with a real contactId and drops foreign ones', () => {
    const ok = validateWorkspaceProposals(
      { contactUpsert: { contactId: 'c1', name: 'Mrs. Tunde Adeyemi', phone: '', email: '', company: '', role: '', notes: 'Called about lease renewal.' } },
      ctx
    );
    expect(ok.contactUpsert?.contactId).toBe('c1');

    const foreign = validateWorkspaceProposals(
      { contactUpsert: { contactId: 'ghost', name: 'Nobody', phone: '0803', email: '', company: '', role: '', notes: '' } },
      ctx
    );
    expect(foreign.contactUpsert).toBeNull();
  });
});

// ─── Quick Ask note passthrough + Edit Selection prompt (Part 2) ────────────

describe('QUICK_ASK_SYSTEM_PROMPT (Wispr-Flow formatting)', () => {
  it('requires a concise action note on created events and clean note content', () => {
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain("'note'");
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('CONCISE ACTION SUMMARY');
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('strip the lawyer\'s meta-speech');
  });

  it('keeps the matter-count grounding contract', () => {
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('authoritative counts');
    expect(QUICK_ASK_SYSTEM_PROMPT).toContain('never from the keyword-matched subsets');
  });
});

describe('validateQuickAskActions (event note passthrough)', () => {
  const matters = [{ id: 'm1', title: 'Chukwu v. Zenith Bank' }];
  it('passes the concise note through, capped at 600 chars', () => {
    const [out] = validateQuickAskActions(
      [
        {
          type: 'create_event',
          title: 'Registry check',
          dateISO: '2026-11-20',
          note: 'Confirm the next adjourned date on the Sino Truck file at the Ikeja registry.',
        },
      ],
      matters
    );
    expect(out?.note).toBe('Confirm the next adjourned date on the Sino Truck file at the Ikeja registry.');
  });
});

describe('EDIT_SELECTION_SYSTEM_PROMPT', () => {
  it('rewrites only the selected passage', async () => {
    const { EDIT_SELECTION_SYSTEM_PROMPT } = await import('../../convex/voiceCapture');
    expect(EDIT_SELECTION_SYSTEM_PROMPT).toContain('ONLY a selected passage');
    expect(EDIT_SELECTION_SYSTEM_PROMPT).toContain('Return ONLY the rewritten passage');
    expect(EDIT_SELECTION_SYSTEM_PROMPT).toContain('Do not add new facts');
  });
});

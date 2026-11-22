/**
 * voxSessions — the Legal Session Capture backend's pure logic (owner spec
 * 2026-11-22: dual-mode Vox, Mode B).
 *
 * Covers the pieces the spec hinges on:
 *   - per-turn timestamp interpolation inside 60 s segments (the [MM:SS]
 *     citation basis)
 *   - the synthesis JSON contract (file note sections, action items with
 *     owner/due, the four issue-map categories) + lenient parsing
 *   - the Ask Vox search chunking (transcript windows + file-note sections)
 *   - the follow-up draft prompts' honesty rules ([Unverified Fact] /
 *     [Missing Detail], never invent dates)
 *   - the session-type vocabulary
 *   - the offline queue's session routing (kind "session" → the vox
 *     pipeline, quick captures untouched)
 *   - landing-page pins: the VegaVox band carries the four capability
 *     titles, no "new"/"beta" vocabulary, and the honest tier line.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  withApproxTimestamps,
  formatTimestampTag,
  parseSynthesisResult,
  buildSynthesisUserPrompt,
  buildSearchChunks,
  buildFollowUpPrompt,
  buildAskVoxUserPrompt,
  SESSION_SYNTHESIS_SYSTEM_PROMPT,
  ASK_VOX_SYSTEM_PROMPT,
  voxSessionTypeLabel,
  VOX_SESSION_TYPES,
  VOX_DRAFT_TYPES,
  type RawSegmentTurns,
} from '../../convex/voxSessions';

const root = join(__dirname, '..', '..');

describe('voxSessions — session type vocabulary', () => {
  it('maps every session type to its client-facing label', () => {
    expect(voxSessionTypeLabel('intake')).toBe('Client Intake');
    expect(voxSessionTypeLabel('interview')).toBe('Witness / Third-Party Interview');
    expect(voxSessionTypeLabel('debrief')).toBe('Strategy & Chambers Debrief');
    expect(voxSessionTypeLabel('court_note')).toBe('Post-Hearing / Court Note');
    expect(voxSessionTypeLabel('meeting')).toBe('General Meeting');
    expect(voxSessionTypeLabel('anything-else')).toBe('Session');
  });

  it('carries exactly the five spec session types', () => {
    expect([...VOX_SESSION_TYPES].sort()).toEqual(
      ['court_note', 'debrief', 'intake', 'interview', 'meeting']
    );
  });
});

describe('voxSessions — withApproxTimestamps (the [MM:SS] citation basis)', () => {
  it('orders segments by index and keeps every turn inside its segment window', () => {
    const segs: RawSegmentTurns[] = [
      { index: 1, startMs: 60_000, endMs: 120_000, turns: [{ speaker: '1', text: 'second segment first turn' }] },
      { index: 0, startMs: 0, endMs: 60_000, turns: [{ speaker: '1', text: 'first segment only turn' }] },
    ];
    const timed = withApproxTimestamps(segs);
    expect(timed).toHaveLength(2);
    expect(timed[0].text).toBe('first segment only turn');
    expect(timed[0].startMs).toBe(0);
    expect(timed[1].startMs).toBeGreaterThanOrEqual(60_000);
    expect(timed[1].endMs).toBe(120_000);
  });

  it('interpolates per-turn starts by word share within the window', () => {
    const segs: RawSegmentTurns[] = [
      {
        index: 0,
        startMs: 0,
        endMs: 60_000,
        turns: [
          { speaker: '1', text: 'ten words one two three four five six seven eight nine ten' },
          { speaker: '2', text: 'one' },
        ],
      },
    ];
    const timed = withApproxTimestamps(segs);
    expect(timed).toHaveLength(2);
    // The 10-word turn occupies most of the window; the 1-word turn starts late.
    expect(timed[0].startMs).toBe(0);
    expect(timed[1].startMs).toBeGreaterThan(45_000);
    expect(timed[1].endMs).toBe(60_000);
  });

  it('drops empty-text turns entirely', () => {
    const segs: RawSegmentTurns[] = [
      { index: 0, startMs: 0, endMs: 1000, turns: [{ speaker: '1', text: '   ' }, { speaker: '2', text: 'kept' }] },
    ];
    const timed = withApproxTimestamps(segs);
    expect(timed).toHaveLength(1);
    expect(timed[0].text).toBe('kept');
  });

  it('formats [MM:SS] under an hour and H:MM:SS past it', () => {
    expect(formatTimestampTag(0)).toBe('00:00');
    expect(formatTimestampTag(65_000)).toBe('01:05');
    expect(formatTimestampTag(3_723_000)).toBe('1:02:03');
  });
});

describe('voxSessions — parseSynthesisResult (the one-click outputs contract)', () => {
  const validJson = JSON.stringify({
    fileNote: '## Stated Facts\n- The client stated the fence crossed the beacon (at 00:31).',
    actionItems: [
      { task: 'Collect the survey plan', owner: 'Client', dueDateText: 'this week' },
      { task: '', owner: '', dueDateText: '' }, // dropped — empty task
      { task: 'Draft the demand letter', owner: 'Counsel', dueDateText: '' },
    ],
    issueMap: [
      { category: 'key_facts', nodes: ['Fence crossed the beacon in March'] },
      { category: 'admissions_contradictions', nodes: [] },
      { category: 'open_questions', nodes: ['Are the letters of administration current?'] },
      // next_steps missing → normalized to empty
    ],
  });

  it('parses a clean result, stamps ids, and normalizes the four categories', () => {
    const parsed = parseSynthesisResult(validJson)!;
    expect(parsed).not.toBeNull();
    expect(parsed.fileNoteMarkdown).toContain('## Stated Facts');
    expect(parsed.actionItems).toHaveLength(2);
    expect(parsed.actionItems[0]).toMatchObject({
      id: 'act-1',
      task: 'Collect the survey plan',
      owner: 'Client',
      dueDateText: 'this week',
      completed: false,
    });
    expect(parsed.issueMap.map((c) => c.category)).toEqual([
      'key_facts',
      'admissions_contradictions',
      'open_questions',
      'next_steps',
    ]);
    expect(parsed.issueMap[3].nodes).toEqual([]);
  });

  it('accepts fenced JSON with leading prose (lenient parse)', () => {
    const fenced = `Here is the record:\n\`\`\`json\n${validJson}\n\`\`\``;
    expect(parseSynthesisResult(fenced)).not.toBeNull();
  });

  it('rejects outputs without a file note', () => {
    expect(parseSynthesisResult(JSON.stringify({ actionItems: [] }))).toBeNull();
    expect(parseSynthesisResult('not json at all')).toBeNull();
    expect(parseSynthesisResult('')).toBeNull();
  });

  it('caps action items at 12 and node text at sane lengths', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ task: `Task ${i}` }));
    const parsed = parseSynthesisResult(
      JSON.stringify({ fileNote: 'note', actionItems: many })
    )!;
    expect(parsed.actionItems).toHaveLength(12);
  });

  it('the synthesis prompt pins the honest-record rules', () => {
    expect(SESSION_SYNTHESIS_SYSTEM_PROMPT).toContain('## Stated Facts');
    expect(SESSION_SYNTHESIS_SYSTEM_PROMPT).toContain('## Client Instructions');
    expect(SESSION_SYNTHESIS_SYSTEM_PROMPT).toContain('## Legal Issues Identified');
    expect(SESSION_SYNTHESIS_SYSTEM_PROMPT).toContain('[Unverified Fact]');
    expect(SESSION_SYNTHESIS_SYSTEM_PROMPT).toContain('[Missing Detail]');
    expect(SESSION_SYNTHESIS_SYSTEM_PROMPT).toContain('NEVER invent');
    expect(SESSION_SYNTHESIS_SYSTEM_PROMPT).toContain('never invent one');
  });

  it('the synthesis user prompt labels turns with speaker · timestamp', () => {
    const prompt = buildSynthesisUserPrompt({
      sessionType: 'intake',
      sessionTypeLabel: 'Client Intake',
      matterTitle: 'Okafor boundary dispute',
      lawyerName: 'A. Solicitor',
      lagosDate: '2026-11-22',
      turns: [{ speakerLabel: 'Mr Okafor', text: 'The fence crossed the beacon.', startMs: 31_000 }],
    });
    expect(prompt).toContain('SESSION TYPE: Client Intake (intake)');
    expect(prompt).toContain('LINKED MATTER: Okafor boundary dispute');
    expect(prompt).toContain('[Mr Okafor · 00:31] The fence crossed the beacon.');
  });
});

describe('voxSessions — buildSearchChunks (the Ask Vox index)', () => {
  const turns = [
    { speakerLabel: 'Counsel', text: 'Good afternoon, this consultation is being recorded.', startMs: 12_000 },
    { speakerLabel: 'Mr Okafor', text: 'My neighbour extended his fence past the beacon in March. I hold the 2009 survey plan and photographs from January.', startMs: 31_000 },
    { speakerLabel: 'Counsel', text: 'We will need the survey plan before drafting.', startMs: 84_000 },
  ];

  it('groups transcript turns into bounded windows carrying the first turn timestamp', () => {
    const chunks = buildSearchChunks(turns, null);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.text.length <= 1200)).toBe(true);
    const first = chunks[0];
    expect(first.kind).toBe('transcript');
    expect(first.timestampMs).toBe(12_000);
    expect(first.text).toContain('Counsel: Good afternoon');
  });

  it('splits the file note into H2 sections as file_note chunks at timestamp 0', () => {
    const chunks = buildSearchChunks(turns, '## Stated Facts\n- Fact one\n\n## Legal Issues Identified\n- Issue one');
    const noteChunks = chunks.filter((c) => c.kind === 'file_note');
    expect(noteChunks).toHaveLength(2);
    expect(noteChunks.every((c) => c.timestampMs === 0)).toBe(true);
    expect(noteChunks[0].text).toContain('## Stated Facts');
  });

  it('caps the total chunk count (bounded index writes)', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({
      speakerLabel: `Speaker ${i}`,
      text: `Turn ${i} with some words to fill the window`,
      startMs: i * 1000,
    }));
    expect(buildSearchChunks(many, null).length).toBeLessThanOrEqual(160);
  });
});

describe('voxSessions — follow-up drafts + Ask Vox prompts', () => {
  const turns = [{ speakerLabel: 'Client', text: 'I want the boundary restored.', startMs: 62_000 }];

  it('builds three distinct draft prompts that all pin the honesty rules', () => {
    for (const type of VOX_DRAFT_TYPES) {
      const p = buildFollowUpPrompt({
        type,
        turns,
        matterTitle: 'Okafor boundary dispute',
        lawyerName: 'A. Solicitor',
        lagosDate: '2026-11-22',
      });
      expect(p.system).toContain('[Unverified Fact]');
      expect(p.system).toContain('[Missing Detail]');
      expect(p.system).toContain('Never invent');
      expect(p.user).toContain('[Client · 01:02] I want the boundary restored.');
    }
    const recap = buildFollowUpPrompt({ type: 'client_recap', turns, matterTitle: null, lawyerName: null, lagosDate: '2026-11-22' });
    const memo = buildFollowUpPrompt({ type: 'internal_memo', turns, matterTitle: null, lawyerName: null, lagosDate: '2026-11-22' });
    const letter = buildFollowUpPrompt({ type: 'instruction_confirmation', turns, matterTitle: null, lawyerName: null, lagosDate: '2026-11-22' });
    expect(recap.system).not.toBe(memo.system);
    expect(memo.system).not.toBe(letter.system);
  });

  it('the Ask Vox prompt demands excerpt-only answers with verbatim tags', () => {
    expect(ASK_VOX_SYSTEM_PROMPT).toContain('ONLY from the excerpts');
    expect(ASK_VOX_SYSTEM_PROMPT).toContain('That is not in your recordings yet');
    expect(ASK_VOX_SYSTEM_PROMPT).toContain('[SessionTitle · MM:SS]');
  });

  it('the Ask Vox user prompt tags each excerpt with its session title + [MM:SS]', () => {
    const prompt = buildAskVoxUserPrompt('What did the client say about payment?', [
      {
        clientLocalId: 'c1',
        sessionId: 's1',
        title: 'Client Intake — Okafor',
        sessionType: 'intake',
        matterId: 'm1',
        timestampMs: 62_000,
        kind: 'transcript',
        snippet: 'Client: I want the boundary restored.',
      },
      {
        clientLocalId: 'c2',
        sessionId: 's2',
        title: 'Witness Interview — Bale',
        sessionType: 'interview',
        matterId: 'm1',
        timestampMs: 0,
        kind: 'file_note',
        snippet: '## Stated Facts\n- The witness saw the fence work.',
      },
    ]);
    expect(prompt).toContain('QUESTION: What did the client say about payment?');
    expect(prompt).toContain('— Client Intake — Okafor · [01:02]');
    expect(prompt).toContain('— Witness Interview — Bale · [00:00] (file note)');
  });
});

describe('voxSessions — offline queue session routing', () => {
  it('routes kind "session" captures to the vox pipeline (source pin)', () => {
    const queue = readFileSync(join(root, 'src/services/voice/audioQueue.ts'), 'utf8');
    expect(queue).toContain('cap.kind === "session"');
    expect(queue).toContain('uploadVoxSegment({');
    expect(queue).toContain('finalizeVoxSession({');
    // The queue row carries the session context for offline finalizes.
    expect(queue).toContain('sessionMeta');
  });

  it('quick captures keep the untouched pipeline (zero regression pin)', () => {
    const queue = readFileSync(join(root, 'src/services/voice/audioQueue.ts'), 'utf8');
    expect(queue).toContain('await uploadSegment({');
    expect(queue).toContain('await finalizeCapture({');
  });

  it('the CaptureKind union gains exactly "session"', () => {
    const svc = readFileSync(join(root, 'src/services/voice/voiceCaptureService.ts'), 'utf8');
    expect(svc).toContain('export type CaptureKind = "quick" | "legalpad" | "session";');
  });
});

describe('voxSessions — landing band pins (the Vega Vox showcase)', () => {
  const read = (p: string) => readFileSync(join(root, p), 'utf8');

  it('VegaVox carries the four capability cards and the interactive preview', () => {
    const src = read('src/sites/vega/sections/VegaVox.tsx');
    expect(src).toContain('Instant legal dictation');
    expect(src).toContain('Speaker-labelled session capture');
    expect(src).toContain('File notes, action lists & issue maps');
    expect(src).toContain('Ask Aloa Vox across the matter');
    expect(src).toContain("id=\"vox\"");
    expect(src).toContain('Speaker transcript');
    expect(src).toContain('File note');
    expect(src).toContain('Action checklist');
  });

  it('VegaVox never says "new" or "beta" (core-feature framing)', () => {
    const src = read('src/sites/vega/sections/VegaVox.tsx');
    expect(/\bnew\b/i.test(src)).toBe(false);
    expect(/\bbeta\b/i.test(src)).toBe(false);
  });

  it('VegaVox keeps the honest tier line', () => {
    const src = read('src/sites/vega/sections/VegaVox.tsx');
    expect(src).toContain('Growth plan and above');
  });

  it('the Vega page mounts the Vox band between the suite and the practice band', () => {
    const idx = read('src/sites/vega/index.tsx');
    const suiteAt = idx.indexOf('<VegaSuite onSignup={openSignup} />');
    const voxAt = idx.indexOf('<VegaVox />');
    const whyAt = idx.indexOf('<VegaWhyNigeria />');
    expect(suiteAt).toBeGreaterThan(-1);
    expect(voxAt).toBeGreaterThan(suiteAt);
    expect(whyAt).toBeGreaterThan(voxAt);
    expect(idx).toContain("'home', 'suite', 'vox', 'practice-areas', 'pricing'");
  });

  it('the nav carries the Vox anchor (desktop + mobile)', () => {
    const shell = read('src/sites/vega/VegaShell.tsx');
    expect(shell).toContain("scrollTo('vox')");
    expect(shell).toContain('data-nav-id="vox"');
    expect(shell).toContain('>ALOA Vox</button>');
  });

  it('the suite bullet aligns with the dual-mode positioning', () => {
    const suite = read('src/sites/vega/sections/VegaSuite.tsx');
    expect(suite).toContain('ALOA Vox™ voice workspace');
    expect(suite).toContain('speaker-labelled transcripts, file notes, action lists and issue maps');
  });
});

/**
 * fieldDictationAndEndorsement — the pure logic behind Aloa Vox field
 * dictation and the endorsement formatter.
 *
 * Covers (owner brief 2026-11-25 / Antigravity audit follow-up):
 *   - extractWebmInitSegment: the WebM/Matroska EBML walk that cuts the
 *     first MediaRecorder chunk at the first Cluster, with hard guarantees —
 *     non-EBML blobs (Safari audio/mp4), empty blobs and truncated garbage
 *     return null (the caller falls back to whole-recording mode), and the
 *     split of a valid stream concatenates back to the exact original bytes
 *     (valid WebM is never corrupted).
 *   - buildBatchBlob: the periodic-batch assembler — the init segment is
 *     prepended, order preserved, type carried.
 *   - ENDORSEMENT_FORMAT_SYSTEM_PROMPT: the no-invention guardrails — filler
 *     is cleaned without ever adding dates, courts, coram or facts the
 *     lawyer did not dictate.
 */

import { describe, it, expect } from 'vitest';
import {
    extractWebmInitSegment,
    buildBatchBlob,
} from '../../src/utils/webmToWav';
import { ENDORSEMENT_FORMAT_SYSTEM_PROMPT } from '../../convex/voiceCapture';

// ─── Synthetic EBML construction helpers ───────────────────────────────────
// Realistic MediaRecorder first-chunk shape:
//   EBML header · Segment (unknown size) · Info · Tracks · Cluster(s)

const EBML_ID = [0x1a, 0x45, 0xdf, 0xa3];
const SEGMENT_ID = [0x18, 0x53, 0x80, 0x67];
const INFO_ID = [0x15, 0x49, 0xa9, 0x66];
const TRACKS_ID = [0x16, 0x54, 0xae, 0x6b];
const CLUSTER_ID = [0x1f, 0x43, 0xb6, 0x75];

/** 2-byte size vint (valid for payload sizes < 0x4000). */
function sizeVint(size: number): number[] {
    return [0x40 | (size >> 8), size & 0xff];
}

/** One EBML element: ID + size vint + payload. */
function element(id: number[], payload: number[]): number[] {
    return [...id, ...sizeVint(payload.length), ...payload];
}

/** 4-byte "unknown" size vint — the way MediaRecorder streams the Segment. */
const UNKNOWN_SIZE_4 = [0x1f, 0xff, 0xff, 0xff];

const ebmlHeader = element(EBML_ID, [0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]); // + "webm" DocType
const infoElement = element(INFO_ID, [0x2a, 0xd7, 0x81, 0xbf, 0x44, 0x88, 0x8a]); // TimecodeScale/Duration etc.
const tracksElement = element(TRACKS_ID, [0xae, 0x81, 0xa9, 0xd7, 0x81, 0x63, 0xc0]); // TrackEntry with Opus CodecID

function clusterPayload(seed: number): number[] {
    // Timecode + a SimpleBlock header — contents don't matter, only bytes.
    return [0xe7, 0x81, seed, 0xa3, 0x84, 0x00, 0x00, 0x80, seed, seed, seed, seed];
}

async function blobBytes(b: Blob): Promise<number[]> {
    return Array.from(new Uint8Array(await b.arrayBuffer()));
}

function toBlob(bytes: number[], type = 'audio/webm'): Blob {
    return new Blob([new Uint8Array(bytes)], { type });
}

// ─── extractWebmInitSegment ────────────────────────────────────────────────

describe('extractWebmInitSegment', () => {
    it('cuts a valid first chunk at the first Cluster and preserves every byte', async () => {
        const cluster1 = element(CLUSTER_ID, clusterPayload(1));
        const bytes = [
            ...ebmlHeader,
            ...SEGMENT_ID,
            ...UNKNOWN_SIZE_4,
            ...infoElement,
            ...tracksElement,
            ...cluster1,
        ];
        const blob = toBlob(bytes);

        const split = await extractWebmInitSegment(blob);
        expect(split).not.toBeNull();
        expect(split!.remainder).not.toBeNull();

        // The init segment is everything before the Cluster.
        expect(await blobBytes(split!.initSegment)).toEqual([
            ...ebmlHeader,
            ...SEGMENT_ID,
            ...UNKNOWN_SIZE_4,
            ...infoElement,
            ...tracksElement,
        ]);
        // The remainder is the Cluster onwards.
        expect(await blobBytes(split!.remainder!)).toEqual(cluster1);
        // CRITICAL: valid WebM is never corrupted — the pieces concatenate
        // back to the exact original stream.
        expect([
            ...(await blobBytes(split!.initSegment)),
            ...(await blobBytes(split!.remainder!)),
        ]).toEqual(bytes);
    });

    it('splits at the FIRST Cluster when several are present in one chunk', async () => {
        const c1 = element(CLUSTER_ID, clusterPayload(1));
        const c2 = element(CLUSTER_ID, clusterPayload(2));
        const bytes = [
            ...ebmlHeader,
            ...SEGMENT_ID,
            ...UNKNOWN_SIZE_4,
            ...infoElement,
            ...tracksElement,
            ...c1,
            ...c2,
        ];
        const split = await extractWebmInitSegment(toBlob(bytes));
        expect(split).not.toBeNull();
        expect(await blobBytes(split!.initSegment)).toEqual([
            ...ebmlHeader,
            ...SEGMENT_ID,
            ...UNKNOWN_SIZE_4,
            ...infoElement,
            ...tracksElement,
        ]);
        expect(await blobBytes(split!.remainder!)).toEqual([...c1, ...c2]);
    });

    it('supports Segments with a known (non-unknown) size header', async () => {
        const cluster1 = element(CLUSTER_ID, clusterPayload(9));
        const segmentPayload = [...infoElement, ...tracksElement, ...cluster1];
        const segmentSize = segmentPayload.length;
        const bytes = [...ebmlHeader, ...SEGMENT_ID, ...sizeVint(segmentSize), ...segmentPayload];
        const split = await extractWebmInitSegment(toBlob(bytes));
        expect(split).not.toBeNull();
        expect(await blobBytes(split!.remainder!)).toEqual(cluster1);
    });

    it('treats a header-only first chunk as pure init segment (remainder null)', async () => {
        // Recorders sometimes emit the init data and the first Cluster in
        // separate chunks — the whole chunk is the init segment then.
        const bytes = [...ebmlHeader, ...SEGMENT_ID, ...UNKNOWN_SIZE_4, ...infoElement, ...tracksElement];
        const split = await extractWebmInitSegment(toBlob(bytes));
        expect(split).not.toBeNull();
        expect(split!.remainder).toBeNull();
        expect(await blobBytes(split!.initSegment)).toEqual(bytes);
    });

    it('returns null for non-EBML blobs (Safari audio/mp4, ogg, random bytes)', async () => {
        const mp4 = toBlob([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 'audio/mp4');
        expect(await extractWebmInitSegment(mp4)).toBeNull();

        const ogg = toBlob([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02], 'audio/ogg');
        expect(await extractWebmInitSegment(ogg)).toBeNull();

        const random = toBlob([0x12, 0x34, 0x56, 0x78, 0x9a]);
        expect(await extractWebmInitSegment(random)).toBeNull();
    });

    it('returns null for empty and too-short blobs', async () => {
        expect(await extractWebmInitSegment(toBlob([]))).toBeNull();
        expect(await extractWebmInitSegment(toBlob([0x1a, 0x45, 0xdf, 0xa3]))).toBeNull();
    });

    it('returns null for garbage after a valid EBML magic (parse failure)', async () => {
        const garbage = toBlob([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        expect(await extractWebmInitSegment(garbage)).toBeNull();
    });

    it('returns null when no Cluster appears within the scan window of a larger blob', async () => {
        // > 8 KB of header-ish bytes with no Cluster — not a normal
        // MediaRecorder stream; the safe fallback (whole-recording mode)
        // must kick in rather than mis-splitting.
        const big = [...ebmlHeader, ...SEGMENT_ID, ...UNKNOWN_SIZE_4];
        while (big.length <= 9 * 1024) big.push(0x11);
        expect(await extractWebmInitSegment(toBlob(big))).toBeNull();
    });
});

// ─── buildBatchBlob ────────────────────────────────────────────────────────

describe('buildBatchBlob (the periodic-batch assembler)', () => {
    it('prepends the init segment ahead of Cluster-only chunks and preserves order', async () => {
        const initBytes = [...ebmlHeader, ...SEGMENT_ID, ...UNKNOWN_SIZE_4, ...infoElement, ...tracksElement];
        const init = toBlob(initBytes);
        const chunk1 = toBlob(element(CLUSTER_ID, clusterPayload(1)));
        const chunk2 = toBlob(element(CLUSTER_ID, clusterPayload(2)));

        const batch = buildBatchBlob(init, [chunk1, chunk2], 'audio/webm');
        expect(batch.type).toBe('audio/webm');
        expect(await blobBytes(batch)).toEqual([
            ...initBytes,
            ...element(CLUSTER_ID, clusterPayload(1)),
            ...element(CLUSTER_ID, clusterPayload(2)),
        ]);
    });

    it('passes the chunks through untouched when there is no init segment', async () => {
        const chunk = toBlob([0x01, 0x02, 0x03], 'audio/mp4');
        const batch = buildBatchBlob(null, [chunk], 'audio/mp4');
        expect(await blobBytes(batch)).toEqual([0x01, 0x02, 0x03]);
    });

    it('yields the init segment alone when no chunks remain', async () => {
        const init = toBlob([0x0a, 0x0b]);
        const batch = buildBatchBlob(init, [], 'audio/webm');
        expect(batch.size).toBe(2);
        expect(await blobBytes(batch)).toEqual([0x0a, 0x0b]);
    });
});

// ─── ENDORSEMENT_FORMAT_SYSTEM_PROMPT guardrails ────────────────────────────

describe('ENDORSEMENT_FORMAT_SYSTEM_PROMPT (no-invention guardrails)', () => {
    it('cleans filler without ever adding facts the lawyer did not say', () => {
        const p = ENDORSEMENT_FORMAT_SYSTEM_PROMPT;
        expect(p).toContain('NEVER add anything the note does not say');
        expect(p).toContain('no names, dates, amounts, courts, coram, case citations');
        expect(p).toContain('If the note mentions no date, no court and no amount, the formatted endorsement has none either');
    });

    it('freezes every dictated fact exactly as spoken', () => {
        const p = ENDORSEMENT_FORMAT_SYSTEM_PROMPT;
        expect(p).toContain('Keep every fact EXACTLY as dictated');
        expect(p).toContain('Do not "correct", normalise or paraphrase them into something else');
    });

    it('keeps the matter context reference-only — never a source of new content', () => {
        expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain('reference only');
        expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain('never copy anything from it into the endorsement');
    });

    it('returns only the formatted text, and never rewrites an already-clean note', () => {
        const p = ENDORSEMENT_FORMAT_SYSTEM_PROMPT;
        expect(p).toContain('Return ONLY the formatted endorsement text');
        expect(p).toContain('If the note is already clean, return it unchanged');
    });

    it('preserves Nigerian English spellings', () => {
        expect(ENDORSEMENT_FORMAT_SYSTEM_PROMPT).toContain('Nigerian English spellings');
    });
});

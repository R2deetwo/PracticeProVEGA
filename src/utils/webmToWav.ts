/**
 * webmToWav — converts an audio Blob (typically audio/webm from MediaRecorder)
 * to a WAV Blob (PCM 16-bit, mono) that Gemini's inline-data API can process.
 *
 * FIXES:
 * 1. Reuses a shared AudioContext instead of creating a new one per call
 *    (browsers cap at ~6 concurrent AudioContext instances)
 * 2. Adds a 15-second timeout to decodeAudioData (prevents indefinite hang
 *    on malformed webm chunks)
 * 3. Properly closes the AudioContext on error
 *
 * A1 (2026-10-07): output is downsampled to 16 kHz mono. Speech energy lives
 * below 8 kHz, so 16 kHz (Nyquist 8 kHz) loses nothing for ASR — while cutting
 * the payload ~3x vs the browser's native 48 kHz. Smaller base64 bodies mean
 * faster Convex proxy round-trips for the 10-second dictation chunks and the
 * NoteEditor AI-audio fallback. Source rates at or below 16 kHz pass through
 * untouched (never upsampled).
 *
 * PERIODIC CHUNKING (2026-11-25): extractWebmInitSegment + buildBatchBlob
 * support the ~10s periodic-transcription engines (useFieldDictation,
 * NoteEditor, SaveToNoteForm). MediaRecorder.start(1000) emits the WebM
 * header + Info + Tracks ONLY in the first chunk; every later chunk is
 * Cluster-only and is NOT decodable on its own — decoding a mid-take batch
 * used to fail with "Transcription error" (and then a false "No speech
 * detected") after the first successful periodic drain. The fix: split the
 * first chunk once (init segment + cluster tail) and prepend that init
 * segment to every later batch.
 */

// Target sample rate for ASR payloads — see header note.
const ASR_SAMPLE_RATE = 16000;

// How far into the first chunk we scan for the first Cluster. Real WebM
// init segments (EBML header + SeekHead + Info + Tracks, Opus audio) are
// well under 1 KB; 8 KB is generous. If no Cluster appears within this
// window the blob is not a normal MediaRecorder stream — bail (null).
const MAX_INIT_SCAN_BYTES = 8 * 1024;

// EBML element IDs we care about (already vint-encoded byte sequences).
const EBML_HEADER_ID = 0x1a45dfa3; // [1A 45 DF A3]
const SEGMENT_ID = 0x18538067; // [18 53 80 67]
const CLUSTER_ID = 0x1f43b675; // [1F 43 B6 75]

// Shared AudioContext — reused across all convertBlobToWav calls
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
        sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return sharedAudioContext;
}

export async function convertBlobToWav(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = getAudioContext();

    // Add a 15-second timeout to decodeAudioData — prevents indefinite hang
    // on malformed/partial webm chunks from MediaRecorder
    const decodePromise = audioContext.decodeAudioData(arrayBuffer);
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('decodeAudioData timed out after 15s')), 15000);
    });

    let audioBuffer: AudioBuffer;
    try {
        audioBuffer = await Promise.race([decodePromise, timeoutPromise]);
    } catch (err) {
        // If decode fails, try with a fresh AudioContext (sometimes the
        // shared context gets into a bad state). CRITICAL: the first
        // decodeAudioData call DETACHES the ArrayBuffer it was handed —
        // re-passing the same object throws. The retry re-reads a FRESH
        // copy from the source Blob (Blob.arrayBuffer() always copies).
        try { audioContext.close(); } catch {}
        sharedAudioContext = null;
        const freshContext = getAudioContext();
        const freshBuffer = await blob.arrayBuffer();
        audioBuffer = await Promise.race([
            freshContext.decodeAudioData(freshBuffer),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('decodeAudioData timed out (retry)')), 10000);
            }),
        ]);
    }

    // Convert to mono (mix channels if stereo)
    const numChannels = audioBuffer.numberOfChannels;
    const sourceRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const monoData = new Float32Array(length);

    for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            monoData[i] += channelData[i] / numChannels;
        }
    }

    // ─── A1: downsample to 16 kHz for ASR (see header) ─────────────────
    // Linear-interpolation resampler. Only runs when the source rate is
    // ABOVE the target; 8/16 kHz sources pass through at their native rate
    // (never upsampled — upsampling only bloats the payload).
    const targetRate = sourceRate > ASR_SAMPLE_RATE ? ASR_SAMPLE_RATE : sourceRate;
    let resampled: Float32Array = monoData;
    if (targetRate !== sourceRate) {
        const outLength = Math.max(1, Math.floor((length * targetRate) / sourceRate));
        resampled = new Float32Array(outLength);
        const step = sourceRate / targetRate;
        for (let i = 0; i < outLength; i++) {
            const srcPos = i * step;
            const i0 = Math.floor(srcPos);
            const i1 = Math.min(i0 + 1, length - 1);
            const frac = srcPos - i0;
            resampled[i] = monoData[i0] * (1 - frac) + monoData[i1] * frac;
        }
    }

    // Convert Float32 (-1.0 to 1.0) to Int16 PCM
    const pcmData = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
        const s = Math.max(-1, Math.min(1, resampled[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Build WAV file (at the ASR rate, not the browser's native rate)
    const wavBuffer = encodeWav(pcmData, targetRate);
    return new Blob([wavBuffer], { type: 'audio/wav' });
}

/** Close the shared AudioContext — call when the notetaker stops recording */
export function closeAudioContext(): void {
    if (sharedAudioContext) {
        try { sharedAudioContext.close(); } catch {}
        sharedAudioContext = null;
    }
}

// ─── PERIODIC CHUNKING SUPPORT ─────────────────────────────────────────────

/** One parsed EBML element header (ID vint + size vint). */
interface EbmlElementHead {
    /** Element ID including its marker bits (e.g. 0x1f43b675 = Cluster). */
    id: number;
    /** Payload byte size; -1 = "unknown" (all-ones size vint, streamed files). */
    size: number;
    /** Offset where the payload starts (after both vints). */
    dataStart: number;
    /** Offset just past the payload = dataStart + size (invalid when -1). */
    end: number;
}

/** Read an unsigned vint (value bits only, marker cleared) at `pos`. */
function readVintValue(bytes: Uint8Array, pos: number): { value: number; length: number } | null {
    if (pos >= bytes.length) return null;
    const first = bytes[pos];
    let length = 1;
    for (let mask = 0x80; mask > 0; mask >>= 1) {
        if (first & mask) break;
        length++;
        if (length > 8) return null; // invalid vint
    }
    if (pos + length > bytes.length) return null; // truncated vint
    let value = first & (0xff >> length);
    for (let i = 1; i < length; i++) {
        value = value * 256 + bytes[pos + i];
    }
    return { value, length };
}

/** Read an element ID vint at `pos` — value KEEPS the marker bits, per the
 *  Matroska ID convention (Cluster = 0x1f43b675, not 0x0f43b675). */
function readElementId(bytes: Uint8Array, pos: number): { id: number; length: number } | null {
    if (pos >= bytes.length) return null;
    const first = bytes[pos];
    let length = 1;
    for (let mask = 0x80; mask > 0; mask >>= 1) {
        if (first & mask) break;
        length++;
        if (length > 8) return null;
    }
    if (pos + length > bytes.length) return null;
    let id = first;
    for (let i = 1; i < length; i++) {
        id = id * 256 + bytes[pos + i];
    }
    return { id, length };
}

/** Parse one element header at `pos` (ID + size). */
function readElementHead(bytes: Uint8Array, pos: number): EbmlElementHead | null {
    const idv = readElementId(bytes, pos);
    if (!idv) return null;
    const sizePos = pos + idv.length;
    const sizev = readVintValue(bytes, sizePos);
    if (!sizev) return null;
    const dataStart = sizePos + sizev.length;
    // "Unknown" size: every value bit set (streamed elements, e.g. Segment).
    const maxForLength = Math.pow(2, 8 * sizev.length - sizev.length) - 1;
    const size = sizev.value === maxForLength ? -1 : sizev.value;
    return { id: idv.id, size, dataStart, end: dataStart + size };
}

/** The split of a WebM first chunk: everything before the first Cluster
 *  (the "init segment") and the Cluster tail that follows it. */
export interface WebmInitSplit {
    initSegment: Blob;
    /** The first Cluster onward of the scanned chunk; null when the chunk
     *  contained no Cluster at all (a header-only first chunk). */
    remainder: Blob | null;
}

/**
 * extractWebmInitSegment — locate the WebM/Matroska initialization data
 * (EBML header + Segment header + Info + Tracks) that precedes the first
 * Cluster (0x1F43B675) in a MediaRecorder blob.
 *
 * Returns null when the blob is empty, too short, not EBML at all
 * (audio/mp4 from Safari/iOS, audio/ogg, random bytes) or unparseable —
 * callers must then fall back to whole-recording mode (no periodic slicing).
 * Valid WebM is never corrupted: the returned pieces concatenate back to
 * the exact original bytes.
 */
export async function extractWebmInitSegment(blob: Blob): Promise<WebmInitSplit | null> {
    if (!blob || blob.size === 0) return null;
    const scanLength = Math.min(blob.size, MAX_INIT_SCAN_BYTES);
    const head = new Uint8Array(await blob.slice(0, scanLength).arrayBuffer());

    // Magic must be the EBML header ID 0x1A45DFA3 — anything else is not a
    // Matroska/WebM stream (mp4 starts with a size + "ftyp", ogg "OggS").
    if (head.length < 8) return null;
    if (head[0] !== 0x1a || head[1] !== 0x45 || head[2] !== 0xdf || head[3] !== 0xa3) {
        return null;
    }

    let pos = 0;
    // 1) EBML header element — verify and skip it whole.
    const ebmlHead = readElementHead(head, pos);
    if (!ebmlHead || ebmlHead.id !== EBML_HEADER_ID || ebmlHead.size < 0 || ebmlHead.end > head.length) {
        return null;
    }
    pos = ebmlHead.end;

    // 2) Segment element — consume its header, then descend into it even
    //    when the size is "unknown" (MediaRecorder streams it that way).
    const segment = readElementHead(head, pos);
    if (!segment || segment.id !== SEGMENT_ID) return null;
    pos = segment.dataStart;

    // 3) Walk the Segment children until the first Cluster.
    let clusterStart = -1;
    while (pos < head.length) {
        const child = readElementHead(head, pos);
        if (!child) break; // truncated header — stop scanning
        if (child.id === CLUSTER_ID) {
            clusterStart = pos;
            break;
        }
        if (child.size < 0 || child.end > head.length) break; // can't skip past an unknown/huge child
        pos = child.end;
    }

    if (clusterStart >= 0) {
        return {
            initSegment: blob.slice(0, clusterStart),
            remainder: blob.slice(clusterStart),
        };
    }

    // No Cluster found. If we scanned the ENTIRE chunk it is a header-only
    // first chunk (recorders sometimes emit init and the first cluster in
    // separate chunks) — the whole blob is the init segment.
    if (scanLength === blob.size) {
        return { initSegment: blob.slice(0), remainder: null };
    }

    // No Cluster within the scan window of a larger blob — not a normal
    // MediaRecorder stream; bail to the safe fallback.
    return null;
}

/**
 * buildBatchBlob — assemble one decodable batch: [initSegment, ...chunks]
 * when an init segment was captured, or the chunks alone (the first batch
 * of a take already carries its own header). Order is preserved.
 */
export function buildBatchBlob(initSegment: Blob | null, chunks: Blob[], mimeType: string): Blob {
    const parts: BlobPart[] = initSegment ? [initSegment, ...chunks] : [...chunks];
    return new Blob(parts, { type: mimeType });
}

function encodeWav(samples: Int16Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        view.setInt16(offset, samples[i], true);
    }

    return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

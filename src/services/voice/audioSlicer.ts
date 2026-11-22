/**
 * audioSlicer — decode an uploaded audio file into 16 kHz mono WAV segment
 * blobs (≤60 s each) so an uploaded recording flows through the SAME Vox
 * session pipeline as a live mic recording (owner spec 2026-11-22: "Support
 * recording or uploading audio for longer legal workflows").
 *
 * Reuses webmToWav's shared-AudioContext discipline (browsers cap at ~6
 * concurrent contexts) with its own decode+encode pass so one uploaded file
 * becomes N timestamped segments instead of one giant payload (the backend
 * caps a single segment at ~4 MB / 5 min).
 */

import { closeAudioContext } from "../../utils/webmToWav";

const ASR_SAMPLE_RATE = 16000;
/** Segment length for uploaded audio — matches the live recorder's slice. */
const SEGMENT_MS = 60_000;
/** Hard cap on ONE uploaded file (2 hours) — honest, generous, bounded. */
const MAX_UPLOAD_MS = 2 * 60 * 60 * 1000;

function getAudioContext(): AudioContext {
    const w = window as any;
    return new (w.AudioContext || w.webkitAudioContext)();
}

export interface SlicedSegment {
    /** WAV blob for this slice (16 kHz mono PCM). */
    blob: Blob;
    startMs: number;
    endMs: number;
}

export interface SliceResult {
    segments: SlicedSegment[];
    durationMs: number;
    tooLong: boolean;
}

/**
 * Decode an audio File (any browser-supported container) and slice it into
 * WAV segment blobs. Never throws for decode failures alone — the caller
 * decides; a decode failure rejects the promise with a plain message.
 */
export async function sliceAudioFileToSegments(file: Blob): Promise<SliceResult> {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = getAudioContext();
    let audioBuffer: AudioBuffer;
    try {
        audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
            const p = (ctx as any).decodeAudioData(arrayBuffer, resolve, reject);
            // Modern promise form (Chrome/Firefox) + legacy callback form.
            if (p && typeof p.then === "function") p.then(resolve, reject);
        });
    } catch {
        throw new Error(
            "This audio file could not be decoded. Use MP3, M4A, WAV or the recorded session file."
        );
    } finally {
        try { ctx.close(); } catch { /* already closed */ }
    }

    const durationMs = Math.round(audioBuffer.duration * 1000);
    if (durationMs < 400) throw new Error("That file is too short to be a session.");
    const tooLong = durationMs > MAX_UPLOAD_MS;

    // Mono mixdown.
    const numChannels = audioBuffer.numberOfChannels;
    const sourceRate = audioBuffer.sampleRate;
    const length = Math.min(audioBuffer.length, Math.ceil((tooLong ? MAX_UPLOAD_MS : durationMs) / 1000) * sourceRate);
    const monoData = new Float32Array(length);
    for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) monoData[i] += channelData[i] / numChannels;
    }

    // Downsample to 16 kHz (linear interpolation — same as webmToWav).
    const targetRate = sourceRate > ASR_SAMPLE_RATE ? ASR_SAMPLE_RATE : sourceRate;
    let resampled: Float32Array;
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
    } else {
        resampled = monoData;
    }

    // Slice the resampled PCM into ≤60 s WAV blobs.
    const samplesPerSegment = Math.floor((SEGMENT_MS / 1000) * targetRate);
    const segments: SlicedSegment[] = [];
    for (let start = 0; start < resampled.length; start += samplesPerSegment) {
        const slice = resampled.subarray(start, Math.min(start + samplesPerSegment, resampled.length));
        const pcm = new Int16Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            const s = Math.max(-1, Math.min(1, slice[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        segments.push({
            blob: new Blob([encodeWav(pcm, targetRate)], { type: "audio/wav" }),
            startMs: Math.round((start / targetRate) * 1000),
            endMs: Math.round(((start + slice.length) / targetRate) * 1000),
        });
    }
    return { segments, durationMs, tooLong };
}

function encodeWav(samples: Int16Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        view.setInt16(offset, samples[i], true);
    }
    return buffer;
}

/** Re-export so callers can free the shared context when idle. */
export { closeAudioContext };

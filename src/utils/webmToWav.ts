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
 */

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
        // shared context gets into a bad state)
        try { audioContext.close(); } catch {}
        sharedAudioContext = null;
        const freshContext = getAudioContext();
        audioBuffer = await Promise.race([
            freshContext.decodeAudioData(arrayBuffer),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('decodeAudioData timed out (retry)')), 10000);
            }),
        ]);
    }

    // Convert to mono (mix channels if stereo)
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const monoData = new Float32Array(length);

    for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            monoData[i] += channelData[i] / numChannels;
        }
    }

    // Convert Float32 (-1.0 to 1.0) to Int16 PCM
    const pcmData = new Int16Array(length);
    for (let i = 0; i < length; i++) {
        const s = Math.max(-1, Math.min(1, monoData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Build WAV file
    const wavBuffer = encodeWav(pcmData, sampleRate);
    return new Blob([wavBuffer], { type: 'audio/wav' });
}

/** Close the shared AudioContext — call when the notetaker stops recording */
export function closeAudioContext(): void {
    if (sharedAudioContext) {
        try { sharedAudioContext.close(); } catch {}
        sharedAudioContext = null;
    }
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

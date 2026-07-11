/**
 * webmToWav — converts an audio Blob (typically audio/webm from MediaRecorder)
 * to a WAV Blob (PCM 16-bit, mono) that Gemini's inline-data API can process.
 *
 * Gemini's generateContent API with inlineData does NOT support audio/webm.
 * It only accepts: audio/wav, audio/mp3, audio/aiff, audio/aac, audio/ogg,
 * audio/flac, audio/m4a. Since browsers default to audio/webm via
 * MediaRecorder, we must convert before sending.
 */
export async function convertBlobToWav(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioContext.close();

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

function encodeWav(samples: Int16Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);          // chunk size
    view.setUint16(20, 1, true);           // audio format (PCM)
    view.setUint16(22, 1, true);           // num channels (mono)
    view.setUint32(24, sampleRate, true);  // sample rate
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true);           // block align
    view.setUint16(34, 16, true);          // bits per sample

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write PCM samples
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

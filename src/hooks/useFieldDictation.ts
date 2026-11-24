/**
 * useFieldDictation — dictate straight into a text field (one engine, many
 * surfaces). Owner brief 2026-11-24: "when you say post endorsement… we
 * should have the ability to use Aloa Vox" — the matter endorsement composer
 * (and any other text field that adopts this hook) gets a mic button that
 * records, transcribes through the same backend provider chain (Whisper →
 * Gemini, api.voiceCapture.transcribeBatch — no storage row, no capture
 * pipeline) and APPENDS the words into the field's own state.
 *
 * The engine is lifted verbatim from the battle-tested SaveToNoteForm
 * dictation block (periodic 10s transcription, append-not-overwrite,
 * continuation-tail seam healing, mic permission inside the user gesture,
 * shared mic stream claim via micStream.ts). Differences:
 *   - the field's value lives in the CALLER (onAppend merges text);
 *   - a session-lock heartbeat keeps the idle countdown alive mid-take;
 *   - stampVoxUsedAt() marks the launch for the 7-day Overview-card rule.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireMicStream, releaseMicStream } from '../services/voice/micStream';
import { transcribeBatch, blobToBase64 } from '../services/voice/voiceCaptureService';
import { convertBlobToWav } from '../utils/webmToWav';
import { requestMicrophonePermission, getMicrophoneErrorMessage } from '../utils/microphonePermission';
import { markUserActivity } from './useIdleTimer';
import { stampVoxUsedAt } from '../utils/voxUsageTracking';

export type DictationStatus = 'idle' | 'connecting' | 'listening' | 'processing';

export interface UseFieldDictationOptions {
    /** Merge one transcribed chunk into the field's state (append, never
     *  overwrite — the caller owns the full value). */
    onAppend: (text: string) => void;
    /** Toast/error surface — receives human-readable failure copy. */
    onError: (message: string, opts?: { type?: 'error' | 'info' }) => void;
}

export interface FieldDictation {
    isRecording: boolean;
    status: DictationStatus;
    elapsedSeconds: number;
    voiceEnergy: number;
    supported: boolean;
    /** Toggle record/stop. Safe to call repeatedly. */
    toggle: () => void;
}

export function useFieldDictation({ onAppend, onError }: UseFieldDictationOptions): FieldDictation {
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState<DictationStatus>('idle');
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [voiceEnergy, setVoiceEnergy] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const activeMimeRef = useRef('audio/webm');
    const isRecordingRef = useRef(false);
    const tailRef = useRef(''); // continuation tail — heals 10s chunk seams
    const timerRef = useRef<number | null>(null);
    const periodicRef = useRef<number | null>(null);
    const heartbeatRef = useRef<number | null>(null);
    const processingRef = useRef(false);
    const energyRafRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const onAppendRef = useRef(onAppend);
    const onErrorRef = useRef(onError);
    onAppendRef.current = onAppend;
    onErrorRef.current = onError;

    const supported = typeof window !== 'undefined' &&
        typeof window.MediaRecorder !== 'undefined';

    /** Transcribe blobs → append. Mirrors SaveToNoteForm: <500 bytes = noise. */
    const processChunks = useCallback(async (blobs: Blob[]): Promise<string> => {
        if (blobs.length === 0) return '';
        const totalSize = blobs.reduce((s, b) => s + b.size, 0);
        if (totalSize < 500) return '';
        setStatus('processing');
        try {
            const wavBlob = await convertBlobToWav(new Blob(blobs, { type: activeMimeRef.current }));
            const base64Audio = await blobToBase64(wavBlob);
            const { text } = await transcribeBatch({
                audioBase64: base64Audio,
                continuationTail: tailRef.current || undefined,
            });
            if (text && text.trim()) {
                tailRef.current = text.trim().split(/\s+/).slice(-10).join(' ');
                onAppendRef.current(text.trim());
                return text;
            }
            return '';
        } catch (err: any) {
            console.error('[useFieldDictation] transcription failed:', err);
            onErrorRef.current(
                `Transcription error: ${err?.message || 'unknown'}. Check your connection and AI settings.`,
                { type: 'error' }
            );
            return '';
        } finally {
            setStatus(isRecordingRef.current ? 'listening' : 'idle');
        }
    }, []);

    const start = useCallback(async () => {
        let claimed = false;
        try {
            const granted = await requestMicrophonePermission();
            if (!granted) {
                onErrorRef.current(
                    'Microphone access denied. On the app, go to Settings → Apps → PracticePro → Permissions → Microphone → Allow. On web, click the mic icon in your browser\'s address bar.',
                    { type: 'error' }
                );
                return;
            }
            const stream = await acquireMicStream();
            claimed = true;

            // Visualizer (energy for the pulsing mic).
            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
            const context = new AudioContextClass();
            const analyser = context.createAnalyser();
            context.createMediaStreamSource(stream).connect(analyser);
            analyser.fftSize = 256;
            audioCtxRef.current = context;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateEnergy = () => {
                if (!analyser) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                setVoiceEnergy(Math.min(100, (sum / dataArray.length) * 2));
                energyRafRef.current = requestAnimationFrame(updateEnergy);
            };
            updateEnergy();

            let mimeType = 'audio/webm';
            if (!MediaRecorder.isTypeSupported('audio/webm')) {
                if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
                else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
                else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
            }
            activeMimeRef.current = mimeType;
            tailRef.current = '';

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            recorder.onstop = () => {
                // Final drain — always processed (the periodic guard never
                // blocks the final take).
                const finalChunks = audioChunksRef.current;
                audioChunksRef.current = [];
                releaseMicStream();
                const totalSize = finalChunks.reduce((s, b) => s + b.size, 0);
                if (totalSize < 500) {
                    onErrorRef.current(
                        'Recording was too short — hold the mic button and speak for at least 2 seconds.',
                        { type: 'info' }
                    );
                    setStatus('idle');
                    return;
                }
                processChunks(finalChunks).then((text) => {
                    if (!text) {
                        onErrorRef.current(
                            'No speech detected in the recording. Try speaking louder or closer to the microphone.',
                            { type: 'info' }
                        );
                    }
                });
            };

            recorder.start(1000);
            isRecordingRef.current = true;
            setIsRecording(true);
            setStatus('listening');
            setElapsedSeconds(0);
            stampVoxUsedAt(); // the 7-day Overview-card rule

            timerRef.current = window.setInterval(() => {
                setElapsedSeconds((s) => (s < 600 ? s + 1 : s));
            }, 1000);
            // Near-live feel: transcribe the accumulated chunks every 10s.
            periodicRef.current = window.setInterval(async () => {
                if (processingRef.current) return;
                if (mediaRecorderRef.current?.state === 'recording' && audioChunksRef.current.length > 0) {
                    processingRef.current = true;
                    try {
                        const chunks = audioChunksRef.current;
                        audioChunksRef.current = [];
                        await processChunks(chunks);
                    } finally {
                        processingRef.current = false;
                    }
                }
            }, 10000);
            // Session-lock heartbeat — a take with no taps is still activity.
            markUserActivity();
            heartbeatRef.current = window.setInterval(markUserActivity, 30_000);
        } catch (err: any) {
            if (claimed) releaseMicStream();
            console.error('[useFieldDictation] recording engine failed:', err);
            onErrorRef.current(getMicrophoneErrorMessage(err), { type: 'error' });
            setIsRecording(false);
            isRecordingRef.current = false;
            setStatus('idle');
        }
    }, [processChunks]);

    const stop = useCallback(() => {
        // Clear the periodic interval FIRST so it doesn't race the final onstop.
        if (periodicRef.current) { clearInterval(periodicRef.current); periodicRef.current = null; }
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
        if (energyRafRef.current) { cancelAnimationFrame(energyRafRef.current); energyRafRef.current = null; }
        if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch { /* already closed */ } }
        audioCtxRef.current = null;
        setVoiceEnergy(0);
        isRecordingRef.current = false;
        setIsRecording(false);
        setStatus('idle');
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    const toggle = useCallback(() => {
        if (isRecordingRef.current) { stop(); return; }
        void start();
    }, [start, stop]);

    // A1 hygiene: if the field unmounts mid-dictation, release the mic.
    useEffect(() => () => {
        if (isRecordingRef.current) stop();
    }, [stop]);

    return { isRecording, status, elapsedSeconds, voiceEnergy, supported, toggle };
}

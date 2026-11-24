/**
 * useFieldDictation — dictate straight into a text field (one engine, many
 * surfaces). Owner brief 2026-11-24: "when you say post endorsement… we
 * should have the ability to use Aloa Vox" — the matter endorsement composer
 * (and any other text field that adopts this hook) gets a mic button that
 * records, transcribes through the same backend provider chain (Whisper →
 * Gemini, api.voiceCapture.transcribeBatch — no storage row, no capture
 * pipeline) and APPENDS the words into the field's own state.
 *
 * The engine is lifted from the SaveToNoteForm dictation block (periodic 10s
 * transcription, append-not-overwrite, continuation-tail seam healing, mic
 * permission inside the user gesture, shared mic stream claim via
 * micStream.ts). Differences:
 *   - the field's value lives in the CALLER (onAppend merges text);
 *   - a session-lock heartbeat keeps the idle countdown alive mid-take;
 *   - stampVoxUsedAt() marks the launch for the 7-day Overview-card rule.
 *
 * WEBM INIT SEGMENT (2026-11-25): MediaRecorder.start(1000) puts the WebM
 * header + Info + Tracks ONLY in the first chunk; later chunks are
 * Cluster-only and are NOT independently decodable. The first chunk is split
 * once (extractWebmInitSegment); its init segment is prepended to EVERY
 * later periodic batch AND the final onstop drain, so mid-take batches stop
 * failing decode with "Transcription error" + a false "No speech detected"
 * after the first successful drain. Non-WebM recorders (audio/mp4 Safari /
 * iOS, audio/ogg, exotic Android codecs) get no init segment — periodic
 * slicing is disabled for them and the whole take transcribes once at stop
 * (a complete, self-contained stream). A take that already streamed text is
 * never nagged with "too short"/"No speech detected" toasts on its final
 * drain. onFinish fires once per user-initiated stop AFTER the final drain
 * settles — the unmount release never triggers caller side effects.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireMicStream, releaseMicStream } from '../services/voice/micStream';
import { transcribeBatch, blobToBase64 } from '../services/voice/voiceCaptureService';
import { convertBlobToWav, extractWebmInitSegment, buildBatchBlob, WebmInitSplit } from '../utils/webmToWav';
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
    /** Called ONCE after the final drain settles on a USER-initiated stop
     *  (never for the unmount release). `appended` = at least one periodic
     *  or final chunk landed words in the field. Surfaces use it to run
     *  post-take work (e.g. auto-formatting the dictated endorsement). */
    onFinish?: (result: { appended: boolean }) => void;
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

export function useFieldDictation({ onAppend, onError, onFinish }: UseFieldDictationOptions): FieldDictation {
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
    const onFinishRef = useRef(onFinish);
    onAppendRef.current = onAppend;
    onErrorRef.current = onError;
    onFinishRef.current = onFinish;

    // WebM init-segment state (see header note).
    const initSegmentRef = useRef<Blob | null>(null);
    const initSplitPromiseRef = useRef<Promise<WebmInitSplit | null> | null>(null);
    /** null = undetermined · true = WebM batches prepend the init segment ·
     *  false = non-WebM recorder — accumulate everything, transcribe once. */
    const chunkedModeRef = useRef<boolean | null>(null);
    /** True once ANY chunk's words landed in the field — gates the
     *  "too short"/"No speech detected" toasts on the final drain. */
    const appendedAnyRef = useRef(false);
    /** Why recording stopped — onFinish fires only for 'user'. */
    const stopReasonRef = useRef<'user' | 'unmount'>('user');

    const supported = typeof window !== 'undefined' &&
        typeof window.MediaRecorder !== 'undefined';

    /** Transcribe blobs → append. Mirrors SaveToNoteForm: <500 bytes = noise.
     *  The batch is assembled with the captured init segment prepended. */
    const processChunks = useCallback(async (blobs: Blob[]): Promise<string> => {
        if (blobs.length === 0) return '';
        const totalSize = blobs.reduce((s, b) => s + b.size, 0);
        if (totalSize < 500) return '';
        setStatus('processing');
        try {
            const batchBlob = buildBatchBlob(initSegmentRef.current, blobs, activeMimeRef.current);
            const wavBlob = await convertBlobToWav(batchBlob);
            const base64Audio = await blobToBase64(wavBlob);
            const { text } = await transcribeBatch({
                audioBase64: base64Audio,
                continuationTail: tailRef.current || undefined,
            });
            if (text && text.trim()) {
                appendedAnyRef.current = true;
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
            initSegmentRef.current = null;
            initSplitPromiseRef.current = null;
            chunkedModeRef.current = null;
            appendedAnyRef.current = false;

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size === 0) return;
                audioChunksRef.current.push(event.data);
                // FIRST chunk: split into the init segment + Cluster tail,
                // exactly once. The stored init segment is prepended to every
                // later batch; the raw first chunk is replaced by its tail so
                // the audio it carries is never duplicated.
                if (!initSplitPromiseRef.current) {
                    initSplitPromiseRef.current = extractWebmInitSegment(event.data)
                        .then((split) => {
                            if (split) {
                                initSegmentRef.current = split.initSegment;
                                chunkedModeRef.current = true;
                                if (split.remainder) {
                                    audioChunksRef.current = [
                                        split.remainder,
                                        ...audioChunksRef.current.slice(1),
                                    ];
                                } else {
                                    // header-only first chunk — the init IS it.
                                    audioChunksRef.current = audioChunksRef.current.slice(1);
                                }
                            } else {
                                // Non-WebM (mp4/ogg) or unparseable — whole-
                                // recording mode: periodic slicing disabled.
                                chunkedModeRef.current = false;
                            }
                            return split;
                        })
                        .catch(() => {
                            chunkedModeRef.current = false;
                            return null;
                        });
                }
            };

            recorder.onstop = () => {
                // Final drain — always processed (the periodic guard never
                // blocks the final take).
                const finalChunks = audioChunksRef.current;
                audioChunksRef.current = [];
                releaseMicStream();
                void (async () => {
                    // The first-chunk split must be settled before the final
                    // batch is assembled (same reason as the periodic tick).
                    try { await initSplitPromiseRef.current; } catch { /* fallback already set */ }
                    const totalSize = finalChunks.reduce((s, b) => s + b.size, 0);
                    const appendedBefore = appendedAnyRef.current;
                    if (totalSize < 500) {
                        // A take that already streamed its words is NOT
                        // "too short" — never nag after partial transcription.
                        if (!appendedBefore) {
                            onErrorRef.current(
                                'Recording was too short — hold the mic button and speak for at least 2 seconds.',
                                { type: 'info' }
                            );
                        }
                        setStatus('idle');
                    } else {
                        const text = await processChunks(finalChunks);
                        // Only claim "No speech detected" when NOTHING ever
                        // landed — earlier periodic drains make it false.
                        if (!text && !appendedBefore) {
                            onErrorRef.current(
                                'No speech detected in the recording. Try speaking louder or closer to the microphone.',
                                { type: 'info' }
                            );
                        }
                    }
                    // User-initiated stop → the caller may now run its
                    // post-take work (e.g. formatting the endorsement).
                    if (stopReasonRef.current === 'user') {
                        onFinishRef.current?.({ appended: appendedAnyRef.current });
                    }
                })();
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
            // Near-live feel: transcribe the accumulated chunks every 10s —
            // WebM-only (init segment prepended); non-WebM recorders keep
            // accumulating and transcribe once at stop.
            periodicRef.current = window.setInterval(async () => {
                if (processingRef.current) return;
                if (chunkedModeRef.current === false) return;
                if (mediaRecorderRef.current?.state === 'recording' && audioChunksRef.current.length > 0) {
                    processingRef.current = true;
                    try {
                        await initSplitPromiseRef.current;
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

    const stop = useCallback((opts?: { reason?: 'user' | 'unmount' }) => {
        stopReasonRef.current = opts?.reason === 'unmount' ? 'unmount' : 'user';
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

    // A1 hygiene: if the field unmounts mid-dictation, release the mic —
    // silently (no onFinish side effects for a surface the user left).
    useEffect(() => () => {
        if (isRecordingRef.current) stop({ reason: 'unmount' });
    }, [stop]);

    return { isRecording, status, elapsedSeconds, voiceEnergy, supported, toggle };
}

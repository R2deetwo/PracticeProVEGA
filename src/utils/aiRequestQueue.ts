/**
 * AI Request Queue — Deterministic sequential processing
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Problem being solved:
 *   Concurrent, un-throttled API calls create race conditions in the UI
 *   state mapping. Response to Question 1 may print only after Question 2
 *   is sent, or the UI may freeze/crash post-submission on mobile.
 *
 * Solution:
 *   A strict sequential processing loop. If a request is pending, all
 *   subsequent user inputs sit in a local queue. Task N+1 CANNOT fire
 *   until Task N completely resolves (success) or catches (error).
 *
 * Features:
 *   - Strict FIFO ordering (no parallel AI calls)
 *   - 15-second AbortController timeout per request
 *   - API key pre-flight validation before any network payload
 *   - Graceful error propagation per task
 */

export interface QueuedTask<T> {
    id: string;
    execute: (signal: AbortSignal) => Promise<T>;
    onSuccess: (result: T) => void;
    onError: (error: Error) => void;
}

interface InternalTask<T> extends QueuedTask<T> {
    controller: AbortController;
    timeoutId: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * AIRequestQueue — a self-contained sequential queue.
 *
 * Usage:
 *   const queue = new AIRequestQueue();
 *   queue.enqueue({
 *     id: uuid(),
 *     execute: async (signal) => { return await fetchAI(signal); },
 *     onSuccess: (result) => { /* update UI *\/ },
 *     onError: (err) => { /* show error card *\/ },
 *   });
 */
export class AIRequestQueue {
    private queue: InternalTask<any>[] = [];
    private processing = false;
    private timeoutMs: number;

    constructor(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
        this.timeoutMs = timeoutMs;
    }

    /** True if a request is currently being processed. */
    get isProcessing(): boolean {
        return this.processing;
    }

    /** Number of tasks waiting in the queue. */
    get pendingCount(): number {
        return this.queue.length;
    }

    /**
     * Enqueue a task for sequential processing.
     * Returns a promise that resolves/rejects when the task completes.
     */
    enqueue<T>(task: QueuedTask<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, this.timeoutMs);

            const internalTask: InternalTask<T> = {
                ...task,
                controller,
                timeoutId,
                onSuccess: (result: T) => {
                    task.onSuccess(result);
                    resolve(result);
                },
                onError: (error: Error) => {
                    task.onError(error);
                    reject(error);
                },
            };

            this.queue.push(internalTask);
            void this.processNext();
        });
    }

    /**
     * Cancel all pending tasks (not the one currently processing).
     * The current task is aborted via its AbortController.
     */
    cancelAll(): void {
        // Abort the currently-processing task if any
        if (this.queue.length > 0) {
            const current = this.queue[0];
            clearTimeout(current.timeoutId);
            current.controller.abort();
        }
        // Clear the rest
        while (this.queue.length > 1) {
            const task = this.queue.pop()!;
            clearTimeout(task.timeoutId);
        }
        // Defensive reset — ensures the processing flag is cleared
        // even if the queue was empty (race condition where the task
        // was already shifted but the finally block hasn't run yet)
        this.processing = false;
    }

    private async processNext(): Promise<void> {
        if (this.processing) return;
        if (this.queue.length === 0) return;

        this.processing = true;
        const task = this.queue[0];

        try {
            const result = await task.execute(task.controller.signal);
            clearTimeout(task.timeoutId);
            task.onSuccess(result);
        } catch (err: any) {
            clearTimeout(task.timeoutId);
            // If aborted by timeout, give a clearer message
            if (task.controller.signal.aborted || err?.name === 'AbortError') {
                const timeoutError = new Error(
                    'Request timed out after 15 seconds. Please check your connection and try again.'
                );
                task.onError(timeoutError);
            } else {
                task.onError(err instanceof Error ? err : new Error(String(err)));
            }
        } finally {
            this.queue.shift();
            this.processing = false;
            // Process the next task in the queue if any
            if (this.queue.length > 0) {
                void this.processNext();
            }
        }
    }
}

// ─── Singleton queue for the ALOA/ARIA chat ──────────────────────────────
// A single shared queue ensures all AI requests across the app are
// serialized — no two AI calls can race against each other.
let _globalQueue: AIRequestQueue | null = null;

export const getGlobalAIQueue = (): AIRequestQueue => {
    if (!_globalQueue) {
        _globalQueue = new AIRequestQueue();
    }
    return _globalQueue;
};

// ─── API Key Pre-Flight Validation ───────────────────────────────────────
/**
 * Validates that a Gemini API key exists before initiating a network
 * payload. Returns a user-friendly error message if the key is missing
 * or clearly malformed.
 *
 * This is called BEFORE any fetch() so we never send a request that's
 * doomed to fail with a 403.
 */
import { getGeminiApiKey } from './aiUtils';

/**
 * Validates that a Gemini API key exists before initiating a network
 * payload. Checks BOTH the user's personal key (localStorage) AND the
 * firm-wide key (passed via appState).
 *
 * We intentionally do NOT check the key format (startsWith, length) here
 * because that caused false rejections of valid keys. The API itself
 * will return a 403 if the key is actually invalid, and that error is
 * already handled gracefully by the onError handler.
 */
export const validateAPIKey = (firmKey?: string): { valid: boolean; error?: string } => {
    const personalKey = getGeminiApiKey();
    const key = firmKey || personalKey;

    if (!key) {
        return {
            valid: false,
            error: 'No Gemini API key configured. Get a free key at https://aistudio.google.com/app/apikey and paste it in Settings → AI Settings → API Key Configuration.',
        };
    }

    // Only check that the key exists and has a reasonable length.
    // Don't check the prefix — some valid keys may have different formats.
    if (key.trim().length < 20) {
        return {
            valid: false,
            error: 'Your Gemini API key appears to be too short. Please re-check the key in Settings → AI Settings → API Key Configuration.',
        };
    }

    return { valid: true };
};

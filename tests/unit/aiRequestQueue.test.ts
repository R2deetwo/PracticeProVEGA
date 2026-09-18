/**
 * aiRequestQueue.test.ts — Task 63: the corrupted-cancel / stuck-queue
 * contracts for the ALOA/ARIA send path (2026-09-19).
 *
 * USER CONTEXT: "i am typing in aloa and the message just disappears and
 * does not send."
 *
 * THE QUEUE-SIDE ROOT CAUSES THIS FILE PINS:
 *   1. cancelAll() force-set `processing = false` while the current task was
 *      still executing (Convex mutations ignore AbortSignals). The next
 *      enqueue then re-ran processNext(), which RE-EXECUTED the still-running
 *      queue[0] in parallel; the first completion's finally shift()-ed the
 *      WRONG task off the queue. → cancelAll must not touch `processing`.
 *   2. Tasks discarded by cancelAll never fired onSuccess/onError — callers'
 *      pending counters (AloaChat's pendingQueueCount) leaked upward forever.
 *      → discarded tasks must receive a deterministic cancel error.
 *   3. processNext's finally must only shift the task it actually ran.
 *
 * Plus the happy-path invariants: strict FIFO, per-task callbacks,
 * timeout → clear AbortError message path.
 */
import { describe, it, expect, vi } from 'vitest';
import { AIRequestQueue } from '../../src/utils/aiRequestQueue';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('AIRequestQueue — FIFO + callbacks', () => {
    it('processes tasks strictly in order and resolves each enqueue promise', async () => {
        const q = new AIRequestQueue(5_000);
        const order: string[] = [];

        const p1 = q.enqueue({
            id: 'a',
            execute: async () => { await tick(); order.push('a'); return 1; },
            onSuccess: () => { order.push('a:success'); },
            onError: () => { order.push('a:error'); },
        });
        const p2 = q.enqueue({
            id: 'b',
            execute: async () => { order.push('b'); return 2; },
            onSuccess: () => { order.push('b:success'); },
            onError: () => { order.push('b:error'); },
        });

        await Promise.all([p1, p2]);
        expect(order).toEqual(['a', 'a:success', 'b', 'b:success']);
        expect(q.isProcessing).toBe(false);
        expect(q.pendingCount).toBe(0);
    });

    it('fires onError for a failing task and continues with the next one', async () => {
        const q = new AIRequestQueue(5_000);
        const events: string[] = [];

        await q.enqueue({
            id: 'boom',
            execute: async () => { throw new Error('network down'); },
            onSuccess: () => events.push('boom:success'),
            onError: (e) => events.push(`boom:error:${e.message}`),
        }).catch(() => { /* expected */ });

        const two = await q.enqueue({
            id: 'next',
            execute: async () => 2,
            onSuccess: () => events.push('next:success'),
            onError: () => events.push('next:error'),
        });

        expect(two).toBe(2);
        expect(events).toEqual(['boom:error:network down', 'next:success']);
    });
});

describe('AIRequestQueue — Task 63 cancelAll contracts', () => {
    it('does NOT lie about processing while the current task still runs', async () => {
        const q = new AIRequestQueue(5_000);
        let executions = 0;
        let releaseExec: (() => void) | null = null;

        const first = q.enqueue({
            id: 'hung',
            // Simulates a Convex mutation that ignores the abort signal.
            execute: async () => {
                executions++;
                await new Promise<void>((r) => { releaseExec = r; });
                return 'late';
            },
            onSuccess: () => {},
            onError: () => {},
        }).catch(() => { /* may reject via cancel */ });

        await tick();
        expect(q.isProcessing).toBe(true);

        q.cancelAll();
        // OLD BEHAVIOUR (the bug): processing flipped to false here, so the
        // next enqueue re-executed the still-running task in parallel.
        expect(q.isProcessing).toBe(true);

        // Let the hung task settle; the queue must return to idle cleanly.
        releaseExec?.();
        await first.catch(() => {});
        await tick();
        expect(executions).toBe(1);
        expect(q.isProcessing).toBe(false);
        expect(q.pendingCount).toBe(0);
    });

    it('fires onError for discarded queued tasks (no pending-counter leak)', async () => {
        const q = new AIRequestQueue(5_000);
        const errors: string[] = [];

        q.enqueue({
            id: 'running',
            execute: () => new Promise<string>((r) => setTimeout(() => r('done'), 20)),
            onSuccess: () => {},
            onError: (e) => errors.push(`running:${e.message}`),
        }).catch(() => {});

        const discarded = q.enqueue({
            id: 'waiting',
            execute: async () => 'never',
            onSuccess: () => errors.push('waiting:success'),
            onError: (e) => errors.push(`waiting:${e.message}`),
        }).catch((e: Error) => errors.push(`waiting:rejected:${e.message}`));

        await tick();
        q.cancelAll();
        await discarded;

        expect(errors).toContain('waiting:rejected:Request cancelled.');
        expect(errors).not.toContain('waiting:success');
    });

    it('aborts the in-flight task via its signal (stop button semantics)', async () => {
        const q = new AIRequestQueue(5_000);
        let observedAbort = false;

        // NOTE: do NOT await the enqueue promise before cancelling — the
        // task only settles once aborted.
        const settled = q.enqueue({
            id: 'abortable',
            execute: (signal) => new Promise<string>((_, rej) => {
                signal.addEventListener('abort', () => { observedAbort = true; rej(new DOMException('Aborted', 'AbortError')); });
            }),
            onSuccess: () => {},
            onError: () => {},
        }).catch(() => {});

        q.cancelAll();
        await settled;
        expect(observedAbort).toBe(true);
    });
});

describe('AIRequestQueue — timeout path', () => {
    it('times out a hung task and reports the timeout error, then drains the queue', async () => {
        const q = new AIRequestQueue(30);
        const seen: string[] = [];

        // Keep the RAW promise: .catch() derivatives always resolve.
        const firstRaw = q.enqueue({
            id: 'hung',
            // Ignores the signal entirely — the pre-fix "stuck forever" shape.
            execute: () => new Promise<string>(() => { /* never settles */ }),
            onSuccess: () => seen.push('hung:success'),
            onError: (e) => seen.push(`hung:${e.message}`),
        });
        firstRaw.catch((e: Error) => seen.push(`hung:rejected:${e.message}`));

        const second = await q.enqueue({
            id: 'after-timeout',
            execute: async () => 'second-ok',
            onSuccess: () => seen.push('second:success'),
            onError: () => seen.push('second:error'),
        });

        expect(second).toBe('second-ok');
        // The hung task's enqueue promise must have rejected with the timeout.
        expect(await firstRaw.then(() => 'resolved', (e: Error) => `rejected:${e.message}`)).toMatch(/^rejected:/);
        expect(seen).toContain('second:success');
        // Note: the never-settling execute keeps its slot until it settles —
        // the queue still accepts and runs subsequent tasks after the timeout
        // error is surfaced. (Regression guard for the double-execution bug:
        // 'second' must run exactly once.)
        expect(seen.filter((s) => s === 'second:success').length).toBe(1);
    });
});

/**
 * Task 64 — collision-free toast ids.
 *
 * The bug: addToast used Date.now() alone. During the onboarding
 * congratulations cluster several toasts can be created within the same
 * millisecond → identical ids → identical React keys → one Toast instance
 * reused for two logical toasts, and the reused instance's ToastAutoDismiss
 * controller may already have fired → the X button silently does nothing
 * (the user-reported "toast refused to close").
 */
import { describe, it, expect } from 'vitest';
import { nextToastId, __resetToastIdSeq_forTests } from '../../src/utils/toastIds';

describe('nextToastId (Task 64 — toast X close bug)', () => {
  it('produces unique ids for a burst of calls within the same millisecond', () => {
    __resetToastIdSeq_forTests();
    const ids = new Set<number>();
    for (let i = 0; i < 500; i++) {
      ids.add(nextToastId());
    }
    // 500 calls — even if many share the same Date.now() millisecond, every
    // id must be unique or React key collisions return.
    expect(ids.size).toBe(500);
  });

  it('is strictly monotonic within a millisecond (later toast > earlier toast)', () => {
    __resetToastIdSeq_forTests();
    const first = nextToastId();
    let prev = first;
    for (let i = 0; i < 50; i++) {
      const next = nextToastId();
      expect(next).toBeGreaterThan(prev);
      prev = next;
    }
  });

  it('rolls the sequence over safely at 1000 toasts in one millisecond', () => {
    __resetToastIdSeq_forTests();
    const ids: number[] = [];
    for (let i = 0; i < 1000; i++) ids.push(nextToastId());
    const unique = new Set(ids);
    // Exactly 1000 unique ids across a full sequence cycle.
    expect(unique.size).toBe(1000);
  });

  it('keeps ids in safe integer range', () => {
    __resetToastIdSeq_forTests();
    for (let i = 0; i < 10; i++) {
      expect(Number.isSafeInteger(nextToastId())).toBe(true);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { createPacer, RIBBON_TIERS, PACER_WARMUP_FRAMES, PACER_WINDOW_FRAMES } from '../../src/lib/ribbonPacer';

const NEED = PACER_WARMUP_FRAMES + PACER_WINDOW_FRAMES;
const feed = (p: ReturnType<typeof createPacer>, ms: number, n: number) => {
  let r: number | null = null;
  for (let i = 0; i < n; i++) { const x = p.push(ms); if (x !== null) r = x; }
  return r;
};

describe('ribbon pacer (R82)', () => {
  it('60 fps and 120 Hz never degrade', () => {
    let p = createPacer(0); expect(feed(p, 16.7, 500)).toBeNull(); expect(p.tier()).toBe(0);
    p = createPacer(0); expect(feed(p, 8.3, 500)).toBeNull(); expect(p.tier()).toBe(0);
  });
  it('a 40ms device steps down exactly once after warmup+window', () => {
    const p = createPacer(0); expect(feed(p, 40, NEED)).toBe(1); expect(p.tier()).toBe(1);
  });
  it('the next step needs a fresh warmup+window', () => {
    const p = createPacer(0); feed(p, 40, NEED);
    expect(feed(p, 40, NEED - 1)).toBeNull(); expect(feed(p, 40, 1)).toBe(2);
  });
  it('the floor is sticky at the last tier', () => {
    const p = createPacer(0); for (let i = 0; i < 8; i++) feed(p, 40, NEED);
    expect(p.tier()).toBe(RIBBON_TIERS.length - 1); expect(p.push(40)).toBeNull();
  });
  it('stalls (>= 100ms) are not evidence', () => {
    const p = createPacer(0); expect(feed(p, 250, 500)).toBeNull(); expect(p.tier()).toBe(0);
  });
  it('occasional stalls do not degrade a 60 fps run', () => {
    const p = createPacer(0); for (let i = 0; i < 400; i++) p.push(i % 10 === 0 ? 400 : 16.7);
    expect(p.tier()).toBe(0);
  });
  it('median-based: 1 slow frame in 3 does not degrade', () => {
    const p = createPacer(0); for (let i = 0; i < NEED * 3; i++) p.push(i % 3 ? 16.7 : 30);
    expect(p.tier()).toBe(0);
  });
  it('the slowest tier never paints slower than ~30 fps', () => {
    expect(RIBBON_TIERS[RIBBON_TIERS.length - 1].minFrameMs).toBeLessThanOrEqual(33);
  });
});

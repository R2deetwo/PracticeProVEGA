// R82 (the glide pass): adaptive quality, replacing the fixed 10 fps throttle.
// Frame RATE is the one thing the eye cannot forgive on slow hairline motion,
// so under load we shed pixels and lines first and only at the very last
// tier cap the rate (at ~30 fps, never lower).
export interface RibbonTier {
  dprScale: number;   // multiplies min(devicePixelRatio, 2); effective dpr is floored at 1
  lines: number;      // hairlines per ribbon
  minFrameMs: number; // 0 = paint on every rAF
}

export const RIBBON_TIERS: readonly RibbonTier[] = [
  { dprScale: 1.0,  lines: 64, minFrameMs: 0 },
  { dprScale: 0.75, lines: 48, minFrameMs: 0 },
  { dprScale: 0.6,  lines: 40, minFrameMs: 0 },
  { dprScale: 0.5,  lines: 32, minFrameMs: 30 }, // last resort: ~30 fps
];

export const PACER_WARMUP_FRAMES = 15;  // ignored after start / tier change (layer + JIT settle)
export const PACER_WINDOW_FRAMES = 40;  // frames judged per decision
export const PACER_MAX_MEDIAN_MS = 22;  // slower than ~45 fps => step down
export const PACER_STALL_MS = 100;      // longer gaps (tab switch, GC) are not evidence

export interface Pacer {
  tier: () => number;
  /** feed one rAF interval (ms) measured while painting every frame; returns the NEW tier index if it just stepped down, else null */
  push: (frameMs: number) => number | null;
}

export function createPacer(startTier = 0): Pacer {
  let tier = Math.min(Math.max(startTier, 0), RIBBON_TIERS.length - 1);
  let skip = PACER_WARMUP_FRAMES;
  let win: number[] = [];
  return {
    tier: () => tier,
    push(frameMs: number): number | null {
      if (tier >= RIBBON_TIERS.length - 1) return null;       // sticky floor, never downgrade past the last tier
      if (frameMs <= 0 || frameMs >= PACER_STALL_MS) return null;
      if (skip > 0) { skip--; return null; }
      win.push(frameMs);
      if (win.length < PACER_WINDOW_FRAMES) return null;
      const sorted = [...win].sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      win = [];
      if (median <= PACER_MAX_MEDIAN_MS) return null;
      tier += 1;
      skip = PACER_WARMUP_FRAMES;
      return tier;
    },
  };
}

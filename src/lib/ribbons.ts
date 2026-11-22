export interface RibbonSpec {
  cx: number;    // horizontal center, fraction of canvas width
  amp: number;   // bow depth, fraction of width (negative = bows left)
  ph: number;    // phase offset (radians)
  sp: number;    // speed; sign = direction
  f2: number;    // sway frequency
  twist: number; // twist cycles along the length
  maxW: number;  // widest ribbon width, fraction of canvas width
}
export interface RibbonOptions {
  blend: GlobalCompositeOperation; // 'lighter' on dark backgrounds
  lines: number;
  lw: number;      // base line width, CSS px
  aMin: number;    // faintest line alpha
  aMax: number;    // boldest line alpha
  fade: number;    // fraction of height faded at each end (drawn by CSS overlays in HeroRibbons)
  floor: number;   // minimum twist width; higher = ribbon never pinches fully
  rgb: [number, number, number];
  ribbons: RibbonSpec[];
}

export const RIBBON_PRESET: RibbonOptions = {
  blend: 'lighter',
  lines: 64,
  lw: 1.1,
  aMin: 0.07,
  aMax: 0.9,
  fade: 0.12,
  floor: 0.32,
  rgb: [28, 183, 76],
  ribbons: [
    { cx: 0.80, amp: -0.17, ph: 0.0, sp: 0.55,  f2: 0.9, twist: 1.3, maxW: 0.16 },
    { cx: 0.84, amp: -0.14, ph: 2.1, sp: -0.45, f2: 1.2, twist: 1.0, maxW: 0.13 },
  ],
};

// R79 (the calm pass): 120 samples across the ribbon length. The centre
// curve and twist are low-frequency sines (≤ ~1.3 cycles over the range) —
// 120 points is ~50 samples per cycle, far above Nyquist, so the raster
// is pixel-identical to the old N=220 while the per-stroke path build and
// flatten cost halves.
const N = 120;
const px = new Float32Array(N + 1), py = new Float32Array(N + 1);
const nx = new Float32Array(N + 1), ny = new Float32Array(N + 1);
const ct = new Float32Array(N + 1);

export function drawRibbons(
  ctx: CanvasRenderingContext2D, W: number, H: number, t: number, o: RibbonOptions,
  view?: { heroW?: number; ox?: number }
): void {
  // R79 (the calm pass): the ribbons live on the right of the hero, so the
  // canvas is now a right-side CROP, not a full-viewport surface. Geometry
  // stays proportional to the FULL hero width (heroW) and is shifted by the
  // canvas's left offset inside the hero (ox); W/H remain the canvas's own
  // size (clear + vertical fade). With the preset the ribbons never reach
  // left of ~0.515 of the hero, so a 54%-wide crop is geometry-safe and
  // cuts the painted area (and its additive-blend fill cost) by ~46%.
  const heroW = view?.heroW ?? W;
  const ox = view?.ox ?? 0;
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = o.blend;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const [r, g, b] = o.rgb;
  // R82 (the glide pass): SOLID stroke colour. The vertical end-fade is
  // now two static CSS gradient overlays in HeroRibbons (same navy as
  // the ground), because a gradient strokeStyle measured ~35% slower to
  // rasterise than a solid one.
  ctx.strokeStyle = `rgb(${r},${g},${b})`;
  const e = 1e-3;
  const norm = Math.hypot(1, o.floor);

  for (const R of o.ribbons) {
    const X = (v: number) =>
      heroW * (R.cx
        + R.amp * Math.sin(Math.PI * v + R.ph + 0.7 * Math.sin(t * R.sp * 0.6 + R.ph))
        + 0.035 * Math.sin(2 * Math.PI * v * R.f2 + t * R.sp + 2 * R.ph)) - ox;

    // centre curve, tangent normal and twist: computed ONCE per ribbon
    for (let j = 0; j <= N; j++) {
      const v = (j / N) * 1.2 - 0.1;
      const dx = (X(v + e) - X(v - e)) / (2 * e);
      const dy = H;
      const len = Math.hypot(dx, dy);
      px[j] = X(v); py[j] = v * H;
      nx[j] = dy / len; ny[j] = -dx / len;
      ct[j] = Math.hypot(Math.cos(Math.PI * R.twist * v + R.sp * 0.8 * t + R.ph), o.floor) / norm;
    }

    const tilt = Math.tanh(2.2 * Math.sin(t * R.sp * 0.5 + R.ph * 1.7)); // which edge is "near"
    const halfW = 0.5 * heroW * R.maxW;

    for (let i = 0; i < o.lines; i++) {
      const s = (i / (o.lines - 1)) * 2 - 1;   // -1..1 across the ribbon
      const q = 0.5 + 0.5 * s * tilt;          // depth: near edge 1, far edge 0
      ctx.globalAlpha = o.aMin + (o.aMax - o.aMin) * q * q * q;
      ctx.lineWidth = o.lw * (0.7 + 0.6 * q);
      ctx.beginPath();
      for (let j = 0; j <= N; j++) {
        const off = halfW * s * ct[j];         // offset ALONG THE NORMAL => true parallel curves
        const x = px[j] + nx[j] * off;
        const y = py[j] + ny[j] * off;
        if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

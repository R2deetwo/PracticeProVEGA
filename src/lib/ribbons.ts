export interface RibbonSpec {
  cx: number;    // horizontal center, fraction of canvas width
  amp: number;   // bow depth, fraction of width (negative = bows left)
  ph: number;    // phase offset (radians)
  sp: number;    // speed; sign = direction
  f2: number;    // sway frequency
  twist: number; // how many pinch points along the length
  minW: number;  // narrowest ribbon width, fraction of canvas width
  maxW: number;  // widest ribbon width, fraction of canvas width
}
export interface RibbonOptions {
  blend: GlobalCompositeOperation; // 'lighter' on dark backgrounds
  lines: number;                   // lines per ribbon
  lw: number;                      // base line width in CSS px
  aMin: number;                    // faintest line alpha
  aMax: number;                    // boldest line alpha
  rgb: [number, number, number];
  ribbons: RibbonSpec[];
}

export const RIBBON_PRESET: RibbonOptions = {
  blend: 'lighter',
  lines: 64,
  lw: 1.1,
  aMin: 0.05,
  aMax: 0.85,
  // PracticePro logo green, kept in sync with the repo token
  // --color-primary-500 (Tailwind primary-500) = #16A34A — the favicon +
  // logo.svg green. The task's eyedropper sample (#1CB74C / 28,183,76)
  // does not exist in the repo; the token is the standard.
  rgb: [22, 163, 74],
  ribbons: [
    { cx: 0.80, amp: -0.17, ph: 0.0, sp: 0.55,  f2: 0.9, twist: 1.3, minW: 0.02,  maxW: 0.15 },
    { cx: 0.84, amp: -0.14, ph: 2.1, sp: -0.45, f2: 1.2, twist: 1.0, minW: 0.015, maxW: 0.12 },
  ],
};

export function drawRibbons(
  ctx: CanvasRenderingContext2D, W: number, H: number, t: number, o: RibbonOptions
): void {
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = o.blend;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const STEPS = 140;
  for (const R of o.ribbons) {
    for (let i = 0; i < o.lines; i++) {
      const s = i / (o.lines - 1);
      const edge = Math.pow(1 - s, 3.2);
      ctx.beginPath();
      for (let j = 0; j <= STEPS; j++) {
        const v = (j / STEPS) * 1.2 - 0.1;
        const bow = Math.sin(Math.PI * v + R.ph + 0.7 * Math.sin(t * R.sp * 0.6 + R.ph));
        const sway = 0.035 * Math.sin(2 * Math.PI * v * R.f2 + t * R.sp + R.ph * 2);
        const cx = W * (R.cx + R.amp * bow + sway);
        const pinch = 0.5 + 0.5 * Math.sin(Math.PI * v * R.twist + t * R.sp * 0.8 + R.ph);
        const w = W * (R.minW + (R.maxW - R.minW) * pinch);
        const fan = 0.05 * Math.sin(Math.PI * v * 2 + t * R.sp + s * 2.2);
        const x = cx + (s - 0.5) * w + W * fan * (s - 0.5);
        const y = v * H;
        if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      const a = o.aMin + (o.aMax - o.aMin) * edge;
      ctx.strokeStyle = `rgba(${o.rgb[0]},${o.rgb[1]},${o.rgb[2]},${a.toFixed(3)})`;
      ctx.lineWidth = o.lw * (0.6 + 0.9 * edge);
      ctx.stroke();
    }
  }
}

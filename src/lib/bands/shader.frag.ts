/**
 * The flowing-bands fragment shader (R53).
 *
 * The look (owner direction, via reference analysis of bitnomial.com):
 * layered, slowly drifting contour bands that fold into each other —
 * silky and fractal, with razor-thin bright lines, soft glow, and zero
 * visible banding or stepping. The reference site ships this as a
 * looping 1500×1500 MP4; we build it as a resolution-independent
 * dependency-free WebGL2 shader instead (tiny payload, infinite dwell,
 * no loop seam).
 *
 * Structure, front to back:
 *   1. domain warping — fbm of fbm of fbm (q → r → f): the "fractal"
 *      folding that keeps the bands from ever looking like a gradient;
 *   2. a scalar field swept diagonally, sliced into contour bands
 *      (fract(k)) — the band count controls the density;
 *   3. per-band shading: a silky inner gradient (cos), an exponential
 *      glow near band centres, and a razor line at the centre itself —
 *      fwidth()-based screen-space AA keeps the line crisp at any DPR
 *      and any quality scale;
 *   4. a horizontal mask: the effect lives on the RIGHT side of the
 *      hero and blends to the background colour toward the left, so the
 *      copy column sits on clean ground and the edge is seamless when
 *      the page background equals uPal[0];
 *   5. a 1/255 dither — the difference between "silky" and "banded" on
 *      8-bit displays.
 *
 * Used as-is from the owner-supplied spec; tuned only through uniforms.
 */
export const BANDS_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uPointer;   // 0..1
uniform vec3  uPal[4];    // sRGB 0..1: bg, mid, bright, line
uniform float uBandCount, uLineWidth, uWarp;
out vec4 outColor;

vec2 hash22(vec2 p){
  p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
  return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float a = dot(hash22(i),             f);
  float b = dot(hash22(i+vec2(1,0)),   f-vec2(1,0));
  float c = dot(hash22(i+vec2(0,1)),   f-vec2(0,1));
  float d = dot(hash22(i+vec2(1,1)),   f-vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  mat2 R = mat2(0.8,-0.6,0.6,0.8);
  for(int i=0;i<4;i++){ s += a*gnoise(p); p = R*p*2.0 + 17.0; a *= 0.5; }
  return s;
}
vec3 ramp(float x){
  x = clamp(x,0.0,1.0)*3.0;
  vec3 c = mix(uPal[0], uPal[1], smoothstep(0.0,1.0,x));
  c = mix(c, uPal[2], smoothstep(1.0,2.0,x));
  return mix(c, uPal[3], smoothstep(2.0,3.0,x));
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p  = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float t = uTime * 0.05;
  vec2 m  = (uPointer - 0.5) * 0.15;

  // domain warping: noise of noise of noise = the "fractal" folding
  vec2 q = vec2(fbm(p*1.1 + vec2(0.0,t)), fbm(p*1.1 + vec2(5.2,1.3) - t));
  vec2 r = vec2(fbm(p*1.4 + uWarp*q + vec2(1.7,9.2) + t*0.7 + m),
                fbm(p*1.4 + uWarp*q + vec2(8.3,2.8) - t*0.5 - m));
  float f = fbm(p + uWarp*r);

  // scalar field -> contour bands, sweeping diagonally
  float field = dot(p, normalize(vec2(0.55,0.85)))*1.6 + f*2.2 + r.x*0.9;
  float k  = field * uBandCount;
  float fw = max(fwidth(k), 1e-4);            // screen-space AA: keeps lines crisp at any DPR
  float d  = abs(fract(k) - 0.5);             // 0 at band centre
  float line = 1.0 - smoothstep(uLineWidth, uLineWidth + fw*1.5, d);
  float glow = exp(-d*10.0);
  float shade = 0.5 + 0.5*cos(k*6.28318);     // silky gradient inside each band

  vec3 col = ramp(0.5 + 0.5*sin(field*2.4 + t*3.0)) * (0.18 + 0.32*shade);
  col += uPal[2]*glow*0.18 + uPal[3]*line*0.85;

  // keep effect on the right side; blend into bg on the left and at top/bottom edges
  float mask = smoothstep(0.30, 0.80, uv.x) * (1.0 - 0.35*pow(abs(uv.y-0.5)*2.0, 2.0));
  col = mix(uPal[0], col, mask);

  // dither to kill 8-bit gradient banding (this is what makes it look "silky")
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)) + uTime)*43758.5453) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`;

#!/usr/bin/env bash
# R68 — playlist asset build for clip 2 (the owner's cufflink clip).
# Same pipeline as R66's vega_hero_assets.sh (retired with the sandbox that
# wrote it; recreated here):
#   1. strip audio (the hero is silent by contract)
#   2. seamless loop via a CIRCULAR CROSSFADE — the last 0.8s of the clip
#      dissolves into a still of the opening frame, so the wrap point
#      diff collapses (typing clip: 40.6 raw -> 3.65 processed)
#   3. lanczos upscale 1280x720 -> 1920x1080 (the R66/R67 band geometry)
#   4. h264 .mp4 (faststart) + VP9 .webm + poster .jpg (== frame 0)
# Source: upload/Lawyer_adjusts_brass_cufflink_83ae2fa2.mp4 (1280x720,
# 24fps, 8.000s, 192 frames).
set -euo pipefail

SRC="/home/z/my-project/upload/Lawyer_adjusts_brass_cufflink_83ae2fa2.mp4"
OUT="public/video"
WORK="$(mktemp -d /tmp/r68-clip2.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

XFADE=0.8            # dissolve window into the opening-frame still
KEEP=$(python3 -c "print(8.0 - $XFADE)")   # 7.2s of motion kept
OFFSET=$(python3 -c "print(7.2 - $XFADE)") # xfade starts at 6.4s

echo "== 1. opening-frame still at final 1920x1080 =="
ffmpeg -y -v error -i "$SRC" -frames:v 1 \
  -vf "scale=1920:1080:flags=lanczos" "$WORK/frame0.png"

echo "== 2. seamless-loop master (circular xfade into the still) =="
# input1: the clip trimmed to 7.2s, upscaled; input2: the still held as a
# 1.6s stream. xfade dissolves 6.4s->7.2s into the still; the master's
# final frame IS the opening frame -> a perfect wrap point.
ffmpeg -y -v error \
  -i "$SRC" -loop 1 -t 1.6 -i "$WORK/frame0.png" \
  -filter_complex "\
    [0:v]trim=0:${KEEP},setpts=PTS-STARTPTS,scale=1920:1080:flags=lanczos,fps=24,format=yuv420p[v0];\
    [1:v]scale=1920:1080:flags=lanczos,fps=24,format=yuv420p[v1];\
    [v0][v1]xfade=transition=fade:duration=${XFADE}:offset=${OFFSET},format=yuv420p[vout]" \
  -map "[vout]" -an -t 8.0 "$WORK/loop-master.mp4"

echo "== 3. h264 .mp4 (faststart) =="
ffmpeg -y -v error -i "$WORK/loop-master.mp4" \
  -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p \
  -movflags +faststart -an "$OUT/vega-hero-2.mp4"

echo "== 4. VP9 .webm (what Chromium fetches) =="
ffmpeg -y -v error -i "$WORK/loop-master.mp4" \
  -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -cpu-used 4 -deadline good \
  -an "$OUT/vega-hero-2.webm"

echo "== 5. poster (== frame 0 of the master) =="
ffmpeg -y -v error -i "$WORK/loop-master.mp4" -frames:v 1 \
  -q:v 3 "$OUT/vega-hero-2-poster.jpg"

echo "== wrap-point check (first vs last frame RMS) =="
ffmpeg -y -v error -i "$OUT/vega-hero-2.mp4" \
  -vf "select='eq(n\,0)+eq(n\,191)'" -vsync 0 "$WORK/ends_%d.png"
python3 - "$WORK/ends_1.png" "$WORK/ends_2.png" <<'PY'
import math, sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert('L'); b = Image.open(sys.argv[2]).convert('L')
if a.size != b.size: b = b.resize(a.size)
h = ImageChops.difference(a, b).histogram()
n = a.size[0] * a.size[1]
print('wrap-point RMS:', round(math.sqrt(sum(i*i*h[i] for i in range(256))/n), 2))
PY

echo "== sizes =="
ls -la "$OUT"/vega-hero-2.*
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -of default=noprint_wrappers=1 "$OUT/vega-hero-2.mp4"

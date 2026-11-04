#!/usr/bin/env python3
"""R67 — zoomed crops for VLM verification (pill legibility + mobile band)."""
from PIL import Image

D = '/home/z/my-project/download/r67-video-fit'

d = Image.open(f'{D}/hero-desktop-1920x1080.png').convert('RGB')
pill = d.crop((500, 600, 1420, 720)).resize((1840, 240), Image.LANCZOS)
pill.save('/tmp/pill-crop.png')

m = Image.open(f'{D}/hero-mobile-390x844.png').convert('RGB')
band = m.crop((0, 0, 390, 219)).resize((1170, 657), Image.LANCZOS)
band.save('/tmp/mobile-band.png')
print('crops saved')

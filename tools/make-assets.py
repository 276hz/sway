#!/usr/bin/env python3
"""Sway: tạo icon PNG (PWA/iOS) và og.png từ cùng hình sóng với icon.svg. Cần Pillow. Chạy: python3 tools/make-assets.py"""
import math, os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
BG, WAVE = (0x14, 0x21, 0x3d), (0x5b, 0x95, 0xf0)

def bezier(p0, p1, p2, p3, n=400):
    for i in range(n + 1):
        t = i / n; u = 1 - t
        yield (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0], u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])

def wave_points():  # đúng đường path của icon.svg: M16 64 c16-40 32-40 48 0 s32 40 48 0
    return list(bezier((16, 64), (32, 24), (48, 24), (64, 64))) + list(bezier((64, 64), (80, 104), (96, 104), (112, 64)))

def icon(size, rounded, scale):
    S = size * 4; k = S / 128 * scale
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if rounded: d.rounded_rectangle((0, 0, S - 1, S - 1), radius=S * 28 / 128, fill=BG + (255,))
    else: d.rectangle((0, 0, S, S), fill=BG + (255,))
    r = 4.5 * k
    for x, y in wave_points():
        cx, cy = S / 2 + (x - 64) * k, S / 2 + (y - 64) * k
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=WAVE + (255,))
    return im.resize((size, size), Image.LANCZOS)

def save(im, name, flat=False):
    if flat: bg = Image.new('RGB', im.size, BG); bg.paste(im, mask=im.split()[3]); im = bg
    im.save(os.path.join(ROOT, name), optimize=True); print('wrote', name, im.size)

save(icon(192, True, 1.0), 'icon-192.png')
save(icon(512, True, 1.0), 'icon-512.png')
save(icon(512, False, 0.8), 'icon-maskable-512.png', flat=True)   # full-bleed + họa tiết nằm trong vùng an toàn (80%)
save(icon(180, False, 0.9), 'apple-touch-icon.png', flat=True)    # iOS tự bo góc, không dùng nền trong suốt

# ---- ảnh chia sẻ 1200x630 (cùng phong cách: nền sáng, chữ đậm, một đường sóng) ----
def font(paths, size):
    for p in paths:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    return ImageFont.load_default()
SANS_B = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
SANS = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
CJK = ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc']
W, H = 1200, 630; INK, MUTE, PAPER = (24, 24, 27), (96, 96, 104), (245, 245, 243)
og = Image.new('RGB', (W * 2, H * 2), PAPER); d = ImageDraw.Draw(og); k = 2
def fit(text, paths, size, maxw):
    f = font(paths, size * k)
    while d.textlength(text, font=f) > maxw * k and size > 14: size -= 1; f = font(paths, size * k)
    return f
d.text((100 * k, 96 * k), 'Sway', font=font(SANS_B, 150 * k), fill=INK)
d.text((104 * k, 292 * k), '音频与视频转换 · 8D · 混响 · 全程在浏览器中运行', font=fit('音频与视频转换 · 8D · 混响 · 全程在浏览器中运行', CJK, 38, 1000), fill=MUTE)
t2 = 'Audio & video converter · 8D · reverb · 100% in your browser'
d.text((104 * k, 352 * k), t2, font=fit(t2, SANS, 30, 1000), fill=MUTE)
pts = []
for i in range(0, 1001):
    x = 100 + i; y = 490 - 62 * math.sin(i / 1000 * 4 * math.pi + math.pi)   # hai chu kỳ, nằm dưới chữ (không đè lên chữ)
    pts.append((x * k, y * k))
r = 5.5 * k
for x, y in pts: d.ellipse((x - r, y - r, x + r, y + r), fill=INK)
og = og.resize((W, H), Image.LANCZOS); og.save(os.path.join(ROOT, 'og.png'), optimize=True); print('wrote og.png', og.size)

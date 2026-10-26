"""The Duo's screens as pictures: the open home screen (both halves as one
wide picture, the crease down the middle) and the cover screen's lock screen.

usage: python3 scripts/screen.py   → assets/duo-screen.png, assets/duo-cover.png
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SF = "/System/Library/Fonts/SFNS.ttf"


def font(size, weight=600):
    """SF Pro at a weight (axes: width, optical size, grade, weight)."""
    f = ImageFont.truetype(SF, size)
    f.set_variation_by_axes([100, min(96, max(17, size / 2)), 400, weight])
    return f


def wallpaper(w, h, seed_shift=0.0):
    """Indigo to violet to warm pink, with soft glowing blobs."""
    img = Image.new("RGB", (w, h))
    px = img.load()
    a, b, c = (34, 36, 112), (118, 78, 214), (240, 128, 168)
    for y in range(h):
        for x in range(w):
            t = 0.55 * x / w + 0.45 * y / h
            if t < 0.5:
                k = t / 0.5
                col = [a[i] + (b[i] - a[i]) * k for i in range(3)]
            else:
                k = (t - 0.5) / 0.5
                col = [b[i] + (c[i] - b[i]) * k for i in range(3)]
            px[x, y] = tuple(int(v) for v in col)
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(glow)
    for cx, cy, r, col in [(0.22, 0.3, 0.32, (90, 160, 255)), (0.78, 0.72, 0.36, (255, 150, 120)), (0.55 + seed_shift, 0.15, 0.22, (190, 120, 255))]:
        d.ellipse([(cx - r) * w, (cy - r) * h * w / h, (cx + r) * w, (cy + r) * h * w / h], fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(w * 0.09))
    return Image.blend(img, Image.composite(glow, img, Image.new("L", (w, h), 255)), 0.38)


ICON_COLS = [(52, 199, 89), (10, 132, 255), (255, 149, 0), (255, 59, 48), (255, 204, 0), (48, 176, 199), (175, 82, 222), (142, 142, 147),
             (255, 45, 85), (88, 86, 214), (0, 199, 190), (162, 132, 94)]


def app_tile(s, k):
    """A rounded-square app icon (a top-lit colour, a white glyph) and its mask."""
    c = ICON_COLS[k % len(ICON_COLS)]
    top = tuple(min(255, int(v * 1.15 + 22)) for v in c)
    tile = Image.new("RGB", (s, s))
    g = ImageDraw.Draw(tile)
    for i in range(s):
        t = i / s
        g.line([(0, i), (s, i)], fill=tuple(int(top[j] + (c[j] - top[j]) * t) for j in range(3)))
    glyph(g, s, k)
    m = Image.new("L", (s, s), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.23), fill=255)
    return tile, m


def home(w=1600, h=1170):
    img = wallpaper(w, h)
    d = ImageDraw.Draw(img)
    # status bar
    f = font(46, 650)
    d.text((70, 34), "9:41", font=f, fill="white")
    bx = w - 150
    d.rounded_rectangle([bx, 46, bx + 74, 80], radius=10, outline="white", width=4)
    d.rounded_rectangle([bx + 7, 53, bx + 56, 73], radius=5, fill="white")
    d.rounded_rectangle([bx + 78, 56, bx + 84, 70], radius=2, fill="white")
    # icons: 4 columns a half, 3 rows, then the dock
    s, k = 150, 0
    for half in (0, 1):
        gap = (w / 2 - 4 * s) / 5
        for row in range(3):
            for col in range(4):
                tile, m = app_tile(s, k)
                img.paste(tile, (int(half * w / 2 + gap + col * (s + gap)), int(150 + row * (s + 105))), m)
                k += 1
    dock = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(dock).rounded_rectangle([60, h - 250, w - 60, h - 50], radius=70, fill=(255, 255, 255, 70))
    img = Image.alpha_composite(img.convert("RGBA"), dock).convert("RGB")
    for i in range(8):
        tile, m = app_tile(s, k + i * 5)
        img.paste(tile, (int(60 + (w - 120 - 8 * s) / 9 * (i + 1) + i * s), h - 225), m)
    return img


def glyph(g, s, k):
    c, r = s / 2, s * 0.26
    kind = k % 6
    if kind == 0:
        g.ellipse([c - r, c - r, c + r, c + r], outline="white", width=int(s * 0.07))
    elif kind == 1:
        g.rounded_rectangle([c - r, c - r * 0.75, c + r, c + r * 0.75], radius=int(s * 0.06), fill="white")
    elif kind == 2:
        g.polygon([(c - r * 0.7, c - r), (c + r, c), (c - r * 0.7, c + r)], fill="white")
    elif kind == 3:
        for i in range(3):
            y = c - r * 0.7 + i * r * 0.7
            g.rounded_rectangle([c - r, y - s * 0.03, c + r, y + s * 0.03], radius=4, fill="white")
    elif kind == 4:
        g.ellipse([c - r, c - r, c + r, c + r], fill="white")
        g.ellipse([c - r * 0.45, c - r * 0.45, c + r * 0.45, c + r * 0.45], fill=ICON_COLS[k % len(ICON_COLS)])
    else:
        pts = [(c + r * math.cos(a) * (1 if i % 2 == 0 else 0.45), c + r * math.sin(a) * (1 if i % 2 == 0 else 0.45)) for i, a in enumerate([-math.pi / 2 + i * math.pi / 5 for i in range(10)])]
        g.polygon(pts, fill="white")


def cover(w=800, h=1200):
    img = wallpaper(w, h, 0.1)
    d = ImageDraw.Draw(img)
    f = font(48, 600)
    t = "Thursday 22 October"
    d.text(((w - d.textlength(t, font=f)) / 2, 200), t, font=f, fill=(255, 255, 255))
    f = font(250, 700)
    t = "9:41"
    d.text(((w - d.textlength(t, font=f)) / 2, 250), t, font=f, fill=(255, 255, 255))
    return img


if __name__ == "__main__":
    (ROOT / "assets").mkdir(exist_ok=True)
    home().save(ROOT / "assets/duo-screen.png")
    cover().save(ROOT / "assets/duo-cover.png")
    print("assets/duo-screen.png, assets/duo-cover.png")

"""A sketch of an idea, made from the creator's own material, for the story page (references/research.md,
"The story first"): their pictures laid out the way the idea would show them, on the film's dark stage,
with the toy's picture where the toy would stand and the line the viewer reads. It is a picture of the idea,
not a frame of the film: the storyboard's renders are. An idea the layouts here don't fit: compose your own.

Layouts:
  grid   every picture at once, filling the frame: a quantity seen whole
  wall   the same, past the frame's edges: more than fits
  fan    cards fanned out from the toy, like a hand of cards
  stack  a deck, one card over the next: one after another
  row    cards in a row going away: a sequence, a path

usage: python3 engine/scripts/sketch.py <film> --out research/sketches/<name>.jpg --layout grid
         --images "assets/work/*.jpg" [more files or globs] [--over assets/avatar.jpg] [--text "66 种风格"]
         [--count 66] [--size 1200x675]
--over is the toy's picture (the avatar, or build/lookdev/front.png once the toy exists); --count repeats the
pictures up to that many when the idea is a number of them.
"""
import glob
import math
import os
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


def font(size):
    """a face that has Chinese, wherever the system keeps one"""
    for f in ("/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/Hiragino Sans GB.ttc", "C:/Windows/Fonts/msyh.ttc",
              "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", str(Path.home() / ".chrishkai-video/fonts/SourceHanSansSC-Bold.otf")):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()

argv = sys.argv[1:]
opt = lambda k, d=None: argv[argv.index(k) + 1] if k in argv else d  # noqa: E731
film = Path(argv[0]) if argv and not argv[0].startswith("--") else Path(os.environ.get("FILM", "."))
out, layout = opt("--out"), opt("--layout", "grid")
if not out:
    sys.exit("--out research/sketches/<name>.jpg is needed")
if layout not in ("grid", "wall", "fan", "stack", "row"):
    sys.exit(f"--layout {layout}: one of grid, wall, fan, stack, row")
W, H = (int(v) for v in opt("--size", "1200x675").split("x"))

# the pictures: every file or glob after --images, until the next option
files = []
if "--images" in argv:
    for a in argv[argv.index("--images") + 1:]:
        if a.startswith("--"):
            break
        found = sorted(glob.glob(str(film / a))) or ([str(film / a)] if (film / a).exists() else [])
        files += found
if not files:
    sys.exit("--images: no picture found (paths and globs are inside the film folder)")
pics = [Image.open(f).convert("RGB") for f in files]
count = int(opt("--count", len(pics)))
pics = [pics[i % len(pics)] for i in range(count)]

stage = Image.new("RGB", (W, H), (11, 11, 14))
glow = Image.new("L", (W, H), 0)
ImageDraw.Draw(glow).ellipse((W * 0.1, H * 0.35, W * 0.9, H * 1.25), fill=60)
stage.paste(Image.new("RGB", (W, H), (40, 40, 46)), (0, 0), glow.filter(ImageFilter.GaussianBlur(H // 6)))


def card(img, w, h=None, rim=3):
    """a picture as a card: cropped to w x h (its own shape when h is None), with a thin light rim"""
    h = h or round(w * img.height / img.width)
    c = ImageOps.fit(img, (max(1, w - 2 * rim), max(1, h - 2 * rim)), Image.LANCZOS)
    framed = Image.new("RGB", (w, h), (235, 232, 226))
    framed.paste(c, (rim, rim))
    return framed


def place(img, cx, cy, angle=0.0, shadow=True):
    """pastes a card centred at (cx, cy), turned by angle degrees, with a soft shadow under it"""
    rgba = img.convert("RGBA").rotate(angle, expand=True, resample=Image.BICUBIC)
    x, y = round(cx - rgba.width / 2), round(cy - rgba.height / 2)
    if shadow:
        sh = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
        sh.putalpha(rgba.getchannel("A").point(lambda a: a * 0.55))
        stage.paste((0, 0, 0), (x + 6, y + 10), sh.getchannel("A").filter(ImageFilter.GaussianBlur(8)))
    stage.paste(rgba, (x, y), rgba)


n = len(pics)
aspect = sum(p.width / p.height for p in pics) / n
if layout in ("grid", "wall"):
    # the columns and rows that fill the frame with n cards of their own shape (wall: a size up, past the edges)
    cols = max(1, round(math.sqrt(n * aspect * H / W) * (W / H) / aspect))
    while cols * math.ceil(n / cols) < n:
        cols += 1
    rows = math.ceil(n / cols)
    cw = W / cols if layout == "grid" else W / max(1, cols - 1.6)
    ch = min(cw / aspect, H / rows if layout == "grid" else H / max(1, rows - 1.2))
    cw = ch * aspect
    x0 = (W - cw * cols) / 2
    y0 = (H - ch * rows) / 2
    rnd = random.Random(7)
    for i, p in enumerate(pics):
        r, c = divmod(i, cols)
        place(card(p, round(cw * 0.94), round(ch * 0.94), rim=2), x0 + (c + 0.5) * cw, y0 + (r + 0.5) * ch, rnd.uniform(-1.2, 1.2) if layout == "wall" else 0, shadow=n < 40)
elif layout == "fan":
    span = min(150, 14 * n)
    w = round(min(W * 0.26, W * 1.6 / max(n, 4)))
    for i, p in enumerate(pics):
        a = -span / 2 + span * (i + 0.5) / n
        r = H * 0.62
        place(card(p, w), W / 2 + r * math.sin(math.radians(a)), H * 0.98 - r * math.cos(math.radians(a)), -a)
elif layout == "stack":
    w = round(W * 0.42)
    k = min(n, 12)
    for i, p in enumerate(pics[:k][::-1]):
        j = k - 1 - i
        place(card(p, w), W * 0.5 + j * W * 0.035, H * 0.48 - j * H * 0.035, (j - k / 2) * 1.5)
else:  # row: going away to the right, smaller and higher
    k = min(n, 9)
    for i, p in enumerate(pics[:k][::-1]):
        j = k - 1 - i
        s = 0.82 ** j
        place(card(p, round(W * 0.34 * s)), W * 0.3 + W * 0.62 * (1 - s) / 0.85, H * 0.56 - H * 0.3 * (1 - s), 0)

# the toy's picture where the toy would stand, and the line the viewer reads
over = opt("--over")
if over and (film / over).exists():
    av = Image.open(film / over).convert("RGBA")
    d = round(H * 0.3)
    av = ImageOps.fit(av, (d, d), Image.LANCZOS)
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, d - 1, d - 1), fill=255)
    ring = Image.new("RGBA", (d + 12, d + 12), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((0, 0, d + 11, d + 11), fill=(245, 242, 236, 255))
    cx, cy = W // 2, round(H * 0.72) if layout != "fan" else round(H * 0.8)
    stage.paste(ring, (cx - (d + 12) // 2, cy - (d + 12) // 2), ring)
    stage.paste(av, (cx - d // 2, cy - d // 2), mask)
text = opt("--text")
if text:
    f = font(round(H * 0.075))
    dr = ImageDraw.Draw(stage)
    tw = dr.textlength(text, font=f)
    pad = round(H * 0.02)
    y = round(H * 0.06)
    dr.rounded_rectangle((W / 2 - tw / 2 - 2 * pad, y - pad, W / 2 + tw / 2 + 2 * pad, y + H * 0.075 + 1.6 * pad), radius=pad, fill=(245, 242, 236))
    dr.text((W / 2 - tw / 2, y), text, font=f, fill=(28, 27, 25))

(film / out).parent.mkdir(parents=True, exist_ok=True)
stage.save(film / out, quality=88)
print(f"{out}: {layout}, {n} pictures from {len(files)} files")

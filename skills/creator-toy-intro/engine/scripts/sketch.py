"""A sketch of an idea, made from the creator's own material, for the story page (references/research.md,
"The story first"): their pictures laid out the way the idea would show them, on the film's dark stage,
with the toy's picture where the toy would stand and the line the viewer reads. It is a picture of the idea,
not a frame of the film: the storyboard's renders are. These layouts fit an idea about many pictures at once;
most ideas need a sketch composed for them, and that is the usual case: engine/lib/sketchkit.py gives the
pieces (a card of their picture, the toy's disc, a caption, a label, an arrow or an arc).

Layouts:
  grid   every picture at once, filling the frame: a quantity seen whole
  wall   the same, past the frame's edges: more than fits
  fan    cards fanned out from the toy, like a hand of cards
  stack  a deck, one card over the next: one after another
  row    cards in a row going away: a sequence, a path

usage: python3 engine/scripts/sketch.py <film> --out research/sketches/<name>.jpg --layout grid
         --images "assets/work/*.jpg" [more files or globs] [--over assets/avatar.jpg] [--text "120 幅画"]
         [--count 120] [--size 1200x675]
--over is the toy's picture (the avatar, or build/lookdev/front.png once the toy exists); --count repeats the
pictures up to that many when the idea is a number of them.
"""
import glob
import math
import os
import random
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from sketchkit import Sketch  # noqa: E402

argv = sys.argv[1:]
opt = lambda k, d=None: argv[argv.index(k) + 1] if k in argv else d  # noqa: E731
film = Path(argv[0]) if argv and not argv[0].startswith("--") else Path(os.environ.get("FILM", "."))
out, layout = opt("--out"), opt("--layout", "grid")
if not out:
    sys.exit("--out research/sketches/<name>.jpg is needed")
if layout not in ("grid", "wall", "fan", "stack", "row"):
    sys.exit(f"--layout {layout}: one of grid, wall, fan, stack, row (or compose your own with engine/lib/sketchkit.py)")
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
sk = Sketch(film, (W, H))

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
        sk.card(p, (x0 + (c + 0.5) * cw, y0 + (r + 0.5) * ch), round(cw * 0.94), round(ch * 0.94), rnd.uniform(-1.2, 1.2) if layout == "wall" else 0, rim=2, shadow=n < 40)
elif layout == "fan":
    span = min(150, 14 * n)
    w = round(min(W * 0.26, W * 1.6 / max(n, 4)))
    for i, p in enumerate(pics):
        a = -span / 2 + span * (i + 0.5) / n
        r = H * 0.62
        sk.card(p, (W / 2 + r * math.sin(math.radians(a)), H * 0.98 - r * math.cos(math.radians(a))), w, angle=-a)
elif layout == "stack":
    w = round(W * 0.42)
    k = min(n, 12)
    for i, p in enumerate(pics[:k][::-1]):
        j = k - 1 - i
        sk.card(p, (W * 0.5 + j * W * 0.035, H * 0.48 - j * H * 0.035), w, angle=(j - k / 2) * 1.5)
else:  # row: going away to the right, smaller and higher
    k = min(n, 9)
    for i, p in enumerate(pics[:k][::-1]):
        j = k - 1 - i
        s = 0.82 ** j
        sk.card(p, (W * 0.3 + W * 0.62 * (1 - s) / 0.85, H * 0.56 - H * 0.3 * (1 - s)), round(W * 0.34 * s))

# the toy's picture where the toy would stand, and the line the viewer reads
over = opt("--over")
if over and (film / over).exists():
    sk.toy(over, (W // 2, round(H * 0.72) if layout != "fan" else round(H * 0.8)))
text = opt("--text")
if text:
    sk.caption(text, (W / 2, round(H * 0.04)))

sk.save(out)
print(f"{out}: {layout}, {n} pictures from {len(files)} files")

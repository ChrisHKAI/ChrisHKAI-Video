"""What is on a cover, numbered, so a cover recipe picks pieces by number instead of guessing pixels:
- blocks: areas of one colour (a red banner, a photo's subject on a plain ground, a box of a number);
- lines: lines of lettering (strokes that stand out from what is around them, joined along the line).
Each is drawn with its number on build/regions-<cover>.png, and written to build/regions-<cover>.json
with its box and outline in cover UV (0..1, v down), the same rings a recipe's pieces take
(engine/lib/cutlib.py). Use them as they are (`"rings": region["rings"]`), or as the box to cut inside.

usage: FILM=<film folder> python3 engine/scripts/regions.py assets/<cover> [--colours 6] [--min 0.005] [--most 36]
       (or: python3 engine/scripts/regions.py <film folder> assets/<cover>)
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import cutlib  # noqa: E402
from publish import font  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = lambda k, d: type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d  # noqa: E731
if len(args) == 2:
    film, cover = Path(args[0]), args[1]
else:
    film, cover = Path(os.environ.get("FILM", ".")), args[0]
src = Image.open(film / cover).convert("RGB")
W0, H0 = src.size
k = min(1.0, 1200 / W0)
img = src.resize((round(W0 * k), round(H0 * k)), Image.LANCZOS) if k < 1 else src
W, H = img.size
a = np.asarray(img).astype(np.float32) / 255
MIN = opt("--min", 0.005) * W * H  # smallest region, as a share of the cover

# blocks: the cover's main colours, each colour's connected areas (not the ground: the biggest, if it is most of it)
q = img.quantize(colors=opt("--colours", 6), method=Image.Quantize.MEDIANCUT)
idx = np.asarray(q)
regions = []
for c in range(idx.max() + 1):
    m = ndimage.binary_opening(ndimage.binary_closing(idx == c, iterations=2), iterations=1)
    lab, n = ndimage.label(m)
    for i in range(1, n + 1):
        part = lab == i
        area = part.sum()
        if area < MIN or area > 0.45 * W * H:
            continue
        regions.append(("block", part, area))

# lines of lettering: strong local contrast, joined along the line, wide and short
g = a.mean(axis=2)
edge = np.hypot(ndimage.sobel(g, 0), ndimage.sobel(g, 1))
strokes = edge > max(0.25, np.percentile(edge, 92))
joined = ndimage.binary_closing(strokes, structure=np.ones((3, max(5, W // 80))), iterations=2)
lab, n = ndimage.label(joined)
for i, sl in enumerate(ndimage.find_objects(lab), 1):
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    part = lab == i
    if part.sum() < MIN / 2 or w < 2.2 * h or h < 6:
        continue
    regions.append(("line", part, part.sum()))

# the biggest few (a busy collage has hundreds of scraps), lines of lettering first among equals
regions.sort(key=lambda r: -r[2] * (1.5 if r[0] == "line" else 1))
regions = regions[: opt("--most", 36)]
# numbered top to bottom, left to right; each with its box and outline in cover UV
regions.sort(key=lambda r: (np.argwhere(r[1])[:, 0].min() // max(8, H // 40), np.argwhere(r[1])[:, 1].min()))
out, check = [], img.copy()
d = ImageDraw.Draw(check, "RGBA")
f = font(max(14, W // 50))
COL = {"block": (232, 67, 46), "line": (29, 155, 240)}
for n, (kind, m, area) in enumerate(regions, 1):
    ys, xs = np.nonzero(m)
    box = [round(xs.min() / W, 4), round(ys.min() / H, 4), round((xs.max() + 1) / W, 4), round((ys.max() + 1) / H, 4)]
    rings = cutlib.rings(m, W, H, min_area=MIN / 4, tol=0.8, close=1, hole=60, fill=kind == "line")
    out.append({"n": n, "kind": kind, "share": round(float(area) / (W * H), 4), "box": box, "rings": rings})
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
    d.rectangle((x0, y0, x1, y1), outline=COL[kind] + (255,), width=2)
    t = str(n)
    tw = d.textlength(t, font=f)
    d.rectangle((x0, max(0, y0 - f.size - 4), x0 + tw + 8, max(f.size + 4, y0)), fill=COL[kind] + (230,))
    d.text((x0 + 4, max(0, y0 - f.size - 4)), t, fill="white", font=f)
name = Path(cover).stem
(film / "build").mkdir(exist_ok=True)
check.save(film / "build" / f"regions-{name}.png")
(film / "build" / f"regions-{name}.json").write_text(json.dumps({"cover": cover, "w": W0, "h": H0, "regions": out}, ensure_ascii=False))
print(f"{len(out)} regions ({sum(r['kind'] == 'block' for r in out)} blocks, {sum(r['kind'] == 'line' for r in out)} lines of lettering) "
      f"→ build/regions-{name}.png, .json")

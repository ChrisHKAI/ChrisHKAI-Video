"""isnail's 《自媒体很苦》 cover cut into the pieces that push out of the act 3
wall, and the two wall textures:

  assets/cover-full.png   the cover as published (the last frames dissolve to it)
  assets/cover-wall.png   the same without the 2D mascot (the 3D one is about)
  build/cover.json        pieces: outline rings in cover UV (0..1, v down)

Pieces are boxes (a hand-drawn face, pushed out as one solid) or lettering
(colour masks of the words on them, raised a little further).
Coordinates are "card px": the cover as X shows it, 1030 px wide.

usage: FILM=films/isnail python3 recipes/cover-retro.py
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

FILM = Path(os.environ["FILM"]).resolve()
sys.path.insert(0, str(Path(os.environ.get("SKILL", FILM.parents[1] / "skills/creator-toy-intro")) / "engine/lib"))
from cutlib import check_image, clone, fill, hsv, largest, poly_mask, rings, uv  # noqa: E402

im = Image.open(FILM / "assets/cover-large.jpg").convert("RGB")
if im.size == (1042, 433):  # the X card screenshot: crop the card, work at 2x
    im = im.crop((3, 18, 1031, 429)).resize((2056, 822), Image.LANCZOS)
    chip, OX, OY, S = True, 0, 0, 2.0
else:  # the original picture (1983 x 793): work at its own size
    chip, OX, OY, S = False, 1, -1, im.size[0] / 1030
W, H = im.size


def P(x, y):
    """card px → working px"""
    return ((x + OX) * S, (y + OY) * S)


def box(x0, y0, x1, y1):
    a, b = P(x0, y0), P(x1, y1)
    return [max(0, int(round(v))) for v in (*a, *b)]


full = im.copy()
if chip:  # the "X 文章" chip sat bottom-left over blue paper
    clone(full, P(60, 300), box(14, 335, 128, 395))
hue, sat, val = hsv(full)
reddish = ((hue < 0.06) | (hue > 0.92)) & (sat > 0.3)  # never borrow the title's red
mascot = [(522, 8), (702, 8), (738, 58), (738, 116), (702, 146), (684, 186), (664, 204), (530, 204), (522, 150), (518, 80)]
wall = fill(full, [P(x, y) for x, y in mascot], box(705, 2, 885, 58), scale=S, protect=reddish)
(FILM / "assets").mkdir(exist_ok=True)
full.save(FILM / "assets/cover-full.png")
wall.save(FILM / "assets/cover-wall.png")

# ── pieces ──────────────────────────────────────────────────────────────────
red = ((hue < 0.04) | (hue > 0.94)) & (sat > 0.45) & (val > 0.35)
blue = (hue > 0.55) & (hue < 0.7) & (sat > 0.45) & (val > 0.2)
dark = (val < 0.3) & (sat < 0.5)
cut = lambda mask, **kw: rings(mask, W, H, scale=S, **kw)  # noqa: E731

# hand-drawn box faces (clockwise from top-left) and the colour of their words
FACES = {
    "box9": ([(146, 240), (394, 233), (400, 368), (148, 374)], dark),
    "box46": ([(402, 184), (684, 180), (690, 322), (404, 328)], blue),
    "box7": ([(694, 76), (986, 62), (992, 232), (692, 240)], red),
    "tag": ([(404, 318), (978, 296), (986, 364), (408, 392)], dark),
}
pieces = []
for name, (face, colour) in FACES.items():
    pts = [P(x, y) for x, y in face]
    pieces.append({"name": name, "kind": "box", "rings": [uv(pts, W, H)]})
    ink = colour & poly_mask((W, H), pts)
    if name == "box7":  # keep the red brush underline off the lettering
        ink &= np.arange(H)[:, None] < P(0, 200)[1]
    pieces.append({"name": name + "_ink", "kind": "ink", "of": name, "rings": cut(ink, min_area=25, tol=0.6, close=2, hole=60)})

# the title: the torn red paper and the words on it
title_box = np.zeros((H, W), bool)
x0, y0, x1, y1 = box(0, 0, 515, 200)
title_box[y0:y1, x0:x1] = True
paper = ndimage.binary_fill_holes(ndimage.binary_closing(red & title_box, iterations=6))
paper = largest(ndimage.binary_opening(paper, iterations=3))
pieces.append({"name": "title", "kind": "box", "rings": cut(paper, min_area=400, tol=1.2, close=0, hole=0)})
loose_red = ((hue < 0.06) | (hue > 0.92)) & (sat > 0.32)
words = ~loose_red & ndimage.binary_erosion(paper, iterations=5)
pieces.append({"name": "title_ink", "kind": "ink", "of": "title", "rings": cut(words, min_area=60, tol=0.7, close=2, hole=80)})

# the red arrow, top right
arrow_box = np.zeros((H, W), bool)
x0, y0, x1, y1 = box(880, 40, 1028, 120)
arrow_box[y0:y1, x0:x1] = True
pieces.append({"name": "arrow", "kind": "box", "rings": cut(red & arrow_box, min_area=60, tol=0.8, close=1, hole=0)})

out = {"w": W, "h": H, "src": "cover-large.jpg", "pieces": pieces}
(FILM / "build").mkdir(exist_ok=True)
(FILM / "build/cover.json").write_text(json.dumps(out))
for p in pieces:
    print(f"{p['name']:10s} {p['kind']:4s} rings={len(p['rings']):3d} pts={sum(len(r) for r in p['rings'])}")
check_image(wall, pieces, lambda p: (0, 255, 0) if p["kind"] == "box" else (255, 0, 255)).save(FILM / "build/cover-check.png")

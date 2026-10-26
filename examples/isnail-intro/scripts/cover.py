"""Cuts the 《自媒体很苦》 cover into the pieces that push out of the wall in
act 3, and writes the two wall textures.

  assets/cover-full.png   the cover as published (the last frames dissolve to it)
  assets/cover-wall.png   the same without the 2D mascot (the 3D one is about)
  build/cover.json        pieces: outline polygons in cover UV (0..1, v down)

Pieces are boxes (a hand-drawn face outline, pushed out as one solid) or
lettering (colour masks of the words on them, raised a little further).

usage: python3 scripts/cover.py [--src reference/isnail/article-cover.webp]
"""
import json
import sys
from pathlib import Path

import contourpy
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent.parent
argv = sys.argv[1:]
large = ROOT / "assets/cover-large.jpg"
SRC = Path(argv[argv.index("--src") + 1]) if "--src" in argv else (large if large.exists() else REPO / "reference/isnail/article-cover.webp")

# Hand-placed outlines below are in "card px": the supplied webp's card crop
# (1028 x 411). The X card shows the whole cover at 1030 px wide, offset (2, 19)
# in the webp, so card px (x, y) is cover px (x + 1, y - 1) at that width.
im = Image.open(SRC).convert("RGB")
if im.size == (1042, 433):
    im = im.crop((3, 18, 1031, 429)).resize((2056, 822), Image.LANCZOS)
    chip, OX, OY, S = True, 0, 0, 2.0
else:  # the original (1983 x 793): work at its own size
    chip, OX, OY, S = False, 1, -1, im.size[0] / 1030
W, H = im.size


def P(x, y):
    """card px → working px"""
    return ((x + OX) * S, (y + OY) * S)


def box(x0, y0, x1, y1):
    a, b = P(x0, y0), P(x1, y1)
    return [max(0, int(round(v))) for v in (*a, *b)]


def clone(dst, src_xy, box_, feather=10):
    """Copy a patch from src_xy (card px) over box_ (working px), feathered."""
    x0, y0, x1, y1 = box_
    sx, sy = [int(round(v)) for v in P(*src_xy)]
    patch = dst.crop((sx, sy, sx + x1 - x0, sy + y1 - y0))
    mask = Image.new("L", patch.size, 0)
    ImageDraw.Draw(mask).rectangle((feather, feather, patch.size[0] - feather, patch.size[1] - feather), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather / 2))
    dst.paste(patch, (x0, y0), mask)


full = im.copy()
if chip:  # the "X 文章" chip sat bottom-left over blue paper
    clone(full, (60, 300), box(14, 335, 128, 395))


def fill(img, poly, detail_box, feather=6):
    """Fill poly (crop px) from its surroundings, then put paper grain back."""
    a = np.asarray(img).astype(np.float32)
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).polygon([P(x, y) for x, y in poly], fill=255)
    m = np.asarray(m.filter(ImageFilter.MaxFilter(9))).astype(np.float32) / 255
    hsv_ = np.asarray(img.convert("HSV")).astype(np.float32) / 255
    reddish = (((hsv_[..., 0] < 0.06) | (hsv_[..., 0] > 0.92)) & (hsv_[..., 1] > 0.3)).astype(np.float32)
    keep = (1 - m) * (1 - ndimage.maximum_filter(reddish, 15))  # never borrow the title's red
    out = None
    for sig in (64, 24, 10):  # normalized convolution, finer where the edge is near
        num = np.stack([ndimage.gaussian_filter(a[..., c] * keep, sig) for c in range(3)], -1)
        den = ndimage.gaussian_filter(keep, sig)[..., None]
        est = num / np.maximum(den, 1e-30)
        w = np.clip(den / 0.25, 0, 1)
        out = est if out is None else w * est + (1 - w) * out
    x0, y0, x1, y1 = box(*detail_box)
    src = np.asarray(img).astype(np.float32)[y0:y1, x0:x1]
    grain = src - np.stack([ndimage.gaussian_filter(src[..., c], 3) for c in range(3)], -1)
    reps = (img.size[1] // grain.shape[0] + 1, img.size[0] // grain.shape[1] + 1, 1)
    grain = np.tile(grain, reps)[: img.size[1], : img.size[0]]
    soft = ndimage.gaussian_filter(m, feather * S / 2)[..., None]
    res = np.asarray(img).astype(np.float32) * (1 - soft) + (out + grain) * soft
    return Image.fromarray(np.clip(res, 0, 255).astype(np.uint8))


wall = fill(full, [(522, 8), (702, 8), (738, 58), (738, 116), (702, 146), (684, 186), (664, 204), (530, 204), (522, 150), (518, 80)], (705, 2, 885, 58))
(ROOT / "assets").mkdir(exist_ok=True)
full.save(ROOT / "assets/cover-full.png")
wall.save(ROOT / "assets/cover-wall.png")


# ── pieces ──────────────────────────────────────────────────────────────────
def uv(points):
    """working px → UV"""
    return [[round(x / W, 5), round(y / H, 5)] for x, y in points]


def simplify(pts, tol):
    """Douglas–Peucker on a closed ring."""
    pts = np.asarray(pts)
    if len(pts) < 8:
        return pts
    def dp(a):
        if len(a) < 3:
            return a
        s, e = a[0], a[-1]
        d = e - s
        n = np.hypot(*d) or 1.0
        dist = np.abs(np.cross(d, a - s)) / n
        i = int(np.argmax(dist))
        if dist[i] > tol:
            return np.vstack([dp(a[: i + 1])[:-1], dp(a[i:])])
        return np.vstack([s, e])
    half = len(pts) // 2
    return np.vstack([dp(pts[: half + 1])[:-1], dp(pts[half:])[:-1]])


def mask_rings(mask, min_area=30, tol=0.7, close=1, hole=0):
    m = ndimage.binary_closing(mask, iterations=close) if close else mask
    m = ndimage.binary_opening(m, iterations=1)
    if hole:  # scratches in the grunge print: fill holes smaller than `hole` px²
        lab, n = ndimage.label(~m)
        if n:
            sizes = ndimage.sum(~m, lab, range(1, n + 1))
            small = np.isin(lab, 1 + np.nonzero(sizes < hole * S * S)[0])
            m = m | small
    f = ndimage.gaussian_filter(m.astype(np.float32), 1.0)
    gen = contourpy.contour_generator(z=f, line_type="Separate")
    rings = []
    for line in gen.lines(0.5):
        if len(line) < 6:
            continue
        x, y = line[:, 0], line[:, 1]
        area = 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))
        if area < min_area * S * S:
            continue
        ring = simplify(line, tol * S)
        rings.append(uv(ring.tolist()))
    return rings


def poly_mask(points):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon([P(x, y) for x, y in points], fill=255)
    return np.asarray(m) > 127


hsv = np.asarray(full.convert("HSV")).astype(np.float32) / 255
hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
red = ((hue < 0.04) | (hue > 0.94)) & (sat > 0.45) & (val > 0.35)
blue = (hue > 0.55) & (hue < 0.7) & (sat > 0.45) & (val > 0.2)
dark = (val < 0.3) & (sat < 0.5)
light = (val > 0.72) & (sat < 0.3)

# hand-drawn faces (crop px, clockwise from top-left)
FACES = {
    "box9": [(146, 240), (394, 233), (400, 368), (148, 374)],
    "box46": [(402, 184), (684, 180), (690, 322), (404, 328)],
    "box7": [(694, 76), (986, 62), (992, 232), (692, 240)],
    "tag": [(404, 318), (978, 296), (986, 364), (408, 392)],
}
pieces = []
for name, face in FACES.items():
    pieces.append({"name": name, "kind": "box", "rings": [uv([P(x, y) for x, y in face])]})
    inside = poly_mask(face)
    ink = {"box9": dark, "box46": blue, "box7": red, "tag": dark}[name] & inside
    if name == "box7":  # keep the red brush underline off the lettering
        yy = np.arange(H)[:, None]
        ink &= yy < P(0, 200)[1]
    pieces.append({"name": name + "_ink", "kind": "ink", "of": name, "rings": mask_rings(ink, min_area=25, tol=0.6, close=2, hole=60)})

# the title: the torn red paper and the words on it
title_box = np.zeros((H, W), bool)
x0, y0, x1, y1 = box(0, 0, 515, 200)
title_box[y0:y1, x0:x1] = True
paper = ndimage.binary_fill_holes(ndimage.binary_closing(red & title_box, iterations=6))
paper = ndimage.binary_opening(paper, iterations=3)
lab, n = ndimage.label(paper)
if n:
    sizes = ndimage.sum(paper, lab, range(1, n + 1))
    paper = lab == (1 + int(np.argmax(sizes)))
pieces.append({"name": "title", "kind": "box", "rings": mask_rings(paper, min_area=400, tol=1.2, close=0)})
loose_red = ((hue < 0.06) | (hue > 0.92)) & (sat > 0.32)
words = ~loose_red & ndimage.binary_erosion(paper, iterations=5)
pieces.append({"name": "title_ink", "kind": "ink", "of": "title", "rings": mask_rings(words, min_area=60, tol=0.7, close=2, hole=80)})

# the red arrow, top right
arrow_box = np.zeros((H, W), bool)
x0, y0, x1, y1 = box(880, 40, 1028, 120)
arrow_box[y0:y1, x0:x1] = True
pieces.append({"name": "arrow", "kind": "box", "rings": mask_rings(red & arrow_box, min_area=60, tol=0.8)})

out = {"w": W, "h": H, "src": str(SRC.name), "pieces": pieces}
(ROOT / "build").mkdir(exist_ok=True)
(ROOT / "build/cover.json").write_text(json.dumps(out))
for p in pieces:
    print(f"{p['name']:10s} {p['kind']:4s} rings={len(p['rings']):3d} pts={sum(len(r) for r in p['rings'])}")

# a check image: every outline over the wall texture
chk = wall.copy()
d = ImageDraw.Draw(chk)
cols = {"box": (0, 255, 0), "ink": (255, 0, 255)}
for p in pieces:
    for r in p["rings"]:
        d.line([(u * W, v * H) for u, v in r + r[:1]], fill=cols[p["kind"]], width=2)
chk.save(ROOT / "build/cover-check.png")

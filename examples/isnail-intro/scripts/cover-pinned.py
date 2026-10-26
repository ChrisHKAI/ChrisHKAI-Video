"""Cuts the pinned article's cover (《公众号新号从0到1…》) into the pieces that
push out of it when it stands up as a wall in act 2: every big character on
its own, the 0 and 1 towers with their stairs, the notebook, prompt card,
phone, red ¥1000+ board, the two figures and the stage they stand on.

  build/cover2.json   pieces: outline polygons in cover UV (0..1, v down)

Coordinates below are cover px of assets/pinned-cover.jpg (1983 x 793).

usage: python3 scripts/cover-pinned.py
"""
import json
from pathlib import Path

import contourpy
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
im = Image.open(ROOT / "assets/pinned-cover.jpg").convert("RGB")
W, H = im.size
hsv = np.asarray(im.convert("HSV")).astype(np.float32) / 255
hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
RED = ((hue < 0.05) | (hue > 0.93)) & (sat > 0.45) & (val > 0.25)
DARK = (val < 0.33) & ~RED
LIGHT = (val > 0.8) & (sat < 0.25)


def region(x0, y0, x1, y1):
    m = np.zeros((H, W), bool)
    m[max(0, y0):y1, max(0, x0):x1] = True
    return m


def poly_mask(points):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return np.asarray(m) > 127


def uv(points):
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
        dist = np.abs(d[0] * (a[:, 1] - s[1]) - d[1] * (a[:, 0] - s[0])) / n
        i = int(np.argmax(dist))
        if dist[i] > tol:
            return np.vstack([dp(a[: i + 1])[:-1], dp(a[i:])])
        return np.vstack([s, e])

    half = len(pts) // 2
    return np.vstack([dp(pts[: half + 1])[:-1], dp(pts[half:])[:-1]])


def rings_of(mask, min_area=60, tol=0.8, close=2, hole=120, fill=False):
    m = ndimage.binary_closing(mask, iterations=close) if close else mask
    m = ndimage.binary_opening(m, iterations=1)
    if fill:
        m = ndimage.binary_fill_holes(m)
    elif hole:  # grain and scratches in the print
        lab, n = ndimage.label(~m)
        if n:
            sizes = ndimage.sum(~m, lab, range(1, n + 1))
            m |= np.isin(lab, 1 + np.nonzero(sizes < hole)[0])
    f = ndimage.gaussian_filter(m.astype(np.float32), 1.0)
    out = []
    for line in contourpy.contour_generator(z=f, line_type="Separate").lines(0.5):
        if len(line) < 6:
            continue
        x, y = line[:, 0], line[:, 1]
        if 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1))) < min_area:
            continue
        out.append(uv(simplify(line, tol).tolist()))
    return out


pieces = []


def box(name, points):
    pieces.append({"name": name, "kind": "box", "rings": [uv(points)]})


def ink(name, mask, **kw):
    pieces.append({"name": name, "kind": "box", "rings": rings_of(mask, **kw)})


# the stage everything stands on, the stairs under 0 and 1, the boards at left
box("stage", [(150, 671), (1928, 671), (1962, 749), (112, 749)])
box("stairs0", [(800, 362), (1000, 362), (1000, 452), (790, 452)])
box("stairs1", [(1045, 362), (1262, 362), (1262, 445), (1040, 445)])
box("boards", [(0, 242), (560, 318), (560, 640), (0, 652)])
# the title, one character at a time (公 众 号 新 号 从), then 0 到 1
TITLE = [(148, 268), (268, 392), (392, 500), (500, 600), (600, 706)]
for i, (x0, x1) in enumerate(TITLE):
    ink(f"t{i}", DARK & region(x0, 95, x1, 268))
ink("cong", RED & region(700, 95, 836, 268))
ink("zero", DARK & region(828, 55, 992, 372), fill=True)
ink("dao", DARK & region(990, 112, 1096, 268))
ink("one", RED & region(1094, 10, 1262, 372), fill=True)
ink("qihao", DARK & region(1244, 80, 1702, 186))
ink("quanjie", DARK & region(1244, 186, 1625, 292))
ink("tag", RED & region(1672, 222, 1912, 280))
ink("rinei", (DARK | RED) & region(1492, 322, 1915, 396))
# the props
box("notebook", [(632, 450), (808, 450), (808, 672), (632, 672)])
box("card", [(903, 455), (1073, 455), (1073, 668), (903, 668)])
box("phone", [(1137, 443), (1312, 443), (1312, 684), (1137, 684)])
ink("board", RED & region(1400, 432, 1668, 682), fill=True, close=4)
ink("board_ink", LIGHT & region(1408, 450, 1662, 676), min_area=40)
ink("seat", (val < 0.42) & region(348, 538, 508, 698), fill=True, close=3)
ink("stand", (val < 0.56) & region(1684, 460, 1800, 728), fill=True, close=3)

out = {"w": W, "h": H, "src": "pinned-cover.jpg", "pieces": [p for p in pieces if p["rings"]]}
(ROOT / "build").mkdir(exist_ok=True)
(ROOT / "build/cover2.json").write_text(json.dumps(out))
for p in out["pieces"]:
    print(f"{p['name']:10s} rings={len(p['rings']):3d} pts={sum(len(r) for r in p['rings'])}")

chk = im.copy()
d = ImageDraw.Draw(chk)
for p in out["pieces"]:
    for r in p["rings"]:
        d.line([(u * W, v * H) for u, v in r + r[:1]], fill=(255, 0, 255) if p["name"] not in ("stage", "boards") else (0, 200, 0), width=2)
chk.save(ROOT / "build/cover2-check.png")

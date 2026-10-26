"""The 公众号 mark from the user's picture (assets/gzh-logo.png): the green
swirl as outline polygons, centred, in units of its own height, for Blender
to extrude into the snail's shell.

usage: python3 scripts/logo.py   → build/logo.json (+ build/logo-check.png)
"""
import json
from pathlib import Path

import contourpy
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
im = Image.open(ROOT / "assets/gzh-logo.png").convert("RGB")
a = np.asarray(im).astype(np.float32) / 255
hsv = np.asarray(im.convert("HSV")).astype(np.float32) / 255
green = (hsv[..., 0] > 0.25) & (hsv[..., 0] < 0.5) & (hsv[..., 1] > 0.45) & (hsv[..., 2] > 0.35)
green[:, : 150] = False
green[:, 440:] = False  # the mark only, not the frame or the word
green[:20, :] = False
green[-20:, :] = False
lab, n = ndimage.label(green)
sizes = ndimage.sum(green, lab, range(1, n + 1))
keep = np.isin(lab, 1 + np.nonzero(sizes > 300)[0])
up = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).resize((im.size[0] * 4, im.size[1] * 4), Image.BICUBIC)).astype(np.float32) / 255
f = ndimage.gaussian_filter(up, 2.0)
rings = []
for line in contourpy.contour_generator(z=f, line_type="Separate").lines(0.5):
    if len(line) > 20:
        rings.append(line[::3] / 4)
pts = np.vstack(rings)
x0, x1, y0, y1 = pts[:, 0].min(), pts[:, 0].max(), pts[:, 1].min(), pts[:, 1].max()
cx, cy, h = (x0 + x1) / 2, (y0 + y1) / 2, y1 - y0
out = [[[round((x - cx) / h, 5), round((cy - y) / h, 5)] for x, y in r] for r in rings]
(ROOT / "build/logo.json").write_text(json.dumps({"rings": out, "aspect": round((x1 - x0) / h, 4)}))
chk = im.copy()
d = ImageDraw.Draw(chk)
for r in rings:
    d.line([tuple(p) for p in r] + [tuple(r[0])], fill=(255, 0, 255), width=2)
chk.save(ROOT / "build/logo-check.png")
print(len(out), "rings, aspect", round((x1 - x0) / h, 3))

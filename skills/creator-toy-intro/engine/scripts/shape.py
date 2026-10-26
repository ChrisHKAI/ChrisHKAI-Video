"""A flat mark from a picture as outline polygons, centred, in units of its
own height, for Blender to extrude (isnail's 公众号 mark became the snail's
shell). The mark is picked by colour inside a window of the picture.

film.json "cta.prop.shape": { "image": picture, "hue": [lo, hi], "minSat", "minVal",
  "x": [x0, x1] and "marginY": the window in px, "minArea": smallest blob kept (px²) }
  → build/logo.json ({"rings": [...], "aspect": w / h}) and build/logo-check.png

usage: FILM=<film folder> python3 engine/scripts/shape.py
"""
import json
import sys
from pathlib import Path

import contourpy
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON  # noqa: E402

C = FILM_JSON["cta"]["prop"]["shape"]
im = Image.open(FILM / C["image"]).convert("RGB")
hsv = np.asarray(im.convert("HSV")).astype(np.float32) / 255
lo, hi = C["hue"]
mark = (hsv[..., 0] > lo) & (hsv[..., 0] < hi) & (hsv[..., 1] > C["minSat"]) & (hsv[..., 2] > C["minVal"])
x0, x1 = C.get("x", [0, im.size[0]])
my = C.get("marginY", 0)
mark[:, :x0] = False
mark[:, x1:] = False  # the mark only, not a frame or a word beside it
if my:
    mark[:my, :] = False
    mark[-my:, :] = False
lab, n = ndimage.label(mark)
sizes = ndimage.sum(mark, lab, range(1, n + 1))
keep = np.isin(lab, 1 + np.nonzero(sizes > C.get("minArea", 300))[0])
up = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).resize((im.size[0] * 4, im.size[1] * 4), Image.BICUBIC)).astype(np.float32) / 255
f = ndimage.gaussian_filter(up, 2.0)
rings = []
for line in contourpy.contour_generator(z=f, line_type="Separate").lines(0.5):
    if len(line) > 20:
        rings.append(line[::3] / 4)
pts = np.vstack(rings)
bx0, bx1, by0, by1 = pts[:, 0].min(), pts[:, 0].max(), pts[:, 1].min(), pts[:, 1].max()
cx, cy, h = (bx0 + bx1) / 2, (by0 + by1) / 2, by1 - by0
out = [[[round((x - cx) / h, 5), round((cy - y) / h, 5)] for x, y in r] for r in rings]
(FILM / "build").mkdir(exist_ok=True)
(FILM / "build/logo.json").write_text(json.dumps({"rings": out, "aspect": round((bx1 - bx0) / h, 4)}))
chk = im.copy()
d = ImageDraw.Draw(chk)
for r in rings:
    d.line([tuple(p) for p in r] + [tuple(r[0])], fill=(255, 0, 255), width=2)
chk.save(FILM / "build/logo-check.png")
print(len(out), "rings, aspect", round((bx1 - bx0) / h, 3))

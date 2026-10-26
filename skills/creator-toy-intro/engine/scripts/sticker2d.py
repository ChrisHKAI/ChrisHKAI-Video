"""Lifts the 2D mascot drawn on a cover out as a sticker with a cream rim: the
flat card the toy turns into (and peels back out of), so the drawing and the
toy are never on screen together.

film.json "sticker2d": { "from": cover picture, "cardWidth": the cover's
width in design px, "crop": [x0, y0, x1, y1] round the drawing in design px }
  → assets/sticker2d.png (RGBA) and build/sticker2d.json ({"uv": [u0, v0, u1, v1]} in the cover)

usage: FILM=<film folder> python3 engine/scripts/sticker2d.py
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON  # noqa: E402

C = FILM_JSON["sticker2d"]
full = Image.open(FILM / C["from"]).convert("RGB")
W, H = full.size
S = W / C.get("cardWidth", W)  # design px → cover px
x0, y0, x1, y1 = [int(v * S) for v in C["crop"]]
crop = full.crop((x0, y0, x1, y1))
a = np.asarray(crop.convert("HSV")).astype(np.float32) / 255
dark = (a[..., 2] < C.get("outline", 0.28))
# the black outline encloses the drawing; close its gaps, fill, keep the biggest piece
m = ndimage.binary_closing(dark, structure=np.ones((5, 5)), iterations=2)
m = ndimage.binary_fill_holes(m)
lab, n = ndimage.label(m)
sizes = ndimage.sum(m, lab, range(1, n + 1))
body = lab == (1 + int(np.argmax(sizes)))
body = ndimage.binary_fill_holes(ndimage.binary_closing(body, iterations=3))
# the cream rim: up to `rim` px out, brighter and less saturated than the paper behind
R = C.get("rim", 12)
dist = ndimage.distance_transform_edt(~body)
rim = (dist <= R) & (a[..., 2] > 0.76) & (a[..., 1] < 0.32)
sticker = body | rim | (dist <= 3)
sticker = ndimage.binary_closing(sticker, structure=np.ones((3, 3)), iterations=3)
sticker = ndimage.binary_fill_holes(sticker)
sticker = ndimage.binary_opening(sticker, structure=np.ones((3, 3)), iterations=2) & (dist <= R)
lab, n = ndimage.label(sticker)
sizes = ndimage.sum(sticker, lab, range(1, n + 1))
sticker = lab == (1 + int(np.argmax(sizes)))
alpha = Image.fromarray((sticker * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
rgba = crop.copy()
rgba.putalpha(alpha)
bb = rgba.getbbox()
rgba = rgba.crop(bb)
(FILM / "assets").mkdir(exist_ok=True)
rgba.save(FILM / "assets/sticker2d.png")
u0, v0 = (x0 + bb[0]) / W, (y0 + bb[1]) / H
u1, v1 = (x0 + bb[2]) / W, (y0 + bb[3]) / H
(FILM / "build").mkdir(exist_ok=True)
(FILM / "build/sticker2d.json").write_text(json.dumps({"uv": [round(u0, 5), round(v0, 5), round(u1, 5), round(v1, 5)]}))
chk = Image.new("RGB", rgba.size, (40, 200, 90))
chk.paste(rgba, (0, 0), rgba)
chk.save(FILM / "build/sticker2d-check.png")
print("sticker", rgba.size, "uv", [round(v, 4) for v in (u0, v0, u1, v1)])

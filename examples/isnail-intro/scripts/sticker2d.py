"""Cuts the 2D mascot sticker out of the 《自媒体很苦》 cover: the flat card he
turns into at the end of act 3 (and peels back off as at 24 s), so that the
3D toy and the drawing are never on screen together.

The drawing is a die-cut sticker: black outline, then a cream border. The
silhouette is the filled black outline; the border is the bright, warm rim
around it (at most 12 px wide), so no newsprint comes along.

usage: python3 scripts/sticker2d.py
  → assets/sticker2d.png (RGBA crop of assets/cover-full.png)
  → build/sticker2d.json ({"uv": [u0, v0, u1, v1]} of the crop in the cover)
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
full = Image.open(ROOT / "assets/cover-full.png").convert("RGB")
W, H = full.size
S = W / 1030  # card px → cover px (see scripts/cover.py)
x0, y0, x1, y1 = int(495 * S), 0, int(745 * S), int(215 * S)
crop = full.crop((x0, y0, x1, y1))
a = np.asarray(crop.convert("HSV")).astype(np.float32) / 255
dark = (a[..., 2] < 0.28)
# the black outline encloses him; close its gaps, fill, keep the biggest piece
m = ndimage.binary_closing(dark, structure=np.ones((5, 5)), iterations=2)
m = ndimage.binary_fill_holes(m)
lab, n = ndimage.label(m)
sizes = ndimage.sum(m, lab, range(1, n + 1))
body = lab == (1 + int(np.argmax(sizes)))
body = ndimage.binary_fill_holes(ndimage.binary_closing(body, iterations=3))
# the cream rim: up to ~12 px out, brighter and warmer than the newsprint behind
dist = ndimage.distance_transform_edt(~body)
rim = (dist <= 12) & (a[..., 2] > 0.76) & (a[..., 1] < 0.32)
sticker = body | rim | (dist <= 3)
sticker = ndimage.binary_closing(sticker, structure=np.ones((3, 3)), iterations=3)
sticker = ndimage.binary_fill_holes(sticker)
sticker = ndimage.binary_opening(sticker, structure=np.ones((3, 3)), iterations=2) & (dist <= 12)
lab, n = ndimage.label(sticker)
sizes = ndimage.sum(sticker, lab, range(1, n + 1))
sticker = lab == (1 + int(np.argmax(sizes)))
alpha = Image.fromarray((sticker * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
rgba = crop.copy()
rgba.putalpha(alpha)
bb = rgba.getbbox()
rgba = rgba.crop(bb)
(ROOT / "assets").mkdir(exist_ok=True)
rgba.save(ROOT / "assets/sticker2d.png")
u0, v0 = (x0 + bb[0]) / W, (y0 + bb[1]) / H
u1, v1 = (x0 + bb[2]) / W, (y0 + bb[3]) / H
(ROOT / "build/sticker2d.json").write_text(json.dumps({"uv": [round(u0, 5), round(v0, 5), round(u1, 5), round(v1, 5)]}))
chk = Image.new("RGB", rgba.size, (40, 200, 90))
chk.paste(rgba, (0, 0), rgba)
chk.save(ROOT / "build/sticker2d-check.png")
print("sticker", rgba.size, "uv", [round(v, 4) for v in (u0, v0, u1, v1)])

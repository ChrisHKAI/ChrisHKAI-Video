"""Depth of the Steve Jobs portrait (reference/tim/steve-jobs-bw.jpg) with
Depth-Anything-V2-Small, plus a matte of the man against the white page.

Then the relief mesh: a grid over the matte pushed out by the depth, its
edges rolled back so the head and shoulders read round from up to ~35° off the
front (scripts/relief.py builds it in Blender).

usage: python3 scripts/depth.py [--mesh-only]
  → build/jobs-photo/{photo.png, depth.npy, matte.png, depth.png, relief.npz}
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build/jobs-photo"
OUT.mkdir(parents=True, exist_ok=True)


def _depth_field(depth_ratio, roll, w, s, d, m):
    """Normalised disparity → metres, the hand brought in, the edges rolled back."""
    dm = d[m]
    lo, hi = np.percentile(dm, 1), np.percentile(dm, 99.7)
    v = np.clip((d - lo) / (hi - lo), 0, 1.05)
    # the hand stands far out from the chin in the estimate: bring it in
    v = np.where(v > 0.5, 0.5 + (v - 0.5) * 0.4, v)
    z = v * depth_ratio * w * s
    # roll the edges back: distance to the silhouette (px) → a quarter round
    dist = ndimage.distance_transform_edt(m)
    R = roll * w
    t = np.clip(dist / R, 0, 1)
    z = z * (0.35 + 0.65 * np.sqrt(1 - (1 - t) ** 2)) - (1 - np.sqrt(1 - (1 - t) ** 2)) * R * s * 0.8
    return ndimage.gaussian_filter(z, 0.8), v


def _grid(z, m, w, h, s, step):
    ys, xs = np.mgrid[0:h:step, 0:w:step]
    idx = -np.ones(ys.shape, dtype=np.int64)
    inside = ndimage.binary_erosion(m, iterations=1)[ys, xs]
    # stay a pixel inside the matte: its edge pixels are half white page
    idx[inside] = np.arange(int(inside.sum()))
    X = (xs[inside] - w / 2) * s
    Y = (h - ys[inside]) * s
    Z = z[ys[inside], xs[inside]]
    uv = np.stack([xs[inside] / (w - 1), 1 - ys[inside] / (h - 1)], 1)
    a, b, c, e = idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]
    ok = (a >= 0) & (b >= 0) & (c >= 0) & (e >= 0)
    return np.stack([X, Y, Z], 1), uv, np.stack([a[ok], e[ok], c[ok], b[ok]], 1)


def relief_geometry(height=1.0, step=2, depth_ratio=0.62, roll=0.06):
    """The relief (vertices, uvs, quads, in units of its height) and a backing
    layer that fills in the chest behind the hand, plus the backing's picture."""
    photo = Image.open(OUT / "photo.png").convert("RGB")
    w, h = photo.size
    d = np.load(OUT / "depth.npy").astype(np.float64)
    m = np.asarray(Image.open(OUT / "matte.png")) > 127
    s = height / h
    z, v = _depth_field(depth_ratio, roll, w, s, d, m)
    V, UV, Q = _grid(z, m, w, h, s, step)
    # drop the faces stretched across the step from the hand to the chest
    zq, yq = V[Q, 2], V[Q, 1].mean(1)
    Q = Q[((zq.max(1) - zq.min(1)) < 0.022 * height) | (yq > 0.42 * height)]
    # the hand: the near blob in the lower half; behind it, the chest and chin
    # carried in from the nearest pixels round it, a little further back
    yy = np.arange(h)[:, None] * np.ones((1, w))
    near = (v > 0.56) & (yy > h * 0.55) & m
    lab, n = ndimage.label(near)
    if n:
        sizes = ndimage.sum(near, lab, range(1, n + 1))
        near = lab == (1 + int(np.argmax(sizes)))
    hand = ndimage.binary_dilation(near, iterations=7)
    _, (iy, ix) = ndimage.distance_transform_edt(hand, return_indices=True)
    zb = ndimage.gaussian_filter(z[iy, ix], 6) - 0.004 * height
    pix = np.asarray(photo, dtype=np.float32)
    fill = pix[iy, ix]
    for c in range(3):
        fill[..., c] = ndimage.gaussian_filter(fill[..., c], 5)
    Image.fromarray(np.where(hand[..., None], fill, pix).clip(0, 255).astype(np.uint8)).save(OUT / "photo-behind.png")
    region = ndimage.binary_dilation(hand, iterations=30) & m
    Vb, UVb, Qb = _grid(zb, region, w, h, s, step)
    return (V, UV, Q), (Vb, UVb, Qb)


def save_relief():
    (V, UV, Q), (Vb, UVb, Qb) = relief_geometry()
    np.savez_compressed(OUT / "relief.npz", V=V.astype(np.float32), UV=UV.astype(np.float32), Q=Q.astype(np.int32),
                        Vb=Vb.astype(np.float32), UVb=UVb.astype(np.float32), Qb=Qb.astype(np.int32))
    print("relief", V.shape, Q.shape, "behind", Vb.shape, Qb.shape)


if "--mesh-only" in sys.argv:
    save_relief()
    sys.exit()

src = Image.open(ROOT.parent.parent / "reference/tim/steve-jobs-bw.jpg").convert("RGB")
# the man only: the name and dates sit in the left third of the page
crop = src.crop((235, 0, src.width, src.height))
# twice the size, sharpened a little, so the relief and its texture hold up close
big = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
big.save(OUT / "photo.png")

from transformers import pipeline  # noqa: E402

pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device="mps")
res = pipe(big)
d = np.asarray(res["predicted_depth"].squeeze().cpu().numpy(), dtype=np.float32)
d = np.asarray(Image.fromarray(d).resize(big.size, Image.BICUBIC))
np.save(OUT / "depth.npy", d)
v = (d - d.min()) / (d.max() - d.min())
Image.fromarray((v * 255).astype(np.uint8)).save(OUT / "depth.png")

# matte: everything not connected to the white border
g = np.asarray(big.convert("L"), dtype=np.float32)
white = g > 238
lab, _ = ndimage.label(white)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
fg = ndimage.binary_opening(~bg, iterations=2)
fg = ndimage.binary_fill_holes(fg)
lab2, n = ndimage.label(fg)
if n > 1:
    sizes = ndimage.sum(fg, lab2, range(1, n + 1))
    fg = lab2 == (1 + int(np.argmax(sizes)))
Image.fromarray((fg * 255).astype(np.uint8)).save(OUT / "matte.png")
print("photo", big.size, "depth", d.shape, float(d.min()), float(d.max()), "matte", fg.mean())
save_relief()

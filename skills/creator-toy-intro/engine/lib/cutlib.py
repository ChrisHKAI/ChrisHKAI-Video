"""Cutting a picture into pieces that push out of a 3D wall: colour classes,
masks, outline rings in UV (0..1, v down), and patching the paper where a
piece leaves a hole. A film's cover recipe (films/<f>/recipes/cover-*.py)
names its pieces with these; the wall in Blender extrudes the rings.
"""
import contourpy
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage


def hsv(img):
    """hue, saturation, value arrays in 0..1"""
    a = np.asarray(img.convert("HSV")).astype(np.float32) / 255
    return a[..., 0], a[..., 1], a[..., 2]


def region(shape, x0, y0, x1, y1):
    H, W = shape
    m = np.zeros((H, W), bool)
    m[max(0, y0):y1, max(0, x0):x1] = True
    return m


def poly_mask(size, points):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return np.asarray(m) > 127


def uv(points, W, H):
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


def rings(mask, W, H, min_area=60, tol=0.8, close=2, hole=120, fill=False, scale=1.0):
    """Outline rings (UV) of a mask. `scale` is working px per design px:
    areas grow with its square, tolerances with it."""
    m = ndimage.binary_closing(mask, iterations=close) if close else mask
    m = ndimage.binary_opening(m, iterations=1)
    if fill:
        m = ndimage.binary_fill_holes(m)
    elif hole:  # grain and scratches in the print: fill holes smaller than `hole` px²
        lab, n = ndimage.label(~m)
        if n:
            sizes = ndimage.sum(~m, lab, range(1, n + 1))
            m = m | np.isin(lab, 1 + np.nonzero(sizes < hole * scale * scale)[0])
    f = ndimage.gaussian_filter(m.astype(np.float32), 1.0)
    out = []
    for line in contourpy.contour_generator(z=f, line_type="Separate").lines(0.5):
        if len(line) < 6:
            continue
        x, y = line[:, 0], line[:, 1]
        if 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1))) < min_area * scale * scale:
            continue
        out.append(uv(simplify(line, tol * scale).tolist(), W, H))
    return out


def largest(mask):
    lab, n = ndimage.label(mask)
    if not n:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))


def clone(dst, src_xy, box_, feather=10):
    """Copy a patch from src_xy (working px) over box_ (working px), feathered."""
    x0, y0, x1, y1 = box_
    sx, sy = [int(round(v)) for v in src_xy]
    patch = dst.crop((sx, sy, sx + x1 - x0, sy + y1 - y0))
    mask = Image.new("L", patch.size, 0)
    ImageDraw.Draw(mask).rectangle((feather, feather, patch.size[0] - feather, patch.size[1] - feather), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather / 2))
    dst.paste(patch, (x0, y0), mask)


def fill(img, poly, detail_box, feather=6, scale=1.0, protect=None):
    """Fill poly (working px) from its surroundings, then put the paper grain
    back (taken from detail_box). `protect`: a mask never borrowed from."""
    a = np.asarray(img).astype(np.float32)
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    m = np.asarray(m.filter(ImageFilter.MaxFilter(9))).astype(np.float32) / 255
    keep = (1 - m) * (1 - (ndimage.maximum_filter(protect.astype(np.float32), 15) if protect is not None else 0))
    out = None
    for sig in (64, 24, 10):  # normalized convolution, finer where the edge is near
        num = np.stack([ndimage.gaussian_filter(a[..., c] * keep, sig) for c in range(3)], -1)
        den = ndimage.gaussian_filter(keep, sig)[..., None]
        est = num / np.maximum(den, 1e-30)
        w = np.clip(den / 0.25, 0, 1)
        out = est if out is None else w * est + (1 - w) * out
    x0, y0, x1, y1 = detail_box
    src = np.asarray(img).astype(np.float32)[y0:y1, x0:x1]
    grain = src - np.stack([ndimage.gaussian_filter(src[..., c], 3) for c in range(3)], -1)
    reps = (img.size[1] // grain.shape[0] + 1, img.size[0] // grain.shape[1] + 1, 1)
    grain = np.tile(grain, reps)[: img.size[1], : img.size[0]]
    soft = ndimage.gaussian_filter(m, feather * scale / 2)[..., None]
    res = np.asarray(img).astype(np.float32) * (1 - soft) + (out + grain) * soft
    return Image.fromarray(np.clip(res, 0, 255).astype(np.uint8))


def check_image(img, pieces, colour_of):
    """Every outline drawn over the picture, for a look before rendering."""
    chk = img.copy()
    d = ImageDraw.Draw(chk)
    W, H = img.size
    for p in pieces:
        for r in p["rings"]:
            d.line([(u * W, v * H) for u, v in r + r[:1]], fill=colour_of(p), width=2)
    return chk

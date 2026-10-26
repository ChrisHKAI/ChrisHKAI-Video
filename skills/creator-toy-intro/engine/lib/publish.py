"""Where the film is published (engine/lib/platforms.json): the platforms in
film.json "publish", their covers and the controls each app lays over the
picture, and the end card's content found in a frame."""
import json
import sys

import numpy as np
from scipy.ndimage import gaussian_filter

from film import FILM_JSON, SKILL

TABLE = json.loads((SKILL / "engine/lib/platforms.json").read_text())
PLATFORMS = TABLE["platforms"]
SAFE = TABLE["safe"]


def platforms(argv):
    """The platform ids: --publish a,b, else film.json "publish", else the stage theme's platform."""
    ids = argv[argv.index("--publish") + 1].split(",") if "--publish" in argv else FILM_JSON.get("publish") or [
        p for p, v in PLATFORMS.items() if FILM_JSON["theme"] in v["themes"]]
    if not ids:
        sys.exit(f"no platform for theme {FILM_JSON['theme']}: list them in film.json \"publish\" ({', '.join(PLATFORMS)})")
    unknown = [p for p in ids if p not in PLATFORMS]
    if unknown:
        sys.exit(f"unknown platform {unknown} in film.json \"publish\"; known: {', '.join(PLATFORMS)}")
    return ids


def orientation(w, h):
    return "portrait" if h > w else "landscape"


def content_box(frame):
    """The end card's content (labels, toy, prop) as (x0, y0, x1, y1) px: sharp
    edges across x. The studio's floor line runs along x and its reflections
    are soft, so neither counts. Meant for the end card on the bare studio."""
    W, H = frame.size
    g = gaussian_filter(np.asarray(frame.convert("L"), dtype=np.float32) / 255, 1.5)
    edges = np.abs(np.diff(g, axis=1)) > 0.03
    cols = np.flatnonzero(edges.sum(0) > H * 0.004)
    rows = np.flatnonzero(edges.sum(1) > W * 0.004)
    return (int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1) if len(cols) and len(rows) else (0, 0, W, H)


def past(content, box):
    """How far content runs past each side of box (px), only the sides it crosses."""
    over = {"left": box[0] - content[0], "top": box[1] - content[1], "right": content[2] - box[2], "bottom": content[3] - box[3]}
    return {k: v for k, v in over.items() if v > 0}


def overlap(a, b):
    """The part of box a inside box b, or None."""
    x0, y0, x1, y1 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    return (x0, y0, x1, y1) if x1 > x0 and y1 > y0 else None


def font(size, cjk=False):
    """A label face for check sheets; cjk for platform names in Chinese."""
    from PIL import ImageFont
    faces = ("/System/Library/Fonts/Menlo.ttc", "C:/Windows/Fonts/consola.ttf")
    if cjk:
        faces = ("/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/Hiragino Sans GB.ttc", "C:/Windows/Fonts/msyh.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc")
    for f in faces:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()

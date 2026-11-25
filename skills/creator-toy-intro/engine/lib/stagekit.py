"""A stage for a story's frames: the storyboard on paper (references/frames.md). A frame is composed as the film
will frame it: the toy in the pose it takes, their own pictures standing as walls, signs and screens, boxes, the
words that are on screen, all in one perspective. It is drawn with Pillow in a second, so a story can be seen,
and changed, before anything is built.

    import sys; sys.path.insert(0, "<skill>/engine/lib")
    from stagekit import Stage, toy, load, text, paper, board, stamp, mark
    st = Stage(cam=(0, 1.1, -5.0), pitch=5, sky=("#EFE6D6", "#F7F1E6"), floor=("#EBDFCB", "#F3EADB"))
    st.card(load(film / "assets/cover.jpg"), 1.8, 0.5, 2.2, height=1.2, yaw=-10)   # their cover, standing
    st.box(-1.2, 0, 0.4, 1.2, 0.3, 1.0, "#F0842C")                                  # a block: x, y, z, w, h, d
    st.sprite(toy(film, "startle"), -1.2, 0.4, y=0.3)                               # the toy, in a pose, on it
    st.screen(mark("!", 110), *st.at((-1.2, 1.5, 0.4)))                             # what it feels, over its head
    st.screen(paper("铁柱AGI", 64), 300, 160, rot=-3, shadow=110)                    # a label on the frame
    st.save(film / "research/frames/A-4.jpg")

The world is in toy heights (a toy is 1 tall): x to the right, y up, z away from the camera. `cam` is where the
camera stands, `pitch` how far it looks down (degrees), `fov` its angle. Things are drawn far to near. A frame
has the film's shape: Stage() is 1600 × 900, a 9:16 film's is Stage(w=900, h=1600).
- Stage.card(picture, x, y, z, height=|width=, yaw, tilt, glow, dim, blur): a picture standing (a cover, a
  screen, a page); Stage.lying(picture, x, z, width): lying on the floor; Stage.quad: any four corners.
- Stage.box(x, y, z, w, h, d, colour, yaw, tex={"front": picture}): a block, its faces lit, a picture on a face.
- Stage.sprite(cut-out, x, z, y, height): the toy (toy(film, pose)) or anything cut out, standing there, with its
  shadow; Stage.shadow, Stage.floor_poly (a pit, a runway, a pool of light), Stage.poly.
- Stage.screen(picture, x, y, rot, shadow): straight on the frame, in frame pixels (0–1600, 0–900): a label, a
  mark; Stage.at(point) says where a point of the world lands. Stage.lines, burst, confetti: a move, a hit.
- text, paper (a torn label), board (a sign, a bubble; marks={"不": "#D8382D"} paints one character), stamp,
  arrow_sign, mark ("!", "?", "…", "sweat", "heart": the toy's face does not move, so what it feels is drawn).

Run the frames' script a second time with STAGEKIT_SILENT=1: every word this kit lettered is blurred where it
stands (on a block's top, at a slant, on a sign) and Stage.save writes research/frames/silent/A-4.drawn.jpg, the
picture the reading without words starts from. Lettering drawn outside the kit is found by text recognition only.

The toy's poses are rendered once from the film's own toy (`run.mjs poses`, seconds each: engine/lib/poses.json
names them, film.json "poses" adds a film's own); before the toy is built, toy() gives its picture's disc.
"""
import json
import math
import os
import random
import sys
import unicodedata
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))

S = 2  # drawn twice the size, then scaled down: clean edges
_FALLBACK = {  # a heavy face with Chinese, then a plain one, wherever this computer keeps one
    "words": [("/System/Library/Fonts/Hiragino Sans GB.ttc", 2), ("C:/Windows/Fonts/msyhbd.ttc", 0), ("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 0),
              (str(Path.home() / ".chrishkai-video/fonts/SourceHanSansSC-Bold.otf"), 0)],
    "plain": [("/System/Library/Fonts/Hiragino Sans GB.ttc", 0), ("C:/Windows/Fonts/msyh.ttc", 0), ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0)],
}
FACES = {}  # a film's own: FACES["words"] = (path, index), from film.json "type" (faces(film) sets them)
# STAGEKIT_SILENT=1: the same frames with every word this kit letters blurred past reading, where it stands, at its
# slant, in its colour (a label stays a label, a sign a sign), and Stage.save puts them in silent/. Marks (！ ？) stay.
SILENT = os.environ.get("STAGEKIT_SILENT") == "1"


def _wordy(s):
    return any(unicodedata.category(ch)[0] in "LN" for ch in s)


def hush(im, size):
    """Lettering (a picture of it) blurred past reading, the same size: a soft smudge of its own ink where it stood,
    fading at its edges (blurred in its ink's colour, never towards the black of the empty around it)."""
    r = max(3.0, 0.3 * size)
    pad = int(2 * r)
    a = np.asarray(im.convert("RGBA"), dtype=np.float32) / 255.0
    big = np.zeros((a.shape[0] + 2 * pad, a.shape[1] + 2 * pad, 4), np.float32)
    big[pad:-pad, pad:-pad] = a
    big[..., :3] *= big[..., 3:4]  # premultiplied: the empty around the strokes adds no colour

    def blur(ch):
        return np.asarray(Image.fromarray((ch * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32) / 255.0
    out = np.stack([blur(big[..., k]) for k in range(4)], -1)[pad:-pad, pad:-pad]
    al = out[..., 3:4]
    rgb = np.where(al > 1e-3, out[..., :3] / np.maximum(al, 1e-3), 0)
    h, w = al.shape[:2]
    edge = max(2, int(0.6 * r))  # fade to nothing at the picture's own edges: a patch, never a box
    fy = np.clip(np.minimum(np.arange(h), h - 1 - np.arange(h)) / edge, 0, 1)[:, None]
    fx = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / edge, 0, 1)[None, :]
    al = np.clip(al[..., 0] * 1.5, 0, 1) * fy * fx
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), al]) * 255).astype(np.uint8))


def faces(film):
    """Letter the frames in the film's own faces (film.json "type"), where it has chosen them."""
    try:
        from fonts import chosen, face
        F = json.loads((Path(film) / "film.json").read_text())
        roles = chosen(F.get("type")) if F.get("type") else None
        path, index, _ = face("heavy", chosen_roles=roles, extra_dirs=(str(Path(film) / "fonts"),))
        FACES["words"] = (path, index)
    except (SystemExit, OSError, ImportError, ValueError, KeyError, TypeError):
        pass


@lru_cache(maxsize=None)
def _font(key, size):
    for path, index in ([FACES[key]] if key in FACES else []) + _FALLBACK.get(key, _FALLBACK["words"]) + _FALLBACK["words"]:
        try:
            return ImageFont.truetype(path, int(size), index=index)
        except OSError:
            continue
    return ImageFont.load_default()


def font(name, size):
    return _font("plain" if name in ("regular", "plain") else "words", int(size))


def rgb(c, a=255):
    if isinstance(c, tuple):
        return c if len(c) == 4 else (*c, a)
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)


def shade(c, k):
    r, g, b, a = rgb(c)
    if k <= 1:
        return (int(r * k), int(g * k), int(b * k), a)
    k -= 1
    return (int(r + (255 - r) * k), int(g + (255 - g) * k), int(b + (255 - b) * k), a)


def text(s, size, fill="#111111", face="bold", stroke=0, stroke_fill="#ffffff", spacing=0.12, align="center", track=0):
    """Lettering as a picture (tight to its ink). face: "bold" the film's words, "plain"; track: extra space
    between characters, in ems."""
    f = font(face, size)
    lines = s.split("\n")
    pad = stroke + 4
    if track:
        widths = [sum(f.getlength(ch) for ch in ln) + track * size * max(0, len(ln) - 1) for ln in lines]
    else:
        widths = [f.getlength(ln) for ln in lines]
    asc, desc = f.getmetrics()
    lh = int((asc + desc) * (1 + spacing))
    w, h = int(max(widths)) + 2 * pad, lh * len(lines) + 2 * pad
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, ln in enumerate(lines):
        x = pad + {"center": (w - 2 * pad - widths[i]) / 2, "left": 0, "right": w - 2 * pad - widths[i]}[align]
        y = pad + i * lh
        if track:
            for ch in ln:
                d.text((x, y), ch, font=f, fill=rgb(fill), stroke_width=stroke, stroke_fill=rgb(stroke_fill))
                x += f.getlength(ch) + track * size
        else:
            d.text((x, y), ln, font=f, fill=rgb(fill), stroke_width=stroke, stroke_fill=rgb(stroke_fill))
    box = im.getbbox()
    im = im.crop(box) if box else im
    return hush(im, size) if SILENT and _wordy(s) else im


def paper(s, size, paper_="#F3EAD7", ink="#141414", face="bold", pad=0.32, seed=1, tear=0.07, *, paper=None, fill=None):
    """A torn-paper label with lettering on it (accepts paper= or fill= aliases alongside positional paper_)."""
    bg = paper if paper is not None else (fill if fill is not None else paper_)
    t = text(s, size, ink, face)
    px, py = int(size * pad * 1.25), int(size * pad)
    w, h = t.width + 2 * px, t.height + 2 * py
    rnd = random.Random(seed)
    j = size * tear
    pts = []
    n = max(6, w // int(size * 0.5))
    for i in range(n + 1):
        pts.append((i * w / n, rnd.uniform(0, j)))
    for i in range(1, 4):
        pts.append((w - rnd.uniform(0, j), i * h / 4))
    for i in range(n, -1, -1):
        pts.append((i * w / n, h - rnd.uniform(0, j)))
    for i in range(3, 0, -1):
        pts.append((rnd.uniform(0, j), i * h / 4))
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).polygon(pts, fill=rgb(bg))
    im.alpha_composite(t, (px, py))
    return im


def board(s, size, fill="#FFFFFF", ink="#141414", face="bold", pad=0.3, radius=0.18, border=None, border_w=0.06, spacing=0.12, marks=None, align="center"):
    """A flat board (a sign, a card, a bubble) with lettering; marks: {character: colour} paints those characters."""
    t = text(s, size, ink, face, spacing=spacing, align=align)
    if marks:
        # paint single characters in another colour (the 不 of a sign)
        f = font(face, size)
        lines = s.split("\n")
        asc, desc = f.getmetrics()
        lh = int((asc + desc) * (1 + spacing))
        full = Image.new("RGBA", (int(max(f.getlength(ln) for ln in lines)) + 8, lh * len(lines) + 8), (0, 0, 0, 0))
        d = ImageDraw.Draw(full)
        wmax = max(f.getlength(ln) for ln in lines)
        for i, ln in enumerate(lines):
            x = 4 + ((wmax - f.getlength(ln)) / 2 if align == "center" else 0)
            for ch in ln:
                d.text((x, 4 + i * lh), ch, font=f, fill=rgb(marks.get(ch, ink)))
                x += f.getlength(ch)
        t = full.crop(full.getbbox())
        if SILENT and _wordy(s):
            t = hush(t, size)
    px, py = int(size * pad * 1.2), int(size * pad)
    w, h = t.width + 2 * px, t.height + 2 * py
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=int(size * radius), fill=rgb(fill), outline=rgb(border) if border else None, width=max(1, int(size * border_w)) if border else 0)
    im.alpha_composite(t, (px, py))
    return im


def fit(im, w=None, h=None):
    if w and not h:
        h = round(im.height * w / im.width)
    elif h and not w:
        w = round(im.width * h / im.height)
    return im.resize((max(1, int(w)), max(1, int(h))), Image.LANCZOS)


def load(path, crop=None):
    im = Image.open(path).convert("RGBA")
    if crop:
        w, h = im.size
        x0, y0, x1, y1 = crop
        im = im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))
    return im


def antiglare(im, peak_rgb=(218, 203, 174), gamma=1.35):
    """Map stark-white web/article screenshots onto warm archival paper so stage emission never blooms out dark text."""
    rgba_in = im.convert("RGBA")
    arr = np.asarray(rgba_in, dtype=np.float32) / 255.0
    curved = np.power(np.clip(arr[..., :3], 0.0, 1.0), float(gamma))
    scale = np.asarray(peak_rgb[:3], dtype=np.float32) / 255.0
    out_rgb = np.clip(curved * scale * 255.0, 0, 255).astype(np.uint8)
    out_a = np.clip(arr[..., 3:4] * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([out_rgb, out_a]))


def empty_avatar_socket(im, cx, cy, r, fill="#141824", outline=None, outline_w=4):
    """Mask out the circular 2D avatar inside a cropped profile card so no flat duplicate stays behind once the 3D toy pops out."""
    out = im.convert("RGBA").copy()
    d = ImageDraw.Draw(out)
    d.ellipse(
        (float(cx) - float(r), float(cy) - float(r), float(cx) + float(r), float(cy) + float(r)),
        fill=rgb(fill),
        outline=rgb(outline) if outline else None,
        width=max(1, int(outline_w)) if outline else 0,
    )
    return out


def card_socket_coords(im_or_size, cx, cy, r, card_w_m):
    """Convert pixel circle (cx, cy, r) on a card image into 3D card-local metres (lx, ly, diameter_m) for 0–2 s sticker placement."""
    w_px, h_px = im_or_size.size if hasattr(im_or_size, "size") else im_or_size
    m_per_px = float(card_w_m) / max(1.0, float(w_px))
    lx = (float(cx) - float(w_px) * 0.5) * m_per_px
    ly = (float(h_px) * 0.5 - float(cy)) * m_per_px
    return (round(lx, 6), round(ly, 6), round(2.0 * float(r) * m_per_px, 6))


def _coeffs(dst, src):
    A = []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    return np.linalg.solve(np.array(A, float), np.array(src, float).reshape(8))


class Stage:
    def __init__(self, w=1600, h=900, fov=30, cam=(0, 1.2, -7.0), pitch=7, sky=("#ECE3D3", "#F6F0E4"), floor=("#EADFCB", "#F1E8D8"), vignette=0.18):
        self.w, self.h = w * S, h * S
        self.F = self.h / (2 * math.tan(math.radians(fov) / 2))
        self.C = np.array(cam, float)
        p = math.radians(pitch)
        self.fwd = np.array([0, -math.sin(p), math.cos(p)])
        self.up = np.array([0, math.cos(p), math.sin(p)])
        self.items, self.shadows, self.overlays, self.glows = [], [], [], []
        self.sky, self.floor, self.vignette = sky, floor, vignette
        self.floors = []
        self.rnd = random.Random(7)

    # ── projection ──
    def cam_space(self, p):
        d = np.array(p, float) - self.C
        return d[0], float(d @ self.up), float(d @ self.fwd)

    def proj(self, p):
        x, y, z = self.cam_space(p)
        z = max(z, 0.05)
        return (self.w / 2 + self.F * x / z, self.h / 2 - self.F * y / z)

    def depth(self, p):
        return self.cam_space(p)[2]

    def px(self, p):
        """Pixels a unit is worth at this point."""
        return self.F / max(self.depth(p), 0.05)

    # ── things on the stage ──
    def floor_poly(self, pts, fill, y=0.0, blur=0):
        self.floors.append(([(x, y, z) for x, z in pts], fill, blur))

    def shadow(self, x, z, rx, rz=None, alpha=110, y=0.0):
        self.shadows.append((x, y, z, rx, rz or rx * 0.5, alpha))

    def quad(self, img, corners, depth=None, blur=0, glow=0, dim=1.0, key=None):
        """A picture on a flat piece: corners top-left, top-right, bottom-right, bottom-left, in the world."""
        d = depth if depth is not None else sum(self.depth(c) for c in corners) / 4

        def draw(canvas):
            pts = [self.proj(c) for c in corners]
            im = img
            if dim != 1.0:
                r, g, b, a = im.split()
                im = Image.merge("RGBA", (*[ch.point(lambda v: int(v * dim)) for ch in (r, g, b)], a))
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            x0, y0, x1, y1 = int(max(0, min(xs) - 2)), int(max(0, min(ys) - 2)), int(min(self.w, max(xs) + 2)), int(min(self.h, max(ys) + 2))
            if x1 <= x0 or y1 <= y0:
                return
            local = [(x - x0, y - y0) for x, y in pts]
            w, h = im.size
            layer = im.transform((x1 - x0, y1 - y0), Image.PERSPECTIVE, _coeffs(local, [(0, 0), (w, 0), (w, h), (0, h)]), Image.BICUBIC)
            if blur:
                layer = layer.filter(ImageFilter.GaussianBlur(blur * S))
            canvas.alpha_composite(layer, (x0, y0))
            if glow:
                self.glows.append((layer, (x0, y0), glow))
        self.items.append((d, draw))

    def poly(self, pts3, fill, outline=None, width=1, depth=None):
        d = depth if depth is not None else sum(self.depth(c) for c in pts3) / len(pts3)

        def draw(canvas):
            dr = ImageDraw.Draw(canvas)
            p2 = [self.proj(c) for c in pts3]
            dr.polygon(p2, fill=rgb(fill))
            if outline:
                dr.line(p2 + [p2[0]], fill=rgb(outline), width=int(width * S), joint="curve")
        self.items.append((d, draw))

    def box(self, x, y, z, w, h, d, color, yaw=0, top=None, front=None, side=None, tex=None, edge=None, shadow=True, depth=None, light=(1.0, 0.84, 0.68)):
        """A box standing with its base centre at (x, y, z). tex: {"front"|"top"|"left"|"right"|"back": picture}."""
        cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))

        def P(lx, ly, lz):
            return (x + lx * cy + lz * sy, y + ly, z - lx * sy + lz * cy)
        hw, hd = w / 2, d / 2
        faces = {  # corners as seen from outside: top-left, top-right, bottom-right, bottom-left
            "front": [P(-hw, h, -hd), P(hw, h, -hd), P(hw, 0, -hd), P(-hw, 0, -hd)],
            "back": [P(hw, h, hd), P(-hw, h, hd), P(-hw, 0, hd), P(hw, 0, hd)],
            "left": [P(-hw, h, hd), P(-hw, h, -hd), P(-hw, 0, -hd), P(-hw, 0, hd)],
            "right": [P(hw, h, -hd), P(hw, h, hd), P(hw, 0, hd), P(hw, 0, -hd)],
            "top": [P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd)],
            "bottom": [P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd)],
        }
        cols = {"top": top or shade(color, light[0]), "front": front or shade(color, light[1]), "back": shade(color, light[2]),
                "left": side or shade(color, light[2]), "right": side or shade(color, light[2] * 1.08), "bottom": shade(color, 0.5)}
        base_depth = depth if depth is not None else self.depth((x, y + h / 2, z))
        for name, cs in faces.items():
            a, b, c = (np.array(v, float) for v in cs[:3])
            n = np.cross(b - a, c - a)
            centre = sum(np.array(v, float) for v in cs) / 4
            if n @ (self.C - centre) <= 0:  # facing away (x right, y up, z away: a left-handed stage)
                continue
            dd = base_depth - 0.001 * (name == "top") - 0.002 * (name in ("front",))
            self.poly(cs, cols[name], outline=edge, width=1.2, depth=dd)
            if tex and name in tex:
                self.quad(tex[name], cs, depth=dd - 0.0005)
        if shadow and y < 0.02:
            self.shadow(x + 0.12 * w, z + 0.05, w * 0.62, d * 0.62 + 0.12, alpha=70)

    def sprite(self, cut, x, z, y=0.0, height=1.0, flip=False, rot=0, shadow=True, depth=None, blur=0, dim=1.0, shadow_r=0.36):
        """A cut-out standing at (x, y, z): the toy in a pose (toy(film, pose)), or thing(picture) `height` tall."""
        img, per_unit, feet, centre = cut.image, cut.per_unit, cut.feet, cut.centre
        def draw(canvas):
            im = img
            if flip:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            k = self.px((x, y, z)) * height / per_unit
            im2 = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
            cx_, fy_ = (im.width - centre if flip else centre) * k, feet * k
            if rot:
                im2 = im2.rotate(rot, resample=Image.BICUBIC, center=(cx_, fy_))
            if blur:
                im2 = im2.filter(ImageFilter.GaussianBlur(blur * S))
            if dim != 1.0:
                r, g, b, a = im2.split()
                im2 = Image.merge("RGBA", (*[ch.point(lambda v: int(v * dim)) for ch in (r, g, b)], a))
            sx, sy_ = self.proj((x, y, z))
            _paste_clipped(canvas, im2, int(sx - cx_), int(sy_ - fy_))
        self.items.append((depth if depth is not None else self.depth((x, y, z)), draw))
        if shadow:
            self.shadow(x, z, shadow_r * height, shadow_r * height * 0.45, alpha=95 if y < 0.05 else 55)

    def card(self, img, x, y, z, height=None, width=None, yaw=0, tilt=0, depth=None, blur=0, glow=0, dim=1.0, back=None):
        """A picture standing upright, its bottom centre at (x, y, z); yaw turns it, tilt leans it back (degrees)."""
        if height is None:
            height = width * img.height / img.width
        if width is None:
            width = height * img.width / img.height
        cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        ct, st = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
        hw = width / 2

        def P(lx, ly):
            lz = ly * st
            ly2 = ly * ct
            return (x + lx * cy + lz * sy, y + ly2, z - lx * sy + lz * cy)
        cs = [P(-hw, height), P(hw, height), P(hw, 0), P(-hw, 0)]
        self.quad(img, cs, depth=depth, blur=blur, glow=glow, dim=dim)
        return cs

    def lying(self, img, x, z, width, y=0.004, yaw=0, depth=None, dim=1.0):
        """A picture lying on the floor, its centre at (x, z); its top edge away from the camera."""
        d = width * img.height / img.width
        cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))

        def P(lx, lz):
            return (x + lx * cy + lz * sy, y, z - lx * sy + lz * cy)
        self.quad(img, [P(-width / 2, d / 2), P(width / 2, d / 2), P(width / 2, -d / 2), P(-width / 2, -d / 2)], depth=depth if depth is not None else 1e6 - 1, dim=dim)

    def screen(self, img, x, y, anchor="mm", rot=0, alpha=255, shadow=0):
        """A picture straight on the frame (a label, a mark over the toy's head), in the frame's own pixels
        (0–1600 across and 0–900 down, as the Stage was made)."""
        def draw(canvas):
            im = img.resize((img.width * S, img.height * S), Image.LANCZOS) if S != 1 else img
            if rot:
                im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
            if alpha != 255:
                im.putalpha(im.getchannel("A").point(lambda v: v * alpha // 255))
            ax = {"l": 0, "m": im.width / 2, "r": im.width}[anchor[0]]
            ay = {"t": 0, "m": im.height / 2, "b": im.height}[anchor[1]]
            px_, py_ = int(x * S - ax), int(y * S - ay)
            if shadow:
                sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
                sh.putalpha(im.getchannel("A").point(lambda v: v * shadow // 255))
                sh = sh.filter(ImageFilter.GaussianBlur(6 * S))
                _paste_clipped(canvas, sh, px_ + 4 * S, py_ + 6 * S)
            _paste_clipped(canvas, im, px_, py_)
        self.overlays.append(draw)

    def at(self, p):
        """Where a world point lands, in frame pixels (0–1600, 0–900)."""
        x, y = self.proj(p)
        return x / S, y / S

    def lines(self, pts, fill="#141414", width=3, dash=None):
        def draw(canvas):
            d = ImageDraw.Draw(canvas)
            p = [(x * S, y * S) for x, y in pts]
            if dash:
                for a, b in zip(p, p[1:]):
                    n = max(1, int(math.dist(a, b) / (dash * S)))
                    for i in range(0, n, 2):
                        d.line([(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n), (a[0] + (b[0] - a[0]) * (i + 1) / n, a[1] + (b[1] - a[1]) * (i + 1) / n)], fill=rgb(fill), width=int(width * S))
            else:
                d.line(p, fill=rgb(fill), width=int(width * S), joint="curve")
        self.overlays.append(draw)

    def burst(self, x, y, r0, r1, n=14, fill="#141414", width=4, seed=3):
        rnd = random.Random(seed)

        def draw(canvas):
            d = ImageDraw.Draw(canvas)
            for i in range(n):
                a = 2 * math.pi * (i + rnd.uniform(-0.25, 0.25)) / n
                k0, k1 = r0 * rnd.uniform(0.9, 1.1), r1 * rnd.uniform(0.75, 1.1)
                d.line([((x + math.cos(a) * k0) * S, (y + math.sin(a) * k0) * S), ((x + math.cos(a) * k1) * S, (y + math.sin(a) * k1) * S)], fill=rgb(fill), width=int(width * S))
        self.overlays.append(draw)

    def confetti(self, colors, n=60, box=(0, 0, 1600, 520), size=(8, 20), seed=5):
        rnd = random.Random(seed)

        def draw(canvas):
            for _ in range(n):
                w_, h_ = rnd.uniform(*size) * S, rnd.uniform(size[0] * 0.5, size[1] * 0.7) * S
                piece = Image.new("RGBA", (int(w_), int(h_)), rgb(rnd.choice(colors)))
                piece = piece.rotate(rnd.uniform(0, 180), expand=True, resample=Image.BICUBIC)
                _paste_clipped(canvas, piece, int(rnd.uniform(box[0], box[2]) * S), int(rnd.uniform(box[1], box[3]) * S))
        self.overlays.append(draw)

    # ── the frame ──
    def save(self, path, quality=92):
        """The frame → path; with STAGEKIT_SILENT=1, its wordless twin → path's folder/silent/<name>.drawn.jpg, which
        engine/scripts/silent.py starts from (it then blurs what the kit did not letter: their covers, screenshots)."""
        path = Path(path)
        if SILENT:
            path = path.parent / "silent" / (path.stem + ".drawn.jpg")
        path.parent.mkdir(parents=True, exist_ok=True)
        self.render().convert("RGB").save(path, quality=quality)
        return path

    def render(self):
        w, h = self.w, self.h
        # the horizon: where the floor meets the wall
        hz = int(self.h / 2 + self.F * (self.fwd[1] / self.fwd[2]))
        hz = max(0, min(h, hz))
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 255))
        grad = np.zeros((h, w, 4), np.uint8)
        top, bot = np.array(rgb(self.sky[0]), float), np.array(rgb(self.sky[1]), float)
        far, near = np.array(rgb(self.floor[0]), float), np.array(rgb(self.floor[1]), float)
        for yy in range(h):
            if yy < hz:
                t = yy / max(1, hz)
                grad[yy, :] = top + (bot - top) * t
            else:
                t = ((yy - hz) / max(1, h - hz)) ** 0.7
                grad[yy, :] = far + (near - far) * t
        canvas = Image.fromarray(grad)
        d = ImageDraw.Draw(canvas)
        for pts, fill, blur in self.floors:
            if blur:
                layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
                ImageDraw.Draw(layer).polygon([self.proj(p) for p in pts], fill=rgb(fill))
                canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur * S)))
            else:
                d.polygon([self.proj(p) for p in pts], fill=rgb(fill))
        if self.shadows:
            sh = Image.new("L", (w, h), 0)
            ds = ImageDraw.Draw(sh)
            for x, y, z, rx, rz, alpha in self.shadows:
                ring = [self.proj((x + rx * math.cos(a), y, z + rz * math.sin(a))) for a in np.linspace(0, 2 * math.pi, 28)]
                ds.polygon(ring, fill=alpha)
            sh = sh.filter(ImageFilter.GaussianBlur(9 * S))
            black = Image.new("RGBA", (w, h), (0, 0, 0, 255))
            black.putalpha(sh)
            canvas.alpha_composite(black)
        for _, draw in sorted(self.items, key=lambda it: -it[0]):
            draw(canvas)
        for layer, (x0, y0), k in self.glows:
            big = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            big.alpha_composite(layer, (x0, y0))
            big = big.filter(ImageFilter.GaussianBlur(38 * S))
            big.putalpha(big.getchannel("A").point(lambda v: int(v * k)))
            canvas = ImageChops.screen(canvas.convert("RGB"), Image.alpha_composite(Image.new("RGBA", (w, h), (0, 0, 0, 255)), big).convert("RGB")).convert("RGBA")
        for draw in self.overlays:
            draw(canvas)
        if self.vignette:
            yy, xx = np.mgrid[0:h, 0:w]
            r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
            v = np.clip(1 - self.vignette * np.clip(r - 0.55, 0, None) ** 2 * 2.2, 0, 1)
            arr = np.asarray(canvas.convert("RGB"), float) * v[..., None]
            canvas = Image.fromarray(arr.astype(np.uint8))
        return canvas.convert("RGB").resize((w // S, h // S), Image.LANCZOS)


def _paste_clipped(canvas, im, x, y):
    """alpha_composite that tolerates a picture hanging off the frame."""
    cw, ch = canvas.size
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(cw, x + im.width), min(ch, y + im.height)
    if x1 <= x0 or y1 <= y0:
        return
    canvas.alpha_composite(im.crop((x0 - x, y0 - y, x1 - x, y1 - y)), (x0, y0))


def arrow_sign(s, size, fill="#F08A2B", ink="#FFFFFF", point="right", face="bold"):
    t = text(s, size, ink, face)
    px, py = int(size * 0.5), int(size * 0.34)
    w, h = t.width + 2 * px, t.height + 2 * py
    tip = int(h * 0.55)
    im = Image.new("RGBA", (w + tip, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if point == "right":
        d.polygon([(0, 0), (w, 0), (w + tip, h / 2), (w, h), (0, h)], fill=rgb(fill))
        im.alpha_composite(t, (px, py))
    else:
        d.polygon([(tip, 0), (w + tip, 0), (w + tip, h), (tip, h), (0, h / 2)], fill=rgb(fill))
        im.alpha_composite(t, (tip + px, py))
    return im


def stamp(s, size, fill="#D8382D", ink="#FFFFFF", face="bold", ring=True):
    t = text(s, size, ink, face)
    px, py = int(size * 0.42), int(size * 0.26)
    w, h = t.width + 2 * px, t.height + 2 * py
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=int(size * 0.16), fill=rgb(fill))
    if ring:
        d.rounded_rectangle((size * 0.09, size * 0.09, w - 1 - size * 0.09, h - 1 - size * 0.09), radius=int(size * 0.12), outline=rgb(ink), width=max(2, int(size * 0.045)))
    im.alpha_composite(t, (px, py))
    return im


def emote(kind, size=120):
    """A mark over a toy's head: its face does not move, so what it feels is drawn."""
    if kind == "…":  # a small bubble with three dots: waiting, at a loss
        w, h = int(size * 1.7), int(size * 1.0)
        im = Image.new("RGBA", (w, int(h * 1.35)), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((0, 0, w - 1, h - 1), radius=h // 2, fill=rgb("#FFFFFF"), outline=rgb("#8A8F99"), width=max(2, size // 22))
        d.ellipse((w * 0.2, h * 1.02, w * 0.2 + h * 0.26, h * 1.28), fill=rgb("#FFFFFF"), outline=rgb("#8A8F99"), width=max(2, size // 26))
        r = h * 0.13
        for k in (-1, 0, 1):
            cx = w / 2 + k * w * 0.2
            d.ellipse((cx - r, h / 2 - r, cx + r, h / 2 + r), fill=rgb("#555B66"))
        return im
    if kind in ("!", "?", "!!", "?!"):
        return text({"!": "！", "?": "？", "!!": "!!", "?!": "?!"}[kind], size, "#D8382D", "bold", stroke=max(3, size // 12), stroke_fill="#FFFFFF")
    if kind == "sweat":
        im = Image.new("RGBA", (size, int(size * 1.4)), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.polygon([(size * 0.5, 0), (size * 0.92, size * 0.85), (size * 0.08, size * 0.85)], fill=rgb("#7CC4F2"))
        d.ellipse((size * 0.06, size * 0.5, size * 0.94, size * 1.36), fill=rgb("#7CC4F2"))
        d.ellipse((size * 0.24, size * 0.72, size * 0.46, size * 1.0), fill=(255, 255, 255, 190))
        return im
    if kind == "heart":
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.ellipse((0, size * 0.08, size * 0.55, size * 0.6), fill=rgb("#E8504A"))
        d.ellipse((size * 0.45, size * 0.08, size, size * 0.6), fill=rgb("#E8504A"))
        d.polygon([(size * 0.03, size * 0.42), (size * 0.97, size * 0.42), (size * 0.5, size * 0.98)], fill=rgb("#E8504A"))
        return im
    raise ValueError(kind)


def mark(kind, size=120):
    return emote(kind, size)


_UNPOSED = set()


def toy(film, pose="stand"):
    """The film's toy in a pose, as a cut-out for Stage.sprite: `toy(film, "startle")`, `toy(film, "kick:right")`,
    `toy(film, "stand:back:close")` (pose, pose:view, pose:view:close, as `run.mjs poses` renders them). Before
    the toy is built its picture stands in, as a disc on a small body; when the toy is there and this pose is not
    rendered yet, the picture stands in too, and the command that renders it is said once."""
    film = Path(film)
    folder = film / "build/poses"
    meta = json.loads((folder / "poses.json").read_text()) if (folder / "poses.json").exists() else {}
    if pose in meta and (folder / meta[pose]["file"]).exists():
        m = meta[pose]
        return Cut(load(folder / m["file"]), m["per_unit"], m["feet"], m["centre"])
    if meta and pose not in _UNPOSED:
        _UNPOSED.add(pose)
        print(f'stagekit: the toy is not rendered as "{pose}" yet, so its picture stands in: FILM={film} node <skill>/engine/run.mjs poses -- {pose}', file=sys.stderr)
    return stand_in(film)


def stand_in(film, size=600):
    """The toy before it is built: its picture as a disc on a small body, the toy's height."""
    film = Path(film)
    pic = None
    try:
        F = json.loads((film / "film.json").read_text())
        for p in ((F.get("profile") or {}).get("avatar"), "assets/avatar.png", "assets/avatar.jpg"):
            if p and (film / p).exists():
                pic = Image.open(film / p).convert("RGB")
                break
    except (OSError, ValueError):
        pass
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(size * 0.3)
    d.rounded_rectangle((size * 0.36, size * 0.52, size * 0.64, size * 0.97), radius=int(size * 0.1), fill=rgb("#9AA3AD"))
    d.ellipse((size / 2 - r - 8, size * 0.05 - 8, size / 2 + r + 8, size * 0.05 + 2 * r + 8), fill=rgb("#FFFFFF"))
    if pic is not None:
        pic = pic.resize((2 * r, 2 * r), Image.LANCZOS)
        m = Image.new("L", pic.size, 0)
        ImageDraw.Draw(m).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
        im.paste(pic, (size // 2 - r, int(size * 0.05)), m)
    else:
        d.ellipse((size / 2 - r, size * 0.05, size / 2 + r, size * 0.05 + 2 * r), fill=rgb("#C9CED6"))
    return Cut(im, size * 0.95, size * 0.97, size / 2)


class Cut:
    """A cut-out that knows its scale: pixels a toy height, where its feet stand, its centre line."""
    def __init__(self, image, per_unit, feet, centre):
        self.image, self.per_unit, self.feet, self.centre = image, per_unit, feet, centre


def thing(image):
    """Any picture as a cut-out standing on its bottom edge, to give Stage.sprite with height= how tall it is."""
    return Cut(image, image.height, image.height, image.width / 2)


def save_if_changed(image, path, **save_kw):
    """Save `image` to `path` only when its encoded bytes actually differ, keeping `mtime` intact on unchanged re-runs
    so `diff-anim.py --since` and `run.mjs render --resume` never invalidate unchanged frames."""
    import io
    dst = Path(path)
    dst.parent.mkdir(parents=True, exist_ok=True)
    fmt = save_kw.pop("format", None) or (dst.suffix.lstrip(".").upper().replace("JPG", "JPEG") or "PNG")
    buf = io.BytesIO()
    image.save(buf, format=fmt, **save_kw)
    data = buf.getvalue()
    if dst.is_file() and dst.read_bytes() == data:
        return False
    dst.write_bytes(data)
    return True


def _plaque_star(draw, cx, cy, r_out, r_in, fill):
    pts = []
    for k in range(10):
        ang = -math.pi / 2 + k * math.pi / 5
        rr = r_out if k % 2 == 0 else r_in
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    draw.polygon(pts, fill=fill)


def plaque(
    segments,
    *,
    h2x=336,
    pad_x=152,
    div_gap=56,
    div_rgba=(251, 191, 36, 105),
    top_rgb=(23, 35, 56),
    bot_rgb=(13, 21, 36),
    sheen_rgb=(253, 230, 138),
):
    """Render a 2x-supersampled, auto-width-sized, optically centered dark-glass metric/info plaque with generous side
    margins and NO redundant 2D outer border (so `kit.framedPicture(..., { antiglare: true })` supplies one clean 3D
    bevel without box-in-a-box clutter or text-to-border collisions).

    `segments`: list of column groups; each column is a list of tokens:
      - `(text, pil_font, (r, g, b)[, gap_px_at_2x])`
      - `("star", outer_radius_px_at_2x, (r, g, b)[, gap_px_at_2x])`
    """
    probe = ImageDraw.Draw(Image.new("RGBA", (16, 16)))
    seg_layouts = []
    min_top, max_bot = 10**9, -10**9
    for seg in segments:
        items = []
        seg_w = 0
        for idx, token in enumerate(seg):
            kind = token[0]
            gap_before = token[3] if len(token) > 3 else (0 if idx == 0 else 16)
            seg_w += gap_before
            if kind == "star" and isinstance(token[1], (int, float)):
                r_out = float(token[1])
                w_tok = int(round(r_out * 2.05))
                items.append(("star", r_out, token[2], gap_before, w_tok, None))
                seg_w += w_tok
            else:
                txt, fnt, col = str(token[0]), token[1], token[2]
                bb = probe.textbbox((0, 0), txt, font=fnt)
                w_tok = bb[2] - bb[0]
                min_top = min(min_top, bb[1])
                max_bot = max(max_bot, bb[3])
                items.append(("text", txt, fnt, col, gap_before, w_tok, bb))
                seg_w += w_tok
        seg_layouts.append((seg_w, items))

    if min_top > max_bot:
        min_top, max_bot = 0, int(h2x * 0.4)
    div_w = 4
    total_w = sum(sw for sw, _ in seg_layouts) + max(0, len(seg_layouts) - 1) * (2 * div_gap + div_w)
    w2x = max(64, int(math.ceil((total_w + 2 * pad_x) / 4.0) * 4))

    ys = np.linspace(0.0, 1.0, h2x, dtype=np.float32)[:, None]
    grad = np.empty((h2x, w2x, 4), dtype=np.uint8)
    for c in range(3):
        col_band = np.round(top_rgb[c] * (1.0 - ys) + bot_rgb[c] * ys).astype(np.uint8)
        grad[:, :, c] = col_band
    grad[:, :, 3] = 255
    im = Image.fromarray(grad)
    d = ImageDraw.Draw(im)
    if sheen_rgb is not None:
        d.line((16, 6, w2x - 17, 6), fill=(*sheen_rgb[:3], 72), width=2)

    text_h = max_bot - min_top
    base_y = (h2x - text_h) / 2.0 - min_top
    cy = h2x / 2.0
    x = (w2x - total_w) / 2.0
    for s_idx, (_, items) in enumerate(seg_layouts):
        for item in items:
            if item[0] == "star":
                _, r_out, col, gap_before, w_tok, _ = item
                x += gap_before
                _plaque_star(d, x + w_tok / 2.0, cy - 2, r_out, r_out * 0.44, (*col[:3], 255))
                x += w_tok
            else:
                _, txt, fnt, col, gap_before, w_tok, bb = item
                x += gap_before
                d.text((x - bb[0], base_y), txt, font=fnt, fill=(*col[:3], 255))
                x += w_tok
        if s_idx + 1 < len(seg_layouts):
            x += div_gap
            dh = int(h2x * 0.44)
            d.rounded_rectangle((x, cy - dh / 2, x + div_w, cy + dh / 2), radius=2, fill=div_rgba)
            x += div_w + div_gap

    return im.resize((max(1, w2x // 2), max(1, h2x // 2)), Image.Resampling.LANCZOS).convert("RGB")

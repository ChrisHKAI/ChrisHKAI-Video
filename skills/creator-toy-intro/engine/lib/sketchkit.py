"""The pieces a sketch is made of, for the story page (references/research.md, "The story first"). Most ideas
need a sketch composed for them: a fold climbing to the moon, a staircase, a turning boat. Make it from the
creator's own pictures with these. engine/scripts/sketch.py's layouts are a few such sketches, for many pictures.

    import sys; sys.path.insert(0, "<skill>/engine/lib")
    from sketchkit import Sketch
    s = Sketch("films/<film>")                                  # the dark stage, 1200 x 675 (size=(w, h))
    s.card("assets/work/a.jpg", (600, 300), 360, angle=-4)      # their picture as a card, centred there, turned
    s.toy("assets/avatar.jpg", (600, 520), 180)                 # the toy's picture where the toy stands
    s.caption("翻倍的力量", (600, 40))                           # the line the viewer reads, on a light tag
    s.label("×2", (820, 300), 64)                               # a word or a number anywhere
    s.arrow((300, 500), (900, 200), bend=0.3)                   # a move: straight, or bent along an arc
    s.save("research/sketches/s1-fold.jpg")

Points are pixels from the top left. Paths are inside the film folder. It is a picture of the idea, not a frame
of the film: the storyboard's renders are.
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))

INK, PAPER, ACCENT = (28, 27, 25), (245, 242, 236), (242, 193, 78)


def font(size, lang="zh-Hans"):
    """a face that has Chinese: the one the lettering uses (engine/lib/fonts.py), else any the system keeps"""
    try:
        from fonts import face
        path, index, _ = face("cjk", lang)
        return ImageFont.truetype(path, size, index=index)
    except (SystemExit, OSError, ImportError):
        pass
    for f in ("/System/Library/Fonts/Hiragino Sans GB.ttc", "C:/Windows/Fonts/msyh.ttc",
              "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", str(Path.home() / ".chrishkai-video/fonts/SourceHanSansSC-Bold.otf")):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


class Sketch:
    def __init__(self, film=".", size=(1200, 675), lang=None):
        self.film = Path(film)
        self.W, self.H = size
        fj = self.film / "film.json"
        self.lang = lang or (json.loads(fj.read_text()).get("language") if fj.exists() else None) or "zh-Hans"
        # the film's dark stage, a soft light on the floor
        self.im = Image.new("RGB", size, (11, 11, 14))
        glow = Image.new("L", size, 0)
        ImageDraw.Draw(glow).ellipse((self.W * 0.1, self.H * 0.35, self.W * 0.9, self.H * 1.25), fill=60)
        self.im.paste(Image.new("RGB", size, (40, 40, 46)), (0, 0), glow.filter(ImageFilter.GaussianBlur(self.H // 6)))

    def picture(self, src):
        """a path in the film, or a picture already open"""
        return src if isinstance(src, Image.Image) else Image.open(self.film / src).convert("RGB")

    def place(self, img, center, angle=0.0, shadow=True):
        """pastes a picture centred at center, turned by angle degrees, with a soft shadow under it"""
        rgba = img.convert("RGBA").rotate(angle, expand=True, resample=Image.BICUBIC)
        x, y = round(center[0] - rgba.width / 2), round(center[1] - rgba.height / 2)
        if shadow:
            sh = rgba.getchannel("A").point(lambda a: a * 0.55).filter(ImageFilter.GaussianBlur(8))
            self.im.paste((0, 0, 0), (x + 6, y + 10), sh)
        self.im.paste(rgba, (x, y), rgba)

    def card(self, src, center, w, h=None, angle=0.0, rim=3, shadow=True):
        """their picture as a card w wide (cropped to w x h, its own shape when h is None), with a thin light rim"""
        img = self.picture(src)
        h = h or round(w * img.height / img.width)
        c = ImageOps.fit(img, (max(1, w - 2 * rim), max(1, h - 2 * rim)), Image.LANCZOS)
        framed = Image.new("RGB", (w, h), (235, 232, 226))
        framed.paste(c, (rim, rim))
        self.place(framed, center, angle, shadow)

    def toy(self, src, center, d=None):
        """the toy's picture (the avatar, or build/lookdev/front.png once the toy exists) as a disc where it stands"""
        d = d or round(self.H * 0.3)
        av = ImageOps.fit(self.picture(src).convert("RGBA"), (d, d), Image.LANCZOS)
        mask = Image.new("L", (d, d), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, d - 1, d - 1), fill=255)
        ring = Image.new("RGBA", (d + 12, d + 12), (0, 0, 0, 0))
        ImageDraw.Draw(ring).ellipse((0, 0, d + 11, d + 11), fill=PAPER + (255,))
        cx, cy = center
        self.im.paste(ring, (round(cx - (d + 12) / 2), round(cy - (d + 12) / 2)), ring)
        self.im.paste(av, (round(cx - d / 2), round(cy - d / 2)), mask)

    def caption(self, text, top_center, size=None):
        """the line the viewer reads, dark on a light tag; top_center is the middle of its top edge"""
        size = size or round(self.H * 0.075)
        f, dr = font(size, self.lang), ImageDraw.Draw(self.im)
        tw, pad = dr.textlength(text, font=f), round(size * 0.27)
        x, y = top_center
        dr.rounded_rectangle((x - tw / 2 - 2 * pad, y, x + tw / 2 + 2 * pad, y + size + 2.6 * pad), radius=pad, fill=PAPER)
        dr.text((x - tw / 2, y + pad), text, font=f, fill=INK)

    def label(self, text, center, size=48, color=PAPER):
        """a word or a number anywhere, centred there, no tag"""
        f = font(size, self.lang)
        ImageDraw.Draw(self.im).text(center, text, font=f, fill=color, anchor="mm")

    def arrow(self, a, b, bend=0.0, width=6, color=ACCENT, head=True):
        """a move from a to b: straight, or bent to one side (bend: the bulge, a share of the length; negative
        bulges the other way), with a head at b"""
        (x0, y0), (x1, y1) = a, b
        mx, my, L = (x0 + x1) / 2, (y0 + y1) / 2, math.hypot(x1 - x0, y1 - y0) or 1
        cx, cy = mx - (y1 - y0) / L * bend * L, my + (x1 - x0) / L * bend * L
        pts = [((1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1)
               for t in (i / 40 for i in range(41))]
        dr = ImageDraw.Draw(self.im)
        dr.line(pts, fill=color, width=width, joint="curve")
        if head:
            (px, py), (qx, qy) = pts[-3], pts[-1]
            ang, s = math.atan2(qy - py, qx - px), width * 3.2
            dr.polygon([(qx, qy), (qx - s * math.cos(ang - 0.45), qy - s * math.sin(ang - 0.45)),
                        (qx - s * math.cos(ang + 0.45), qy - s * math.sin(ang + 0.45))], fill=color)

    def save(self, out, quality=88):
        out = self.film / out
        out.parent.mkdir(parents=True, exist_ok=True)
        self.im.save(out, quality=quality)
        return out

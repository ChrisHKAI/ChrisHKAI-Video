"""The phone's screen, frame by frame (build/screen/####.jpg, 1206 x 2622):
off until the groove, the home screen, the X icon pressed, the app opening
out of it (a black card growing from the icon with the X mark), then his
profile. The avatar and the link are drawn on the screen until the frame their
3D pieces take over (scripts/scene.py shows those then), and each letter of the
handle until it pushes out of the glass, so each is only ever on screen once.

usage: python3 scripts/screen.py
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import timeline as T  # noqa: E402

OUT = ROOT / "build/screen"
OUT.mkdir(parents=True, exist_ok=True)
L = json.loads((ROOT / "build/ui.json").read_text())
STRIP = json.loads((ROOT / "build/strip.json").read_text())
W, H = T.UI["w"], T.UI["h"]
home = Image.open(ROOT / "assets/home.png").convert("RGB")
profile = Image.open(ROOT / "assets/profile.png").convert("RGB")
logo = Image.open(ROOT / "assets/x-logo.png").convert("L")
avatar = Image.open(ROOT / "assets/avatar.png").convert("RGBA")
name = Image.open(ROOT / "assets/name.png").convert("RGB")
link = Image.open(ROOT / "assets/link.png").convert("RGB")
blank = Image.new("RGB", (T.UI["w"], T.UI["h"]), "white")  # the page with the app gone
ink = Image.new("RGB", (T.UI["w"], T.UI["h"]), "black")  # and once the ink has flooded it (scripts/choreo.py)
a = L["avatar"]
avatar = avatar.resize((round(2 * a["r"]), round(2 * a["r"])), Image.LANCZOS)


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def seg(t, t0, t1):
    return min(max((t - t0) / (t1 - t0), 0.0), 1.0)


def with_pieces(t):
    im = profile.copy()
    if t < T.EV["bulge"]:
        im.paste(avatar, (round(a["cx"] - a["r"]), round(a["cy"] - a["r"])), avatar)
    # the handle: from the zoom its letters are 3D, flat on the glass till they push out (the @ stays)
    gone = 9 if t >= T.EV["zoom"] else 0
    piece = name.copy()
    d = ImageDraw.Draw(piece)
    for x0, x1 in STRIP["runs"][:gone]:
        d.rectangle((x0 - 2, 0, x1 + 2, piece.height), fill=(255, 255, 255))
    im.paste(piece, tuple(L["name"][:2]))
    im.paste(link, tuple(L["link"][:2]))
    return im


def splash(size=(W, H)):
    im = Image.new("RGB", size, "black")
    s = int(0.22 * W)
    lg = logo.resize((s, s), Image.LANCZOS)
    im.paste((255, 255, 255), ((size[0] - s) // 2, (size[1] - s) // 2), lg)
    return im


def launch(k):
    """The app opening: a black card growing from the icon over the home screen."""
    bg = home.resize((round(W * (1 - 0.06 * k)), round(H * (1 - 0.06 * k))), Image.LANCZOS)
    bg = ImageEnhance.Brightness(bg).enhance(1 - 0.5 * k)
    im = Image.new("RGB", (W, H), "black")
    im.paste(bg, ((W - bg.width) // 2, (H - bg.height) // 2))
    x, y, w, h = L["xicon"]
    x0, y0 = x + (0 - x) * k, y + (0 - y) * k
    x1, y1 = (x + w) + (W - x - w) * k, (y + h) + (H - y - h) * k
    r = 0.225 * w * (1 - k) + 0.09 * W * k
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((x0, y0, x1, y1), radius=r, fill=255)
    card = Image.new("RGB", (W, H), "black")
    s = round(0.62 * w * (1 - k) + 0.22 * W * k)
    lg = logo.resize((s, s), Image.LANCZOS)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    card.paste((255, 255, 255), (round(cx - s / 2), round(cy - s / 2)), lg)
    im.paste(card, (0, 0), mask)
    return im


def pressed():
    im = home.copy()
    x, y, w, h = L["xicon"]
    dim = Image.new("RGB", (w, h), "black")
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), radius=0.225 * w, fill=110)
    im.paste(dim, (x, y), m)
    return im


def frame_at(t):
    E = T.EV
    if t < E["groove"]:
        return Image.new("RGB", (W, H), "black")
    if t < E["tap"]:
        return Image.blend(Image.new("RGB", (W, H), "black"), home, ease(seg(t, E["groove"], E["groove"] + 0.15)))
    if t < E["launch"]:
        return pressed()
    open_end = E["launch"] + 0.38
    if t < open_end:
        return launch(ease(seg(t, E["launch"], open_end)))
    fade = E["profile"] - 0.3
    if t < fade:
        return splash()
    if t < E["profile"]:
        return Image.blend(splash(), with_pieces(t), ease(seg(t, fade, E["profile"])))
    # he drops onto the handle: the app goes, leaving the page's plain white for the black letters;
    # black ink spreads behind each he turns white, and floods the page as the I goes
    im = with_pieces(t)
    gone = ease(seg(t, E["stomp"] - 0.3, E["stomp"] + 0.2))
    if gone > 0:
        im = Image.blend(im, blank, gone)
    flood = ease(seg(t, T.FALL[-1], T.FALL[-1] + 0.35))
    if flood > 0:
        im = Image.blend(im, ink, flood)
    return im


def main():
    last = None
    for f in range(1, T.FRAMES + 1):
        t = (f - 1) / T.FPS
        im = frame_at(t)
        key = im.tobytes()[::4097]
        path = OUT / f"{f:04d}.jpg"
        if key == last and (OUT / f"{f - 1:04d}.jpg").exists():
            path.write_bytes((OUT / f"{f - 1:04d}.jpg").read_bytes())
        else:
            im.save(path, quality=92)
        last = key
    print("wrote", T.FRAMES, "frames")


if __name__ == "__main__":
    main()

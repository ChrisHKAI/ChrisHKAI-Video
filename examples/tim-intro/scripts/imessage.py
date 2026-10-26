"""The iPhone 4S's screen for the last word: Messages in iOS 5 (2011), the
thread with Steve, at the Retina screen's 640 x 960, one PNG a film frame from
just before it wakes (src/timeline.js EV): "Steve, we miss you" typed in the
field; sent, it flies up into a blue iMessage bubble; Delivered; his grey
typing bubble; "I'll always be here". Glossy bubbles, black text with a light
shadow, the blue-grey bars, Helvetica, as on the phone; the status bar says
9:41, the time on the first iPhone at the 2007 keynote.

usage: node scripts/cues.mjs && python3 scripts/imessage.py   → build/imsg/####.png (film frames)
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CUE = json.loads((ROOT / "build/cues.json").read_text())
EV, DUR = CUE["EV"], CUE["DURATION"]
FPS, W, H, S = 30, 640, 960, 2  # the screen's pixels; drawn S times as big, then down
OUT = ROOT / "build/imsg"
HELV = "/System/Library/Fonts/Helvetica.ttc"
HEITI = "/System/Library/Fonts/STHeiti Medium.ttc"
SENT, REPLY = "Steve, we miss you", "I'll always be here"
TOP, BAR = 128, 880  # the thread between the navigation bar and the field's bar


def font(size, bold=False, path=HELV):
    return ImageFont.truetype(path, round(size * S), index=(1 if bold else 0) if path == HELV else 0)


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def grad(w, h, stops):
    """a vertical gradient (stops: position 0..1, colour), w x h in drawn pixels"""
    pos = [p for p, _ in stops]
    cols = np.array([rgb(c) for _, c in stops], dtype=np.float64)
    y = np.linspace(0, 1, h)
    col = np.stack([np.interp(y, pos, cols[:, k]) for k in range(3)], -1)
    return Image.fromarray(np.repeat(col[:, None, :], w, 1).round().astype(np.uint8)).convert("RGBA")


def mask(size, draw):
    m = Image.new("L", size, 0)
    draw(ImageDraw.Draw(m))
    return m


def shrink(m, px):
    return m.filter(ImageFilter.MinFilter(2 * round(px * S) + 1))


def put(img, src, m, xy=(0, 0)):
    """paste src (a colour or an RGBA image) through mask m at xy (drawn pixels)"""
    src = Image.new("RGBA", m.size, rgb(src) + (255,)) if isinstance(src, str) else src.copy()
    a = np.asarray(src.getchannel("A"), np.uint16) * np.asarray(m, np.uint16) // 255
    src.putalpha(Image.fromarray(a.astype(np.uint8)))
    img.alpha_composite(src, (round(xy[0]), round(xy[1])))


def text(img, xy, s, f, fill, shadow=None, anchor="lm", alpha=1.0):
    """text at xy (screen pixels), its shadow (colour, alpha, dy) under it"""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = xy[0] * S, xy[1] * S
    if shadow:
        c, a, dy = shadow
        d.text((x, y + dy * S), s, font=f, fill=rgb(c) + (round(255 * a * alpha),), anchor=anchor)
    d.text((x, y), s, font=f, fill=rgb(fill) + (round(255 * alpha),), anchor=anchor)
    img.alpha_composite(layer)


def button(img, box, label, stops, edge, fg, shade, arrow=False):
    """a bordered bar button (the back button points left)"""
    x0, y0, x1, y1 = [v * S for v in box]
    w, h = round(x1 - x0) + 2, round(y1 - y0) + 2
    tip = 16 * S if arrow else 0

    def shape(d, inset=0):
        d.rounded_rectangle((tip + inset, inset, w - 1 - inset, h - 1 - inset), radius=10 * S - inset, fill=255)
        if arrow:
            d.polygon([(inset * 1.4, h / 2), (tip + 10 * S, inset), (tip + 10 * S, h - 1 - inset)], fill=255)

    m = mask((w, h), shape)
    put(img, edge, m, (x0, y0))
    put(img, grad(w, h, stops), mask((w, h), lambda d: shape(d, 2 * S)), (x0, y0))
    text(img, ((box[0] + box[2]) / 2 + (tip / S / 2 if arrow else 0), (box[1] + box[3]) / 2), label, font(24 if arrow else 25, True), fg, shade, "mm")


BAR_BLUE = [(0, "#8fa3be"), (0.5, "#6880a4"), (0.5, "#5a7399"), (1, "#4c678f")]
BAR_EDGE = "#2c3f5f"


def chrome(typed, caret):
    """the screen round the thread: status bar, navigation bar, the field's bar"""
    img = Image.new("RGBA", (W * S, H * S), rgb("#dbe2ed") + (255,))
    # the status bar
    img.alpha_composite(grad(W * S, 40 * S, [(0, "#d6dbe1"), (1, "#a6afba")]))
    for i in range(5):
        h = 8 + 4 * i
        put(img, "#141414", mask((6 * S, h * S), lambda d: d.rectangle((0, 0, 6 * S, h * S), fill=255)), ((12 + 9 * i) * S, (30 - h) * S))
    text(img, (60, 20), "中国联通", font(22, path=HEITI), "#141414", ("#ffffff", 0.5, 1))
    text(img, (152, 20), "3G", font(22, True), "#141414", ("#ffffff", 0.5, 1))
    text(img, (W / 2, 20), "9:41 AM", font(27, True), "#141414", ("#ffffff", 0.5, 1), "mm")
    bx, by = 570, 11
    put(img, "#141414", mask((50 * S, 19 * S), lambda d: d.rounded_rectangle((0, 0, 50 * S - 1, 19 * S - 1), radius=4 * S, outline=255, width=2 * S)), (bx * S, by * S))
    put(img, "#141414", mask((42 * S, 11 * S), lambda d: d.rectangle((0, 0, 42 * S, 11 * S), fill=255)), ((bx + 4) * S, (by + 4) * S))
    put(img, "#141414", mask((4 * S, 9 * S), lambda d: d.rectangle((0, 0, 4 * S, 9 * S), fill=255)), ((bx + 50) * S, (by + 5) * S))
    # the navigation bar: "Steve", Messages back, Edit
    img.alpha_composite(grad(W * S, 88 * S, [(0, "#b4c0d0"), (0.5, "#8c9fb7"), (0.5, "#8096b0"), (1, "#6d84a2")]), (0, 40 * S))
    put(img, "#d3dbe5", mask((W * S, 2), lambda d: d.rectangle((0, 0, W * S, 2), fill=255)), (0, 40 * S))
    put(img, "#2d3847", mask((W * S, 2 * S), lambda d: d.rectangle((0, 0, W * S, 2 * S), fill=255)), (0, (TOP - 2) * S))
    text(img, (W / 2, 84), "Steve", font(40, True), "#ffffff", ("#000000", 0.45, -2), "mm")
    tw = font(24, True).getlength("Messages") / S
    button(img, (10, 55, 10 + 16 + 24 + tw, 113), "Messages", BAR_BLUE, BAR_EDGE, "#ffffff", ("#000000", 0.45, -2), arrow=True)
    button(img, (W - 10 - 92, 55, W - 10, 113), "Edit", BAR_BLUE, BAR_EDGE, "#ffffff", ("#000000", 0.45, -2))
    # the field's bar: the camera, the field (iMessage), Send
    img.alpha_composite(grad(W * S, (H - BAR) * S, [(0, "#eceef1"), (1, "#c3c8cf")]), (0, BAR * S))
    put(img, "#9fa6b0", mask((W * S, 2 * S), lambda d: d.rectangle((0, 0, W * S, 2 * S), fill=255)), (0, BAR * S))
    cam = (12, 893, 70, 947)
    cw, ch = (cam[2] - cam[0]) * S, (cam[3] - cam[1]) * S
    put(img, "#8f96a0", mask((cw, ch), lambda d: d.rounded_rectangle((0, 0, cw - 1, ch - 1), radius=10 * S, fill=255)), (cam[0] * S, cam[1] * S))
    put(img, grad(cw, ch, [(0, "#f7f8fa"), (1, "#c8cdd4")]), mask((cw, ch), lambda d: d.rounded_rectangle((2 * S, 2 * S, cw - 1 - 2 * S, ch - 1 - 2 * S), radius=8 * S, fill=255)), (cam[0] * S, cam[1] * S))
    icon = mask((cw, ch), lambda d: (d.rounded_rectangle((15 * S, 19 * S, 43 * S, 38 * S), radius=3 * S, fill=255), d.rectangle((23 * S, 15 * S, 35 * S, 20 * S), fill=255), d.ellipse((23 * S, 22 * S, 35 * S, 34 * S), fill=0), d.ellipse((26 * S, 25 * S, 32 * S, 31 * S), fill=255)))
    put(img, "#5d636c", icon, (cam[0] * S, cam[1] * S))
    fx0, fy0, fx1, fy1 = 80, 892, 520, 946
    fw, fh = (fx1 - fx0) * S, (fy1 - fy0) * S
    put(img, "#a4aab3", mask((fw, fh), lambda d: d.rounded_rectangle((0, 0, fw - 1, fh - 1), radius=fh // 2, fill=255)), (fx0 * S, fy0 * S))
    put(img, grad(fw, fh, [(0, "#e2e4e8"), (0.14, "#ffffff"), (1, "#ffffff")]), mask((fw, fh), lambda d: d.rounded_rectangle((2 * S, 2 * S, fw - 1 - 2 * S, fh - 1 - 2 * S), radius=fh // 2 - 2 * S, fill=255)), (fx0 * S, fy0 * S))
    f30 = font(30)
    if typed:
        text(img, (fx0 + 20, (fy0 + fy1) / 2), typed, f30, "#111111")
        if caret:
            cx = fx0 + 20 + f30.getlength(typed) / S + 3
            put(img, "#3c80f2", mask((3 * S, 34 * S), lambda d: d.rectangle((0, 0, 3 * S, 34 * S), fill=255)), (cx * S, ((fy0 + fy1) / 2 - 17) * S))
    else:
        text(img, (fx0 + 20, (fy0 + fy1) / 2), "iMessage", f30, "#b5bac1")
    sx0, sy0, sx1, sy1 = 528, 892, 628, 946
    on = [(0, "#89b8f8"), (0.5, "#4f8ff0"), (0.5, "#3c7fe9"), (1, "#2f6fdb")]
    off = [(0, "#f3f4f6"), (1, "#cdd1d7")]
    sw, sh = (sx1 - sx0) * S, (sy1 - sy0) * S
    put(img, "#1f4f9f" if typed else "#a9afb8", mask((sw, sh), lambda d: d.rounded_rectangle((0, 0, sw - 1, sh - 1), radius=12 * S, fill=255)), (sx0 * S, sy0 * S))
    put(img, grad(sw, sh, on if typed else off), mask((sw, sh), lambda d: d.rounded_rectangle((2 * S, 2 * S, sw - 1 - 2 * S, sh - 1 - 2 * S), radius=10 * S, fill=255)), (sx0 * S, sy0 * S))
    text(img, ((sx0 + sx1) / 2, (sy0 + sy1) / 2), "Send", font(27, True), "#ffffff" if typed else "#a7adb5", ("#000000", 0.4, -2) if typed else ("#ffffff", 0.8, 2), "mm")
    return img


def bezier(p0, p1, p2, n=24):
    return [((1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]) for u in np.linspace(0, 1, n)]


BLUE = ([(0, "#cbe8ff"), (0.48, "#97cdfb"), (0.52, "#83c0f7"), (1, "#4f9ff0")], "#3b88d4")
GREY = ([(0, "#fefefe"), (0.48, "#eef0f2"), (0.52, "#e4e6e9"), (1, "#cfd2d7")], "#a7acb3")
BH, TAIL = 70, 12  # a one-line bubble's height, how far its tail reaches out


def bubble(width, mine, colours):
    """a glossy speech bubble `width` wide (its body), the tail at the bottom on
    the speaker's side; an RGBA layer TAIL wider than the body, and the body's x in it"""
    w, h = (width + TAIL) * S, (BH + 2) * S
    bx0 = 0 if mine else TAIL * S  # the body's left in the layer
    bx1 = bx0 + width * S
    r = BH * S / 2

    def shape(d, inset=0):
        i = inset
        d.rounded_rectangle((bx0 + i, i, bx1 - 1 - i, BH * S - 1 - i), radius=r - i, fill=255)
        # the tail: from the bottom edge out to a point past the corner and back up the side
        if mine:
            pts = bezier((bx1 - 34 * S, BH * S - 1 - i), (bx1 - 6 * S, BH * S + 1 * S - i), (bx1 + (TAIL - 2) * S - i, BH * S + 1 * S - i))
            pts += bezier((bx1 + (TAIL - 2) * S - i, BH * S + 1 * S - i), (bx1 - 4 * S, BH * S - 6 * S), (bx1 - 3 * S - i, BH * S - 28 * S))
        else:
            pts = bezier((bx0 + 34 * S, BH * S - 1 - i), (bx0 + 6 * S, BH * S + 1 * S - i), (bx0 - (TAIL - 2) * S + i, BH * S + 1 * S - i))
            pts += bezier((bx0 - (TAIL - 2) * S + i, BH * S + 1 * S - i), (bx0 + 4 * S, BH * S - 6 * S), (bx0 + 3 * S + i, BH * S - 28 * S))
        d.polygon(pts, fill=255)

    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    stops, edge = colours
    outer = mask((w, h), shape)
    put(layer, edge, outer)
    inner = shrink(outer, 2)
    put(layer, grad(w, h, [(p * BH / (BH + 2), c) for p, c in stops]), inner)
    # the gloss on its upper half
    gl = mask((w, h), lambda d: d.rounded_rectangle((bx0 + 5 * S, 3 * S, bx1 - 5 * S, BH * S * 0.48), radius=r * 0.8, fill=255))
    gloss = grad(w, h, [(0, "#ffffff"), (1, "#ffffff")])
    gloss.putalpha(Image.fromarray((np.linspace(150, 40, h)[:, None] * np.ones((1, w))).astype(np.uint8)))
    put(layer, gloss, Image.fromarray((np.asarray(gl, np.float32) * np.asarray(inner, np.float32) / 255).astype(np.uint8)))
    return layer, bx0 / S


def place(img, layer, x, y, scale=1.0, alpha=1.0, anchor="bl"):
    """composite a layer with its top-left at (x, y) (screen px), scaled about its bottom corner"""
    if scale != 1.0:
        w, h = layer.size
        nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
        small = layer.resize((nw, nh), Image.LANCZOS)
        ax = 0 if anchor == "bl" else w - nw
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        layer.paste(small, (ax, h - nh))
    if alpha < 1.0:
        a = layer.getchannel("A").point(lambda v: round(v * alpha))
        layer = layer.copy()
        layer.putalpha(a)
    img.alpha_composite(layer, (round(x * S), round(y * S)))


F32 = font(32)
SENT_W = round(F32.getlength(SENT) / S) + 52
REPLY_W = round(F32.getlength(REPLY) / S) + 52
SENT_L, SENT_B = bubble(SENT_W, True, BLUE)
REPLY_L, REPLY_B = bubble(REPLY_W, False, GREY)
for lay, s, bx in ((SENT_L, SENT, SENT_B), (REPLY_L, REPLY, REPLY_B)):
    text(lay, (bx + 26, BH / 2 + 1), s, F32, "#000000", ("#ffffff", 0.45, 2))
TYPE_W = 96
Y_SENT, Y_THEM = 186, 300  # the bubbles' tops


def typing_bubble(t):
    lay, bx = bubble(TYPE_W, False, GREY)
    for i in range(3):
        a = 0.35 + 0.65 * max(0.0, math.sin(2 * math.pi * (t / 1.1 - 0.17 * i)))
        put(lay, "#8f959d", mask((14 * S, 14 * S), lambda d: d.ellipse((0, 0, 14 * S - 1, 14 * S - 1), fill=round(255 * a))), ((bx + 27 + 18 * i) * S, (BH / 2 - 7) * S))
    return lay


ease = lambda u: 1 - (1 - min(1.0, max(0.0, u))) ** 3  # noqa: E731
clip = lambda u: min(1.0, max(0.0, u))  # noqa: E731


def frame(t):
    sent = t >= EV["send"]
    img = (BASE_EMPTY if sent else (BASE_CARET if (t % 1.0) < 0.55 else BASE_TYPED)).copy()
    if sent:
        text(img, (W / 2, TOP + 30), "Today 9:41 AM", font(23, True), "#8a8f98", ("#ffffff", 0.8, 2), "mm", alpha=clip((t - EV["send"]) / 0.3))
        # it flies up from the field into the thread
        u = ease((t - EV["send"]) / 0.34)
        y = 892 + (Y_SENT - 892) * u
        place(img, SENT_L, W - 14 - SENT_W, y)
    if t >= EV["delivered"]:
        text(img, (W - 30, Y_SENT + BH + 22), "Delivered", font(21, True), "#8a8f98", ("#ffffff", 0.8, 2), "rm", alpha=clip((t - EV["delivered"]) / 0.2))
    if EV["typing"] <= t < EV["reply"] + 0.18:
        u = clip((t - EV["typing"]) / 0.2)
        pop = 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2  # out a little past, back
        fade = 1 - clip((t - EV["reply"]) / 0.18)
        place(img, typing_bubble(t), 14 - TAIL, Y_THEM, scale=max(0.05, pop), alpha=fade)
    if t >= EV["reply"]:
        u = clip((t - EV["reply"]) / 0.18)
        place(img, REPLY_L, 14 - TAIL, Y_THEM, scale=0.88 + 0.12 * ease(u), alpha=u)
    return img.resize((W, H), Image.LANCZOS).convert("RGB")


BASE_TYPED = chrome(SENT, False)
BASE_CARET = chrome(SENT, True)
BASE_EMPTY = chrome("", False)
OUT.mkdir(parents=True, exist_ok=True)
for p in OUT.glob("*.png"):
    p.unlink()
first, last = round((EV["wake"] - 0.1) * FPS) + 1, round(DUR * FPS)
for f in range(first, last + 1):
    frame((f - 1) / FPS).save(OUT / f"{f:04d}.png")
print(f"imsg frames {first}-{last} → {OUT}")

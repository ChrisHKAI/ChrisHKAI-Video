"""Act 3's wall: the Grok App, where 铁柱AGI started on X (the user, 2026-10-26: "佢以前啱啱喺 X
起家開始嗰陣，係先寫咗個 Grok App 呢個 app 起家…佢個 Grok App 喺 GitHub 上面嘅 star 有 1,500 個
星星"). His 7/30 post's cover, "5天 380+ star / 我让 Grok Build 自己写了个桌面客户端", set on a 5:2
card of its own navy: the cover's left part (his drawing on its right is left out: the toy stands
there instead), the app itself from grok-app.com in the middle, with the site's "GitHub 開源 ★ 1.5k"
above it. The right of the card stays empty navy: the toy stands in front of it, on the floor
(film.json story.act3Floor). The Ben Lang version is recipes/cover-retro-ben.py, the email version
recipes/cover-retro-email.py.

  title     "5": flies out and slams back
  box7      "380": punches out when the toy points at it, turns into the 3D count, counts to
            1,500 in front of the wall and drops back, knocking "5天" off, into their place: "1,500+ star"
            (film.json story.countB)
  arrow     the "GitHub 開源 ★ 1.5k" pill: pops as the count locks
  ledge     the subtitle bar: rises as the wall stands
  tian, plus, star, sub0…sub2, tag0…tag2, app: pop on the beat (story.wallPop)

  assets/p1-cover.png   the card (2000 x 800, 5:2): the page's cover
  assets/cover-full.png the wall as published; assets/cover-wall.png without "5天" and "380" (the count takes their place)
  build/cover.json      pieces: outline rings in cover UV (0..1, v down)

Sources: assets/p-grokapp.jpg (800 x 343) and research/shots/grok-app-site.jpg (800 x 571).

usage: FILM=films/cgnot996-intro python3 recipes/cover-retro.py
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

FILM = Path(os.environ["FILM"]).resolve()
sys.path.insert(0, str(Path(os.environ.get("SKILL", FILM.parents[1] / "skills/creator-toy-intro")) / "engine/lib"))
from cutlib import check_image, rings  # noqa: E402

W, H = 2000, 800
cover = Image.open(FILM / "assets/p-grokapp.jpg").convert("RGB")
site = Image.open(FILM / "research/shots/grok-app-site.jpg").convert("RGB")
K = H / cover.height  # the cover fills the card's height

# the card's navy: the cover's own, a little lighter towards the middle
yy, xx = np.mgrid[0:H, 0:W]
glow = np.exp(-(((xx - 1300) / 900) ** 2 + ((yy - 380) / 520) ** 2))
navy = np.stack([3 + 4 * glow, 9 + 16 * glow, 15 + 30 * glow], axis=2)
card = Image.fromarray(navy.round().astype(np.uint8))

# the cover's left part (x 0..484: the big type, the subtitle, the tags; the window behind his drawing starts at 486), its right edge fading into the navy
CROP = 484
left = cover.crop((0, 0, CROP, cover.height)).resize((round(CROP * K), H), Image.LANCZOS)
left = left.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
fade = Image.new("L", left.size, 255)
fd = np.asarray(fade).astype(float)
ramp = np.clip((left.width - np.arange(left.width)) / 60, 0, 1)
fade = Image.fromarray((fd * ramp[None, :]).astype(np.uint8))
card.paste(left, (0, 0), fade)
S = lambda x0, y0, x1, y1: (round(x0 * K), round(y0 * K), round(x1 * K), round(y1 * K))  # cover px → card px

# the app (grok-app.com's own picture of it) and the GitHub pill above it
APP_SRC = (132, 214, 626, 450)  # the window, clear of the site's two floating cards
APP_AT = (1120, 262)
APP_K = 1.25
app = site.crop(APP_SRC).resize((round((APP_SRC[2] - APP_SRC[0]) * APP_K), round((APP_SRC[3] - APP_SRC[1]) * APP_K)), Image.LANCZOS)
ImageDraw.Draw(app).rectangle((0, 0, round(40 * APP_K), round(19 * APP_K)), fill=app.getpixel((round(70 * APP_K), round(9 * APP_K))))  # the left card's corner
app = app.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
mask = Image.new("L", app.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, app.width - 1, app.height - 1), radius=22, fill=255)
card.paste(app, APP_AT, mask)
APP_BOX = (APP_AT[0], APP_AT[1], APP_AT[0] + app.width, APP_AT[1] + app.height)
PILL_SRC = (380, 151, 503, 178)
PILL_K = 2.6
pill = site.crop(PILL_SRC).resize((round((PILL_SRC[2] - PILL_SRC[0]) * PILL_K), round((PILL_SRC[3] - PILL_SRC[1]) * PILL_K)), Image.LANCZOS)
pill = pill.filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=2))
PILL_AT = (APP_BOX[0] + (app.width - pill.width) // 2, 92)
pm = Image.new("L", pill.size, 0)
ImageDraw.Draw(pm).rounded_rectangle((0, 0, pill.width - 1, pill.height - 1), radius=pill.height // 2, fill=255)
card.paste(pill, PILL_AT, pm)
PILL_BOX = (PILL_AT[0], PILL_AT[1], PILL_AT[0] + pill.width, PILL_AT[1] + pill.height)

for name in ("p1-cover.png", "cover-full.png"):
    card.save(FILM / "assets" / name)

# the pieces: letters cut from their own ink (bright or gold on the navy); the bar, the tags, the
# app and the pill whole, as rounded boxes
a = np.asarray(card).astype(float) / 255
v = a.max(2)
sat = (v - a.min(2)) / np.maximum(v, 1e-6)
gold = (a[..., 0] > 0.28) & (a[..., 0] > a[..., 2] + 0.12) & (sat > 0.3)
BRIGHT = (v > 0.42) | gold


def ink(box):
    m = np.zeros((H, W), bool)
    x0, y0, x1, y1 = box
    m[y0:y1, x0:x1] = BRIGHT[y0:y1, x0:x1]
    m = ndimage.binary_closing(m, iterations=3)
    return ndimage.binary_dilation(m, iterations=2)


def rounded(box, r):
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).rounded_rectangle(box, radius=r, fill=255)
    return np.asarray(im) > 0


PIECES = [
    ("title", ink(S(36, 64, 142, 216))),           # 5
    ("tian", ink(S(143, 140, 208, 208))),          # 天
    ("box7", ink(S(217, 80, 419, 209))),           # 380
    ("plus", ink(S(419, 112, 456, 160))),          # +
    ("star", ink(S(416, 163, 482, 201))),          # star
    ("ledge", rounded(S(22, 212, 476, 266), 16)),  # the subtitle bar
    ("sub0", ink(S(44, 226, 108, 262))),           # 我让
    ("sub1", ink(S(116, 226, 268, 262))),          # Grok Build
    ("sub2", ink(S(276, 218, 470, 262))),          # 自己写了个桌面客户端
    ("tag0", rounded(S(32, 274, 140, 310), 18)),   # Grok App
    ("tag1", rounded(S(146, 274, 220, 310), 18)),  # Agent
    ("tag2", rounded(S(228, 274, 296, 310), 18)),  # 开源
    ("app", rounded(APP_BOX, 22)),
    ("arrow", rounded(PILL_BOX, (PILL_BOX[3] - PILL_BOX[1]) // 2)),
]
# the wall once "380" has left it and "5天" has been knocked off (the count comes back as 1,500 in
# their place: "1,500+ star"): their letters filled with the navy around them (normalised blur)
gone = ndimage.binary_dilation(dict(PIECES)["box7"] | dict(PIECES)["title"] | dict(PIECES)["tian"], iterations=10)
keep = (~gone).astype(float)
blur = lambda x: ndimage.gaussian_filter(x, 18)
fill = np.stack([blur(a[..., c] * keep) for c in range(3)], axis=2) / np.maximum(blur(keep), 1e-4)[..., None]
wall = np.where(gone[..., None], fill, a)
Image.fromarray((np.clip(wall, 0, 1) * 255).round().astype(np.uint8)).save(FILM / "assets/cover-wall.png")

pieces = []
for name, m in PIECES:
    whole = name in ("ledge", "app", "arrow") or name.startswith("tag")
    r = rings(m, W, H, min_area=10, tol=0.6, close=1, hole=20, fill=whole)
    pieces.append({"name": name, "kind": "box", "rings": r})

out = {"w": W, "h": H, "src": "p1-cover.png", "pieces": pieces}
(FILM / "build").mkdir(exist_ok=True)
(FILM / "build/cover.json").write_text(json.dumps(out))
print(f"{len(pieces)} pieces: " + " ".join(p["name"] for p in pieces))
print("card px: app", APP_BOX, "pill", PILL_BOX, "380", S(217, 80, 419, 209))
check_image(card, pieces, lambda p: (255, 0, 255) if p["name"] in ("title", "box7", "ledge", "arrow") else (0, 200, 0)).save(FILM / "build/cover-check.png")

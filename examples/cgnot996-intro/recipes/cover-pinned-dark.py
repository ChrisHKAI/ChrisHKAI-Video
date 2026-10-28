"""铁柱AGI's 10k post (10/24): his own profile at 1万 followers, the hover tip
showing 10,000. The act 2 wall: the part from his name down to the tip, cut
to the theme's 5:2 card and padded with the page's black, the bio line with
his WeChat ID painted out; then the lettering that pushes out of the wall,
white 3D type a word or a phrase at a time, the 10,000 tip last (on the lock).

  assets/p10k-cover.png  the cover the page and the wall show (5:2)
  build/cover2.json      pieces: outline rings in cover UV (0..1, v down)
  build/cover2-check.png every outline drawn on the cover

Coordinates are px of the screenshot assets/p10k-a.jpg (1282 x 998).

usage: FILM=films/cgnot996-intro python3 recipes/cover-pinned.py
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

FILM = Path(os.environ["FILM"]).resolve()
sys.path.insert(0, str(Path(os.environ.get("SKILL", FILM.parents[1] / "skills/creator-toy-intro")) / "engine/lib"))
from cutlib import check_image, hsv, region, rings  # noqa: E402

src = Image.open(FILM / "assets/p10k-a.jpg").convert("RGB")
# the card: his name down to the 10,000 tip; the black page runs x 42..1240
X0, Y0, X1, Y1 = 42, 392, 1240, 952
card = src.crop((X0, Y0, X1, Y1))
d = ImageDraw.Draw(card)
d.rectangle((70 - X0, 730 - Y0, 505 - X0, 773 - Y0), fill=(0, 0, 0))  # 199 付费答疑群 + V：… stays off the screen
# padded to the theme's 5:2 card with the page's own black
H = card.height
W = round(H * 2.5)
OX = (W - card.width) // 2
im = Image.new("RGB", (W, H), (0, 0, 0))
im.paste(card, (OX, 0))
(FILM / "assets").mkdir(exist_ok=True)
im.save(FILM / "assets/p10k-cover.png")


def P(x, y):
    """screenshot px → cover px"""
    return (x - X0 + OX, y - Y0)


def at(x0, y0, x1, y1):
    a, b = P(x0, y0), P(x1, y1)
    return region((H, W), int(a[0]), int(a[1]), int(b[0]), int(b[1]))


hue, sat, val = hsv(im)
WHITE = (val > 0.62) & (sat < 0.25)
GREY = (val > 0.33) & (sat < 0.2)
BLUE = (hue > 0.53) & (hue < 0.66) & (sat > 0.35) & (val > 0.45)
GREEN = (hue > 0.25) & (hue < 0.45) & (sat > 0.3) & (val > 0.35)
TIP = (val > 0.16) & (val < 0.42) & (sat < 0.12)  # the hover tip's grey pill

pieces = []


def piece(name, mask, grow=1, **kw):
    """lettering a little fatter than the screenshot's, so it stands as type"""
    m = ndimage.binary_dilation(mask, iterations=grow) if grow else mask
    r = rings(m, W, H, min_area=kw.pop("min_area", 18), tol=kw.pop("tol", 0.6), close=kw.pop("close", 1), hole=kw.pop("hole", 30), **kw)
    if r:
        pieces.append({"name": name, "kind": "box", "rings": r})


# the name, a character at a time, then the badge
piece("n0", WHITE & at(74, 400, 113, 444), grow=1)
piece("n1", WHITE & at(113, 400, 152, 444), grow=1)
piece("n2", WHITE & at(152, 400, 232, 444), grow=1)
piece("badge", BLUE & at(234, 400, 274, 444), grow=1, fill=True)
piece("handle", GREY & at(74, 452, 240, 490))
piece("tags", (GREY | BLUE) & at(74, 507, 420, 541))
# the bio: the ambassador line in three bites, then the rest a line at a time
piece("b_spacexai", WHITE & at(74, 572, 212, 612))
piece("b_dashi", WHITE & at(212, 572, 418, 612))
piece("b_maske", WHITE & at(418, 572, 750, 612))
piece("b_grokapp", WHITE & at(74, 614, 278, 652))
piece("b_author", WHITE & at(278, 614, 650, 652))
piece("b_heavy", WHITE & at(74, 654, 600, 690))
piece("b_fde", WHITE & at(74, 692, 600, 730))
piece("meta", (GREY | BLUE) & at(74, 797, 775, 840))
# the counts row
piece("following", (WHITE | GREY) & at(74, 862, 272, 902))
piece("followers", (WHITE | GREY) & at(300, 862, 445, 902), grow=1)
piece("subs", (WHITE | GREY) & at(474, 862, 592, 902))
piece("kol", (WHITE | GREY) & at(626, 862, 812, 902))
piece("kol118", (WHITE | GREY) & at(834, 862, 1020, 902))
piece("rank", (WHITE | GREY | GREEN) & at(74, 903, 318, 940) | (WHITE | GREY) & at(430, 903, 488, 940))
piece("rank2", (WHITE | GREY | GREEN) & at(508, 903, 935, 940))
# the hover tip: the grey pill, and 10,000 on it
pill = ndimage.binary_fill_holes(ndimage.binary_closing((TIP | WHITE) & at(318, 899, 430, 948), iterations=3))
pieces.append({"name": "tip", "kind": "box", "rings": rings(ndimage.binary_opening(pill, iterations=2), W, H, min_area=200, tol=0.7, close=0, hole=0)})
piece("tip_ink", WHITE & at(330, 905, 420, 942), grow=1)

out = {"w": W, "h": H, "src": "p10k-cover.png", "pieces": pieces}
(FILM / "build").mkdir(exist_ok=True)
(FILM / "build/cover2.json").write_text(json.dumps(out))
for p in pieces:
    print(f"{p['name']:11s} rings={len(p['rings']):3d} pts={sum(len(r) for r in p['rings'])}")
check_image(im, pieces, lambda p: (255, 60, 60) if p["name"].startswith("tip") else (255, 0, 255) if p["name"].startswith("follow") else (0, 220, 0)).save(FILM / "build/cover2-check.png")

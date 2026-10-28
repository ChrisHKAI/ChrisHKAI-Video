"""Act 3's wall: Ben Lang's post (2026-10-20), "Yet another hire joining our
team soon through the @SpaceXSI Ambassador program. Love to see it!", the
evidence under 铁柱AGI's own post about becoming an ambassador (the user,
2026-10-27: "唔用 email 做証據二，改用 ben 個貼"; the email version is kept as
recipes/cover-retro-email.py). The post is set again at 1.9x on white: his
picture, name and handle, the two lines of the post, the date line. The
browser extensions' bits in the screenshot (the 447 medal on his picture,
996/h, the translate line, the AI button) are left out, and his picture is cut
a little inside its circle so the medal's edge stays off it. Every word is
its own piece, cut from its own letters, so the words pop out one at a time
(film.json story.wallPop). "@SpaceXSI Ambassador" is set together at the
start of the second line: it is the payoff the toy points at. The right of
the card stays blank: the toy stands there, on the floor in front of the wall
(film.json story.act3Floor).

  ledge     his picture: rises as the wall stands
  title     "Ben Lang": flies out and slams back
  arrow     the blue verified badge: pops last
  h0        @benln
  w0…w8     Yet another hire joining our team soon through the
  box7      @SpaceXSI Ambassador: punches out, the toy points at it
  w9…w13    program. Love to see it!
  d0…d2     下午9:26 / 2026年10月20日 / 15.5萬 次查看

  assets/p1-cover.png   the card (2000 x 800, 5:2): the page's cover
  assets/cover-full.png the wall as published; assets/cover-wall.png the same
  build/cover.json      pieces: outline rings in cover UV (0..1, v down)

Source coordinates are px of the screenshot assets/p-ben.png (1186 x 407).

usage: FILM=films/cgnot996-intro python3 recipes/cover-retro.py
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
from cutlib import check_image, hsv, rings  # noqa: E402

src = Image.open(FILM / "assets/p-ben.png").convert("RGB")
K = 1.9
W, H = 2000, 800
card = Image.new("RGB", (W, H), (255, 255, 255))
placed = []  # (name, [dest boxes]) for every piece
LEFT, TOP = 110, 80


def put(box, at):
    """paste the source box scaled by K with its top left at `at`; returns the dest box"""
    x0, y0, x1, y1 = box
    piece = src.crop(box).resize((round((x1 - x0) * K), round((y1 - y0) * K)), Image.LANCZOS)
    card.paste(piece, at)
    return (at[0], at[1], at[0] + piece.width, at[1] + piece.height)


def line(words, y0, y1, x, y, names):
    """a line's words at their own spacing from (x, y); each word a piece unless its name is None"""
    a0 = words[0][0]
    for (a, b), name in zip(words, names):
        d = put((a - 1, y0, b + 1, y1), (x + round((a - a0) * K), y))
        if name:
            placed.append((name, [d]))
    return x + round((words[-1][1] - a0) * K)


# his picture, cut to a circle a little inside the screenshot's (the medal sits on its bottom edge)
CX, CY, R = 70, 79, 36
face = src.crop((CX - R, CY - R, CX + R, CY + R)).resize((round(2 * R * K),) * 2, Image.LANCZOS)
disk = Image.new("L", face.size, 0)
ImageDraw.Draw(disk).ellipse((0, 0, face.width - 1, face.height - 1), fill=255)
card.paste(face, (LEFT, TOP), disk)
placed.append(("ledge", [(LEFT, TOP, LEFT + face.width, TOP + face.height)]))
# name, badge and handle beside it, where the screenshot has them
NX = LEFT + face.width + round(22 * K)
NY = TOP + round((44 - (CY - R)) * K) - 6
placed.append(("title", [put((127, 44, 259, 82), (NX, NY))]))
placed.append(("arrow", [put((264, 44, 298, 82), (NX + round((264 - 127) * K), NY))]))
placed.append(("h0", [put((127, 86, 231, 118), (NX, NY + round(42 * K)))]))

# the post: line 1 up to "the"; line 2 starts with "@SpaceXSI Ambassador"
Y1 = 330
L1 = [(31, 79), (89, 210), (220, 276), (283, 388), (398, 448), (456, 533), (544, 618), (628, 748), (758, 808)]
line(L1, 215, 248, LEFT, Y1, [f"w{i}" for i in range(9)])
Y2 = Y1 + round(48 * K)
at = put((817, 215, 1002, 248), (LEFT, Y2))
amb = put((29, 263, 230, 296), (at[2] + round(10 * K), Y2))
placed.append(("box7", [at, amb]))
line([(239, 375), (387, 456), (465, 495), (506, 558), (569, 595)], 263, 296, amb[2] + round(10 * K), Y2, [f"w{i}" for i in range(9, 14)])
# the date line: time, date, views (the dots stay flat)
Y3 = Y2 + round(77 * K)
line([(32, 150), (160, 164), (174, 401), (417, 421), (432, 603)], 340, 368, LEFT, Y3, ["d0", None, "d1", None, "d2"])

for name in ("p1-cover.png", "cover-full.png", "cover-wall.png"):
    card.save(FILM / "assets" / name)

# every word cut from its own letters (dark, grey and blue ink), a little fatter so it stands as type;
# his picture and the badge are whole discs
hue, sat, val = hsv(card)
INK = (val < 0.6) | ((hue > 0.5) & (hue < 0.7) & (sat > 0.3))
pieces = []
for name, boxes in placed:
    m = np.zeros((H, W), bool)
    for x0, y0, x1, y1 in boxes:
        if name == "ledge":
            yy, xx = np.mgrid[y0:y1, x0:x1]
            m[y0:y1, x0:x1] = (xx - (x0 + x1) / 2) ** 2 + (yy - (y0 + y1) / 2) ** 2 <= ((x1 - x0) / 2 - 1) ** 2
        else:
            m[y0:y1, x0:x1] = INK[y0:y1, x0:x1]
    if name != "ledge":
        m = ndimage.binary_dilation(m, iterations=2)
    r = rings(m, W, H, min_area=10, tol=0.6, close=1, hole=20, fill=name in ("ledge", "arrow"))
    pieces.append({"name": name, "kind": "box", "rings": r})

out = {"w": W, "h": H, "src": "p1-cover.png", "pieces": pieces}
(FILM / "build").mkdir(exist_ok=True)
(FILM / "build/cover.json").write_text(json.dumps(out))
print(f"{len(pieces)} pieces: " + " ".join(p["name"] for p in pieces))
print("boxes (cover px): " + " ".join(f"{n}={b}" for n, b in placed if n in ("title", "box7", "ledge", "h0")))
check_image(card, pieces, lambda p: (255, 0, 255) if p["name"] in ("title", "box7", "ledge", "arrow") else (0, 200, 0)).save(FILM / "build/cover-check.png")

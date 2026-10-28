"""铁柱AGI's pinned post (10/21): Ben Lang's "Invite to SpaceXAI Ambassador
Onboarding" email, as the act 3 wall. The screenshot's words are small and its
middle is Gmail's own chrome, so the card is the letter set again at 1.5x on
white: the subject line with Ben Lang beside it, "Hey Tie Zhu,", the letter
(re-flowed onto two lines), the sign-up line and the two session links. Every
word is its own piece, cut from its own letters, so the English words pop out
one at a time on the beat (the user: "應該要該個英文字彈出黎，例 Invite，之後
to 等等"). The bottom right stays blank: the toy stands there, on the floor in
front of the wall (film.json story.act3Floor), and never in front of a word.

  title     "Onboarding", the subject's last word: flies out and slams back
  t0…t3     Invite / to / SpaceXAI / Ambassador, a word at a time before it
  ledge     Ben Lang (his cube and name): rises as the wall stands
  box7      "SpaceXAI's Ambassador" in the letter: punches out, the toy points at it
  arrow     Gmail's blue importance chevron
  h0…h2     Hey / Tie / Zhu,
  a*, b*    the letter's words; s0, s1 the session links

  assets/p1-cover.png   the card (2000 x 800, 5:2): the page's cover
  assets/cover-full.png the wall as published; assets/cover-wall.png the same
                        (no drawing of him on it: he leaves by the jump)
  build/cover.json      pieces: outline rings in cover UV (0..1, v down)

Source coordinates are px of the screenshot assets/p1-a.jpg (1970 x 998).

usage: FILM=films/cgnot996-intro python3 recipes/cover-retro.py
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

FILM = Path(os.environ["FILM"]).resolve()
sys.path.insert(0, str(Path(os.environ.get("SKILL", FILM.parents[1] / "skills/creator-toy-intro")) / "engine/lib"))
from cutlib import check_image, hsv, rings  # noqa: E402

src = Image.open(FILM / "assets/p1-a.jpg").convert("RGB")
K = 1.5
W, H = 2000, 800
card = Image.new("RGB", (W, H), (255, 255, 255))
placed = []  # (name, dest box) for every word


def put(name, box, at):
    """paste the source box scaled by K with its top left at `at`; returns the dest box"""
    x0, y0, x1, y1 = box
    piece = src.crop(box).resize((round((x1 - x0) * K), round((y1 - y0) * K)), Image.LANCZOS)
    card.paste(piece, at)
    d = (at[0], at[1], at[0] + piece.width, at[1] + piece.height)
    if name:
        placed.append((name, d))
    return d


def line(words, y0, y1, x, y, gap, limit, prefix, start=0, names=None):
    """lay a line's words left to right from (x, y), wrapping at `limit`; returns where it ended"""
    for i, (a, b) in enumerate(words):
        w = round((b - a + 2) * K)
        if x + w > limit:
            x, y = LEFT, y + round((y1 - y0) * K) + 20
        name = names[i] if names else f"{prefix}{start + i}"
        put(name, (a - 1, y0, b + 1, y1), (x, y))
        x += w + gap
    return x, y


LEFT = 110
# the subject, a word at a time; Onboarding is the title role (it slams)
x = LEFT
for name, (a, b) in zip(["t0", "t1", "t2", "t3", "title"], [(111, 211), (225, 263), (277, 461), (477, 725), (739, 972)]):
    d = put(name, (a - 3, 26, b + 3, 88), (x, 58))
    x = d[2] + round(12 * K)
put("arrow", (996, 36, 1038, 70), (x + 8, 80))
# Ben Lang, the sender, at the top right: his cube and his name
put(None, (6, 216, 66, 284), (1545, 52))
put(None, (104, 212, 240, 250), (1650, 72))
placed.append(("ledge", (1545, 52, 1650 + round(136 * K), 52 + round(68 * K))))
# Hey Tie Zhu,
line([(108, 153), (161, 194), (204, 257)], 482, 522, LEFT, 205, 14, 1900, "h")
# the letter, re-flowed: SpaceXAI's Ambassador is one piece, the payoff (box7)
A = [(108, 164), (175, 220), (229, 249), (259, 316), (326, 365), (375, 395), (405, 689), (698, 798),
     (807, 856), (861, 883), (889, 903), (910, 971), (978, 1041), (1047, 1071), (1079, 1211), (1217, 1341),
     (1346, 1441), (1447, 1599), (1605, 1721), (1727, 1806), (1811, 1847), (1852, 1932)]
names = [f"a{i}" for i in range(len(A))]
names[6] = "box7"
line(A, 561, 602, LEFT, 300, 14, 1900, "a", names=names)
# the sign-up line, kept left of the toy's corner (it ends before x 1445)
B = [(110, 127), (138, 197), (205, 225), (235, 269), (278, 311), (321, 357), (364, 437), (447, 491), (503, 528),
     (537, 567), (576, 619), (629, 650), (658, 694), (703, 830), (840, 948)]
line(B, 640, 680, LEFT, 470, 13, 1445, "b")
# the two session links
put("s0", (186, 704, 562, 740), (170, 590))
put("s1", (186, 744, 578, 780), (170, 650))

for name in ("p1-cover.png", "cover-full.png", "cover-wall.png"):
    card.save(FILM / "assets" / name)

# every word cut from its own letters (dark and blue ink), a little fatter so it stands as type
hue, sat, val = hsv(card)
INK = (val < 0.55) | ((hue > 0.55) & (hue < 0.7) & (sat > 0.35))
pieces = []
for name, (x0, y0, x1, y1) in placed:
    m = np.zeros((H, W), bool)
    m[y0:y1, x0:x1] = INK[y0:y1, x0:x1]
    m = ndimage.binary_dilation(m, iterations=2)
    r = rings(m, W, H, min_area=10, tol=0.6, close=1, hole=20, fill=name in ("ledge", "arrow"))
    pieces.append({"name": name, "kind": "box", "rings": r})

out = {"w": W, "h": H, "src": "p1-cover.png", "pieces": pieces}
(FILM / "build").mkdir(exist_ok=True)
(FILM / "build/cover.json").write_text(json.dumps(out))
print(f"{len(pieces)} pieces: " + " ".join(p["name"] for p in pieces))
print("boxes (cover px): " + " ".join(f"{n}={b}" for n, b in placed if n in ("title", "box7", "ledge", "h0")))
check_image(card, pieces, lambda p: (255, 0, 255) if p["name"] in ("title", "box7", "ledge", "arrow") else (0, 200, 0)).save(FILM / "build/cover-check.png")

"""The flat profile picture the mascot peels off as: the toy rendered flat with
an inked outline (scripts/lookdev.py --avatar) on a red disc with a white ring,
confetti and two leaves, inside X's black border.

usage: python3 scripts/avatar.py   → assets/avatar.png (1024², transparent outside)
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
N = 1024
SS = 2  # supersample
R = N * SS / 2
img = Image.new("RGBA", (N * SS, N * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
c = R
border = R * 0.06  # X's ring around a profile picture (4 of 134 px … a bit more, so it reads)
d.ellipse((0, 0, 2 * R, 2 * R), fill="#000000")
d.ellipse((border, border, 2 * R - border, 2 * R - border), fill="#E35A56")

rnd = random.Random(7)
cols = ["#F6C445", "#4E7BEF", "#7FC86B", "#F59A3B", "#FFFFFF", "#B44CC8"]
for i in range(26):
    a = rnd.random() * math.tau
    rr = R * (0.84 + rnd.random() * 0.1) if i % 2 else R * (0.2 + rnd.random() * 0.62)
    if rr < R * 0.82 and rnd.random() < 0.7:
        rr = R * (0.84 + rnd.random() * 0.08)
    x, y = c + math.cos(a) * rr, c + math.sin(a) * rr
    s = R * (0.018 + rnd.random() * 0.02)
    col = cols[i % len(cols)]
    k = i % 3
    if k == 0:
        d.ellipse((x - s, y - s, x + s, y + s), fill=col)
    elif k == 1:
        ang = rnd.random() * math.tau
        pts = [(x + s * 1.4 * math.cos(ang + j * math.tau / 3), y + s * 1.4 * math.sin(ang + j * math.tau / 3)) for j in range(3)]
        d.polygon(pts, fill=col)
    else:
        pts = [(x + j * s * 0.7, y + (s * 0.6 if j % 2 else -s * 0.6)) for j in range(5)]
        d.line(pts, fill=col, width=int(s * 0.5))
ring_r = R * 0.8
w = R * 0.035
d.ellipse((c - ring_r, c - ring_r, c + ring_r, c + ring_r), outline="#FFFFFF", width=int(w))


def leaf(cx, cy, length, ang):
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    ld.ellipse((cx - length, cy - length * 0.42, cx + length, cy + length * 0.42), fill="#6DBE5A")
    ld.line((cx - length * 0.8, cy, cx + length * 0.8, cy), fill="#4F9A41", width=int(length * 0.07))
    lay = lay.rotate(ang, center=(cx, cy), resample=Image.BICUBIC)
    img.alpha_composite(lay)


leaf(c - R * 0.74, c - R * 0.3, R * 0.15, 35)
leaf(c + R * 0.72, c - R * 0.12, R * 0.14, -40)
leaf(c - R * 0.66, c + R * 0.38, R * 0.12, -20)

toy = Image.open(ROOT / "build/lookdev/avatar-toy.png").convert("RGBA")
bb = toy.getbbox()
toy = toy.crop(bb)
scale = (R * 0.92) / toy.size[0]  # head ≈ half the picture
toy = toy.resize((int(toy.size[0] * scale), int(toy.size[1] * scale)), Image.LANCZOS)
# ears' tips near the ring top, the waist under the ring
ox = int(c - toy.size[0] / 2)
oy = int(c - ring_r * 0.86)
inside = Image.new("L", img.size, 0)
ImageDraw.Draw(inside).ellipse((c - ring_r + w / 2, c - ring_r + w / 2, c + ring_r - w / 2, c + ring_r - w / 2), fill=255)
lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
lay.paste(toy, (ox, oy), toy)
lay.putalpha(Image.composite(lay.getchannel("A"), Image.new("L", img.size, 0), inside))
img.alpha_composite(lay)
# the ring again over the body so the cut reads as the ring's
d = ImageDraw.Draw(img)
d.arc((c - ring_r, c - ring_r, c + ring_r, c + ring_r), 20, 160, fill="#FFFFFF", width=int(w))
img.resize((N, N), Image.LANCZOS).save(ROOT / "assets/avatar.png")
print("assets/avatar.png")

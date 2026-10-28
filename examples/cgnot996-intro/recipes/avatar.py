"""铁柱AGI's profile picture as the sticker that peels: his own picture, as it
is. It is already a 3D cartoon of the same character the toy is made from, so
the picture that peels and the toy that pops are one character without a
redraw (the user, 2026-10-27: "直接用返佢原本個頭像"). A 1024 px square,
transparent outside the circle, inside X's black ring.

The redraw the skill asks for (references/avatar.md: the toy rendered flat,
toy/lookdev-avatar.py --avatar, on his sky blue, chair and monitor) is kept
behind --redraw.

usage: FILM=films/cgnot996-intro python3 recipes/avatar.py [--redraw]   → assets/avatar.png
"""
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

FILM = Path(os.environ["FILM"]).resolve()
N = 1024
SS = 2  # supersample
S = N * SS
R = S / 2


def redraw():
    """his picture's backdrop simplified, the toy rendered flat in the middle"""
    sky = Image.new("RGBA", (S, S))
    top, bottom = (0x7F, 0xC4, 0xE8), (0x74, 0xB8, 0xDE)
    sky.putdata([tuple(round(a + (b - a) * (y / S)) for a, b in zip(top, bottom)) + (255,) for y in range(S) for _ in range(S)])
    d = ImageDraw.Draw(sky)
    # the monitor's dark edge at the right, the desk's white top along the bottom
    d.rounded_rectangle((S * 0.86, S * 0.5, S * 1.1, S * 0.9), radius=S * 0.02, fill="#2E2F35")
    d.rectangle((0, S * 0.9, S, S), fill="#D9D9DB")
    # the chair's backrest behind his shoulders, and its arm
    d.rounded_rectangle((S * 0.17, S * 0.42, S * 0.47, S * 0.95), radius=S * 0.07, fill="#1A2733")
    d.rounded_rectangle((S * 0.53, S * 0.42, S * 0.83, S * 0.95), radius=S * 0.07, fill="#1A2733")
    d.rounded_rectangle((S * 0.13, S * 0.78, S * 0.3, S * 0.84), radius=S * 0.02, fill="#3F434C")
    sky = sky.filter(ImageFilter.GaussianBlur(S * 0.004))
    toy = Image.open(FILM / "build/lookdev/avatar-toy.png").convert("RGBA")
    toy = toy.crop(toy.getbbox())
    scale = (S * 0.92) / toy.size[1]  # the head is a little over half the toy's height
    toy = toy.resize((int(toy.size[0] * scale), int(toy.size[1] * scale)), Image.LANCZOS)
    sky.alpha_composite(toy, (int(R - toy.size[0] / 2), int(S * 0.08)))
    return sky


scene = redraw() if "--redraw" in sys.argv else Image.open(FILM / "assets/avatar.jpg").convert("RGBA").resize((S, S), Image.LANCZOS)

# X's black ring, and transparent outside the circle
ring = S * 0.035
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
circle = Image.new("L", (S, S), 0)
ImageDraw.Draw(circle).ellipse((0, 0, S, S), fill=255)
inner = Image.new("L", (S, S), 0)
ImageDraw.Draw(inner).ellipse((ring, ring, S - ring, S - ring), fill=255)
img.paste(Image.new("RGBA", (S, S), (0, 0, 0, 255)), (0, 0), circle)
img.paste(scene, (0, 0), inner)
img.resize((N, N), Image.LANCZOS).save(FILM / "assets/avatar.png")
print("assets/avatar.png")

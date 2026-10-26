"""Cracks in the floor where a stone letter lands: a crushed middle and
branching cracks running out from it, dark with a pale broken edge, as RGBA
decals (assets/crack-0.png .. crack-3.png, 1024 x 1024).

usage: python3 scripts/cracks.py
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
N = 1024


def crack(seed):
    rng = random.Random(seed)
    big = N * 2
    ink = Image.new("L", (big, big), 0)  # the dark of the cracks
    edge = Image.new("L", (big, big), 0)  # the pale broken edge beside them
    di, de = ImageDraw.Draw(ink), ImageDraw.Draw(edge)
    c = big / 2

    def branch(x, y, a, length, width, depth):
        steps = int(length / 26)
        for _ in range(steps):
            a += rng.uniform(-0.2, 0.2) + (rng.choice((-1, 1)) * 0.5 if rng.random() < 0.12 else 0)  # straight runs, sharp turns
            nx, ny = x + 26 * math.cos(a), y + 26 * math.sin(a)
            di.line((x, y, nx, ny), fill=255, width=max(1, int(width)))
            de.line((x + 2, y + 3, nx + 2, ny + 3), fill=190, width=max(1, int(width * 0.6)))
            if depth < 3 and rng.random() < 0.09:
                branch(nx, ny, a + rng.choice((-1, 1)) * rng.uniform(0.5, 1.1), length * rng.uniform(0.3, 0.55), width * 0.6, depth + 1)
            x, y = nx, ny
            width *= 0.985
            if x < 20 or y < 20 or x > big - 20 or y > big - 20:
                break

    for i in range(rng.randint(9, 13)):
        a = 2 * math.pi * i / 11 + rng.uniform(-0.25, 0.25)
        r0 = rng.uniform(60, 110)
        branch(c + r0 * math.cos(a), c + r0 * math.sin(a), a, rng.uniform(0.32, 0.48) * big, rng.uniform(9, 15), 0)
    # a ring of short cracks round the crushed middle
    for i in range(40):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(90, 200)
        x, y = c + r * math.cos(a), c + r * math.sin(a)
        branch(x, y, a + rng.uniform(1.2, 1.9), rng.uniform(40, 110), 5, 3)
    di.ellipse((c - 150, c - 110, c + 150, c + 110), fill=220)  # the crushed middle (under the letter)
    ink = ink.filter(ImageFilter.GaussianBlur(1.2)).resize((N, N), Image.LANCZOS)
    edge = edge.filter(ImageFilter.GaussianBlur(1.5)).resize((N, N), Image.LANCZOS)
    rgba = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    pale = Image.new("RGBA", (N, N), (150, 146, 138, 255))
    dark = Image.new("RGBA", (N, N), (6, 6, 7, 255))
    rgba.paste(pale, (0, 0), edge)
    rgba.paste(dark, (0, 0), ink)
    return rgba


def main():
    for i in range(4):
        crack(11 + i * 7).save(ROOT / f"assets/crack-{i}.png")
    print("wrote 4 cracks")


if __name__ == "__main__":
    main()

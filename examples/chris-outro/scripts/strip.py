"""The torn handle in his hand, frame by frame (build/strip/####.png): the cream
paper strip with "@ChrisHKAI" printed on it, each letter gone from it the
frame it drops out as a letter of the name (scripts/choreo.py); the @ stays.
Also writes where each letter sits along the strip (build/strip.json:
centres, 0..1 across).

usage: python3 scripts/strip.py
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import timeline as T  # noqa: E402

PAPER = (239, 232, 214)
src = Image.open(ROOT / "assets/name-paper.png").convert("RGB")
ink = Image.open(ROOT / "assets/name.png").convert("L")
W, H = src.size
# the print's columns: runs of inked columns are the glyphs (@, then C h r i s H K A I)
dark = [any(ink.getpixel((x, y)) < 140 for y in range(int(H * 0.12), int(H * 0.88))) for x in range(W)]
runs, x = [], 0
while x < W:
    if dark[x]:
        x0 = x
        while x < W and dark[x]:
            x += 1
        runs.append((x0, x))
    x += 1
runs = [r for r in runs if r[1] - r[0] > 1]  # the handle is light: its I is a thin stem
# letters that touch (K and A) come as one run: split such runs where the ink is thinnest
count = [sum(1 for y in range(int(H * 0.12), int(H * 0.88)) if ink.getpixel((x, y)) < 140) for x in range(W)]
typical = sorted(b - a for a, b in runs)[len(runs) // 2]
split = []
for a, b in runs:
    if b - a > 1.7 * typical:
        mid = min(range(a + (b - a) // 3, b - (b - a) // 3), key=lambda x: count[x])
        split += [(a, mid), (mid, b)]
    else:
        split.append((a, b))
runs = split
assert len(runs) == 10, runs
glyphs = runs[1:]
# release: each letter leaves the strip a little before it lands
RELEASE = T.RELEASE


def main():
    out = ROOT / "build/strip"
    out.mkdir(parents=True, exist_ok=True)
    states = []
    for k in range(10):
        im = src.copy()
        d = ImageDraw.Draw(im)
        for x0, x1 in glyphs[:k]:
            d.rectangle((x0 - 2, int(H * 0.1), x1 + 2, int(H * 0.9)), fill=PAPER)
        states.append(im)
    for f in range(1, T.FRAMES + 1):
        t = (f - 1) / T.FPS
        k = sum(1 for r in RELEASE if t >= r)
        states[k].save(out / f"{f:04d}.png")
    (ROOT / "build/strip.json").write_text(json.dumps({"centres": [((a + b) / 2) / W for a, b in glyphs],
                                                        "runs": glyphs, "heights": [0.5] * 9, "release": RELEASE}))
    print("glyph runs", glyphs)


if __name__ == "__main__":
    main()

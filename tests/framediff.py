"""Compares rendered frames with a reference film's frames, pixel by pixel.

usage: python3 tests/framediff.py <frames folder> <reference frames folder> [--sheet out.jpg]
Prints, per frame: PSNR (dB, inf = identical), the mean and largest channel
difference (0–255) and the share of pixels off by more than 4 levels.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

a_dir, b_dir = Path(sys.argv[1]), Path(sys.argv[2])
sheet = sys.argv[sys.argv.index("--sheet") + 1] if "--sheet" in sys.argv else None
rows, worst = [], 0
for fa in sorted(a_dir.glob("*.png")):
    fb = b_dir / fa.name
    if not fb.exists():
        print(f"{fa.name}: no reference")
        continue
    a = np.asarray(Image.open(fa).convert("RGB"), dtype=np.float32)
    b = np.asarray(Image.open(fb).convert("RGB"), dtype=np.float32)
    d = np.abs(a - b)
    mse = float((d ** 2).mean())
    psnr = float("inf") if mse == 0 else 10 * np.log10(255 ** 2 / mse)
    off = float((d.max(axis=2) > 4).mean() * 100)
    worst = max(worst, off)
    rows.append((fa.name, a, b, d))
    print(f"{fa.name}: PSNR {psnr:6.2f} dB   mean {d.mean():5.2f}   max {d.max():5.0f}   off>4: {off:5.2f}%")
print(f"\nworst frame: {worst:.2f}% of pixels off by more than 4 levels")
if sheet and rows:
    tw = 480
    th = round(tw * rows[0][1].shape[0] / rows[0][1].shape[1])
    out = Image.new("RGB", (tw * 3, th * len(rows)))
    for i, (name, a, b, d) in enumerate(rows):
        for j, im in enumerate((a, b, np.clip(d * 8, 0, 255))):
            out.paste(Image.fromarray(im.astype(np.uint8)).resize((tw, th)), (j * tw, i * th))
    out.save(sheet, quality=85)
    print("sheet:", sheet, "(new | reference | difference x8)")

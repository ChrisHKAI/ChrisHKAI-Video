"""Contact sheet of rendered frames, each labelled with its film time.

usage: python3 scripts/sheet.py <dir> <out.jpg> <frame,frame,...> [cols] [width]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

src, out, frames = Path(sys.argv[1]), sys.argv[2], [int(f) for f in sys.argv[3].split(",")]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 4
tw = int(sys.argv[5]) if len(sys.argv) > 5 else 480
ims = [Image.open(src / f"{f:04d}.png").convert("RGB") for f in frames]
th = round(tw * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), "#000")
font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", max(12, tw // 24))
for i, (f, im) in enumerate(zip(frames, ims)):
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y))
    d = ImageDraw.Draw(sheet)
    d.rectangle([x, y, x + tw // 4.2, y + tw // 18], fill="#000")
    d.text((x + 4, y + 2), f"{(f - 1) / 30:5.2f}s", fill="#ff0", font=font)
sheet.save(out, quality=88)
print(out, sheet.size)

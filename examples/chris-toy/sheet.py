"""Contact sheet of look-dev renders: python sheet.py <dir> <out.jpg> name,name,... [cols]"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
src, out, names = Path(sys.argv[1]), sys.argv[2], sys.argv[3].split(",")
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 3
ims = [Image.open(src / f"{n}.png").convert("RGB") for n in names]
w, h = ims[0].size
sheet = Image.new("RGB", (cols * w, ((len(ims) + cols - 1) // cols) * h))
font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 20)
for i, (n, im) in enumerate(zip(names, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    ImageDraw.Draw(sheet).text((x + 8, y + 6), n, fill=(255, 255, 0), font=font)
sheet.save(out, quality=90)

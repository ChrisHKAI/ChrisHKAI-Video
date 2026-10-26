"""The keynote screen's slide, as a grey mask the screen's shader lays over its
gradient (black at the top to a dusky lavender, scripts/scene.py SLIDES): "iPhone Duo", set as "iPhone" was on the big screen in January 2007
(white, centred a little high; 62% of the screen's width). SF Pro Semibold
stands in for Apple's Myriad.

usage: python3 scripts/slide.py   → assets/keynote-iphone-duo.png
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1920, 1080
SF = "/System/Library/Fonts/SFNS.ttf"


def semibold(size):
    f = ImageFont.truetype(SF, size)
    f.set_variation_by_name("Semibold")
    return f


probe = ImageDraw.Draw(Image.new("L", (1, 1)))
text, width = "iPhone Duo", 0.62
f = semibold(round(200 * width * W / probe.textlength(text, font=semibold(200))))
im = Image.new("L", (W, H), 0)
ImageDraw.Draw(im).text((W / 2, H * 0.43), text, font=f, fill=255, anchor="mm")
out = ROOT / "assets/keynote-iphone-duo.png"
im.save(out)
print(out)

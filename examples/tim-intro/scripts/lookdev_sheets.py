"""Look-dev sheets for review: the HD renders tiled with Cantonese captions.

usage: python3 scripts/lookdev_sheets.py   → build/lookdev-sheets/*.jpg
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "build/lookdev-hd"
OUT = ROOT / "build/lookdev-sheets"
LTH = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/f14049099a04e570b893c01d9a4cd71f87c9e8d8.asset/AssetData/Lantinghei.ttc"
FONT = ImageFont.truetype(LTH, 34, index=5)  # Lantinghei TC Heavy


def tile(items, cols, w, out, crop=None):
    ims = []
    for name, cap in items:
        im = Image.open(name if isinstance(name, Path) else SRC / f"{name}.png").convert("RGB")
        if crop:
            im = im.crop(crop(im))
        ims.append((im.resize((w, round(w * im.height / im.width)), Image.LANCZOS), cap))
    h = ims[0][0].height
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w, rows * h), "#111")
    d = ImageDraw.Draw(sheet)
    for i, (im, cap) in enumerate(ims):
        x, y = (i % cols) * w, (i // cols) * h
        sheet.paste(im, (x, y))
        tw = d.textlength(cap, font=FONT)
        d.rounded_rectangle([x + 18, y + 16, x + 46 + tw, y + 66], radius=12, fill=(20, 20, 24))
        d.text((x + 32, y + 22), cap, font=FONT, fill=(255, 255, 255))
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / out, quality=90)
    print(out, sheet.size)


tile([("front", "正面"), ("threequarter", "3/4 · 打開 iPhone Duo"), ("side", "側面"), ("back", "背面")], 2, 960, "1-turnaround.jpg")
still = ROOT.parent.parent / "reference/tim/tim-still.webp"
tile([(still, "參考相"), ("photo", "玩具版")], 2, 960, "2-likeness.jpg", crop=lambda im: (0, 0, im.width, im.height) if im.width < im.height else (im.width // 2 - im.height * 1039 // 1336 // 2, 0, im.width // 2 + im.height * 1039 // 1336 // 2, im.height))
tile([("face", "特寫 · 驚訝"), ("grip", "揸住打開嘅 Duo"), ("gripShut", "用力摺埋"), ("duoPov", "iPhone Duo · 打開（中間有摺痕）"), ("duoHalf", "半摺"), ("duoShut", "摺埋 · 背面雙鏡頭")], 3, 640, "3-closeups-duo.jpg")
crop = lambda im: (im.width // 4, 0, im.width * 3 // 4, im.height)
tile([("expr_surprised", "驚訝"), ("expr_happy", "大笑"), ("expr_focus", "專注"), ("expr_strain", "用力"), ("expr_tired", "攰"), ("expr_calm", "微笑")], 3, 640, "4-expressions.jpg", crop=crop)

# Steve Jobs
tile([("jobsFront", "正面"), ("jobs34", "3/4 · 行路"), ("jobsSide", "側面"), ("jobsBack", "背面")], 2, 960, "5-jobs-turnaround.jpg")
bw = ROOT.parent.parent / "reference/tim/steve-jobs-bw.jpg"
tile([(bw, "參考相"), ("jobsChin", "玩具版"), ("jobsFace", "特寫 · 微笑")], 3, 640, "6-jobs-likeness.jpg",
     crop=lambda im: (0, 0, im.width, im.height) if im.width < 1000 else (im.width // 2 - int(im.height * 1.494) // 2 - 140, 0, im.width // 2 + int(im.height * 1.494) // 2 - 140, im.height))
tile([(bw, "黑白相"), ("relief+0_2", "3D 化 · 正面"), ("relief-20_4", "轉 20°"), ("relief+30_6", "轉 30°")], 2, 960, "7-jobs-photo-relief.jpg",
     crop=lambda im: (0, 0, im.width, im.height) if im.width < 1000 else ((im.width - int(im.height * 1.494)) // 2, 0, (im.width + int(im.height * 1.494)) // 2, im.height))

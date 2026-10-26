"""Cuts each platform's covers from the held last frame: the end card is the cover.

film.json "publish" lists where the film goes (ids in engine/lib/platforms.json);
without it, the platform of the film's stage theme. Each cover is the whole
frame or a centred cut of it at the film's own pixels, so nothing is scaled.
The end card's content (labels, toy, prop) is found from its edges; a cut that
loses some of it is reported, and build/covers-check.jpg shows every cut on the
frame for a look before uploading.

usage: FILM=<film folder> python3 engine/scripts/covers.py [--in build/final] [--frame N] [--publish xhs,ig]
writes out/covers/<platform>-<kind>-<w>x<h>.jpg
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM  # noqa: E402  the film workspace (FILM env var)
from publish import PLATFORMS, platforms, orientation, content_box, past, font  # noqa: E402

argv = sys.argv[1:]


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


SRC = FILM / arg("--in", "build/final")
OUT = FILM / "out/covers"
CHECK = FILM / "build/covers-check.jpg"
publish = platforms(argv)

frames = sorted(SRC.glob("*.png"))
if not frames:
    sys.exit(f"no frames in {SRC}: run finish first (or pass --in)")
src = SRC / f"{int(arg('--frame', 0)):04d}.png" if "--frame" in argv else frames[-1]
frame = Image.open(src).convert("RGB")
W, H = frame.size
orient = orientation(W, H)
content = content_box(frame)


def cut(aspect):
    """The centred box of this aspect ("full" or "w:h") at the frame's pixels."""
    if aspect == "full":
        return (0, 0, W, H)
    a, b = map(int, aspect.split(":"))
    w, h = (W, round(W * b / a)) if a / b > W / H else (round(H * a / b), H)
    w, h = w - w % 2, h - h % 2
    x, y = (W - w) // 2, (H - h) // 2
    return (x, y, x + w, y + h)


OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("*.jpg"):  # covers from an earlier publish list
    if old.name.split("-")[0] in PLATFORMS:
        old.unlink()
made = []
for p in publish:
    for c in PLATFORMS[p]["covers"][orient]:
        box = cut(c["aspect"])
        w, h = box[2] - box[0], box[3] - box[1]
        out = OUT / f"{p}-{c['kind']}-{w}x{h}.jpg"
        frame.crop(box).save(out, quality=95, subsampling=0)
        miss = past(content, box)
        made.append((p, c, box, out, miss))
        note = "" if not miss else "  ! cuts the end card: " + ", ".join(f"{v}px {k}" for k, v in miss.items())
        print(f"{PLATFORMS[p]['name']} {c['kind']} {c['aspect']} → {out.relative_to(FILM)}{note}")
if any(m[4] for m in made):
    print("Some cuts lose part of the end card: the film's orientation suits other platforms (make the other orientation), or move the end card in film.json \"cta\".")

# the check sheet: the frame with every cut drawn on it, then the covers side by side
label = font(22)
SH = 900
k = SH / H
left = frame.resize((round(W * k), SH), Image.LANCZOS)
d = ImageDraw.Draw(left)
COLOURS = ["#FF3B30", "#34C759", "#0A84FF", "#FFD60A", "#BF5AF2", "#FF9F0A"]
cuts = sorted({(c["aspect"], box) for _, c, box, _, _ in made if c["aspect"] != "full"})
for i, (aspect, box) in enumerate(cuts):
    col = COLOURS[i % len(COLOURS)]
    d.rectangle([v * k for v in box], outline=col, width=3)
    d.text((box[0] * k + 8, box[1] * k + 6 + 26 * i), aspect, fill=col, font=label)
d.rectangle([v * k for v in content], outline="#FFFFFF", width=1)
TH = SH // 2
thumbs = []
for p, c, box, out, miss in made:
    im = Image.open(out)
    t = im.resize((round(im.width * TH / im.height), TH), Image.LANCZOS)
    ImageDraw.Draw(t).text((8, 6), f"{p} {c['kind']}{' (cut)' if miss else ''}", fill="#FF3B30" if miss else "#FFFFFF", font=label)
    thumbs.append(t)
rows_of = [thumbs[i::2] for i in range(2)]
right_w = max((sum(t.width for t in r) + 8 * len(r) for r in rows_of), default=0)
sheet = Image.new("RGB", (left.width + 8 + right_w, SH), "#111")
sheet.paste(left, (0, 0))
for r, row in enumerate(rows_of):
    x = left.width + 8
    for t in row:
        sheet.paste(t, (x, r * TH))
        x += t.width + 8
sheet.save(CHECK, quality=90)
print(f"from {src.relative_to(FILM) if src.is_relative_to(FILM) else src}; check sheet → {CHECK.relative_to(FILM)}")

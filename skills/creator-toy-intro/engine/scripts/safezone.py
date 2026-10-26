"""Lays each platform's own controls over preview frames, so nothing the
viewer must read ends up under a top bar, a caption or a column of buttons.

The platforms are film.json "publish" (engine/lib/platforms.json). The sheet
opens with one blank frame per platform, its controls drawn in; then every
frame with all their parts shaded, each platform's outline in its colour and
the safe box (clear of all of them) in white. Counters, labels and the end
card's text belong inside the white box. The end card, when a frame of its
hold is among them, is also checked by itself.

usage: FILM=<film folder> python3 engine/scripts/safezone.py [--in build/previs] [--frames 16,391,871] [--publish douyin,ig]
writes build/safezone-check.jpg
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON  # noqa: E402  the film workspace (FILM env var)
from publish import PLATFORMS, SAFE, platforms, orientation, content_box, overlap, past, font  # noqa: E402

argv = sys.argv[1:]


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


SRC = FILM / arg("--in", "build/previs")
CHECK = FILM / "build/safezone-check.jpg"
FPS, DURATION = FILM_JSON["format"]["fps"], FILM_JSON["format"]["duration"]
COLOURS = {"x": "#1D9BF0", "douyin": "#FE2C55", "xhs": "#FF9F0A", "channels": "#07C160", "ig": "#BF5AF2"}
publish = platforms(argv)

frames = sorted(SRC.glob("*.png"))
if "--frames" in argv:
    frames = [SRC / f"{int(f):04d}.png" for f in arg("--frames", "").split(",")]
    frames = [f for f in frames if f.exists()] or sys.exit(f"none of those frames in {SRC}")
if not frames:
    sys.exit(f"no frames in {SRC}: render previews first (render -- --frames … --out build/previs)")
first = Image.open(frames[0])
W, H = first.size
orient = orientation(W, H)
TW = 300 if orient == "portrait" else 480
TH = round(TW * H / W)
k = TW / W
px = lambda box, w=TW, h=TH: [box[0] * w, box[1] * h, box[2] * w, box[3] * h]  # noqa: E731  fractions → thumbnail px
zones = [(p, z) for p in publish for z in PLATFORMS[p]["zones"][orient]]
label = font(max(13, TW // 22))


def controls(d, p, z):
    """A platform's controls in a zone, sketched: a bar of icons, a column of buttons, caption lines."""
    x0, y0, x1, y1 = px(z["box"])
    col = COLOURS.get(p, "#FFFFFF")
    if z["kind"] == "bar":
        for i in range(3):
            cx = x0 + (x1 - x0) * (0.3 + 0.2 * i)
            d.rounded_rectangle([cx - 18, (y0 + y1) / 2 - 3, cx + 18, (y0 + y1) / 2 + 3], 3, fill=col)
    elif z["kind"] == "buttons":
        r = min(x1 - x0, (y1 - y0) / 5) * 0.32
        for i in range(4):
            cy = y0 + (y1 - y0) * (0.12 + 0.24 * i)
            d.ellipse([(x0 + x1) / 2 - r, cy - r, (x0 + x1) / 2 + r, cy + r], outline=col, width=2)
    else:
        for i, w in enumerate((0.55, 0.75, 0.4)):
            y = y0 + (y1 - y0) * (0.22 + 0.2 * i)
            d.rounded_rectangle([x0 + 0.05 * TW, y, x0 + 0.05 * TW + w * 0.7 * TW, y + 5], 2, fill=col)


def shade(im):
    """All the platforms' controls shaded on a thumbnail, their outlines, the safe box."""
    veil = Image.new("L", im.size, 0)
    dv = ImageDraw.Draw(veil)
    for _, z in zones:
        dv.rectangle(px(z["box"]), fill=120)
    im.paste(Image.new("RGB", im.size, "#000"), (0, 0), veil)
    d = ImageDraw.Draw(im)
    for p, z in zones:
        d.rectangle(px(z["box"]), outline=COLOURS.get(p, "#FFFFFF"), width=1)
    d.rectangle(px(SAFE[orient]), outline="#FFFFFF", width=2)
    return d


# one blank frame per platform, its controls sketched in
legend = []
for p in publish:
    im = Image.new("RGB", (TW, TH), "#2A2D33")
    d = ImageDraw.Draw(im)
    for z in PLATFORMS[p]["zones"][orient]:
        d.rectangle(px(z["box"]), fill="#15171A", outline=COLOURS.get(p, "#FFFFFF"))
        controls(d, p, z)
    d.rectangle(px(SAFE[orient]), outline="#FFFFFF", width=2)
    d.text((TW / 2, TH / 2), PLATFORMS[p]["name"], fill=COLOURS.get(p, "#FFFFFF"), font=font(TW // 8, cjk=True), anchor="mm")
    legend.append(im)

thumbs = []
for f in frames:
    im = Image.open(f).convert("RGB").resize((TW, TH), Image.LANCZOS)
    d = shade(im)
    d.text((6, TH - 6), f"{int(f.stem) / FPS:.2f}s", fill="#FFD60A", font=label, anchor="ls")
    thumbs.append(im)

cols = 6 if orient == "portrait" else 3
rows = [legend] + [thumbs[i:i + cols] for i in range(0, len(thumbs), cols)]
G = 6
sheet = Image.new("RGB", (max(len(r) for r in rows) * (TW + G) - G, len(rows) * (TH + G) - G), "#000")
for r, row in enumerate(rows):
    for c, im in enumerate(row):
        sheet.paste(im, (c * (TW + G), r * (TH + G)))
sheet.save(CHECK, quality=90)
print(f"{len(frames)} frames, {', '.join(PLATFORMS[p]['name'] for p in publish)} → {CHECK.relative_to(FILM)}")
print("Look at it: counters, labels and the end card's text belong inside the white box, clear of the shaded controls.")

# the end card by itself, when a frame of its hold is here: its content against each platform's controls
hold = [f for f in frames if int(f.stem) >= (DURATION - 1.5) * FPS]
if hold:
    end = Image.open(hold[-1]).convert("RGB")
    box = content_box(end)
    safe = [round(v) for v in (SAFE[orient][0] * W, SAFE[orient][1] * H, SAFE[orient][2] * W, SAFE[orient][3] * H)]
    out = past(box, safe)
    print(f"end card ({int(hold[-1].stem) / FPS:.2f}s): content {box[0]}–{box[2]} x {box[1]}–{box[3]} px")
    print("  inside the safe box" if not out else "  past the safe box: " + ", ".join(f"{v}px {s}" for s, v in out.items()))
    for p, z in zones:
        zb = [round(v) for v in (z["box"][0] * W, z["box"][1] * H, z["box"][2] * W, z["box"][3] * H)]
        o = overlap(box, zb)
        if o:
            print(f"  under {PLATFORMS[p]['name']} {z['kind']}: {o[2] - o[0]}x{o[3] - o[1]} px (labels, toy and prop count together: look whether any text is there)")
else:
    print(f"(no frame from the end card's hold, {DURATION - 1.5:g}s on, among them: add one to check the end card by itself)")

"""Step 3's checkpoint: the toy's look-dev turnaround beside the picture(s) the
user chose for it (film.json "toyFrom"), one sheet to judge the likeness by.
Feedback comes back in words; each round re-runs `lookdev`.

usage: FILM=<film folder> python3 engine/scripts/toysheet.py [--in build/lookdev]
writes build/lookdev/compare.jpg
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON  # noqa: E402  the film workspace (FILM env var)
from publish import font  # noqa: E402

argv = sys.argv[1:]
SRC = FILM / (argv[argv.index("--in") + 1] if "--in" in argv else "build/lookdev")
VIEWS = ["front", "threequarter", "side", "back", "face"]
H = 540  # one row's height; the views are 960x540

refs = [FILM / r for r in FILM_JSON.get("toyFrom", []) if (FILM / r).exists()]
views = [(v, SRC / f"{v}.png") for v in VIEWS if (SRC / f"{v}.png").exists()]
if not views:
    sys.exit(f"no look-dev views in {SRC}: run the lookdev step first")

def fit(im, h):
    im = im.convert("RGB")
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)

# left: the reference pictures stacked into two rows' height; right: the views, three to a row
left = [fit(Image.open(r), H if len(refs) == 1 else H * 2 // len(refs)) for r in refs]
lw = max((im.width for im in left), default=0)
cols = 3
rows = (len(views) + cols - 1) // cols
VW = 960 * H // 540
sheet = Image.new("RGB", (lw + (16 if lw else 0) + cols * VW + (cols - 1) * 8, max(rows * H + (rows - 1) * 8, sum(im.height for im in left))), "#101114")
y = 0
for im in left:
    sheet.paste(im, (0, y))
    y += im.height
d = ImageDraw.Draw(sheet)
label = font(26)
if left:
    d.text((12, 10), "toyFrom", fill="#FFD60A", font=label)
for i, (name, path) in enumerate(views):
    x = lw + (16 if lw else 0) + (i % cols) * (VW + 8)
    yy = (i // cols) * (H + 8)
    sheet.paste(fit(Image.open(path), H), (x, yy))
    d.text((x + 12, yy + 10), name, fill="#FFD60A", font=label)
out = SRC / "compare.jpg"
sheet.save(out, quality=90)
print(f"compare sheet → {out.relative_to(FILM)} ({len(refs)} reference, {len(views)} views)")

# the toy's colours on the film's dark stage, now, while the user is approving it: a big part that melts
# into the stage (dark hair, a black hoodie) is lifted here, so what they approve is what the film shows
import colors  # noqa: E402

stage, _ = colors.stage_for(FILM)
if stage != "dark":
    print(f"the toy is dark ({colors.darkness(FILM) * 100:.0f}% of it would melt into the dark stage): the film plays on the "
          "mid-tone stage instead, and this sheet shows it there (film.json look.stage keeps it on \"dark\")")
for r in colors.toy_colours(FILM):
    if r["share"] >= 0.1 and r["contrast"] < colors.MELT:
        print(f"! the toy's {r['key']} ({r['hex']}, {r['share'] * 100:.0f}% of it) melts into the {stage} stage "
              f"({r['contrast']:.2f}:1, {colors.MELT}:1 reads): lift the colour to {colors.lift(r['hex'], against=colors.STAGES[stage]['sky'])} "
              "in toy.json (the same hue, just findable) and show the user the change here")

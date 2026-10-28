"""The creator's own colours, and how the film's colours stand on the stage.

Colours come from their own pictures, never from memory. The pictures are:
- the profile picture (counted three times);
- the photos the toy was made from (twice);
- the page's banner and the covers (once each).

Left alone, a film settles on "near-black and one warm accent". These are
the colours to choose from instead: the confetti (film.json pop), a beat's
lettering ("color"), the toy's paint.

Beside them, the film's colours against the dark stage (WCAG contrast):
- the toy's, by how much of it each covers;
- every colour of lettering;
- the confetti.
Each one that will not read is marked (engine/lib/colors.py).

usage: FILM=<film folder> python3 engine/scripts/palette.py   (after run.mjs anim)
       → build/palette.json, build/palette-check.jpg
"""
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# the engine: the skill running this (SKILL, set by engine/run.mjs), else the one this file sits in
sys.path.insert(0, str(Path(os.environ.get("SKILL") or Path(__file__).resolve().parents[2]) / "engine" / "lib"))
from film import FILM, FILM_JSON  # noqa: E402
import colors  # noqa: E402

F = FILM_JSON
A = FILM / "assets"
pics = []
if (A / "avatar.png").exists():
    pics.append(("profile picture", A / "avatar.png", 3))
pics += [("photo", FILM / p, 2) for p in F.get("toyFrom", []) if (FILM / p).exists()]
pics += [("banner", p, 1) for p in sorted(A.glob("banner*.*")) if p.suffix.lower() in (".jpg", ".jpeg", ".png")]
pinned = (F.get("posts") or {}).get("pinned", {}).get("cover")
if pinned and (FILM / pinned).exists():
    pics.append(("pinned cover", FILM / pinned, 1))
if (A / "retro.png").exists():
    pics.append(("second post", A / "retro.png", 1))
if not pics:
    raise SystemExit("no pictures of the creator's yet (assets/avatar.png, banner, covers): run the research step first")

rows, accents = colors.creator_colours([(label, str(p), w) for label, p, w in pics])
fc = colors.film_colours(FILM) if (FILM / "build/anim.json").exists() else None
bad = colors.problems(fc) if fc else []
STAGE = colors.STAGE
out = {"stage": STAGE, "pictures": [str(p.relative_to(FILM)) for _, p, _ in pics],
       "creator": [{**r, "contrast": round(colors.contrast(r["hex"], STAGE), 2)} for r in rows],
       "accents": [r["hex"] for r in accents], "film": fc,
       "problems": [{"kind": k, **r} for k, r in bad]}
(FILM / "build").mkdir(exist_ok=True)
(FILM / "build/palette.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))

# ── the sheet ───────────────────────────────────────────────────────────────
W, PAD = 1400, 24
try:
    font, small = ImageFont.load_default(size=22), ImageFont.load_default(size=17)
except TypeError:  # an older Pillow: its one small font
    font = small = ImageFont.load_default()
fc_rows = [("the toy", [(r["hex"], f"{r['key']} {r['share'] * 100:.0f}%", r["contrast"], colors.MELT if r["share"] >= 0.1 else 0) for r in fc["toy"]]),
           ("the lettering", [(r["hex"], f"x{r['objects']}" + ("" if r["on"] == STAGE.upper() else " on paper"), r["contrast"], colors.READ) for r in fc["text"]]),
           ("the confetti", [(r["hex"], "", r["contrast"], colors.MELT) for r in fc["confetti"]])] if fc else []
H = 120 + 150 + 60 + sum(60 + 120 * ((len(items) + 7) // 8) for _, items in fc_rows) + PAD
sheet = Image.new("RGB", (W, H), STAGE)
d = ImageDraw.Draw(sheet)
y = PAD
d.text((PAD, y), "Their colours, from: " + ", ".join(sorted({label for label, _, _ in pics})), fill=(236, 234, 230), font=font)
y += 40
x = PAD
for r in rows:  # every colour by its share
    w = round((W - 2 * PAD) * r["share"])
    d.rectangle((x, y, x + w, y + 50), fill=r["hex"])
    x += w
y += 80
d.text((PAD, y), "The accents to choose from (contrast on the stage):", fill=(236, 234, 230), font=font)
y += 36
for i, r in enumerate(accents[:8]):
    x = PAD + i * 170
    d.rectangle((x, y, x + 150, y + 80), fill=r["hex"])
    d.text((x, y + 86), f"{r['hex']}  {colors.contrast(r['hex'], STAGE):.1f}:1", fill=(200, 198, 192), font=small)
y += 150


def mark(c, need):
    return (226, 70, 59) if need and c < need else (154, 151, 143)


for title, items in fc_rows:
    d.text((PAD, y), f"{title} on the stage ({STAGE})", fill=(236, 234, 230), font=font)
    y += 40
    for i, (h, note, c, need) in enumerate(items):
        x, yy = PAD + (i % 8) * 170, y + (i // 8) * 120
        d.rectangle((x, yy, x + 150, yy + 60), fill=h, outline=(60, 62, 68))
        d.text((x, yy + 64), f"{h} {note}", fill=(200, 198, 192), font=small)
        d.text((x, yy + 84), f"{c:.1f}:1" + ("  will not read" if need and c < need else ""), fill=mark(c, need), font=small)
    y += 20 + 120 * ((len(items) + 7) // 8)
sheet.crop((0, 0, W, y + PAD)).save(FILM / "build/palette-check.jpg", quality=90)

print(f"palette → build/palette.json, build/palette-check.jpg (from {len(pics)} pictures)")
print("  their accents:", " ".join(f"{r['hex']} ({colors.contrast(r['hex'], STAGE):.1f}:1)" for r in accents[:6]) or "none: their pictures are greys")
if fc is None:
    print("  ! no build/anim.json yet: the film's colours not checked (run.mjs anim)")
for k, r in bad:
    if k == "toy":
        what = f"the toy's {r['key']} {r['hex']} ({r['share'] * 100:.0f}% of it)"
    elif k == "text":
        what = f"lettering in {r['hex']} on {r['on']} ({r['objects']} objects: {', '.join(r['names'])})"
    else:
        what = f"confetti {r['hex']}"
    print(f"  ! {what}: {r['contrast']:.1f}:1 on the stage, will not read")
if fc and not bad:
    print("  ✓ the toy, the lettering and the confetti all read on the stage")

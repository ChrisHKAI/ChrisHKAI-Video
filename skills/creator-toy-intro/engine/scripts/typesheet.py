"""Choosing the film's faces (no face is the skill's own: engine/lib/fonts.py).

  FILM=<film> python3 engine/scripts/typesheet.py --list
      every face on this computer (and in the film's fonts/) that has every character the film shows
  FILM=<film> python3 engine/scripts/typesheet.py --faces "PingFang TC:Semibold,Lantinghei TC:Heavy,Songti TC:Bold"
      [--color "#FFFDF7"] [--edge "#2F6BD8"] [--edge-width 0.06] [--track 0.08] [--text "再看懂彼此,連結你"]
      → build/type-sheet.jpg: the film's own lines (its beats' words and its slogan, or --text) set in each face, as
        big as a beat's line stands on screen (10% of the frame's height) and as small as a line beside the toy (6%),
        on the film's stage, shrunk to the size a phone shows the film; the computer's own text recognition reads
        each back (engine/lib/reading.py), and the sheet says what it read and how much of each line's box is ink
        (a dense face over about 45% closes its strokes up when small)

The sheet is flat type, not the 3D lettering: it compares the faces. The film's own frames are read again on
the story page (storyboard), with the finish's bloom.
"""
import json
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON  # noqa: E402
import fonts  # noqa: E402
import reading  # noqa: E402

argv = sys.argv[1:]


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default


F = FILM_JSON
EXTRA = [str(FILM / "fonts")]


def words(v):
    if isinstance(v, str):
        return "" if v.startswith("#") else v
    if isinstance(v, list):
        return "".join(words(x) for x in v)
    if isinstance(v, dict):
        return "".join(words(x) for x in v.values())
    return ""


cta = F.get("cta") or {}
BEATS = [s for s in (F.get("story") or {}).get("segments", []) if "beat" in s]
CHARS = "".join(words({k: v for k, v in s.items() if k != "beat"}) for s in BEATS) + words([p.get("text", "") for p in cta.get("slogan", [])]) \
    + words((cta.get("name") or {}).get("text", "")) + words((cta.get("prop") or {}).get("text", ""))
LINES = [t.strip() for t in arg("--text", "").split(",") if t.strip()] or \
    [s["text"] for s in BEATS if isinstance(s.get("text"), str)] + ["".join(p.get("text", "") for p in cta.get("slogan", []))]
LINES = [l for l in dict.fromkeys(LINES) if l.strip()]

if "--list" in argv:
    have = fonts.covering(CHARS, EXTRA)
    own = {f[0] for f in have if str(FILM / "fonts") in f[2]}
    fams = {}
    for fam, sty, path, _ in have:
        fams.setdefault(fam, []).append(sty)
    print(f"{len(have)} faces in {len(fams)} families have all {len(set(CHARS) - set(' '))} characters the film shows:")
    for fam, stys in fams.items():
        mark = "  (the film's own fonts/)" if fam in own else ""
        print(f"  {fam}{mark}: {', '.join(stys)}")
    print('compare a few: run.mjs typesheet -- --faces "Family:Style,Family:Style"')
    sys.exit(0)

if not arg("--faces"):
    raise SystemExit('which faces? typesheet -- --faces "PingFang TC:Semibold,Lantinghei TC:Heavy" (run.mjs fonts lists them)')
WANT = [tuple(x.strip().split(":", 1)) for x in arg("--faces").split(",") if ":" in x]
try:
    import colors  # noqa: E402
    STAGE = colors.stage_for(FILM)[1]["sky"]
except Exception:
    STAGE = "#0b0c10"
COLOR, EDGE = arg("--color", "#FFFDF7"), arg("--edge")
EDGE_W, TRACK = float(arg("--edge-width", 0.06)), float(arg("--track", 0.08))
W, H = F["format"]["size"]
PH = reading.PHONE if W >= H else round(reading.PHONE * H / W)  # the frame's height at phone size
SIZES = [("title", 0.10), ("small", 0.06)]
UP = 6  # drawn this many times bigger, then shrunk: the phone's own smoothing


def strip(face, text, share):
    """The line at phone size: its letters `share` of the frame's height, on the stage; and how much of its box is ink."""
    em = share * PH * UP / 0.88  # a CJK face's letters stand about 0.88 em
    f = ImageFont.truetype(face[0], round(em), index=face[1])
    adv = [f.getlength(c) + (TRACK * em if ord(c) > 0x2E80 else 0.03 * em) for c in text]
    pad = round(0.4 * em)
    img = Image.new("RGB", (round(sum(adv)) + 2 * pad, round(1.5 * em) + 2 * pad), STAGE)
    ink = Image.new("L", img.size, 0)
    d, di = ImageDraw.Draw(img), ImageDraw.Draw(ink)
    x = pad
    for c, a in zip(text, adv):
        kw = {"stroke_width": round(EDGE_W * em), "stroke_fill": EDGE} if EDGE else {}
        d.text((x, pad), c, font=f, fill=COLOR, **kw)
        di.text((x, pad), c, font=f, fill=255)
        x += a
    box = ink.getbbox() or (0, 0, 1, 1)
    cover = float((np.asarray(ink.crop(box)) > 127).mean())
    return img.resize((max(1, img.width // UP), max(1, img.height // UP)), Image.LANCZOS), cover


found = []
for fam, sty in WANT:
    try:
        path, index, label = fonts.face("heavy", [(fam, sty)], EXTRA)
    except SystemExit as e:
        print(f"✗ {fam} {sty}: not on this computer")
        continue
    found.append((label, (path, index)))
if not found:
    raise SystemExit("none of those faces is here (run.mjs fonts lists them)")

r = reading.reader()
cells, tmp = [], Path(tempfile.mkdtemp())
for label, face in found:
    for li, text in enumerate(LINES):
        for size, share in SIZES:
            img, cover = strip(face, text, share)
            p = tmp / f"{len(cells)}.png"
            img.save(p)
            cells.append({"face": label, "line": li, "text": text, "size": size, "img": img, "cover": cover, "path": str(p)})
got = reading.read(r, [c["path"] for c in cells])
base = {label: reading.baseline(r, LINES, face) for label, face in found}
for c in cells:
    c["read"], c["said"] = reading.match(c["text"], got.get(c["path"], []), base[c["face"]].get(c["text"])) if r else ("unread", "")

# the sheet: a block a face, a row a line (big, small), shown twice the phone size so it can be looked at
try:
    _p = fonts.face("page")
    LAB = ImageFont.truetype(_p[0], 22, index=_p[1])
except Exception:
    LAB = ImageFont.load_default()
SHOW = 2
colw = max(c["img"].width for c in cells) * SHOW + 20
rowh = max(c["img"].height for c in cells) * SHOW + 34
blocks = []
for label, _ in found:
    mine = [c for c in cells if c["face"] == label]
    okn = {s: sum(c["read"] == "ok" for c in mine if c["size"] == s) for s, _ in SIZES}
    cov = max(c["cover"] for c in mine)
    head = f"{label}   读得出：大字 {okn['title']}/{len(LINES)}，小字 {okn['small']}/{len(LINES)}   墨量最多 {cov:.0%}" + ("（偏密）" if cov > 0.45 else "")
    blocks.append((head, mine, okn, cov))
sheet = Image.new("RGB", (20 + colw * 2, sum(50 + rowh * len(LINES) for _ in blocks) + 20), "#F4F2EE")
d = ImageDraw.Draw(sheet)
y = 14
MARK = {"ok": ("读出", "#1E6B34"), "shaky": ("勉强读出", "#9A6700"), "wrong": ("读错", "#B3261E"), "unread": ("没有读字工具", "#555")}
for head, mine, _, _ in blocks:
    d.text((20, y), head, font=LAB, fill="#1a1a1a")
    y += 40
    for li in range(len(LINES)):
        for k, (size, _) in enumerate(SIZES):
            c = next(c for c in mine if c["line"] == li and c["size"] == size)
            im = c["img"].resize((c["img"].width * SHOW, c["img"].height * SHOW), Image.NEAREST)
            sheet.paste(im, (20 + k * colw, y))
            word, ink = MARK[c["read"]]
            d.text((20 + k * colw, y + im.height + 4), f"{word}：{c['said'] or '—'}", font=LAB, fill=ink)
        y += rowh
    y += 10
out = FILM / "build/type-sheet.jpg"
out.parent.mkdir(exist_ok=True)
sheet.save(out, quality=88)
(FILM / "build/type-sheet.json").write_text(json.dumps([{"face": h.split("   ")[0], "title": o["title"], "small": o["small"], "lines": len(LINES), "ink": round(cv, 3)} for h, _, o, cv in blocks], ensure_ascii=False, indent=1))
print(f"reader: {reading.name(r) or 'none (the sheet shows the faces; nothing read them)'}")
for head, *_ in blocks:
    print(" ", head)
print("->", out)

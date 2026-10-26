"""Glyph outlines for the 3D lettering, flattened to polygons: the counter's
digits, unit and label (act 2) and the call to action's torn-paper labels.
Each role takes its face from engine/lib/fonts.py (isnail's type design, with
free fallbacks) and its characters from film.json. A character the face does
not have stops the build here, before anything renders.
Rings are in em units (y up, baseline 0); Blender extrudes them as curves.

usage: FILM=<film folder> python3 engine/scripts/glyphs.py   → build/glyphs.json
"""
import json
import sys
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON  # noqa: E402  the film workspace (FILM env var)
from fonts import face  # noqa: E402

ROOT = FILM
F = FILM_JSON
lang = F.get("language", "zh-Hans")
prefs = {role: [(p["family"], p["style"]) for p in v] for role, v in F.get("type", {}).items()}
cta = F["cta"]
CHARS = {
    "latin": "0123456789",  # the counter's digits
    "cjk": F["counter"]["unit"] + F["counter"]["label"],
    "heavy": "".join(p["text"] for p in [*cta["slogan"], cta["name"], cta["handle"]]),
}
FONTS = {}
for role, chars in CHARS.items():
    path, index, name = face(role, lang, prefs.get(role, ()), [str(FILM / "fonts")])
    FONTS[role] = (path, index, chars)
    print(f"{role:6s} {name}  ({Path(path).name} #{index})")


class Flatten(BasePen):
    def __init__(self, glyphset, steps=10):
        super().__init__(glyphset)
        self.rings, self.cur, self.steps = [], [], steps

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
            self.cur.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))

    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            a, b, c = (1 - t) ** 2, 2 * (1 - t) * t, t * t
            self.cur.append((a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]))

    def _closePath(self):
        ring = self.cur
        if len(ring) > 1 and ring[0] == ring[-1]:
            ring = ring[:-1]
        if len(ring) >= 3:
            self.rings.append(ring)
        self.cur = []

    _endPath = _closePath


out = {}
for key, (path, index, chars) in FONTS.items():
    font = TTFont(path, fontNumber=index)
    upm = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font["hmtx"]
    missing = sorted({ch for ch in chars if ord(ch) not in cmap})
    if missing:
        raise SystemExit(f"{key}: {Path(path).name} has no glyph for {' '.join(missing)}")
    for ch in sorted(set(chars)):
        name = cmap[ord(ch)]
        pen = Flatten(gs)
        gs[name].draw(pen)
        out[f"{key}:{ch}"] = {
            "advance": round(hmtx[name][0] / upm, 5),
            "rings": [[[round(x / upm, 5), round(y / upm, 5)] for x, y in r] for r in pen.rings],
        }
(ROOT / "build").mkdir(exist_ok=True)
(ROOT / "build/glyphs.json").write_text(json.dumps(out))
print(len(out), "glyphs ->", ROOT / "build/glyphs.json")

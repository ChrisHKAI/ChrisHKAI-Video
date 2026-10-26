"""Glyph outlines for the 3D lettering, flattened to polygons: the fold
counter and the tribute, all in Lantinghei SC Heavy (one heavy face for
Chinese and Latin). Rings are in em units (y up, baseline 0); Blender
extrudes them as curves.

usage: python3 scripts/glyphs.py   → build/glyphs.json
"""
import json
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
LANTING = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/f14049099a04e570b893c01d9a4cd71f87c9e8d8.asset/AssetData/Lantinghei.ttc"
TEXT = ["次 folds", "致敬 Steve Jobs", "1955-2011"]  # every string on screen
CHARS = sorted(set("".join(TEXT)) | set("0123456789+"))


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


font = TTFont(LANTING, fontNumber=2)  # Lantinghei SC Heavy
upm = font["head"].unitsPerEm
cmap = font.getBestCmap()
gs = font.getGlyphSet()
hmtx = font["hmtx"]
out = {}
for ch in CHARS:
    name = cmap[ord(ch)]
    pen = Flatten(gs)
    gs[name].draw(pen)
    out[f"heavy:{ch}"] = {
        "advance": round(hmtx[name][0] / upm, 5),
        "rings": [[[round(x / upm, 5), round(y / upm, 5)] for x, y in r] for r in pen.rings],
    }
(ROOT / "build/glyphs.json").write_text(json.dumps(out))
print(len(out), "glyphs ->", ROOT / "build/glyphs.json")

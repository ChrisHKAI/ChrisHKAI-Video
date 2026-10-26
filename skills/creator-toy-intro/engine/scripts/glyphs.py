"""Glyph outlines for the 3D lettering, flattened to polygons: the stat's
digits / 万 / 阅读 (act 2) and the call to action's torn-paper labels
(公众号变现找蜗牛, 蜗牛King, @isnail in Lantinghei SC Heavy).
Rings are in em units (y up, baseline 0); Blender extrudes them as curves.

usage: python3 scripts/glyphs.py   → build/glyphs.json
"""
import json
import sys
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM  # noqa: E402  the film workspace (FILM env var)

ROOT = FILM
PINGFANG = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc"
LANTING = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/f14049099a04e570b893c01d9a4cd71f87c9e8d8.asset/AssetData/Lantinghei.ttc"
FONTS = {
    "latin": ("/System/Library/Fonts/HelveticaNeue.ttc", 1, "0123456789@isnailKg"),  # Helvetica Neue Bold
    "cjk": (PINGFANG, 11, "万阅读公众号变现找蜗牛"),  # PingFang SC Semibold
    # the sign-off on torn paper (one heavy face for Chinese and Latin, like the cover)
    "heavy": (LANTING, 2, "蜗牛King@isnail公众号变现找"),  # Lantinghei SC Heavy
}


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

"""Static font instances for Blender (it reads only a variable font's default, and
one face of a collection): SF Pro Black, SF Rounded Black into build/; the letters'
candidate faces into build/fonts/ (SF Pro Heavy and Bold, Helvetica Neue Bold, Avenir
Next Heavy and Bold, DIN Alternate Bold: all from this Mac's own fonts).

usage: python3 scripts/fonts.py
"""
from pathlib import Path

import shutil

from fontTools.ttLib import TTCollection, TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
for src, out, extra in (("SFNS.ttf", "SFPro-Black.ttf", {"wdth": 100, "opsz": 96.0}), ("SFNSRounded.ttf", "SFRounded-Black.ttf", {})):
    f = TTFont(f"/System/Library/Fonts/{src}")
    loc = {a.axisTag: a.defaultValue for a in f["fvar"].axes}
    loc.update({"wght": 1000, **extra})
    instantiateVariableFont(f, loc, inplace=False).save(ROOT / "build" / out)
    print("wrote", ROOT / "build" / out)
(ROOT / "build/fonts").mkdir(exist_ok=True)
for w, out in ((800, "SFPro-Heavy.ttf"), (700, "SFPro-Bold.ttf")):
    f = TTFont("/System/Library/Fonts/SFNS.ttf")
    loc = {a.axisTag: a.defaultValue for a in f["fvar"].axes}
    loc.update({"wght": w, "wdth": 100, "opsz": 96.0})
    instantiateVariableFont(f, loc, inplace=False).save(ROOT / "build/fonts" / out)
for src, want, out in (("HelveticaNeue.ttc", "Helvetica Neue Bold", "HelveticaNeue-Bold.ttf"),
                       ("Avenir Next.ttc", "Avenir Next Heavy", "AvenirNext-Heavy.ttf"),
                       ("Avenir Next.ttc", "Avenir Next Bold", "AvenirNext-Bold.ttf")):
    col = TTCollection(f"/System/Library/Fonts/{src}")
    next(f for f in col.fonts if f["name"].getDebugName(4) == want).save(ROOT / "build/fonts" / out)
shutil.copy("/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf", ROOT / "build/fonts/DINAlternate-Bold.ttf")
print("wrote", ROOT / "build/fonts")

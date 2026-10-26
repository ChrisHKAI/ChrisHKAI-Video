"""isnail's pinned cover (公众号新号从0到1…) cut into the pieces that push out
of the act 2 wall: the stage, the stairs, the title a character at a time,
the props. Coordinates are px of assets/pinned-cover.jpg (1983 x 793).

  build/cover2.json   pieces: outline rings in cover UV (0..1, v down)

usage: FILM=films/isnail python3 recipes/cover-pinned.py
"""
import json
import os
import sys
from pathlib import Path

from PIL import Image

FILM = Path(os.environ["FILM"]).resolve()
sys.path.insert(0, str(Path(os.environ.get("SKILL", FILM.parents[1] / "skills/creator-toy-intro")) / "engine/lib"))
from cutlib import check_image, hsv, region, rings, uv  # noqa: E402

im = Image.open(FILM / "assets/pinned-cover.jpg").convert("RGB")
W, H = im.size
hue, sat, val = hsv(im)
RED = ((hue < 0.05) | (hue > 0.93)) & (sat > 0.45) & (val > 0.25)
DARK = (val < 0.33) & ~RED
LIGHT = (val > 0.8) & (sat < 0.25)
at = lambda x0, y0, x1, y1: region((H, W), x0, y0, x1, y1)  # noqa: E731

pieces = []


def box(name, points):
    pieces.append({"name": name, "kind": "box", "rings": [uv(points, W, H)]})


def ink(name, mask, **kw):
    pieces.append({"name": name, "kind": "box", "rings": rings(mask, W, H, **kw)})


# the stage everything stands on, the stairs under 0 and 1, the boards at left
box("stage", [(150, 671), (1928, 671), (1962, 749), (112, 749)])
box("stairs0", [(800, 362), (1000, 362), (1000, 452), (790, 452)])
box("stairs1", [(1045, 362), (1262, 362), (1262, 445), (1040, 445)])
box("boards", [(0, 242), (560, 318), (560, 640), (0, 652)])
# the title, one character at a time (公 众 号 新 号 从), then 0 到 1
TITLE = [(148, 268), (268, 392), (392, 500), (500, 600), (600, 706)]
for i, (x0, x1) in enumerate(TITLE):
    ink(f"t{i}", DARK & at(x0, 95, x1, 268))
ink("cong", RED & at(700, 95, 836, 268))
ink("zero", DARK & at(828, 55, 992, 372), fill=True)
ink("dao", DARK & at(990, 112, 1096, 268))
ink("one", RED & at(1094, 10, 1262, 372), fill=True)
ink("qihao", DARK & at(1244, 80, 1702, 186))
ink("quanjie", DARK & at(1244, 186, 1625, 292))
ink("tag", RED & at(1672, 222, 1912, 280))
ink("rinei", (DARK | RED) & at(1492, 322, 1915, 396))
# the props
box("notebook", [(632, 450), (808, 450), (808, 672), (632, 672)])
box("card", [(903, 455), (1073, 455), (1073, 668), (903, 668)])
box("phone", [(1137, 443), (1312, 443), (1312, 684), (1137, 684)])
ink("board", RED & at(1400, 432, 1668, 682), fill=True, close=4)
ink("board_ink", LIGHT & at(1408, 450, 1662, 676), min_area=40)
ink("seat", (val < 0.42) & at(348, 538, 508, 698), fill=True, close=3)
ink("stand", (val < 0.56) & at(1684, 460, 1800, 728), fill=True, close=3)

out = {"w": W, "h": H, "src": "pinned-cover.jpg", "pieces": [p for p in pieces if p["rings"]]}
(FILM / "build").mkdir(exist_ok=True)
(FILM / "build/cover2.json").write_text(json.dumps(out))
for p in out["pieces"]:
    print(f"{p['name']:10s} rings={len(p['rings']):3d} pts={sum(len(r) for r in p['rings'])}")
check_image(im, out["pieces"], lambda p: (0, 200, 0) if p["name"] in ("stage", "boards") else (255, 0, 255)).save(FILM / "build/cover2-check.png")

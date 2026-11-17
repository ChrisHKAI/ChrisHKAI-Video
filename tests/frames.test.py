"""A story's frames (references/frames.md), offline: the stage draws a frame (boxes, standing pictures, the toy's
cut-out or its stand-in, lettering, marks) in one perspective; every pose the frames name has its joints and a view,
and the ones for when things go wrong are moves in the film too. The poses themselves are rendered in Blender from
a film's own toy (`FILM=<film> run.mjs poses`): try that on a film, it takes seconds.

usage: python3 tests/frames.test.py   (needs Pillow and numpy: it finds the skill's own Python when this one has none)
"""
import json
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1] / "skills/creator-toy-intro"
try:
    import numpy  # noqa: F401
    from PIL import Image
except ImportError:
    own = Path(os.environ.get("CHRISHKAI_VIDEO_HOME") or Path.home() / ".chrishkai-video") / "venv/bin/python3"
    if own.exists() and os.environ.get("FRAMES_TEST_OWN") != "1":
        os.execve(str(own), [str(own), __file__], {**os.environ, "FRAMES_TEST_OWN": "1"})
    print("skipped: no Pillow here, and no Python of the skill's own (run.mjs doctor installs one)")
    sys.exit(0)

sys.path.insert(0, str(SKILL / "engine/lib"))
import stagekit as K  # noqa: E402

BOOK = json.loads((SKILL / "engine/lib/poses.json").read_text())


class Frames(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="frames-")
        self.addCleanup(self.tmp.cleanup)
        self.film = Path(self.tmp.name)
        (self.film / "assets").mkdir()
        Image.new("RGB", (200, 200), (220, 60, 40)).save(self.film / "assets/avatar.png")
        (self.film / "film.json").write_text(json.dumps({"id": "t", "profile": {"name": "T", "avatar": "assets/avatar.png"}}))

    def test_a_frame_is_drawn_and_what_is_put_on_it_is_there(self):
        empty = K.Stage().render()
        st = K.Stage(cam=(0, 1.1, -5.0), pitch=5)
        cover = Image.new("RGBA", (800, 340), (30, 90, 200, 255))
        st.card(cover, 1.8, 0.5, 2.3, height=1.15, yaw=-8)
        st.box(-1.2, 0, 0.4, 1.2, 0.33, 1.0, "#F0842C", tex={"front": K.board("不", 80, marks={"不": "#D8382D"})})
        st.sprite(K.toy(self.film, "startle"), -1.2, 0.4, y=0.33)
        st.sprite(K.thing(K.stamp("官方认证", 60)), 0.6, -0.4, height=0.4)
        st.screen(K.mark("!", 110), *st.at((-1.2, 1.45, 0.4)))
        st.screen(K.paper("铁柱AGI", 64), 300, 160, rot=-3, shadow=110)
        st.lines([(100, 800), (300, 760)], dash=8)
        st.confetti(["#F0842C", "#FFFFFF"], n=10)
        im = st.render()
        self.assertEqual(im.size, (1600, 900))
        changed = sum(1 for a, b in zip(im.resize((160, 90)).getdata(), empty.resize((160, 90)).getdata()) if max(abs(x - y) for x, y in zip(a, b)) > 24)
        self.assertGreater(changed, 160 * 90 * 0.08, "the frame holds what was put on it")
        # the cover stands where it was put: right of the middle, above the floor line
        r, g, b = im.getpixel(st.at((1.8, 1.0, 2.3)))
        self.assertTrue(b > r + 60 and b > g + 40, (r, g, b))

    def test_before_the_toy_is_built_its_picture_stands_in(self):
        cut = K.toy(self.film, "kick:right")
        self.assertIsInstance(cut, K.Cut)
        px = cut.image.getpixel((cut.image.width // 2, int(cut.image.height * 0.3)))
        self.assertTrue(px[0] > 180 and px[1] < 110, f"the creator's picture, in the disc: {px}")

    def test_a_rendered_pose_is_taken_with_its_scale(self):
        folder = self.film / "build/poses"
        folder.mkdir(parents=True)
        Image.new("RGBA", (900, 1100), (0, 0, 0, 0)).save(folder / "kick.right.png")
        (folder / "poses.json").write_text(json.dumps({"kick:right": {"file": "kick.right.png", "per_unit": 794.1, "feet": 994.7, "centre": 450.0}}))
        cut = K.toy(self.film, "kick:right")
        self.assertEqual((cut.per_unit, cut.feet, cut.centre, cut.image.size), (794.1, 994.7, 450.0, (900, 1100)))

    def test_a_point_further_away_is_drawn_smaller_and_higher(self):
        st = K.Stage(cam=(0, 1.1, -5.0), pitch=5)
        self.assertGreater(st.px((0, 0, 0)), st.px((0, 0, 4)))
        self.assertGreater(st.at((0, 0, 0))[1], st.at((0, 0, 4))[1])
        self.assertLess(st.at((-1, 0, 0))[0], st.at((1, 0, 0))[0])


class Poses(unittest.TestCase):
    def test_every_pose_has_joints_a_view_and_what_it_says(self):
        joints = {"body", "head", "armR", "armL", "legR", "legL", "ears", "point"}
        for name, p in BOOK["poses"].items():
            self.assertTrue(p.get("says"), name)
            self.assertIn(p.get("view"), BOOK["views"], name)
            self.assertTrue(set(p["joints"]) <= joints, (name, set(p["joints"]) - joints))
            for j, v in p["joints"].items():
                if j != "point":
                    self.assertEqual(len(v), 3, (name, j))

    def test_when_things_go_wrong_the_frames_pose_is_a_move_in_the_film(self):
        kit = (SKILL / "engine/lib/beatkit.js").read_text()
        for move in ("startle", "duck", "slump", "shrug", "lookUp", "push", "kick", "holdUp"):
            self.assertIn(move, BOOK["poses"], move)
            self.assertRegex(kit, rf"export function {move}\(o, g, g0, g1", move)

    def test_the_docs_name_the_poses_there_are(self):
        doc = (SKILL / "references/frames.md").read_text()
        for name in BOOK["poses"]:
            if name != "cheer":
                self.assertIn(f"`{name}`", doc, name)
        for view in BOOK["views"]:
            self.assertIn(f"`{view}`", doc, view)
        self.assertTrue(all(re.search(rf"\b{f}\b", doc) for f in BOOK["frames"]))


if __name__ == "__main__":
    unittest.main(verbosity=1)

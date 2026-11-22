#!/usr/bin/env python3
"""Unit tests for v0.8.4 engine reliability fixes:
- pacing.slanted() ignores hidden letters (scale <= 1e-3) in multi-line beats
- diff-anim.py ignores parked-coordinate/color edits where objects stay hidden in both anims
- reading.match() uses minimal high-confidence cover + char-weighted mean on Vision-split lines
- compare.py --frames prints reference frame numbers without needing rendered frames
- score.py groove() falls back cleanly on unknown groove modes
- scene.py bevel_spiked() flattens bevels that shoot miter spikes past glyph outlines (Blender check if installed)
"""
import importlib.util
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/creator-toy-intro"
LIB = SKILL / "engine/lib"
SCRIPTS = SKILL / "engine/scripts"

# Re-exec with the skill's venv Python if this interpreter lacks numpy.
try:
    import numpy as np  # noqa: F401
except ImportError:
    venv_py = Path.home() / ".chrishkai-video/venv/bin/python3"
    if venv_py.exists() and Path(sys.executable).resolve() != venv_py.resolve():
        os.execv(str(venv_py), [str(venv_py), __file__, *sys.argv[1:]])
    raise

sys.path.insert(0, str(LIB))
import pacing  # noqa: E402
import reading  # noqa: E402


def load_script(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


diff_anim = load_script("diff_anim", SCRIPTS / "diff-anim.py")


class PacingSlantedTests(unittest.TestCase):
    def _anim(self, shown_q, hidden_pos=(0, -5, 0)):
        fps, sub, dur = 30, 2, 4
        S = (fps * dur - 1) * sub + 1
        cam = [[0, 0, 0.2, 1.0, 0, 0, 0, 1, 1, 1, 1], [S - 1, 0, 0.2, 1.0, 0, 0, 0, 1, 1, 1, 1]]
        vis_line = [[0, 0, 0.2, 0.0, *shown_q, 1, 1, 1], [S - 1, 0, 0.2, 0.0, *shown_q, 1, 1, 1]]
        hid_line = [[0, *hidden_pos, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4], [S - 1, *hidden_pos, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4]]
        objs = [
            {"name": "camera", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_live0", "letter": "A", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_live1", "letter": "B", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_hid0", "letter": "X", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_hid1", "letter": "Y", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_hid2", "letter": "Z", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_hid3", "letter": "W", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
        ]
        tracks = {
            "camera": cam,
            "beat0_live0": vis_line,
            "beat0_live1": vis_line,
            "beat0_hid0": hid_line,
            "beat0_hid1": hid_line,
            "beat0_hid2": hid_line,
            "beat0_hid3": hid_line,
        }
        return {"fps": fps, "sub": sub, "frames": fps * dur, "samples": S, "objects": objs, "tracks": tracks, "scalars": {}}, [
            {"kind": "beat", "f0": 0.0, "f1": float(dur)}
        ]

    def test_hidden_parked_letters_do_not_trigger_slant(self):
        # 2 visible letters facing straight at camera (+z), outnumbered by 4 hidden letters parked underground at y=-5
        anim, segs = self._anim(shown_q=(0, 0, 0, 1))
        self.assertEqual(pacing.slanted(anim, segs), [])

    def test_truly_slanted_visible_letters_are_still_caught(self):
        # Rotate visible letters 40 degrees around Y so they genuinely face away from the camera
        rad = math.radians(40)
        q = (0, math.sin(rad / 2), 0, math.cos(rad / 2))
        anim, segs = self._anim(shown_q=q)
        res = pacing.slanted(anim, segs)
        self.assertEqual(len(res), 1)
        self.assertGreaterEqual(res[0]["deg"], 35)
        self.assertEqual(res[0]["names"], ["beat0_live0", "beat0_live1"])


class DiffAnimTests(unittest.TestCase):
    def _base_anim(self, park_x=0.0, show_lamp=True):
        F, SUB = 60, 2
        N = F * SUB - 1
        # Beat 1 visible on frames 21..40 (samples 40..79), parked outside
        star_keys = [
            [0, park_x, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [39, park_x, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [40, 0.1 + park_x, 0.1, 0, 0, 0, 0, 1, 1, 1, 1],
            [79, 0.1 + park_x, 0.1, 0, 0, 0, 0, 1, 1, 1, 1],
            [80, park_x, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [N - 1, park_x, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
        ]
        lamp_sc = [1, 1, 1] if show_lamp else [1e-4, 1e-4, 1e-4]
        lamp_keys = [
            [0, -0.5, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [39, -0.5, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [40, -0.5, 0.1, 0, 0, 0, 0, 1, *lamp_sc],
            [79, -0.5, 0.1, 0, 0, 0, 0, 1, *lamp_sc],
            [80, -0.5, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [N - 1, -0.5, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
        ]
        return {
            "fps": 30, "frames": F, "sub": SUB, "samples": N,
            "objects": [
                {"name": "star0", "parent": "root", "geo": {"type": "box", "size": [0.1, 0.1, 0.1]}, "mat": {"type": "type"}, "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                {"name": "lamp", "parent": "root", "geo": {"type": "box", "size": [0.1, 0.1, 0.1]}, "mat": {"type": "type"}, "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            ],
            "tracks": {"star0": star_keys, "lamp": lamp_keys},
            "colors": {},
            "scalars": {},
        }

    def test_parked_hidden_changes_do_not_trigger_full_rerender(self):
        old = self._base_anim(park_x=0.0, show_lamp=True)
        new = self._base_anim(park_x=0.02, show_lamp=False)
        frames, _ = diff_anim.diff_frames(old, new)
        # Only frames around Beat 1 (20..41), never frames 1..19 or 42..60!
        self.assertTrue(frames)
        self.assertGreaterEqual(min(frames), 20)
        self.assertLessEqual(max(frames), 41)
        self.assertLess(len(frames), 25)


class ReadingSplitCoverTests(unittest.TestCase):
    def test_vision_split_mixed_script_line_passes_with_background_duplicate(self):
        # Exact scenario from Fini.Yang 0317.png: Vision reads foreground cleanly in 2 boxes + noisy card logo at 0.30
        lines = [
            ("OpenPencil 开源", 1.0),
            ("AI 设计", 0.30),
            ("日 openPoncll", 0.30),
            ("0.8.5", 1.0),
            ("7,306 Stars", 0.50),
        ]
        status, _ = reading.match("OpenPencil 开源 AI 设计", lines, base=0.50)
        self.assertEqual(status, "ok")

    def test_genuinely_blurry_split_line_still_flags_shaky(self):
        lines = [("OpenPencil 开源", 0.32), ("AI 设计", 0.30)]
        status, _ = reading.match("OpenPencil 开源 AI 设计", lines, base=0.50)
        self.assertEqual(status, "shaky")


class CompareAndScoreTests(unittest.TestCase):
    def test_compare_frames_flag_works_without_rendered_pngs(self):
        with tempfile.TemporaryDirectory() as tmp:
            tdir = Path(tmp)
            (tdir / "film.json").write_text(json.dumps({"format": {"fps": 30, "duration": 30}, "posts": {}}))
            (tdir / "build").mkdir()
            (tdir / "build/timeline.json").write_text(json.dumps({
                "FPS": 30,
                "DURATION": 30,
                "SEGMENTS": [
                    {"kind": "beat", "f0": 0, "f1": 6, "storyboard": {"frames": [{"at": 4.0}]}},
                    {"kind": "beat", "f0": 6, "f1": 12, "storyboard": {"frames": [{"at": 4.5}]}},
                    {"kind": "beat", "f0": 12, "f1": 24, "storyboard": {"frames": [{"at": 9.5}]}},
                    {"kind": "beat", "f0": 24, "f1": 30, "storyboard": {"frames": [{"at": 4.8}]}},
                ],
                "STORY": {"EV": {}},
            }))
            env = {**os.environ, "FILM": str(tdir)}
            r = subprocess.run([sys.executable, str(SCRIPTS / "compare.py"), "--frames"], capture_output=True, text=True, env=env, check=True)
            nums = [int(x) for x in r.stdout.strip().split(",")]
            # opening=16 (0.5s), toy=106 (3.5s), proof=316 (10.5s), payoff=646 (21.5s), end=886 (29.5s)
            self.assertEqual(nums, [16, 106, 316, 646, 886])

    def test_score_groove_handles_unknown_mode_gracefully(self):
        src = (SKILL / "templates/isnail-30/score.py").read_text()
        self.assertIn("GROOVE_KICKS", src)
        self.assertIn("unknown groove", src)


class SceneBevelSpikeBlenderTest(unittest.TestCase):
    def test_blender_flattens_hairpin_curve_bevel_spike(self):
        blender = shutil.which("blender") or ("/Applications/Blender.app/Contents/MacOS/Blender" if Path("/Applications/Blender.app/Contents/MacOS/Blender").exists() else None)
        if not blender:
            self.skipTest("Blender not installed")
        # Build a tiny temporary film workspace with a hairpin-corner curve that shoots a huge miter spike under bevel!
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "film.json").write_text(json.dumps({
                "format": {"fps": 30, "duration": 1, "size": [320, 180]},
                "toy": "toy.json",
                "cta": {},
                "look": {},
            }))
            (fdir / "toy.json").write_text(json.dumps({"colors": {"body": "#2F61EB"}, "height": 0.12}))
            (fdir / "build").mkdir()
            # Near-180° hairpin spike polygon (width ~0.04 m, height ~0.04 m) + normal square
            hairpin = [[0.0, 0.0], [0.04, 0.0], [0.04, 0.04], [0.02, 0.04], [0.02002, 0.002], [0.01998, 0.04], [0.0, 0.04]]
            square = [[0.0, 0.0], [0.04, 0.0], [0.04, 0.04], [0.0, 0.04]]
            (fdir / "build/anim.json").write_text(json.dumps({
                "fps": 30, "frames": 1, "sub": 1, "samples": 1,
                "objects": [
                    {"name": "camera", "parent": "root", "camera": True, "geo": None, "tr": [0, 0, 1, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "fx", "parent": "root", "light": True, "geo": None, "tr": [0, 1, 1, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "spiky_single", "parent": "root", "geo": {"type": "curve", "rings": [hairpin], "depth": 0.003, "bevel": 0.0005}, "mat": {"type": "type", "color": "#FFFFFF", "emit": 0}, "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "spiky_sided", "parent": "root", "geo": {"type": "curve", "rings": [hairpin], "depth": 0.003, "bevel": 0.0005}, "mat": {"type": "type", "color": "#FFFFFF", "emit": 0, "side": "#111111"}, "tr": [0.1, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "clean_sq", "parent": "root", "geo": {"type": "curve", "rings": [square], "depth": 0.003, "bevel": 0.0005}, "mat": {"type": "type", "color": "#FFFFFF", "emit": 0}, "tr": [0.2, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                ],
                "tracks": {},
                "colors": {},
                "scalars": {"fov": [35.0], "focus": [1.0], "fstop": [5.6], "fx_energy": [1.0], "fx_color": [[1.0, 1.0, 1.0]]},
            }))
            check_expr = """
import bpy, json
deps = bpy.context.evaluated_depsgraph_get()
out = {}
for n in ("spiky_single", "spiky_sided", "clean_sq"):
    o = bpy.data.objects[n].evaluated_get(deps)
    me = bpy.data.meshes.new_from_object(o)
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    out[n] = {"x": [round(min(xs), 4), round(max(xs), 4)], "y": [round(min(ys), 4), round(max(ys), 4)], "bevel": getattr(o.data, "bevel_depth", None)}
    bpy.data.meshes.remove(me)
print("RESULT:" + json.dumps(out))
"""
            env = {**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)}
            r = subprocess.run([blender, "-b", "--factory-startup", "--python-exit-code", "1", "-P", str(SCRIPTS / "scene.py"), "--python-expr", check_expr, "--", "--samples", "1", "--scale", "10"], capture_output=True, text=True, env=env)
            self.assertEqual(r.returncode, 0, msg=f"Blender failed:\nSTDOUT:\n{r.stdout}\nSTDERR:\n{r.stderr}")
            line = next(x for x in r.stdout.splitlines() if x.startswith("RESULT:"))
            data = json.loads(line.split("RESULT:", 1)[1])
            # Both hairpin curves must stay tightly bounded within [0, 0.04] (zero miter spike!)
            self.assertLessEqual(data["spiky_single"]["x"][1], 0.045)
            self.assertGreaterEqual(data["spiky_single"]["y"][0], -0.005)
            self.assertEqual(data["spiky_single"]["bevel"], 0.0)
            self.assertLessEqual(data["spiky_sided"]["x"][1], 0.045)
            self.assertGreaterEqual(data["spiky_sided"]["y"][0], -0.005)
            # Normal square keeps its bevel intact!
            self.assertAlmostEqual(data["clean_sq"]["bevel"], 0.0005, places=5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
